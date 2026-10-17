import mongoose from "mongoose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import { handleError } from "@/lib/errors/handle-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleError", () => {
  // AppError
  it("preserves the status code, application error code, message, and details", () => {
    const details = {
      fieldErrors: {
        email: ["آدرس ایمیل نامعتبر است."],
      },
    };

    const error = new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "درخواست نامعتبر است.",
      {
        statusCode: 422,
        details,
      }
    );

    expect(handleError(error)).toEqual({
      statusCode: 422,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "درخواست نامعتبر است.",
        details,
      },
    });
  });

  it("uses the default status code and null details when an AppError has no custom options", () => {
    const error = new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "درخواست نامعتبر است."
    );

    expect(handleError(error)).toEqual({
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "درخواست نامعتبر است.",
        details: null,
      },
    });
  });

  // Zod validation errors
  it("preserves the structure of nested Zod field errors", () => {
    const schema = z.object({
      email: z.email(),
      profile: z.object({
        username: z.string().min(3),
      }),
    });

    const result = schema.safeParse({
      email: "invalid-email",
      profile: {
        username: "x",
      },
    });

    expect(result.success).toBe(false);

    const response = handleError(result.error);
    const { details } = response.error;

    expect(response.statusCode).toBe(400);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ERROR_CODES.INVALID_REQUEST);
    expect(response.error.message).toBe("داده‌های ارسال‌شده نامعتبر هستند.");

    expect(details.errors).toEqual([]);

    expect(details.properties.email.errors).toEqual(
      expect.arrayContaining([expect.any(String)])
    );

    expect(details.properties.profile.properties.username.errors).toEqual(
      expect.arrayContaining([expect.any(String)])
    );
  });

  it("preserves root-level Zod errors without treating them as field errors", () => {
    const result = z.string().min(3).safeParse("x");

    expect(result.success).toBe(false);

    const response = handleError(result.error);
    const { details } = response.error;

    expect(response.statusCode).toBe(400);
    expect(response.error.code).toBe(ERROR_CODES.INVALID_REQUEST);

    expect(details.errors).toEqual(
      expect.arrayContaining([expect.any(String)])
    );

    expect(details.properties).toBeUndefined();
  });

  it("preserves both root-level and field-level Zod errors", () => {
    const schema = z
      .object({
        email: z.email(),
      })
      .superRefine((_data, context) => {
        context.addIssue({
          code: "custom",
          message: "خطای سطح فرم",
          path: [],
        });

        context.addIssue({
          code: "custom",
          message: "خطای ایمیل",
          path: ["email"],
        });
      });

    const result = schema.safeParse({
      email: "test@example.com",
    });

    expect(result.success).toBe(false);

    const response = handleError(result.error);
    const { details } = response.error;

    expect(response.statusCode).toBe(400);
    expect(response.error.code).toBe(ERROR_CODES.INVALID_REQUEST);

    expect(details.errors).toContain("خطای سطح فرم");
    expect(details.properties.email.errors).toContain("خطای ایمیل");
  });

  // MongoDB duplicate-key errors
  it("maps MongoDB duplicate-key errors to a conflict response without exposing database details", () => {
    const error = new mongoose.mongo.MongoServerError({
      message: "duplicate key: private-index-details",
      code: 11000,
      keyValue: {
        email: "private@example.com",
      },
    });

    const response = handleError(error);

    expect(response).toEqual({
      statusCode: 409,
      success: false,
      error: {
        code: ERROR_CODES.DUPLICATE_RESOURCE,
        message: "این منبع از قبل وجود دارد.",
        details: null,
      },
    });

    const serializedResponse = JSON.stringify(response);

    expect(serializedResponse).not.toContain("private@example.com");
    expect(serializedResponse).not.toContain("private-index-details");
  });

  it("does not classify a non-Mongo error with code 11000 as a duplicate-key error", () => {
    const error = Object.assign(new Error("unrelated internal error"), {
      code: 11000,
    });

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = handleError(error);

    expect(response).toEqual({
      statusCode: 500,
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: "خطای غیرمنتظره‌ای رخ داد.",
        details: null,
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
  });

  // Mongoose validation errors
  it("returns generic errors only for allowlisted Mongoose validation paths", () => {
    const error = new mongoose.Error.ValidationError();

    error.addError(
      "username",
      new mongoose.Error.ValidatorError({
        path: "username",
        message: "private validator message",
        value: "private-username-value",
      })
    );

    error.addError(
      "ingredients.0.name",
      new mongoose.Error.ValidatorError({
        path: "ingredients.0.name",
        message: "private ingredient message",
        value: "private-ingredient-value",
      })
    );

    error.addError(
      "steps.2.description",
      new mongoose.Error.ValidatorError({
        path: "steps.2.description",
        message: "private step description message",
        value: "private step description",
      })
    );

    error.addError(
      "role",
      new mongoose.Error.ValidatorError({
        path: "role",
        message: "private role message",
        value: "admin",
      })
    );

    error.addError(
      "isRead",
      new mongoose.Error.ValidatorError({
        path: "isRead",
        message: "private notification message",
        value: true,
      })
    );

    const response = handleError(error);

    expect(response.statusCode).toBe(400);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ERROR_CODES.INVALID_REQUEST);

    expect(response.error.details).toEqual({
      fieldErrors: {
        username: ["مقدار واردشده برای این فیلد نامعتبر است."],
        "ingredients.0.name": ["مقدار واردشده برای این فیلد نامعتبر است."],
        "steps.2.description": ["مقدار واردشده برای این فیلد نامعتبر است."],
      },
    });

    const serializedResponse = JSON.stringify(response);

    expect(serializedResponse).not.toContain("private validator message");

    expect(serializedResponse).not.toContain("private-username-value");

    expect(serializedResponse).not.toContain("private ingredient message");

    expect(serializedResponse).not.toContain("private-ingredient-value");

    expect(serializedResponse).not.toContain(
      "private step description message"
    );

    expect(serializedResponse).not.toContain("private step description");

    expect(serializedResponse).not.toContain("admin");

    expect(serializedResponse).not.toContain("private notification message");
  });

  test("returns null details when a Mongoose validation error contains only non-allowlisted paths", () => {
    const error = new mongoose.Error.ValidationError();

    error.addError(
      "status",
      new mongoose.Error.ValidatorError({
        path: "status",
        message: "private status message",
        value: "active",
      })
    );

    error.addError(
      "sessionVersion",
      new mongoose.Error.ValidatorError({
        path: "sessionVersion",
        message: "private session message",
        value: 4,
      })
    );

    const response = handleError(error);

    expect(response).toEqual({
      statusCode: 400,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: "داده‌های ارسال‌شده نامعتبر هستند.",
        details: null,
      },
    });

    const serializedResponse = JSON.stringify(response);

    expect(serializedResponse).not.toContain("status");
    expect(serializedResponse).not.toContain("sessionVersion");
    expect(serializedResponse).not.toContain("private status message");
    expect(serializedResponse).not.toContain("private session message");
    expect(serializedResponse).not.toContain("active");
  });

  // Mongoose cast errors
  it("returns a generic field error for an allowlisted Mongoose cast path", () => {
    const error = new mongoose.Error.CastError(
      "ObjectId",
      "private-object-id-value",
      "recipeId"
    );

    const response = handleError(error);

    expect(response.statusCode).toBe(400);
    expect(response.success).toBe(false);
    expect(response.error.code).toBe(ERROR_CODES.INVALID_REQUEST);
    expect(response.error.message).toBe("درخواست نامعتبر است.");

    expect(response.error.details).toEqual({
      fieldErrors: {
        recipeId: ["قالب مقدار واردشده برای این فیلد نامعتبر است."],
      },
    });

    expect(JSON.stringify(response)).not.toContain("private-object-id-value");
  });

  it("does not expose cast-error details for a non-allowlisted path", () => {
    const error = new mongoose.Error.CastError("String", "admin", "role");

    const response = handleError(error);

    expect(response.statusCode).toBe(400);
    expect(response.error.details).toBeNull();

    const serializedResponse = JSON.stringify(response);

    expect(serializedResponse).not.toContain("private-object-id-value");
    expect(serializedResponse).not.toContain("ObjectId");
  });

  // Unexpected errors
  it("logs unexpected errors internally and returns a generic server error", () => {
    const error = new Error("private internal error details");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = handleError(error);

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);

    expect(response).toEqual({
      statusCode: 500,
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: "خطای غیرمنتظره‌ای رخ داد.",
        details: null,
      },
    });

    const serializedResponse = JSON.stringify(response);

    expect(serializedResponse).not.toContain("private internal error details");
    expect(serializedResponse).not.toContain("ObjectId");
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "unexpected input"],
  ])(
    "returns a generic server error when the input is %s instead of an Error instance",
    (_description, input) => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const response = handleError(input);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      expect(consoleErrorSpy).toHaveBeenCalledWith(input);

      expect(response).toEqual({
        statusCode: 500,
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: "خطای غیرمنتظره‌ای رخ داد.",
          details: null,
        },
      });
    }
  );
});
