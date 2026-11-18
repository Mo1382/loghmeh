import { createHash } from "node:crypto";

import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_STATUSES } from "@/constants/enums";
import { ERROR_CODES } from "@/constants/error-codes";
import { SESSION_POLICY } from "@/constants/session";

import AppError from "@/lib/errors/AppError";
import { isValidSessionToken } from "@/lib/auth/session-token";

import {
  createSessionForUser,
  getActiveUserSessions,
  resolveSessionToken,
  revokeAllUserSessions,
  revokeSessionByToken,
  revokeUserSession,
} from "@/services/session.service";

const mocks = vi.hoisted(() => ({
  requireActiveAuthenticatedUser: vi.fn(),
  findActiveUserById: vi.fn(),
  incrementUserSessionVersion: vi.fn(),

  createSessionRecord: vi.fn(),
  findSessionByTokenHash: vi.fn(),
  findActiveSessionRecordsByUserId: vi.fn(),
  revokeSessionRecordById: vi.fn(),
  revokeExpiredSessionRecordById: vi.fn(),
  revokeSessionRecordsByUserId: vi.fn(),
  touchSessionRecord: vi.fn(),

  withTransaction: vi.fn(),
}));

// ============================================================================
// Module mocks
// ============================================================================

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/guards", () => ({
  requireActiveAuthenticatedUser: mocks.requireActiveAuthenticatedUser,
}));

vi.mock("@/repositories/user.repository", () => ({
  findActiveUserById: mocks.findActiveUserById,
  incrementUserSessionVersion: mocks.incrementUserSessionVersion,
}));

vi.mock("@/repositories/session.repository", () => ({
  createSession: mocks.createSessionRecord,
  findSessionByTokenHash: mocks.findSessionByTokenHash,

  findActiveSessionsByUserId: mocks.findActiveSessionRecordsByUserId,

  revokeSessionById: mocks.revokeSessionRecordById,
  revokeExpiredSessionById: mocks.revokeExpiredSessionRecordById,
  revokeSessionsByUserId: mocks.revokeSessionRecordsByUserId,

  touchSession: mocks.touchSessionRecord,
}));

vi.mock("@/lib/transaction", () => ({
  withTransaction: mocks.withTransaction,
}));

// ============================================================================
// Test constants
// ============================================================================

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const TEST_NOW = new Date("2026-05-15T12:00:00.000Z");

const TEST_USER_ID = new mongoose.Types.ObjectId("64f1a2b3c4d5e6f708090a01");

const TEST_SESSION_ID = new mongoose.Types.ObjectId("64f1a2b3c4d5e6f708090a02");

const TEST_SESSION_VERSION = 7;

const VALID_TOKEN = Buffer.alloc(SESSION_POLICY.TOKEN_BYTES, 0x5a).toString(
  "base64url"
);

const NON_CANONICAL_TOKEN = `${VALID_TOKEN.slice(0, -1)}B`;

const TEST_TRANSACTION_SESSION = Object.freeze({
  id: "test-transaction-session",
});

// ============================================================================
// Mock aliases
// ============================================================================

const {
  requireActiveAuthenticatedUser,
  findActiveUserById,
  incrementUserSessionVersion,

  createSessionRecord,
  findSessionByTokenHash,
  findActiveSessionRecordsByUserId,
  revokeSessionRecordById,
  revokeExpiredSessionRecordById,
  revokeSessionRecordsByUserId,
  touchSessionRecord,

  withTransaction,
} = mocks;

// ============================================================================
// Test factories
// ============================================================================

function makeUser(overrides = {}) {
  return {
    _id: TEST_USER_ID,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
    deletedAt: null,
    sessionVersion: TEST_SESSION_VERSION,
    ...overrides,
  };
}

function makeSession(overrides = {}, baseNow = TEST_NOW) {
  return {
    _id: TEST_SESSION_ID,
    userId: TEST_USER_ID,
    sessionVersion: TEST_SESSION_VERSION,

    createdAt: new Date(baseNow.getTime() - DAY_MS),
    lastActivityAt: new Date(baseNow.getTime() - MINUTE_MS),
    idleExpiresAt: new Date(baseNow.getTime() + DAY_MS),

    absoluteExpiresAt: new Date(
      baseNow.getTime() + SESSION_POLICY.ABSOLUTE_TIMEOUT_MS
    ),

    revokedAt: null,

    ...overrides,
  };
}

function hashToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

// ============================================================================
// Test helpers
// ============================================================================

async function expectAppError(promise, code, statusCode, message) {
  const error = await promise.then(
    () => undefined,
    (reason) => reason
  );

  expect(error).toBeInstanceOf(AppError);

  const expected = { code, statusCode };

  if (message !== undefined) {
    expected.message = message;
  }

  expect(error).toMatchObject(expected);

  return error;
}

function expectValidDate(value) {
  expect(value).toBeInstanceOf(Date);
  expect(Number.isFinite(value.getTime())).toBe(true);
}

// ============================================================================
// Test setup
// ============================================================================

beforeEach(() => {
  vi.resetAllMocks();

  findActiveUserById.mockImplementation(async (userId) =>
    makeUser({ _id: userId })
  );

  createSessionRecord.mockImplementation(async (data) => ({
    _id: TEST_SESSION_ID,
    userId: data.userId,
    sessionVersion: data.sessionVersion,
    createdAt: new Date(data.lastActivityAt),
    lastActivityAt: data.lastActivityAt,
    idleExpiresAt: data.idleExpiresAt,
    absoluteExpiresAt: data.absoluteExpiresAt,
    revokedAt: null,
  }));

  findSessionByTokenHash.mockResolvedValue(makeSession());

  revokeSessionRecordById.mockImplementation(
    async (sessionId, { userId, revokedAt }) =>
      makeSession({
        _id: sessionId,
        userId,
        revokedAt,
      })
  );

  revokeExpiredSessionRecordById.mockImplementation(
    async (sessionId, { userId, now }) =>
      makeSession({
        _id: sessionId,
        userId,
        revokedAt: now,
      })
  );

  // A successful Touch result is configured explicitly in the relevant tests.
  touchSessionRecord.mockResolvedValue(null);

  requireActiveAuthenticatedUser.mockImplementation(
    async (currentUser) => currentUser
  );

  findActiveSessionRecordsByUserId.mockResolvedValue([]);

  incrementUserSessionVersion.mockImplementation(
    async (userId, { expectedSessionVersion } = {}) =>
      makeUser({
        _id: userId,
        sessionVersion: expectedSessionVersion + 1,
      })
  );

  revokeSessionRecordsByUserId.mockResolvedValue({
    acknowledged: true,
    matchedCount: 0,
    modifiedCount: 0,
  });

  withTransaction.mockImplementation(async (callback) =>
    callback(TEST_TRANSACTION_SESSION)
  );
});

// ============================================================================
// createSessionForUser
// ============================================================================

describe("createSessionForUser()", () => {
  // ============================================================================
  // Successful Session Creation
  // ============================================================================

  it("creates a Session for an active, verified User and persists only the token hash", async () => {
    const now = new Date(TEST_NOW);

    const userId = new mongoose.Types.ObjectId();
    const sessionVersion = 4;

    const idleTimeoutMs = 2 * HOUR_MS;
    const absoluteTimeoutMs = 5 * HOUR_MS;

    const storedSession = makeSession(
      {
        _id: new mongoose.Types.ObjectId(),
        userId,
        sessionVersion,

        lastActivityAt: now,
        idleExpiresAt: new Date(now.getTime() + idleTimeoutMs),
        absoluteExpiresAt: new Date(now.getTime() + absoluteTimeoutMs),
      },
      now
    );

    createSessionRecord.mockResolvedValue(storedSession);

    findActiveUserById.mockResolvedValue(
      makeUser({ _id: userId, sessionVersion })
    );

    const result = await createSessionForUser({
      userId,
      sessionVersion,
      now,
      idleTimeoutMs,
      absoluteTimeoutMs,
    });

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(findActiveUserById).toHaveBeenCalledWith(userId);

    expect(result).toEqual({
      token: expect.any(String),
      session: storedSession,
    });

    expect(isValidSessionToken(result.token)).toBe(true);

    const expectedTokenHash = hashToken(result.token);
    const creationData = createSessionRecord.mock.calls[0][0];

    expect(createSessionRecord).toHaveBeenCalledOnce();

    expect(creationData).toStrictEqual({
      userId,
      tokenHash: expectedTokenHash,
      sessionVersion,
      lastActivityAt: now,
      idleExpiresAt: new Date(now.getTime() + idleTimeoutMs),
      absoluteExpiresAt: new Date(now.getTime() + absoluteTimeoutMs),
    });

    expect(creationData.tokenHash).not.toBe(result.token);
    expect(creationData.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses the configured default timeouts and current time when options are omitted", async () => {
    const startedAt = Date.now();

    const result = await createSessionForUser({
      userId: TEST_USER_ID,
      sessionVersion: TEST_SESSION_VERSION,
    });

    const finishedAt = Date.now();

    const creationData = createSessionRecord.mock.calls[0][0];

    expectValidDate(creationData.lastActivityAt);

    expect(creationData.lastActivityAt.getTime()).toBeGreaterThanOrEqual(
      startedAt
    );

    expect(creationData.lastActivityAt.getTime()).toBeLessThanOrEqual(
      finishedAt
    );

    expect(
      creationData.idleExpiresAt.getTime() -
        creationData.lastActivityAt.getTime()
    ).toBe(SESSION_POLICY.IDLE_TIMEOUT_MS);

    expect(
      creationData.absoluteExpiresAt.getTime() -
        creationData.lastActivityAt.getTime()
    ).toBe(SESSION_POLICY.ABSOLUTE_TIMEOUT_MS);

    expect(isValidSessionToken(result.token)).toBe(true);
  });

  it("accepts a valid ObjectId string", async () => {
    const userId = TEST_USER_ID.toString();

    const result = await createSessionForUser({
      userId,
      sessionVersion: TEST_SESSION_VERSION,
      now: new Date(TEST_NOW),
    });

    expect(result.token).toEqual(expect.any(String));

    expect(findActiveUserById).toHaveBeenCalledWith(userId);
    expect(createSessionRecord).toHaveBeenCalledOnce();
  });

  // ============================================================================
  // Request Input Validation
  // ============================================================================

  // userId
  it.each([null, undefined, "", 123, "z".repeat(24)])(
    "rejects an invalid userId (%s) before querying the User repository",
    async (userId) => {
      await expectAppError(
        createSessionForUser({
          userId,
          sessionVersion: TEST_SESSION_VERSION,
          now: new Date(TEST_NOW),
        }),
        ERROR_CODES.INVALID_REQUEST,
        400,
        "شناسه user ID نامعتبر است."
      );

      expect(findActiveUserById).not.toHaveBeenCalled();
      expect(createSessionRecord).not.toHaveBeenCalled();
    }
  );

  // sessionVersion
  it("accepts sessionVersion zero because it is a valid non-negative version", async () => {
    findActiveUserById.mockResolvedValue(makeUser({ sessionVersion: 0 }));

    await createSessionForUser({
      userId: TEST_USER_ID,
      sessionVersion: 0,
      now: new Date(TEST_NOW),
    });

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(createSessionRecord).toHaveBeenCalledOnce();

    expect(createSessionRecord.mock.calls[0][0].sessionVersion).toBe(0);
  });

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    NaN,
    "7",
    null,
    undefined,
  ])("rejects an invalid sessionVersion: %s", async (sessionVersion) => {
    await expect(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion,
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("sessionVersion must be a non-negative safe integer.");

    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  // now
  it.each([
    ["a non-Date value", "not-a-date"],
    ["an invalid Date object", new Date(Number.NaN)],
  ])("rejects %s as now", async (_, now) => {
    await expect(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now,
      })
    ).rejects.toThrow("now must be a valid Date.");

    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  // Timeout values
  it.each([
    { field: "idleTimeoutMs", value: 0 },
    { field: "idleTimeoutMs", value: -1 },
    { field: "idleTimeoutMs", value: 1.5 },
    { field: "idleTimeoutMs", value: Number.MAX_SAFE_INTEGER + 1 },
    { field: "idleTimeoutMs", value: Infinity },
    { field: "idleTimeoutMs", value: NaN },
    { field: "idleTimeoutMs", value: "1000" },
    { field: "idleTimeoutMs", value: null },

    { field: "absoluteTimeoutMs", value: 0 },
    { field: "absoluteTimeoutMs", value: -1 },
    { field: "absoluteTimeoutMs", value: 1.5 },
    { field: "absoluteTimeoutMs", value: Number.MAX_SAFE_INTEGER + 1 },
    { field: "absoluteTimeoutMs", value: Infinity },
    { field: "absoluteTimeoutMs", value: NaN },
    { field: "absoluteTimeoutMs", value: "1000" },
    { field: "absoluteTimeoutMs", value: null },
  ])("rejects an invalid $field value: $value", async ({ field, value }) => {
    await expect(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now: new Date(TEST_NOW),
        [field]: value,
      })
    ).rejects.toThrow(`${field} must be a positive safe integer.`);

    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  // ============================================================================
  // User Eligibility
  // ============================================================================

  it.each([
    {
      description: "a missing User",
      user: null,
    },
    {
      description: "a pending-verification User",
      user: makeUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      }),
    },
    {
      description: "a suspended User",
      user: makeUser({
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      }),
    },
    {
      description: "a deactivated User",
      user: makeUser({
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
      }),
    },
    {
      description: "an active User with an unverified email",
      user: makeUser({
        emailVerified: false,
      }),
    },
    {
      description: "a User whose emailVerified value is not true",
      user: makeUser({
        emailVerified: 1,
      }),
    },
  ])("rejects $description", async ({ user }) => {
    findActiveUserById.mockResolvedValue(user);

    await expectAppError(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.FORBIDDEN,
      403,
      "حساب کاربری شما در حال حاضر قابل استفاده نیست."
    );

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(findActiveUserById).toHaveBeenCalledWith(TEST_USER_ID);

    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  // ============================================================================
  // User Session Version Consistency
  // ============================================================================

  it.each([
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    NaN,
    "7",
    null,
    undefined,
  ])(
    "rejects a User with an invalid current sessionVersion: %s",
    async (userSessionVersion) => {
      findActiveUserById.mockResolvedValue(
        makeUser({
          sessionVersion: userSessionVersion,
        })
      );

      await expectAppError(
        createSessionForUser({
          userId: TEST_USER_ID,
          sessionVersion: TEST_SESSION_VERSION,
          now: new Date(TEST_NOW),
        }),
        ERROR_CODES.USER_LIFECYCLE_CONFLICT,
        409,
        "اطلاعات احراز هویت هم‌زمان تغییر کرده است. لطفاً دوباره وارد شوید."
      );

      expect(findActiveUserById).toHaveBeenCalledOnce();

      expect(createSessionRecord).not.toHaveBeenCalled();
    }
  );

  it("rejects a stale sessionVersion instead of silently using the User's newer version", async () => {
    findActiveUserById.mockResolvedValue(
      makeUser({
        sessionVersion: TEST_SESSION_VERSION + 1,
      })
    );

    await expectAppError(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.USER_LIFECYCLE_CONFLICT,
      409,
      "اطلاعات احراز هویت هم‌زمان تغییر کرده است. لطفاً دوباره وارد شوید."
    );

    expect(findActiveUserById).toHaveBeenCalledOnce();

    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  // ============================================================================
  // Session Expiration Policy and Date Boundaries
  // ============================================================================

  it("caps idle expiry at the absolute expiry when idle timeout is longer", async () => {
    const now = new Date(TEST_NOW);

    const idleTimeoutMs = 10 * DAY_MS;
    const absoluteTimeoutMs = 2 * DAY_MS;

    await createSessionForUser({
      userId: TEST_USER_ID,
      sessionVersion: TEST_SESSION_VERSION,
      now,
      idleTimeoutMs,
      absoluteTimeoutMs,
    });

    const creationData = createSessionRecord.mock.calls[0][0];

    expect(creationData.idleExpiresAt.getTime()).toBe(
      creationData.absoluteExpiresAt.getTime()
    );

    expect(creationData.absoluteExpiresAt.getTime()).toBe(
      now.getTime() + absoluteTimeoutMs
    );
  });

  it("rejects an absolute timeout whose resulting expiry is an invalid Date", async () => {
    const now = new Date(8.64e15 - 1000);

    await expect(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now,
        idleTimeoutMs: 500,
        absoluteTimeoutMs: 2000,
      })
    ).rejects.toThrow("absoluteExpiresAt must be a valid Date.");

    expect(findActiveUserById).toHaveBeenCalledOnce();

    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  it("caps an idle expiry that would exceed the Date range at the absolute expiry", async () => {
    const now = new Date(8.64e15 - 1000);

    const idleTimeoutMs = 2000;
    const absoluteTimeoutMs = 500;

    await createSessionForUser({
      userId: TEST_USER_ID,
      sessionVersion: TEST_SESSION_VERSION,
      now,
      idleTimeoutMs,
      absoluteTimeoutMs,
    });

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(createSessionRecord).toHaveBeenCalledOnce();

    const creationData = createSessionRecord.mock.calls[0][0];

    expectValidDate(creationData.absoluteExpiresAt);
    expectValidDate(creationData.idleExpiresAt);

    expect(creationData.absoluteExpiresAt.getTime()).toBe(
      now.getTime() + absoluteTimeoutMs
    );

    expect(creationData.idleExpiresAt.getTime()).toBe(
      creationData.absoluteExpiresAt.getTime()
    );
  });

  // ============================================================================
  // Repository Error Handling
  // ============================================================================

  it("propagates User repository errors", async () => {
    findActiveUserById.mockRejectedValue(
      new Error("User database unavailable")
    );

    await expect(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("User database unavailable");

    expect(createSessionRecord).not.toHaveBeenCalled();
  });

  it("propagates Session repository errors", async () => {
    createSessionRecord.mockRejectedValue(
      new Error("Session database unavailable")
    );

    await expect(
      createSessionForUser({
        userId: TEST_USER_ID,
        sessionVersion: TEST_SESSION_VERSION,
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("Session database unavailable");
  });
});

// ============================================================================
// resolveSessionToken
// ============================================================================

describe("resolveSessionToken()", () => {
  // ==========================================================================
  // Input Validation
  // ==========================================================================

  it.each([
    null,
    undefined,
    "",
    "invalid-token",
    "token with spaces",
    "A".repeat(42),
    `${"A".repeat(43)}=`,
    NON_CANONICAL_TOKEN,
    123,
  ])("returns null for a malformed token: %s", async (token) => {
    const result = await resolveSessionToken(token, {
      now: new Date(TEST_NOW),
    });

    expect(result).toBeNull();

    expect(findSessionByTokenHash).not.toHaveBeenCalled();
    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(touchSessionRecord).not.toHaveBeenCalled();
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
    expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a non-Date value",
      now: "invalid-date",
    },
    {
      description: "an invalid Date object",
      now: new Date(Number.NaN),
    },
  ])(
    "rejects $description as now before looking up the token",
    async ({ now }) => {
      await expect(resolveSessionToken(VALID_TOKEN, { now })).rejects.toThrow(
        "now must be a valid Date."
      );

      expect(findSessionByTokenHash).not.toHaveBeenCalled();
      expect(findActiveUserById).not.toHaveBeenCalled();
      expect(touchSessionRecord).not.toHaveBeenCalled();
      expect(revokeSessionRecordById).not.toHaveBeenCalled();
      expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
    }
  );

  it.each([null, 0, 1, "true"])(
    "rejects a non-boolean touch option: %s",
    async (touch) => {
      await expect(
        resolveSessionToken(VALID_TOKEN, {
          now: new Date(TEST_NOW),
          touch,
        })
      ).rejects.toThrow("touch must be a boolean.");

      expect(findSessionByTokenHash).not.toHaveBeenCalled();
    }
  );

  // ==========================================================================
  // Session Lookup and Basic Resolution
  // ==========================================================================

  it("returns null when the token hash does not identify a Session", async () => {
    findSessionByTokenHash.mockResolvedValue(null);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now: new Date(TEST_NOW),
    });

    expect(result).toBeNull();

    expect(findSessionByTokenHash).toHaveBeenCalledWith(hashToken(VALID_TOKEN));

    expect(findActiveUserById).not.toHaveBeenCalled();
  });

  it("resolves a valid token to its active User and Session", async () => {
    const now = new Date(TEST_NOW);
    const session = makeSession({}, now);
    const user = makeUser({ _id: session.userId });

    findSessionByTokenHash.mockResolvedValue(session);
    findActiveUserById.mockResolvedValue(user);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now,
      touch: false,
    });

    expect(result).toEqual({ user, session });

    expect(findSessionByTokenHash).toHaveBeenCalledOnce();
    expect(findSessionByTokenHash).toHaveBeenCalledWith(hashToken(VALID_TOKEN));

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(findActiveUserById).toHaveBeenCalledWith(session.userId);

    expect(touchSessionRecord).not.toHaveBeenCalled();
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
    expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
  });

  it("resolves a Session with sessionVersion zero", async () => {
    const now = new Date(TEST_NOW);

    const session = makeSession(
      {
        sessionVersion: 0,
      },
      now
    );

    const user = makeUser({
      _id: session.userId,
      sessionVersion: 0,
    });

    findSessionByTokenHash.mockResolvedValue(session);
    findActiveUserById.mockResolvedValue(user);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now,
      touch: false,
    });

    expect(result).toEqual({
      user,
      session,
    });

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
    expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  // ==========================================================================
  //  Session Integrity and Revocation
  // ==========================================================================

  it("returns null for an already-revoked Session without changing revokedAt", async () => {
    const now = new Date(TEST_NOW);
    const revokedAt = new Date(now.getTime() - HOUR_MS);

    const session = makeSession({ revokedAt });

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result).toBeNull();

    expect(findSessionByTokenHash).toHaveBeenCalledOnce();

    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
    expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  it("attempts to revoke a Session whose revokedAt field is missing", async () => {
    const now = new Date(TEST_NOW);
    const session = makeSession({ revokedAt: undefined });

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result).toBeNull();

    expect(revokeSessionRecordById).toHaveBeenCalledOnce();

    expect(revokeSessionRecordById).toHaveBeenCalledWith(session._id, {
      userId: session.userId,
      revokedAt: now,
    });

    expect(findActiveUserById).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a missing lastActivityAt",
      overrides: {
        lastActivityAt: undefined,
      },
    },
    {
      description: "an invalid lastActivityAt",
      overrides: {
        lastActivityAt: new Date(Number.NaN),
      },
    },
    {
      description: "a missing idleExpiresAt",
      overrides: {
        idleExpiresAt: undefined,
      },
    },
    {
      description: "an invalid idleExpiresAt",
      overrides: {
        idleExpiresAt: new Date(Number.NaN),
      },
    },
    {
      description: "a missing absoluteExpiresAt",
      overrides: {
        absoluteExpiresAt: undefined,
      },
    },
    {
      description: "an invalid absoluteExpiresAt",
      overrides: {
        absoluteExpiresAt: new Date(Number.NaN),
      },
    },
    {
      description: "idle expiry equal to last activity",
      overrides: {
        lastActivityAt: new Date(TEST_NOW),
        idleExpiresAt: new Date(TEST_NOW),
        absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),
      },
    },
    {
      description: "last activity later than idle expiry",
      overrides: {
        lastActivityAt: new Date(TEST_NOW),
        idleExpiresAt: new Date(TEST_NOW.getTime() - 1),
        absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),
      },
    },
    {
      description: "idle expiry later than absolute expiry",
      overrides: {
        lastActivityAt: new Date(TEST_NOW.getTime() - MINUTE_MS),
        idleExpiresAt: new Date(TEST_NOW.getTime() + 2 * DAY_MS),
        absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),
      },
    },
  ])(
    "rejects $description and attempts to revoke the invalid Session",
    async ({ overrides }) => {
      const now = new Date(TEST_NOW);
      const session = makeSession(overrides, now);

      findSessionByTokenHash.mockResolvedValue(session);

      const result = await resolveSessionToken(VALID_TOKEN, { now });

      expect(result).toBeNull();

      expect(revokeSessionRecordById).toHaveBeenCalledOnce();

      expect(revokeSessionRecordById).toHaveBeenCalledWith(session._id, {
        userId: session.userId,
        revokedAt: now,
      });

      expect(findActiveUserById).not.toHaveBeenCalled();
    }
  );

  it.each([
    {
      description: "a missing Session ID",
      overrides: {
        _id: null,
      },
    },
    {
      description: "a missing User ID",
      overrides: {
        userId: null,
      },
    },
  ])(
    "does not attempt to revoke a structurally invalid Session with $description",
    async ({ overrides }) => {
      const session = makeSession(overrides);

      findSessionByTokenHash.mockResolvedValue(session);

      const result = await resolveSessionToken(VALID_TOKEN, {
        now: new Date(TEST_NOW),
      });

      expect(result).toBeNull();

      expect(revokeSessionRecordById).not.toHaveBeenCalled();
      expect(findActiveUserById).not.toHaveBeenCalled();

      expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
      expect(touchSessionRecord).not.toHaveBeenCalled();
    }
  );

  it("propagates repository errors while revoking a structurally invalid Session", async () => {
    const now = new Date(TEST_NOW);

    const session = makeSession({
      lastActivityAt: new Date(Number.NaN),
    });

    findSessionByTokenHash.mockResolvedValue(session);

    revokeSessionRecordById.mockRejectedValue(
      new Error("Invalid Session cleanup failed")
    );

    await expect(resolveSessionToken(VALID_TOKEN, { now })).rejects.toThrow(
      "Invalid Session cleanup failed"
    );

    expect(revokeSessionRecordById).toHaveBeenCalledWith(session._id, {
      userId: session.userId,
      revokedAt: now,
    });

    expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  // ==========================================================================
  //  Session Expiration
  // ==========================================================================

  it("revokes an expired Session when conditional expiration cleanup succeeds", async () => {
    const now = new Date(TEST_NOW);

    const expiredSession = makeSession(
      {
        lastActivityAt: new Date(now.getTime() - HOUR_MS),
        idleExpiresAt: now,
        absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(expiredSession);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result).toBeNull();

    expect(revokeExpiredSessionRecordById).toHaveBeenCalledOnce();

    expect(revokeExpiredSessionRecordById).toHaveBeenCalledWith(
      expiredSession._id,
      {
        userId: expiredSession.userId,
        now,
      }
    );

    expect(findActiveUserById).not.toHaveBeenCalled();
  });

  it("rejects a Session after both idle and absolute expiration deadlines have been reached", async () => {
    const now = new Date(TEST_NOW);

    const expiredSession = makeSession(
      {
        lastActivityAt: new Date(now.getTime() - 2 * DAY_MS),
        idleExpiresAt: new Date(now.getTime() - DAY_MS),
        absoluteExpiresAt: now,
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(expiredSession);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result).toBeNull();

    expect(revokeExpiredSessionRecordById).toHaveBeenCalledOnce();
    expect(findActiveUserById).not.toHaveBeenCalled();
  });

  it("re-resolves an expired Session when conditional revocation loses a race", async () => {
    const now = new Date(TEST_NOW);

    const staleExpiredSession = makeSession(
      {
        lastActivityAt: new Date(now.getTime() - HOUR_MS),
        idleExpiresAt: now,
        absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
      },
      now
    );

    const refreshedSession = makeSession(
      {
        _id: staleExpiredSession._id,
        userId: staleExpiredSession.userId,
        sessionVersion: staleExpiredSession.sessionVersion,
        lastActivityAt: new Date(now.getTime() - MINUTE_MS),
        idleExpiresAt: new Date(now.getTime() + DAY_MS),
        absoluteExpiresAt: staleExpiredSession.absoluteExpiresAt,
      },
      now
    );

    findSessionByTokenHash
      .mockResolvedValueOnce(staleExpiredSession)
      .mockResolvedValueOnce(refreshedSession);

    revokeExpiredSessionRecordById.mockResolvedValueOnce(null);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now,
      touch: false,
    });

    expect(result).toEqual({
      user: makeUser({ _id: refreshedSession.userId }),
      session: refreshedSession,
    });

    expect(findSessionByTokenHash).toHaveBeenCalledTimes(2);
    expect(revokeExpiredSessionRecordById).toHaveBeenCalledOnce();
    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(result.session.absoluteExpiresAt).toEqual(
      staleExpiredSession.absoluteExpiresAt
    );
  });

  it("fails closed after three unsuccessful conditional revocation attempts", async () => {
    const now = new Date(TEST_NOW);

    const expiredSession = makeSession(
      {
        lastActivityAt: new Date(now.getTime() - HOUR_MS),
        idleExpiresAt: now,
        absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(expiredSession);
    revokeExpiredSessionRecordById.mockResolvedValue(null);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now,
      touch: false,
    });

    expect(result).toBeNull();

    expect(findSessionByTokenHash).toHaveBeenCalledTimes(3);
    expect(revokeExpiredSessionRecordById).toHaveBeenCalledTimes(3);

    expect(findActiveUserById).not.toHaveBeenCalled();
  });

  // ==========================================================================
  //  Clock Skew Validation
  // ==========================================================================

  it("accepts activity exactly at the maximum allowed future clock skew", async () => {
    const now = new Date(TEST_NOW);

    const lastActivityAt = new Date(
      now.getTime() + SESSION_POLICY.MAX_CLOCK_SKEW_MS
    );

    const session = makeSession(
      {
        lastActivityAt,
        idleExpiresAt: new Date(lastActivityAt.getTime() + HOUR_MS),
        absoluteExpiresAt: new Date(lastActivityAt.getTime() + 2 * DAY_MS),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now,
      touch: true,
    });

    expect(result).not.toBeNull();
    expect(result.session).toBe(session);

    expect(findActiveUserById).toHaveBeenCalledOnce();
    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  it("rejects activity beyond clock-skew tolerance without revoking the Session", async () => {
    const now = new Date(TEST_NOW);

    const lastActivityAt = new Date(
      now.getTime() + SESSION_POLICY.MAX_CLOCK_SKEW_MS + 1
    );

    const session = makeSession(
      {
        lastActivityAt,
        idleExpiresAt: new Date(lastActivityAt.getTime() + HOUR_MS),
        absoluteExpiresAt: new Date(lastActivityAt.getTime() + 2 * DAY_MS),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result).toBeNull();

    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
    expect(revokeExpiredSessionRecordById).not.toHaveBeenCalled();
    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  // ==========================================================================
  //  User Eligibility and Session Version Consistency
  // ==========================================================================

  it.each([
    {
      description: "a missing User",
      user: null,
    },
    {
      description: "a pending-verification User",
      user: makeUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      }),
    },
    {
      description: "a suspended User",
      user: makeUser({
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      }),
    },
    {
      description: "a deactivated User",
      user: makeUser({
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
      }),
    },
    {
      description: "a User with an unverified email",
      user: makeUser({
        emailVerified: false,
      }),
    },
    {
      description: "a User with a mismatched sessionVersion",
      user: makeUser({
        sessionVersion: TEST_SESSION_VERSION + 1,
      }),
    },
    {
      description: "a User with a non-integer sessionVersion",
      user: makeUser({
        sessionVersion: 1.5,
      }),
    },
    {
      description: "a User with a negative sessionVersion",
      user: makeUser({
        sessionVersion: -1,
      }),
    },
    {
      description: "a User with a NaN sessionVersion",
      user: makeUser({
        sessionVersion: NaN,
      }),
    },
    {
      description: "a User with an infinite sessionVersion",
      user: makeUser({
        sessionVersion: Infinity,
      }),
    },
    {
      description: "a User with an unsafe sessionVersion",
      user: makeUser({
        sessionVersion: Number.MAX_SAFE_INTEGER + 1,
      }),
    },
    {
      description: "a User with a string sessionVersion",
      user: makeUser({
        sessionVersion: "7",
      }),
    },
    {
      description: "a User with a null sessionVersion",
      user: makeUser({
        sessionVersion: null,
      }),
    },
    {
      description: "a User with an undefined sessionVersion",
      user: makeUser({
        sessionVersion: undefined,
      }),
    },
    {
      description: "a User whose emailVerified value is not true",
      user: makeUser({
        emailVerified: 1,
      }),
    },
  ])(
    "rejects a Session owned by $description and attempts to revoke it",
    async ({ user }) => {
      const now = new Date(TEST_NOW);
      const session = makeSession({}, now);

      findSessionByTokenHash.mockResolvedValue(session);
      findActiveUserById.mockResolvedValue(user);

      const result = await resolveSessionToken(VALID_TOKEN, {
        now,
        touch: false,
      });

      expect(result).toBeNull();

      expect(findActiveUserById).toHaveBeenCalledOnce();
      expect(findActiveUserById).toHaveBeenCalledWith(session.userId);

      expect(revokeSessionRecordById).toHaveBeenCalledOnce();
      expect(revokeSessionRecordById).toHaveBeenCalledWith(session._id, {
        userId: session.userId,
        revokedAt: now,
      });

      expect(touchSessionRecord).not.toHaveBeenCalled();
    }
  );

  // ==========================================================================
  //  Session Touch and Concurrent Updates
  // ==========================================================================

  it("does not touch a Session when the touch option is false", async () => {
    const now = new Date(TEST_NOW);

    const session = makeSession(
      {
        lastActivityAt: new Date(
          now.getTime() - 2 * SESSION_POLICY.TOUCH_INTERVAL_MS
        ),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await resolveSessionToken(VALID_TOKEN, {
      now,
      touch: false,
    });

    expect(result).toEqual({
      user: makeUser({ _id: session.userId }),
      session,
    });

    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  it("does not touch a Session before the configured touch interval has elapsed", async () => {
    const now = new Date(TEST_NOW);

    const session = makeSession(
      {
        lastActivityAt: new Date(
          now.getTime() - SESSION_POLICY.TOUCH_INTERVAL_MS + 1
        ),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result.session).toBe(session);
    expect(touchSessionRecord).not.toHaveBeenCalled();
  });

  it("touches a Session when the configured interval has elapsed exactly", async () => {
    const now = new Date(TEST_NOW);
    const currentSessionVersion = TEST_SESSION_VERSION + 1;

    const session = makeSession(
      {
        sessionVersion: currentSessionVersion,
        lastActivityAt: new Date(
          now.getTime() - SESSION_POLICY.TOUCH_INTERVAL_MS
        ),
        idleExpiresAt: new Date(now.getTime() + HOUR_MS),
      },
      now
    );

    findActiveUserById.mockResolvedValue(
      makeUser({
        _id: session.userId,
        sessionVersion: currentSessionVersion,
      })
    );

    const touchedSession = makeSession(
      {
        _id: session._id,
        userId: session.userId,
        sessionVersion: session.sessionVersion,
        lastActivityAt: now,
        idleExpiresAt: new Date(now.getTime() + SESSION_POLICY.IDLE_TIMEOUT_MS),
        absoluteExpiresAt: session.absoluteExpiresAt,
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(session);
    touchSessionRecord.mockResolvedValue(touchedSession);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result.session.idleExpiresAt.getTime()).toBeGreaterThan(
      session.idleExpiresAt.getTime()
    );

    expect(result.session.absoluteExpiresAt).toEqual(session.absoluteExpiresAt);

    expect(touchSessionRecord).toHaveBeenCalledOnce();

    expect(touchSessionRecord).toHaveBeenCalledWith(session._id, {
      userId: session.userId,
      sessionVersion: currentSessionVersion,
      now,
      idleTimeoutMs: SESSION_POLICY.IDLE_TIMEOUT_MS,
      touchIntervalMs: SESSION_POLICY.TOUCH_INTERVAL_MS,
    });

    expect(result.session).toBe(touchedSession);
  });

  it("uses the latest Session after a concurrent Touch", async () => {
    const now = new Date(TEST_NOW);

    const initialSession = makeSession(
      {
        lastActivityAt: new Date(
          now.getTime() - 2 * SESSION_POLICY.TOUCH_INTERVAL_MS
        ),
        idleExpiresAt: new Date(now.getTime() + HOUR_MS),
      },
      now
    );

    const refreshedSession = makeSession(
      {
        _id: initialSession._id,
        userId: initialSession.userId,
        sessionVersion: initialSession.sessionVersion,
        lastActivityAt: new Date(now.getTime() - MINUTE_MS),
        idleExpiresAt: new Date(now.getTime() + DAY_MS),
        absoluteExpiresAt: initialSession.absoluteExpiresAt,
      },
      now
    );

    const initialUser = makeUser({
      _id: initialSession.userId,
    });

    const latestUser = makeUser({
      _id: initialSession.userId,
      sessionVersion: initialSession.sessionVersion,
    });

    findSessionByTokenHash
      .mockResolvedValueOnce(initialSession)
      .mockResolvedValueOnce(refreshedSession);

    findActiveUserById
      .mockResolvedValueOnce(initialUser)
      .mockResolvedValueOnce(latestUser);

    touchSessionRecord.mockResolvedValueOnce(null);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(touchSessionRecord).toHaveBeenCalledOnce();

    expect(findSessionByTokenHash).toHaveBeenCalledTimes(2);
    expect(findActiveUserById).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      user: latestUser,
      session: refreshedSession,
    });

    expect(result.session.idleExpiresAt.getTime()).toBeGreaterThan(
      initialSession.idleExpiresAt.getTime()
    );

    expect(result.session.absoluteExpiresAt).toEqual(
      initialSession.absoluteExpiresAt
    );
  });

  it("returns null when Touch fails and the latest Session no longer exists", async () => {
    const now = new Date(TEST_NOW);

    const session = makeSession(
      {
        lastActivityAt: new Date(
          now.getTime() - 2 * SESSION_POLICY.TOUCH_INTERVAL_MS
        ),
      },
      now
    );

    findSessionByTokenHash
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(null);

    touchSessionRecord.mockResolvedValueOnce(null);

    const result = await resolveSessionToken(VALID_TOKEN, { now });

    expect(result).toBeNull();

    expect(findSessionByTokenHash).toHaveBeenCalledTimes(2);
    expect(touchSessionRecord).toHaveBeenCalledOnce();
  });

  // ==========================================================================
  //  Repository Error Handling
  // ==========================================================================

  it("propagates Session lookup errors", async () => {
    findSessionByTokenHash.mockRejectedValue(
      new Error("Session database unavailable")
    );

    await expect(
      resolveSessionToken(VALID_TOKEN, {
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("Session database unavailable");
  });

  it("propagates User lookup errors during Session resolution", async () => {
    findActiveUserById.mockRejectedValue(new Error("User lookup failed"));

    await expect(
      resolveSessionToken(VALID_TOKEN, {
        now: new Date(TEST_NOW),
        touch: false,
      })
    ).rejects.toThrow("User lookup failed");
  });

  it("propagates Touch repository errors", async () => {
    const now = new Date(TEST_NOW);

    const session = makeSession(
      {
        lastActivityAt: new Date(
          now.getTime() - 2 * SESSION_POLICY.TOUCH_INTERVAL_MS
        ),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(session);
    touchSessionRecord.mockRejectedValue(new Error("Touch failed"));

    await expect(resolveSessionToken(VALID_TOKEN, { now })).rejects.toThrow(
      "Touch failed"
    );
  });

  it("propagates conditional revocation errors", async () => {
    const now = new Date(TEST_NOW);

    const expiredSession = makeSession(
      {
        lastActivityAt: new Date(now.getTime() - HOUR_MS),
        idleExpiresAt: now,
        absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
      },
      now
    );

    findSessionByTokenHash.mockResolvedValue(expiredSession);

    revokeExpiredSessionRecordById.mockRejectedValue(
      new Error("Conditional revocation failed")
    );

    await expect(resolveSessionToken(VALID_TOKEN, { now })).rejects.toThrow(
      "Conditional revocation failed"
    );
  });
});

// ============================================================================
// getActiveUserSessions
// ============================================================================

describe("getActiveUserSessions()", () => {
  it("returns active Sessions for the authenticated User", async () => {
    const now = new Date(TEST_NOW);

    const currentUser = makeUser();
    const freshUser = makeUser({
      _id: currentUser._id,
    });

    const sessions = [
      makeSession({
        _id: new mongoose.Types.ObjectId(),
      }),
      makeSession({
        _id: new mongoose.Types.ObjectId(),
      }),
    ];

    requireActiveAuthenticatedUser.mockResolvedValue(freshUser);
    findActiveSessionRecordsByUserId.mockResolvedValue(sessions);

    const result = await getActiveUserSessions({
      currentUser,
      now,
    });

    expect(result).toEqual(sessions);

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expect(findActiveSessionRecordsByUserId).toHaveBeenCalledOnce();
    expect(findActiveSessionRecordsByUserId).toHaveBeenCalledWith(
      freshUser._id,
      {
        sessionVersion: freshUser.sessionVersion,
        now,
      }
    );
  });

  it.each([
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "7",
    null,
    undefined,
  ])(
    "rejects a User with an invalid current sessionVersion: %s",
    async (sessionVersion) => {
      const currentUser = makeUser();

      const freshUser = makeUser({
        _id: currentUser._id,
        sessionVersion,
      });

      requireActiveAuthenticatedUser.mockResolvedValue(freshUser);

      await expect(
        getActiveUserSessions({
          currentUser,
          now: new Date(TEST_NOW),
        })
      ).rejects.toThrow("sessionVersion must be a non-negative safe integer.");

      expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
      expect(findActiveSessionRecordsByUserId).not.toHaveBeenCalled();
    }
  );

  it("rejects a User whose currentUser sessionVersion is stale", async () => {
    const now = new Date(TEST_NOW);

    const currentUser = makeUser({
      sessionVersion: TEST_SESSION_VERSION - 1,
    });

    const freshUser = makeUser({
      _id: currentUser._id,
      sessionVersion: TEST_SESSION_VERSION,
    });

    requireActiveAuthenticatedUser.mockResolvedValue(freshUser);

    await expectAppError(
      getActiveUserSessions({
        currentUser,
        now,
      }),
      ERROR_CODES.UNAUTHORIZED,
      401,
      "نشست کاربری شما معتبر نیست. لطفاً دوباره وارد شوید."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();

    expect(findActiveSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("propagates authentication guard errors without querying Session records", async () => {
    const guardError = new AppError(
      ERROR_CODES.FORBIDDEN,
      "Authentication required.",
      { statusCode: 403 }
    );

    requireActiveAuthenticatedUser.mockRejectedValue(guardError);

    await expectAppError(
      getActiveUserSessions({
        currentUser: makeUser(),
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.FORBIDDEN,
      403,
      "Authentication required."
    );

    expect(findActiveSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("rejects an invalid now before calling the authentication guard", async () => {
    const currentUser = makeUser();

    await expect(
      getActiveUserSessions({
        currentUser,
        now: new Date(Number.NaN),
      })
    ).rejects.toThrow("now must be a valid Date.");

    expect(requireActiveAuthenticatedUser).not.toHaveBeenCalled();

    expect(findActiveSessionRecordsByUserId).not.toHaveBeenCalled();
  });
});

// ============================================================================
// revokeSessionByToken
// ============================================================================

describe("revokeSessionByToken()", () => {
  it("revokes the Session associated with a valid raw token", async () => {
    const now = new Date(TEST_NOW);
    const session = makeSession({}, now);

    findSessionByTokenHash.mockResolvedValue(session);

    revokeSessionRecordById.mockResolvedValue(
      makeSession(
        {
          ...session,
          revokedAt: now,
        },
        now
      )
    );

    const result = await revokeSessionByToken(VALID_TOKEN, { now });

    expect(result).toBe(true);

    expect(findSessionByTokenHash).toHaveBeenCalledOnce();
    expect(findSessionByTokenHash).toHaveBeenCalledWith(hashToken(VALID_TOKEN));

    expect(revokeSessionRecordById).toHaveBeenCalledOnce();
    expect(revokeSessionRecordById).toHaveBeenCalledWith(session._id, {
      userId: session.userId,
      revokedAt: now,
    });
  });

  it.each([
    "malformed-token",
    "A".repeat(42),
    `${"A".repeat(43)}=`,
    NON_CANONICAL_TOKEN,
  ])(
    "returns false for a malformed token (%s) without querying the repository",
    async (token) => {
      const result = await revokeSessionByToken(token, {
        now: new Date(TEST_NOW),
      });

      expect(result).toBe(false);

      expect(findSessionByTokenHash).not.toHaveBeenCalled();
      expect(revokeSessionRecordById).not.toHaveBeenCalled();
    }
  );

  it("returns false when the token does not identify a stored Session", async () => {
    findSessionByTokenHash.mockResolvedValue(null);

    const result = await revokeSessionByToken(VALID_TOKEN, {
      now: new Date(TEST_NOW),
    });

    expect(result).toBe(false);
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
  });

  it("returns false for an already-revoked Session without changing revokedAt", async () => {
    const previousRevocation = new Date(TEST_NOW.getTime() - HOUR_MS);

    findSessionByTokenHash.mockResolvedValue(
      makeSession({
        revokedAt: previousRevocation,
      })
    );

    const result = await revokeSessionByToken(VALID_TOKEN, {
      now: new Date(TEST_NOW),
    });

    expect(result).toBe(false);
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
  });

  it("attempts to revoke a Session whose revokedAt field is missing, then returns false", async () => {
    const now = new Date(TEST_NOW);
    const session = makeSession({ revokedAt: undefined });

    findSessionByTokenHash.mockResolvedValue(session);

    const result = await revokeSessionByToken(VALID_TOKEN, { now });

    expect(result).toBe(false);

    expect(revokeSessionRecordById).toHaveBeenCalledOnce();

    expect(revokeSessionRecordById).toHaveBeenCalledWith(session._id, {
      userId: session.userId,
      revokedAt: now,
    });
  });

  it("returns false when the Session is revoked concurrently after it was read", async () => {
    const now = new Date(TEST_NOW);
    const session = makeSession({}, now);

    findSessionByTokenHash.mockResolvedValue(session);
    revokeSessionRecordById.mockResolvedValue(null);

    const result = await revokeSessionByToken(VALID_TOKEN, { now });

    expect(result).toBe(false);
    expect(revokeSessionRecordById).toHaveBeenCalledOnce();
  });

  it.each([
    {
      description: "a non-Date value",
      now: "invalid-date",
    },
    {
      description: "an invalid Date object",
      now: new Date(Number.NaN),
    },
  ])(
    "rejects $description as now before validating the token",
    async ({ now }) => {
      await expect(revokeSessionByToken(VALID_TOKEN, { now })).rejects.toThrow(
        "now must be a valid Date."
      );

      expect(findSessionByTokenHash).not.toHaveBeenCalled();
      expect(revokeSessionRecordById).not.toHaveBeenCalled();
    }
  );

  it("propagates Session lookup errors", async () => {
    findSessionByTokenHash.mockRejectedValue(
      new Error("Session lookup failed")
    );

    await expect(
      revokeSessionByToken(VALID_TOKEN, {
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("Session lookup failed");
  });

  it("propagates Session revocation errors", async () => {
    findSessionByTokenHash.mockResolvedValue(makeSession());

    revokeSessionRecordById.mockRejectedValue(
      new Error("Session revocation failed")
    );

    await expect(
      revokeSessionByToken(VALID_TOKEN, {
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("Session revocation failed");
  });
});

// ============================================================================
// revokeUserSession
// ============================================================================

describe("revokeUserSession()", () => {
  it.each([
    {
      description: "an ObjectId",
      sessionId: new mongoose.Types.ObjectId(),
    },
    {
      description: "a valid ObjectId string",
      sessionId: new mongoose.Types.ObjectId().toString(),
    },
  ])("revokes a Session using $description", async ({ sessionId }) => {
    const now = new Date(TEST_NOW);

    const currentUser = {
      id: "caller-object",
      role: "USER",
    };

    const authenticatedUser = makeUser({
      _id: new mongoose.Types.ObjectId(),
    });

    requireActiveAuthenticatedUser.mockResolvedValue(authenticatedUser);

    const result = await revokeUserSession({
      sessionId,
      currentUser,
      now,
    });

    expect(result).toBe(true);

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expect(revokeSessionRecordById).toHaveBeenCalledOnce();
    expect(revokeSessionRecordById).toHaveBeenCalledWith(sessionId, {
      userId: authenticatedUser._id,
      revokedAt: now,
    });
  });

  it("returns false when the target Session is missing or not owned by the User", async () => {
    const now = new Date(TEST_NOW);
    const currentUser = makeUser();
    const sessionId = new mongoose.Types.ObjectId();

    revokeSessionRecordById.mockResolvedValue(null);

    const result = await revokeUserSession({
      sessionId,
      currentUser,
      now,
    });

    expect(result).toBe(false);

    expect(revokeSessionRecordById).toHaveBeenCalledWith(sessionId, {
      userId: currentUser._id,
      revokedAt: now,
    });
  });

  it("rejects an invalid sessionId before calling the authentication guard", async () => {
    await expectAppError(
      revokeUserSession({
        sessionId: "invalid-session-id",
        currentUser: makeUser(),
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.INVALID_REQUEST,
      400,
      "شناسه session ID نامعتبر است."
    );

    expect(requireActiveAuthenticatedUser).not.toHaveBeenCalled();
    expect(revokeSessionRecordById).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a non-Date value",
      now: "invalid-date",
    },
    {
      description: "an invalid Date object",
      now: new Date(Number.NaN),
    },
  ])(
    "rejects $description as now before calling the authentication guard",
    async ({ now }) => {
      await expect(
        revokeUserSession({
          sessionId: TEST_SESSION_ID,
          currentUser: makeUser(),
          now,
        })
      ).rejects.toThrow("now must be a valid Date.");

      expect(requireActiveAuthenticatedUser).not.toHaveBeenCalled();
      expect(revokeSessionRecordById).not.toHaveBeenCalled();
    }
  );

  it("propagates authentication guard errors without attempting revocation", async () => {
    const guardError = new AppError(
      ERROR_CODES.FORBIDDEN,
      "Authentication required.",
      { statusCode: 403 }
    );

    requireActiveAuthenticatedUser.mockRejectedValue(guardError);

    await expectAppError(
      revokeUserSession({
        sessionId: TEST_SESSION_ID,
        currentUser: { _id: TEST_USER_ID },
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.FORBIDDEN,
      403,
      "Authentication required."
    );

    expect(revokeSessionRecordById).not.toHaveBeenCalled();
  });

  it("propagates Session repository errors", async () => {
    revokeSessionRecordById.mockRejectedValue(
      new Error("Session revocation failed")
    );

    await expect(
      revokeUserSession({
        sessionId: TEST_SESSION_ID,
        currentUser: makeUser(),
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("Session revocation failed");
  });
});

// ============================================================================
// revokeAllUserSessions
// ============================================================================

describe("revokeAllUserSessions()", () => {
  it("increments sessionVersion and revokes all unrevoked Session records using the transaction session", async () => {
    const now = new Date(TEST_NOW);

    const currentUser = makeUser();

    const freshUser = makeUser({
      _id: currentUser._id,
    });

    const modifiedCount = 3;

    requireActiveAuthenticatedUser.mockResolvedValue(freshUser);

    revokeSessionRecordsByUserId.mockResolvedValue({
      acknowledged: true,
      matchedCount: modifiedCount,
      modifiedCount,
    });

    const result = await revokeAllUserSessions({
      currentUser,
      now,
    });

    expect(result).toEqual({
      revokedCount: modifiedCount,
    });

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(
      currentUser,
      TEST_TRANSACTION_SESSION
    );

    expect(incrementUserSessionVersion).toHaveBeenCalledOnce();
    expect(incrementUserSessionVersion).toHaveBeenCalledWith(freshUser._id, {
      expectedSessionVersion: freshUser.sessionVersion,
      session: TEST_TRANSACTION_SESSION,
    });

    expect(revokeSessionRecordsByUserId).toHaveBeenCalledOnce();
    expect(revokeSessionRecordsByUserId).toHaveBeenCalledWith(freshUser._id, {
      revokedAt: now,
      session: TEST_TRANSACTION_SESSION,
    });

    expect(
      incrementUserSessionVersion.mock.invocationCallOrder[0]
    ).toBeLessThan(revokeSessionRecordsByUserId.mock.invocationCallOrder[0]);
  });

  it("rejects a User with an invalid current sessionVersion without modifying User or Sessions", async () => {
    const currentUser = makeUser();

    const freshUser = makeUser({
      _id: currentUser._id,
      sessionVersion: -1,
    });

    requireActiveAuthenticatedUser.mockResolvedValue(freshUser);

    await expect(
      revokeAllUserSessions({
        currentUser,
        now: new Date(TEST_NOW),
      })
    ).rejects.toThrow("sessionVersion must be a non-negative safe integer.");

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(incrementUserSessionVersion).not.toHaveBeenCalled();
    expect(revokeSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("rejects a User whose currentUser sessionVersion is stale without modifying User or Sessions", async () => {
    const now = new Date(TEST_NOW);

    const currentUser = makeUser({
      sessionVersion: TEST_SESSION_VERSION - 1,
    });

    const freshUser = makeUser({
      _id: currentUser._id,
      sessionVersion: TEST_SESSION_VERSION,
    });

    requireActiveAuthenticatedUser.mockResolvedValue(freshUser);

    await expectAppError(
      revokeAllUserSessions({
        currentUser,
        now,
      }),
      ERROR_CODES.UNAUTHORIZED,
      401,
      "نشست کاربری شما معتبر نیست. لطفاً دوباره وارد شوید."
    );

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(incrementUserSessionVersion).not.toHaveBeenCalled();
    expect(revokeSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("rejects a User whose sessionVersion has reached the maximum safe integer limit without modifying User or Sessions", async () => {
    const sessionVersion = Number.MAX_SAFE_INTEGER;

    const currentUser = makeUser({
      sessionVersion,
    });

    const freshUser = makeUser({
      _id: currentUser._id,
      sessionVersion,
    });

    requireActiveAuthenticatedUser.mockResolvedValue(freshUser);

    await expectAppError(
      revokeAllUserSessions({
        currentUser,
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      409,
      "امکان خروج از همه دستگاه‌ها در وضعیت فعلی وجود ندارد."
    );

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(incrementUserSessionVersion).not.toHaveBeenCalled();
    expect(revokeSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("rejects when the expected User sessionVersion no longer matches during increment", async () => {
    const now = new Date(TEST_NOW);

    const currentUser = makeUser();

    requireActiveAuthenticatedUser.mockResolvedValue(currentUser);

    incrementUserSessionVersion.mockResolvedValue(null);

    await expectAppError(
      revokeAllUserSessions({
        currentUser,
        now,
      }),
      ERROR_CODES.USER_LIFECYCLE_CONFLICT,
      409,
      "اطلاعات احراز هویت هم‌زمان تغییر کرده است. لطفاً دوباره تلاش کنید."
    );

    expect(incrementUserSessionVersion).toHaveBeenCalledOnce();

    expect(revokeSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("propagates Session repository errors from the transaction callback", async () => {
    const now = new Date(TEST_NOW);

    const currentUser = makeUser();

    const repositoryError = new Error("Session revocation failed");

    requireActiveAuthenticatedUser.mockResolvedValue(currentUser);

    revokeSessionRecordsByUserId.mockRejectedValue(repositoryError);

    await expect(
      revokeAllUserSessions({
        currentUser,
        now,
      })
    ).rejects.toBe(repositoryError);

    expect(incrementUserSessionVersion).toHaveBeenCalledOnce();
    expect(incrementUserSessionVersion).toHaveBeenCalledWith(currentUser._id, {
      expectedSessionVersion: currentUser.sessionVersion,
      session: TEST_TRANSACTION_SESSION,
    });

    expect(revokeSessionRecordsByUserId).toHaveBeenCalledOnce();
    expect(revokeSessionRecordsByUserId).toHaveBeenCalledWith(currentUser._id, {
      revokedAt: now,
      session: TEST_TRANSACTION_SESSION,
    });
  });

  it("propagates authentication guard errors without modifying User or Sessions", async () => {
    const guardError = new AppError(
      ERROR_CODES.FORBIDDEN,
      "Authentication required.",
      { statusCode: 403 }
    );

    requireActiveAuthenticatedUser.mockRejectedValue(guardError);

    await expectAppError(
      revokeAllUserSessions({
        currentUser: makeUser(),
        now: new Date(TEST_NOW),
      }),
      ERROR_CODES.FORBIDDEN,
      403,
      "Authentication required."
    );

    expect(incrementUserSessionVersion).not.toHaveBeenCalled();
    expect(revokeSessionRecordsByUserId).not.toHaveBeenCalled();
  });

  it("rejects an invalid now before starting the transaction", async () => {
    await expect(
      revokeAllUserSessions({
        currentUser: makeUser(),
        now: new Date(Number.NaN),
      })
    ).rejects.toThrow("now must be a valid Date.");

    expect(withTransaction).not.toHaveBeenCalled();

    expect(requireActiveAuthenticatedUser).not.toHaveBeenCalled();

    expect(incrementUserSessionVersion).not.toHaveBeenCalled();

    expect(revokeSessionRecordsByUserId).not.toHaveBeenCalled();
  });
});
