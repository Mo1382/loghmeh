import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import {
  createUser,
  findUserByEmail,
  findUserByIdentifier,
  findUserByIdWithPassword,
  findUserByUsername,
  markEmailAsVerified,
  updateUserPassword,
} from "@/repositories/user.repository";

import {
  consumeVerificationCode,
  findActiveVerificationCode,
  replaceVerificationCode,
} from "@/repositories/verification-code.repository";

import { ERROR_CODES } from "@/constants/error-codes";
import {
  ACCOUNT_STATUSES,
  VERIFICATION_CODE_PURPOSES,
} from "@/constants/enums";
import AppError from "@/lib/errors/AppError";
import { withTransaction } from "@/lib/transaction";

/**
 * Verification code lifetime.
 */
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000; // 10 min

/**
 * Password-reset token lifetime.
 */
const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 min

/**
 * Generate a six-digit verification code.
 */
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash a verification code before storing it.
 */
async function hashVerificationCode(code) {
  return bcrypt.hash(code, 10);
}

/**
 * Convert a User document into a safe plain object.
 *
 * Only explicitly allowed fields are returned.
 * Internal/security fields such as password, deletedAt,
 * and sessionVersion are never exposed.
 */
function toSafeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };

  return {
    id: data._id,
    username: data.username,
    email: data.email,
    avatar: data.avatar,
    bio: data.bio,
    title: data.title,
    role: data.role,
    socialLinks: data.socialLinks,
    stats: {
      recipeCount: data.stats?.recipeCount ?? 0,
      averageRating: data.stats?.averageRating ?? 0,
      totalRecipeViews: data.stats?.totalRecipeViews ?? 0,
    },
    emailVerified: data.emailVerified,
    accountStatus: data.accountStatus,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * Return the generic password-reset response.
 *
 * This prevents account enumeration by keeping the response
 * the same whether the email belongs to an account or not.
 */
function passwordResetRequestResponse() {
  return {
    message:
      "اگر حسابی با این ایمیل وجود داشته باشد، کد بازنشانی رمز عبور ارسال شده است.",
  };
}

/**
 * Get the secret used to sign password-reset tokens.
 */
function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("متغیر AUTH_SECRET تنظیم نشده است.");
  }

  return secret;
}

/**
 * Create a short-lived signed password-reset token.
 *
 * The token contains:
 * - email
 * - verification code document ID
 * - expiration time
 */
function createPasswordResetToken({ email, verificationCodeId, expiresAt }) {
  const payload = JSON.stringify({
    email,
    verificationCodeId: verificationCodeId.toString(),
    expiresAt,
  });

  const encodedPayload = Buffer.from(payload).toString("base64url");

  const signature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verify and decode a password-reset token.
 */
function verifyPasswordResetToken(token) {
  if (!token || typeof token !== "string") {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازنشانی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازنشانی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const expectedSignature = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encodedPayload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "utf8");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازنشانی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
  } catch {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازنشانی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (
    !payload.email ||
    !payload.verificationCodeId ||
    !payload.expiresAt ||
    Date.now() >= payload.expiresAt
  ) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_EXPIRED,
      "توکن بازنشانی رمز عبور منقضی شده است.",
      { statusCode: 400 }
    );
  }

  return payload;
}

/**
 * Register a new user.
 *
 * Flow:
 * 1. Check email uniqueness.
 * 2. Check username uniqueness.
 * 3. Hash password.
 * 4. Create user.
 * 5. Create email-verification code.
 *
 * Auth.js can sign the user in after this service
 * returns the newly created user.
 */
export async function registerUser({ username, email, password, title }) {
  const existingEmail = await findUserByEmail(email);

  if (existingEmail) {
    throw new AppError(
      ERROR_CODES.EMAIL_ALREADY_EXISTS,
      "حسابی با این ایمیل از قبل وجود دارد.",
      { statusCode: 409 }
    );
  }

  const existingUsername = await findUserByUsername(username);

  if (existingUsername) {
    throw new AppError(
      ERROR_CODES.USERNAME_ALREADY_EXISTS,
      "این نام کاربری قبلاً استفاده شده است.",
      { statusCode: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const verificationCode = generateVerificationCode();

  const codeHash = await hashVerificationCode(verificationCode);

  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  const user = await withTransaction(async (session) => {
    const newUser = await createUser(
      {
        username,
        email,
        password: passwordHash,
        title,
      },
      session
    );

    await replaceVerificationCode(
      {
        email,
        codeHash,
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt,
      },
      session
    );

    return newUser;
  });

  /*
   * The verificationCode must be sent through the
   * Email/Infrastructure layer and must never be returned
   * to the client.
   */

  return toSafeUser(user);
}

/**
 * Authenticate a user with email or username.
 *
 * Auth.js can use this function inside the Credentials
 * provider's authorize() callback.
 */
export async function loginUser({ identifier, password }) {
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    throw new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "ایمیل، نام کاربری یا رمز عبور نامعتبر است.",
      { statusCode: 401 }
    );
  }

  if (user.deletedAt) {
    throw new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "ایمیل، نام کاربری یا رمز عبور نامعتبر است.",
      { statusCode: 401 }
    );
  }

  if (user.accountStatus === "SUSPENDED") {
    throw new AppError(
      ERROR_CODES.USER_SUSPENDED,
      "این حساب کاربری معلق شده است.",
      { statusCode: 403 }
    );
  }

  if (user.accountStatus === "DEACTIVATED") {
    throw new AppError(
      ERROR_CODES.USER_DEACTIVATED,
      "این حساب کاربری غیرفعال شده است.",
      { statusCode: 403 }
    );
  }

  if (!user.emailVerified) {
    throw new AppError(
      ERROR_CODES.EMAIL_NOT_VERIFIED,
      "ایمیل حساب کاربری تأیید نشده است.",
      { statusCode: 403 }
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "ایمیل، نام کاربری یا رمز عبور نامعتبر است.",
      { statusCode: 401 }
    );
  }

  return toSafeUser(user);
}

/**
 * Verify a user's email address using a verification code.
 */
export async function verifyEmail({ email, code }) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (user.emailVerified) {
    throw new AppError(
      ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      "ایمیل قبلاً تأیید شده است.",
      { statusCode: 409 }
    );
  }

  const verificationCode = await findActiveVerificationCode(
    email,
    VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
  );

  if (!verificationCode) {
    throw new AppError(
      ERROR_CODES.VERIFICATION_CODE_NOT_FOUND,
      "کد تأیید نامعتبر یا منقضی شده است.",
      { statusCode: 400 }
    );
  }

  const codeMatches = await bcrypt.compare(code, verificationCode.codeHash);

  if (!codeMatches) {
    throw new AppError(
      ERROR_CODES.INVALID_VERIFICATION_CODE,
      "کد تأیید نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const updatedUser = await withTransaction(async (session) => {
    const consumedVerification = await consumeVerificationCode({
      verificationCodeId: verificationCode._id,
      email,
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      codeHash: verificationCode.codeHash,
      session,
    });

    if (!consumedVerification) {
      throw new AppError(
        ERROR_CODES.INVALID_VERIFICATION_CODE,
        "کد تأیید نامعتبر یا قبلاً استفاده شده است.",
        { statusCode: 400 }
      );
    }

    const verifiedUser = await markEmailAsVerified(user._id, session);

    if (!verifiedUser) {
      throw new AppError(
        ERROR_CODES.EMAIL_ALREADY_VERIFIED,
        "ایمیل قبلاً تأیید شده است.",
        { statusCode: 409 }
      );
    }

    return verifiedUser;
  });

  return toSafeUser(updatedUser);
}

/**
 * Request a password reset code.
 *
 * A generic response is returned even when the account
 * does not exist, preventing email/account enumeration.
 */
export async function requestPasswordReset({ email }) {
  const user = await findUserByEmail(email);

  if (
    !user ||
    user.deletedAt ||
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE
  ) {
    return passwordResetRequestResponse();
  }

  const resetCode = generateVerificationCode();

  const codeHash = await hashVerificationCode(resetCode);

  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  await replaceVerificationCode({
    email,
    codeHash,
    purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
    expiresAt,
  });

  /*
   * The resetCode must be sent through the
   * Email/Infrastructure layer and must never be returned
   * to the client.
   */

  return passwordResetRequestResponse();
}

/**
 * Verify a password-reset code.
 *
 * Returns a short-lived signed reset token.
 * The verification-code document remains active until
 * the password is successfully changed.
 */
export async function verifyPasswordResetCode({ email, code }) {
  const verificationCode = await findActiveVerificationCode(
    email,
    VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
  );

  if (!verificationCode) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_EXPIRED,
      "کد بازنشانی رمز عبور نامعتبر یا منقضی شده است.",
      { statusCode: 400 }
    );
  }

  const codeMatches = await bcrypt.compare(code, verificationCode.codeHash);

  if (!codeMatches) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "کد بازنشانی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  return {
    resetToken: createPasswordResetToken({
      email,
      verificationCodeId: verificationCode._id,
      expiresAt: expiresAt.getTime(),
    }),
  };
}

/**
 * Reset a user's password using a verified reset token.
 *
 * The password must be different from the current password.
 */
export async function resetPassword({ resetToken, password }) {
  const payload = verifyPasswordResetToken(resetToken);

  const user = await findUserByIdentifier(payload.email);

  if (!user || user.deletedAt) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (user.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "این حساب کاربری نمی‌تواند رمز عبور خود را بازنشانی کند.",
      { statusCode: 403 }
    );
  }

  const verificationCode = await findActiveVerificationCode(
    payload.email,
    VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
  );

  if (
    !verificationCode ||
    verificationCode._id.toString() !== payload.verificationCodeId
  ) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازنشانی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const sameAsCurrent = await bcrypt.compare(password, user.password);

  if (sameAsCurrent) {
    throw new AppError(
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
      { statusCode: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const updatedUser = await withTransaction(async (session) => {
    const consumedVerification = await consumeVerificationCode({
      verificationCodeId: verificationCode._id,
      email: payload.email,
      purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
      codeHash: verificationCode.codeHash,
      session,
    });

    if (!consumedVerification) {
      throw new AppError(
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        "توکن بازنشانی رمز عبور نامعتبر یا قبلاً استفاده شده است.",
        { statusCode: 400 }
      );
    }

    const updated = await updateUserPassword(user._id, passwordHash, session);

    if (!updated) {
      throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
        statusCode: 404,
      });
    }

    return updated;
  });

  return toSafeUser(updatedUser);
}

/**
 * Change the authenticated user's password.
 *
 * The caller must provide the authenticated user's email.
 * Authorization is performed before calling this service.
 */
export async function changePassword({ userId, currentPassword, newPassword }) {
  const user = await findUserByIdWithPassword(userId);

  if (!user || user.deletedAt) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const currentPasswordMatches = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!currentPasswordMatches) {
    throw new AppError(
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
      "رمز عبور فعلی نادرست است.",
      { statusCode: 400 }
    );
  }

  const sameAsCurrent = await bcrypt.compare(newPassword, user.password);

  if (sameAsCurrent) {
    throw new AppError(
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
      { statusCode: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updatedUser = await updateUserPassword(user._id, passwordHash);

  return toSafeUser(updatedUser);
}
