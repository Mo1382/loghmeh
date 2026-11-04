/**
 * Authentication service.
 *
 * Coordinates registration, email verification, login, password reset,
 * and authenticated password changes. Database operations are delegated
 * to repositories; email submission is performed outside database transactions.
 */

import bcrypt from "bcryptjs";
import crypto from "node:crypto";

import {
  createUser,
  findUserByEmail,
  findUserByIdentifier,
  findUserByIdWithPassword,
  findUserByUsername,
  verifyUserEmail,
  updateUserPassword,
} from "@/repositories/user.repository";

import {
  consumeVerificationCode,
  findActiveVerificationCode,
  findVerificationCode,
  replaceVerificationCode,
} from "@/repositories/verification-code.repository";

import { ERROR_CODES } from "@/constants/error-codes";
import {
  ACCOUNT_STATUSES,
  VERIFICATION_CODE_PURPOSES,
} from "@/constants/enums";

import AppError from "@/lib/errors/AppError";
import { withTransaction } from "@/lib/transaction";
import { assertValidObjectId } from "@/lib/validation/object-id";
import { requireActiveAuthenticatedUser } from "@/lib/auth/guards";
import { getServerEnv } from "@/lib/config/env";

import {
  sendVerificationCodeEmail,
  sendPasswordResetCodeEmail,
} from "@/lib/email";

import { isStrictGenerationId } from "@/lib/validation/generation-id";

import {
  isWellFormedPassword,
  isWithinBcryptByteLimit,
} from "@/lib/validation/password";

import { normalizeUsername } from "@/lib/normalization/normalizeUsername";

/** Lifetime of email-verification and password-reset codes, in milliseconds. */
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

/** Lifetime of a signed password-reset token after successful code verification. */
const PASSWORD_RESET_TOKEN_TTL_MS = 10 * 60 * 1000;

// Precomputed bcrypt hash used for the dummy comparison when a login user is not found.
// Generated once with the command below.
// node -e "const bcrypt = require('bcryptjs'); const crypto = require('node:crypto'); bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12).then(console.log).catch((error) => { console.error(error); process.exitCode = 1; });"

const DUMMY_PASSWORD_HASH =
  "$2b$12$hh179ZA2yZp8q4ilosF33uqW6X.XkAXjWkF/w96B4lQJiKTa54cHm";

/** Maximum accepted length of the serialized password-reset token. */
const MAX_PASSWORD_RESET_TOKEN_LENGTH = 2048;

// ============================================================================
// Verification-code utilities
// ============================================================================

/**
 * Generate a cryptographically secure six-digit verification code.
 */
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash a verification code before persisting it.
 */
async function hashVerificationCode(code) {
  return bcrypt.hash(code, 10);
}

/**
 * Check whether a value is exactly six ASCII digits.
 */
function isValidVerificationCode(code) {
  return (
    typeof code === "string" && code.length === 6 && /^[0-9]{6}$/.test(code)
  );
}

// ============================================================================
// Password and user utilities
// ============================================================================

/**
 * Create the validation error used when a password is not a string.
 */
function createInvalidPasswordTypeError() {
  return new AppError(
    ERROR_CODES.INVALID_PASSWORD_TYPE,
    "رمز عبور باید از نوع رشته باشد.",
    { statusCode: 400 }
  );
}

/**
 * Create the validation error used when a password contains
 * invalid UTF-16 encoding.
 */
function createInvalidPasswordEncodingError() {
  return new AppError(
    ERROR_CODES.INVALID_PASSWORD_ENCODING,
    "رمز عبور دارای کدگذاری نامعتبر است.",
    { statusCode: 400 }
  );
}

/**
 * Create the validation error used when a password exceeds bcrypt’s 72-byte
 * limit.
 */
function createPasswordByteLimitError() {
  return new AppError(
    ERROR_CODES.PASSWORD_EXCEEDS_BCRYPT_LIMIT,
    "رمز عبور نباید بیشتر از ۷۲ بایت در UTF-8 باشد.",
    { statusCode: 400 }
  );
}

/**
 * Validate password type, UTF-16 encoding, and UTF-8 byte length
 * before passing the password to bcrypt.
 */
function assertBcryptCompatiblePassword(password, errorFactory) {
  // 1. Validate input type.
  if (typeof password !== "string") {
    throw (errorFactory ?? createInvalidPasswordTypeError)();
  }

  // 2. Reject malformed UTF-16.
  if (!isWellFormedPassword(password)) {
    throw (errorFactory ?? createInvalidPasswordEncodingError)();
  }

  // 3. Enforce bcrypt's 72-byte limit.
  if (!isWithinBcryptByteLimit(password)) {
    throw (errorFactory ?? createPasswordByteLimitError)();
  }
}

/**
 * Convert a User document into a plain object containing only public, approved
 * fields.
 */
function toSafeUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };

  return {
    id: data._id?.toString(),
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
 * Normalize an email address or username before looking up a user.
 */
function normalizeLoginIdentifier(identifier) {
  if (typeof identifier !== "string") {
    return "";
  }

  const normalized = identifier.trim();

  if (normalized.includes("@")) {
    return normalized.toLowerCase();
  }

  return normalizeUsername(normalized);
}

/**
 * Validate the project's strict 24-character hexadecimal ObjectId string
 * format.
 */
function isStrictObjectIdString(value) {
  return (
    typeof value === "string" &&
    value.length === 24 &&
    /^[0-9a-fA-F]{24}$/.test(value)
  );
}

// ============================================================================
// Password-reset token utilities
// ============================================================================

/**
 * Decode the validated 32-byte secret used to sign password-reset tokens.
 */
function getPasswordResetTokenKey() {
  const encodedKey = getServerEnv().PASSWORD_RESET_TOKEN_SECRET;

  return crypto.createSecretKey(Buffer.from(encodedKey, "base64url"));
}

/**
 * Create an HMAC-signed password-reset token from its payload.
 */
function createPasswordResetToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", getPasswordResetTokenKey())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Create the application error used for malformed or invalid reset tokens.
 */
function createInvalidPasswordResetTokenError() {
  return new AppError(
    ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
    "توکن بازیابی رمز عبور نامعتبر است.",
    { statusCode: 400 }
  );
}

/**
 * Create the application error used when a reset token has expired.
 */
function createExpiredPasswordResetTokenError() {
  return new AppError(
    ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED,
    "توکن بازیابی رمز عبور منقضی شده است.",
    { statusCode: 400 }
  );
}

/**
 * Reject a reset-token payload whose expiration time has been reached.
 */
function assertPasswordResetTokenNotExpired(payload) {
  if (Date.now() >= payload.expiresAt) {
    throw createExpiredPasswordResetTokenError();
  }
}

/**
 * Verify a reset token signature, validate its payload, and enforce its
 * expiration.
 */
function verifyPasswordResetToken(token) {
  if (!token || typeof token !== "string") {
    throw createInvalidPasswordResetTokenError();
  }

  if (token.length > MAX_PASSWORD_RESET_TOKEN_LENGTH) {
    throw createInvalidPasswordResetTokenError();
  }

  const parts = token.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw createInvalidPasswordResetTokenError();
  }

  const [encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", getPasswordResetTokenKey())
    .update(encodedPayload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "utf8");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw createInvalidPasswordResetTokenError();
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
  } catch {
    throw createInvalidPasswordResetTokenError();
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createInvalidPasswordResetTokenError();
  }

  if (
    payload.v !== 1 ||
    payload.purpose !== VERIFICATION_CODE_PURPOSES.PASSWORD_RESET ||
    !isStrictObjectIdString(payload.userId) ||
    !isStrictObjectIdString(payload.verificationCodeId) ||
    typeof payload.sessionVersion !== "number" ||
    !Number.isSafeInteger(payload.sessionVersion) ||
    payload.sessionVersion < 0 ||
    typeof payload.expiresAt !== "number" ||
    !Number.isSafeInteger(payload.expiresAt) ||
    !isStrictGenerationId(payload.generationId)
  ) {
    throw createInvalidPasswordResetTokenError();
  }

  assertPasswordResetTokenNotExpired(payload);

  return payload;
}

// ============================================================================
// Shared errors and diagnostics
// ============================================================================

/**
 * Create the generic public error for missing, incorrect, or otherwise invalid
 * reset codes.
 */
function createInvalidPasswordResetCodeError() {
  return new AppError(
    ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
    "کد بازیابی نامعتبر است یا منقضی شده است. لطفاً کد جدید درخواست کنید.",
    { statusCode: 400 }
  );
}

/**
 * Return the same public response for every password-reset request to prevent
 * account enumeration.
 */
function passwordResetRequestResponse() {
  return {
    message:
      "اگر حسابی با این ایمیل وجود داشته باشد، درخواست بازیابی رمز عبور ثبت شده است.",
  };
}

/**
 * Create the generic login error for an unknown user or an incorrect password.
 */
function createInvalidCredentialsError() {
  return new AppError(
    ERROR_CODES.INVALID_CREDENTIALS,
    "ایمیل، نام کاربری یا رمز عبور نامعتبر است.",
    { statusCode: 401 }
  );
}

/**
 * Create the login error for a pending account whose email has not been
 * verified.
 */
function createEmailNotVerifiedError() {
  return new AppError(
    ERROR_CODES.EMAIL_NOT_VERIFIED,
    "برای ورود، ابتدا نشانی ایمیل خود را تأیید کنید.",
    { statusCode: 403 }
  );
}

/**
 * Create the login error for an account that is otherwise not eligible to sign
 * in.
 */
function createAccountNotEligibleForLoginError() {
  return new AppError(
    ERROR_CODES.ACCOUNT_NOT_ELIGIBLE_FOR_LOGIN,
    "در حال حاضر امکان ورود به حساب شما وجود ندارد. برای پیگیری با پشتیبانی تماس بگیرید.",
    { statusCode: 403 }
  );
}

/**
 * Translate User collection duplicate-key errors into domain-specific email or
 * username errors.
 */
function throwUserDuplicateError(error) {
  if (error?.code !== 11000) {
    throw error;
  }

  const keyPattern = error.keyPattern ?? {};

  const keyValue = error.keyValue ?? {};

  if (
    Object.prototype.hasOwnProperty.call(keyPattern, "email") ||
    Object.prototype.hasOwnProperty.call(keyValue, "email")
  ) {
    throw new AppError(
      ERROR_CODES.EMAIL_ALREADY_EXISTS,
      "حسابی با این ایمیل از قبل وجود دارد.",
      { statusCode: 409 }
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(keyPattern, "username") ||
    Object.prototype.hasOwnProperty.call(keyValue, "username")
  ) {
    throw new AppError(
      ERROR_CODES.USERNAME_ALREADY_EXISTS,
      "این نام کاربری قبلاً استفاده شده است.",
      { statusCode: 409 }
    );
  }

  throw error;
}

/**
 * Log limited diagnostic details when an authentication email submission
 * fails.
 */
function logEmailSubmissionFailure(event, user, error) {
  console.error(`${event} failed.`, {
    userId: user._id.toString(),
    errorName: error?.name,
    providerErrorCode: error?.cause?.code,
    providerStatusCode: error?.cause?.statusCode,
  });
}

// ============================================================================
// Registration and email verification
// ============================================================================

/**
 * Create a pending user and its email-verification code atomically, then
 * submit the verification email.
 */
export async function registerUser({ username, email, password, title }) {
  assertBcryptPasswordLimit(password);

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
    let newUser;

    try {
      newUser = await createUser(
        {
          username,
          email,
          password: passwordHash,
          title,
        },
        session
      );
    } catch (error) {
      throwUserDuplicateError(error);
    }

    await replaceVerificationCode(
      {
        email: newUser.email,
        codeHash,
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt,
      },
      session
    );

    return newUser;
  });

  let verificationEmailSubmissionAccepted = true;

  try {
    await sendVerificationCodeEmail({
      to: user.email,
      code: verificationCode,
      expiresInMinutes: VERIFICATION_CODE_TTL_MS / 60_000,
    });
  } catch (error) {
    verificationEmailSubmissionAccepted = false;
    logEmailSubmissionFailure("Registration verification email", user, error);
  }

  return {
    user: toSafeUser(user),
    verificationEmailSubmissionAccepted,
  };
}

/**
 * Replace and resend the email-verification code for an eligible pending
 * account.
 */
export async function resendVerificationCode({ email }) {
  const user = await findUserByEmail(email);

  if (
    !user ||
    user.emailVerified === true ||
    user.accountStatus !== ACCOUNT_STATUSES.PENDING_VERIFICATION
  ) {
    return {
      message: "در صورت واجد شرایط بودن حساب، کد تأیید ارسال خواهد شد.",
    };
  }

  const verificationCode = generateVerificationCode();

  const codeHash = await hashVerificationCode(verificationCode);

  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  await replaceVerificationCode({
    email: user.email,
    codeHash,
    purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    expiresAt,
  });

  try {
    await sendVerificationCodeEmail({
      to: user.email,
      code: verificationCode,
      expiresInMinutes: VERIFICATION_CODE_TTL_MS / 60_000,
    });
  } catch (error) {
    logEmailSubmissionFailure("Verification email resend", user, error);
  }

  return {
    message: "در صورت واجد شرایط بودن حساب، کد تأیید ارسال خواهد شد.",
  };
}

/**
 * Verify a pending user’s email and consume the verification code in the same
 * transaction.
 */
export async function verifyEmail({ email, code }) {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (user.emailVerified === true) {
    throw new AppError(
      ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      "ایمیل قبلاً تأیید شده است.",
      { statusCode: 409 }
    );
  }

  if (user.accountStatus !== ACCOUNT_STATUSES.PENDING_VERIFICATION) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "این حساب کاربری در وضعیت فعلی امکان تأیید ایمیل را ندارد.",
      { statusCode: 403 }
    );
  }

  const verificationCode = await findActiveVerificationCode(
    user.email,
    VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
  );

  if (!verificationCode) {
    throw new AppError(
      ERROR_CODES.VERIFICATION_CODE_NOT_FOUND,
      "کد تأیید نامعتبر یا منقضی شده است.",
      { statusCode: 400 }
    );
  }

  if (!isStrictGenerationId(verificationCode.generationId)) {
    throw new AppError(
      ERROR_CODES.INVALID_VERIFICATION_CODE,
      "کد تأیید نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (!isValidVerificationCode(code)) {
    throw new AppError(
      ERROR_CODES.INVALID_VERIFICATION_CODE,
      "کد تأیید نامعتبر است.",
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
      email: user.email,
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      codeHash: verificationCode.codeHash,
      generationId: verificationCode.generationId,
      session,
    });

    if (!consumedVerification) {
      throw new AppError(
        ERROR_CODES.INVALID_VERIFICATION_CODE,
        "کد تأیید نامعتبر یا قبلاً استفاده شده است.",
        { statusCode: 400 }
      );
    }

    const verifiedUser = await verifyUserEmail(user._id, session);

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

// ============================================================================
// Login
// ============================================================================

/**
 * Authenticate with an email address or username and enforce the account login
 * requirements.
 */
export async function loginUser({ identifier, password }) {
  assertBcryptPasswordLimit(password, createInvalidCredentialsError);

  const normalizedIdentifier = normalizeLoginIdentifier(identifier);

  const user = await findUserByIdentifier(normalizedIdentifier);

  // Use a dummy hash when the account does not exist.
  const passwordHash = user?.password ?? DUMMY_PASSWORD_HASH;

  // Perform the comparison in both cases.
  const passwordMatches = await bcrypt.compare(password, passwordHash);

  // Reject unknown users and incorrect passwords.
  if (!user || !passwordMatches) {
    throw createInvalidCredentialsError();
  }

  // Require email verification for pending accounts.
  if (
    user.accountStatus === ACCOUNT_STATUSES.PENDING_VERIFICATION &&
    user.emailVerified !== true
  ) {
    throw createEmailNotVerifiedError();
  }

  // Reject other accounts that are not eligible to log in.
  if (
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    user.emailVerified !== true
  ) {
    throw createAccountNotEligibleForLoginError();
  }

  return toSafeUser(user);
}

// ============================================================================
// Password reset
// ============================================================================

/**
 * Issue a password-reset code while returning a generic response that does not
 * reveal account existence.
 */
export async function requestPasswordReset({ email }) {
  const user = await findUserByEmail(email);

  if (
    !user ||
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    user.emailVerified !== true
  ) {
    return passwordResetRequestResponse();
  }

  const resetCode = generateVerificationCode();

  const codeHash = await hashVerificationCode(resetCode);

  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  await replaceVerificationCode({
    email: user.email,
    codeHash,
    purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
    expiresAt,
  });

  try {
    await sendPasswordResetCodeEmail({
      to: user.email,
      code: resetCode,
      expiresInMinutes: VERIFICATION_CODE_TTL_MS / 60_000,
    });
  } catch (error) {
    logEmailSubmissionFailure("Password reset email submission", user, error);
  }

  return passwordResetRequestResponse();
}

/**
 * Verify a retained password-reset code and issue a short-lived, signed reset
 * token.
 */
export async function verifyPasswordResetCode({ email, code }) {
  const user = await findUserByEmail(email);

  if (
    !user ||
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    user.emailVerified !== true
  ) {
    throw createInvalidPasswordResetCodeError();
  }

  const verificationCode = await findVerificationCode(
    user.email,
    VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
  );

  if (!verificationCode) {
    throw createInvalidPasswordResetCodeError();
  }

  if (!isStrictGenerationId(verificationCode.generationId)) {
    throw createInvalidPasswordResetCodeError();
  }

  if (!isValidVerificationCode(code)) {
    throw createInvalidPasswordResetCodeError();
  }

  const codeMatches = await bcrypt.compare(code, verificationCode.codeHash);

  if (!codeMatches) {
    throw createInvalidPasswordResetCodeError();
  }

  // Reveal expiration only after the submitted code matches.
  if (verificationCode.expiresAt.getTime() <= Date.now()) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_EXPIRED,
      "کد بازیابی رمز عبور منقضی شده است. لطفاً کد جدید درخواست کنید.",
      { statusCode: 400 }
    );
  }

  // Reject invalid session versions before issuing a reset token.
  if (!Number.isSafeInteger(user.sessionVersion) || user.sessionVersion < 0) {
    throw createInvalidPasswordResetCodeError();
  }

  // A reset token would be unusable if the version cannot be incremented.
  if (user.sessionVersion >= Number.MAX_SAFE_INTEGER) {
    throw new AppError(
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      "امکان بازیابی رمز عبور در وضعیت فعلی وجود ندارد.",
      { statusCode: 409 }
    );
  }

  const expiresAt = Date.now() + PASSWORD_RESET_TOKEN_TTL_MS;

  return {
    resetToken: createPasswordResetToken({
      v: 1,
      purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
      userId: user._id.toString(),
      sessionVersion: user.sessionVersion,
      verificationCodeId: verificationCode._id.toString(),
      generationId: verificationCode.generationId,
      expiresAt,
    }),
  };
}

/**
 * Consume a verified reset authorization and update the user password
 * atomically.
 */
export async function resetPassword({ resetToken, newPassword }) {
  const payload = verifyPasswordResetToken(resetToken);

  assertBcryptPasswordLimit(newPassword);

  const user = await findUserByIdWithPassword(payload.userId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    user.emailVerified !== true
  ) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "این حساب کاربری نمی‌تواند رمز عبور خود را بازیابی کند.",
      { statusCode: 403 }
    );
  }

  if (user.sessionVersion !== payload.sessionVersion) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازیابی رمز عبور نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (user.sessionVersion >= Number.MAX_SAFE_INTEGER) {
    throw new AppError(
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      "امکان بازیابی رمز عبور در وضعیت فعلی وجود ندارد.",
      { statusCode: 409 }
    );
  }

  // Find the retained code, even if its original expiration has passed.
  const verificationCode = await findVerificationCode(
    user.email,
    VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
  );

  if (
    !verificationCode ||
    verificationCode._id.toString() !== payload.verificationCodeId ||
    verificationCode.generationId !== payload.generationId
  ) {
    throw new AppError(
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      "توکن بازیابی رمز عبور نامعتبر است.",
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

  const updatedUser = await withTransaction(async (session) => {
    // Recheck token expiration immediately before consuming the code.
    assertPasswordResetTokenNotExpired(payload);

    const consumedVerification = await consumeVerificationCode({
      verificationCodeId: verificationCode._id,
      email: user.email,
      purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
      codeHash: verificationCode.codeHash,
      generationId: payload.generationId,
      useRetentionExpiry: true,
      session,
    });

    if (!consumedVerification) {
      throw new AppError(
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        "توکن بازیابی رمز عبور نامعتبر یا قبلاً استفاده شده است.",
        { statusCode: 400 }
      );
    }

    const updated = await updateUserPassword(user._id, passwordHash, {
      session,
      expectedSessionVersion: payload.sessionVersion,
    });

    if (!updated) {
      throw new AppError(
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        "توکن بازیابی رمز عبور نامعتبر یا دیگر معتبر نیست.",
        { statusCode: 400 }
      );
    }

    return updated;
  });

  return toSafeUser(updatedUser);
}

// ============================================================================
// Authenticated password change
// ============================================================================

/**
 * Change the authenticated user’s password after verifying the current
 * password and session version.
 */
export async function changePassword(
  currentUser,
  { currentPassword, newPassword }
) {
  const authenticatedUser = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(authenticatedUser._id, "user ID");

  assertBcryptCompatiblePassword(
    currentPassword,
    () =>
      new AppError(
        ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
        "رمز عبور فعلی نادرست است.",
        { statusCode: 400 }
      )
  );

  assertBcryptPasswordLimit(newPassword);

  const user = await findUserByIdWithPassword(authenticatedUser._id);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    user.emailVerified !== true
  ) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "این حساب کاربری نمی‌تواند رمز عبور خود را تغییر دهد.",
      { statusCode: 403 }
    );
  }

  if (!Number.isSafeInteger(user.sessionVersion) || user.sessionVersion < 0) {
    throw new AppError(
      ERROR_CODES.PASSWORD_CHANGE_CONFLICT,
      "امکان تغییر رمز عبور در وضعیت فعلی وجود ندارد.",
      { statusCode: 409 }
    );
  }

  if (user.sessionVersion >= Number.MAX_SAFE_INTEGER) {
    throw new AppError(
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      "امکان تغییر رمز عبور در وضعیت فعلی وجود ندارد.",
      { statusCode: 409 }
    );
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

  const updatedUser = await updateUserPassword(user._id, passwordHash, {
    expectedSessionVersion: user.sessionVersion,
  });

  if (!updatedUser) {
    throw new AppError(
      ERROR_CODES.PASSWORD_CHANGE_CONFLICT,
      "اطلاعات احراز هویت هم‌زمان تغییر کرده است. لطفاً دوباره تلاش کنید.",
      { statusCode: 409 }
    );
  }

  return toSafeUser(updatedUser);
}
