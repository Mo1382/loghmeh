import mongoose from "mongoose";

import { pickAllowedFields } from "@/lib/validation/fields";

import {
  findActiveUserById,
  findActiveUserByUsername,
  findActiveUsers,
  findNonDeletedUserById,
  restoreUser,
  softDeleteUser,
  updateAccountStatus,
  updateUserProfileById,
} from "@/repositories/user.repository";

import {
  ACCOUNT_STATUSES,
  CURSOR_RESOURCES,
  USER_ROLES,
  USER_SORTS,
  USER_TITLES,
} from "@/constants/enums";

import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

import { assertCursorResource } from "@/lib/pagination/cursor-context";

import { normalizeLimit } from "@/lib/pagination/limit";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { assertEnum } from "@/lib/validation/enum";
import { usernameSchema } from "@/validations/auth.validation";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

const PUBLIC_USER_FILTER_FIELDS = Object.freeze(["role", "title"]);

const EDITABLE_PROFILE_FIELDS = Object.freeze(["avatar", "bio", "socialLinks"]);

/**
 * --------------------------------------------------------------------------
 * Cursor Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Validate and normalize a decoded User cursor.
 *
 * Cursor payload:
 * {
 *   v: 1,
 *   resource: CURSOR_RESOURCES.USERS,
 *   sort: String,
 *   value: String | Number,
 *   id: String
 * }
 */

function validateUserCursor(payload, sort) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.sort === undefined ||
    payload.value === undefined ||
    payload.id === undefined ||
    payload.id === null
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  assertCursorResource(payload, CURSOR_RESOURCES.USERS);

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

  // شناسه‌ی cursor باید یک رشته‌ی ۲۴ کاراکتری هگزادسیمال باشد.
  // در صورت نامعتبر بودن، خطا باید از نوع INVALID_CURSOR باشد.
  if (typeof payload.id !== "string" || !/^[0-9a-fA-F]{24}$/.test(payload.id)) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "شناسه نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  let value;

  switch (payload.sort) {
    case USER_SORTS.NEWEST:
    case USER_SORTS.OLDEST: {
      // cursorهای تاریخی باید رشته‌ی ISO استاندارد باشند.
      if (typeof payload.value !== "string") {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
          { statusCode: 400 }
        );
      }

      value = new Date(payload.value);

      if (
        Number.isNaN(value.getTime()) ||
        value.toISOString() !== payload.value
      ) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
          { statusCode: 400 }
        );
      }

      break;
    }

    case USER_SORTS.MOST_VIEWED: {
      // تعداد بازدید باید یک عدد صحیح نامنفی و safe integer باشد.
      if (!Number.isSafeInteger(payload.value) || payload.value < 0) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "تعداد بازدید در نشانگر صفحه‌بندی نامعتبر است.",
          { statusCode: 400 }
        );
      }

      value = payload.value;
      break;
    }

    case USER_SORTS.HIGHEST_RATED: {
      // امتیاز میانگین باید در بازه‌ی صفر تا پنج باشد.
      if (
        typeof payload.value !== "number" ||
        !Number.isFinite(payload.value) ||
        payload.value < 0 ||
        payload.value > 5
      ) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "امتیاز در نشانگر صفحه‌بندی نامعتبر است.",
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
 * Create the next cursor from the last returned User.
 */
function createNextCursor(user, sort) {
  if (!user?._id) {
    return null;
  }

  let value;

  switch (sort) {
    case USER_SORTS.HIGHEST_RATED:
      value = user.stats?.averageRating ?? 0;
      break;

    case USER_SORTS.MOST_VIEWED:
      value = user.stats?.totalRecipeViews ?? 0;
      break;

    case USER_SORTS.NEWEST:
    case USER_SORTS.OLDEST:
      value = user.createdAt;

      if (!(value instanceof Date)) {
        return null;
      }

      break;

    default:
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST,
        "مرتب‌سازی کاربران نامعتبر است.",
        { statusCode: 400 }
      );
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.USERS,
    sort,
    value,
    id: user._id.toString(),
  });
}

/**
 * Convert a failed User repository mutation into an AppError.
 *
 * The repository returns structured failures:
 *   { ok: false, reason: ERROR_CODES.* }
 *
 * This helper translates known failure reasons into
 * application-level errors with appropriate HTTP status codes.
 */
function throwUserMutationFailure(reason) {
  switch (reason) {
    case ERROR_CODES.USER_NOT_FOUND:
      throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
        statusCode: 404,
      });

    case ERROR_CODES.USER_ALREADY_DELETED:
      throw new AppError(
        ERROR_CODES.USER_ALREADY_DELETED,
        "این حساب کاربری قبلاً حذف شده است و این عملیات روی آن امکان‌پذیر نیست.",
        { statusCode: 409 }
      );

    case ERROR_CODES.USER_NOT_DELETED:
      throw new AppError(
        ERROR_CODES.USER_NOT_DELETED,
        "حساب کاربری حذف نشده است و امکان بازیابی آن وجود ندارد.",
        { statusCode: 409 }
      );

    case ERROR_CODES.EMAIL_NOT_VERIFIED:
      throw new AppError(
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        "تا زمانی که ایمیل کاربر تأیید نشده باشد، حساب او قابل فعال‌سازی نیست.",
        { statusCode: 409 }
      );

    case ERROR_CODES.SESSION_VERSION_LIMIT_REACHED:
      throw new AppError(
        ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
        "به دلیل رسیدن نسخه نشست حساب به حد مجاز، انجام این عملیات ممکن نیست.",
        { statusCode: 409 }
      );

    case ERROR_CODES.USER_LIFECYCLE_CONFLICT:
      throw new AppError(
        ERROR_CODES.USER_LIFECYCLE_CONFLICT,
        "وضعیت فعلی حساب با عملیات درخواستی سازگار نیست.",
        { statusCode: 409 }
      );

    default:
      // Unknown repository failure reasons indicate an unexpected
      // internal condition and must not be reported as a client error.
      throw new AppError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        "هنگام انجام عملیات روی حساب کاربری، خطای داخلی رخ داد.",
        { statusCode: 500 }
      );
  }
}

/**
 * --------------------------------------------------------------------------
 * User Response Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Convert a User document into a public response.
 *
 * Internal/security fields are never exposed.
 */
function toPublicUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };

  const publicUser = pickAllowedFields(data, [
    "_id",
    "username",
    "avatar",
    "bio",
    "title",
    "socialLinks",
  ]);

  const publicStats = pickAllowedFields(data.stats ?? {}, [
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
 * Convert a User document into a safe private response.
 *
 * Intended for the authenticated user or an administrator.
 *
 * Sensitive/internal fields such as password,
 * deletedAt and sessionVersion are excluded.
 */
function toPrivateUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };

  const stats = pickAllowedFields(data.stats ?? {}, [
    "recipeCount",
    "averageRating",
    "totalRecipeViews",
  ]);

  return {
    id: data._id,
    username: data.username,
    email: data.email,
    avatar: data.avatar,
    bio: data.bio,
    title: data.title,
    role: data.role,
    socialLinks: data.socialLinks,
    stats,
    emailVerified: data.emailVerified,
    accountStatus: data.accountStatus,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/**
 * --------------------------------------------------------------------------
 * User Filter Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Build a safe filter for public User queries.
 *
 * Only filters that make sense for the public
 * ACTIVE-only User listing are allowed here.
 */
function buildSafeUserFilter(filter = {}) {
  if (filter === null || typeof filter !== "object" || Array.isArray(filter)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "فیلتر کاربران نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const safeFilter = pickAllowedFields(filter, PUBLIC_USER_FILTER_FIELDS);

  if (safeFilter.role !== undefined) {
    assertEnum(safeFilter.role, Object.values(USER_ROLES), {
      errorCode: ERROR_CODES.INVALID_REQUEST,
      message: "نقش کاربر نامعتبر است.",
      statusCode: 400,
    });
  }

  if (safeFilter.title !== undefined) {
    assertEnum(safeFilter.title, Object.values(USER_TITLES), {
      errorCode: ERROR_CODES.INVALID_REQUEST,
      message: "عنوان کاربر نامعتبر است.",
      statusCode: 400,
    });
  }

  return safeFilter;
}

/**
 * --------------------------------------------------------------------------
 * Get User
 * --------------------------------------------------------------------------
 */

/**
 * Get an active public User by ID.
 */
export async function getUserById(userId) {
  assertValidObjectId(userId, "user ID");

  const user = await findActiveUserById(userId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPublicUser(user);
}

/**
 * Get an active public User by username.
 */
export async function getUserByUsername(username) {
  const result = usernameSchema.safeParse(username);

  if (!result.success) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, "نام کاربری نامعتبر است.", {
      statusCode: 400,
    });
  }

  const user = await findActiveUserByUsername(result.data);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPublicUser(user);
}

/**
 * --------------------------------------------------------------------------
 * Get Users
 * --------------------------------------------------------------------------
 */

/**
 * Get active public Users using cursor-based pagination.
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

  const safeFilter = buildSafeUserFilter(filter);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  const cursorPayload = decodeCursor(cursor);

  const decodedCursor =
    cursorPayload === null ? null : validateUserCursor(cursorPayload, sort);

  /**
   * findActiveUsers() is responsible for returning
   * only ACTIVE and non-deleted Users.
   */
  const users = await findActiveUsers({
    filter: safeFilter,
    sort,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = users.length > normalizedLimit;

  const visibleUsers = hasMore ? users.slice(0, normalizedLimit) : users;

  const lastUser = visibleUsers[visibleUsers.length - 1];

  const nextCursor = hasMore ? createNextCursor(lastUser, sort) : null;

  return {
    users: visibleUsers.map(toPublicUser),
    nextCursor,
    hasMore,
  };
}

/**
 * --------------------------------------------------------------------------
 * Update User Profile
 * --------------------------------------------------------------------------
 */

/**
 * Update the authenticated user's profile.
 *
 * The Service derives the target User from the
 * authenticated account and does not trust a caller-
 * supplied targetUserId for authorization.
 */
export async function updateUserProfile(currentUser, updates) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  const sanitizedUpdates = pickAllowedFields(updates, EDITABLE_PROFILE_FIELDS);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "حداقل یک فیلد برای ویرایش باید ارسال شود.",
      { statusCode: 400 }
    );
  }

  const updatedUser = await updateUserProfileById(user._id, sanitizedUpdates);

  if (!updatedUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPrivateUser(updatedUser);
}

/**
 * --------------------------------------------------------------------------
 * Change Account Status
 * --------------------------------------------------------------------------
 */

/**
 * Change a user's account status.
 *
 * Only an ACTIVE administrator can perform this operation.
 *
 * The repository is responsible for atomically updating
 * accountStatus and invalidating the relevant sessions
 * through sessionVersion.
 */
export async function changeAccountStatus(
  currentUser,
  targetUserId,
  accountStatus
) {
  const admin = await assertAdmin(currentUser);

  assertValidObjectId(targetUserId, "user ID");

  assertEnum(accountStatus, Object.values(ACCOUNT_STATUSES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "وضعیت حساب کاربری نامعتبر است.",
    statusCode: 400,
  });

  // An administrator cannot disable their own account.
  if (
    admin._id.toString() === targetUserId.toString() &&
    accountStatus !== ACCOUNT_STATUSES.ACTIVE
  ) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید وضعیت حساب خودتان را تغییر دهید.",
      { statusCode: 403 }
    );
  }

  // The repository atomically checks and updates the account state.
  const result = await updateAccountStatus(targetUserId, accountStatus);

  if (!result.ok) {
    throwUserMutationFailure(result.reason);
  }

  return toPrivateUser(result.user);
}
/**
 * --------------------------------------------------------------------------
 * Delete User
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete a User.
 *
 * Only an ACTIVE administrator can perform this operation.
 *
 * The repository is responsible for atomically setting
 * deletedAt and invalidating existing sessions.
 */

export async function deleteUser(currentUser, targetUserId) {
  const admin = await assertAdmin(currentUser);

  assertValidObjectId(targetUserId, "user ID");

  if (admin._id.toString() === targetUserId.toString()) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید با این عملیات حساب خودتان را حذف کنید.",
      { statusCode: 403 }
    );
  }

  const result = await softDeleteUser(targetUserId);

  if (!result.ok) {
    throwUserMutationFailure(result.reason);
  }

  return {
    success: true,
  };
}

/**
 * --------------------------------------------------------------------------
 * Restore User
 * --------------------------------------------------------------------------
 */

/**
 * Restore a soft-deleted User.
 *
 * Only an ACTIVE administrator can perform this operation.
 *
 * Restoring the User must also invalidate previously
 * issued sessions by updating sessionVersion.
 */
export async function restoreDeletedUser(currentUser, targetUserId) {
  await assertAdmin(currentUser);

  assertValidObjectId(targetUserId, "user ID");

  const result = await restoreUser(targetUserId);

  if (!result.ok) {
    throwUserMutationFailure(result.reason);
  }

  return toPrivateUser(result.user);
}
