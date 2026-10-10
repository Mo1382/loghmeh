import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import User from "@/models/User";

import {
  ACCOUNT_STATUSES,
  USER_ROLES,
  USER_SORTS,
  USER_TITLES,
} from "@/constants/enums";

import { ERROR_CODES } from "@/constants/error-codes";

import {
  createUser,
  findActiveUserById,
  findActiveUserByUsername,
  findActiveUsers,
  findActiveUsersByIds,
  findNonDeletedUserById,
  findUserByEmail,
  findUserByIdentifier,
  findUserByIdWithPassword,
  findUserByUsername,
  incrementRecipeCount,
  incrementTotalRecipeViews,
  restoreUser,
  setUserStats,
  softDeleteUser,
  updateAccountStatus,
  updateUserPassword,
  updateUserProfileById,
  updateUserRatingStatsDeltas,
  verifyUserEmail,
} from "@/repositories/user.repository";

/*
 * ============================================================================
 * Test Configuration and Helpers
 * ============================================================================
 */

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

let mongoServer;
let sequence = 0;

function nextSequence() {
  sequence += 1;
  return sequence;
}

function createObjectId(value) {
  return new mongoose.Types.ObjectId(value.padStart(24, "0"));
}

function getSecondaryTitle() {
  const title = Object.values(USER_TITLES).find(
    (value) => value !== USER_TITLES.USER
  );

  if (!title) {
    throw new Error("A secondary user title is required for repository tests.");
  }

  return title;
}

async function createFixture(overrides = {}) {
  const id = overrides._id ?? undefined;
  const sequenceNumber = nextSequence();

  const userData = {
    ...(id ? { _id: id } : {}),
    username: overrides.username ?? `user_${sequenceNumber}`,
    email: overrides.email ?? `${sequenceNumber}@example.com`,
    password: overrides.password ?? "hashed-password",
    title: overrides.title ?? USER_TITLES.USER,
    role: overrides.role ?? USER_ROLES.USER,
    accountStatus:
      overrides.accountStatus ?? ACCOUNT_STATUSES.PENDING_VERIFICATION,
    emailVerified: overrides.emailVerified ?? false,
    sessionVersion: overrides.sessionVersion ?? 0,
    avatar: overrides.avatar ?? null,
    bio: overrides.bio ?? "",
    socialLinks: overrides.socialLinks ?? undefined,
    stats: {
      recipeCount: overrides.stats?.recipeCount ?? 0,
      totalRecipeViews: overrides.stats?.totalRecipeViews ?? 0,
      ratingCount: overrides.stats?.ratingCount ?? 0,
      ratingSum: overrides.stats?.ratingSum ?? 0,
      averageRating: overrides.stats?.averageRating ?? 0,
    },
    deletedAt: overrides.deletedAt ?? null,
    ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    ...(overrides.updatedAt ? { updatedAt: overrides.updatedAt } : {}),
  };

  return User.create(userData);
}

async function createActiveUser(overrides = {}) {
  return createFixture({
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
    ...overrides,
  });
}

function expectMutationSuccess(result) {
  expect(result).toMatchObject({
    ok: true,
    user: expect.anything(),
  });

  return result.user;
}

function expectMutationFailure(result, reason) {
  expect(result).toEqual({
    ok: false,
    reason,
  });
}

async function getStats(userId) {
  const user = await User.findById(userId);
  return user?.stats;
}

/*
 * ============================================================================
 * MongoDB Test Lifecycle
 * ============================================================================
 */

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri());
  await User.init();
});

beforeEach(async () => {
  await User.deleteMany({});
  sequence = 0;
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

/*
 * ============================================================================
 * Read Operations
 * ============================================================================
 */

describe("read operations", () => {
  it("finds a non-deleted user by id regardless of account status", async () => {
    const user = await createFixture({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    const result = await findNonDeletedUserById(user._id);

    expect(result?._id.toString()).toBe(user._id.toString());
    expect(result.accountStatus).toBe(ACCOUNT_STATUSES.SUSPENDED);
  });

  it("returns null when a non-deleted user id does not exist", async () => {
    const result = await findNonDeletedUserById(new mongoose.Types.ObjectId());

    expect(result).toBeNull();
  });

  it("does not return a soft-deleted user from non-deleted lookup", async () => {
    const user = await createActiveUser({
      deletedAt: new Date(),
    });

    const result = await findNonDeletedUserById(user._id);

    expect(result).toBeNull();
  });

  it("finds an active verified user by id", async () => {
    const user = await createActiveUser();

    const result = await findActiveUserById(user._id);

    expect(result?._id.toString()).toBe(user._id.toString());
    expect(result?.password).toBeUndefined();
  });

  it("returns null for inactive, unverified, deleted or missing user ids", async () => {
    const inactive = await createFixture({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    const unverified = await createFixture({
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: false,
    });

    const deleted = await createActiveUser({
      deletedAt: new Date(),
    });

    await expect(findActiveUserById(inactive._id)).resolves.toBeNull();
    await expect(findActiveUserById(unverified._id)).resolves.toBeNull();
    await expect(findActiveUserById(deleted._id)).resolves.toBeNull();

    await expect(
      findActiveUserById(new mongoose.Types.ObjectId())
    ).resolves.toBeNull();
  });

  it("finds an active verified user by username without selecting password", async () => {
    const user = await createActiveUser();

    const result = await findActiveUserByUsername(user.username);

    expect(result?._id.toString()).toBe(user._id.toString());
    expect(result?.password).toBeUndefined();
  });

  it("returns null for inactive, unverified, deleted or missing usernames", async () => {
    const inactive = await createFixture({
      username: "inactive-username",
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    const unverified = await createFixture({
      username: "unverified-username",
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: false,
    });

    const deleted = await createActiveUser({
      username: "deleted-username",
      deletedAt: new Date(),
    });

    await expect(
      findActiveUserByUsername(inactive.username)
    ).resolves.toBeNull();

    await expect(
      findActiveUserByUsername(unverified.username)
    ).resolves.toBeNull();

    await expect(
      findActiveUserByUsername(deleted.username)
    ).resolves.toBeNull();

    await expect(
      findActiveUserByUsername("missing-username")
    ).resolves.toBeNull();
  });

  it("finds a non-deleted user by email without selecting password", async () => {
    const user = await createFixture();

    const result = await findUserByEmail(user.email);

    expect(result?._id.toString()).toBe(user._id.toString());
    expect(result?.password).toBeUndefined();
  });

  it("returns null for a missing or deleted email lookup", async () => {
    const deleted = await createFixture({
      email: "deleted-email@example.com",
      deletedAt: new Date(),
    });

    await expect(findUserByEmail(deleted.email)).resolves.toBeNull();
    await expect(
      findUserByEmail("missing-email@example.com")
    ).resolves.toBeNull();
  });

  it("finds a non-deleted user by username without selecting password", async () => {
    const user = await createFixture();

    const result = await findUserByUsername(user.username);

    expect(result?._id.toString()).toBe(user._id.toString());
    expect(result?.password).toBeUndefined();
  });

  it("returns null for a missing or deleted username lookup", async () => {
    const deleted = await createFixture({
      username: "deleted-username",
      deletedAt: new Date(),
    });

    await expect(findUserByUsername(deleted.username)).resolves.toBeNull();
    await expect(findUserByUsername("missing-username")).resolves.toBeNull();
  });

  it("finds a user by email or username and explicitly includes password", async () => {
    const user = await createFixture({
      password: "secret-hash",
    });

    const byEmail = await findUserByIdentifier(user.email);
    const byUsername = await findUserByIdentifier(user.username);

    expect(byEmail?.password).toBe("secret-hash");
    expect(byUsername?.password).toBe("secret-hash");
  });

  it("finds a user by id and explicitly includes password", async () => {
    const user = await createFixture({
      password: "secret-hash",
    });

    const result = await findUserByIdWithPassword(user._id);

    expect(result?.password).toBe("secret-hash");
  });

  it("returns null from identifier and password lookups for deleted or missing users", async () => {
    const deleted = await createFixture({
      email: "deleted-auth@example.com",
      username: "deleted-auth",
      password: "secret-hash",
      deletedAt: new Date(),
    });

    await expect(findUserByIdentifier(deleted.email)).resolves.toBeNull();
    await expect(findUserByIdentifier(deleted.username)).resolves.toBeNull();

    await expect(
      findUserByIdentifier("missing-auth@example.com")
    ).resolves.toBeNull();

    await expect(findUserByIdWithPassword(deleted._id)).resolves.toBeNull();

    await expect(
      findUserByIdWithPassword(new mongoose.Types.ObjectId())
    ).resolves.toBeNull();
  });

  it("finds only active, verified and non-deleted users by ids", async () => {
    const active1 = await createActiveUser();
    const active2 = await createActiveUser();

    const suspended = await createFixture({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    const unverified = await createFixture({
      username: "unverified",
      email: "unverified@example.com",
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: false,
    });

    const deleted = await createActiveUser({
      username: "deleted",
      email: "deleted@example.com",
      deletedAt: new Date(),
    });

    const result = await findActiveUsersByIds([
      active1._id,
      active2._id,
      suspended._id,
      unverified._id,
      deleted._id,
    ]);

    const ids = result.map((item) => item._id.toString());

    expect(result).toHaveLength(2);
    expect(ids).toEqual(
      expect.arrayContaining([active1._id.toString(), active2._id.toString()])
    );
    expect(result.every((user) => user.password === undefined)).toBe(true);
  });

  it("returns an empty array for empty or completely unknown id lists", async () => {
    const emptyResult = await findActiveUsersByIds([]);

    const unknownResult = await findActiveUsersByIds([
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
    ]);

    expect(emptyResult).toEqual([]);
    expect(unknownResult).toEqual([]);
  });
});

/*
 * ============================================================================
 * User Creation
 * ============================================================================
 */

describe("createUser", () => {
  it("creates a user without a session", async () => {
    const user = await createUser({
      username: "created-user",
      email: "created@example.com",
      password: "hashed-password",
    });

    expect(user).toBeTruthy();
    expect(user.username).toBe("created-user");

    const stored = await User.findById(user._id);

    expect(stored).toBeTruthy();
  });

  it("creates a user inside a transaction when a session is provided", async () => {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const user = await createUser(
          {
            username: "transaction-user",
            email: "transaction@example.com",
            password: "hashed-password",
          },
          session
        );

        expect(user).toBeTruthy();
        expect(user.username).toBe("transaction-user");

        const insideTransaction = await User.findById(user._id).session(
          session
        );

        expect(insideTransaction).toBeTruthy();
      });

      const stored = await User.findOne({
        username: "transaction-user",
      });

      expect(stored).toBeTruthy();
    } finally {
      await session.endSession();
    }
  });
});

/*
 * ============================================================================
 * Profile and Password Mutations
 * ============================================================================
 */

describe("profile and password mutations", () => {
  it("updates submitted profile fields and returns the updated document", async () => {
    const user = await createFixture({
      bio: "Existing bio",
      avatar: "https://example.com/old-avatar.jpg",
      socialLinks: {
        instagram: "https://instagram.com/old-user",
      },
    });

    const result = await updateUserProfileById(user._id, {
      bio: "New bio",
      avatar: "https://example.com/new-avatar.jpg",
      socialLinks: {
        instagram: "https://instagram.com/new-user",
        telegram: "https://t.me/new-user",
      },
    });

    expect(result?.bio).toBe("New bio");
    expect(result?.avatar).toBe("https://example.com/new-avatar.jpg");
    expect(result?.socialLinks).toEqual({
      instagram: "https://instagram.com/new-user",
      telegram: "https://t.me/new-user",
      x: null,
    });
  });

  it("preserves omitted social links during a partial profile update", async () => {
    const existingLinks = {
      instagram: "https://www.instagram.com/old-user",
      telegram: "https://t.me/old-user",
      x: "https://x.com/old-user",
    };

    const user = await createFixture({
      socialLinks: existingLinks,
    });

    const result = await updateUserProfileById(user._id, {
      socialLinks: {
        telegram: "https://t.me/new-user",
      },
    });

    expect(result).not.toBeNull();
    expect(result.socialLinks.instagram).toBe(existingLinks.instagram);
    expect(result.socialLinks.telegram).toBe("https://t.me/new-user");
    expect(result.socialLinks.x).toBe(existingLinks.x);

    const stored = await User.findById(user._id).lean();

    expect(stored?.socialLinks).toEqual({
      instagram: existingLinks.instagram,
      telegram: "https://t.me/new-user",
      x: existingLinks.x,
    });
  });

  it("rejects an unsupported social link platform", () => {
    expect(() =>
      updateUserProfileById(new mongoose.Types.ObjectId(), {
        socialLinks: {
          mastodon: "https://mastodon.social/example",
        },
      })
    ).toThrow("Unsupported social link platform: mastodon");
  });

  it("rejects an empty profile update", () => {
    expect(() =>
      updateUserProfileById(new mongoose.Types.ObjectId(), {})
    ).toThrow("Profile updates must not be empty.");
  });

  it("returns null when updating the profile of a deleted or missing user", async () => {
    const deleted = await createFixture({
      deletedAt: new Date(),
      bio: "existing bio",
      avatar: "https://example.com/existing-avatar.jpg",
      socialLinks: {
        instagram: "https://instagram.com/existing-user",
      },
    });

    const deletedResult = await updateUserProfileById(deleted._id, {
      bio: "should-not-update",
      avatar: "https://example.com/should-not-update.jpg",
      socialLinks: {
        instagram: "https://instagram.com/should-not-update",
      },
    });

    const missingResult = await updateUserProfileById(
      new mongoose.Types.ObjectId(),
      {
        bio: "should-not-update",
      }
    );

    expect(deletedResult).toBeNull();
    expect(missingResult).toBeNull();

    const stored = await User.findById(deleted._id);

    expect(stored?.bio).toBe("existing bio");
    expect(stored?.avatar).toBe("https://example.com/existing-avatar.jpg");
    expect(stored?.socialLinks).toEqual({
      instagram: "https://instagram.com/existing-user",
      telegram: null,
      x: null,
    });
  });

  it.each([
    {
      field: "bio",
      updates: {
        bio: "a".repeat(301),
      },
      expectedPath: "bio",
    },
    {
      field: "avatar",
      updates: {
        avatar: "not-a-valid-url",
      },
      expectedPath: "avatar",
    },
  ])(
    "rejects an invalid profile field: $field",
    async ({ updates, expectedPath }) => {
      const user = await createFixture();

      await expect(
        updateUserProfileById(user._id, updates)
      ).rejects.toMatchObject({
        name: "ValidationError",
        errors: {
          [expectedPath]: expect.anything(),
        },
      });

      const stored = await User.findById(user._id);

      expect(stored?.bio).toBe("");
      expect(stored?.avatar).toBeNull();
    }
  );

  it("propagates validation errors for invalid social links", async () => {
    const user = await createFixture();

    await expect(
      updateUserProfileById(user._id, {
        socialLinks: {
          instagram: "https://example.com/test-user",
        },
      })
    ).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        "socialLinks.instagram": expect.anything(),
      },
    });
  });

  it("updates password and increments sessionVersion", async () => {
    const user = await createFixture({
      sessionVersion: 4,
      password: "old-hash",
    });

    const result = await updateUserPassword(user._id, "new-hash");

    expect(result?.password).toBe("new-hash");
    expect(result?.sessionVersion).toBe(5);
  });

  it("allows the final safe sessionVersion increment from MAX_SAFE_INTEGER - 1", async () => {
    const user = await createFixture({
      sessionVersion: MAX_SAFE_INTEGER - 1,
    });

    const result = await updateUserPassword(user._id, "new-hash");

    expect(result?.sessionVersion).toBe(MAX_SAFE_INTEGER);
  });

  it("blocks password update at MAX_SAFE_INTEGER without changing the document", async () => {
    const user = await createFixture({
      sessionVersion: MAX_SAFE_INTEGER,
      password: "old-hash",
    });

    const result = await updateUserPassword(user._id, "new-hash");

    expect(result).toBeNull();

    const stored = await User.findById(user._id).select("+password");

    expect(stored?.sessionVersion).toBe(MAX_SAFE_INTEGER);
    expect(stored?.password).toBe("old-hash");
  });

  it("returns null when changing the password of a deleted or missing user", async () => {
    const deleted = await createFixture({
      deletedAt: new Date(),
      password: "old-hash",
    });

    const deletedResult = await updateUserPassword(deleted._id, "new-hash");

    const missingResult = await updateUserPassword(
      new mongoose.Types.ObjectId(),
      "new-hash"
    );

    expect(deletedResult).toBeNull();
    expect(missingResult).toBeNull();

    const stored = await User.findById(deleted._id).select("+password");

    expect(stored?.password).toBe("old-hash");
  });
});

/*
 * ============================================================================
 * Email Verification
 * ============================================================================
 */

describe("email verification", () => {
  it("moves a pending unverified user to active and verified", async () => {
    const user = await createFixture({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    const result = await verifyUserEmail(user._id);

    expect(result?.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    expect(result?.emailVerified).toBe(true);
  });

  it("does not match an already verified active user", async () => {
    const user = await createActiveUser();

    const result = await verifyUserEmail(user._id);

    expect(result).toBeNull();
  });

  it("returns null for a deleted or missing user", async () => {
    const deleted = await createFixture({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
      deletedAt: new Date(),
    });

    const deletedResult = await verifyUserEmail(deleted._id);

    const missingResult = await verifyUserEmail(new mongoose.Types.ObjectId());

    expect(deletedResult).toBeNull();
    expect(missingResult).toBeNull();

    const stored = await User.findById(deleted._id);

    expect(stored?.emailVerified).toBe(false);
    expect(stored?.accountStatus).toBe(ACCOUNT_STATUSES.PENDING_VERIFICATION);
  });
});

/*
 * ============================================================================
 * Account Status
 * ============================================================================
 */

describe("account status", () => {
  it("rejects an invalid account status synchronously", () => {
    expect(() =>
      updateAccountStatus(new mongoose.Types.ObjectId(), "NOT_A_REAL_STATUS")
    ).toThrow("Invalid account status.");
  });

  it("changes account status and increments sessionVersion", async () => {
    const user = await createActiveUser({
      sessionVersion: 3,
    });

    const result = await updateAccountStatus(
      user._id,
      ACCOUNT_STATUSES.SUSPENDED
    );

    const updatedUser = expectMutationSuccess(result);

    expect(updatedUser.accountStatus).toBe(ACCOUNT_STATUSES.SUSPENDED);
    expect(updatedUser.sessionVersion).toBe(4);
  });

  it("does not increment sessionVersion when the status stays unchanged", async () => {
    const user = await createActiveUser({
      sessionVersion: 7,
    });

    const result = await updateAccountStatus(user._id, ACCOUNT_STATUSES.ACTIVE);
    const updatedUser = expectMutationSuccess(result);

    expect(updatedUser.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    expect(updatedUser.sessionVersion).toBe(7);
  });

  it("allows an unchanged status even when sessionVersion is MAX_SAFE_INTEGER", async () => {
    const user = await createActiveUser({
      sessionVersion: MAX_SAFE_INTEGER,
    });

    const result = await updateAccountStatus(user._id, ACCOUNT_STATUSES.ACTIVE);
    const updatedUser = expectMutationSuccess(result);

    expect(updatedUser.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    expect(updatedUser.sessionVersion).toBe(MAX_SAFE_INTEGER);
  });

  it("blocks a status change at MAX_SAFE_INTEGER", async () => {
    const user = await createActiveUser({
      sessionVersion: MAX_SAFE_INTEGER,
    });

    const result = await updateAccountStatus(
      user._id,
      ACCOUNT_STATUSES.SUSPENDED
    );

    expectMutationFailure(result, ERROR_CODES.SESSION_VERSION_LIMIT_REACHED);

    const stored = await User.findById(user._id);

    expect(stored?.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    expect(stored?.sessionVersion).toBe(MAX_SAFE_INTEGER);
  });

  it("requires emailVerified=true when setting ACTIVE", async () => {
    const user = await createFixture({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: false,
    });

    const result = await updateAccountStatus(user._id, ACCOUNT_STATUSES.ACTIVE);

    expectMutationFailure(result, ERROR_CODES.EMAIL_NOT_VERIFIED);

    const stored = await User.findById(user._id);

    expect(stored?.accountStatus).toBe(ACCOUNT_STATUSES.SUSPENDED);
    expect(stored?.emailVerified).toBe(false);
    expect(stored?.sessionVersion).toBe(0);
  });

  it("requires emailVerified=false when setting PENDING_VERIFICATION", async () => {
    const user = await createActiveUser();

    const result = await updateAccountStatus(
      user._id,
      ACCOUNT_STATUSES.PENDING_VERIFICATION
    );

    expectMutationFailure(result, ERROR_CODES.USER_LIFECYCLE_CONFLICT);

    const stored = await User.findById(user._id);

    expect(stored?.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.sessionVersion).toBe(0);
  });

  it("distinguishes deleted users from missing users", async () => {
    const deleted = await createActiveUser({
      deletedAt: new Date(),
    });

    const deletedResult = await updateAccountStatus(
      deleted._id,
      ACCOUNT_STATUSES.ACTIVE
    );

    const missingResult = await updateAccountStatus(
      new mongoose.Types.ObjectId(),
      ACCOUNT_STATUSES.ACTIVE
    );

    expectMutationFailure(deletedResult, ERROR_CODES.USER_ALREADY_DELETED);
    expectMutationFailure(missingResult, ERROR_CODES.USER_NOT_FOUND);

    const stored = await User.findById(deleted._id);

    expect(stored?.accountStatus).toBe(ACCOUNT_STATUSES.ACTIVE);
    expect(stored?.emailVerified).toBe(true);
    expect(stored?.sessionVersion).toBe(0);
  });
});

/*
 * ============================================================================
 * Soft Delete and Restore
 * ============================================================================
 */

describe("soft delete and restore", () => {
  it("soft-deletes a non-deleted user and increments sessionVersion", async () => {
    const user = await createFixture({
      sessionVersion: 2,
    });

    const deletedAt = new Date("2026-01-01T00:00:00.000Z");

    const result = await softDeleteUser(user._id, {
      deletedAt,
    });

    const deletedUser = expectMutationSuccess(result);

    expect(deletedUser.deletedAt.getTime()).toBe(deletedAt.getTime());
    expect(deletedUser.sessionVersion).toBe(3);
  });

  it("does not soft-delete an already deleted user without changing its state", async () => {
    const deletedAt = new Date("2026-01-03T00:00:00.000Z");

    const user = await createFixture({
      deletedAt,
      sessionVersion: 4,
    });

    const result = await softDeleteUser(user._id);

    expectMutationFailure(result, ERROR_CODES.USER_ALREADY_DELETED);

    const stored = await User.findById(user._id);

    expect(stored?.deletedAt?.getTime()).toBe(deletedAt.getTime());
    expect(stored?.sessionVersion).toBe(4);
  });

  it("uses the current time for deletedAt when no explicit date is provided", async () => {
    const user = await createFixture();
    const before = Date.now();

    const result = await softDeleteUser(user._id);
    const deletedUser = expectMutationSuccess(result);

    const after = Date.now();

    expect(deletedUser.deletedAt).toBeInstanceOf(Date);
    expect(deletedUser.deletedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(deletedUser.deletedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("reports USER_NOT_FOUND when soft-deleting a missing user", async () => {
    const result = await softDeleteUser(new mongoose.Types.ObjectId());

    expectMutationFailure(result, ERROR_CODES.USER_NOT_FOUND);
  });

  it("blocks soft delete at MAX_SAFE_INTEGER", async () => {
    const user = await createFixture({
      sessionVersion: MAX_SAFE_INTEGER,
    });

    const result = await softDeleteUser(user._id);

    expectMutationFailure(result, ERROR_CODES.SESSION_VERSION_LIMIT_REACHED);

    const stored = await User.findById(user._id);

    expect(stored?.deletedAt).toBeNull();
    expect(stored?.sessionVersion).toBe(MAX_SAFE_INTEGER);
  });

  it("restores a soft-deleted user and increments sessionVersion", async () => {
    const user = await createFixture({
      deletedAt: new Date("2026-01-02T00:00:00.000Z"),
      sessionVersion: 5,
    });

    const result = await restoreUser(user._id);
    const restoredUser = expectMutationSuccess(result);

    expect(restoredUser.deletedAt).toBeNull();
    expect(restoredUser.sessionVersion).toBe(6);
  });

  it("does not restore a non-deleted user without changing its state", async () => {
    const user = await createFixture({
      sessionVersion: 4,
    });

    const result = await restoreUser(user._id);

    expectMutationFailure(result, ERROR_CODES.USER_NOT_DELETED);

    const stored = await User.findById(user._id);

    expect(stored?.deletedAt).toBeNull();
    expect(stored?.sessionVersion).toBe(4);
  });

  it("reports USER_NOT_FOUND when restoring a missing user", async () => {
    const result = await restoreUser(new mongoose.Types.ObjectId());

    expectMutationFailure(result, ERROR_CODES.USER_NOT_FOUND);
  });

  it("blocks restore at MAX_SAFE_INTEGER", async () => {
    const user = await createFixture({
      deletedAt: new Date("2026-01-02T00:00:00.000Z"),
      sessionVersion: MAX_SAFE_INTEGER,
    });

    const result = await restoreUser(user._id);

    expectMutationFailure(result, ERROR_CODES.SESSION_VERSION_LIMIT_REACHED);

    const stored = await User.findById(user._id);

    expect(stored?.deletedAt).not.toBeNull();
    expect(stored?.sessionVersion).toBe(MAX_SAFE_INTEGER);
  });
});

/*
 * ============================================================================
 * Active Users Cursor Pagination
 * ============================================================================
 */

describe("active users cursor pagination", () => {
  it("returns only active, verified, non-deleted users", async () => {
    const active = await createActiveUser();

    await createFixture({
      username: "inactive",
      email: "inactive-list@example.com",
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    await createFixture({
      username: "unverified-list",
      email: "unverified-list@example.com",
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: false,
    });

    await createActiveUser({
      username: "deleted-list",
      email: "deleted-list@example.com",
      deletedAt: new Date(),
    });

    const result = await findActiveUsers({
      sort: USER_SORTS.MOST_VIEWED,
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]._id.toString()).toBe(active._id.toString());
  });

  it("enforces active-user conditions over conflicting accountStatus filters", async () => {
    const active = await createActiveUser();

    await createFixture({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
      username: "suspended-user",
      email: "suspended-user@example.com",
    });

    const result = await findActiveUsers({
      filter: {
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      },
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]._id.toString()).toBe(active._id.toString());
  });

  it("uses MOST_VIEWED as the default sort and 16 as the default limit", async () => {
    const users = [];

    for (let index = 0; index < 17; index += 1) {
      users.push(
        await createActiveUser({
          username: `default-user-${index + 1}`,
          email: `default-user-${index + 1}@example.com`,
          stats: {
            totalRecipeViews: 17 - index,
          },
        })
      );
    }

    const result = await findActiveUsers();

    expect(result).toHaveLength(16);
    expect(result[0]._id.toString()).toBe(users[0]._id.toString());
    expect(result[0].stats.totalRecipeViews).toBe(17);
    expect(result[15]._id.toString()).toBe(users[15]._id.toString());
    expect(result[15].stats.totalRecipeViews).toBe(2);
  });

  it("applies a simple filter", async () => {
    const secondaryTitle = getSecondaryTitle();

    const matching = await createActiveUser({
      title: secondaryTitle,
    });

    await createActiveUser();

    const result = await findActiveUsers({
      filter: {
        title: secondaryTitle,
      },
      sort: USER_SORTS.NEWEST,
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]._id.toString()).toBe(matching._id.toString());
  });

  it("preserves a filter-level $or and combines it with active-user conditions", async () => {
    const matching1 = await createActiveUser({
      username: "or-match-1",
    });

    const matching2 = await createActiveUser({
      username: "or-match-2",
    });

    await createActiveUser({
      username: "or-not-match",
    });

    const result = await findActiveUsers({
      filter: {
        $or: [
          {
            username: matching1.username,
          },
          {
            username: matching2.username,
          },
        ],
      },
      sort: USER_SORTS.NEWEST,
      limit: 10,
    });

    expect(result).toHaveLength(2);
    expect(result.map((user) => user.username)).toEqual(
      expect.arrayContaining([matching1.username, matching2.username])
    );
  });

  it("preserves a filter-level $and when adding the cursor condition", async () => {
    const secondaryTitle = getSecondaryTitle();

    const matching1 = await createActiveUser({
      title: secondaryTitle,
      username: "and-match-1",
      stats: {
        totalRecipeViews: 100,
      },
    });

    const matching2 = await createActiveUser({
      title: secondaryTitle,
      username: "and-match-2",
      stats: {
        totalRecipeViews: 90,
      },
    });

    await createActiveUser({
      title: USER_TITLES.USER,
      stats: {
        totalRecipeViews: 80,
      },
    });

    const firstPage = await findActiveUsers({
      filter: {
        $and: [
          {
            title: secondaryTitle,
          },
          {
            username: {
              $in: [matching1.username, matching2.username],
            },
          },
        ],
      },
      sort: USER_SORTS.MOST_VIEWED,
      limit: 1,
    });

    expect(firstPage).toHaveLength(1);
    expect(firstPage[0].username).toBe(matching1.username);

    const cursor = {
      value: firstPage[0].stats.totalRecipeViews,
      id: firstPage[0]._id,
    };

    const secondPage = await findActiveUsers({
      filter: {
        $and: [
          {
            title: secondaryTitle,
          },
          {
            username: {
              $in: [matching1.username, matching2.username],
            },
          },
        ],
      },
      sort: USER_SORTS.MOST_VIEWED,
      cursor,
      limit: 10,
    });

    expect(secondPage).toHaveLength(1);
    expect(secondPage[0].username).toBe(matching2.username);
  });

  it("applies MOST_VIEWED keyset pagination with the _id tie-breaker", async () => {
    const user1 = await createActiveUser({
      _id: createObjectId("1"),
      username: "view-user-1",
      email: "view-user-1@example.com",
      stats: {
        totalRecipeViews: 100,
      },
    });

    const user2 = await createActiveUser({
      _id: createObjectId("2"),
      username: "view-user-2",
      email: "view-user-2@example.com",
      stats: {
        totalRecipeViews: 100,
      },
    });

    const user3 = await createActiveUser({
      _id: createObjectId("3"),
      username: "view-user-3",
      email: "view-user-3@example.com",
      stats: {
        totalRecipeViews: 90,
      },
    });

    const firstPage = await findActiveUsers({
      sort: USER_SORTS.MOST_VIEWED,
      limit: 1,
    });

    expect(firstPage).toHaveLength(1);
    expect(firstPage[0]._id.toString()).toBe(user2._id.toString());

    const cursor = {
      value: firstPage[0].stats.totalRecipeViews,
      id: firstPage[0]._id,
    };

    const secondPage = await findActiveUsers({
      sort: USER_SORTS.MOST_VIEWED,
      cursor,
      limit: 10,
    });

    expect(secondPage.map((user) => user._id.toString())).toEqual([
      user1._id.toString(),
      user3._id.toString(),
    ]);
  });

  it.each([USER_SORTS.HIGHEST_RATED, USER_SORTS.NEWEST, USER_SORTS.OLDEST])(
    "returns users in the exact expected %s order",
    async (sort) => {
      const specs = [
        ["a", 5, "2026-02-01T00:00:00.000Z"],
        ["b", 3, "2026-03-01T00:00:00.000Z"],
        ["c", 4, "2026-01-01T00:00:00.000Z"],
      ];

      const created = {};

      for (const [key, rating, date] of specs) {
        created[key] = await createActiveUser({
          _id: createObjectId(key === "a" ? "11" : key === "b" ? "12" : "13"),
          username: `sort-${key}`,
          email: `sort-${key}@example.com`,
          createdAt: new Date(date),
          updatedAt: new Date(date),
          stats: {
            averageRating: rating,
          },
        });
      }

      const expectedKeys = {
        [USER_SORTS.HIGHEST_RATED]: ["a", "c", "b"],
        [USER_SORTS.NEWEST]: ["b", "a", "c"],
        [USER_SORTS.OLDEST]: ["c", "a", "b"],
      }[sort];

      const result = await findActiveUsers({
        sort,
        limit: 10,
      });

      expect(result.map((user) => user._id.toString())).toEqual(
        expectedKeys.map((key) => created[key]._id.toString())
      );
    }
  );

  it.each([USER_SORTS.HIGHEST_RATED, USER_SORTS.NEWEST, USER_SORTS.OLDEST])(
    "paginates all unique primary values in exact order for %s",
    async (sort) => {
      const specs = {
        [USER_SORTS.HIGHEST_RATED]: [
          ["a", 5, "2026-01-01T00:00:00.000Z"],
          ["b", 4, "2026-03-01T00:00:00.000Z"],
          ["c", 3, "2026-02-01T00:00:00.000Z"],
          ["d", 2, "2026-04-01T00:00:00.000Z"],
        ],

        [USER_SORTS.NEWEST]: [
          ["a", 2, "2026-04-01T00:00:00.000Z"],
          ["b", 5, "2026-03-01T00:00:00.000Z"],
          ["c", 4, "2026-02-01T00:00:00.000Z"],
          ["d", 3, "2026-01-01T00:00:00.000Z"],
        ],

        [USER_SORTS.OLDEST]: [
          ["a", 2, "2026-01-01T00:00:00.000Z"],
          ["b", 5, "2026-02-01T00:00:00.000Z"],
          ["c", 4, "2026-03-01T00:00:00.000Z"],
          ["d", 3, "2026-04-01T00:00:00.000Z"],
        ],
      }[sort];

      const created = {};

      for (const [index, [key, rating, date]] of specs.entries()) {
        created[key] = await createActiveUser({
          _id: createObjectId(String(21 + index)),
          username: `cursor-${sort}-${key}`,
          email: `cursor-${sort}-${key}@example.com`,
          createdAt: new Date(date),
          updatedAt: new Date(date),
          stats: {
            averageRating: rating,
          },
        });
      }

      const expectedIds = specs.map(([key]) => created[key]._id.toString());

      const page1 = await findActiveUsers({
        sort,
        limit: 2,
      });

      expect(page1.map((user) => user._id.toString())).toEqual(
        expectedIds.slice(0, 2)
      );

      const cursor1 = {
        value:
          sort === USER_SORTS.HIGHEST_RATED
            ? page1[1].stats.averageRating
            : page1[1].createdAt,
        id: page1[1]._id,
      };

      const page2 = await findActiveUsers({
        sort,
        cursor: cursor1,
        limit: 2,
      });

      expect(page2.map((user) => user._id.toString())).toEqual(
        expectedIds.slice(2, 4)
      );

      expect([...page1, ...page2].map((user) => user._id.toString())).toEqual(
        expectedIds
      );
    }
  );

  it.each([USER_SORTS.HIGHEST_RATED, USER_SORTS.NEWEST, USER_SORTS.OLDEST])(
    "paginates across a primary-value tie using _id for %s",
    async (sort) => {
      const sameDate = new Date("2026-05-01T00:00:00.000Z");

      const outlierDate =
        sort === USER_SORTS.OLDEST
          ? new Date("2026-06-01T00:00:00.000Z")
          : new Date("2026-04-01T00:00:00.000Z");

      const first = await createActiveUser({
        _id: createObjectId("1"),
        username: `tie-first-${sort}`,
        email: `tie-first-${sort}@example.com`,
        createdAt: sameDate,
        updatedAt: sameDate,
        stats: {
          averageRating: 5,
        },
      });

      const second = await createActiveUser({
        _id: createObjectId("2"),
        username: `tie-second-${sort}`,
        email: `tie-second-${sort}@example.com`,
        createdAt: sameDate,
        updatedAt: sameDate,
        stats: {
          averageRating: 5,
        },
      });

      const third = await createActiveUser({
        _id: createObjectId("3"),
        username: `tie-third-${sort}`,
        email: `tie-third-${sort}@example.com`,
        createdAt: outlierDate,
        updatedAt: outlierDate,
        stats: {
          averageRating: 4,
        },
      });

      const isDescending =
        sort === USER_SORTS.HIGHEST_RATED || sort === USER_SORTS.NEWEST;

      const expectedFirstPageId = isDescending
        ? second._id.toString()
        : first._id.toString();

      const expectedSecondPageIds = isDescending
        ? [first._id.toString(), third._id.toString()]
        : [second._id.toString(), third._id.toString()];

      const firstPage = await findActiveUsers({
        sort,
        limit: 1,
      });

      expect(firstPage.map((user) => user._id.toString())).toEqual([
        expectedFirstPageId,
      ]);

      const cursor = {
        value:
          sort === USER_SORTS.HIGHEST_RATED
            ? firstPage[0].stats.averageRating
            : firstPage[0].createdAt,
        id: firstPage[0]._id,
      };

      const secondPage = await findActiveUsers({
        sort,
        cursor,
        limit: 10,
      });

      expect(secondPage.map((user) => user._id.toString())).toEqual(
        expectedSecondPageIds
      );
    }
  );

  it("throws for an invalid sort", () => {
    expect(() =>
      findActiveUsers({
        sort: "NOT_A_REAL_SORT",
      })
    ).toThrow("Invalid user sort.");
  });
});

/*
 * ============================================================================
 * Simple User Statistics
 * ============================================================================
 */

describe("simple user statistics", () => {
  const statisticCases = [
    {
      name: "recipeCount",
      increment: incrementRecipeCount,
      field: "recipeCount",
    },
    {
      name: "totalRecipeViews",
      increment: incrementTotalRecipeViews,
      field: "totalRecipeViews",
    },
  ];

  const invalidDeltaCases = [
    0,
    NaN,
    Infinity,
    -Infinity,
    1.5,
    MAX_SAFE_INTEGER + 1,
    -MAX_SAFE_INTEGER - 1,
  ];

  it.each(statisticCases)(
    "increments $name by an explicit positive delta",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: 10,
        },
      });

      const result = await increment(user._id, 5);

      expect(result).not.toBeNull();
      expect(result.stats[field]).toBe(15);
    }
  );

  it.each(statisticCases)(
    "uses a default delta of one for $name",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: 10,
        },
      });

      const result = await increment(user._id);

      expect(result).not.toBeNull();
      expect(result.stats[field]).toBe(11);
    }
  );

  it.each(statisticCases)(
    "supports a valid negative delta for $name",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: 5,
        },
      });

      const result = await increment(user._id, -2);

      expect(result).not.toBeNull();
      expect(result.stats[field]).toBe(3);
    }
  );

  it.each(statisticCases)(
    "allows $name to reach zero exactly",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: 2,
        },
      });

      const result = await increment(user._id, -2);

      expect(result).not.toBeNull();
      expect(result.stats[field]).toBe(0);
    }
  );

  it.each(
    statisticCases.flatMap(({ name, increment }) =>
      invalidDeltaCases.map((delta) => ({
        name,
        increment,
        delta,
      }))
    )
  )("rejects invalid $name delta: $delta", ({ increment, delta }) => {
    expect(() => increment(new mongoose.Types.ObjectId(), delta)).toThrow(
      "User stat delta must be a non-zero safe integer."
    );
  });

  it.each(statisticCases)(
    "blocks a decrement that would make $name negative",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: 2,
        },
      });

      const result = await increment(user._id, -3);

      expect(result).toBeNull();

      const stats = await getStats(user._id);
      expect(stats?.[field]).toBe(2);
    }
  );

  it.each(statisticCases)(
    "allows $name to reach MAX_SAFE_INTEGER exactly",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: MAX_SAFE_INTEGER - 1,
        },
      });

      const result = await increment(user._id, 1);

      expect(result).not.toBeNull();
      expect(result.stats[field]).toBe(MAX_SAFE_INTEGER);
    }
  );

  it.each(statisticCases)(
    "blocks an increment that would exceed MAX_SAFE_INTEGER for $name",
    async ({ increment, field }) => {
      const user = await createFixture({
        stats: {
          [field]: MAX_SAFE_INTEGER,
        },
      });

      const result = await increment(user._id, 1);

      expect(result).toBeNull();

      const stats = await getStats(user._id);
      expect(stats?.[field]).toBe(MAX_SAFE_INTEGER);
    }
  );

  it("blocks incrementing a non-integer stored recipeCount", async () => {
    const user = await createFixture({
      stats: {
        recipeCount: 3,
      },
    });

    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: {
          "stats.recipeCount": 3.5,
        },
      }
    );

    const result = await incrementRecipeCount(user._id, 1);

    expect(result).toBeNull();

    const stored = await User.findById(user._id).lean();

    expect(stored?.stats.recipeCount).toBe(3.5);
  });

  it.each(statisticCases)(
    "does not update a soft-deleted or missing user for $name",
    async ({ increment, field }) => {
      const deleted = await createFixture({
        deletedAt: new Date(),
        stats: {
          [field]: 3,
        },
      });

      const deletedResult = await increment(deleted._id, 1);
      const missingResult = await increment(new mongoose.Types.ObjectId(), 1);

      expect(deletedResult).toBeNull();
      expect(missingResult).toBeNull();

      const stats = await getStats(deleted._id);
      expect(stats?.[field]).toBe(3);
    }
  );
});

/*
 * ============================================================================
 * Reconciled User Statistics
 * ============================================================================
 */

describe("setUserStats", () => {
  const validStats = {
    recipeCount: 10,
    totalRecipeViews: 500,
    ratingCount: 4,
    ratingSum: 17,
    averageRating: 4.25,
  };

  it("replaces all reconciled statistics and returns the updated user", async () => {
    const user = await createFixture({
      stats: {
        recipeCount: 1,
        totalRecipeViews: 10,
        ratingCount: 2,
        ratingSum: 7,
        averageRating: 3.5,
      },
    });

    const result = await setUserStats(user._id, validStats);

    expect(result?.stats).toMatchObject(validStats);
  });

  it("accepts a valid two-decimal average affected by floating-point representation", async () => {
    const user = await createFixture();

    const stats = {
      recipeCount: 10,
      totalRecipeViews: 500,
      ratingCount: 20,
      ratingSum: 23,
      averageRating: 1.15,
    };

    const result = await setUserStats(user._id, stats);

    expect(result?.stats).toMatchObject(stats);
  });

  it("accepts a complete zero-rating snapshot", async () => {
    const user = await createFixture({
      stats: {
        recipeCount: 3,
        totalRecipeViews: 20,
        ratingCount: 2,
        ratingSum: 7,
        averageRating: 3.5,
      },
    });

    const stats = {
      recipeCount: 5,
      totalRecipeViews: 25,
      ratingCount: 0,
      ratingSum: 0,
      averageRating: 0,
    };

    const result = await setUserStats(user._id, stats);

    expect(result?.stats).toMatchObject(stats);
  });

  it("uses round-half-to-even when reconciling averageRating", async () => {
    const user = await createFixture();

    const roundsDownToEven = await setUserStats(user._id, {
      recipeCount: 1,
      totalRecipeViews: 1,
      ratingCount: 200,
      ratingSum: 889,
      averageRating: 4.44,
    });

    expect(roundsDownToEven?.stats.averageRating).toBe(4.44);

    const roundsUpToEven = await setUserStats(user._id, {
      recipeCount: 1,
      totalRecipeViews: 1,
      ratingCount: 200,
      ratingSum: 891,
      averageRating: 4.46,
    });

    expect(roundsUpToEven?.stats.averageRating).toBe(4.46);
  });

  it("accepts safe integer statistics at the MAX_SAFE_INTEGER boundary", async () => {
    const user = await createFixture();

    const stats = {
      recipeCount: MAX_SAFE_INTEGER,
      totalRecipeViews: MAX_SAFE_INTEGER,
      ratingCount: MAX_SAFE_INTEGER,
      ratingSum: MAX_SAFE_INTEGER,
      averageRating: 1,
    };

    const result = await setUserStats(user._id, stats);

    expect(result?.stats).toEqual(stats);
  });

  it.each(Object.keys(validStats))(
    "rejects an incomplete reconciled snapshot when %s is missing",
    async (missingField) => {
      const user = await createFixture();
      const stats = { ...validStats };

      delete stats[missingField];

      expect(() => setUserStats(user._id, stats)).toThrow(
        `User stat "${missingField}" is required.`
      );

      const stored = await User.findById(user._id);

      expect(stored?.stats).toMatchObject({
        recipeCount: 0,
        totalRecipeViews: 0,
        ratingCount: 0,
        ratingSum: 0,
        averageRating: 0,
      });
    }
  );

  it.each(Object.keys(validStats))(
    "rejects an undefined value when %s is explicitly undefined",
    async (field) => {
      const initialStats = {
        recipeCount: 3,
        totalRecipeViews: 20,
        ratingCount: 2,
        ratingSum: 7,
        averageRating: 3.5,
      };

      const user = await createFixture({
        stats: initialStats,
      });

      const stats = {
        ...validStats,
        [field]: undefined,
      };

      expect(() => setUserStats(user._id, stats)).toThrow(
        `User stat "${field}" is required.`
      );

      const stored = await User.findById(user._id);

      expect(stored?.stats).toMatchObject(initialStats);
    }
  );

  it.each(
    Object.keys(validStats)
      .filter((field) => field !== "averageRating")
      .flatMap((field) =>
        [-1, 1.5, MAX_SAFE_INTEGER + 1, NaN, Infinity].map((value) => ({
          field,
          value,
        }))
      )
  )("rejects an invalid integer stat $field value: $value", async (data) => {
    const { field, value } = data;
    const user = await createFixture();

    const invalidStats = {
      ...validStats,
      [field]: value,
    };

    expect(() => setUserStats(user._id, invalidStats)).toThrow(TypeError);

    const stored = await User.findById(user._id);

    expect(stored?.stats).toMatchObject({
      recipeCount: 0,
      totalRecipeViews: 0,
      ratingCount: 0,
      ratingSum: 0,
      averageRating: 0,
    });
  });

  it.each([-0.01, 5.01, NaN, Infinity])(
    "rejects an invalid averageRating value: %s",
    async (value) => {
      const user = await createFixture();

      const invalidStats = {
        ...validStats,
        averageRating: value,
      };

      expect(() => setUserStats(user._id, invalidStats)).toThrow(TypeError);

      const stored = await User.findById(user._id);

      expect(stored?.stats).toMatchObject({
        recipeCount: 0,
        totalRecipeViews: 0,
        ratingCount: 0,
        ratingSum: 0,
        averageRating: 0,
      });
    }
  );

  it.each([
    {
      caseName: "zero rating count requires zero rating sum",
      stats: {
        ...validStats,
        ratingCount: 0,
        ratingSum: 1,
        averageRating: 0,
      },
      expectedMessage: "When ratingCount is zero",
    },
    {
      caseName: "zero rating count requires zero average rating",
      stats: {
        ...validStats,
        ratingCount: 0,
        ratingSum: 0,
        averageRating: 1,
      },
      expectedMessage: "When ratingCount is zero",
    },
    {
      caseName: "rating sum cannot be below rating count",
      stats: {
        ...validStats,
        ratingCount: 5,
        ratingSum: 4,
        averageRating: 0.8,
      },
      expectedMessage:
        "ratingSum must be between ratingCount and ratingCount multiplied by 5.",
    },
    {
      caseName: "rating sum cannot exceed rating count multiplied by five",
      stats: {
        ...validStats,
        ratingCount: 1,
        ratingSum: 6,
        averageRating: 5,
      },
      expectedMessage:
        "ratingSum must be between ratingCount and ratingCount multiplied by 5.",
    },
    {
      caseName: "average rating must match rating sum divided by rating count",
      stats: {
        ...validStats,
        ratingCount: 4,
        ratingSum: 17,
        averageRating: 4.2,
      },
      expectedMessage: "averageRating must equal the rounded average",
    },
  ])(
    "rejects invalid rating invariant: $caseName",
    async ({ stats, expectedMessage }) => {
      const user = await createFixture();

      expect(() => setUserStats(user._id, stats)).toThrow(expectedMessage);

      const stored = await User.findById(user._id);

      expect(stored?.stats).toMatchObject({
        recipeCount: 0,
        totalRecipeViews: 0,
        ratingCount: 0,
        ratingSum: 0,
        averageRating: 0,
      });
    }
  );

  it("returns null for a soft-deleted or missing user", async () => {
    const deleted = await createFixture({
      deletedAt: new Date(),
      stats: validStats,
    });

    const deletedResult = await setUserStats(deleted._id, validStats);

    const missingResult = await setUserStats(
      new mongoose.Types.ObjectId(),
      validStats
    );

    expect(deletedResult).toBeNull();
    expect(missingResult).toBeNull();

    const stored = await User.findById(deleted._id);

    expect(stored?.stats).toMatchObject(validStats);
  });

  it("propagates the provided session and rolls back the statistics update", async () => {
    const initialStats = {
      recipeCount: 3,
      totalRecipeViews: 20,
      ratingCount: 2,
      ratingSum: 7,
      averageRating: 3.5,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          const result = await setUserStats(user._id, validStats, session);

          expect(result?.stats).toMatchObject(validStats);

          throw new Error("force setUserStats rollback");
        })
      ).rejects.toThrow("force setUserStats rollback");

      const stored = await User.findById(user._id);

      expect(stored?.stats).toMatchObject(initialStats);
    } finally {
      await session.endSession();
    }
  });
});

/*
 * ============================================================================
 * User Rating Statistics
 * ============================================================================
 */

describe("user rating statistics", () => {
  it("applies a create-style delta and calculates the rounded average", async () => {
    const user = await createFixture({
      stats: {
        ratingCount: 10,
        ratingSum: 38,
        averageRating: 3.8,
      },
    });

    const result = await updateUserRatingStatsDeltas(user._id, 1, 4);

    expect(result).not.toBeNull();
    expect(result?.stats.ratingCount).toBe(11);
    expect(result?.stats.ratingSum).toBe(42);
    expect(result?.stats.averageRating).toBe(3.82);
  });

  it("applies an update-style delta without changing ratingCount", async () => {
    const user = await createFixture({
      stats: {
        ratingCount: 10,
        ratingSum: 38,
        averageRating: 3.8,
      },
    });

    const result = await updateUserRatingStatsDeltas(user._id, 0, 2);

    expect(result).not.toBeNull();
    expect(result?.stats.ratingCount).toBe(10);
    expect(result?.stats.ratingSum).toBe(40);
    expect(result?.stats.averageRating).toBe(4);
  });

  it("applies a delete-style delta and resets averageRating to zero when no ratings remain", async () => {
    const user = await createFixture({
      stats: {
        ratingCount: 1,
        ratingSum: 4,
        averageRating: 4,
      },
    });

    const result = await updateUserRatingStatsDeltas(user._id, -1, -4);

    expect(result).not.toBeNull();
    expect(result?.stats.ratingCount).toBe(0);
    expect(result?.stats.ratingSum).toBe(0);
    expect(result?.stats.averageRating).toBe(0);
  });

  it.each([
    {
      ratingCountDelta: 1.5,
      ratingSumDelta: 1,
    },
    {
      ratingCountDelta: 1,
      ratingSumDelta: 1.5,
    },
    {
      ratingCountDelta: MAX_SAFE_INTEGER + 1,
      ratingSumDelta: 1,
    },
    {
      ratingCountDelta: 1,
      ratingSumDelta: MAX_SAFE_INTEGER + 1,
    },
  ])(
    "rejects non-safe integer rating deltas: $ratingCountDelta, $ratingSumDelta",
    ({ ratingCountDelta, ratingSumDelta }) => {
      expect(() =>
        updateUserRatingStatsDeltas(
          new mongoose.Types.ObjectId(),
          ratingCountDelta,
          ratingSumDelta
        )
      ).toThrow("User rating stat deltas must be safe integers.");
    }
  );

  it("rejects two zero deltas", () => {
    expect(() =>
      updateUserRatingStatsDeltas(new mongoose.Types.ObjectId(), 0, 0)
    ).toThrow("At least one User rating stat delta must be non-zero.");
  });

  it("blocks a result with a negative ratingCount", async () => {
    const initialStats = {
      ratingCount: 1,
      ratingSum: 1,
      averageRating: 1,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, -2, -2);

    expect(result).toBeNull();

    const stats = await getStats(user._id);

    expect(stats).toMatchObject(initialStats);
  });

  it("blocks a result where ratingSum falls below ratingCount", async () => {
    const initialStats = {
      ratingCount: 5,
      ratingSum: 5,
      averageRating: 1,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, 1, 0);

    expect(result).toBeNull();

    const stats = await getStats(user._id);

    expect(stats).toMatchObject(initialStats);
  });

  it("blocks a result where ratingSum exceeds ratingCount multiplied by five", async () => {
    const initialStats = {
      ratingCount: 1,
      ratingSum: 5,
      averageRating: 5,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, 0, 1);

    expect(result).toBeNull();

    const stats = await getStats(user._id);

    expect(stats).toMatchObject(initialStats);
  });

  it("blocks rating updates when the resulting ratingSum is not an integer", async () => {
    const user = await createFixture({
      stats: {
        ratingCount: 1,
        ratingSum: 4,
        averageRating: 4,
      },
    });

    await User.collection.updateOne(
      { _id: user._id },
      {
        $set: {
          "stats.ratingSum": 4.5,
        },
      }
    );

    const result = await updateUserRatingStatsDeltas(user._id, 1, 1);

    expect(result).toBeNull();

    const stored = await User.findById(user._id).lean();

    expect(stored?.stats.ratingCount).toBe(1);
    expect(stored?.stats.ratingSum).toBe(4.5);
  });

  it("blocks ratingCount overflow beyond MAX_SAFE_INTEGER", async () => {
    const initialStats = {
      ratingCount: MAX_SAFE_INTEGER,
      ratingSum: MAX_SAFE_INTEGER,
      averageRating: 1,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, 1, 0);

    expect(result).toBeNull();

    const stats = await getStats(user._id);

    expect(stats).toMatchObject(initialStats);
  });

  it("blocks ratingSum overflow beyond MAX_SAFE_INTEGER", async () => {
    const initialStats = {
      ratingCount: MAX_SAFE_INTEGER,
      ratingSum: MAX_SAFE_INTEGER,
      averageRating: 1,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, 0, 1);

    expect(result).toBeNull();

    const stats = await getStats(user._id);

    expect(stats).toMatchObject(initialStats);
  });

  it("allows ratingCount to reach MAX_SAFE_INTEGER exactly", async () => {
    const initialStats = {
      ratingCount: MAX_SAFE_INTEGER - 1,
      ratingSum: MAX_SAFE_INTEGER,
      averageRating: 1,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, 1, 0);

    expect(result).not.toBeNull();
    expect(result.stats.ratingCount).toBe(MAX_SAFE_INTEGER);
    expect(result.stats.ratingSum).toBe(MAX_SAFE_INTEGER);
    expect(result.stats.averageRating).toBe(1);
  });

  it("allows ratingSum to reach MAX_SAFE_INTEGER exactly", async () => {
    const initialStats = {
      ratingCount: MAX_SAFE_INTEGER,
      ratingSum: MAX_SAFE_INTEGER - 1,
      averageRating: 1,
    };

    const user = await createFixture({
      stats: initialStats,
    });

    const result = await updateUserRatingStatsDeltas(user._id, 0, 1);

    expect(result).not.toBeNull();
    expect(result.stats.ratingCount).toBe(MAX_SAFE_INTEGER);
    expect(result.stats.ratingSum).toBe(MAX_SAFE_INTEGER);
    expect(result.stats.averageRating).toBe(1);
  });

  it("returns null for a soft-deleted or missing user", async () => {
    const initialStats = {
      ratingCount: 1,
      ratingSum: 4,
      averageRating: 4,
    };

    const deleted = await createFixture({
      deletedAt: new Date(),
      stats: initialStats,
    });

    const deletedResult = await updateUserRatingStatsDeltas(deleted._id, 1, 5);

    const missingResult = await updateUserRatingStatsDeltas(
      new mongoose.Types.ObjectId(),
      1,
      5
    );

    expect(deletedResult).toBeNull();
    expect(missingResult).toBeNull();

    const stats = await getStats(deleted._id);

    expect(stats).toMatchObject(initialStats);
  });
});

/*
 * ============================================================================
 * Session Propagation and Transactions
 * ============================================================================
 */

describe("session propagation", () => {
  it("propagates the provided session to a read query", async () => {
    const session = await mongoose.startSession();
    let userId;

    try {
      await expect(
        session.withTransaction(async () => {
          const user = await createUser(
            {
              username: "session-read-user",
              email: "session-read-user@example.com",
              password: "hashed-password",
              accountStatus: ACCOUNT_STATUSES.ACTIVE,
              emailVerified: true,
            },
            session
          );

          userId = user._id;

          const found = await findActiveUserById(user._id, session);

          expect(found?._id.toString()).toBe(user._id.toString());

          throw new Error("force read rollback");
        })
      ).rejects.toThrow("force read rollback");

      const stored = await User.findById(userId);

      expect(stored).toBeNull();
    } finally {
      await session.endSession();
    }
  });

  it("propagates the provided session to an update query and rolls it back", async () => {
    const user = await createActiveUser();
    const originalBio = user.bio;
    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          const updated = await updateUserProfileById(
            user._id,
            {
              bio: "transaction-only-bio",
            },
            session
          );

          expect(updated?.bio).toBe("transaction-only-bio");

          throw new Error("force update rollback");
        })
      ).rejects.toThrow("force update rollback");

      const stored = await User.findById(user._id);

      expect(stored?.bio).toBe(originalBio);
    } finally {
      await session.endSession();
    }
  });

  it("executes repository mutations inside the provided session", async () => {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const user = await createUser(
          {
            username: "session-user",
            email: "session-user@example.com",
            password: "hashed-password",
          },
          session
        );

        const updated = await incrementRecipeCount(user._id, 1, session);

        expect(updated?.stats.recipeCount).toBe(1);
      });

      const stored = await User.findOne({
        username: "session-user",
      });

      expect(stored?.stats.recipeCount).toBe(1);
    } finally {
      await session.endSession();
    }
  });

  it("rolls back a repository statistic mutation when the transaction aborts", async () => {
    const user = await createActiveUser({
      stats: {
        recipeCount: 7,
      },
    });

    await expect(
      mongoose.connection.transaction(async (session) => {
        const updated = await incrementRecipeCount(user._id, 3, session);

        expect(updated?.stats.recipeCount).toBe(10);

        throw new Error("force statistic rollback");
      })
    ).rejects.toThrow("force statistic rollback");

    const stored = await User.findById(user._id);

    expect(stored).not.toBeNull();
    expect(stored.stats.recipeCount).toBe(7);
  });
});
