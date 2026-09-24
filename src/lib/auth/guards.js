import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import { USER_ROLES } from "@/constants/enums";

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

/**
 * Ensure a user has administrator privileges.
 */
export function assertAdmin(currentUser) {
  assertAuthenticated(currentUser);

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
