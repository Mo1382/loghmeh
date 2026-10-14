import mongoose from "mongoose";
import crypto from "node:crypto";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

import { CURSOR_VERSION } from "@/constants/enums";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Check whether a value is a plain object.
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  try {
    const prototype = Object.getPrototypeOf(value);

    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Get the secret used to sign cursors.
 *
 * CURSOR_SECRET must be a cryptographically random,
 * 64-character hexadecimal string generated from 32 random bytes.
 *
 * The value is used directly as a UTF-8 string,
 * not decoded from hexadecimal into the original bytes.
 */
function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (typeof secret !== "string" || !/^[0-9a-f]{64}$/i.test(secret)) {
    throw new AppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "پیکربندی کلید محرمانهٔ نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 500 }
    );
  }

  return secret;
}

/**
 * Encode an arbitrary cursor payload into an opaque signed string.
 *
 * The caller is responsible for providing the required
 * domain-specific cursor fields.
 */
export function encodeCursor(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "داده نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  let payloadBase64;

  try {
    const finalPayload = {
      ...payload,
      v: CURSOR_VERSION,
    };

    payloadBase64 = Buffer.from(JSON.stringify(finalPayload), "utf8").toString(
      "base64url"
    );
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "داده نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const signature = crypto
    .createHmac("sha256", getCursorSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Create a fresh INVALID_CURSOR error.
 *
 * A factory is used instead of a shared Error instance so
 * every failure receives its own AppError object.
 */
function createInvalidCursorError() {
  return new AppError(
    ERROR_CODES.INVALID_CURSOR,
    "نشانگر صفحه‌بندی نامعتبر است.",
    { statusCode: 400 }
  );
}

/**
 * Decode and verify a signed cursor.
 *
 * This function validates the cursor format, Base64URL encoding,
 * signature, and cursor version.
 * Domain-specific validation belongs to the corresponding Service.
 */
export function decodeCursor(cursor) {
  // An omitted cursor represents the first page.
  if (cursor === null || cursor === undefined || cursor === "") {
    return null;
  }

  // Cursor must always be a string once provided.
  if (typeof cursor !== "string") {
    throw createInvalidCursorError();
  }

  // Cursor format: payloadBase64.signatureBase64
  const parts = cursor.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw createInvalidCursorError();
  }

  const [payloadBase64, signatureBase64] = parts;

  // Validate the Base64URL alphabet before decoding.
  if (
    !BASE64URL_PATTERN.test(payloadBase64) ||
    !BASE64URL_PATTERN.test(signatureBase64)
  ) {
    throw createInvalidCursorError();
  }

  const payloadBuffer = Buffer.from(payloadBase64, "base64url");
  const providedSignature = Buffer.from(signatureBase64, "base64url");

  // Require canonical, unpadded Base64URL representations.
  if (
    payloadBuffer.toString("base64url") !== payloadBase64 ||
    providedSignature.toString("base64url") !== signatureBase64
  ) {
    throw createInvalidCursorError();
  }

  // Keep configuration errors outside the signature-validation flow.
  // A missing or invalid secret must remain an internal server error.
  const secret = getCursorSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadBase64)
    .digest();

  // Verify the HMAC signature using a timing-safe comparison.
  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw createInvalidCursorError();
  }

  let payload;

  try {
    payload = JSON.parse(payloadBuffer.toString("utf8"));
  } catch {
    throw createInvalidCursorError();
  }

  // Validate the payload structure and cursor version.
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.v !== CURSOR_VERSION
  ) {
    throw createInvalidCursorError();
  }

  return payload;
}

/**
 * Normalize a cursor that uses createdAt + id pagination.
 *
 * Domain-specific fields such as:
 * - resource
 * - userId
 * - recipeId
 * - listType
 * are intentionally ignored here.
 */
export function normalizeCreatedAtIdCursor(payload) {
  if (!isPlainObject(payload)) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (typeof payload.createdAt !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (typeof payload.id !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "شناسه نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const createdAt = new Date(payload.createdAt);

  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== payload.createdAt
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (!/^[0-9a-fA-F]{24}$/.test(payload.id)) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "شناسه نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}
