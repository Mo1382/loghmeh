import mongoose from "mongoose";
import crypto from "node:crypto";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import { assertValidObjectId } from "@/lib/validation/object-id";

import { CURSOR_VERSION } from "@/constants/enums";

/**
 * Get the secret used to sign cursors.
 */
function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("متغیر CURSOR_SECRET تنظیم نشده است.");
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
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "داده نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const finalPayload = {
    ...payload,
    v: CURSOR_VERSION,
  };

  let payloadBase64;

  try {
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
 * Decode and verify a signed cursor.
 *
 * This function only validates the signature and cursor version.
 * Domain-specific validation belongs to the corresponding Service.
 */

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

export function decodeCursor(cursor) {
  /**
   * An omitted cursor represents the first page.
   */
  if (cursor === null || cursor === undefined || cursor === "") {
    return null;
  }

  /**
   * Cursor must always be a string once provided.
   */
  if (typeof cursor !== "string") {
    throw createInvalidCursorError();
  }

  const parts = cursor.split(".");

  /**
   * Cursor format:
   *
   * payloadBase64.signatureBase64
   */
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw createInvalidCursorError();
  }

  const [payloadBase64, signatureBase64] = parts;

  let expectedSignature;
  let providedSignature;

  try {
    expectedSignature = crypto
      .createHmac("sha256", getCursorSecret())
      .update(payloadBase64)
      .digest();

    providedSignature = Buffer.from(signatureBase64, "base64url");
  } catch {
    throw createInvalidCursorError();
  }

  /**
   * Verify the HMAC signature using a timing-safe comparison.
   */
  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw createInvalidCursorError();
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    );
  } catch {
    throw createInvalidCursorError();
  }

  /**
   * The decoded value must be a valid cursor payload
   * for the currently supported cursor version.
   */
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
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
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

  assertValidObjectId(payload.id, "cursor ID");

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}
