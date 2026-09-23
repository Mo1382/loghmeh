import mongoose from "mongoose";
import { ZodError } from "zod";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

/**
 * Convert application errors into a consistent response.
 *
 * Expected response shape:
 * {
 *   success: false,
 *   error: {
 *     code,
 *     message
 *   }
 * }
 */
export function handleError(error) {
  /**
   * Expected application/domain error.
   */
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  /**
   * Zod validation error.
   */
  if (error instanceof ZodError) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
        details: error.flatten().fieldErrors,
      },
    };
  }

  /**
   * MongoDB duplicate key error.
   *
   * Example:
   * E11000 duplicate key error
   */
  if (error?.code === 11000) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_RESOURCE,
        message: "این منبع از قبل وجود دارد.",
      },
    };
  }

  /**
   * Mongoose validation error.
   */
  if (error instanceof mongoose.Error.ValidationError) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
      },
    };
  }

  /**
   * Invalid ObjectId / Mongoose cast error.
   */
  if (error instanceof mongoose.Error.CastError) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "درخواست نامعتبر است.",
      },
    };
  }

  /**
   * Unexpected error.
   *
   * Do not expose internal error details to the client.
   */
  console.error(error);

  return {
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "خطای غیرمنتظره‌ای رخ داد.",
    },
  };
}
