import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { assertEnum } from "@/lib/validation/enum";

import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";

import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

import { normalizeLimit } from "@/lib/pagination/limit";

import {
  findNotificationByIdAndUser,
  findNotificationsByUser,
  createNotification as createNotificationRepository,
  createNotifications as createNotificationsRepository,
  markNotificationAsRead,
  countUnreadNotifications,
  deleteNotificationByUser,
} from "@/repositories/notification.repository";

import { findActiveUsersByIds } from "@/repositories/user.repository";

import { CURSOR_RESOURCES, NOTIFICATION_TYPES } from "@/constants/enums";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/**
 * --------------------------------------------------------------------------
 * Validation
 * --------------------------------------------------------------------------
 */

/**
 * Normalize and validate notification text.
 *
 * Length validation should also be enforced by the
 * input validation layer / Mongoose schema.
 */
function normalizeNotificationText(value, fieldName) {
  if (typeof value !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_NOTIFICATION_DATA,
      `${fieldName} الزامی است.`,
      { statusCode: 400 }
    );
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError(
      ERROR_CODES.INVALID_NOTIFICATION_DATA,
      `${fieldName} نمی‌تواند خالی باشد.`,
      { statusCode: 400 }
    );
  }

  return normalizedValue;
}

/**
 * Assert that a target ID exists.
 */
function assertRequiredNotificationId(value, fieldName) {
  if (value === null || value === undefined) {
    throw new AppError(
      ERROR_CODES.INVALID_NOTIFICATION_DATA,
      `${fieldName} برای این نوع اعلان الزامی است.`,
      { statusCode: 400 }
    );
  }

  assertValidObjectId(value, fieldName);
}

/**
 * Assert that a target field is absent.
 *
 * null is considered absent and is the canonical value
 * used by this Service for unused target fields.
 */
function assertNotificationFieldAbsent(value, fieldName) {
  if (value !== null && value !== undefined) {
    throw new AppError(
      ERROR_CODES.INVALID_NOTIFICATION_DATA,
      `${fieldName} نباید برای این نوع اعلان وجود داشته باشد.`,
      { statusCode: 400 }
    );
  }
}

/**
 * Validate semantic requirements for each notification type.
 *
 * Every supported notification type must have an explicit
 * contract here. This prevents a newly introduced enum value
 * from silently bypassing target validation.
 */
function assertNotificationSemanticContract({
  type,
  actorId,
  recipeId,
  commentId,
  replyId,
  ticketId,
}) {
  switch (type) {
    /**
     * Global administrator announcement.
     *
     * Target-specific domain fields are forbidden.
     */
    case NOTIFICATION_TYPES.ANNOUNCEMENT:
      assertRequiredNotificationId(actorId, "actor ID");

      assertNotificationFieldAbsent(recipeId, "recipe ID");

      assertNotificationFieldAbsent(commentId, "comment ID");

      assertNotificationFieldAbsent(replyId, "reply ID");

      assertNotificationFieldAbsent(ticketId, "support ticket ID");

      return;

    /**
     * A user commented on the Recipe.
     */
    case NOTIFICATION_TYPES.RECIPE_COMMENTED:
      assertRequiredNotificationId(actorId, "actor ID");

      assertRequiredNotificationId(recipeId, "recipe ID");

      assertRequiredNotificationId(commentId, "comment ID");

      assertNotificationFieldAbsent(replyId, "reply ID");

      assertNotificationFieldAbsent(ticketId, "support ticket ID");

      return;

    /**
     * A user rated the Recipe.
     */
    case NOTIFICATION_TYPES.RECIPE_RATED:
      assertRequiredNotificationId(actorId, "actor ID");

      assertRequiredNotificationId(recipeId, "recipe ID");

      assertNotificationFieldAbsent(commentId, "comment ID");

      assertNotificationFieldAbsent(replyId, "reply ID");

      assertNotificationFieldAbsent(ticketId, "support ticket ID");

      return;

    /**
     * The Recipe owner/administrator replied to
     * a user's top-level Comment.
     */
    case NOTIFICATION_TYPES.COMMENT_REPLIED:
      assertRequiredNotificationId(actorId, "actor ID");

      assertRequiredNotificationId(recipeId, "recipe ID");

      assertRequiredNotificationId(commentId, "comment ID");

      assertRequiredNotificationId(replyId, "reply ID");

      assertNotificationFieldAbsent(ticketId, "support ticket ID");

      return;

    /**
     * A Comment or one of its Replies received
     * a LIKE/DISLIKE.
     *
     * commentId is always present because Reply is
     * embedded inside the parent Comment.
     *
     * replyId is present only when the reacted target
     * is an embedded Reply.
     */
    case NOTIFICATION_TYPES.COMMENT_LIKED:
    case NOTIFICATION_TYPES.COMMENT_DISLIKED:
      assertRequiredNotificationId(actorId, "actor ID");

      assertRequiredNotificationId(recipeId, "recipe ID");

      assertRequiredNotificationId(commentId, "comment ID");

      if (replyId !== null) {
        assertValidObjectId(replyId, "reply ID");
      }

      assertNotificationFieldAbsent(ticketId, "support ticket ID");

      return;

    default:
      /**
       * Fail closed.
       *
       * Every new Notification type must define its
       * semantic contract before it can be persisted.
       */
      throw new AppError(
        ERROR_CODES.INVALID_NOTIFICATION_TYPE,
        "برای این نوع اعلان قرارداد معنایی تعریف نشده است.",
        { statusCode: 400 }
      );
  }
}

/**
 * --------------------------------------------------------------------------
 * Cursor Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Create the next cursor from the last notification
 * in the current page.
 */
function createNextCursor(notification, userId) {
  if (!notification?.createdAt || !notification?._id) {
    return null;
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.NOTIFICATIONS,
    userId: userId.toString(),
    createdAt: notification.createdAt.toISOString(),
    id: notification._id.toString(),
  });
}

/**
 * --------------------------------------------------------------------------
 * Notification Data Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Normalize and validate trusted server-side
 * notification data.
 *
 * System-managed fields:
 * - isRead
 * - readAt
 *
 * Target fields:
 * - recipeId
 * - commentId
 * - replyId
 * - ticketId
 */
function normalizeSystemNotificationData(notificationData) {
  if (
    !notificationData ||
    typeof notificationData !== "object" ||
    Array.isArray(notificationData)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_NOTIFICATION_DATA,
      "اطلاعات اعلان الزامی است.",
      { statusCode: 400 }
    );
  }

  const {
    userId,
    actorId = null,
    type,
    title,
    message,
    recipeId = null,
    commentId = null,
    replyId = null,
    ticketId = null,
  } = notificationData;

  /**
   * Structural validation.
   */
  assertValidObjectId(userId, "user ID");

  assertEnum(type, Object.values(NOTIFICATION_TYPES), {
    errorCode: ERROR_CODES.INVALID_NOTIFICATION_TYPE,
    message: "نوع اعلان نامعتبر است.",
    statusCode: 400,
  });

  if (actorId !== null) {
    assertValidObjectId(actorId, "actor ID");
  }

  if (recipeId !== null) {
    assertValidObjectId(recipeId, "recipe ID");
  }

  if (commentId !== null) {
    assertValidObjectId(commentId, "comment ID");
  }

  if (replyId !== null) {
    assertValidObjectId(replyId, "reply ID");
  }

  if (ticketId !== null) {
    assertValidObjectId(ticketId, "support ticket ID");
  }

  /**
   * Semantic validation.
   *
   * This verifies that the IDs above make sense
   * for the selected notification type.
   */
  assertNotificationSemanticContract({
    type,
    actorId,
    recipeId,
    commentId,
    replyId,
    ticketId,
  });

  return {
    userId,
    actorId,
    type,

    title: normalizeNotificationText(title, "عنوان"),

    message: normalizeNotificationText(message, "متن پیام"),

    recipeId,
    commentId,
    replyId,
    ticketId,

    // System-managed fields.
    isRead: false,
    readAt: null,
  };
}

/**
 * --------------------------------------------------------------------------
 * Get Notification
 * --------------------------------------------------------------------------
 */

export async function getNotificationById(currentUser, notificationId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(notificationId, "notification ID");

  const notification = await findNotificationByIdAndUser(
    notificationId,
    user._id
  );

  if (!notification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  return notification;
}

/**
 * --------------------------------------------------------------------------
 * Get Notifications
 * --------------------------------------------------------------------------
 */

export async function getNotifications(
  currentUser,
  { cursor = null, limit = DEFAULT_LIST_LIMIT } = {}
) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let normalizedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, CURSOR_RESOURCES.NOTIFICATIONS);

    assertCursorOwner(
      payload,
      "userId",
      user._id,
      "نشانگر اعلان متعلق به این کاربر نیست."
    );

    normalizedCursor = normalizeCreatedAtIdCursor(payload);
  }

  const notifications = await findNotificationsByUser({
    userId: user._id,
    cursor: normalizedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = notifications.length > normalizedLimit;

  const pageNotifications = hasMore
    ? notifications.slice(0, normalizedLimit)
    : notifications;

  const lastNotification = pageNotifications[pageNotifications.length - 1];

  const nextCursor = hasMore
    ? createNextCursor(lastNotification, user._id)
    : null;

  return {
    notifications: pageNotifications,
    nextCursor,
    hasMore,
  };
}

/**
 * --------------------------------------------------------------------------
 * Unread Count
 * --------------------------------------------------------------------------
 */

export async function getUnreadNotificationCount(currentUser) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  return countUnreadNotifications(user._id);
}

/**
 * --------------------------------------------------------------------------
 * Mark Notification As Read
 * --------------------------------------------------------------------------
 */

export async function markNotificationRead(currentUser, notificationId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(notificationId, "notification ID");

  /**
   * First verify ownership and retrieve
   * the current state.
   */
  const notification = await findNotificationByIdAndUser(
    notificationId,
    user._id
  );

  if (!notification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  /**
   * Idempotent behavior:
   * preserve the original readAt value.
   */
  if (notification.isRead) {
    return notification;
  }

  const updatedNotification = await markNotificationAsRead(
    notificationId,
    user._id
  );

  if (!updatedNotification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  return updatedNotification;
}

/**
 * --------------------------------------------------------------------------
 * Delete Notification
 * --------------------------------------------------------------------------
 */

export async function deleteNotification(currentUser, notificationId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(notificationId, "notification ID");

  const deletedNotification = await deleteNotificationByUser(
    notificationId,
    user._id
  );

  if (!deletedNotification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  return deletedNotification;
}

/**
 * --------------------------------------------------------------------------
 * Internal / System Notification
 * --------------------------------------------------------------------------
 */

/**
 * Create a notification for one specific user.
 *
 * Intended for trusted server-side services only.
 *
 * Semantic validation is performed before persistence.
 *
 * This function must not be exposed directly
 * to an untrusted client.
 */
export async function createSystemNotification(notificationData, session) {
  const normalizedData = normalizeSystemNotificationData(notificationData);

  return createNotificationRepository(normalizedData, session);
}

/**
 * --------------------------------------------------------------------------
 * Global / Admin Notification
 * --------------------------------------------------------------------------
 */

/**
 * Create an announcement notification for
 * multiple active users.
 *
 * Behavior:
 * - requires an authenticated ACTIVE administrator
 * - removes duplicate recipient IDs
 * - ignores inactive/deleted users
 * - always creates ANNOUNCEMENT notifications
 * - uses the current administrator as actor
 */
export async function createGlobalNotification(
  currentUser,
  { title, message },
  recipientUserIds,
  session
) {
  /**
   * Pass the transaction session to the Guard when
   * this function itself is called inside a transaction.
   */
  const admin = await requireActiveAuthenticatedUser(currentUser, session);

  assertAdmin(admin);

  if (!Array.isArray(recipientUserIds)) {
    throw new AppError(
      ERROR_CODES.INVALID_RECIPIENTS,
      "شناسه‌های کاربران دریافت‌کننده باید آرایه باشند.",
      { statusCode: 400 }
    );
  }

  if (recipientUserIds.length === 0) {
    throw new AppError(
      ERROR_CODES.NO_RECIPIENTS,
      "حداقل یک دریافت‌کننده الزامی است.",
      { statusCode: 400 }
    );
  }

  const normalizedTitle = normalizeNotificationText(title, "عنوان");

  const normalizedMessage = normalizeNotificationText(message, "متن پیام");

  /**
   * Validate every ID before calling toString().
   */
  const normalizedRecipientIds = recipientUserIds.map((userId) => {
    assertValidObjectId(userId, "recipient user ID");

    return userId.toString();
  });

  const uniqueRecipientIds = [...new Set(normalizedRecipientIds)];

  /**
   * Only currently ACTIVE, non-deleted users
   * can receive announcements.
   */
  const activeUsers = await findActiveUsersByIds(uniqueRecipientIds, session);

  if (activeUsers.length === 0) {
    throw new AppError(
      ERROR_CODES.NO_ACTIVE_RECIPIENTS,
      "هیچ دریافت‌کننده فعالی پیدا نشد.",
      { statusCode: 400 }
    );
  }

  const notifications = activeUsers.map((user) => ({
    userId: user._id,
    actorId: admin._id,

    type: NOTIFICATION_TYPES.ANNOUNCEMENT,

    title: normalizedTitle,
    message: normalizedMessage,

    recipeId: null,
    commentId: null,
    replyId: null,
    ticketId: null,

    // System-managed fields.
    isRead: false,
    readAt: null,
  }));

  const createdNotifications = await createNotificationsRepository(
    notifications,
    session
  );

  if (!createdNotifications) {
    throw new AppError(
      ERROR_CODES.INVALID_NOTIFICATION_DATA,
      "ایجاد اعلان‌ها انجام نشد.",
      { statusCode: 500 }
    );
  }

  return createdNotifications;
}
