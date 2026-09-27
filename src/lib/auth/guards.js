import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import { USER_ROLES } from "@/constants/enums";
import { findActiveUserById } from "@/repositories/user.repository";
import { assertValidObjectId } from "@/lib/validation/object-id";

/**
 * Ensure a user is authenticated.
 */
export function assertAuthenticated(currentUser) {
  if (!currentUser) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "برای نجام اینکار باید ابتدا وارد حساب کاربری خود شوید.",
      { statusCode: 401 }
    );
  }

  return currentUser;
}

export async function requireActiveAuthenticatedUser(currentUser) {
  requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(currentUser._id, "user ID");

  const user = await findActiveUserById(currentUser._id);

  if (!user) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "حساب کاربری شما فعال نیست.", {
      statusCode: 403,
    });
  }

  return user;
}

/**
 * Ensure a user has administrator privileges.
 */
export function assertAdmin(currentUser) {
  requireActiveAuthenticatedUser(currentUser);

  if (currentUser.role !== USER_ROLES.ADMIN) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما مجوز انجام اینکار را ندارید.",
      {
        statusCode: 403,
      }
    );
  }

  return currentUser;
}
