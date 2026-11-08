import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { ACCOUNT_STATUSES } from "@/constants/enums";
import { ERROR_CODES } from "@/constants/error-codes";
import { SESSION_POLICY } from "@/constants/session";

import { requireActiveAuthenticatedUser } from "@/lib/auth/guards";
import AppError from "@/lib/errors/AppError";
import { assertValidObjectId } from "@/lib/validation/object-id";

import { findActiveUserById } from "@/repositories/user.repository";

import { isValidSessionToken } from "@/lib/auth/session-token";

import {
  createSession as createSessionRecord,
  findSessionByTokenHash,
  revokeSessionById as revokeSessionRecordById,
  revokeExpiredSessionById as revokeExpiredSessionRecordById,
  touchSession as touchSessionRecord,
} from "@/repositories/session.repository";

/**
 * Validate a Date value before using it in a Session operation.
 */
function assertValidDate(value, fieldName) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date.`);
  }
}

/**
 * Validate a non-negative safe integer User session version.
 */
function assertValidSessionVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("sessionVersion must be a non-negative safe integer.");
  }
}

/**
 * Validate a positive safe integer duration in milliseconds.
 */
function assertValidDuration(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive safe integer.`);
  }
}

/**
 * Hash a canonical opaque Session token using SHA-256.
 */
function hashSessionToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Generate a cryptographically secure opaque Session token.
 */
function generateSessionToken() {
  return randomBytes(SESSION_POLICY.TOKEN_BYTES).toString("base64url");
}

/**
 * Check whether the stored Session timestamps have a valid structure.
 *
 * This check does not evaluate expiration.
 */
function hasValidSessionTimestampStructure(session) {
  const { lastActivityAt, idleExpiresAt, absoluteExpiresAt } = session;

  if (
    !(lastActivityAt instanceof Date) ||
    !Number.isFinite(lastActivityAt.getTime()) ||
    !(idleExpiresAt instanceof Date) ||
    !Number.isFinite(idleExpiresAt.getTime()) ||
    !(absoluteExpiresAt instanceof Date) ||
    !Number.isFinite(absoluteExpiresAt.getTime())
  ) {
    return false;
  }

  return (
    lastActivityAt.getTime() < idleExpiresAt.getTime() &&
    idleExpiresAt.getTime() <= absoluteExpiresAt.getTime()
  );
}

/**
 * Check whether either Session expiration deadline has been reached.
 *
 * The Session must have structurally valid timestamps before this helper
 * is called.
 */
function isSessionExpired(session, now) {
  const nowTime = now.getTime();

  return (
    session.idleExpiresAt.getTime() <= nowTime ||
    session.absoluteExpiresAt.getTime() <= nowTime
  );
}

/**
 * Revoke an unrevoked or incompletely initialized stored Session.
 *
 * A null or missing revokedAt value is eligible for revocation.
 * A non-null, defined value is treated as an existing revocation state
 * and must not be overwritten.
 *
 * Repository errors are propagated.
 */
async function revokeInvalidSession(session, now) {
  if (!session?._id || !session?.userId) {
    return;
  }

  // Skip Sessions that already have a defined revocation value.
  // Both null and undefined are eligible for the revocation attempt.
  if (session.revokedAt !== null && session.revokedAt !== undefined) {
    return;
  }

  await revokeSessionRecordById(session._id, {
    userId: session.userId,
    revokedAt: now,
  });
}

/**
 * Attempt to revoke a Session only if it is still expired in the database.
 *
 * Returns true when the conditional revocation succeeds.
 * Returns false when the Session no longer matches the expiration condition.
 */
async function tryRevokeExpiredSession(session, now) {
  if (!session?._id || !session?.userId) {
    return false;
  }

  const revokedSession = await revokeExpiredSessionRecordById(session._id, {
    userId: session.userId,
    now,
  });

  return revokedSession !== null;
}

/**
 * Check whether a User is eligible to own the specified Session.
 */
function isSessionUserValid(user, sessionVersion) {
  return (
    Boolean(user) &&
    user.accountStatus === ACCOUNT_STATUSES.ACTIVE &&
    user.emailVerified === true &&
    Number.isSafeInteger(user.sessionVersion) &&
    user.sessionVersion === sessionVersion
  );
}

/**
 * Check whether lastActivityAt is within the allowed future clock skew.
 */
function isSessionActivityTimestampWithinClockSkew(session, now) {
  const latestAllowedTime = now.getTime() + SESSION_POLICY.MAX_CLOCK_SKEW_MS;

  return session.lastActivityAt.getTime() <= latestAllowedTime;
}

/**
 * ==========================================================================
 * Create
 * ==========================================================================
 */

/**
 * Issue a new Session for an active, verified, non-deleted User.
 *
 * `sessionVersion` must be the value captured when the user's credentials
 * were successfully verified. It is checked against the current User record
 * immediately before Session creation and is never silently replaced with a
 * newer version.
 *
 * A concurrent security-sensitive User update can still occur after this
 * check. In that case, the newly created Session will be rejected by
 * resolveSessionToken() because its captured version will not match the
 * current User version. This check prevents stale versions that were already
 * obsolete before Session issuance began; it is not a cross-collection lock.
 *
 * Returns the raw token exactly once to the trusted server-side caller, along
 * with the non-secret Session record. The caller is responsible for placing
 * the raw token in the HttpOnly cookie; it must never send the token to the
 * client through a response body or persist it in MongoDB.
 */
export async function createSessionForUser({
  userId,
  sessionVersion,
  now = new Date(),
  idleTimeoutMs = SESSION_POLICY.IDLE_TIMEOUT_MS,
  absoluteTimeoutMs = SESSION_POLICY.ABSOLUTE_TIMEOUT_MS,
} = {}) {
  assertValidObjectId(userId, "user ID");
  assertValidSessionVersion(sessionVersion);
  assertValidDate(now, "now");
  assertValidDuration(idleTimeoutMs, "idleTimeoutMs");
  assertValidDuration(absoluteTimeoutMs, "absoluteTimeoutMs");

  const user = await findActiveUserById(userId);

  if (
    !user ||
    user.accountStatus !== ACCOUNT_STATUSES.ACTIVE ||
    user.emailVerified !== true
  ) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "حساب کاربری شما در حال حاضر قابل استفاده نیست.",
      { statusCode: 403 }
    );
  }

  if (
    !Number.isSafeInteger(user.sessionVersion) ||
    user.sessionVersion !== sessionVersion
  ) {
    throw new AppError(
      ERROR_CODES.USER_LIFECYCLE_CONFLICT,
      "اطلاعات احراز هویت هم‌زمان تغییر کرده است. لطفاً دوباره وارد شوید.",
      { statusCode: 409 }
    );
  }

  const absoluteExpiresAt = new Date(now.getTime() + absoluteTimeoutMs);

  const idleExpiresAt = new Date(
    Math.min(now.getTime() + idleTimeoutMs, absoluteExpiresAt.getTime())
  );

  assertValidDate(absoluteExpiresAt, "absoluteExpiresAt");
  assertValidDate(idleExpiresAt, "idleExpiresAt");

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  const session = await createSessionRecord({
    userId,
    tokenHash,
    sessionVersion,
    lastActivityAt: now,
    idleExpiresAt,
    absoluteExpiresAt,
  });

  return {
    token,
    session,
  };
}

/**
 * ==========================================================================
 * Resolve / Authenticate
 * ==========================================================================
 */

/**
 * Resolve and validate the latest persisted Session state.
 *
 * Expiration is handled through conditional Repository revocation.
 * When that operation fails, the Session is re-read because another
 * request may have refreshed its idle expiry concurrently.
 *
 * The retry limit prevents an unbounded loop under continuous contention.
 *
 * Returns { user, session } when the current Session is valid,
 * otherwise returns null.
 */
async function resolveCurrentSession(tokenHash, now) {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const session = await findSessionByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    // A revoked or incompletely initialized Session must never be active.
    if (session.revokedAt !== null) {
      await revokeInvalidSession(session, now);
      return null;
    }

    // Structurally inconsistent timestamps cannot be treated as valid.
    if (!hasValidSessionTimestampStructure(session)) {
      await revokeInvalidSession(session, now);
      return null;
    }

    // An invalid Session version cannot be safely authenticated.
    if (
      !Number.isSafeInteger(session.sessionVersion) ||
      session.sessionVersion < 0
    ) {
      await revokeInvalidSession(session, now);
      return null;
    }

    // Attempt atomic expiration cleanup against the latest database state.
    if (isSessionExpired(session, now)) {
      const revoked = await tryRevokeExpiredSession(session, now);

      if (revoked) {
        return null;
      }

      // The document may have been refreshed or revoked concurrently.
      // Read the latest state again instead of rejecting the stale snapshot.
      continue;
    }

    // Reject Sessions whose activity timestamp exceeds the allowed
    // future clock skew without modifying the persisted Session.
    if (!isSessionActivityTimestampWithinClockSkew(session, now)) {
      return null;
    }

    const user = await findActiveUserById(session.userId);

    if (!isSessionUserValid(user, session.sessionVersion)) {
      await revokeInvalidSession(session, now);
      return null;
    }

    return {
      user,
      session,
    };
  }

  // Fail closed if the Session keeps changing during validation.
  return null;
}

/**
 * Resolve an opaque browser token into an authenticated User and Session.
 *
 * Invalid, unknown, revoked, expired, structurally inconsistent, or stale
 * tokens return null. Database errors are not swallowed.
 *
 * The current Session is always read and validated through
 * resolveCurrentSession(), which performs conditional expiration cleanup
 * and re-reads the Session when concurrent updates prevent revocation.
 *
 * Activity refresh is attempted only when the configured touch interval
 * has elapsed. The Repository independently enforces this interval atomically.
 *
 * If Touch fails because another request updated the Session, the latest
 * persisted Session state is resolved again before rejecting the request.
 *
 * This function does not read or write cookies; cookie access belongs to the
 * separate Next.js session resolver/cookie layer.
 */
export async function resolveSessionToken(
  token,
  { now = new Date(), touch = true } = {}
) {
  assertValidDate(now, "now");

  if (typeof touch !== "boolean") {
    throw new TypeError("touch must be a boolean.");
  }

  // Reject malformed tokens before performing a database lookup.
  if (!isValidSessionToken(token)) {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  // Resolve the latest persisted Session and its owning User.
  const initialResolution = await resolveCurrentSession(tokenHash, now);

  if (!initialResolution) {
    return null;
  }

  let resolvedUser = initialResolution.user;
  let resolvedSession = initialResolution.session;

  const elapsedSinceLastActivity =
    now.getTime() - resolvedSession.lastActivityAt.getTime();

  if (touch && elapsedSinceLastActivity >= SESSION_POLICY.TOUCH_INTERVAL_MS) {
    const touchedSession = await touchSessionRecord(resolvedSession._id, {
      userId: resolvedSession.userId,
      sessionVersion: resolvedUser.sessionVersion,
      now,
      idleTimeoutMs: SESSION_POLICY.IDLE_TIMEOUT_MS,
      touchIntervalMs: SESSION_POLICY.TOUCH_INTERVAL_MS,
    });

    if (touchedSession) {
      resolvedSession = touchedSession;
    } else {
      // The Touch may have lost a race with another request.
      // Re-resolve the latest database state before rejecting the Session.
      const latestResolution = await resolveCurrentSession(tokenHash, now);

      if (!latestResolution) {
        return null;
      }

      resolvedUser = latestResolution.user;
      resolvedSession = latestResolution.session;
    }
  }

  return {
    user: resolvedUser,
    session: resolvedSession,
  };
}

/**
 * ==========================================================================
 * Revoke
 * ==========================================================================
 */

/**
 * Revoke the Session identified by a raw browser token.
 *
 * This operation is intentionally idempotent. Malformed, unknown, or already
 * revoked tokens return false, allowing Logout to safely clear the cookie
 * regardless of whether a corresponding active database record exists.
 *
 * The raw token is only hashed in memory and is never persisted.
 */
export async function revokeSessionByToken(token, { now = new Date() } = {}) {
  assertValidDate(now, "now");

  if (!isValidSessionToken(token)) {
    return false;
  }

  const tokenHash = hashSessionToken(token);
  const storedSession = await findSessionByTokenHash(tokenHash);

  if (!storedSession) {
    return false;
  }

  if (storedSession.revokedAt !== null) {
    await revokeInvalidSession(storedSession, now);
    return false;
  }

  const revokedSession = await revokeSessionRecordById(storedSession._id, {
    userId: storedSession.userId,
    revokedAt: now,
  });

  return revokedSession !== null;
}

/**
 * Revoke a specific Session belonging to the authenticated User.
 *
 * The target User ID is derived from the authenticated User rather
 * than accepted as an independent caller-supplied identifier.
 *
 * The Repository repeats the ownership condition to prevent
 * cross-user revocation.
 */
export async function revokeUserSession({
  sessionId,
  currentUser,
  now = new Date(),
} = {}) {
  assertValidObjectId(sessionId, "session ID");
  assertValidDate(now, "now");

  const authenticatedUser = await requireActiveAuthenticatedUser(currentUser);

  const revokedSession = await revokeSessionRecordById(sessionId, {
    userId: authenticatedUser._id,
    revokedAt: now,
  });

  return revokedSession !== null;
}
