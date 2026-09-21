import Notification from "@/models/Notification";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a notification by its ID.
 */
export function findNotificationById(notificationId, session) {
  const query = Notification.findById(notificationId);

  return applySession(query, session);
}

/**
 * Find a notification belonging to a specific user.
 *
 * Useful for retrieving a notification while ensuring
 * it belongs to the specified user.
 */
export function findNotificationByIdAndUser(notificationId, userId, session) {
  const query = Notification.findOne({
    _id: notificationId,
    userId,
  });

  return applySession(query, session);
}

/**
 * Find a user's notifications using cursor-based loading.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 *
 * Cursor structure:
 * {
 *   createdAt: Date,
 *   id: ObjectId
 * }
 */
export function findNotificationsByUser({
  userId,
  cursor = null,
  limit = 16,
  session,
}) {
  const filter = {
    userId,
  };

  if (cursor) {
    filter.$or = [
      {
        createdAt: {
          $lt: cursor.createdAt,
        },
      },
      {
        createdAt: cursor.createdAt,
        _id: {
          $lt: cursor.id,
        },
      },
    ];
  }

  const query = Notification.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Create a notification for one user.
 *
 * Notification content and recipient are determined
 * by the Service layer.
 */
export function createNotification(notificationData, session) {
  if (session) {
    return Notification.create([notificationData], { session }).then(
      ([notification]) => notification
    );
  }

  return Notification.create(notificationData);
}

/**
 * Create multiple notifications.
 *
 * Useful for global/admin announcements that need to
 * create one notification document per recipient.
 */
export function createNotifications(notifications, session) {
  return Notification.insertMany(notifications, session ? { session } : {});
}

/**
 * Mark a user's notification as read.
 *
 * Returns the updated notification.
 */
export function markNotificationAsRead(
  notificationId,
  userId,
  readAt = new Date(),
  session
) {
  const query = Notification.findOneAndUpdate(
    {
      _id: notificationId,
      userId,
    },
    {
      $set: {
        isRead: true,
        readAt,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Count unread notifications for a user.
 */
export function countUnreadNotifications(userId, session) {
  const query = Notification.countDocuments({
    userId,
    isRead: false,
  });

  return applySession(query, session);
}

/**
 * Delete a user's notification.
 */
export function deleteNotificationByUser(notificationId, userId, session) {
  const query = Notification.findOneAndDelete({
    _id: notificationId,
    userId,
  });

  return applySession(query, session);
}

/**
 * Delete a notification by its ID.
 *
 * Authorization must be handled in the Service layer.
 * Prefer deleteNotificationByUser() for normal user operations.
 */
export function deleteNotificationById(notificationId, session) {
  const query = Notification.findByIdAndDelete(notificationId);

  return applySession(query, session);
}
