import crypto from "node:crypto";

import {
  findUserById,
  findUserByUsername,
  findUsers,
  updateUserById,
  updateAccountStatus,
  softDeleteUser,
  restoreUser,
} from "@/repositories/user.repository";

import { USER_SORTS } from "@/repositories/user.repository";

import { AppError } from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

/**
 * Cursor format version.
 *
 * Increment this when the internal cursor structure changes.
 */
const CURSOR_VERSION = 1;

/**
 * Cursor signing algorithm.
 */
const CURSOR_HASH_ALGORITHM = "sha256";

/**
 * Encode a cursor into an opaque signed string.
 *
 * The cursor is Base64URL encoded and signed with HMAC.
 *
 * Cursor payload:
 * {
 *   v: 1,
 *   sort: String,
 *   value: Number | Date,
 *   id: String
 * }
 */
function encodeCursor(cursor) {
  const payload = JSON.stringify({
    v: CURSOR_VERSION,
    sort: cursor.sort,
    value: cursor.value,
    id: cursor.id,
  });

  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");

  const signature = crypto
    .createHmac(CURSOR_HASH_ALGORITHM, getCursorSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

/**
 * Decode and verify a signed cursor.
 *
 * The signature is checked before the payload is trusted.
 */
function decodeCursor(cursor) {
  if (typeof cursor !== "string" || !cursor) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  const [encodedPayload, signature] = cursor.split(".");

  if (!encodedPayload || !signature) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  const expectedSignature = crypto
    .createHmac(CURSOR_HASH_ALGORITHM, getCursorSecret())
    .update(encodedPayload)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature, "utf8");

  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  let parsedCursor;

  try {
    parsedCursor = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    );
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  return parsedCursor;
}

/**
 * Get the secret used to sign cursors.
 *
 * AUTH_SECRET is reused because it is already a
 * server-side cryptographic secret required by Auth.js.
 */
function getCursorSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("متغیر AUTH_SECRET تنظیم نشده است.");
  }

  return secret;
}

/**
 * Validate and normalize a decoded cursor.
 *
 * Date-based sorts are converted back from their
 * JSON string representation into Date objects.
 *
 * Numeric sorts remain numbers.
 */
function validateCursor(cursor, sort) {
  if (
    !cursor ||
    typeof cursor !== "object" ||
    cursor.v !== CURSOR_VERSION ||
    cursor.sort !== sort ||
    cursor.value == null ||
    !cursor.id ||
    !/^[a-fA-F0-9]{24}$/.test(cursor.id)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  switch (sort) {
    case USER_SORTS.NEWEST:
    case USER_SORTS.OLDEST: {
      const date = new Date(cursor.value);

      if (Number.isNaN(date.getTime())) {
        throw new AppError(
          ERROR_CODES.INVALID_REQUEST,
          "نشانگر صفحه‌بندی نامعتبر است.",
          {
            statusCode: 400,
          }
        );
      }

      return {
        v: CURSOR_VERSION,
        sort,
        value: date,
        id: cursor.id,
      };
    }

    case USER_SORTS.HIGHEST_RATED:
    case USER_SORTS.MOST_VIEWED: {
      if (typeof cursor.value !== "number" || !Number.isFinite(cursor.value)) {
        throw new AppError(
          ERROR_CODES.INVALID_REQUEST,
          "نشانگر صفحه‌بندی نامعتبر است.",
          {
            statusCode: 400,
          }
        );
      }

      return {
        v: CURSOR_VERSION,
        sort,
        value: cursor.value,
        id: cursor.id,
      };
    }

    default:
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST,
        "مرتب‌سازی کاربران نامعتبر است.",
        {
          statusCode: 400,
        }
      );
  }
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
    sort,
    value,
    id: user._id.toString(),
  });
}

/**
 * Convert a User document into a safe public response object.
 *
 * Sensitive and internal fields are excluded.
 */
// function toPublicUser(user) {
//   const data = user.toObject ? user.toObject() : { ...user };

//   delete data.password;
//   delete data.email;
//   delete data.role;
//   delete data.emailVerified;
//   delete data.accountStatus;
//   delete data.deletedAt;

//   return data;
// }

function toPublicUser(user) {
  return {
    id: user._id,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    title: user.title,
    socialLinks: user.socialLinks,
    stats: {
      recipeCount: user.stats.recipeCount,
      followerCount: user.stats.followerCount,
      followingCount: user.stats.followingCount,
      averageRating: user.stats.averageRating,
    },
  };
}

/**
 * Convert a User document into a safe private response object.
 *
 * Intended for the authenticated user viewing their own account.
 * Sensitive fields such as password and deletedAt are excluded.
 */
// function toPrivateUser(user) {
//   const data = user.toObject ? user.toObject() : { ...user };

//   delete data.password;
//   delete data.deletedAt;

//   return data;
// }

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

/**
 * Check whether the authenticated user is an administrator.
 */
function assertAdmin(currentUser) {
  if (!currentUser) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "ورود به حساب کاربری الزامی است.",
      { statusCode: 401 }
    );
  }
  if (currentUser.role !== "ADMIN") {
    throw new AppError(ERROR_CODES.FORBIDDEN, "دسترسی مدیر سیستم الزامی است.", {
      statusCode: 403,
    });
  }
}

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
  limit = 16,
}) {
  if (!Object.values(USER_SORTS).includes(sort)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "مرتب‌سازی کاربران نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  let decodedCursor = null;

  if (cursor) {
    decodedCursor = validateCursor(decodeCursor(cursor), sort);
  }

  /**
   * Fetch one extra user to determine
   * whether another batch exists.
   */
  const users = await findUsers({
    filter,
    sort,
    cursor: decodedCursor,
    limit: limit + 1,
  });

  const hasMore = users.length > limit;

  const visibleUsers = hasMore ? users.slice(0, limit) : users;

  const nextCursor = hasMore
    ? createNextCursor(visibleUsers[visibleUsers.length - 1], sort)
    : null;

  return {
    users: visibleUsers.map(toPublicUser),
    nextCursor,
    hasMore,
  };
}

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

  if (!["ACTIVE", "SUSPENDED", "DEACTIVATED"].includes(accountStatus)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "وضعیت حساب کاربری نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  if (
    currentUser._id.toString() === targetUserId.toString() &&
    accountStatus !== "ACTIVE"
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
