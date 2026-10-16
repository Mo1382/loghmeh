import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import { assertValidObjectId } from "@/lib/validation/object-id";

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";
const MIXED_CASE_OBJECT_ID = "ABCDEFabcdef0123456789ab";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Capture a synchronous error or fail if the callback does not throw.
 */
function captureThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the callback to throw an error.");
}

/**
 * Verify the public AppError contract and return the captured error
 * for additional assertions, such as its message.
 */
function expectAppError(callback, code, statusCode = 400) {
  const error = captureThrownError(callback);

  expect(error).toBeInstanceOf(AppError);
  expect(error.code).toBe(code);
  expect(error.statusCode).toBe(statusCode);

  return error;
}

// ============================================================================
// assertValidObjectId
// ============================================================================

describe("assertValidObjectId", () => {
  // Valid inputs: preserve valid hexadecimal strings and their casing.
  it.each([VALID_OBJECT_ID, MIXED_CASE_OBJECT_ID])(
    "returns the original string for %s",
    (id) => {
      expect(assertValidObjectId(id)).toBe(id);
    }
  );

  // Actual Mongoose ObjectId instances are accepted without conversion.
  it("returns the original Mongoose ObjectId instance", () => {
    const objectId = new mongoose.Types.ObjectId(VALID_OBJECT_ID);

    expect(assertValidObjectId(objectId)).toBe(objectId);
  });

  // Invalid inputs: reject unsupported types and malformed identifiers.
  it.each([
    { description: "empty string", value: "" },
    { description: "null", value: null },
    { description: "undefined", value: undefined },
    { description: "number", value: 123 },
    { description: "boolean", value: false },
    { description: "plain object", value: {} },
    { description: "array", value: [] },
    {
      description: "String object",
      value: Object(VALID_OBJECT_ID),
    },
    {
      description: "23-character string",
      value: VALID_OBJECT_ID.slice(1),
    },
    {
      description: "25-character string",
      value: `${VALID_OBJECT_ID}a`,
    },
    {
      description: "non-hexadecimal character",
      value: "507f1f77bcf86cd79943901z",
    },
    {
      description: "leading whitespace",
      value: ` ${VALID_OBJECT_ID}`,
    },
    {
      description: "trailing whitespace",
      value: `${VALID_OBJECT_ID} `,
    },
    {
      description: "trailing newline",
      value: `${VALID_OBJECT_ID}\n`,
    },
  ])("throws AppError for $description", ({ value }) => {
    const error = expectAppError(
      () => assertValidObjectId(value),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(error.message).toBe("شناسه ID نامعتبر است.");
  });

  // Custom field names must appear in the error message.
  it("uses a custom field name in the error message", () => {
    const error = expectAppError(
      () => assertValidObjectId("invalid", "user ID"),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(error.message).toBe("شناسه user ID نامعتبر است.");
  });
});
