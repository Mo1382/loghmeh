import mongoose from "mongoose";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

/**
 * Ensure that a value is a valid MongoDB ObjectId.
 */
export function assertValidObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }

  return id;
}
