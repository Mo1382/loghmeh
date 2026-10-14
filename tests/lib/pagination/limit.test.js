import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import { normalizeLimit } from "@/lib/pagination/limit";

/* ==========================================================================
 * Test helpers
 * ========================================================================== */

/** Captures a synchronous error for subsequent assertions. */
function captureThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the function to throw an error.");
}

/** Verifies the public contract for invalid pagination limits. */
function expectInvalidLimit(callback) {
  const error = captureThrownError(callback);

  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({
    name: "AppError",
    code: ERROR_CODES.INVALID_LIMIT,
    statusCode: 400,
  });
}

/* ==========================================================================
 * Default values
 * ========================================================================== */

describe("normalizeLimit: default values", () => {
  it("uses the default configuration when no arguments are provided", () => {
    expect(normalizeLimit()).toBe(16);
  });

  it.each([undefined, null])(
    "returns defaultLimit when limit is %s",
    (limit) => {
      expect(normalizeLimit(limit)).toBe(16);
    }
  );

  it.each([undefined, null])(
    "uses a custom defaultLimit when limit is %s",
    (limit) => {
      expect(normalizeLimit(limit, 10, 20)).toBe(10);
    }
  );
});

/* ==========================================================================
 * Valid limits and maximum limit
 * ========================================================================== */

describe("normalizeLimit: valid limits", () => {
  it.each([1, 10, 16, 50])("returns a valid limit unchanged: %s", (limit) => {
    expect(normalizeLimit(limit)).toBe(limit);
  });

  it.each([51, 100, 1000])("caps a limit exceeding maxLimit: %s", (limit) => {
    expect(normalizeLimit(limit)).toBe(50);
  });

  it("uses a custom maxLimit", () => {
    expect(normalizeLimit(25, 10, 20)).toBe(20);
  });

  it("allows a limit equal to maxLimit", () => {
    expect(normalizeLimit(20, 10, 20)).toBe(20);
  });
});

/* ==========================================================================
 * Invalid limit values
 * ========================================================================== */

describe("normalizeLimit: invalid limits", () => {
  it.each([
    { description: "a numeric string", value: "5" },
    { description: "an empty string", value: "" },
    { description: "a decimal number", value: 1.5 },
    { description: "NaN", value: NaN },
    { description: "positive Infinity", value: Infinity },
    { description: "negative Infinity", value: -Infinity },
    { description: "a boolean", value: true },
    { description: "an object", value: {} },
    { description: "an array", value: [] },
  ])("rejects $description", ({ value }) => {
    expectInvalidLimit(() => normalizeLimit(value));
  });

  it.each([0, -1, -10])("rejects a non-positive limit: %s", (limit) => {
    expectInvalidLimit(() => normalizeLimit(limit));
  });
});

/* ==========================================================================
 * Invalid configuration
 * ========================================================================== */

describe("normalizeLimit: configuration validation", () => {
  it.each([0, -1, 1.5, "16", null, NaN, Infinity])(
    "throws TypeError when defaultLimit is invalid: %s",
    (defaultLimit) => {
      expect(() => normalizeLimit(5, defaultLimit, 20)).toThrow(TypeError);
    }
  );

  it.each([0, -1, 1.5, "50", null, NaN, Infinity])(
    "throws TypeError when maxLimit is invalid: %s",
    (maxLimit) => {
      expect(() => normalizeLimit(5, 10, maxLimit)).toThrow(TypeError);
    }
  );

  it("throws RangeError when defaultLimit exceeds maxLimit", () => {
    expect(() => normalizeLimit(5, 20, 10)).toThrow(RangeError);
  });

  it("allows defaultLimit to equal maxLimit", () => {
    expect(normalizeLimit(undefined, 10, 10)).toBe(10);
  });
});
