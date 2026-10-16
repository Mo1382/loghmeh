import { describe, expect, it } from "vitest";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import { assertEnum } from "@/lib/validation/enum";

// ============================================================================
// Test Helpers
// ============================================================================

function captureThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the callback to throw an error.");
}

function expectAppError(
  callback,
  code = ERROR_CODES.INVALID_REQUEST,
  statusCode = 400
) {
  const error = captureThrownError(callback);

  expect(error).toBeInstanceOf(AppError);
  expect(error.code).toBe(code);
  expect(error.statusCode).toBe(statusCode);

  return error;
}

// ============================================================================
// assertEnum
// ============================================================================

describe("assertEnum", () => {
  // --------------------------------------------------------------------------
  // Valid Values
  // --------------------------------------------------------------------------

  it("returns the value when it is included in allowedValues", () => {
    const allowedValues = ["USER", "ADMIN"];

    expect(assertEnum("USER", allowedValues)).toBe("USER");
    expect(assertEnum("ADMIN", allowedValues)).toBe("ADMIN");
  });

  it("accepts numeric enum values", () => {
    const allowedValues = [1, 2, 3];

    expect(assertEnum(2, allowedValues)).toBe(2);
  });

  it.each([
    { label: "zero", value: 0, allowedValues: [0, 1] },
    { label: "false", value: false, allowedValues: [true, false] },
    { label: "an empty string", value: "", allowedValues: ["", "USER"] },
  ])(
    "accepts $label when it is explicitly allowed",
    ({ value, allowedValues }) => {
      expect(assertEnum(value, allowedValues)).toBe(value);
    }
  );

  it("returns the original object when it is included in allowedValues", () => {
    const allowedObject = { role: "ADMIN" };

    expect(assertEnum(allowedObject, [allowedObject])).toBe(allowedObject);
  });

  // --------------------------------------------------------------------------
  // Invalid Values
  // --------------------------------------------------------------------------

  it("throws AppError when the value is not allowed", () => {
    const error = expectAppError(() => assertEnum("GUEST", ["USER", "ADMIN"]));

    expect(error.message).toBe("مقدار واردشده نامعتبر است.");
  });

  it("uses strict equality when checking allowed values", () => {
    expectAppError(() => assertEnum("1", [1]));

    expectAppError(() => assertEnum("admin", ["ADMIN"]));
  });

  it("throws TypeError when allowedValues is an empty array", () => {
    expect(() => assertEnum("USER", [])).toThrow(
      "allowedValues must be a non-empty array."
    );
  });

  // --------------------------------------------------------------------------
  // Custom Error Options
  // --------------------------------------------------------------------------

  it("uses a custom error code, message, and status code", () => {
    const error = expectAppError(
      () =>
        assertEnum("INVALID", ["USER", "ADMIN"], {
          errorCode: ERROR_CODES.INVALID_CURSOR,
          message: "ترتیب صفحه‌بندی نامعتبر است.",
          statusCode: 422,
        }),
      ERROR_CODES.INVALID_CURSOR,
      422
    );

    expect(error.message).toBe("ترتیب صفحه‌بندی نامعتبر است.");
  });

  it("uses default options when only some error options are provided", () => {
    const error = expectAppError(
      () =>
        assertEnum("GUEST", ["USER", "ADMIN"], {
          errorCode: ERROR_CODES.INVALID_CURSOR,
        }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(error.message).toBe("مقدار واردشده نامعتبر است.");
  });

  // --------------------------------------------------------------------------
  // Invalid allowedValues
  // --------------------------------------------------------------------------

  it.each([
    { label: "undefined", allowedValues: undefined },
    { label: "null", allowedValues: null },
    { label: "a string", allowedValues: "USER" },
    { label: "a number", allowedValues: 123 },
    { label: "an object", allowedValues: { USER: "USER" } },
    { label: "a Set", allowedValues: new Set(["USER", "ADMIN"]) },
  ])("throws TypeError when allowedValues is $label", ({ allowedValues }) => {
    expect(() => assertEnum("USER", allowedValues)).toThrow(TypeError);
  });

  it("provides a clear message when allowedValues is not an array", () => {
    expect(() => assertEnum("USER", "USER")).toThrow(
      "allowedValues must be a non-empty array."
    );
  });
});
