import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import Session from "@/models/Session";

import {
  expectValidationError,
  findIndexByFields,
} from "../helpers/mongoose-validation-helpers";

let mongoServer;

/*
 * ============================================================================
 * Test setup
 * ============================================================================
 *
 * Uses an in-memory MongoDB instance for schema and database-level tests.
 */

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri());

  // Ensure database indexes are ready before database constraint tests run.
  await Session.init();
});

afterEach(async () => {
  await Session.deleteMany({});
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
 * Test constants and helpers
 * ============================================================================
 */

const VALID_TOKEN_HASH = "a".repeat(64);

const DAY_MS = 24 * 60 * 60 * 1000;
const IDLE_TIMEOUT_MS = DAY_MS;
const ABSOLUTE_TIMEOUT_MS = 30 * DAY_MS;

/**
 * Build a valid Session document with overridable fields.
 *
 * Expiration dates are relative to the current time so that persisted
 * documents are not already expired when MongoDB's TTL monitor runs.
 */
function buildValidSession(overrides = {}) {
  const now = Date.now();

  return new Session({
    userId: new mongoose.Types.ObjectId(),
    tokenHash: VALID_TOKEN_HASH,
    sessionVersion: 0,
    lastActivityAt: new Date(now),
    idleExpiresAt: new Date(now + IDLE_TIMEOUT_MS),
    absoluteExpiresAt: new Date(now + ABSOLUTE_TIMEOUT_MS),
    ...overrides,
  });
}

/*
 * ============================================================================
 * Basic validity
 * ============================================================================
 */

describe("Session model - basic validity", () => {
  test("accepts a valid Session document", async () => {
    const session = buildValidSession();

    await session.validate();
  });

  test("generates an ObjectId for a new Session document", () => {
    const session = buildValidSession();

    expect(session._id).toBeInstanceOf(mongoose.Types.ObjectId);
  });
});

/*
 * ============================================================================
 * Schema structure
 * ============================================================================
 */

describe("Session model - schema structure", () => {
  test("defines userId as a required ObjectId reference to User", () => {
    const path = Session.schema.path("userId");

    expect(path.instance).toBe("ObjectId");
    expect(path.options.ref).toBe("User");
    expect(path.options.required).toBe(true);
  });

  test("marks security-sensitive identity and lifetime fields as immutable", () => {
    const immutableFields = [
      "userId",
      "tokenHash",
      "sessionVersion",
      "absoluteExpiresAt",
    ];

    for (const field of immutableFields) {
      expect(Session.schema.path(field).options.immutable).toBe(true);
    }
  });

  test("keeps activity, idle expiry and revocation fields mutable", () => {
    const mutableFields = ["lastActivityAt", "idleExpiresAt", "revokedAt"];

    for (const field of mutableFields) {
      expect(Session.schema.path(field).options.immutable).not.toBe(true);
    }
  });

  test("defines createdAt but not updatedAt", () => {
    expect(Session.schema.path("createdAt")).toBeDefined();
    expect(Session.schema.path("updatedAt")).toBeUndefined();
  });

  test("does not define a raw browser-token field", () => {
    expect(Session.schema.path("token")).toBeUndefined();
    expect(Session.schema.path("rawToken")).toBeUndefined();
  });
});

/*
 * ============================================================================
 * Required fields
 * ============================================================================
 */

describe("Session model - required fields", () => {
  test.each([
    "userId",
    "tokenHash",
    "sessionVersion",
    "lastActivityAt",
    "idleExpiresAt",
    "absoluteExpiresAt",
  ])("requires %s", async (field) => {
    const session = buildValidSession({
      [field]: undefined,
    });

    await expectValidationError(session, field);
  });

  test.each([
    "userId",
    "tokenHash",
    "sessionVersion",
    "lastActivityAt",
    "idleExpiresAt",
    "absoluteExpiresAt",
  ])("rejects null for required field %s", async (field) => {
    const session = buildValidSession({
      [field]: null,
    });

    await expectValidationError(session, field);
  });
});

/*
 * ============================================================================
 * userId
 * ============================================================================
 */

describe("Session model - userId", () => {
  test("accepts a valid ObjectId", async () => {
    const userId = new mongoose.Types.ObjectId();
    const session = buildValidSession({ userId });

    await session.validate();

    expect(session.userId.toString()).toBe(userId.toString());
  });

  test("casts a valid hexadecimal ObjectId string", async () => {
    const userId = "507f1f77bcf86cd799439011";
    const session = buildValidSession({ userId });

    await session.validate();

    expect(session.userId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(session.userId.toString()).toBe(userId);
  });

  test("rejects an invalid ObjectId value", async () => {
    const session = buildValidSession({
      userId: "invalid-user-id",
    });

    await expectValidationError(session, "userId");
  });
});

/*
 * ============================================================================
 * tokenHash
 * ============================================================================
 */

describe("Session model - tokenHash", () => {
  test("accepts a 64-character lowercase SHA-256 hexadecimal hash", async () => {
    const session = buildValidSession({
      tokenHash: VALID_TOKEN_HASH,
    });

    await session.validate();
  });

  test.each([
    {
      description: "fewer than 64 characters",
      value: "a".repeat(63),
    },
    {
      description: "more than 64 characters",
      value: "a".repeat(65),
    },
    {
      description: "uppercase hexadecimal characters",
      value: "A".repeat(64),
    },
    {
      description: "non-hexadecimal characters",
      value: "g".repeat(64),
    },
    {
      description: "a trailing space",
      value: `${"a".repeat(63)} `,
    },
    {
      description: "a trailing newline",
      value: `${"a".repeat(64)}\n`,
    },
  ])("rejects a token hash with $description", async ({ value }) => {
    const session = buildValidSession({ tokenHash: value });

    await expectValidationError(session, "tokenHash");
  });

  test("marks tokenHash as select:false", () => {
    expect(Session.schema.path("tokenHash").options.select).toBe(false);
  });

  test("excludes tokenHash from normal query results", async () => {
    const session = await Session.create(buildValidSession());

    const result = await Session.findById(session._id);

    expect(result).not.toBeNull();
    expect(result.tokenHash).toBeUndefined();
  });

  test("allows explicit selection of tokenHash when required", async () => {
    const session = await Session.create(buildValidSession());

    const result = await Session.findById(session._id).select("+tokenHash");

    expect(result).not.toBeNull();
    expect(result.tokenHash).toBe(VALID_TOKEN_HASH);
  });
});

/*
 * ============================================================================
 * sessionVersion
 * ============================================================================
 */

describe("Session model - sessionVersion", () => {
  test.each([0, 1, 10, Number.MAX_SAFE_INTEGER])(
    "accepts a non-negative safe integer: %s",
    async (sessionVersion) => {
      const session = buildValidSession({ sessionVersion });

      await session.validate();
    }
  );

  test.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    "rejects an invalid sessionVersion: %s",
    async (sessionVersion) => {
      const session = buildValidSession({ sessionVersion });

      await expectValidationError(session, "sessionVersion");
    }
  );

  test("rejects a non-numeric sessionVersion", async () => {
    const session = buildValidSession({
      sessionVersion: "not-a-number",
    });

    await expectValidationError(session, "sessionVersion");
  });
});

/*
 * ============================================================================
 * Activity and expiry dates
 * ============================================================================
 */

describe("Session model - activity and expiry dates", () => {
  test.each(["lastActivityAt", "idleExpiresAt", "absoluteExpiresAt"])(
    "requires %s to be a valid Date",
    async (field) => {
      const session = buildValidSession({
        [field]: "not-a-date",
      });

      await expectValidationError(session, field);
    }
  );

  test("accepts valid activity and expiry dates", async () => {
    const session = buildValidSession();

    await session.validate();
  });

  test("accepts past dates at the model level", async () => {
    // Expiration policy is enforced by session.service.js, not this model.
    const session = buildValidSession({
      lastActivityAt: new Date("2025-01-01T10:00:00.000Z"),
      idleExpiresAt: new Date("2025-01-02T10:00:00.000Z"),
      absoluteExpiresAt: new Date("2025-01-31T10:00:00.000Z"),
    });

    await session.validate();
  });

  test("accepts idleExpiresAt equal to absoluteExpiresAt", async () => {
    const lastActivityAt = new Date();
    const absoluteExpiresAt = new Date(lastActivityAt.getTime() + DAY_MS);

    const session = buildValidSession({
      lastActivityAt,
      idleExpiresAt: absoluteExpiresAt,
      absoluteExpiresAt,
    });

    await session.validate();
  });
});

/*
 * ============================================================================
 * Cross-field expiry validation
 * ============================================================================
 */

describe("Session model - cross-field expiry validation", () => {
  test.each([
    {
      description: "equal to lastActivityAt",
      idleExpiryOffset: 0,
    },
    {
      description: "earlier than lastActivityAt",
      idleExpiryOffset: -1000,
    },
  ])("rejects idleExpiresAt $description", async ({ idleExpiryOffset }) => {
    const lastActivityAt = new Date("2026-01-01T10:00:00.000Z");

    const session = buildValidSession({
      lastActivityAt,
      idleExpiresAt: new Date(lastActivityAt.getTime() + idleExpiryOffset),
    });

    await expectValidationError(session, "idleExpiresAt");
  });

  test("rejects idleExpiresAt later than absoluteExpiresAt", async () => {
    const lastActivityAt = new Date("2026-01-01T10:00:00.000Z");
    const absoluteExpiresAt = new Date("2026-01-31T10:00:00.000Z");

    const session = buildValidSession({
      lastActivityAt,
      absoluteExpiresAt,
      idleExpiresAt: new Date(absoluteExpiresAt.getTime() + 1000),
    });

    await expectValidationError(session, "idleExpiresAt");
  });

  test("accepts idleExpiresAt strictly between activity and absolute expiry", async () => {
    const session = buildValidSession({
      lastActivityAt: new Date("2026-01-01T10:00:00.000Z"),
      idleExpiresAt: new Date("2026-01-02T10:00:00.000Z"),
      absoluteExpiresAt: new Date("2026-01-31T10:00:00.000Z"),
    });

    await session.validate();
  });

  test("attaches cross-field validation errors to idleExpiresAt", async () => {
    const lastActivityAt = new Date("2026-01-01T10:00:00.000Z");

    const session = buildValidSession({
      lastActivityAt,
      idleExpiresAt: new Date(lastActivityAt.getTime()),
    });

    const error = await session.validate().then(
      () => null,
      (validationError) => validationError
    );

    expect(error).toBeTruthy();
    expect(error.errors.idleExpiresAt).toBeDefined();
    expect(error.errors.idleExpiresAt.message).toContain(
      "Idle expiry must be later than last activity"
    );
  });
});

/*
 * ============================================================================
 * revokedAt
 * ============================================================================
 */

describe("Session model - revokedAt", () => {
  test("defaults revokedAt to null", () => {
    const session = buildValidSession();

    expect(session.revokedAt).toBeNull();
  });

  test("accepts null revokedAt", async () => {
    const session = buildValidSession({ revokedAt: null });

    await session.validate();
  });

  test("accepts a valid revocation date", async () => {
    const session = buildValidSession({
      revokedAt: new Date("2026-01-01T12:00:00.000Z"),
    });

    await session.validate();
  });

  test("rejects an invalid revocation date", async () => {
    const session = buildValidSession({
      revokedAt: "not-a-date",
    });

    await expectValidationError(session, "revokedAt");
  });
});

/*
 * ============================================================================
 * Timestamps
 * ============================================================================
 */

describe("Session model - timestamps", () => {
  test("creates createdAt but not updatedAt when the document is saved", async () => {
    const session = await Session.create(buildValidSession());

    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.updatedAt).toBeUndefined();
  });

  test("does not change createdAt when activity fields are updated", async () => {
    const session = await Session.create(buildValidSession());
    const originalCreatedAt = session.createdAt.getTime();

    const lastActivityAt = new Date();

    session.lastActivityAt = lastActivityAt;
    session.idleExpiresAt = new Date(
      lastActivityAt.getTime() + IDLE_TIMEOUT_MS
    );

    await session.save();

    expect(session.createdAt.getTime()).toBe(originalCreatedAt);
    expect(session.updatedAt).toBeUndefined();
  });
});

/*
 * ============================================================================
 * Immutable fields
 * ============================================================================
 */

describe("Session model - immutable fields", () => {
  test("does not persist changes to immutable fields after creation", async () => {
    const session = await Session.create(buildValidSession());

    const originalValues = {
      userId: session.userId,
      tokenHash: session.tokenHash,
      sessionVersion: session.sessionVersion,
      absoluteExpiresAt: new Date(session.absoluteExpiresAt),
    };

    session.userId = new mongoose.Types.ObjectId();
    session.tokenHash = "b".repeat(64);
    session.sessionVersion = 10;
    session.absoluteExpiresAt = new Date(
      originalValues.absoluteExpiresAt.getTime() + DAY_MS
    );

    await session.save();

    const persistedSession = await Session.findById(session._id).select(
      "+tokenHash"
    );

    expect(persistedSession.userId.toString()).toBe(
      originalValues.userId.toString()
    );
    expect(persistedSession.tokenHash).toBe(originalValues.tokenHash);
    expect(persistedSession.sessionVersion).toBe(originalValues.sessionVersion);
    expect(persistedSession.absoluteExpiresAt.getTime()).toBe(
      originalValues.absoluteExpiresAt.getTime()
    );
  });
});

/*
 * ============================================================================
 * Index definitions
 * ============================================================================
 */

describe("Session model - index definitions", () => {
  test("defines a unique tokenHash index", () => {
    const index = findIndexByFields(Session.schema, {
      tokenHash: 1,
    });

    expect(index).toBeDefined();
    expect(index[1]).toMatchObject({ unique: true });
  });

  test("defines the compound user session-management index", () => {
    const index = findIndexByFields(Session.schema, {
      userId: 1,
      revokedAt: 1,
      sessionVersion: 1,
      createdAt: -1,
      _id: -1,
    });

    expect(index).toBeDefined();
  });

  test("defines an absoluteExpiresAt TTL index", () => {
    const index = findIndexByFields(Session.schema, {
      absoluteExpiresAt: 1,
    });

    expect(index).toBeDefined();
    expect(index[1]).toMatchObject({ expireAfterSeconds: 0 });
  });

  test.each(["lastActivityAt", "idleExpiresAt", "revokedAt"])(
    "does not define a TTL index on %s",
    (field) => {
      const index = findIndexByFields(Session.schema, {
        [field]: 1,
      });

      expect(index).toBeUndefined();
    }
  );
});

/*
 * ============================================================================
 * Database constraints
 * ============================================================================
 */

describe("Session model - database constraints", () => {
  test("rejects duplicate token hashes", async () => {
    const tokenHash = "b".repeat(64);

    await Session.create(buildValidSession({ tokenHash }));

    await expect(
      Session.create(
        buildValidSession({
          tokenHash,
          userId: new mongoose.Types.ObjectId(),
        })
      )
    ).rejects.toMatchObject({ code: 11000 });
  });

  test("allows multiple Sessions for the same User with different token hashes", async () => {
    const userId = new mongoose.Types.ObjectId();

    await Session.create(
      buildValidSession({
        userId,
        tokenHash: "c".repeat(64),
      })
    );

    await expect(
      Session.create(
        buildValidSession({
          userId,
          tokenHash: "d".repeat(64),
        })
      )
    ).resolves.toBeDefined();
  });
});
