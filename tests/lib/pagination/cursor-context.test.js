import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

/* ==========================================================================
 * Test helpers
 * ========================================================================== */

const VALID_OWNER_ID = "507f1f77bcf86cd799439011";
const OTHER_OWNER_ID = "507f1f77bcf86cd799439012";

/**
 * Executes a synchronous callback and returns its thrown error.
 * Fails the test when the callback does not throw.
 */
function captureThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the function to throw an error.");
}

/** Verifies the public AppError contract. */
function expectAppError(callback, code, statusCode = 400) {
  const error = captureThrownError(callback);

  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({
    name: "AppError",
    code,
    statusCode,
  });

  return error;
}

/* ==========================================================================
 * assertCursorResource
 * ========================================================================== */

describe("assertCursorResource", () => {
  it("accepts a cursor belonging to the expected resource", () => {
    expect(
      assertCursorResource({ resource: "USERS" }, "USERS")
    ).toBeUndefined();
  });

  it.each([
    {
      description: "an undefined payload",
      payload: undefined,
    },
    {
      description: "a null payload",
      payload: null,
    },
    {
      description: "a payload without a resource",
      payload: {},
    },
    {
      description: "a different resource",
      payload: { resource: "RECIPES" },
    },
  ])("rejects $description", ({ payload }) => {
    expectAppError(
      () => assertCursorResource(payload, "USERS"),
      ERROR_CODES.INVALID_CURSOR
    );
  });
});

/* ==========================================================================
 * assertCursorOwner
 * ========================================================================== */

describe("assertCursorOwner", () => {
  it("accepts matching owner IDs represented as strings", () => {
    expect(
      assertCursorOwner({ ownerId: VALID_OWNER_ID }, "ownerId", VALID_OWNER_ID)
    ).toBeUndefined();
  });

  it("uses the specified field to find the cursor owner ID", () => {
    expect(
      assertCursorOwner({ userId: VALID_OWNER_ID }, "userId", VALID_OWNER_ID)
    ).toBeUndefined();
  });

  it("accepts an ObjectId in the cursor when the expected ID is a string", () => {
    const ownerId = new mongoose.Types.ObjectId(VALID_OWNER_ID);

    expect(
      assertCursorOwner({ ownerId }, "ownerId", VALID_OWNER_ID)
    ).toBeUndefined();
  });

  it("accepts a string cursor ID when the expected ID is an ObjectId", () => {
    const ownerId = new mongoose.Types.ObjectId(VALID_OWNER_ID);

    expect(
      assertCursorOwner({ ownerId: VALID_OWNER_ID }, "ownerId", ownerId)
    ).toBeUndefined();
  });

  it("accepts matching owner IDs regardless of hexadecimal letter case", () => {
    const uppercaseOwnerId = VALID_OWNER_ID.toUpperCase();

    expect(
      assertCursorOwner(
        { ownerId: uppercaseOwnerId },
        "ownerId",
        VALID_OWNER_ID
      )
    ).toBeUndefined();
  });

  it.each([
    {
      description: "an undefined payload",
      payload: undefined,
    },
    {
      description: "a null payload",
      payload: null,
    },
    {
      description: "a payload without the owner field",
      payload: {},
    },
    {
      description: "a null owner ID",
      payload: { ownerId: null },
    },
    {
      description: "an empty owner ID",
      payload: { ownerId: "" },
    },
  ])("rejects $description", ({ payload }) => {
    expectAppError(
      () => assertCursorOwner(payload, "ownerId", VALID_OWNER_ID),
      ERROR_CODES.INVALID_CURSOR
    );
  });

  it("rejects an invalid owner ID as an invalid cursor", () => {
    expectAppError(
      () =>
        assertCursorOwner({ ownerId: "invalid-id" }, "ownerId", VALID_OWNER_ID),
      ERROR_CODES.INVALID_CURSOR
    );
  });

  it("uses the default message when the owner IDs do not match", () => {
    const error = expectAppError(
      () =>
        assertCursorOwner(
          { ownerId: OTHER_OWNER_ID },
          "ownerId",
          VALID_OWNER_ID
        ),
      ERROR_CODES.INVALID_CURSOR
    );

    expect(error.message).toBe("نشانگر صفحه‌بندی متعلق به این منبع نیست.");
  });

  it("uses a custom message when the owner IDs do not match", () => {
    const customMessage = "این نشانگر متعلق به کاربر دیگری است.";

    const error = expectAppError(
      () =>
        assertCursorOwner(
          { ownerId: OTHER_OWNER_ID },
          "ownerId",
          VALID_OWNER_ID,
          customMessage
        ),
      ERROR_CODES.INVALID_CURSOR
    );

    expect(error.message).toBe(customMessage);
  });
});
