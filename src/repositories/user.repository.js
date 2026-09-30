import User from "@/models/User";

import { ACCOUNT_STATUSES, USER_SORTS, USER_STATS } from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

/**
 * Build a cursor filter according to the selected User sort.
 *
 * Cursor structure:
 *
 * {
 *   value: Number | Date,
 *   id: ObjectId
 * }
 *
 * Sort direction:
 *
 * HIGHEST_RATED
 * MOST_VIEWED
 * NEWEST
 *   -> descending
 *
 * OLDEST
 *   -> ascending
 */
function buildCursorFilter(sort, cursor) {
  if (!cursor) {
    return null;
  }

  switch (sort) {
    case USER_SORTS.HIGHEST_RATED:
      return {
        $or: [
          {
            "stats.averageRating": {
              $lt: cursor.value,
            },
          },
          {
            "stats.averageRating": cursor.value,
            _id: {
              $lt: cursor.id,
            },
          },
        ],
      };

    case USER_SORTS.MOST_VIEWED:
      return {
        $or: [
          {
            "stats.totalRecipeViews": {
              $lt: cursor.value,
            },
          },
          {
            "stats.totalRecipeViews": cursor.value,
            _id: {
              $lt: cursor.id,
            },
          },
        ],
      };

    case USER_SORTS.NEWEST:
      return {
        $or: [
          {
            createdAt: {
              $lt: cursor.value,
            },
          },
          {
            createdAt: cursor.value,
            _id: {
              $lt: cursor.id,
            },
          },
        ],
      };

    case USER_SORTS.OLDEST:
      return {
        $or: [
          {
            createdAt: {
              $gt: cursor.value,
            },
          },
          {
            createdAt: cursor.value,
            _id: {
              $gt: cursor.id,
            },
          },
        ],
      };

    default:
      throw new Error("Invalid user sort.");
  }
}

/**
 * Build the MongoDB sort option according to the selected User sort.
 */
function buildUserSortOption(sort) {
  switch (sort) {
    case USER_SORTS.HIGHEST_RATED:
      return {
        "stats.averageRating": -1,
        _id: -1,
      };

    case USER_SORTS.MOST_VIEWED:
      return {
        "stats.totalRecipeViews": -1,
        _id: -1,
      };

    case USER_SORTS.NEWEST:
      return {
        createdAt: -1,
        _id: -1,
      };

    case USER_SORTS.OLDEST:
      return {
        createdAt: 1,
        _id: 1,
      };

    default:
      throw new Error("Invalid user sort.");
  }
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Find a non-deleted User by ID.
 *
 * Account status is intentionally not checked.
 *
 * This method is intended for internal operations where
 * suspended/deactivated Users may still need to be resolved.
 */
export function findNonDeletedUserById(userId, session) {
  const query = User.findOne({
    _id: userId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find an active, non-deleted User by ID.
 */
export function findActiveUserById(userId, session) {
  const query = User.findOne({
    _id: userId,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find an active, non-deleted User by username.
 */
export function findActiveUserByUsername(username, session) {
  const query = User.findOne({
    username,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a non-deleted User by ID and explicitly include password.
 *
 * Intended for authentication flows.
 */
export function findUserByIdWithPassword(userId, session) {
  const query = User.findOne({
    _id: userId,
    deletedAt: null,
  }).select("+password");

  return applySession(query, session);
}

/**
 * Find active, non-deleted Users by their IDs.
 *
 * Used for public/user-facing data.
 */
export function findActiveUsersByIds(userIds, session) {
  const query = User.find({
    _id: {
      $in: userIds,
    },
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a non-deleted User by email.
 */
export function findUserByEmail(email, session) {
  const query = User.findOne({
    email,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a non-deleted User by username.
 */
export function findUserByUsername(username, session) {
  const query = User.findOne({
    username,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a non-deleted User by email or username.
 *
 * Password is explicitly selected for authentication.
 */
export function findUserByIdentifier(identifier, session) {
  const query = User.findOne({
    $or: [
      {
        email: identifier,
      },
      {
        username: identifier,
      },
    ],
    deletedAt: null,
  }).select("+password");

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a new User.
 */
export function createUser(userData, session) {
  if (session) {
    return User.create([userData], {
      session,
    }).then(([user]) => user);
  }

  return User.create(userData);
}

/**
 * --------------------------------------------------------------------------
 * Profile / Account
 * --------------------------------------------------------------------------
 */

/**
 * Update a non-deleted User.
 *
 * Authorization and allowed-field selection belong
 * to the Service layer.
 */
export function updateUserById(userId, updates, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },

    {
      $set: updates,
    },

    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Update a User's password and invalidate
 * existing sessions.
 */
export function updateUserPassword(userId, passwordHash, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },

    {
      $set: {
        password: passwordHash,
      },

      $inc: {
        sessionVersion: 1,
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
 * Mark a User's email as verified.
 *
 * Only an unverified User is matched,
 * making the operation idempotent.
 */
export function verifyUserEmail(userId, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    },

    {
      $set: {
        emailVerified: true,
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
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
 * Update a User's account status.
 *
 * Authorization and lifecycle rules belong to
 * the Service layer.
 *
 * sessionVersion is incremented because account-status
 * changes may invalidate authentication state.
 */
export function updateAccountStatus(userId, accountStatus, session) {
  const filter = {
    _id: userId,
    deletedAt: null,
  };

  if (accountStatus === ACCOUNT_STATUSES.ACTIVE) {
    filter.emailVerified = true;
  }

  const query = User.findOneAndUpdate(
    filter,
    {
      $set: {
        accountStatus,
      },
      $inc: {
        sessionVersion: 1,
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
 * Soft-delete a User.
 *
 * Authorization belongs to the Service layer.
 */
export function softDeleteUser(userId, deletedAt = new Date(), session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },

    {
      $set: {
        deletedAt,
      },

      $inc: {
        sessionVersion: 1,
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
 * Restore a soft-deleted User.
 */
export function restoreUser(userId, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: {
        $ne: null,
      },
    },

    {
      $set: {
        deletedAt: null,
      },

      $inc: {
        sessionVersion: 1,
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
 * --------------------------------------------------------------------------
 * User Lists
 * --------------------------------------------------------------------------
 */

/**
 * Find non-deleted Users using cursor-based pagination.
 *
 * The Service layer is responsible for:
 * - validating sort
 * - decoding cursor
 * - validating cursor context
 * - creating the next cursor
 * - calculating hasMore
 */
export function findNonDeletedUsers({
  filter = {},
  sort = USER_SORTS.MOST_VIEWED,
  cursor = null,
  limit = 16,
  session,
}) {
  const queryFilter = {
    ...filter,
    deletedAt: null,
  };

  const cursorFilter = buildCursorFilter(sort, cursor);

  if (cursorFilter) {
    queryFilter.$and = [
      {
        $or: cursorFilter.$or,
      },
      ...(queryFilter.$and ?? []),
    ];
  }

  const sortOption = buildUserSortOption(sort);

  const query = User.find(queryFilter).sort(sortOption).limit(limit);

  return applySession(query, session);
}

/**
 * Find active, non-deleted Users using cursor-based pagination.
 */
export function findActiveUsers({
  filter = {},
  sort = USER_SORTS.MOST_VIEWED,
  cursor = null,
  limit = 16,
  session,
}) {
  const queryFilter = {
    ...filter,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
    deletedAt: null,
  };

  const cursorFilter = buildCursorFilter(sort, cursor);

  if (cursorFilter) {
    queryFilter.$and = [
      {
        $or: cursorFilter.$or,
      },
      ...(queryFilter.$and ?? []),
    ];
  }

  const sortOption = buildUserSortOption(sort);

  const query = User.find(queryFilter).sort(sortOption).limit(limit);

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Simple User Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Statistics that may safely be incremented independently.
 *
 * Rating statistics are intentionally excluded because:
 *
 * ratingCount
 * ratingSum
 * averageRating
 *
 * must always change together.
 */
const INDEPENDENT_INCREMENTABLE_USER_STATS = new Set([
  USER_STATS.RECIPE_COUNT,
  USER_STATS.TOTAL_RECIPE_VIEWS,
]);

/**
 * Increment one independently maintained User statistic.
 *
 * This function intentionally does NOT allow Rating statistics.
 */
export function incrementUserStat(userId, stat, delta = 1, session) {
  if (!INDEPENDENT_INCREMENTABLE_USER_STATS.has(stat)) {
    throw new Error("Invalid independently incrementable user stat.");
  }

  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("User stat delta must be a non-zero integer.");
  }

  const filter = {
    _id: userId,
    deletedAt: null,
  };

  /**
   * Prevent independently decrementing a statistic
   * below zero.
   */
  if (delta < 0) {
    filter[`stats.${stat}`] = {
      $gte: Math.abs(delta),
    };
  }

  const query = User.findOneAndUpdate(
    filter,

    {
      $inc: {
        [`stats.${stat}`]: delta,
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
 * Increment User.recipeCount.
 */
export function incrementRecipeCount(userId, amount = 1, session) {
  return incrementUserStat(userId, USER_STATS.RECIPE_COUNT, amount, session);
}

/**
 * Increment User.totalRecipeViews.
 */
export function incrementTotalRecipeViews(userId, amount = 1, session) {
  return incrementUserStat(
    userId,
    USER_STATS.TOTAL_RECIPE_VIEWS,
    amount,
    session
  );
}

/**
 * --------------------------------------------------------------------------
 * User Statistics Reconciliation
 * --------------------------------------------------------------------------
 */

/**
 * Replace calculated User statistics.
 *
 * Source of truth:
 * - Recipe collection
 * - Rating collection
 *
 * Projection:
 * - recipeCount
 * - totalRecipeViews
 * - ratingCount
 * - ratingSum
 * - averageRating
 *
 * Used by statistics.service.js during
 * reconciliation and repair operations.
 */
export function setUserStats(
  userId,
  { recipeCount, totalRecipeViews, ratingCount, ratingSum, averageRating },
  session
) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },

    {
      $set: {
        "stats.recipeCount": recipeCount,

        "stats.totalRecipeViews": totalRecipeViews,

        "stats.ratingCount": ratingCount,

        "stats.ratingSum": ratingSum,

        "stats.averageRating": averageRating,
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
 * --------------------------------------------------------------------------
 * User Rating Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Atomically update User rating statistics using deltas.
 *
 * This is the normal mutation path for Rating operations.
 *
 * Create:
 *   ratingCountDelta = +1
 *   ratingSumDelta   = +value
 *
 * Update:
 *   ratingCountDelta = 0
 *   ratingSumDelta   = newValue - oldValue
 *
 * Delete:
 *   ratingCountDelta = -1
 *   ratingSumDelta   = -oldValue
 *
 * The following fields are updated together:
 *
 * - stats.ratingCount
 * - stats.ratingSum
 * - stats.averageRating
 *
 * The new average is calculated from the new count
 * and new sum.
 */

export function updateUserRatingStatsDeltas(
  userId,
  ratingCountDelta,
  ratingSumDelta,
  session
) {
  if (
    !Number.isSafeInteger(ratingCountDelta) ||
    !Number.isSafeInteger(ratingSumDelta)
  ) {
    throw new Error("User rating stat deltas must be safe integers.");
  }

  if (ratingCountDelta === 0 && ratingSumDelta === 0) {
    throw new Error("At least one User rating stat delta must be non-zero.");
  }

  /**
   * Current projection values.
   */
  const currentCount = {
    $ifNull: ["$stats.ratingCount", 0],
  };

  const currentSum = {
    $ifNull: ["$stats.ratingSum", 0],
  };

  /**
   * Values after applying the mutation.
   */
  const nextCount = {
    $add: [currentCount, ratingCountDelta],
  };

  const nextSum = {
    $add: [currentSum, ratingSumDelta],
  };

  /**
   * New average based on the new count and sum.
   *
   * MongoDB $round keeps the stored projection
   * consistent with the application's two-decimal contract.
   */
  const nextAverage = {
    $cond: [
      {
        $gt: [nextCount, 0],
      },
      {
        $round: [
          {
            $divide: [nextSum, nextCount],
          },
          2,
        ],
      },
      0,
    ],
  };

  /**
   * Rating statistics invariant:
   *
   * 1. ratingCount >= 0
   * 2. ratingSum >= 0
   *
   * When ratingCount === 0:
   *   ratingSum === 0
   *
   * When ratingCount > 0:
   *   ratingCount <= ratingSum
   *   ratingSum <= ratingCount * 5
   *
   * Because all valid Rating values are in the range 1..5,
   * these constraints keep the calculated average in 0..5.
   */
  const ratingInvariant = {
    $or: [
      {
        $and: [
          {
            $eq: [nextCount, 0],
          },
          {
            $eq: [nextSum, 0],
          },
        ],
      },
      {
        $and: [
          {
            $gt: [nextCount, 0],
          },
          {
            $gte: [nextSum, nextCount],
          },
          {
            $lte: [
              nextSum,
              {
                $multiply: [nextCount, 5],
              },
            ],
          },
        ],
      },
    ],
  };

  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,

      $expr: {
        $and: [
          {
            $gte: [nextCount, 0],
          },
          {
            $gte: [nextSum, 0],
          },
          ratingInvariant,
        ],
      },
    },
    [
      {
        $set: {
          "stats.ratingCount": nextCount,
          "stats.ratingSum": nextSum,
          "stats.averageRating": nextAverage,
        },
      },
    ],
    {
      new: true,
    }
  );

  return applySession(query, session);
}
