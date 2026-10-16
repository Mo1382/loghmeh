import mongoose from "mongoose";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Check whether a value is a 24-character hexadecimal ObjectId string.
 */
function isObjectIdString(value) {
  return (
    typeof value === "string" &&
    value.length === 24 &&
    OBJECT_ID_PATTERN.test(value)
  );
}

/**
 * Assert that a value is a valid ObjectId string.
 */
function assertValidObjectIdString(id, fieldName = "ID") {
  if (!isObjectIdString(id)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }

  return id;
}

/**
 * Assert that a value is either a Mongoose ObjectId
 * or a valid 24-character hexadecimal ObjectId string.
 */
export function assertValidObjectId(id, fieldName = "ID") {
  const isValid = id instanceof mongoose.Types.ObjectId || isObjectIdString(id);

  if (!isValid) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }

  return id;
}
