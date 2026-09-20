import mongoose from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";

import AppError from "@/lib/errors/AppError";

import {
  findNotificationByIdAndUser,
  findNotificationsByUser,
  createNotification as createNotificationRepository,
  createNotifications as createNotificationsRepository,
  markNotificationAsRead,
  countUnreadNotifications,
  deleteNotificationByUser,
} from "@/db/repositories/notification.repository";

import { findActiveUsersByIds } from "@/db/repositories/user.repository";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_TYPES = {
  RECIPE_RATED: "RECIPE_RATED",
  RECIPE_COMMENTED: "RECIPE_COMMENTED",
  COMMENT_REPLIED: "COMMENT_REPLIED",
  COMMENT_LIKED: "COMMENT_LIKED",
  COMMENT_DISLIKED: "COMMENT_DISLIKED",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  SUPPORT_REPLIED: "SUPPORT_REPLIED",
};

const VALID_NOTIFICATION_TYPES = new Set(Object.values(NOTIFICATION_TYPES));

const DEFAULT_LIMIT = 16;
const MAX_LIMIT = 50;

const CURSOR_VERSION = 1;
const CURSOR_SECRET = process.env.CURSOR_SECRET;

if (!CURSOR_SECRET) {
  throw new Error("CURSOR_SECRET is not configured.");
}

/* -------------------------------------------------------------------------- */
/* Authentication / Authorization                                             */
/* -------------------------------------------------------------------------- */

function assertAuthenticated(currentUser) {
  if (!currentUser?._id) {
    throw new AppError(
      "Authentication is required.",
      "AUTHENTICATION_REQUIRED",
      401
    );
  }
}

function assertAdmin(currentUser) {
  assertAuthenticated(currentUser);

  if (currentUser.role !== "ADMIN") {
    throw new AppError(
      "Administrator privileges are required.",
      "ADMIN_ACCESS_REQUIRED",
      403
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function assertValidObjectId(value, fieldName = "ID") {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}.`, "INVALID_OBJECT_ID", 400);
  }
}

function assertValidNotificationType(type) {
  if (!VALID_NOTIFICATION_TYPES.has(type)) {
    throw new AppError(
      "Invalid notification type.",
      "INVALID_NOTIFICATION_TYPE",
      400
    );
  }
}

function normalizeLimit(limit) {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }

  const normalizedLimit = Number(limit);

  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
    throw new AppError(
      "Notification limit must be a positive integer.",
      "INVALID_LIMIT",
      400
    );
  }

  return Math.min(normalizedLimit, MAX_LIMIT);
}

function normalizeNotificationText(value, fieldName) {
  if (typeof value !== "string") {
    throw new AppError(
      `${fieldName} is required.`,
      "INVALID_NOTIFICATION_DATA",
      400
    );
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new AppError(
      `${fieldName} cannot be empty.`,
      "INVALID_NOTIFICATION_DATA",
      400
    );
  }

  return normalizedValue;
}

/* -------------------------------------------------------------------------- */
/* Cursor Helpers                                                              */
/* -------------------------------------------------------------------------- */

function createCursorSignature(payload) {
  return createHmac("sha256", CURSOR_SECRET).update(payload).digest("hex");
}

function encodeCursor({ userId, createdAt, id }) {
  const payloadObject = {
    v: CURSOR_VERSION,
    userId: userId.toString(),
    createdAt: new Date(createdAt).toISOString(),
    id: id.toString(),
  };

  const payload = Buffer.from(JSON.stringify(payloadObject)).toString(
    "base64url"
  );

  const signature = createCursorSignature(payload);

  return `${payload}.${signature}`;
}

function decodeCursor(cursor, userId) {
  if (typeof cursor !== "string" || !cursor.trim()) {
    throw new AppError("Invalid notification cursor.", "INVALID_CURSOR", 400);
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw new AppError("Invalid notification cursor.", "INVALID_CURSOR", 400);
  }

  const [payload, signature] = parts;
  const expectedSignature = createCursorSignature(payload);

  const actualBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new AppError("Invalid notification cursor.", "INVALID_CURSOR", 400);
  }

  let parsedPayload;

  try {
    parsedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
  } catch {
    throw new AppError("Invalid notification cursor.", "INVALID_CURSOR", 400);
  }

  if (parsedPayload.v !== CURSOR_VERSION) {
    throw new AppError(
      "Unsupported notification cursor version.",
      "INVALID_CURSOR",
      400
    );
  }

  assertValidObjectId(parsedPayload.userId, "cursor user ID");

  assertValidObjectId(parsedPayload.id, "cursor notification ID");

  if (parsedPayload.userId !== userId.toString()) {
    throw new AppError(
      "Notification cursor does not belong to this user.",
      "INVALID_CURSOR",
      400
    );
  }

  const createdAt = new Date(parsedPayload.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new AppError(
      "Invalid notification cursor date.",
      "INVALID_CURSOR",
      400
    );
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(parsedPayload.id),
  };
}

function createNextCursor(notification, userId) {
  if (!notification) {
    return null;
  }

  return encodeCursor({
    userId,
    createdAt: notification.createdAt,
    id: notification._id,
  });
}

/* -------------------------------------------------------------------------- */
/* Notification Data Helpers                                                   */
/* -------------------------------------------------------------------------- */

function normalizeSystemNotificationData(notificationData) {
  if (!notificationData || typeof notificationData !== "object") {
    throw new AppError(
      "Notification data is required.",
      "INVALID_NOTIFICATION_DATA",
      400
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
    supportTicketId = null,
  } = notificationData;

  assertValidObjectId(userId, "user ID");
  assertValidNotificationType(type);

  if (actorId !== null) {
    assertValidObjectId(actorId, "actor ID");
  }

  if (recipeId !== null) {
    assertValidObjectId(recipeId, "recipe ID");
  }

  if (commentId !== null) {
    assertValidObjectId(commentId, "comment ID");
  }

  if (supportTicketId !== null) {
    assertValidObjectId(supportTicketId, "support ticket ID");
  }

  return {
    userId,
    actorId,
    type,
    title: normalizeNotificationText(title, "Title"),
    message: normalizeNotificationText(message, "Message"),
    recipeId,
    commentId,
    supportTicketId,

    // System-managed fields.
    isRead: false,
    readAt: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Get Notification                                                            */
/* -------------------------------------------------------------------------- */

export async function getNotificationById(currentUser, notificationId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(notificationId, "notification ID");

  const notification = await findNotificationByIdAndUser(
    notificationId,
    currentUser._id
  );

  if (!notification) {
    throw new AppError(
      "Notification not found.",
      "NOTIFICATION_NOT_FOUND",
      404
    );
  }

  return notification;
}

/* -------------------------------------------------------------------------- */
/* Get Notifications                                                           */
/* -------------------------------------------------------------------------- */

export async function getNotifications(
  currentUser,
  { cursor = null, limit = DEFAULT_LIMIT } = {}
) {
  assertAuthenticated(currentUser);

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor = cursor ? decodeCursor(cursor, currentUser._id) : null;

  const notifications = await findNotificationsByUser({
    userId: currentUser._id,
    cursor: decodedCursor,
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
/* Unread Count                                                                */
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
    throw new AppError(
      "Notification not found.",
      "NOTIFICATION_NOT_FOUND",
      404
    );
  }

  // Idempotent behavior:
  // if already read, keep the original readAt timestamp.
  if (notification.isRead) {
    return notification;
  }

  const updatedNotification = await markNotificationAsRead(
    notificationId,
    currentUser._id
  );

  if (!updatedNotification) {
    throw new AppError(
      "Notification not found.",
      "NOTIFICATION_NOT_FOUND",
      404
    );
  }

  return updatedNotification;
}

/* -------------------------------------------------------------------------- */
/* Delete Notification                                                         */
/* -------------------------------------------------------------------------- */

export async function deleteNotification(currentUser, notificationId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(notificationId, "notification ID");

  const deletedNotification = await deleteNotificationByUser(
    notificationId,
    currentUser._id
  );

  if (!deletedNotification) {
    throw new AppError(
      "Notification not found.",
      "NOTIFICATION_NOT_FOUND",
      404
    );
  }

  return deletedNotification;
}

/* -------------------------------------------------------------------------- */
/* Internal / System Notification                                              */
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
/* Global / Admin Notification                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Create an announcement notification for multiple
 * active users.
 *
 * `recipientUserIds` should contain the intended recipients.
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
      "Recipient user IDs must be an array.",
      "INVALID_RECIPIENTS",
      400
    );
  }

  if (recipientUserIds.length === 0) {
    throw new AppError(
      "At least one recipient is required.",
      "NO_RECIPIENTS",
      400
    );
  }

  const normalizedTitle = normalizeNotificationText(title, "Title");

  const normalizedMessage = normalizeNotificationText(message, "Message");

  const uniqueRecipientIds = [
    ...new Set(recipientUserIds.map((id) => id.toString())),
  ];

  uniqueRecipientIds.forEach((userId) => {
    assertValidObjectId(userId, "recipient user ID");
  });

  const activeUsers = await findActiveUsersByIds(uniqueRecipientIds, session);

  if (activeUsers.length === 0) {
    throw new AppError(
      "No active recipients were found.",
      "NO_ACTIVE_RECIPIENTS",
      400
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
    supportTicketId: null,

    // System-managed fields.
    isRead: false,
    readAt: null,
  }));

  return createNotificationsRepository(notifications, session);
}
