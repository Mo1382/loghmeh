import User from "@/models/User";
import { ACCOUNT_STATUSES, USER_SORTS, USER_STATS } from "@/constants/enums";
import { applySession } from "@/lib/helpers/apply-session";

/**
 * Allowed user statistics that can be updated using $inc.
 */
/**
 * Available sorting options for user lists.
 */
/**
 * Build a cursor filter according to the selected sort.
 *
 * Cursor structure:
 * {
 *   value: Number | Date,
 *   id: ObjectId
 * }
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
 * Find a user by ID.
 */
export function findUserById(userId, session) {
  const query = User.findOne({
    _id: userId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a user by ID.
 */
export function findUserByIdWithPassword(userId, session) {
  const query = User.findOne({
    _id: userId,
    deletedAt: null,
  }).select("+password");

  return applySession(query, session);
}

/**
 * Find active, non-deleted users by their IDs.
 *
 * Used for public/user-facing lists where
 * suspended, deactivated, and soft-deleted accounts
 * must not be displayed.
 */
export function findActiveUsersByIds(userIds, session) {
  const query = User.find({
    _id: { $in: userIds },
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a user by email.
 */
export function findUserByEmail(email, session) {
  const query = User.findOne({
    email,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a user by username.
 */
export function findUserByUsername(username, session) {
  const query = User.findOne({
    username,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a user by email or username.
 *
 * Useful for login.
 */
export function findUserByIdentifier(identifier, session) {
  const query = User.findOne({
    $or: [{ email: identifier }, { username: identifier }],
  }).select("+password");

  return applySession(query, session);
}

/**
 * Create a new user.
 */
export function createUser(userData, session) {
  if (session) {
    return User.create([userData], { session }).then(([user]) => user);
  }

  return User.create(userData);
}

/**
 * Update a user's profile.
 *
 * Only fields explicitly passed in `updates` are modified.
 */
export function updateUserById(userId, updates, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },
    { $set: updates },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Update a user's password.
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
 * Mark user's email as verified.
 */
export function markEmailAsVerified(userId, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
      emailVerified: false,
    },
    {
      $set: {
        emailVerified: true,
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
 * Update account status.
 */
export function updateAccountStatus(userId, accountStatus, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },
    {
      $set: {
        accountStatus,
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
 * Soft-delete a user.
 *
 * The actual permission to perform this operation
 * belongs to the Service layer.
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
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Restore a soft-deleted user.
 */
export function restoreUser(userId, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: { $ne: null },
    },
    {
      $set: {
        deletedAt: null,
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
 * Find multiple users by their IDs.
 *
 * Deleted users are excluded.
 */
export function findUsersByIds(userIds, session) {
  const query = User.find({
    _id: {
      $in: userIds,
    },
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find users using cursor-based loading.
 *
 * Supported sorting:
 * - HIGHEST_RATED
 * - MOST_VIEWED
 * - NEWEST
 * - OLDEST
 *
 * The Service layer is responsible for:
 * - validating the sort
 * - decoding the cursor
 * - creating the next cursor
 * - calculating hasMore
 */
export function findUsers({
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
    queryFilter.$or = cursorFilter.$or;
  }

  let sortOption;

  switch (sort) {
    case USER_SORTS.HIGHEST_RATED:
      sortOption = {
        "stats.averageRating": -1,
        _id: -1,
      };
      break;

    case USER_SORTS.MOST_VIEWED:
      sortOption = {
        "stats.totalRecipeViews": -1,
        _id: -1,
      };
      break;

    case USER_SORTS.NEWEST:
      sortOption = {
        createdAt: -1,
        _id: -1,
      };
      break;

    case USER_SORTS.OLDEST:
      sortOption = {
        createdAt: 1,
        _id: 1,
      };
      break;

    default:
      throw new Error("Invalid user sort.");
  }

  const query = User.find(queryFilter).sort(sortOption).limit(limit);

  return applySession(query, session);
}

/**
 * Update a user's numeric stat using $inc.
 */
export function incrementUserStat(userId, stat, amount = 1, session) {
  if (!Object.values(USER_STATS).includes(stat)) {
    throw new Error("Invalid user stat.");
  }

  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },
    {
      $inc: {
        [`stats.${stat}`]: amount,
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
 * Increment a user's recipe count.
 */
export function incrementRecipeCount(userId, amount = 1, session) {
  return incrementUserStat(userId, USER_STATS.RECIPE_COUNT, amount, session);
}

/**
 * Increment a user's total recipe views.
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
 * Update user's average recipe rating.
 */
export function updateAverageRating(userId, averageRating, session) {
  const query = User.findByIdAndUpdate(
    userId,
    {
      $set: {
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
