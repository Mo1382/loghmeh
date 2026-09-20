import Follow from "@/db/models/Follow";
import User from "@/db/models/User";

/**
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * --------------------------------------------------------------------------
 * Find
 * --------------------------------------------------------------------------
 */

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
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a follow relationship.
 *
 * followerId and followingId are determined by the
 * Service layer.
 */
export function createFollow(followData, session) {
  if (session) {
    return Follow.create([followData], { session }).then(([follow]) => follow);
  }

  return Follow.create(followData);
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

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
 *
 * Prefer deleteFollowByFollowerAndFollowing()
 * for normal user operations.
 */
export function deleteFollowById(followId, session) {
  const query = Follow.findByIdAndDelete(followId);

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Following
 * --------------------------------------------------------------------------
 */

/**
 * Find users that a specific user is following.
 *
 * Only active, non-deleted target users are included.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 *
 * The active-user filter is applied before pagination so
 * that limit and hasMore remain accurate.
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
  const matchStage = {
    followerId,
  };

  /**
   * Apply cursor condition before looking up users.
   *
   * This allows MongoDB to narrow down the Follow
   * documents before the lookup stage.
   */
  if (cursor) {
    matchStage.$or = [
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

  const pipeline = [
    {
      $match: matchStage,
    },

    /**
     * Resolve the user being followed.
     */
    {
      $lookup: {
        from: User.collection.name,
        localField: "followingId",
        foreignField: "_id",
        as: "followingUser",
      },
    },

    /**
     * Convert the lookup array into a single User document.
     *
     * If the User no longer exists, the Follow document
     * is removed from the result.
     */
    {
      $unwind: "$followingUser",
    },

    /**
     * Only active, non-deleted users are visible.
     */
    {
      $match: {
        "followingUser.accountStatus": "ACTIVE",
        "followingUser.deletedAt": null,
      },
    },

    /**
     * Preserve the Follow pagination order.
     */
    {
      $sort: {
        createdAt: -1,
        _id: -1,
      },
    },

    /**
     * limit is applied AFTER inactive users have
     * been excluded.
     */
    {
      $limit: limit,
    },

    /**
     * Return the Follow document shape expected
     * by the Service layer.
     */
    {
      $project: {
        _id: 1,
        followerId: 1,
        followingId: 1,
        createdAt: 1,
      },
    },
  ];

  const query = Follow.aggregate(pipeline);

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Followers
 * --------------------------------------------------------------------------
 */

/**
 * Find users who follow a specific user.
 *
 * Only active, non-deleted follower users are included.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 *
 * The active-user filter is applied before pagination so
 * that limit and hasMore remain accurate.
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
  const matchStage = {
    followingId,
  };

  /**
   * Apply cursor condition before looking up users.
   */
  if (cursor) {
    matchStage.$or = [
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

  const pipeline = [
    {
      $match: matchStage,
    },

    /**
     * Resolve the user who follows the target user.
     */
    {
      $lookup: {
        from: User.collection.name,
        localField: "followerId",
        foreignField: "_id",
        as: "followerUser",
      },
    },

    /**
     * Remove Follow documents whose follower
     * no longer exists.
     */
    {
      $unwind: "$followerUser",
    },

    /**
     * Only active, non-deleted followers are visible.
     */
    {
      $match: {
        "followerUser.accountStatus": "ACTIVE",
        "followerUser.deletedAt": null,
      },
    },

    /**
     * Preserve Follow pagination order.
     */
    {
      $sort: {
        createdAt: -1,
        _id: -1,
      },
    },

    /**
     * Apply limit after inactive followers
     * have been excluded.
     */
    {
      $limit: limit,
    },

    /**
     * Return only the Follow fields required
     * by the Service layer.
     */
    {
      $project: {
        _id: 1,
        followerId: 1,
        followingId: 1,
        createdAt: 1,
      },
    },
  ];

  const query = Follow.aggregate(pipeline);

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Counts
 * --------------------------------------------------------------------------
 */

/**
 * Count how many active users a user is following.
 *
 * Only Follow relationships whose target user is:
 * - ACTIVE
 * - not soft-deleted
 *
 * are included in the count.
 */
export function countFollowingByUser(followerId, session) {
  const pipeline = [
    {
      $match: {
        followerId,
      },
    },

    {
      $lookup: {
        from: User.collection.name,
        localField: "followingId",
        foreignField: "_id",
        pipeline: [
          {
            $match: {
              accountStatus: "ACTIVE",
              deletedAt: null,
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: "followingUser",
      },
    },

    {
      $match: {
        "followingUser.0": {
          $exists: true,
        },
      },
    },

    {
      $count: "count",
    },
  ];

  const query = Follow.aggregate(pipeline);

  return applySession(query, session).then(([result]) => result?.count ?? 0);
}

/**
 * Count how many active users follow a user.
 *
 * Only Follow relationships whose follower user is:
 * - ACTIVE
 * - not soft-deleted
 *
 * are included in the count.
 */
export function countFollowersByUser(followingId, session) {
  const pipeline = [
    {
      $match: {
        followingId,
      },
    },

    {
      $lookup: {
        from: User.collection.name,
        localField: "followerId",
        foreignField: "_id",
        pipeline: [
          {
            $match: {
              accountStatus: "ACTIVE",
              deletedAt: null,
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: "followerUser",
      },
    },

    {
      $match: {
        "followerUser.0": {
          $exists: true,
        },
      },
    },

    {
      $count: "count",
    },
  ];

  const query = Follow.aggregate(pipeline);

  return applySession(query, session).then(([result]) => result?.count ?? 0);
}
