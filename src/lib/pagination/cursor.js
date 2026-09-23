import mongoose from "mongoose";
import crypto from "node:crypto";

import { ERROR_CODES } from "@/constants/error-codes";
import { AppError } from "@/lib/errors/AppError";
import { assertValidObjectId } from "@/lib/validation/object-id";
import { assertEnum } from "@/lib/validation/enum";

const CURSOR_VERSION = 1;

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

function invalidCursorError(message = "نشانگر صفحه‌بندی نامعتبر است.") {
  return new AppError(ERROR_CODES.INVALID_CURSOR, message, { statusCode: 400 });
}

/* -------------------------------------------------------------------------- */
/* Secret                                                                     */
/* -------------------------------------------------------------------------- */

function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("متغیر CURSOR_SECRET تنظیم نشده است.");
  }

  return secret;
}

/* -------------------------------------------------------------------------- */
/* Encode / Decode                                                            */
/* -------------------------------------------------------------------------- */

export function encodeCursor(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Cursor payload must be an object.");
  }

  const signedPayload = {
    v: CURSOR_VERSION,
    ...payload,
  };

  const payloadBase64 = Buffer.from(
    JSON.stringify(signedPayload),
    "utf8"
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", getCursorSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw invalidCursorError();
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
    throw invalidCursorError();
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw invalidCursorError();
  }

  let payload;

  try {
    const json = Buffer.from(payloadBase64, "base64url").toString("utf8");

    payload = JSON.parse(json);
  } catch {
    throw invalidCursorError();
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.v !== CURSOR_VERSION
  ) {
    throw invalidCursorError();
  }

  return payload;
}

/* -------------------------------------------------------------------------- */
/* Common Cursor Normalization                                                */
/* -------------------------------------------------------------------------- */

/**
 * Normalize the common { createdAt, id } cursor structure.
 *
 * Converts:
 * - createdAt -> Date
 * - id        -> ObjectId
 */
export function normalizeCreatedAtIdCursor(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !payload.createdAt ||
    !payload.id
  ) {
    throw invalidCursorError();
  }

  assertValidObjectId(payload.id, "cursor ID");

  const createdAt = new Date(payload.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw invalidCursorError("تاریخ نشانگر صفحه‌بندی نامعتبر است.");
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}
