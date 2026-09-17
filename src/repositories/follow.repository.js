import Follow from "@/db/models/Follow";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a follow relationship by its ID.
 */
export function findFollowById(followId, session) {
  const query = Follow.findById(followId);

  return applySession(query, session);
}

/**
 * Find a specific follow relationship.
 *
 * Useful for checking whether a user already follows
 * another user.
 */
export function findFollowByFollowerAndFollowing(
  followerId,
  followingId,
  session
) {
  const query = Follow.findOne({
    followerId,
    followingId,
  });

  return applySession(query, session);
}

/**
 * Create a follow relationship.
 *
 * followerId and followingId are determined by the
 * authenticated user and the target user.
 */
export function createFollow(followData, session) {
  if (session) {
    return Follow.create([followData], { session }).then(([follow]) => follow);
  }

  return Follow.create(followData);
}

/**
 * Delete a follow relationship between two users.
 */
export function deleteFollowByFollowerAndFollowing(
  followerId,
  followingId,
  session
) {
  const query = Follow.findOneAndDelete({
    followerId,
    followingId,
  });

  return applySession(query, session);
}

/**
 * Delete a follow relationship by its ID.
 *
 * Authorization must be handled in the Service layer.
 * Prefer deleteFollowByFollowerAndFollowing() for
 * normal user operations.
 */
export function deleteFollowById(followId, session) {
  const query = Follow.findByIdAndDelete(followId);

  return applySession(query, session);
}

/**
 * Find users that a specific user is following.
 *
 * Returns Follow documents ordered by the time the
 * relationship was created.
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
export function findFollowingByUser({
  followerId,
  cursor = null,
  limit = 16,
  session,
}) {
  const filter = {
    followerId,
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

  const query = Follow.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Find users who follow a specific user.
 *
 * Returns Follow documents ordered by the time the
 * relationship was created.
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
export function findFollowersByUser({
  followingId,
  cursor = null,
  limit = 16,
  session,
}) {
  const filter = {
    followingId,
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

  const query = Follow.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Count how many users a user is following.
 */
export function countFollowingByUser(followerId, session) {
  const query = Follow.countDocuments({
    followerId,
  });

  return applySession(query, session);
}

/**
 * Count how many followers a user has.
 */
export function countFollowersByUser(followingId, session) {
  const query = Follow.countDocuments({
    followingId,
  });

  return applySession(query, session);
}
