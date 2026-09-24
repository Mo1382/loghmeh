import mongoose from "mongoose";
import crypto from "node:crypto";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import { assertValidObjectId } from "@/lib/validation/object-id";

const CURSOR_VERSION = 1;

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
  if (!payload || typeof payload !== "object") {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "داده نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const finalPayload = {
    v: CURSOR_VERSION,
    ...payload,
  };

  const payloadBase64 = Buffer.from(
    JSON.stringify(finalPayload),
    "utf8"
  ).toString("base64url");

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
export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
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
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  let payload;

  try {
    payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf8")
    );
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (!payload || typeof payload !== "object" || payload.v !== CURSOR_VERSION) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
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
    !payload ||
    typeof payload !== "object" ||
    !payload.createdAt ||
    !payload.id
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  assertValidObjectId(payload.id, "cursor ID");

  const createdAt = new Date(payload.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}
