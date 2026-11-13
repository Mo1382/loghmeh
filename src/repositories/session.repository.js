import Session from "@/models/Session";

import { applySession } from "@/lib/helpers/apply-session";
import { assertValidObjectId } from "@/lib/validation/object-id";
import { SESSION_POLICY } from "@/constants/session";

/**
 * Fields accepted when creating a new Session.
 *
 * Raw browser tokens, externally supplied creation timestamps, revocation
 * metadata, and other database-managed fields are not accepted here.
 */
const SESSION_CREATION_FIELDS = new Set([
  "userId",
  "tokenHash",
  "sessionVersion",
  "lastActivityAt",
  "idleExpiresAt",
  "absoluteExpiresAt",
]);

/**
 * Explicitly selected fields safe to return to the Service layer.
 * tokenHash is intentionally excluded, including from create/update results.
 */
const SESSION_RESULT_PROJECTION =
  "_id userId sessionVersion createdAt lastActivityAt idleExpiresAt absoluteExpiresAt revokedAt";

const SHA256_HASH_PATTERN = /^[a-f0-9]{64}(?![\s\S])/;

/**
 * ==========================================================================
 * Internal Validators
 * ==========================================================================
 */

/**
 * Validate a Date value before using it in a database operation.
 */
function assertValidDate(value, fieldName) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date.`);
  }
}

/**
 * Validate a lowercase hexadecimal SHA-256 hash.
 */
function assertValidTokenHash(value) {
  if (typeof value !== "string" || !SHA256_HASH_PATTERN.test(value)) {
    throw new TypeError(
      "tokenHash must be a 64-character lowercase SHA-256 hex string."
    );
  }
}

/**
 * Validate the User's immutable session version expected by an operation.
 */
function assertValidSessionVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("sessionVersion must be a non-negative safe integer.");
  }
}

/**
 * ==========================================================================
 * Session Data Helpers
 * ==========================================================================
 */

/**
 * Validate and whitelist the data accepted for a new Session.
 *
 * Explicitly constructing the object prevents accidental persistence of a
 * raw token or other properties supplied by an upstream caller.
 */
function buildSessionCreationData(sessionData) {
  if (
    !sessionData ||
    typeof sessionData !== "object" ||
    Array.isArray(sessionData)
  ) {
    throw new TypeError("sessionData must be an object.");
  }

  const prototype = Object.getPrototypeOf(sessionData);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("sessionData must be a plain object.");
  }

  const unsupportedFields = Reflect.ownKeys(sessionData).filter(
    (field) => typeof field !== "string" || !SESSION_CREATION_FIELDS.has(field)
  );

  if (unsupportedFields.length > 0) {
    const fieldNames = unsupportedFields.map((field) => String(field));

    throw new TypeError(
      `Unsupported Session creation fields: ${fieldNames.join(", ")}.`
    );
  }

  for (const field of SESSION_CREATION_FIELDS) {
    if (!Object.hasOwn(sessionData, field)) {
      throw new TypeError(`Session creation field "${field}" is required.`);
    }
  }

  const data = {
    userId: sessionData.userId,
    tokenHash: sessionData.tokenHash,
    sessionVersion: sessionData.sessionVersion,
    lastActivityAt: sessionData.lastActivityAt,
    idleExpiresAt: sessionData.idleExpiresAt,
    absoluteExpiresAt: sessionData.absoluteExpiresAt,
  };

  assertValidObjectId(data.userId, "user ID");
  assertValidTokenHash(data.tokenHash);
  assertValidSessionVersion(data.sessionVersion);
  assertValidDate(data.lastActivityAt, "lastActivityAt");
  assertValidDate(data.idleExpiresAt, "idleExpiresAt");
  assertValidDate(data.absoluteExpiresAt, "absoluteExpiresAt");

  return data;
}

/**
 * Convert a Mongoose Document or Lean Object into a safe Session result.
 *
 * Only explicitly allowed fields are returned.
 * Sensitive fields such as tokenHash are never included.
 *
 * Returns null when no Session exists.
 */
function toSessionResult(session) {
  if (!session) {
    return null;
  }

  return {
    _id: session._id,
    userId: session.userId,
    sessionVersion: session.sessionVersion,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    idleExpiresAt: session.idleExpiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    revokedAt: session.revokedAt,
  };
}

/**
 * Convert an array of Session Documents or Lean Objects
 * into safe Session result objects.
 */
function toSessionResults(sessions) {
  return sessions.map(toSessionResult);
}

/**
 * ==========================================================================
 * Create
 * ==========================================================================
 */

/**
 * Create a new Session.
 *
 * The Service layer is responsible for generating the opaque token, hashing
 * it, and capturing the User's sessionVersion after successful credential
 * verification. Only the hash is accepted by this Repository.
 *
 * The returned object deliberately excludes tokenHash.
 * When a MongoDB transaction session is supplied, creation participates in
 * that transaction.
 */
export async function createSession(sessionData, session) {
  const data = buildSessionCreationData(sessionData);

  const createdSession = session
    ? (await Session.create([data], { session }))[0]
    : await Session.create(data);

  return toSessionResult(createdSession);
}

/**
 * ==========================================================================
 * Read
 * ==========================================================================
 */

/**
 * Find a Session by its SHA-256 token hash.
 *
 * tokenHash is used only as a lookup condition and is not selected into the
 * returned document. The caller must still validate revocation, expiry, and
 * the owning User's current sessionVersion.
 *
 * Returns a Plain Object or null.
 */
export async function findSessionByTokenHash(tokenHash, session) {
  assertValidTokenHash(tokenHash);

  const query = Session.findOne({ tokenHash })
    .select(SESSION_RESULT_PROJECTION)
    .lean();

  const result = await applySession(query, session);

  return toSessionResult(result);
}

/**
 * Find a User's currently usable Sessions.
 *
 * "Active" here means that the Session is not revoked, neither expiry has
 * passed, its activity timestamp is not in the future, and its captured
 * sessionVersion matches the User's current version. The caller must supply
 * that current version; this Repository does not query or authorize Users.
 *
 * Returns an array of Plain Objects.
 */
export async function findActiveSessionsByUserId(
  userId,
  { sessionVersion, now = new Date(), session } = {}
) {
  assertValidObjectId(userId, "user ID");
  assertValidSessionVersion(sessionVersion);
  assertValidDate(now, "now");

  const latestAllowedActivityAt = new Date(
    now.getTime() + SESSION_POLICY.MAX_CLOCK_SKEW_MS
  );

  const query = Session.find({
    userId,
    sessionVersion,
    revokedAt: null,
    lastActivityAt: {
      $lte: latestAllowedActivityAt,
    },
    idleExpiresAt: { $gt: now },
    absoluteExpiresAt: { $gt: now },
    $expr: {
      $and: [
        { $lt: ["$lastActivityAt", "$idleExpiresAt"] },
        { $lte: ["$idleExpiresAt", "$absoluteExpiresAt"] },
      ],
    },
  })
    .select(SESSION_RESULT_PROJECTION)
    // Use _id as a deterministic tie-breaker when createdAt values are equal.
    // The matching compound index is defined in Session.js.
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const results = await applySession(query, session);

  return toSessionResults(results);
}

/**
 * ==========================================================================
 * Update activity
 * ==========================================================================
 */

/**
 * Refresh a Session's idle expiry without extending its absolute lifetime.
 *
 * The update is atomic. It only matches a Session that:
 *   - belongs to the expected User;
 *   - has the sessionVersion supplied by the caller, which must be the
 *     current version already verified against the User document;
 *   - has not been revoked;
 *   - has not reached either expiry;
 *   - has a valid existing expiry relationship; and
 *   - does not have a future lastActivityAt relative to `now`.
 *
 * The new idleExpiresAt is the later of its current value and the candidate
 * expiry, capped at the stored absoluteExpiresAt. This prevents activity from
 * shortening an existing idle window while ensuring the absolute lifetime is
 * never extended. Given a positive timeout and an absoluteExpiresAt later than
 * `now`, the resulting idleExpiresAt is also later than `now`.
 *
 * Query-based updates do not execute document validation middleware, so the
 * temporal invariants are enforced in the filter and update pipeline.
 *
 * Important: this query compares the Session's stored sessionVersion with the
 * version supplied by the caller. It does not read the User collection. The
 * Session Service must first obtain and validate the current User version.
 *
 * Returns the updated Session as a Plain Object without tokenHash,
 * or null when it cannot be touched.
 */
export async function touchSession(
  sessionId,
  {
    userId,
    sessionVersion,
    touchIntervalMs = 0,
    now = new Date(),
    idleTimeoutMs,
    session,
  } = {}
) {
  assertValidObjectId(sessionId, "session ID");
  assertValidObjectId(userId, "user ID");
  assertValidSessionVersion(sessionVersion);
  assertValidDate(now, "now");

  if (!Number.isSafeInteger(idleTimeoutMs) || idleTimeoutMs <= 0) {
    throw new TypeError("idleTimeoutMs must be a positive safe integer.");
  }

  if (!Number.isSafeInteger(touchIntervalMs) || touchIntervalMs < 0) {
    throw new TypeError("touchIntervalMs must be a non-negative safe integer.");
  }

  const candidateIdleExpiresAt = new Date(now.getTime() + idleTimeoutMs);
  assertValidDate(candidateIdleExpiresAt, "candidateIdleExpiresAt");

  const minimumLastActivityAt = new Date(now.getTime() - touchIntervalMs);
  assertValidDate(minimumLastActivityAt, "minimumLastActivityAt");

  const query = Session.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
      sessionVersion,
      revokedAt: null,
      lastActivityAt: {
        $lte: minimumLastActivityAt,
      },
      idleExpiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
      $expr: {
        $and: [
          { $lt: ["$lastActivityAt", "$idleExpiresAt"] },
          { $lte: ["$idleExpiresAt", "$absoluteExpiresAt"] },
        ],
      },
    },
    [
      {
        $set: {
          lastActivityAt: now,
          idleExpiresAt: {
            $max: [
              "$idleExpiresAt",
              {
                $min: [candidateIdleExpiresAt, "$absoluteExpiresAt"],
              },
            ],
          },
        },
      },
    ],
    {
      returnDocument: "after",
      updatePipeline: true,
    }
  )
    .select(SESSION_RESULT_PROJECTION)
    .lean();

  const result = await applySession(query, session);

  return toSessionResult(result);
}

/**
 * ==========================================================================
 * Revoke
 * ==========================================================================
 */

/**
 * Revoke one Session belonging to the specified User.
 *
 * The owner condition prevents a caller from revoking another User's Session
 * by supplying an arbitrary Session ID. The revokedAt:null condition makes
 * revocation one-way: an already revoked Session is not modified again.
 *
 * Returns the updated Session as a Plain Object without tokenHash,
 * or null when no matching unrevoked Session exists.
 */
export async function revokeSessionById(
  sessionId,
  { userId, revokedAt = new Date(), session } = {}
) {
  assertValidObjectId(sessionId, "session ID");
  assertValidObjectId(userId, "user ID");
  assertValidDate(revokedAt, "revokedAt");

  const query = Session.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  )
    .select(SESSION_RESULT_PROJECTION)
    .lean();

  const result = await applySession(query, session);

  return toSessionResult(result);
}

/**
 * Revoke every unrevoked Session belonging to a User.
 *
 * Expired Sessions are also marked revoked when their documents still exist.
 * This is useful for logout-all-devices and account-security operations.
 *
 * The caller should pass the surrounding MongoDB transaction session when
 * this operation must commit atomically with a User.sessionVersion increment.
 *
 * Returns the MongoDB UpdateResult, including matchedCount and modifiedCount.
 */
export async function revokeSessionsByUserId(
  userId,
  { revokedAt = new Date(), session } = {}
) {
  assertValidObjectId(userId, "user ID");
  assertValidDate(revokedAt, "revokedAt");

  const query = Session.updateMany(
    {
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt,
      },
    },
    {
      runValidators: true,
    }
  );

  const result = await applySession(query, session);

  return result;
}

/**
 * Revoke a Session only if it is still expired at the supplied time.
 *
 * The expiration conditions are evaluated atomically against the current
 * database document. This prevents a stale Service read from revoking
 * a Session whose idle expiry has been extended by a concurrent Touch.
 *
 * A Session is expired when either:
 *   - idleExpiresAt <= now
 *   - absoluteExpiresAt <= now
 *
 * The revokedAt:null condition ensures that revocation is one-way.
 *
 * Returns the updated Session as a Plain Object without tokenHash,
 * or null when the Session is no longer expired or does not match.
 */
export async function revokeExpiredSessionById(
  sessionId,
  { userId, now = new Date(), session } = {}
) {
  assertValidObjectId(sessionId, "session ID");
  assertValidObjectId(userId, "user ID");
  assertValidDate(now, "now");

  const query = Session.findOneAndUpdate(
    {
      _id: sessionId,
      userId,
      revokedAt: null,
      $or: [
        {
          idleExpiresAt: {
            $lte: now,
          },
        },
        {
          absoluteExpiresAt: {
            $lte: now,
          },
        },
      ],
    },
    {
      $set: {
        revokedAt: now,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  )
    .select(SESSION_RESULT_PROJECTION)
    .lean();

  const result = await applySession(query, session);

  return toSessionResult(result);
}
