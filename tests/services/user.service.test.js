import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_STATUSES,
  CURSOR_RESOURCES,
  USER_ROLES,
  USER_SORTS,
  USER_TITLES,
} from "@/constants/enums";
import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

/*
 * All external dependencies are mocked because this file tests service
 * behavior rather than repository queries, validation schemas, or cursor
 * cryptography. Those dependencies should have their own test suites.
 */
const mocks = vi.hoisted(() => ({
  findActiveUserById: vi.fn(),
  findActiveUserByUsername: vi.fn(),
  findActiveUsers: vi.fn(),
  updateAccountStatus: vi.fn(),
  updateUserProfileById: vi.fn(),
  assertAdmin: vi.fn(),
  requireActiveAuthenticatedUser: vi.fn(),
  decodeCursor: vi.fn(),
  encodeCursor: vi.fn(),
  usernameSafeParse: vi.fn(),
  updateUserProfileSafeParse: vi.fn(),
}));

vi.mock("@/repositories/user.repository", () => ({
  findActiveUserById: mocks.findActiveUserById,
  findActiveUserByUsername: mocks.findActiveUserByUsername,
  findActiveUsers: mocks.findActiveUsers,
  updateAccountStatus: mocks.updateAccountStatus,
  updateUserProfileById: mocks.updateUserProfileById,
}));

vi.mock("@/lib/auth/guards", () => ({
  assertAdmin: mocks.assertAdmin,
  requireActiveAuthenticatedUser: mocks.requireActiveAuthenticatedUser,
}));

vi.mock("@/lib/pagination/cursor", () => ({
  decodeCursor: mocks.decodeCursor,
  encodeCursor: mocks.encodeCursor,
}));

vi.mock("@/validations/user.validation", () => ({
  usernameSchema: { safeParse: mocks.usernameSafeParse },
  updateUserProfileSchema: {
    safeParse: mocks.updateUserProfileSafeParse,
  },
}));

import {
  changeAccountStatus,
  getUserById,
  getUserByUsername,
  getUsers,
  updateUserProfile,
} from "@/services/user.service";

/* ==========================================================================
 * Test helpers
 * ========================================================================== */

/** Creates an ObjectId for tests that need valid MongoDB identifiers. */
const objectId = () => new mongoose.Types.ObjectId();

/**
 * Creates a plain user fixture.
 *
 * Stats and social links are merged separately so individual tests can
 * override specific nested fields without replacing the other default values.
 */
function makeUser(overrides = {}) {
  const {
    stats: statsOverrides = {},
    socialLinks: socialLinksOverrides = {},
    ...userOverrides
  } = overrides;

  return {
    _id: objectId(),
    username: "cook_123",
    email: "private@example.com",
    password: "do-not-expose-this",
    avatar: "https://example.com/avatar.png",
    bio: "Home cook",
    title: USER_TITLES.COOK,
    role: USER_ROLES.USER,

    socialLinks: {
      instagram: "https://instagram.com/cook_123",
      telegram: null,
      x: null,
      ...socialLinksOverrides,
    },

    stats: {
      recipeCount: 3,
      averageRating: 4.5,
      totalRecipeViews: 42,
      ratingCount: 5,
      ratingSum: 23,
      ...statsOverrides,
    },

    emailVerified: true,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    deletedAt: null,
    sessionVersion: 7,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    ...userOverrides,
  };
}

/**
 * Creates a Mongoose-like fixture for testing Mapper branches that call
 * toObject(). This is a lightweight test double, not a real Mongoose document.
 */
function makeMongooseLikeUser(overrides = {}) {
  const user = makeUser(overrides);

  return {
    _id: user._id,
    toObject: vi.fn(() => user),
  };
}

/** Asserts the public error contract without depending on the full message. */
async function expectAppError(promise, code, statusCode) {
  await expect(promise).rejects.toMatchObject({
    name: "AppError",
    code,
    statusCode,
  });
}

/**
 * Supplies a decoded cursor payload with valid defaults.
 * Individual tests override only the fields they want to exercise.
 */
function setDecodedCursor(overrides = {}) {
  mocks.decodeCursor.mockReturnValue({
    resource: CURSOR_RESOURCES.USERS,
    sort: USER_SORTS.NEWEST,
    value: "2026-01-01T00:00:00.000Z",
    id: "00000000000000000000000a",
    ...overrides,
  });
}

/*
 * Each test starts with independent mocks and predictable default responses.
 * This prevents calls or implementations from one test affecting another.
 */
beforeEach(() => {
  vi.resetAllMocks();

  mocks.findActiveUserById.mockResolvedValue(null);
  mocks.findActiveUserByUsername.mockResolvedValue(null);
  mocks.findActiveUsers.mockResolvedValue([]);
  mocks.updateAccountStatus.mockResolvedValue({ ok: true, user: makeUser() });
  mocks.updateUserProfileById.mockResolvedValue(makeUser());

  mocks.assertAdmin.mockImplementation(async (currentUser) =>
    makeUser({
      ...(currentUser?._id ? { _id: currentUser._id } : {}),
      role: USER_ROLES.ADMIN,
    })
  );

  mocks.requireActiveAuthenticatedUser.mockImplementation(
    async (currentUser) => (currentUser?._id ? currentUser : makeUser())
  );

  mocks.decodeCursor.mockReturnValue(null);
  mocks.encodeCursor.mockReturnValue("signed-next-cursor");

  mocks.usernameSafeParse.mockImplementation((value) => {
    if (typeof value !== "string" || value.trim().length < 3) {
      return { success: false, error: { issues: [] } };
    }

    return {
      success: true,
      data: value.trim().replace(/ي/g, "ی").replace(/ك/g, "ک"),
    };
  });

  // Actual Zod rules are tested separately in user.validation.test.js.
  mocks.updateUserProfileSafeParse.mockImplementation((value) => ({
    success: true,
    data: value,
  }));
});

/* ==========================================================================
 * getUserById
 * ========================================================================== */

describe("getUserById", () => {
  it("returns only public profile fields for a valid ID", async () => {
    const user = makeUser({
      role: USER_ROLES.ADMIN,
      stats: { ratingCount: 5, ratingSum: 23 },
    });

    mocks.findActiveUserById.mockResolvedValue(user);

    const result = await getUserById(user._id.toString());

    expect(mocks.findActiveUserById).toHaveBeenCalledWith(user._id.toString());

    expect(result).toEqual({
      id: user._id.toString(),
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      title: user.title,
      socialLinks: user.socialLinks,
      stats: {
        recipeCount: 3,
        averageRating: 4.5,
        totalRecipeViews: 42,
      },
    });

    // Sensitive account fields and internal statistics must not be exposed.
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("sessionVersion");
    expect(result.stats).not.toHaveProperty("ratingCount");
    expect(result.stats).not.toHaveProperty("ratingSum");
  });

  it("uses toObject when mapping a Mongoose-like document to a public user", async () => {
    const userDocument = makeMongooseLikeUser({
      role: USER_ROLES.ADMIN,
    });

    mocks.findActiveUserById.mockResolvedValue(userDocument);

    const result = await getUserById(userDocument._id.toString());

    expect(userDocument.toObject).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject({
      id: userDocument._id.toString(),
      username: "cook_123",
      title: USER_TITLES.COOK,
      stats: {
        recipeCount: 3,
        averageRating: 4.5,
        totalRecipeViews: 42,
      },
    });

    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("role");
  });

  it("rejects an invalid ID before querying the repository", async () => {
    await expectAppError(
      getUserById("not-an-object-id"),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.findActiveUserById).not.toHaveBeenCalled();
  });

  it("returns USER_NOT_FOUND when no eligible user exists", async () => {
    const userId = objectId().toString();

    await expectAppError(getUserById(userId), ERROR_CODES.USER_NOT_FOUND, 404);

    expect(mocks.findActiveUserById).toHaveBeenCalledTimes(1);
    expect(mocks.findActiveUserById).toHaveBeenCalledWith(userId);
  });
});

/* ==========================================================================
 * getUserByUsername
 * ========================================================================== */

describe("getUserByUsername", () => {
  it("uses the normalized username for lookup", async () => {
    const user = makeUser({ username: "علی" });

    mocks.usernameSafeParse.mockReturnValue({
      success: true,
      data: "علی",
    });

    mocks.findActiveUserByUsername.mockResolvedValue(user);

    const result = await getUserByUsername("  علي  ");

    expect(mocks.usernameSafeParse).toHaveBeenCalledWith("  علي  ");
    expect(mocks.findActiveUserByUsername).toHaveBeenCalledWith("علی");
    expect(result.id).toBe(user._id.toString());
    expect(result).not.toHaveProperty("email");
  });

  it("rejects an invalid username without querying the repository", async () => {
    mocks.usernameSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: "invalid username" }] },
    });

    await expectAppError(
      getUserByUsername("ab"),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.findActiveUserByUsername).not.toHaveBeenCalled();
  });

  it("returns USER_NOT_FOUND when the normalized username is not found", async () => {
    await expectAppError(
      getUserByUsername("missing_user"),
      ERROR_CODES.USER_NOT_FOUND,
      404
    );

    expect(mocks.findActiveUserByUsername).toHaveBeenCalledTimes(1);
    expect(mocks.findActiveUserByUsername).toHaveBeenCalledWith("missing_user");
  });
});

/* ==========================================================================
 * getUsers: filtering, pagination, and cursor validation
 * ========================================================================== */

describe("getUsers", () => {
  it("uses defaults and returns the expected page shape", async () => {
    // Explicitly set the default response for readability.
    mocks.decodeCursor.mockReturnValue(null);

    mocks.findActiveUsers.mockResolvedValue([
      makeUser(),
      makeUser({ username: "second_cook" }),
    ]);

    const result = await getUsers();

    expect(mocks.decodeCursor).toHaveBeenCalledWith(null);

    expect(mocks.findActiveUsers).toHaveBeenCalledWith({
      filter: {},
      sort: USER_SORTS.NEWEST,
      cursor: null,
      limit: 17,
    });

    expect(result.users).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
    expect(result.users[0]).not.toHaveProperty("email");
  });

  // Exactly `limit` results means there is no extra item proving another page
  // exists. The service must not generate a next cursor in this case.
  it("does not create a next cursor when result count equals the page limit", async () => {
    mocks.findActiveUsers.mockResolvedValue([
      makeUser(),
      makeUser({ username: "second_cook" }),
    ]);

    const result = await getUsers({ limit: 2 });

    expect(mocks.decodeCursor).toHaveBeenCalledWith(null);

    // The repository fetches limit + 1 to detect whether another page exists.
    expect(mocks.findActiveUsers).toHaveBeenCalledWith({
      filter: {},
      sort: USER_SORTS.NEWEST,
      cursor: null,
      limit: 3,
    });

    expect(result.users).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(mocks.encodeCursor).not.toHaveBeenCalled();
  });

  it("passes only allowed and validated title filters to the repository", async () => {
    mocks.findActiveUsers.mockResolvedValue([makeUser()]);

    await getUsers({
      filter: { title: USER_TITLES.COOK },
      limit: 5,
    });

    expect(mocks.findActiveUsers).toHaveBeenCalledWith({
      filter: { title: USER_TITLES.COOK },
      sort: USER_SORTS.NEWEST,
      cursor: null,
      limit: 6,
    });
  });

  it.each([
    {
      description: "an unknown filter field",
      filter: { password: "anything" },
    },
    {
      description: "role filtering",
      filter: { role: USER_ROLES.ADMIN },
    },
    {
      description: "a null filter",
      filter: null,
    },
    {
      description: "an invalid title value",
      filter: { title: "UNKNOWN_TITLE" },
    },
  ])("rejects $description", async ({ filter }) => {
    await expectAppError(
      getUsers({ filter }),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it("rejects an invalid sort before querying the repository", async () => {
    await expectAppError(
      getUsers({ sort: "NOT_A_SORT" }),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "5"])(
    "rejects an invalid page limit: %s",
    async (limit) => {
      await expectAppError(getUsers({ limit }), ERROR_CODES.INVALID_LIMIT, 400);

      expect(mocks.findActiveUsers).not.toHaveBeenCalled();
    }
  );

  it.each([null, undefined])(
    "uses the default page limit when limit is %s",
    async (limit) => {
      // Explicitly set the default response for readability.
      mocks.findActiveUsers.mockResolvedValue([]);

      await getUsers({ limit });

      expect(mocks.findActiveUsers).toHaveBeenCalledWith({
        filter: {},
        sort: USER_SORTS.NEWEST,
        cursor: null,
        limit: 17,
      });
    }
  );

  it("caps the requested page size and fetches one extra user", async () => {
    await getUsers({ limit: 1000 });

    expect(mocks.findActiveUsers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 51 })
    );
  });

  it("creates a next cursor from the last visible user when more results exist", async () => {
    // Explicitly set the default response for readability.
    mocks.encodeCursor.mockReturnValue("signed-next-cursor");

    const first = makeUser({
      _id: new mongoose.Types.ObjectId("000000000000000000000001"),
      createdAt: new Date("2026-04-01T00:00:00.000Z"),
    });

    const second = makeUser({
      _id: new mongoose.Types.ObjectId("000000000000000000000002"),
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
    });

    const extra = makeUser({
      _id: new mongoose.Types.ObjectId("000000000000000000000003"),
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    });

    mocks.findActiveUsers.mockResolvedValue([first, second, extra]);

    const result = await getUsers({
      limit: 2,
      sort: USER_SORTS.NEWEST,
    });

    expect(result.users.map((user) => user.id)).toEqual([
      first._id.toString(),
      second._id.toString(),
    ]);

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("signed-next-cursor");

    // The cursor must point to the last visible item, not the extra item.
    expect(mocks.encodeCursor).toHaveBeenCalledWith({
      resource: CURSOR_RESOURCES.USERS,
      sort: USER_SORTS.NEWEST,
      value: second.createdAt,
      id: second._id.toString(),
    });
  });

  it.each([
    {
      sort: USER_SORTS.NEWEST,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      expectedValue: new Date("2026-03-01T00:00:00.000Z"),
    },
    {
      sort: USER_SORTS.OLDEST,
      createdAt: new Date("2025-03-01T00:00:00.000Z"),
      expectedValue: new Date("2025-03-01T00:00:00.000Z"),
    },
  ])(
    "creates a date cursor for $sort",
    async ({ sort, createdAt, expectedValue }) => {
      const first = makeUser({ createdAt });

      mocks.findActiveUsers.mockResolvedValue([first, makeUser()]);

      await getUsers({ sort, limit: 1 });

      expect(mocks.encodeCursor).toHaveBeenCalledWith({
        resource: CURSOR_RESOURCES.USERS,
        sort,
        value: expectedValue,
        id: first._id.toString(),
      });
    }
  );

  it.each([
    {
      sort: USER_SORTS.MOST_VIEWED,
      stats: { totalRecipeViews: 240 },
      expectedValue: 240,
    },
    {
      sort: USER_SORTS.HIGHEST_RATED,
      stats: { averageRating: 4.75 },
      expectedValue: 4.75,
    },
  ])(
    "uses the correct cursor value for $sort",
    async ({ sort, stats, expectedValue }) => {
      const first = makeUser({ stats });

      mocks.findActiveUsers.mockResolvedValue([first, makeUser()]);

      await getUsers({ sort, limit: 1 });

      expect(mocks.encodeCursor).toHaveBeenCalledWith({
        resource: CURSOR_RESOURCES.USERS,
        sort,
        value: expectedValue,
        id: first._id.toString(),
      });
    }
  );

  it("rejects a missing or incomplete cursor payload", async () => {
    mocks.decodeCursor.mockReturnValue({
      resource: CURSOR_RESOURCES.USERS,
    });

    await expectAppError(
      getUsers({ cursor: "opaque-cursor" }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it("rejects an array as a decoded cursor payload", async () => {
    mocks.decodeCursor.mockReturnValue([]);

    await expectAppError(
      getUsers({ cursor: "opaque-cursor" }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it("rejects an invalid sort inside the cursor", async () => {
    setDecodedCursor({ sort: "NOT_A_SORT" });

    await expectAppError(
      getUsers({ cursor: "opaque-cursor" }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it("rejects a cursor with a different sort from the requested sort", async () => {
    setDecodedCursor({ sort: USER_SORTS.OLDEST });

    await expectAppError(
      getUsers({
        cursor: "opaque-cursor",
        sort: USER_SORTS.NEWEST,
      }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it("rejects a cursor from another resource", async () => {
    setDecodedCursor({ resource: "RECIPES" });

    await expectAppError(
      getUsers({ cursor: "opaque-cursor" }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it("rejects a cursor with an invalid ID", async () => {
    setDecodedCursor({ id: "invalid-id" });

    await expectAppError(
      getUsers({ cursor: "opaque-cursor" }),
      ERROR_CODES.INVALID_CURSOR,
      400
    );

    expect(mocks.findActiveUsers).not.toHaveBeenCalled();
  });

  it.each([null, 123, { date: "2026-01-01" }])(
    "rejects a non-string date cursor value (%s)",
    async (value) => {
      const sort = USER_SORTS.NEWEST;

      setDecodedCursor({ sort, value });

      await expectAppError(
        getUsers({
          cursor: "opaque-cursor",
          sort,
        }),
        ERROR_CODES.INVALID_CURSOR,
        400
      );

      expect(mocks.findActiveUsers).not.toHaveBeenCalled();
    }
  );

  it.each(["2026-01-01", "not-a-date"])(
    "rejects a non-canonical date cursor value: %s",
    async (value) => {
      const sort = USER_SORTS.NEWEST;

      setDecodedCursor({ sort, value });

      await expectAppError(
        getUsers({ cursor: "opaque-cursor", sort }),
        ERROR_CODES.INVALID_CURSOR,
        400
      );

      expect(mocks.findActiveUsers).not.toHaveBeenCalled();
    }
  );

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "42"])(
    "rejects invalid MOST_VIEWED cursor values: %s",
    async (value) => {
      setDecodedCursor({
        sort: USER_SORTS.MOST_VIEWED,
        value,
      });

      await expectAppError(
        getUsers({
          cursor: "opaque-cursor",
          sort: USER_SORTS.MOST_VIEWED,
        }),
        ERROR_CODES.INVALID_CURSOR,
        400
      );

      expect(mocks.findActiveUsers).not.toHaveBeenCalled();
    }
  );

  it.each([-0.1, 5.1, "4.5", Infinity, NaN])(
    "rejects invalid HIGHEST_RATED cursor values: %s",
    async (value) => {
      setDecodedCursor({
        sort: USER_SORTS.HIGHEST_RATED,
        value,
      });

      await expectAppError(
        getUsers({
          cursor: "opaque-cursor",
          sort: USER_SORTS.HIGHEST_RATED,
        }),
        ERROR_CODES.INVALID_CURSOR,
        400
      );

      expect(mocks.findActiveUsers).not.toHaveBeenCalled();
    }
  );

  // Successful validation and normalization are checked for every supported
  // sorting mode. Cursor signing/cryptography is tested separately.
  it.each([
    {
      sort: USER_SORTS.NEWEST,
      value: "2026-01-01T00:00:00.000Z",
      expectedValue: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      sort: USER_SORTS.OLDEST,
      value: "2025-03-01T00:00:00.000Z",
      expectedValue: new Date("2025-03-01T00:00:00.000Z"),
    },
    {
      sort: USER_SORTS.MOST_VIEWED,
      value: 240,
      expectedValue: 240,
    },
    {
      sort: USER_SORTS.HIGHEST_RATED,
      value: 4.75,
      expectedValue: 4.75,
    },
  ])(
    "accepts a valid $sort cursor and normalizes its value and ID",
    async ({ sort, value, expectedValue }) => {
      const expectedId = objectId();
      const id = expectedId.toString();

      setDecodedCursor({
        sort,
        value,
        id,
      });

      await getUsers({
        cursor: "opaque-cursor",
        sort,
      });

      expect(mocks.decodeCursor).toHaveBeenCalledWith("opaque-cursor");
      expect(mocks.findActiveUsers).toHaveBeenCalledTimes(1);

      const passedCursor = mocks.findActiveUsers.mock.calls[0][0].cursor;

      expect(passedCursor.sort).toBe(sort);
      expect(passedCursor.value).toEqual(expectedValue);
      expect(passedCursor.id.equals(expectedId)).toBe(true);
    }
  );

  it.each([
    {
      sort: USER_SORTS.NEWEST,
      overrides: { createdAt: new Date(Number.NaN) },
    },
    {
      sort: USER_SORTS.OLDEST,
      overrides: { createdAt: "not-a-date" },
    },
    {
      sort: USER_SORTS.MOST_VIEWED,
      overrides: { stats: { totalRecipeViews: -1 } },
    },
    {
      sort: USER_SORTS.HIGHEST_RATED,
      overrides: { stats: { averageRating: 5.1 } },
    },
    {
      sort: USER_SORTS.HIGHEST_RATED,
      overrides: { stats: { averageRating: "4.5" } },
    },
  ])(
    "rejects invalid sort values while creating a cursor for $sort",
    async ({ sort, overrides }) => {
      const invalidLastUser = makeUser(overrides);

      mocks.findActiveUsers.mockResolvedValue([invalidLastUser, makeUser()]);

      await expectAppError(
        getUsers({ sort, limit: 1 }),
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        500
      );

      expect(mocks.findActiveUsers).toHaveBeenCalledTimes(1);
    }
  );

  it("rejects a missing user ID when creating a next cursor", async () => {
    mocks.findActiveUsers.mockResolvedValue([
      makeUser({ _id: null }),
      makeUser(),
    ]);

    await expectAppError(
      getUsers({ limit: 1 }),
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      500
    );

    expect(mocks.findActiveUsers).toHaveBeenCalledTimes(1);
    expect(mocks.encodeCursor).not.toHaveBeenCalled();
  });
});

/* ==========================================================================
 * updateUserProfile
 * ========================================================================== */

describe("updateUserProfile", () => {
  it("updates the authenticated user's profile and returns a private response", async () => {
    const currentUser = makeUser();
    const updatedUser = makeUser({
      _id: currentUser._id,
      bio: "New bio",
    });

    mocks.requireActiveAuthenticatedUser.mockResolvedValue(currentUser);
    mocks.updateUserProfileSafeParse.mockReturnValue({
      success: true,
      data: { bio: "New bio" },
    });
    mocks.updateUserProfileById.mockResolvedValue(updatedUser);

    const result = await updateUserProfile(currentUser, {
      bio: "  New bio  ",
    });

    expect(mocks.updateUserProfileSafeParse).toHaveBeenCalledWith({
      bio: "  New bio  ",
    });

    expect(mocks.updateUserProfileById).toHaveBeenCalledWith(currentUser._id, {
      bio: "New bio",
    });

    expect(result).toMatchObject({
      id: updatedUser._id.toString(),
      email: updatedUser.email,
      bio: "New bio",
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    });

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("deletedAt");
    expect(result).not.toHaveProperty("sessionVersion");
  });

  it("uses toObject when mapping a Mongoose-like document to a private user", async () => {
    const currentUser = makeUser();

    const updatedUserDocument = makeMongooseLikeUser({
      _id: currentUser._id,
      bio: "Updated bio",
    });

    mocks.requireActiveAuthenticatedUser.mockResolvedValue(currentUser);
    mocks.updateUserProfileSafeParse.mockReturnValue({
      success: true,
      data: { bio: "Updated bio" },
    });
    mocks.updateUserProfileById.mockResolvedValue(updatedUserDocument);

    const result = await updateUserProfile(currentUser, {
      bio: "Updated bio",
    });

    expect(updatedUserDocument.toObject).toHaveBeenCalledTimes(1);

    expect(result).toMatchObject({
      id: currentUser._id.toString(),
      email: currentUser.email,
      username: currentUser.username,
      bio: "Updated bio",
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    });

    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("deletedAt");
    expect(result).not.toHaveProperty("sessionVersion");
  });

  it("rejects invalid profile data without calling the repository", async () => {
    mocks.updateUserProfileSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: "invalid profile payload" }] },
    });

    await expectAppError(
      updateUserProfile(makeUser(), { unexpected: true }),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.updateUserProfileById).not.toHaveBeenCalled();
  });

  it("uses a fallback message when schema issues have no message", async () => {
    mocks.updateUserProfileSafeParse.mockReturnValue({
      success: false,
      error: { issues: [] },
    });

    await expect(
      updateUserProfile(makeUser(), { unexpected: true })
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.INVALID_REQUEST,
      statusCode: 400,
      message: "اطلاعات ارسالی برای ویرایش پروفایل نامعتبر است.",
    });

    expect(mocks.updateUserProfileById).not.toHaveBeenCalled();
  });

  it("throws USER_NOT_FOUND when the update repository returns null", async () => {
    const currentUser = makeUser();
    const updates = { bio: "Updated" };

    mocks.requireActiveAuthenticatedUser.mockResolvedValue(currentUser);

    mocks.updateUserProfileById.mockResolvedValue(null);

    await expectAppError(
      updateUserProfile(currentUser, updates),
      ERROR_CODES.USER_NOT_FOUND,
      404
    );
  });

  it("does not validate or update the profile when the auth guard fails", async () => {
    mocks.requireActiveAuthenticatedUser.mockRejectedValue(
      new AppError(ERROR_CODES.FORBIDDEN, "Inactive account", {
        statusCode: 403,
      })
    );

    await expectAppError(
      updateUserProfile({ _id: objectId() }, { bio: "Updated" }),
      ERROR_CODES.FORBIDDEN,
      403
    );

    expect(mocks.updateUserProfileSafeParse).not.toHaveBeenCalled();
    expect(mocks.updateUserProfileById).not.toHaveBeenCalled();
  });
});

/* ==========================================================================
 * changeAccountStatus
 * ========================================================================== */

describe("changeAccountStatus", () => {
  it("changes another user's account status", async () => {
    const admin = makeUser({ role: USER_ROLES.ADMIN });

    const target = makeUser({
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    });

    const updatedTarget = makeUser({
      _id: target._id,
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
    });

    mocks.assertAdmin.mockResolvedValue(admin);

    mocks.updateAccountStatus.mockResolvedValue({
      ok: true,
      user: updatedTarget,
    });

    const result = await changeAccountStatus(
      admin,
      target._id.toString(),
      ACCOUNT_STATUSES.SUSPENDED
    );

    const [targetId, status] = mocks.updateAccountStatus.mock.calls[0];

    expect(targetId.equals(target._id)).toBe(true);
    expect(status).toBe(ACCOUNT_STATUSES.SUSPENDED);
    expect(result.id).toBe(target._id.toString());
    expect(result.accountStatus).toBe(ACCOUNT_STATUSES.SUSPENDED);
  });

  it("allows PENDING_VERIFICATION as a supported account status", async () => {
    const admin = makeUser({ role: USER_ROLES.ADMIN });
    const target = makeUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    mocks.assertAdmin.mockResolvedValue(admin);
    mocks.updateAccountStatus.mockResolvedValue({
      ok: true,
      user: target,
    });

    await changeAccountStatus(
      admin,
      target._id.toString(),
      ACCOUNT_STATUSES.PENDING_VERIFICATION
    );

    const [targetId, status] = mocks.updateAccountStatus.mock.calls[0];

    expect(targetId.equals(target._id)).toBe(true);
    expect(status).toBe(ACCOUNT_STATUSES.PENDING_VERIFICATION);
  });

  it("rejects an invalid target ID before calling the repository", async () => {
    await expectAppError(
      changeAccountStatus(makeUser(), "invalid-id", ACCOUNT_STATUSES.SUSPENDED),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.updateAccountStatus).not.toHaveBeenCalled();
  });

  it("rejects an unknown account status", async () => {
    await expectAppError(
      changeAccountStatus(makeUser(), objectId().toString(), "UNKNOWN_STATUS"),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(mocks.updateAccountStatus).not.toHaveBeenCalled();
  });

  it("prevents an administrator from disabling their own account with uppercase ID", async () => {
    const admin = makeUser({ role: USER_ROLES.ADMIN });
    mocks.assertAdmin.mockResolvedValue(admin);

    await expectAppError(
      changeAccountStatus(
        admin,
        admin._id.toString().toUpperCase(),
        ACCOUNT_STATUSES.SUSPENDED
      ),
      ERROR_CODES.FORBIDDEN,
      403
    );

    expect(mocks.updateAccountStatus).not.toHaveBeenCalled();
  });

  it("does not update an account when assertAdmin rejects access", async () => {
    const currentUser = { _id: objectId() };

    mocks.assertAdmin.mockRejectedValue(
      new AppError(ERROR_CODES.FORBIDDEN, "Forbidden", {
        statusCode: 403,
      })
    );

    await expectAppError(
      changeAccountStatus(
        currentUser,
        objectId().toString(),
        ACCOUNT_STATUSES.SUSPENDED
      ),
      ERROR_CODES.FORBIDDEN,
      403
    );

    expect(mocks.updateAccountStatus).not.toHaveBeenCalled();
  });
});

/*
 * Repository failures during account status changes are mapped to
 * service-level AppErrors with the expected public error codes and
 * HTTP status codes.
 */
const mutationFailureCases = [
  {
    description: "USER_NOT_FOUND maps to 404",
    reason: ERROR_CODES.USER_NOT_FOUND,
    expectedCode: ERROR_CODES.USER_NOT_FOUND,
    statusCode: 404,
    accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
  },
  {
    description: "EMAIL_NOT_VERIFIED maps to 409",
    reason: ERROR_CODES.EMAIL_NOT_VERIFIED,
    expectedCode: ERROR_CODES.EMAIL_NOT_VERIFIED,
    statusCode: 409,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
  },
  {
    description: "SESSION_VERSION_LIMIT_REACHED maps to 409",
    reason: ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
    expectedCode: ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
    statusCode: 409,
    accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
  },
  {
    description: "USER_LIFECYCLE_CONFLICT maps to 409",
    reason: ERROR_CODES.USER_LIFECYCLE_CONFLICT,
    expectedCode: ERROR_CODES.USER_LIFECYCLE_CONFLICT,
    statusCode: 409,
    accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
  },
  {
    description: "an unknown repository reason maps to 500",
    reason: "UNEXPECTED_REPOSITORY_FAILURE",
    expectedCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
    statusCode: 500,
    accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
  },
  {
    description: "USER_ALREADY_DELETED maps to 409",
    reason: ERROR_CODES.USER_ALREADY_DELETED,
    expectedCode: ERROR_CODES.USER_ALREADY_DELETED,
    statusCode: 409,
    accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
  },
];

describe("repository mutation failure mapping", () => {
  it.each(mutationFailureCases)(
    "$description",
    async ({ reason, expectedCode, statusCode, accountStatus }) => {
      mocks.updateAccountStatus.mockResolvedValue({
        ok: false,
        reason,
      });

      await expectAppError(
        changeAccountStatus(makeUser(), objectId().toString(), accountStatus),
        expectedCode,
        statusCode
      );
    }
  );
});
