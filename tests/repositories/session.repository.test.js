import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import Session from "@/models/Session";

import { SESSION_POLICY } from "@/constants/session";
import { ERROR_CODES } from "@/constants/error-codes";

import {
  createSession,
  findSessionByTokenHash,
  findActiveSessionsByUserId,
  touchSession,
  revokeSessionById,
  revokeSessionsByUserId,
  revokeExpiredSessionById,
} from "@/repositories/session.repository";

/*
 * ============================================================================
 * Test Configuration and Helpers
 * ============================================================================
 */

const MINUTE_MS = 60 * 1000;

const HOUR_MS = 60 * MINUTE_MS;

const DAY_MS = 24 * HOUR_MS;

const SAFE_SESSION_RESULT_FIELDS = [
  "_id",
  "userId",
  "sessionVersion",
  "createdAt",
  "lastActivityAt",
  "idleExpiresAt",
  "absoluteExpiresAt",
  "revokedAt",
];

let mongoServer;

let tokenHashSequence = 0;

/**
 * Generate a unique, structurally valid SHA-256 hash fixture.
 *
 * These values are only used to satisfy the repository's hash format.
 * They are not actual hashes of browser tokens.
 */
function nextTokenHash() {
  tokenHashSequence += 1;

  return tokenHashSequence.toString(16).padStart(64, "0");
}

/**
 * Build valid Session creation data.
 *
 * Expiration dates use the centralized Session policy and remain in the
 * future relative to the real clock, preventing TTL cleanup from interfering
 * with tests that need to inspect persisted documents.
 */
function buildSessionData(overrides = {}) {
  const now = Date.now();

  return {
    userId: new mongoose.Types.ObjectId(),
    tokenHash: nextTokenHash(),
    sessionVersion: 0,
    lastActivityAt: new Date(now),
    idleExpiresAt: new Date(now + SESSION_POLICY.IDLE_TIMEOUT_MS),
    absoluteExpiresAt: new Date(now + SESSION_POLICY.ABSOLUTE_TIMEOUT_MS),
    ...overrides,
  };
}

/**
 * Persist a Session through Mongoose.
 *
 * Document validation middleware and schema defaults are applied.
 */
async function createStoredSession(overrides = {}) {
  return Session.create(buildSessionData(overrides));
}

/**
 * Insert a Session directly into MongoDB.
 *
 * This helper deliberately bypasses Mongoose validation middleware.
 * It is used only for testing repository filters against malformed
 * legacy/database records that could not be created through the Model.
 *
 * absoluteExpiresAt should remain in the real future to avoid TTL cleanup
 * interfering with the test.
 */
async function insertRawSession(overrides = {}) {
  const data = buildSessionData(overrides);

  const document = {
    _id: new mongoose.Types.ObjectId(),
    ...data,
    createdAt: new Date(),
    revokedAt: null,
  };

  await Session.collection.insertOne(document);

  return document;
}

/**
 * Build a Session whose activity is old enough to be touched.
 */
async function createTouchableSession(userId, now, overrides = {}) {
  return createStoredSession({
    userId,
    lastActivityAt: new Date(now.getTime() - 10 * MINUTE_MS),
    idleExpiresAt: new Date(now.getTime() + HOUR_MS),
    absoluteExpiresAt: new Date(now.getTime() + 10 * DAY_MS),
    ...overrides,
  });
}

/**
 * Build the common options passed to touchSession.
 */
function buildTouchOptions(session, now, overrides = {}) {
  return {
    userId: session.userId,
    sessionVersion: session.sessionVersion,
    touchIntervalMs: SESSION_POLICY.TOUCH_INTERVAL_MS,
    now,
    idleTimeoutMs: SESSION_POLICY.IDLE_TIMEOUT_MS,
    ...overrides,
  };
}

/**
 * Assert the temporal invariant required by the Session model.
 *
 * lastActivityAt < idleExpiresAt <= absoluteExpiresAt
 */
function expectValidExpiryRelationship(session) {
  expect(session.lastActivityAt.getTime()).toBeLessThan(
    session.idleExpiresAt.getTime()
  );

  expect(session.idleExpiresAt.getTime()).toBeLessThanOrEqual(
    session.absoluteExpiresAt.getTime()
  );
}

/**
 * Assert that a repository result is a safe plain Session object.
 *
 * The result must contain exactly the explicitly allowed fields.
 * Sensitive fields such as tokenHash must never be exposed.
 */
function expectSafeSessionResult(result) {
  expect(result).toBeDefined();
  expect(result).not.toBeNull();
  expect(result).not.toBeInstanceOf(mongoose.Document);

  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);

  expect(Object.keys(result).sort()).toEqual(
    [...SAFE_SESSION_RESULT_FIELDS].sort()
  );

  expect(result).not.toHaveProperty("tokenHash");
  expect(result).not.toHaveProperty("rawToken");
  expect(result).not.toHaveProperty("save");

  expect(result._id).toBeInstanceOf(mongoose.Types.ObjectId);
  expect(result.userId).toBeInstanceOf(mongoose.Types.ObjectId);

  expect(Number.isSafeInteger(result.sessionVersion)).toBe(true);
  expect(result.sessionVersion).toBeGreaterThanOrEqual(0);

  expectValidDate(result.createdAt);
  expectValidDate(result.lastActivityAt);
  expectValidDate(result.idleExpiresAt);
  expectValidDate(result.absoluteExpiresAt);

  expect(result.revokedAt === null || result.revokedAt instanceof Date).toBe(
    true
  );

  if (result.revokedAt instanceof Date) {
    expectValidDate(result.revokedAt);
  }
}

/**
 * Assert the application error used by assertValidObjectId.
 */
async function expectInvalidObjectId(promise) {
  await expect(promise).rejects.toMatchObject({
    code: ERROR_CODES.INVALID_REQUEST,
    statusCode: 400,
  });
}

function expectValidDate(value) {
  expect(value).toBeInstanceOf(Date);
  expect(Number.isFinite(value.getTime())).toBe(true);
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

  // Ensure unique, compound and TTL indexes are ready before tests run.
  await Session.init();
});

beforeEach(async () => {
  await Session.deleteMany({});

  tokenHashSequence = 0;
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
 * Create Session
 * ============================================================================
 */

describe("createSession", () => {
  it("creates a Session and returns a safe plain object", async () => {
    const sessionData = buildSessionData();

    const result = await createSession(sessionData);

    expectSafeSessionResult(result);
    expectValidExpiryRelationship(result);

    expect(result.userId.toString()).toBe(sessionData.userId.toString());
    expect(result.sessionVersion).toBe(sessionData.sessionVersion);

    expect(result.lastActivityAt.getTime()).toBe(
      sessionData.lastActivityAt.getTime()
    );

    expect(result.idleExpiresAt.getTime()).toBe(
      sessionData.idleExpiresAt.getTime()
    );

    expect(result.absoluteExpiresAt.getTime()).toBe(
      sessionData.absoluteExpiresAt.getTime()
    );

    expect(result.revokedAt).toBeNull();

    const persistedSession = await Session.findById(result._id).select(
      "+tokenHash"
    );

    expect(persistedSession).not.toBeNull();
    expect(persistedSession.tokenHash).toBe(sessionData.tokenHash);
  });

  it("rejects a duplicate tokenHash", async () => {
    const tokenHash = nextTokenHash();

    // The first Session should be created successfully.
    await createSession(buildSessionData({ tokenHash }));

    // A second Session with the same tokenHash must be rejected.
    await expect(
      createSession(buildSessionData({ tokenHash }))
    ).rejects.toMatchObject({
      code: 11000,
      keyPattern: {
        tokenHash: 1,
      },
    });

    // Only one Session with this tokenHash must exist.
    expect(await Session.countDocuments({ tokenHash })).toBe(1);
  });

  it("accepts a valid hexadecimal ObjectId string", async () => {
    const userId = new mongoose.Types.ObjectId();

    const sessionData = buildSessionData({
      userId: userId.toString(),
    });

    const result = await createSession(sessionData);

    expect(result.userId.toString()).toBe(userId.toString());
  });

  it.each(["token", "rawToken", "createdAt", "revokedAt", "updatedAt", "_id"])(
    "rejects unsupported creation field %s",
    async (field) => {
      const sessionData = buildSessionData({
        [field]: "unsupported-value",
      });

      await expect(createSession(sessionData)).rejects.toThrow(
        `Unsupported Session creation fields: ${field}.`
      );
    }
  );

  it.each([
    "userId",
    "tokenHash",
    "sessionVersion",
    "lastActivityAt",
    "idleExpiresAt",
    "absoluteExpiresAt",
  ])("requires creation field %s", async (field) => {
    const sessionData = buildSessionData();

    delete sessionData[field];

    await expect(createSession(sessionData)).rejects.toThrow(
      `Session creation field "${field}" is required`
    );
  });

  it.each([null, undefined, [], "session", 123, new Date()])(
    "rejects a non-object or non-plain input: %s",
    async (value) => {
      const expectedMessage =
        value instanceof Date
          ? "sessionData must be a plain object."
          : "sessionData must be an object.";

      await expect(createSession(value)).rejects.toThrow(expectedMessage);
    }
  );

  it("rejects a Mongoose Document as creation input", async () => {
    const document = new Session(buildSessionData());

    await expect(createSession(document)).rejects.toThrow(
      "sessionData must be a plain object"
    );
  });

  it("rejects a creation object containing a Symbol key", async () => {
    const sessionData = buildSessionData();

    sessionData[Symbol("rawToken")] = "secret";

    await expect(createSession(sessionData)).rejects.toThrow(
      "Unsupported Session creation fields"
    );
  });

  it("accepts a plain object with a null prototype", async () => {
    const source = buildSessionData();

    const sessionData = Object.assign(Object.create(null), source);

    const result = await createSession(sessionData);

    expectSafeSessionResult(result);
  });

  it("rejects an invalid userId", async () => {
    const sessionData = buildSessionData({
      userId: "invalid-user-id",
    });

    await expectInvalidObjectId(createSession(sessionData));
  });

  it.each([
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(64),
    "g".repeat(64),
    `${"a".repeat(63)} `,
    `${"a".repeat(64)}\n`,
  ])("rejects an invalid tokenHash: %s", async (tokenHash) => {
    const sessionData = buildSessionData({ tokenHash });

    await expect(createSession(sessionData)).rejects.toThrow(
      "tokenHash must be a 64-character lowercase SHA-256 hex string."
    );
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, "1"])(
    "rejects an invalid sessionVersion: %s",
    async (sessionVersion) => {
      const sessionData = buildSessionData({ sessionVersion });

      await expect(createSession(sessionData)).rejects.toThrow(
        "sessionVersion must be a non-negative safe integer."
      );
    }
  );

  it.each(["lastActivityAt", "idleExpiresAt", "absoluteExpiresAt"])(
    "rejects an invalid Date in %s",
    async (field) => {
      const sessionData = buildSessionData({
        [field]: new Date("invalid"),
      });

      await expect(createSession(sessionData)).rejects.toThrow(
        `${field} must be a valid Date.`
      );
    }
  );

  it("rejects idle expiry that is not later than last activity", async () => {
    const lastActivityAt = new Date();

    const sessionData = buildSessionData({
      lastActivityAt,
      idleExpiresAt: new Date(lastActivityAt.getTime()),
      absoluteExpiresAt: new Date(lastActivityAt.getTime() + DAY_MS),
    });

    await expect(createSession(sessionData)).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        idleExpiresAt: expect.anything(),
      },
    });
  });

  it("rejects idle expiry later than absolute expiry", async () => {
    const now = new Date();

    const sessionData = buildSessionData({
      lastActivityAt: new Date(now.getTime() - MINUTE_MS),
      idleExpiresAt: new Date(now.getTime() + 2 * DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
    });

    await expect(createSession(sessionData)).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        idleExpiresAt: expect.anything(),
      },
    });
  });

  it("participates in a supplied MongoDB transaction", async () => {
    const transaction = await mongoose.startSession();

    let createdSessionId;

    try {
      await expect(
        transaction.withTransaction(async () => {
          const result = await createSession(buildSessionData(), transaction);

          createdSessionId = result._id;

          const visibleInsideTransaction =
            await Session.findById(createdSessionId).session(transaction);

          expect(visibleInsideTransaction).not.toBeNull();

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      const persistedSession = await Session.findById(createdSessionId);

      expect(persistedSession).toBeNull();
    } finally {
      await transaction.endSession();
    }
  });
});

/*
 * ============================================================================
 * Read: findSessionByTokenHash
 * ============================================================================
 */

describe("findSessionByTokenHash", () => {
  it("finds a Session by tokenHash and returns a safe plain object", async () => {
    const session = await createStoredSession();

    const result = await findSessionByTokenHash(session.tokenHash);

    expectSafeSessionResult(result);

    expect(result._id.toString()).toBe(session._id.toString());
    expect(result.userId.toString()).toBe(session.userId.toString());
  });

  it("returns null when the token hash does not exist", async () => {
    const result = await findSessionByTokenHash(nextTokenHash());

    expect(result).toBeNull();
  });

  it.each([
    "invalid",
    "a".repeat(63),
    "A".repeat(64),
    "g".repeat(64),
    `${"a".repeat(64)}\n`,
    null,
    undefined,
  ])("rejects an invalid tokenHash: %s", async (tokenHash) => {
    await expect(findSessionByTokenHash(tokenHash)).rejects.toThrow(
      "tokenHash must be a 64-character lowercase SHA-256 hex string."
    );
  });

  it("reads a Session created inside a supplied transaction", async () => {
    const transaction = await mongoose.startSession();

    const sessionData = buildSessionData();

    try {
      await expect(
        transaction.withTransaction(async () => {
          await createSession(sessionData, transaction);

          const result = await findSessionByTokenHash(
            sessionData.tokenHash,
            transaction
          );

          expectSafeSessionResult(result);

          expect(result.userId.toString()).toBe(sessionData.userId.toString());

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      expect(
        await Session.exists({ tokenHash: sessionData.tokenHash })
      ).toBeNull();
    } finally {
      await transaction.endSession();
    }
  });
});

/*
 * ============================================================================
 * Read: findActiveSessionsByUserId
 * ============================================================================
 */

describe("findActiveSessionsByUserId", () => {
  it("returns only usable Sessions matching the User and current version", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const activeSession = await createStoredSession({
      userId,
      sessionVersion: 4,
    });

    // Old session version.
    await createStoredSession({
      userId,
      sessionVersion: 3,
    });

    // Different User.
    await createStoredSession({
      userId: new mongoose.Types.ObjectId(),
      sessionVersion: 4,
    });

    // Revoked Session.
    await createStoredSession({
      userId,
      sessionVersion: 4,
      revokedAt: new Date(),
    });

    // Idle-expired Session.
    await createStoredSession({
      userId,
      sessionVersion: 4,
      lastActivityAt: new Date(now.getTime() - 2 * HOUR_MS),
      idleExpiresAt: new Date(now.getTime() - HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 4,
      now,
    });

    expect(results).toHaveLength(1);
    expectSafeSessionResult(results[0]);

    expect(results[0]._id.toString()).toBe(activeSession._id.toString());
  });

  it("rejects an invalid userId", async () => {
    await expectInvalidObjectId(
      findActiveSessionsByUserId("invalid-user-id", {
        sessionVersion: 0,
      })
    );
  });

  it.each([-1, 1.5, Infinity, NaN, "1"])(
    "rejects an invalid sessionVersion: %s",
    async (sessionVersion) => {
      await expect(
        findActiveSessionsByUserId(new mongoose.Types.ObjectId(), {
          sessionVersion,
        })
      ).rejects.toThrow("sessionVersion must be a non-negative safe integer.");
    }
  );

  it("rejects an invalid now value", async () => {
    await expect(
      findActiveSessionsByUserId(new mongoose.Types.ObjectId(), {
        sessionVersion: 0,
        now: "not-a-date",
      })
    ).rejects.toThrow("now must be a valid Date.");
  });

  it("does not return a Session whose idle expiry is exactly now", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      sessionVersion: 2,
      lastActivityAt: new Date(now.getTime() - MINUTE_MS),
      idleExpiresAt: now,
      absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
    });

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 2,
      now,
    });

    expect(results).toEqual([]);

    // The document must still exist; the repository should exclude it,
    // not delete it.
    expect(await Session.exists({ _id: session._id })).not.toBeNull();
  });

  it("allows a lastActivityAt within the configured clock-skew tolerance", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const accepted = await createStoredSession({
      userId,
      sessionVersion: 2,
      lastActivityAt: new Date(
        now.getTime() + SESSION_POLICY.MAX_CLOCK_SKEW_MS
      ),
      idleExpiresAt: new Date(now.getTime() + DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    await createStoredSession({
      userId,
      sessionVersion: 2,
      lastActivityAt: new Date(
        now.getTime() + SESSION_POLICY.MAX_CLOCK_SKEW_MS + 1
      ),
      idleExpiresAt: new Date(now.getTime() + DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 2,
      now,
    });

    expect(results).toHaveLength(1);
    expect(results[0]._id.toString()).toBe(accepted._id.toString());
  });

  it("does not return a Session after both idle and absolute expiry", async () => {
    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      sessionVersion: 2,
    });

    // The stored absoluteExpiresAt remains in the real future.
    // Simulate a time beyond its absolute lifetime without allowing
    // MongoDB's TTL monitor to remove the document.
    const futureNow = new Date(session.absoluteExpiresAt.getTime() + 1);

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 2,
      now: futureNow,
    });

    expect(results).toEqual([]);

    // Under the Session invariant, idle expiry must also have passed
    // whenever absolute expiry has passed.
    expect(await Session.exists({ _id: session._id })).not.toBeNull();
  });

  it("excludes a Session with an invalid lastActivityAt-to-idleExpiresAt relationship", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const malformedSession = await insertRawSession({
      userId,
      sessionVersion: 2,

      // Both dates are within the permitted query bounds, but idle expiry
      // incorrectly precedes the last activity timestamp.
      lastActivityAt: new Date(now.getTime() + 10 * 1000),
      idleExpiresAt: new Date(now.getTime() + 5 * 1000),
      absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
    });

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 2,
      now,
    });

    expect(results).toEqual([]);

    expect(await Session.exists({ _id: malformedSession._id })).not.toBeNull();
  });

  it("excludes a Session whose idle expiry exceeds its absolute expiry", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    await insertRawSession({
      userId,
      sessionVersion: 2,
      lastActivityAt: new Date(now.getTime() - MINUTE_MS),
      idleExpiresAt: new Date(now.getTime() + 2 * DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
    });

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 2,
      now,
    });

    expect(results).toEqual([]);
  });

  it("sorts Sessions by createdAt descending and then _id descending", async () => {
    const userId = new mongoose.Types.ObjectId();

    const now = new Date();

    const oldCreatedAt = new Date(now.getTime() - 20 * MINUTE_MS);
    const tiedCreatedAt = new Date(now.getTime() - 10 * MINUTE_MS);
    const newestCreatedAt = new Date(now.getTime() - 5 * MINUTE_MS);

    const older = await createStoredSession({
      userId,
      _id: new mongoose.Types.ObjectId("000000000000000000000001"),
      createdAt: oldCreatedAt,
    });

    const tiedFirst = await createStoredSession({
      userId,
      _id: new mongoose.Types.ObjectId("000000000000000000000002"),
      createdAt: tiedCreatedAt,
    });

    const tiedSecond = await createStoredSession({
      userId,
      _id: new mongoose.Types.ObjectId("000000000000000000000003"),
      createdAt: tiedCreatedAt,
    });

    const newest = await createStoredSession({
      userId,
      _id: new mongoose.Types.ObjectId("000000000000000000000004"),
      createdAt: newestCreatedAt,
    });

    const results = await findActiveSessionsByUserId(userId, {
      sessionVersion: 0,
      now,
    });

    const expectedIds = [newest, tiedSecond, tiedFirst, older].map((session) =>
      session._id.toString()
    );

    expect(results.map((item) => item._id.toString())).toEqual(expectedIds);
  });

  it("returns an empty array when the User has no active Sessions", async () => {
    const results = await findActiveSessionsByUserId(
      new mongoose.Types.ObjectId(),
      {
        sessionVersion: 0,
      }
    );

    expect(results).toEqual([]);
  });

  it("reads Sessions created inside a supplied transaction", async () => {
    const transaction = await mongoose.startSession();

    const now = new Date();
    const userId = new mongoose.Types.ObjectId();

    const sessionData = buildSessionData({
      userId,
      sessionVersion: 2,
      lastActivityAt: new Date(now.getTime() - MINUTE_MS),
      idleExpiresAt: new Date(now.getTime() + DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    try {
      await expect(
        transaction.withTransaction(async () => {
          await createSession(sessionData, transaction);

          const results = await findActiveSessionsByUserId(userId, {
            sessionVersion: 2,
            now,
            session: transaction,
          });

          expect(results).toHaveLength(1);
          expectSafeSessionResult(results[0]);

          expect(results[0].userId.toString()).toBe(userId.toString());

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      expect(await Session.countDocuments({ userId })).toBe(0);
    } finally {
      await transaction.endSession();
    }
  });
});

/*
 * ============================================================================
 * Update activity: touchSession
 * ============================================================================
 */

describe("touchSession", () => {
  it("updates lastActivityAt and refreshes idle expiry", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, now);

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now)
    );

    expectSafeSessionResult(result);
    expectValidExpiryRelationship(result);

    expect(result.lastActivityAt.getTime()).toBe(now.getTime());

    expect(result.idleExpiresAt.getTime()).toBe(
      now.getTime() + SESSION_POLICY.IDLE_TIMEOUT_MS
    );

    expect(result.absoluteExpiresAt.getTime()).toBe(
      session.absoluteExpiresAt.getTime()
    );

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.lastActivityAt.getTime()).toBe(now.getTime());

    expect(persistedSession.idleExpiresAt.getTime()).toBe(
      now.getTime() + SESSION_POLICY.IDLE_TIMEOUT_MS
    );

    expectValidExpiryRelationship(persistedSession);
  });

  it("does not shorten an existing idle expiry", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const existingIdleExpiry = new Date(now.getTime() + 2 * DAY_MS);

    const session = await createTouchableSession(userId, now, {
      idleExpiresAt: existingIdleExpiry,
      absoluteExpiresAt: new Date(now.getTime() + 10 * DAY_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        idleTimeoutMs: DAY_MS,
      })
    );

    expectSafeSessionResult(result);
    expectValidExpiryRelationship(result);

    expect(result.idleExpiresAt.getTime()).toBe(existingIdleExpiry.getTime());
  });

  it("caps the new idle expiry at absoluteExpiresAt", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const absoluteExpiresAt = new Date(now.getTime() + 2 * DAY_MS);

    const session = await createTouchableSession(userId, now, {
      idleExpiresAt: new Date(now.getTime() + HOUR_MS),
      absoluteExpiresAt,
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        idleTimeoutMs: 30 * DAY_MS,
      })
    );

    expectSafeSessionResult(result);
    expectValidExpiryRelationship(result);

    expect(result.idleExpiresAt.getTime()).toBe(absoluteExpiresAt.getTime());
  });

  it("does not touch a Session before the touch interval has elapsed", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - MINUTE_MS),
      idleExpiresAt: new Date(now.getTime() + DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        touchIntervalMs: 5 * MINUTE_MS,
      })
    );

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.lastActivityAt.getTime()).toBe(
      session.lastActivityAt.getTime()
    );

    expect(persistedSession.idleExpiresAt.getTime()).toBe(
      session.idleExpiresAt.getTime()
    );
  });

  it("touches a Session when the touch interval has elapsed exactly", async () => {
    const now = new Date();
    const userId = new mongoose.Types.ObjectId();
    const touchIntervalMs = 5 * MINUTE_MS;

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - touchIntervalMs),
      idleExpiresAt: new Date(now.getTime() + HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 10 * DAY_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        touchIntervalMs,
      })
    );

    expectSafeSessionResult(result);
    expectValidExpiryRelationship(result);

    expect(result.lastActivityAt.getTime()).toBe(now.getTime());
  });

  it("does not touch a revoked Session", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, now, {
      revokedAt: new Date(now.getTime() - MINUTE_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now)
    );

    expect(result).toBeNull();
  });

  it("does not touch a Session owned by another User", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, now);

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        userId: new mongoose.Types.ObjectId(),
      })
    );

    expect(result).toBeNull();
  });

  it("does not touch a Session with a different sessionVersion", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, now, {
      sessionVersion: 3,
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        sessionVersion: 4,
      })
    );

    expect(result).toBeNull();
  });

  it("does not touch a Session whose idle expiry has passed", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - 2 * HOUR_MS),
      idleExpiresAt: new Date(now.getTime() - HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now)
    );

    expect(result).toBeNull();
  });

  it("does not touch a Session after both idle and absolute expiry", async () => {
    const realNow = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, realNow);

    // The simulated time is beyond the absolute lifetime.
    // Because idleExpiresAt cannot exceed absoluteExpiresAt in a valid
    // Session, its idle expiry has also passed at this point.
    // The stored absoluteExpiresAt remains in the real future.
    const futureNow = new Date(session.absoluteExpiresAt.getTime() + 1);

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, futureNow)
    );

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.lastActivityAt.getTime()).toBe(
      session.lastActivityAt.getTime()
    );

    expect(persistedSession.idleExpiresAt.getTime()).toBe(
      session.idleExpiresAt.getTime()
    );
  });

  it("does not touch a Session whose last activity is in the future", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() + 1000),
      idleExpiresAt: new Date(now.getTime() + DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now, {
        // Disable the touch interval so the future timestamp is the reason
        // the repository rejects this update.
        touchIntervalMs: 0,
      })
    );

    expect(result).toBeNull();
  });

  it("does not touch a Session whose idle expiry exceeds absolute expiry", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const malformedSession = await insertRawSession({
      userId,
      sessionVersion: 0,
      lastActivityAt: new Date(now.getTime() - 10 * MINUTE_MS),
      idleExpiresAt: new Date(now.getTime() + 2 * DAY_MS),
      absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
    });

    const result = await touchSession(
      malformedSession._id,
      buildTouchOptions(malformedSession, now)
    );

    expect(result).toBeNull();

    const persistedSession = await Session.findById(malformedSession._id);

    expect(persistedSession.lastActivityAt.getTime()).toBe(
      malformedSession.lastActivityAt.getTime()
    );

    expect(persistedSession.idleExpiresAt.getTime()).toBe(
      malformedSession.idleExpiresAt.getTime()
    );
  });

  it("allows only one concurrent touch for the same interval", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, now);

    const options = buildTouchOptions(session, now, {
      touchIntervalMs: 5 * MINUTE_MS,
    });

    const results = await Promise.all([
      touchSession(session._id, options),
      touchSession(session._id, options),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);

    expect(results.filter((result) => result === null)).toHaveLength(1);

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.lastActivityAt.getTime()).toBe(now.getTime());

    expectValidExpiryRelationship(persistedSession);
  });

  it("does not touch a Session whose idle expiry is exactly now", async () => {
    const now = new Date();
    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - HOUR_MS),
      idleExpiresAt: now,
      absoluteExpiresAt: new Date(now.getTime() + DAY_MS),
    });

    const result = await touchSession(
      session._id,
      buildTouchOptions(session, now)
    );

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt).toBeNull();
    expect(persistedSession.lastActivityAt.getTime()).toBe(
      session.lastActivityAt.getTime()
    );
    expect(persistedSession.idleExpiresAt.getTime()).toBe(now.getTime());
  });

  it("rejects an invalid sessionId", async () => {
    await expectInvalidObjectId(
      touchSession("invalid-session-id", {
        userId: new mongoose.Types.ObjectId(),
        sessionVersion: 0,
        idleTimeoutMs: DAY_MS,
      })
    );
  });

  it("rejects an invalid userId", async () => {
    await expectInvalidObjectId(
      touchSession(new mongoose.Types.ObjectId(), {
        userId: "invalid-user-id",
        sessionVersion: 0,
        idleTimeoutMs: DAY_MS,
      })
    );
  });

  it("rejects idleTimeoutMs when the resulting expiry is an invalid Date", async () => {
    await expect(
      touchSession(new mongoose.Types.ObjectId(), {
        userId: new mongoose.Types.ObjectId(),
        sessionVersion: 0,
        now: new Date(),
        idleTimeoutMs: Number.MAX_SAFE_INTEGER,
        touchIntervalMs: 0,
      })
    ).rejects.toThrow("candidateIdleExpiresAt must be a valid Date.");
  });

  it("rejects touchIntervalMs when the resulting minimum activity date is invalid", async () => {
    await expect(
      touchSession(new mongoose.Types.ObjectId(), {
        userId: new mongoose.Types.ObjectId(),
        sessionVersion: 0,
        now: new Date(),
        idleTimeoutMs: DAY_MS,
        touchIntervalMs: Number.MAX_SAFE_INTEGER,
      })
    ).rejects.toThrow("minimumLastActivityAt must be a valid Date.");
  });

  it.each([-1, 1.5, Infinity, NaN])(
    "rejects an invalid sessionVersion: %s",
    async (sessionVersion) => {
      await expect(
        touchSession(new mongoose.Types.ObjectId(), {
          userId: new mongoose.Types.ObjectId(),
          sessionVersion,
          idleTimeoutMs: DAY_MS,
        })
      ).rejects.toThrow("sessionVersion must be a non-negative safe integer.");
    }
  );

  it("rejects an invalid now value", async () => {
    await expect(
      touchSession(new mongoose.Types.ObjectId(), {
        userId: new mongoose.Types.ObjectId(),
        sessionVersion: 0,
        now: "invalid-date",
        idleTimeoutMs: DAY_MS,
      })
    ).rejects.toThrow("now must be a valid Date.");
  });

  it.each([0, -1, 1.5, Infinity, NaN, "1", null])(
    "rejects an invalid idleTimeoutMs: %s",
    async (idleTimeoutMs) => {
      await expect(
        touchSession(new mongoose.Types.ObjectId(), {
          userId: new mongoose.Types.ObjectId(),
          sessionVersion: 0,
          idleTimeoutMs,
        })
      ).rejects.toThrow("idleTimeoutMs must be a positive safe integer.");
    }
  );

  it.each([-1, 1.5, Infinity, NaN, "1", null])(
    "rejects an invalid touchIntervalMs: %s",
    async (touchIntervalMs) => {
      await expect(
        touchSession(new mongoose.Types.ObjectId(), {
          userId: new mongoose.Types.ObjectId(),
          sessionVersion: 0,
          idleTimeoutMs: DAY_MS,
          touchIntervalMs,
        })
      ).rejects.toThrow("touchIntervalMs must be a non-negative safe integer.");
    }
  );

  it("participates in a supplied MongoDB transaction", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, now);

    const originalLastActivityAt = session.lastActivityAt.getTime();

    const originalIdleExpiresAt = session.idleExpiresAt.getTime();

    const transaction = await mongoose.startSession();

    try {
      await expect(
        transaction.withTransaction(async () => {
          const result = await touchSession(
            session._id,
            buildTouchOptions(session, now, {
              session: transaction,
            })
          );

          expectSafeSessionResult(result);
          expectValidExpiryRelationship(result);

          expect(result.lastActivityAt.getTime()).toBe(now.getTime());

          const visibleInsideTransaction = await Session.findById(
            session._id
          ).session(transaction);

          expect(visibleInsideTransaction.lastActivityAt.getTime()).toBe(
            now.getTime()
          );

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      const persistedSession = await Session.findById(session._id);

      // The update must not remain after the transaction is rolled back.
      expect(persistedSession.lastActivityAt.getTime()).toBe(
        originalLastActivityAt
      );

      expect(persistedSession.idleExpiresAt.getTime()).toBe(
        originalIdleExpiresAt
      );
    } finally {
      await transaction.endSession();
    }
  });
});

/*
 * ============================================================================
 * Revoke: revokeSessionById
 * ============================================================================
 */

describe("revokeSessionById", () => {
  it("revokes an unrevoked Session owned by the specified User", async () => {
    const userId = new mongoose.Types.ObjectId();

    const revokedAt = new Date();

    const session = await createStoredSession({ userId });

    const result = await revokeSessionById(session._id, {
      userId,
      revokedAt,
    });

    expectSafeSessionResult(result);

    expect(result.revokedAt.getTime()).toBe(revokedAt.getTime());

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt.getTime()).toBe(revokedAt.getTime());
  });

  it("does not revoke a Session owned by another User", async () => {
    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({ userId });

    const result = await revokeSessionById(session._id, {
      userId: new mongoose.Types.ObjectId(),
    });

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt).toBeNull();
  });

  it("does not modify an already revoked Session", async () => {
    const userId = new mongoose.Types.ObjectId();

    const originalRevokedAt = new Date(Date.now() - HOUR_MS);

    const session = await createStoredSession({
      userId,
      revokedAt: originalRevokedAt,
    });

    const result = await revokeSessionById(session._id, {
      userId,
      revokedAt: new Date(),
    });

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt.getTime()).toBe(
      originalRevokedAt.getTime()
    );
  });

  it("returns null for a missing Session", async () => {
    const result = await revokeSessionById(new mongoose.Types.ObjectId(), {
      userId: new mongoose.Types.ObjectId(),
    });

    expect(result).toBeNull();
  });

  it("rejects an invalid sessionId", async () => {
    await expectInvalidObjectId(
      revokeSessionById("invalid-session-id", {
        userId: new mongoose.Types.ObjectId(),
      })
    );
  });

  it("rejects an invalid userId", async () => {
    await expectInvalidObjectId(
      revokeSessionById(new mongoose.Types.ObjectId(), {
        userId: "invalid-user-id",
      })
    );
  });

  it("rejects an invalid revokedAt value", async () => {
    await expect(
      revokeSessionById(new mongoose.Types.ObjectId(), {
        userId: new mongoose.Types.ObjectId(),
        revokedAt: "invalid-date",
      })
    ).rejects.toThrow("revokedAt must be a valid Date.");
  });

  it("participates in a supplied MongoDB transaction", async () => {
    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({ userId });

    const revokedAt = new Date();

    const transaction = await mongoose.startSession();

    try {
      await expect(
        transaction.withTransaction(async () => {
          const result = await revokeSessionById(session._id, {
            userId,
            revokedAt,
            session: transaction,
          });

          expectSafeSessionResult(result);

          expect(result.revokedAt.getTime()).toBe(revokedAt.getTime());

          const visibleInsideTransaction = await Session.findById(
            session._id
          ).session(transaction);

          expect(visibleInsideTransaction.revokedAt.getTime()).toBe(
            revokedAt.getTime()
          );

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      const persistedSession = await Session.findById(session._id);

      expect(persistedSession.revokedAt).toBeNull();
    } finally {
      await transaction.endSession();
    }
  });
});

/*
 * ============================================================================
 * Revoke: revokeSessionsByUserId
 * ============================================================================
 */

describe("revokeSessionsByUserId", () => {
  it("revokes all unrevoked Sessions belonging to the User", async () => {
    const userId = new mongoose.Types.ObjectId();

    const otherUserId = new mongoose.Types.ObjectId();

    const revokedAt = new Date();

    const first = await createStoredSession({ userId });

    const second = await createStoredSession({ userId });

    const alreadyRevoked = await createStoredSession({
      userId,
      revokedAt: new Date(Date.now() - HOUR_MS),
    });

    const otherUserSession = await createStoredSession({
      userId: otherUserId,
    });

    const result = await revokeSessionsByUserId(userId, {
      revokedAt,
    });

    expect(result).toMatchObject({
      acknowledged: true,
      matchedCount: 2,
      modifiedCount: 2,
    });

    const persistedSessions = await Session.find({
      _id: {
        $in: [first._id, second._id, alreadyRevoked._id, otherUserSession._id],
      },
    });

    const byId = new Map(
      persistedSessions.map((item) => [item._id.toString(), item])
    );

    expect(byId.get(first._id.toString()).revokedAt.getTime()).toBe(
      revokedAt.getTime()
    );

    expect(byId.get(second._id.toString()).revokedAt.getTime()).toBe(
      revokedAt.getTime()
    );

    expect(byId.get(alreadyRevoked._id.toString()).revokedAt.getTime()).toBe(
      alreadyRevoked.revokedAt.getTime()
    );

    expect(byId.get(otherUserSession._id.toString()).revokedAt).toBeNull();
  });

  it("also revokes expired Sessions whose documents still exist", async () => {
    const userId = new mongoose.Types.ObjectId();

    const now = new Date();

    const expiredSession = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - 2 * HOUR_MS),
      idleExpiresAt: new Date(now.getTime() - HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const revokedAt = new Date();

    const result = await revokeSessionsByUserId(userId, {
      revokedAt,
    });

    expect(result.matchedCount).toBe(1);
    expect(result.modifiedCount).toBe(1);

    const persistedSession = await Session.findById(expiredSession._id);

    expect(persistedSession.revokedAt.getTime()).toBe(revokedAt.getTime());
  });

  it("returns zero counts when the User has no unrevoked Sessions", async () => {
    const result = await revokeSessionsByUserId(new mongoose.Types.ObjectId());

    expect(result).toMatchObject({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
    });
  });

  it("rejects an invalid userId", async () => {
    await expectInvalidObjectId(revokeSessionsByUserId("invalid-user-id"));
  });

  it("rejects when revokedAt is invalid", async () => {
    await expect(
      revokeSessionsByUserId(new mongoose.Types.ObjectId(), {
        revokedAt: "invalid-date",
      })
    ).rejects.toThrow("revokedAt must be a valid Date.");
  });

  it("participates in a supplied MongoDB transaction", async () => {
    const userId = new mongoose.Types.ObjectId();
    const revokedAt = new Date();

    const session = await createStoredSession({ userId });

    const transaction = await mongoose.startSession();

    try {
      await expect(
        transaction.withTransaction(async () => {
          const result = await revokeSessionsByUserId(userId, {
            revokedAt,
            session: transaction,
          });

          expect(result).toMatchObject({
            acknowledged: true,
            matchedCount: 1,
            modifiedCount: 1,
          });

          const visibleInsideTransaction = await Session.findById(
            session._id
          ).session(transaction);

          expect(visibleInsideTransaction).not.toBeNull();

          expect(visibleInsideTransaction.revokedAt.getTime()).toBe(
            revokedAt.getTime()
          );

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      const persistedSession = await Session.findById(session._id);

      expect(persistedSession).not.toBeNull();
      expect(persistedSession.revokedAt).toBeNull();
    } finally {
      await transaction.endSession();
    }
  });
});

/*
 * ============================================================================
 * Revoke: revokeExpiredSessionById
 * ============================================================================
 */

describe("revokeExpiredSessionById", () => {
  it("revokes a Session whose idle expiry has passed", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - 2 * HOUR_MS),
      idleExpiresAt: new Date(now.getTime() - HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const result = await revokeExpiredSessionById(session._id, {
      userId,
      now,
    });

    expectSafeSessionResult(result);

    expect(result.revokedAt.getTime()).toBe(now.getTime());

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt.getTime()).toBe(now.getTime());
  });

  it("revokes a Session whose idle expiry is exactly now", async () => {
    const now = new Date();
    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - HOUR_MS),
      idleExpiresAt: now,
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const result = await revokeExpiredSessionById(session._id, {
      userId,
      now,
    });

    expectSafeSessionResult(result);

    expect(result.revokedAt.getTime()).toBe(now.getTime());

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt.getTime()).toBe(now.getTime());
  });

  it("revokes a Session whose absolute expiry is exactly now", async () => {
    const realNow = new Date();

    const userId = new mongoose.Types.ObjectId();

    const absoluteExpiresAt = new Date(
      realNow.getTime() + SESSION_POLICY.ABSOLUTE_TIMEOUT_MS
    );

    // Deliberately violate the expiry invariant to isolate the
    // absolute-expiry branch of the repository's $or condition.
    //
    // idleExpiresAt remains later than simulatedNow, while
    // absoluteExpiresAt is exactly equal to simulatedNow.
    //
    // absoluteExpiresAt remains in the real future, preventing
    // MongoDB's TTL monitor from interfering with this test.
    const session = await insertRawSession({
      userId,
      lastActivityAt: new Date(realNow.getTime() - HOUR_MS),
      idleExpiresAt: new Date(absoluteExpiresAt.getTime() + DAY_MS),
      absoluteExpiresAt,
    });

    const simulatedNow = new Date(absoluteExpiresAt.getTime());

    const result = await revokeExpiredSessionById(session._id, {
      userId,
      now: simulatedNow,
    });

    expectSafeSessionResult(result);

    expect(result.revokedAt.getTime()).toBe(simulatedNow.getTime());

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession).not.toBeNull();

    expect(persistedSession.revokedAt.getTime()).toBe(simulatedNow.getTime());
  });

  it("does not revoke a Session that has not expired", async () => {
    const userId = new mongoose.Types.ObjectId();

    const now = new Date();

    const session = await createStoredSession({ userId });

    const result = await revokeExpiredSessionById(session._id, {
      userId,
      now,
    });

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt).toBeNull();
  });

  it("does not revoke an already revoked Session", async () => {
    const userId = new mongoose.Types.ObjectId();

    const now = new Date();

    const originalRevokedAt = new Date(now.getTime() - HOUR_MS);

    const session = await createStoredSession({
      userId,
      revokedAt: originalRevokedAt,
      lastActivityAt: new Date(now.getTime() - 2 * HOUR_MS),
      idleExpiresAt: new Date(now.getTime() - HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const result = await revokeExpiredSessionById(session._id, {
      userId,
      now,
    });

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt.getTime()).toBe(
      originalRevokedAt.getTime()
    );
  });

  it("does not revoke a Session owned by another User", async () => {
    const userId = new mongoose.Types.ObjectId();

    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(Date.now() - 2 * HOUR_MS),
      idleExpiresAt: new Date(Date.now() - HOUR_MS),
      absoluteExpiresAt: new Date(Date.now() + 30 * DAY_MS),
    });

    const result = await revokeExpiredSessionById(session._id, {
      userId: new mongoose.Types.ObjectId(),
      now: new Date(),
    });

    expect(result).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt).toBeNull();
  });

  it("does not revoke a Session that was refreshed after a stale expiry read", async () => {
    const baseNow = new Date();

    const userId = new mongoose.Types.ObjectId();

    const session = await createTouchableSession(userId, baseNow, {
      idleExpiresAt: new Date(baseNow.getTime() + 5 * MINUTE_MS),
      absoluteExpiresAt: new Date(baseNow.getTime() + 30 * DAY_MS),
    });

    // Simulate a successful activity refresh before an older expiry
    // check reaches MongoDB.
    const touchNow = new Date(baseNow.getTime() + 4 * MINUTE_MS);

    const touchedSession = await touchSession(
      session._id,
      buildTouchOptions(session, touchNow, {
        touchIntervalMs: MINUTE_MS,
        idleTimeoutMs: DAY_MS,
      })
    );

    expect(touchedSession).not.toBeNull();

    expectValidExpiryRelationship(touchedSession);

    // The old idle expiry has passed, but the updated expiry has not.
    const staleNow = new Date(baseNow.getTime() + 6 * MINUTE_MS);

    // The original idle expiry has passed.
    expect(session.idleExpiresAt.getTime()).toBeLessThanOrEqual(
      staleNow.getTime()
    );

    // The refreshed idle expiry is still in the future.
    expect(touchedSession.idleExpiresAt.getTime()).toBeGreaterThan(
      staleNow.getTime()
    );

    const revokeResult = await revokeExpiredSessionById(session._id, {
      userId,
      now: staleNow,
    });

    expect(revokeResult).toBeNull();

    const persistedSession = await Session.findById(session._id);

    expect(persistedSession.revokedAt).toBeNull();

    expect(persistedSession.idleExpiresAt.getTime()).toBe(
      touchedSession.idleExpiresAt.getTime()
    );

    expectValidExpiryRelationship(persistedSession);
  });

  it("returns null for a missing Session", async () => {
    const result = await revokeExpiredSessionById(
      new mongoose.Types.ObjectId(),
      {
        userId: new mongoose.Types.ObjectId(),
        now: new Date(),
      }
    );

    expect(result).toBeNull();
  });

  it("rejects an invalid sessionId", async () => {
    await expectInvalidObjectId(
      revokeExpiredSessionById("invalid-session-id", {
        userId: new mongoose.Types.ObjectId(),
      })
    );
  });

  it("rejects an invalid userId", async () => {
    await expectInvalidObjectId(
      revokeExpiredSessionById(new mongoose.Types.ObjectId(), {
        userId: "invalid-user-id",
      })
    );
  });

  it("rejects an invalid now value", async () => {
    await expect(
      revokeExpiredSessionById(new mongoose.Types.ObjectId(), {
        userId: new mongoose.Types.ObjectId(),
        now: "invalid-date",
      })
    ).rejects.toThrow("now must be a valid Date.");
  });

  it("participates in a supplied MongoDB transaction", async () => {
    const now = new Date();

    const userId = new mongoose.Types.ObjectId();

    // Create a valid but expired Session.
    // absoluteExpiresAt remains in the real future to avoid TTL cleanup.
    const session = await createStoredSession({
      userId,
      lastActivityAt: new Date(now.getTime() - 2 * HOUR_MS),
      idleExpiresAt: new Date(now.getTime() - HOUR_MS),
      absoluteExpiresAt: new Date(now.getTime() + 30 * DAY_MS),
    });

    const transaction = await mongoose.startSession();

    try {
      await expect(
        transaction.withTransaction(async () => {
          const result = await revokeExpiredSessionById(session._id, {
            userId,
            now,
            session: transaction,
          });

          expectSafeSessionResult(result);

          expect(result.revokedAt.getTime()).toBe(now.getTime());

          const visibleInsideTransaction = await Session.findById(
            session._id
          ).session(transaction);

          expect(visibleInsideTransaction).not.toBeNull();

          expect(visibleInsideTransaction.revokedAt.getTime()).toBe(
            now.getTime()
          );

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");

      const persistedSession = await Session.findById(session._id);

      expect(persistedSession).not.toBeNull();
      expect(persistedSession.revokedAt).toBeNull();
    } finally {
      await transaction.endSession();
    }
  });
});
