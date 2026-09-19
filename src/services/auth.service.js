import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import {
  findUserByEmail,
  findUserByUsername,
  findUserByIdentifier,
  createUser,
  updateUserPassword,
  markEmailAsVerified,
} from "@/repositories/user.repository";

import {
  findActiveVerificationCode,
  replaceVerificationCode,
  deleteVerificationCodeById,
} from "@/repositories/verification-code.repository";

import { withTransaction } from "@/lib/transaction";
import { AppError } from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

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
 * The password must never be returned to the application client.
 */
function toSafeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };

  delete data.password;

  return data;
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
      "If an account exists for this email, a password reset code has been sent.",
  };
}

/**
 * Get the secret used to sign password-reset tokens.
 */
function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
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
      "Invalid password reset token.",
      { statusCode: 400 }
    );
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "Invalid password reset token.",
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
      "Invalid password reset token.",
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
      "Invalid password reset token.",
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
      "Password reset token has expired.",
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
export async function registerUser({ username, email, password }) {
  const existingEmail = await findUserByEmail(email);

  if (existingEmail) {
    throw new AppError(
      ERROR_CODES.EMAIL_ALREADY_EXISTS,
      "An account with this email already exists.",
      { statusCode: 409 }
    );
  }

  const existingUsername = await findUserByUsername(username);

  if (existingUsername) {
    throw new AppError(
      ERROR_CODES.USERNAME_ALREADY_EXISTS,
      "This username is already in use.",
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
      },
      session
    );

    await replaceVerificationCode(
      {
        email,
        codeHash,
        purpose: "EMAIL_VERIFICATION",
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
      "Invalid email, username, or password.",
      { statusCode: 401 }
    );
  }

  if (user.deletedAt) {
    throw new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "Invalid email, username, or password.",
      { statusCode: 401 }
    );
  }

  if (user.accountStatus === "SUSPENDED") {
    throw new AppError(
      ERROR_CODES.USER_SUSPENDED,
      "This account is suspended.",
      { statusCode: 403 }
    );
  }

  if (user.accountStatus === "DEACTIVATED") {
    throw new AppError(
      ERROR_CODES.USER_DEACTIVATED,
      "This account is deactivated.",
      { statusCode: 403 }
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new AppError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "Invalid email, username, or password.",
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
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "User not found.", {
      statusCode: 404,
    });
  }

  if (user.emailVerified) {
    throw new AppError(
      ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      "Email is already verified.",
      { statusCode: 409 }
    );
  }

  const verificationCode = await findActiveVerificationCode(
    email,
    "EMAIL_VERIFICATION"
  );

  if (!verificationCode) {
    throw new AppError(
      ERROR_CODES.VERIFICATION_CODE_NOT_FOUND,
      "Verification code is invalid or expired.",
      { statusCode: 400 }
    );
  }

  const codeMatches = await bcrypt.compare(code, verificationCode.codeHash);

  if (!codeMatches) {
    throw new AppError(
      ERROR_CODES.INVALID_VERIFICATION_CODE,
      "Invalid verification code.",
      { statusCode: 400 }
    );
  }

  const updatedUser = await withTransaction(async (session) => {
    const verifiedUser = await markEmailAsVerified(user._id, session);

    await deleteVerificationCodeById(verificationCode._id, session);

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

  if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
    return passwordResetRequestResponse();
  }

  const resetCode = generateVerificationCode();

  const codeHash = await hashVerificationCode(resetCode);

  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  await replaceVerificationCode({
    email,
    codeHash,
    purpose: "PASSWORD_RESET",
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
    "PASSWORD_RESET"
  );

  if (!verificationCode) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_EXPIRED,
      "Password reset code is invalid or expired.",
      { statusCode: 400 }
    );
  }

  const codeMatches = await bcrypt.compare(code, verificationCode.codeHash);

  if (!codeMatches) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "Invalid password reset code.",
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
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "User not found.", {
      statusCode: 404,
    });
  }

  if (user.accountStatus !== "ACTIVE") {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "This account cannot reset its password.",
      { statusCode: 403 }
    );
  }

  const verificationCode = await findActiveVerificationCode(
    payload.email,
    "PASSWORD_RESET"
  );

  if (
    !verificationCode ||
    verificationCode._id.toString() !== payload.verificationCodeId
  ) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "Invalid password reset token.",
      { statusCode: 400 }
    );
  }

  const sameAsCurrent = await bcrypt.compare(password, user.password);

  if (sameAsCurrent) {
    throw new AppError(
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      "New password must be different from the current password.",
      { statusCode: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const updatedUser = await withTransaction(async (session) => {
    const updated = await updateUserPassword(user._id, passwordHash, session);

    await deleteVerificationCodeById(verificationCode._id, session);

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
export async function changePassword({ email, currentPassword, newPassword }) {
  const user = await findUserByIdentifier(email);

  if (!user || user.deletedAt) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "User not found.", {
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
      "Current password is incorrect.",
      { statusCode: 400 }
    );
  }

  const sameAsCurrent = await bcrypt.compare(newPassword, user.password);

  if (sameAsCurrent) {
    throw new AppError(
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      "New password must be different from the current password.",
      { statusCode: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  const updatedUser = await updateUserPassword(user._id, passwordHash);

  return toSafeUser(updatedUser);
}
