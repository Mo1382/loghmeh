import "server-only";

import { cookies } from "next/headers";

import { assertValidSessionToken } from "@/lib/auth/session-token";

/**
 * ==========================================================================
 * Session Cookie Configuration
 * ==========================================================================
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Use the __Host- prefix in production.
 *
 * This prefix requires:
 * - Secure
 * - Path=/
 * - No Domain attribute
 *
 * A regular cookie name is used in development because local development
 * commonly runs over HTTP.
 */
export const SESSION_COOKIE_NAME = IS_PRODUCTION
  ? "__Host-loghmeh-session"
  : "loghmeh-session";

/**
 * Shared security attributes for all Session cookie operations.
 *
 * Domain is intentionally omitted to keep the cookie host-only.
 */
const SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: "lax",
  path: "/",
});

/**
 * ==========================================================================
 * Session Validation
 * ==========================================================================
 */

/**
 * Validate the Session expiration structure and return its absolute expiry.
 *
 * Only an unrevoked Session with valid temporal relationships can be used
 * to create a browser cookie.
 *
 * Idle expiration is enforced independently by the Session service.
 */
function getSessionCookieExpiry(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) {
    throw new TypeError("session must be an object.");
  }

  if (session.revokedAt !== null) {
    throw new TypeError("Cannot set a cookie for a revoked Session.");
  }

  const { lastActivityAt, idleExpiresAt, absoluteExpiresAt } = session;

  const dateFields = {
    lastActivityAt,
    idleExpiresAt,
    absoluteExpiresAt,
  };

  for (const [fieldName, value] of Object.entries(dateFields)) {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new TypeError(`${fieldName} must be a valid Date.`);
    }
  }

  if (
    lastActivityAt.getTime() >= idleExpiresAt.getTime() ||
    idleExpiresAt.getTime() > absoluteExpiresAt.getTime()
  ) {
    throw new TypeError("Session expiration timestamps are inconsistent.");
  }

  // Do not issue a browser cookie for an already expired Session.
  if (idleExpiresAt.getTime() <= Date.now()) {
    throw new TypeError("Cannot set a cookie for an expired Session.");
  }

  return absoluteExpiresAt;
}

/**
 * ==========================================================================
 * Read
 * ==========================================================================
 */

/**
 * Read the raw Session token from the incoming request cookie.
 *
 * Returns the token string or null when the cookie does not exist.
 *
 * Token authenticity and validity must be checked by resolveSessionToken().
 *
 * Can be called from Server Components, Server Actions, and Route Handlers.
 */
export async function getSessionTokenFromCookie() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * ==========================================================================
 * Set
 * ==========================================================================
 */

/**
 * Store the raw Session token in an HttpOnly browser cookie.
 *
 * The browser cookie expires at absoluteExpiresAt.
 * The shorter idle timeout is enforced by the Session service.
 *
 * This function must be called from a Server Action or Route Handler.
 */
export async function setSessionCookie(token, session) {
  assertValidSessionToken(token);

  const expires = getSessionCookieExpiry(session);

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    expires,
  });
}

/**
 * ==========================================================================
 * Clear
 * ==========================================================================
 */

/**
 * Immediately expire the Session cookie.
 *
 * This operation only removes the browser cookie.
 * Database Session revocation must be handled separately by session.service.js.
 *
 * This function must be called from a Server Action or Route Handler.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
    maxAge: 0,
  });
}
