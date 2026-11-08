import "server-only";

import { cache } from "react";

import { getSessionTokenFromCookie } from "@/lib/auth/session-cookie";

import { resolveSessionToken } from "@/services/session.service";

/**
 * ==========================================================================
 * Internal Session Resolver
 * ==========================================================================
 */

/**
 * Resolve the authenticated Session associated with the current request.
 *
 * This function:
 * 1. Reads the opaque Session token from the browser cookie.
 * 2. Returns null when the cookie is missing.
 * 3. Delegates token validation and Session resolution to session.service.js.
 *
 * The Session service is responsible for:
 * - Token format validation.
 * - Token hashing and database lookup.
 * - Revocation and expiration checks.
 * - User account eligibility.
 * - sessionVersion verification.
 * - Activity refresh (Touch).
 *
 * Returns { user, session } when authentication succeeds,
 * otherwise returns null.
 *
 * Important:
 * Resolving a Session is not a read-only operation.
 * The Session service may update lastActivityAt and idleExpiresAt
 * when the configured Touch interval has elapsed.
 *
 * Database and infrastructure errors are intentionally propagated.
 *
 * React cache deduplicates calls during a Server Component render.
 * Outside Server Components, the function still works, but React cache
 * does not provide request-level memoization.
 */
const resolveRequestSession = cache(async function resolveRequestSession() {
  const token = await getSessionTokenFromCookie();

  if (!token) {
    return null;
  }

  return resolveSessionToken(token, { touch: true });
});

/**
 * ==========================================================================
 * Public API
 * ==========================================================================
 */

/**
 * Get the authenticated User and Session context for the current request.
 *
 * Returns:
 * - { user, session } when authenticated.
 * - null when no valid Session exists.
 *
 * Repeated calls during the same Server Component render share the
 * same resolution result.
 *
 * In Server Actions and Route Handlers, call this function once and
 * pass its result to other functions instead of relying on React cache.
 *
 * The returned User and Session are server-side data and must not
 * be passed directly to Client Components.
 */
export async function getCurrentSession() {
  return resolveRequestSession();
}

/**
 * Get only the authenticated User for the current request.
 *
 * Returns the User document or null when unauthenticated.
 *
 * This is a convenience wrapper around getCurrentSession().
 */
export async function getCurrentUser() {
  const currentSession = await getCurrentSession();

  return currentSession?.user ?? null;
}
