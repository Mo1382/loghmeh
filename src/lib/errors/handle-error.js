import mongoose from "mongoose";
import { ZodError, z } from "zod";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

const MONGOOSE_VALIDATION_MESSAGE = "مقدار واردشده برای این فیلد نامعتبر است.";

const MONGOOSE_CAST_MESSAGE = "قالب مقدار واردشده برای این فیلد نامعتبر است.";

/**
 * Paths that may be exposed as generic validation errors.
 *
 * System-managed fields such as role, stats, sessionVersion,
 * codeHash, status, and isRead are intentionally excluded.
 *
 * Numeric array indexes are normalized to "*" for allowlist matching.
 */
const PUBLIC_MONGOOSE_VALIDATION_PATHS = new Set([
  // User and profile
  "username",
  "email",
  "password",
  "avatar",
  "bio",
  "title",
  "socialLinks",
  "socialLinks.instagram",
  "socialLinks.telegram",
  "socialLinks.x",

  // Category
  "name",
  "slug",
  "icon",
  "order",

  // Recipe
  "categoryId",
  "recipeId",
  "description",
  "origin",
  "difficulty",
  "preparationTime",
  "defaultServings",
  "image",
  "ingredients",
  "ingredients.*",
  "ingredients.*.name",
  "ingredients.*.quantity",
  "ingredients.*.unit",
  "steps",
  "steps.*",
  "steps.*.order",
  "steps.*.title",
  "steps.*.description",
  "calories",

  // Rating and reaction
  "value",
  "type",

  // Comment, reply, and support ticket
  "text",
  "replies",
  "replies.*",
  "replies.*.text",
  "replies.*.message",
  "message",
]);

/**
 * Extract safe, generic field errors from Mongoose validation and cast errors.
 *
 * Only approved paths are returned. Raw error messages, rejected values,
 * and internal Mongoose error details are never included in the response.
 */
function getSafeMongooseErrorDetails(error, message) {
  const paths =
    error instanceof mongoose.Error.ValidationError
      ? Object.keys(error.errors ?? {})
      : typeof error?.path === "string"
        ? [error.path]
        : [];

  const fieldErrors = {};

  for (const path of paths) {
    if (typeof path !== "string") {
      continue;
    }

    const normalizedPath = path.replace(/\.\d+(?=\.|$)/g, ".*");

    if (!PUBLIC_MONGOOSE_VALIDATION_PATHS.has(normalizedPath)) {
      continue;
    }

    fieldErrors[path] = [message];
  }

  return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : null;
}

/**
 * Convert errors into a consistent internal error response.
 *
 * The boundary layer is responsible for applying `statusCode`.
 */
export function handleError(error) {
  // Preserve application-specific error information.
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

  // Preserve form-level and nested field-level Zod errors.
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
        details: z.treeifyError(error),
      },
    };
  }

  // MongoDB duplicate-key errors.
  if (
    error instanceof mongoose.mongo.MongoServerError &&
    error.code === 11000
  ) {
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

  // Mongoose schema validation errors.
  if (error instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
        details: getSafeMongooseErrorDetails(
          error,
          MONGOOSE_VALIDATION_MESSAGE
        ),
      },
    };
  }

  // Mongoose casting errors.
  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "درخواست نامعتبر است.",
        details: getSafeMongooseErrorDetails(error, MONGOOSE_CAST_MESSAGE),
      },
    };
  }

  // Log unexpected errors internally without exposing details to clients.
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
