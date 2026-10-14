import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import { USER_ROLES } from "@/constants/enums";

/*
 * Mock repository access to isolate guard behavior.
 * ObjectId validation remains real so the tests exercise the actual
 * validation performed before a repository query.
 */
const mocks = vi.hoisted(() => ({
  findActiveUserById: vi.fn(),
}));

vi.mock("@/repositories/user.repository", () => ({
  findActiveUserById: mocks.findActiveUserById,
}));

import {
  assertAdmin,
  assertAuthenticated,
  requireActiveAuthenticatedUser,
} from "@/lib/auth/guards";

/* ==========================================================================
 * Test helpers
 * ========================================================================== */

const VALID_USER_ID = "507f1f77bcf86cd799439011";

/** Creates a lightweight user fixture with overridable fields. */
function makeUser(overrides = {}) {
  return {
    _id: VALID_USER_ID,
    username: "cook_123",
    role: USER_ROLES.USER,
    ...overrides,
  };
}

/** Verifies the public error contract without depending on the error message. */
async function expectAppError(promise, code, statusCode) {
  await expect(promise).rejects.toMatchObject({
    name: "AppError",
    code,
    statusCode,
  });
}

/** Captures a synchronous error so its public properties can be asserted. */
function captureThrownError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  throw new Error("Expected the function to throw an error.");
}

/*
 * Reset mocks between tests and provide a predictable active-user response.
 * Individual tests override this response when necessary.
 */
beforeEach(() => {
  vi.resetAllMocks();

  mocks.findActiveUserById.mockResolvedValue(makeUser());
});

/* ==========================================================================
 * assertAuthenticated
 * ========================================================================== */

describe("assertAuthenticated", () => {
  it.each([null, undefined])(
    "throws UNAUTHORIZED when currentUser is %s",
    (currentUser) => {
      const error = captureThrownError(() => assertAuthenticated(currentUser));

      expect(error).toMatchObject({
        name: "AppError",
        code: ERROR_CODES.UNAUTHORIZED,
        statusCode: 401,
      });
    }
  );

  it("returns the authenticated user unchanged", () => {
    const currentUser = makeUser();

    const result = assertAuthenticated(currentUser);

    expect(result).toBe(currentUser);
  });
});

/* ==========================================================================
 * requireActiveAuthenticatedUser
 * ========================================================================== */

describe("requireActiveAuthenticatedUser", () => {
  it("rejects unauthenticated requests before querying the repository", async () => {
    await expectAppError(
      requireActiveAuthenticatedUser(null),
      ERROR_CODES.UNAUTHORIZED,
      401
    );

    expect(mocks.findActiveUserById).not.toHaveBeenCalled();
  });

  it.each(["invalid-id", 123, {}])(
    "rejects an invalid user ID (%s) before querying the repository",
    async (userId) => {
      const currentUser = makeUser({ _id: userId });

      await expectAppError(
        requireActiveAuthenticatedUser(currentUser),
        ERROR_CODES.INVALID_REQUEST,
        400
      );

      expect(mocks.findActiveUserById).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, null])(
    "rejects a missing user ID (%s) before querying the repository",
    async (userId) => {
      const currentUser = makeUser({ _id: userId });

      await expectAppError(
        requireActiveAuthenticatedUser(currentUser),
        ERROR_CODES.INVALID_REQUEST,
        400
      );

      expect(mocks.findActiveUserById).not.toHaveBeenCalled();
    }
  );

  it("returns the active user retrieved from the repository", async () => {
    const currentUser = makeUser({
      username: "stale_username",
    });

    const activeUser = makeUser({
      username: "current_username",
    });

    mocks.findActiveUserById.mockResolvedValue(activeUser);

    const result = await requireActiveAuthenticatedUser(currentUser);

    expect(mocks.findActiveUserById).toHaveBeenCalledTimes(1);
    expect(mocks.findActiveUserById).toHaveBeenCalledWith(
      currentUser._id,
      undefined
    );

    // The repository result takes precedence over potentially stale user data.
    expect(result).toBe(activeUser);
    expect(result.username).toBe("current_username");
  });

  it("accepts a Mongoose ObjectId and passes it unchanged to the repository", async () => {
    const userId = new mongoose.Types.ObjectId(VALID_USER_ID);

    const currentUser = makeUser({
      _id: userId,
      username: "stale_username",
    });

    const activeUser = makeUser({
      _id: userId,
      username: "current_username",
    });

    mocks.findActiveUserById.mockResolvedValue(activeUser);

    const result = await requireActiveAuthenticatedUser(currentUser);

    expect(mocks.findActiveUserById).toHaveBeenCalledWith(userId, undefined);
    expect(mocks.findActiveUserById.mock.calls[0][0]).toBe(userId);

    expect(result).toBe(activeUser);
    expect(result.username).toBe("current_username");
  });

  it("passes the MongoDB session to the repository", async () => {
    const currentUser = makeUser();
    const session = { id: "test-session" };
    const activeUser = makeUser();

    mocks.findActiveUserById.mockResolvedValue(activeUser);

    const result = await requireActiveAuthenticatedUser(currentUser, session);

    expect(mocks.findActiveUserById).toHaveBeenCalledWith(
      currentUser._id,
      session
    );

    expect(result).toBe(activeUser);
  });

  it("throws FORBIDDEN when no active user is found", async () => {
    const currentUser = makeUser();

    mocks.findActiveUserById.mockResolvedValue(null);

    await expectAppError(
      requireActiveAuthenticatedUser(currentUser),
      ERROR_CODES.FORBIDDEN,
      403
    );

    expect(mocks.findActiveUserById).toHaveBeenCalledWith(
      currentUser._id,
      undefined
    );
  });

  it("propagates unexpected repository errors", async () => {
    const currentUser = makeUser();
    const repositoryError = new Error("Database unavailable");

    mocks.findActiveUserById.mockRejectedValue(repositoryError);

    await expect(requireActiveAuthenticatedUser(currentUser)).rejects.toBe(
      repositoryError
    );
  });
});

/* ==========================================================================
 * assertAdmin
 * ========================================================================== */

describe("assertAdmin", () => {
  it("returns the active user when the repository confirms administrator role", async () => {
    const currentUser = makeUser({
      role: USER_ROLES.USER,
    });

    const activeAdmin = makeUser({
      role: USER_ROLES.ADMIN,
    });

    mocks.findActiveUserById.mockResolvedValue(activeAdmin);

    const result = await assertAdmin(currentUser);

    expect(mocks.findActiveUserById).toHaveBeenCalledWith(
      currentUser._id,
      undefined
    );
    expect(result).toBe(activeAdmin);
    expect(result.role).toBe(USER_ROLES.ADMIN);
  });

  it("throws FORBIDDEN when the active user is not an administrator", async () => {
    const currentUser = makeUser();
    const activeUser = makeUser({
      role: USER_ROLES.USER,
    });

    mocks.findActiveUserById.mockResolvedValue(activeUser);

    await expectAppError(assertAdmin(currentUser), ERROR_CODES.FORBIDDEN, 403);

    expect(mocks.findActiveUserById).toHaveBeenCalledTimes(1);
  });

  it("does not trust an administrator role from a stale currentUser object", async () => {
    const currentUser = makeUser({
      role: USER_ROLES.ADMIN,
    });

    const activeUser = makeUser({
      role: USER_ROLES.USER,
    });

    mocks.findActiveUserById.mockResolvedValue(activeUser);

    await expectAppError(assertAdmin(currentUser), ERROR_CODES.FORBIDDEN, 403);
  });

  it("passes the MongoDB session through to the active-user lookup", async () => {
    const currentUser = makeUser();
    const session = { id: "admin-session" };
    const activeAdmin = makeUser({
      role: USER_ROLES.ADMIN,
    });

    mocks.findActiveUserById.mockResolvedValue(activeAdmin);

    const result = await assertAdmin(currentUser, session);

    expect(mocks.findActiveUserById).toHaveBeenCalledWith(
      currentUser._id,
      session
    );
    expect(result).toBe(activeAdmin);
  });

  it("rejects an unauthenticated request without querying the repository", async () => {
    await expectAppError(assertAdmin(null), ERROR_CODES.UNAUTHORIZED, 401);

    expect(mocks.findActiveUserById).not.toHaveBeenCalled();
  });

  it("rejects an inactive or missing user before checking the administrator role", async () => {
    const currentUser = makeUser();

    mocks.findActiveUserById.mockResolvedValue(null);

    await expectAppError(assertAdmin(currentUser), ERROR_CODES.FORBIDDEN, 403);

    expect(mocks.findActiveUserById).toHaveBeenCalledTimes(1);
  });
});
