import mongoose from "mongoose";

import { pickAllowedFields } from "@/lib/validation/fields";

import {
  findActiveUserById,
  findActiveUserByUsername,
  findActiveUsers,
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

import {
  updateUserProfileSchema,
  usernameSchema,
} from "@/validations/user.validation";

// Defaults and allowlists used by the User service.
const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;
const PUBLIC_USER_FILTER_FIELDS = Object.freeze(["role", "title"]);

// Helpers for validating and building signed user-list cursors.

/**
 * Validate a decoded cursor and normalize its values for MongoDB.
 * The cursor must belong to the users resource and use the requested sort.
 * Its value is validated according to the selected sort field.
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

  // Ensure this cursor was issued for the user-list endpoint.
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
 * Build a signed next-page cursor from the last user in the current page.
 * The cursor value must match the field used to sort the list.
 */
function createNextCursor(user, sort) {
  if (!user?._id) {
    throw new AppError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "ساخت نشانگر صفحه‌بندی برای کاربر نامعتبر ممکن نیست.",
      { statusCode: 500 }
    );
  }

  let value;

  switch (sort) {
    case USER_SORTS.HIGHEST_RATED: {
      value = user.stats?.averageRating;

      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 5
      ) {
        throw new AppError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          "مقدار میانگین امتیاز کاربر برای صفحه‌بندی نامعتبر است.",
          { statusCode: 500 }
        );
      }

      break;
    }

    case USER_SORTS.MOST_VIEWED: {
      value = user.stats?.totalRecipeViews;

      if (!Number.isSafeInteger(value) || value < 0) {
        throw new AppError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          "مجموع بازدیدهای کاربر برای صفحه‌بندی نامعتبر است.",
          { statusCode: 500 }
        );
      }

      break;
    }

    case USER_SORTS.NEWEST:
    case USER_SORTS.OLDEST: {
      value = user.createdAt;

      if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        throw new AppError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          "تاریخ کاربر برای صفحه‌بندی نامعتبر است.",
          { statusCode: 500 }
        );
      }

      break;
    }

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
 * Translate structured repository mutation failures into application errors.
 * Unknown failure reasons are treated as internal server errors.
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

// Response mappers explicitly select which fields may leave the service.

/**
 * Map a User document to the fields that may be shown publicly.
 * Email, role, password, lifecycle fields and other internal data are excluded.
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
    id: publicUser._id.toString(),
    username: publicUser.username,
    avatar: publicUser.avatar,
    bio: publicUser.bio,
    title: publicUser.title,
    socialLinks: publicUser.socialLinks,
    stats: publicStats,
  };
}

/**
 * Map a User document to a safe private response for the authenticated user/admin.
 * Sensitive fields such as password, deletedAt and sessionVersion are omitted.
 */
function toPrivateUser(user) {
  const data = user.toObject ? user.toObject() : { ...user };

  const stats = pickAllowedFields(data.stats ?? {}, [
    "recipeCount",
    "averageRating",
    "totalRecipeViews",
  ]);

  return {
    id: data._id.toString(),
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

// Public listing filters are restricted to supported, non-sensitive fields.

/**
 * Validate a public-user filter and reject unsupported fields or enum values.
 */
function buildSafeUserFilter(filter = {}) {
  if (filter === null || typeof filter !== "object" || Array.isArray(filter)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "فیلتر کاربران نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const unknownFields = Object.keys(filter).filter(
    (field) => !PUBLIC_USER_FILTER_FIELDS.includes(field)
  );

  if (unknownFields.length > 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "فیلتر شامل فیلدهای پشتیبانی‌نشده است.",
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

// Public user lookup operations.

/**
 * Retrieve an active, verified, non-deleted user by ID.
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
 * Validate a username, then retrieve the matching public user.
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

// Public user listing with cursor-based pagination.

/**
 * Return a page of active, verified and non-deleted users.
 * Supports rating, view-count, newest and oldest sort orders.
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

  // The repository applies the active, email-verified and non-deleted constraints.
  // Fetch one extra record to determine whether another page exists.
  const users = await findActiveUsers({
    filter: safeFilter,
    sort,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  // Return only the requested page and build the next cursor from its last user.
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

// Profile update operation.

/**
 * Update the authenticated user's editable profile fields.
 * The target user is derived from the authenticated account, not caller input.
 */
export async function updateUserProfile(currentUser, updates) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  // Validate profile data at the service boundary before calling the repository.
  const validation = updateUserProfileSchema.safeParse(updates);

  if (!validation.success) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      validation.error.issues[0]?.message ??
        "اطلاعات ارسالی برای ویرایش پروفایل نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const updatedUser = await updateUserProfileById(user._id, validation.data);

  if (!updatedUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  return toPrivateUser(updatedUser);
}

// Administrative account-status management.

/**
 * Change a user account status after verifying administrator permissions.
 * The repository enforces lifecycle invariants and updates sessionVersion atomically.
 */
export async function changeAccountStatus(
  currentUser,
  targetUserId,
  accountStatus
) {
  const admin = await assertAdmin(currentUser);

  assertValidObjectId(targetUserId, "user ID");

  const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

  assertEnum(accountStatus, Object.values(ACCOUNT_STATUSES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "وضعیت حساب کاربری نامعتبر است.",
    statusCode: 400,
  });

  // An administrator cannot disable their own account.
  if (
    admin._id.equals(targetObjectId) &&
    accountStatus !== ACCOUNT_STATUSES.ACTIVE
  ) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید وضعیت حساب خودتان را تغییر دهید.",
      { statusCode: 403 }
    );
  }

  // The repository atomically checks and updates the account state.
  const result = await updateAccountStatus(targetObjectId, accountStatus);

  if (!result.ok) {
    throwUserMutationFailure(result.reason);
  }

  return toPrivateUser(result.user);
}

// Administrative soft deletion.

/**
 * Soft-delete a user and prevent an administrator from deleting their own account.
 * The repository updates deletedAt and invalidates sessions.
 */
export async function deleteUser(currentUser, targetUserId) {
  const admin = await assertAdmin(currentUser);

  assertValidObjectId(targetUserId, "user ID");

  const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

  if (admin._id.equals(targetObjectId)) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید با این عملیات حساب خودتان را حذف کنید.",
      { statusCode: 403 }
    );
  }

  const result = await softDeleteUser(targetObjectId);

  if (!result.ok) {
    throwUserMutationFailure(result.reason);
  }

  return {
    success: true,
  };
}

// Administrative restoration of soft-deleted users.

/**
 * Restore a soft-deleted user after checking administrator permissions.
 * The repository updates the deletion state and invalidates previous sessions.
 */
export async function restoreDeletedUser(currentUser, targetUserId) {
  await assertAdmin(currentUser);

  assertValidObjectId(targetUserId, "user ID");

  const targetObjectId = new mongoose.Types.ObjectId(targetUserId);

  const result = await restoreUser(targetObjectId);

  if (!result.ok) {
    throwUserMutationFailure(result.reason);
  }

  return toPrivateUser(result.user);
}
