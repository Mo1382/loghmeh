import mongoose from "mongoose";
import { ZodError } from "zod";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

/**
 * Convert errors into a consistent internal error response.
 *
 * The boundary layer is responsible for applying `statusCode`.
 */
export function handleError(error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode ?? 500,
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
        details: error.flatten().fieldErrors,
      },
    };
  }

  if (error?.code === 11000) {
    return {
      statusCode: 409,
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_RESOURCE,
        message: "این منبع از قبل وجود دارد.",
        details: null,
      },
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
        details: null,
      },
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "درخواست نامعتبر است.",
        details: null,
      },
    };
  }

  console.error(error);

  return {
    statusCode: 500,
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "خطای غیرمنتظره‌ای رخ داد.",
      details: null,
    },
  };
}
