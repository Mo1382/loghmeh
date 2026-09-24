import mongoose from "mongoose";

import { pickAllowedFields } from "@/lib/validation/fields";

import {
  findUserById,
  findUserByUsername,
  findUsers,
  updateUserById,
  updateAccountStatus,
  softDeleteUser,
  restoreUser,
} from "@/repositories/user.repository";

import { ACCOUNT_STATUSES, USER_SORTS } from "@/constants/enums";

import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin } from "@/lib/auth/guards";

import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

import { assertCursorResource } from "@/lib/pagination/cursor-context";

import { normalizeLimit } from "@/lib/pagination/limit";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { assertEnum } from "@/lib/validation/enum";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Cursor Helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Validate and normalize a decoded user cursor.
 *
 * Cursor payload:
 * {
 *   v: 1,
 *   resource: "USERS",
 *   sort: String,
 *   value: Number | Date,
 *   id: String
 * }
 *
 * Date-based sorts are converted back from their
 * JSON string representation into Date objects.
 *
 * Numeric sorts remain numbers.
 */
function validateUserCursor(payload, sort) {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.sort === undefined ||
    payload.value === undefined ||
    !payload.id
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  assertCursorResource(payload, "USERS");

  assertEnum(payload.sort, Object.values(USER_SORTS), {
    errorCode: ERROR_CODES.INVALID_CURSOR,
    message: "مرتب‌سازی نشانگر صفحه‌بندی نامعتبر است.",
    statusCode: 400,
  });

  if (payload.sort !== sort) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی با مرتب‌سازی انتخاب‌شده مطابقت ندارد.",
      { statusCode: 400 }
    );
  }

  assertValidObjectId(payload.id, "cursor ID");

  let value;

  switch (payload.sort) {
    case USER_SORTS.NEWEST:
    case USER_SORTS.OLDEST: {
      value = new Date(payload.value);

      if (Number.isNaN(value.getTime())) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
          { statusCode: 400 }
        );
      }

      break;
    }

    case USER_SORTS.MOST_VIEWED:
    case USER_SORTS.HIGHEST_RATED: {
      if (
        typeof payload.value !== "number" ||
        !Number.isFinite(payload.value)
      ) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "مقدار نشانگر صفحه‌بندی نامعتبر است.",
          { statusCode: 400 }
        );
      }

      value = payload.value;

      break;
    }

    default:
      throw new AppError(
        ERROR_CODES.INVALID_CURSOR,
        "مرتب‌سازی کاربران نامعتبر است.",
        { statusCode: 400 }
      );
  }

  return {
    sort: payload.sort,
    value,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}

/**
 * Create the next cursor from the last returned user.
 */
function createNextCursor(user, sort) {
  let value;

  switch (sort) {
    case USER_SORTS.HIGHEST_RATED:
      value = user.stats.averageRating;
      break;

    case USER_SORTS.MOST_VIEWED:
      value = user.stats.totalRecipeViews;
      break;

    case USER_SORTS.NEWEST:
    case USER_SORTS.OLDEST:
      value = user.createdAt;
      break;

    default:
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST,
        "مرتب‌سازی کاربران نامعتبر است.",
        {
          statusCode: 400,
        }
      );
  }

  return encodeCursor({
    resource: "USERS",
    sort,
    value,
    id: user._id.toString(),
  });
}

/* -------------------------------------------------------------------------- */
/* User Response Helpers                                                      */
/* -------------------------------------------------------------------------- */

function toPublicUser(user) {
  const publicUser = pickAllowedFields(user, [
    "_id",
    "username",
    "avatar",
    "bio",
    "title",
    "socialLinks",
  ]);

  const publicStats = pickAllowedFields(user.stats, [
    "recipeCount",
    "averageRating",
    "totalRecipeViews",
  ]);

  return {
    id: publicUser._id,
    username: publicUser.username,
    avatar: publicUser.avatar,
    bio: publicUser.bio,
    title: publicUser.title,
    socialLinks: publicUser.socialLinks,
    stats: publicStats,
  };
}

/**
 * Convert a User document into a safe private response object.
 *
 * Intended for the authenticated user viewing their own account.
 * Sensitive fields such as password and deletedAt are excluded.
 */
function toPrivateUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    title: user.title,
    role: user.role,
    socialLinks: user.socialLinks,
    stats: user.stats,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* Authorization Helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Check whether the authenticated user is the owner of the target resource.
 */
function assertSelfAccess(currentUserId, targetUserId) {
  if (currentUserId.toString() !== targetUserId.toString()) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه ویرایش این کاربر را ندارید.",
      { statusCode: 403 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Get User                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Get a user by ID.
 */
export async function getUserById(userId) {
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPublicUser(user);
}

/**
 * Get a user by username.
 */
export async function getUserByUsername(username) {
  const user = await findUserByUsername(username);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPublicUser(user);
}

/* -------------------------------------------------------------------------- */
/* Get Users                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Get users using cursor-based infinite loading.
 *
 * Supported sorting:
 * - HIGHEST_RATED
 * - MOST_VIEWED
 * - NEWEST
 * - OLDEST
 */
export async function getUsers({
  filter = {},
  sort = USER_SORTS.NEWEST,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertEnum(sort, Object.values(USER_SORTS), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "مرتب‌سازی کاربران نامعتبر است.",
    statusCode: 400,
  });

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let decodedCursor = null;

  if (cursor) {
    decodedCursor = validateUserCursor(decodeCursor(cursor), sort);
  }

  const users = await findUsers({
    filter,
    sort,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = users.length > normalizedLimit;

  const visibleUsers = hasMore ? users.slice(0, normalizedLimit) : users;

  const nextCursor = hasMore
    ? createNextCursor(visibleUsers[visibleUsers.length - 1], sort)
    : null;

  return {
    users: visibleUsers.map(toPublicUser),
    nextCursor,
    hasMore,
  };
}

/* -------------------------------------------------------------------------- */
/* Update User Profile                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Update the authenticated user's profile.
 *
 * Only the owner of the profile can perform this operation.
 *
 * Editable fields should already be restricted by
 * updateUserProfileSchema.
 */
export async function updateUserProfile(currentUserId, targetUserId, updates) {
  assertSelfAccess(currentUserId, targetUserId);

  const user = await findUserById(targetUserId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const updatedUser = await updateUserById(targetUserId, updates);

  if (!updatedUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPrivateUser(updatedUser);
}

/* -------------------------------------------------------------------------- */
/* Change Account Status                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Change a user's account status.
 *
 * Only administrators can perform this operation.
 */
export async function changeAccountStatus(
  currentUser,
  targetUserId,
  accountStatus
) {
  assertAdmin(currentUser);

  assertEnum(accountStatus, Object.values(ACCOUNT_STATUSES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "وضعیت حساب کاربری نامعتبر است.",
    statusCode: 400,
  });

  if (
    currentUser._id.toString() === targetUserId.toString() &&
    accountStatus !== ACCOUNT_STATUSES.ACTIVE
  ) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید وضعیت حساب خودتان را تغییر دهید.",
      { statusCode: 403 }
    );
  }

  const user = await findUserById(targetUserId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const updatedUser = await updateAccountStatus(targetUserId, accountStatus);

  if (!updatedUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPrivateUser(updatedUser);
}

/* -------------------------------------------------------------------------- */
/* Delete User                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete a user.
 *
 * Only administrators can perform this operation.
 */
export async function deleteUser(currentUser, targetUserId) {
  assertAdmin(currentUser);

  if (currentUser._id.toString() === targetUserId.toString()) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید با این عملیات حساب خودتان را حذف کنید.",
      { statusCode: 403 }
    );
  }

  const user = await findUserById(targetUserId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const deletedUser = await softDeleteUser(targetUserId);

  if (!deletedUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return {
    success: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Restore User                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Restore a soft-deleted user.
 *
 * Only administrators can perform this operation.
 */
export async function restoreDeletedUser(currentUser, targetUserId) {
  assertAdmin(currentUser);

  const restoredUser = await restoreUser(targetUserId);

  if (!restoredUser) {
    throw new AppError(
      ERROR_CODES.USER_NOT_DELETED,
      "کاربر به‌صورت نرم حذف نشده است.",
      { statusCode: 400 }
    );
  }

  return toPrivateUser(restoredUser);
}
