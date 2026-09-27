import mongoose from "mongoose";

import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

export function assertValidObjectIdString(id, fieldName = "ID") {
  if (typeof id !== "string" || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }

  return id;
}

export function assertValidObjectId(id, fieldName = "ID") {
  const isValid =
    id instanceof mongoose.Types.ObjectId ||
    (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id));

  if (!isValid) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }

  return id;
}
