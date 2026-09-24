import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, assertAuthenticated } from "@/lib/auth/guards";

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

import { NOTIFICATION_TYPES } from "@/constants/enums";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Cursor Helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Create the next cursor from the last notification in the current page.
 */
function createNextCursor(notification, userId) {
  if (!notification) {
    return null;
  }

  if (!notification.createdAt || !notification._id) {
    return null;
  }

  return encodeCursor({
    resource: "NOTIFICATIONS",
    userId: userId.toString(),
    createdAt: notification.createdAt.toISOString(),
    id: notification._id.toString(),
  });
}

/* -------------------------------------------------------------------------- */
/* Notification Data Helpers                                                  */
/* -------------------------------------------------------------------------- */

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
    ticketId = null,
  } = notificationData;

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

  if (ticketId !== null) {
    assertValidObjectId(ticketId, "support ticket ID");
  }

  return {
    userId,
    actorId,
    type,
    title: normalizeNotificationText(title, "عنوان"),
    message: normalizeNotificationText(message, "متن پیام"),
    recipeId,
    commentId,
    ticketId,

    // System-managed fields.
    isRead: false,
    readAt: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Get Notification                                                           */
/* -------------------------------------------------------------------------- */

export async function getNotificationById(currentUser, notificationId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(notificationId, "notification ID");

  const notification = await findNotificationByIdAndUser(
    notificationId,
    currentUser._id
  );

  if (!notification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  return notification;
}

/* -------------------------------------------------------------------------- */
/* Get Notifications                                                          */
/* -------------------------------------------------------------------------- */

export async function getNotifications(
  currentUser,
  { cursor = null, limit = DEFAULT_LIST_LIMIT } = {}
) {
  assertAuthenticated(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let normalizedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, "NOTIFICATIONS");

    assertCursorOwner(
      payload,
      "userId",
      currentUser._id,
      "نشانگر اعلان متعلق به این کاربر نیست."
    );

    normalizedCursor = normalizeCreatedAtIdCursor(payload);
  }

  const notifications = await findNotificationsByUser({
    userId: currentUser._id,
    cursor: normalizedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = notifications.length > normalizedLimit;

  const pageNotifications = hasMore
    ? notifications.slice(0, normalizedLimit)
    : notifications;

  const lastNotification = pageNotifications[pageNotifications.length - 1];

  const nextCursor = hasMore
    ? createNextCursor(lastNotification, currentUser._id)
    : null;

  return {
    notifications: pageNotifications,
    nextCursor,
    hasMore,
  };
}

/* -------------------------------------------------------------------------- */
/* Unread Count                                                               */
/* -------------------------------------------------------------------------- */

export async function getUnreadNotificationCount(currentUser) {
  assertAuthenticated(currentUser);

  return countUnreadNotifications(currentUser._id);
}

/* -------------------------------------------------------------------------- */
/* Mark Notification As Read                                                  */
/* -------------------------------------------------------------------------- */

export async function markNotificationRead(currentUser, notificationId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(notificationId, "notification ID");

  // First verify ownership and retrieve the current state.
  const notification = await findNotificationByIdAndUser(
    notificationId,
    currentUser._id
  );

  if (!notification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  /**
   * Idempotent behavior:
   * if already read, preserve the original readAt.
   */
  if (notification.isRead) {
    return notification;
  }

  const updatedNotification = await markNotificationAsRead(
    notificationId,
    currentUser._id
  );

  if (!updatedNotification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  return updatedNotification;
}

/* -------------------------------------------------------------------------- */
/* Delete Notification                                                        */
/* -------------------------------------------------------------------------- */

export async function deleteNotification(currentUser, notificationId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(notificationId, "notification ID");

  const deletedNotification = await deleteNotificationByUser(
    notificationId,
    currentUser._id
  );

  if (!deletedNotification) {
    throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND, "اعلان پیدا نشد.", {
      statusCode: 404,
    });
  }

  return deletedNotification;
}

/* -------------------------------------------------------------------------- */
/* Internal / System Notification                                             */
/* -------------------------------------------------------------------------- */

/**
 * Create a notification for one specific user.
 *
 * This function is intended for trusted server-side
 * services such as:
 * - rating.service.js
 * - comment.service.js
 * - support-ticket.service.js
 *
 * It must not be exposed directly to an untrusted client.
 */
export async function createSystemNotification(notificationData, session) {
  const normalizedData = normalizeSystemNotificationData(notificationData);

  return createNotificationRepository(normalizedData, session);
}

/* -------------------------------------------------------------------------- */
/* Global / Admin Notification                                                */
/* -------------------------------------------------------------------------- */

/**
 * Create an announcement notification for multiple active users.
 *
 * The function:
 * - requires ADMIN privileges
 * - removes duplicate recipient IDs
 * - ignores inactive/deleted users
 * - always creates ANNOUNCEMENT notifications
 * - sets the current admin as actor
 */
export async function createGlobalNotification(
  currentUser,
  { title, message },
  recipientUserIds,
  session
) {
  assertAdmin(currentUser);

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

  const uniqueRecipientIds = [
    ...new Set(recipientUserIds.map((id) => id.toString())),
  ];

  uniqueRecipientIds.forEach((userId) => {
    assertValidObjectId(userId, "recipient user ID");
  });

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

    // The administrator creating the announcement.
    actorId: currentUser._id,

    // The type is controlled by the Service.
    type: NOTIFICATION_TYPES.ANNOUNCEMENT,

    title: normalizedTitle,
    message: normalizedMessage,

    recipeId: null,
    commentId: null,
    ticketId: null,

    // System-managed fields.
    isRead: false,
    readAt: null,
  }));

  return createNotificationsRepository(notifications, session);
}
