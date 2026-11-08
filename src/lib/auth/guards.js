import "server-only";

import { ERROR_CODES } from "@/constants/error-codes";
import { USER_ROLES } from "@/constants/enums";

import AppError from "@/lib/errors/AppError";
import { assertValidObjectId } from "@/lib/validation/object-id";

import { findActiveUserById } from "@/repositories/user.repository";

/**
 * ==========================================================================
 * Authentication
 * ==========================================================================
 */

/**
 * Ensure that an authenticated User was provided.
 *
 * This function only checks the presence of the User object.
 * Session authentication and token validation must already have been
 * performed by the Session Resolver.
 */
export function assertAuthenticated(currentUser) {
  if (!currentUser) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "برای انجام این کار باید ابتدا وارد حساب کاربری خود شوید.",
      { statusCode: 401 }
    );
  }

  return currentUser;
}

/**
 * ==========================================================================
 * Active User Authorization
 * ==========================================================================
 */

/**
 * Require an authenticated User whose account is currently active.
 *
 * `currentUser` must be obtained server-side through the Session Resolver.
 * Never accept a User identity supplied directly by the client.
 *
 * The Session Resolver is responsible for:
 * - Validating the browser Session token.
 * - Checking Session revocation and expiration.
 * - Verifying the User's sessionVersion.
 *
 * This guard independently re-reads the User to ensure that:
 * - The account is still active.
 * - The email is verified.
 * - The User has not been soft-deleted.
 *
 * The fresh database result is returned instead of the potentially
 * stale User object supplied by the caller.
 *
 * `mongoSession` is an optional MongoDB ClientSession used when
 * the surrounding operation participates in a transaction.
 */
export async function requireActiveAuthenticatedUser(
  currentUser,
  mongoSession
) {
  assertAuthenticated(currentUser);
  assertValidObjectId(currentUser._id, "user ID");

  const user = await findActiveUserById(currentUser._id, mongoSession);

  if (!user) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "حساب کاربری شما در حال حاضر قابل استفاده نیست.",
      { statusCode: 403 }
    );
  }

  return user;
}

/**
 * ==========================================================================
 * Administrator Authorization
 * ==========================================================================
 */

/**
 * Ensure that the authenticated User currently has administrator privileges.
 *
 * The role is checked against the fresh User document retrieved by
 * requireActiveAuthenticatedUser(), not the potentially stale input object.
 */
export async function assertAdmin(currentUser, mongoSession) {
  const user = await requireActiveAuthenticatedUser(currentUser, mongoSession);

  if (user.role !== USER_ROLES.ADMIN) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما مجوز انجام این کار را ندارید.",
      { statusCode: 403 }
    );
  }

  return user;
}
