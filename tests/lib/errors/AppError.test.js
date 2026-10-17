import { describe, expect, it } from "vitest";

import AppError from "@/lib/errors/AppError";

describe("AppError", () => {
  // AppError must preserve the standard Error behavior.
  it("extends Error and sets the correct error name", () => {
    const error = new AppError("INVALID_REQUEST", "درخواست نامعتبر است.");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe("AppError");
  });

  // The error code and message must be preserved as provided.
  it("stores the provided error code and message", () => {
    const code = "INVALID_REQUEST";
    const message = "شناسه کاربر نامعتبر است.";

    const error = new AppError(code, message);

    expect(error.code).toBe(code);
    expect(error.message).toBe(message);
  });

  // Default values must be used when options are omitted.
  it("uses default statusCode and details when options are omitted", () => {
    const error = new AppError("INVALID_REQUEST", "درخواست نامعتبر است.");

    expect(error.statusCode).toBe(400);
    expect(error.details).toBeNull();
  });

  // Custom options must be stored on the error instance.
  it("stores the provided statusCode and details", () => {
    const details = {
      field: "email",
      reason: "invalid format",
    };

    const error = new AppError("INVALID_REQUEST", "نشانی ایمیل نامعتبر است.", {
      statusCode: 422,
      details,
    });

    expect(error.statusCode).toBe(422);
    expect(error.details).toBe(details);
  });

  // Nullish option values must fall back to their defaults.
  it.each([
    {
      description: "null statusCode",
      options: { statusCode: null },
    },
    {
      description: "undefined statusCode",
      options: { statusCode: undefined },
    },
    {
      description: "null details",
      options: { details: null },
    },
    {
      description: "undefined details",
      options: { details: undefined },
    },
  ])("applies defaults for $description", ({ options }) => {
    const error = new AppError(
      "INVALID_REQUEST",
      "درخواست نامعتبر است.",
      options
    );

    expect(error.statusCode).toBe(400);
    expect(error.details).toBeNull();
  });

  // The stack trace must be available in the current Node.js test environment.
  it("creates a stack trace", () => {
    const error = new AppError("TEST_ERROR", "Test message");

    expect(error.stack).toEqual(expect.any(String));
    expect(error.stack).toContain("AppError");
  });
});
