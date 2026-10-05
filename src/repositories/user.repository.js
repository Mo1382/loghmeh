import User from "@/models/User";

import { ACCOUNT_STATUSES, USER_SORTS, USER_STATS } from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * ==========================================================================
 * Cursor Helpers
 * ==========================================================================
 */

/**
 * Build a cursor filter for the selected User sort.
 *
 * Cursor structure:
 *
 * {
 *   value: Number | Date,
 *   id: ObjectId
 * }
 *
 * The cursor uses a two-field ordering:
 *
 *   primary sort field + _id
 *
 * This guarantees a stable and deterministic order even when
 * multiple Users have the same primary sort value.
 *
 * Sort direction:
 *
 *   HIGHEST_RATED -> descending
 *   MOST_VIEWED   -> descending
 *   NEWEST        -> descending
 *   OLDEST        -> ascending
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
 * Build the MongoDB sort option for the selected User sort.
 *
 * _id is used as the deterministic tie-breaker and must use
 * the same direction as the primary sort field.
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
 * ==========================================================================
 * Internal Helpers
 * ==========================================================================
 */

/**
 * Add an atomic guard for mutations that increment sessionVersion
 * by exactly one.
 *
 * The increment is safe only when:
 *
 *   sessionVersion + 1 <= Number.MAX_SAFE_INTEGER
 *
 * which is equivalent to:
 *
 *   sessionVersion < Number.MAX_SAFE_INTEGER
 *
 * When the guard fails, the mutation matches no document and
 * findOneAndUpdate() returns null.
 */
function addSessionVersionIncrementGuard(filter) {
  return {
    ...filter,
    $expr: {
      $lt: ["$sessionVersion", Number.MAX_SAFE_INTEGER],
    },
  };
}

/**
 * ==========================================================================
 * Read
 * ==========================================================================
 */

/**
 * Find a non-deleted User by ID.
 *
 * Account status is intentionally not checked.
 *
 * This query is used by internal operations that may need to resolve
 * Users whose account is suspended or deactivated.
 */
export function findNonDeletedUserById(userId, session) {
  const query = User.findOne({
    _id: userId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find an active, verified, non-deleted User by ID.
 *
 * Only Users that are currently available as active accounts
 * are returned.
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
 * Find an active, verified, non-deleted User by username.
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
 * Intended for authentication-related operations where the password
 * hash is required.
 */
export function findUserByIdWithPassword(userId, session) {
  const query = User.findOne({
    _id: userId,
    deletedAt: null,
  }).select("+password");

  return applySession(query, session);
}

/**
 * Find active, verified, non-deleted Users by their IDs.
 *
 * Only Users that are currently eligible as active accounts
 * are returned.
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
 * Password is explicitly selected because this query is intended
 * for authentication.
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
 * ==========================================================================
 * Create
 * ==========================================================================
 */

/**
 * Create a new User.
 *
 * When a session is provided, the creation participates in the
 * surrounding MongoDB transaction.
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
 * ==========================================================================
 * Profile / Account
 * ==========================================================================
 */

/**
 * Update the profile fields of a non-deleted User.
 *
 * Authorization and allowed-field selection are responsibilities
 * of the Service layer.
 */
export function updateUserProfileById(userId, updates, session) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
    },
    {
      $set: updates,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Update a User's password.
 *
 * sessionVersion is incremented so the authentication/session layer
 * can invalidate previously issued sessions.
 */
export function updateUserPassword(userId, passwordHash, session) {
  const filter = addSessionVersionIncrementGuard({
    _id: userId,
    deletedAt: null,
  });

  const query = User.findOneAndUpdate(
    filter,
    {
      $set: {
        password: passwordHash,
      },
      $inc: {
        sessionVersion: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Mark a User's email as verified.
 *
 * Only the expected pending/unverified state can transition
 * to active/verified.
 *
 * Repeated verification attempts do not match and return null.
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Update a User's account status.
 *
 * Authorization and lifecycle transition policy belong to the
 * Service layer.
 *
 * Persistence-level lifecycle invariants are enforced here:
 *
 *   ACTIVE
 *     -> emailVerified must be true
 *
 *   PENDING_VERIFICATION
 *     -> emailVerified must be false
 *
 * sessionVersion is incremented only when the status actually changes.
 *
 * When the status remains unchanged, the version increment is zero,
 * so the operation remains valid even when sessionVersion is already
 * at Number.MAX_SAFE_INTEGER.
 *
 * When the status changes, sessionVersion must still be safely
 * incrementable.
 */
export function updateAccountStatus(userId, accountStatus, session) {
  if (!Object.values(ACCOUNT_STATUSES).includes(accountStatus)) {
    throw new Error("Invalid account status.");
  }

  const filter = {
    _id: userId,
    deletedAt: null,
    $expr: {
      $or: [
        {
          $eq: ["$accountStatus", accountStatus],
        },
        {
          $lt: ["$sessionVersion", Number.MAX_SAFE_INTEGER],
        },
      ],
    },
  };

  if (accountStatus === ACCOUNT_STATUSES.ACTIVE) {
    filter.emailVerified = true;
  }

  if (accountStatus === ACCOUNT_STATUSES.PENDING_VERIFICATION) {
    filter.emailVerified = false;
  }

  const query = User.findOneAndUpdate(
    filter,
    [
      {
        $set: {
          accountStatus,
          sessionVersion: {
            $add: [
              "$sessionVersion",
              {
                $cond: [
                  {
                    $eq: ["$accountStatus", accountStatus],
                  },
                  0,
                  1,
                ],
              },
            ],
          },
        },
      },
    ],
    {
      // Deprecated after Mongoose v9
      // new: true,
      returnDocument: "after",
      // Needed after Mongoose v9
      updatePipeline: true,
    }
  );

  return applySession(query, session);
}

/**
 * Soft-delete a User.
 *
 * Only non-deleted Users can be soft-deleted.
 *
 * sessionVersion is incremented to allow the authentication/session
 * layer to invalidate previously issued sessions.
 */
export function softDeleteUser(
  userId,
  { deletedAt = new Date(), session } = {}
) {
  const filter = addSessionVersionIncrementGuard({
    _id: userId,
    deletedAt: null,
  });

  const query = User.findOneAndUpdate(
    filter,
    {
      $set: {
        deletedAt,
      },
      $inc: {
        sessionVersion: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Restore a soft-deleted User.
 *
 * Only Users that are currently soft-deleted can be restored.
 *
 * sessionVersion is incremented to allow the authentication/session
 * layer to invalidate previously issued sessions.
 */
export function restoreUser(userId, session) {
  const filter = addSessionVersionIncrementGuard({
    _id: userId,
    deletedAt: {
      $ne: null,
    },
  });

  const query = User.findOneAndUpdate(
    filter,
    {
      $set: {
        deletedAt: null,
      },
      $inc: {
        sessionVersion: 1,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * ==========================================================================
 * User Lists
 * ==========================================================================
 */

/**
 * Find active, verified, non-deleted Users using cursor-based pagination.
 *
 * The Service layer is responsible for:
 *
 *   - validating the requested sort
 *   - decoding and validating the cursor
 *   - determining the requested page size
 *   - creating the next cursor
 *   - calculating hasMore
 *
 * This Repository method is responsible for constructing the
 * database filter, cursor condition, sort and limit.
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
    queryFilter.$and = [cursorFilter, ...(queryFilter.$and ?? [])];
  }

  const sortOption = buildUserSortOption(sort);
  const query = User.find(queryFilter).sort(sortOption).limit(limit);

  return applySession(query, session);
}

/**
 * ==========================================================================
 * Simple User Statistics
 * ==========================================================================
 */

/**
 * Statistics that may be incremented independently.
 *
 * Rating statistics are intentionally excluded because:
 *
 *   ratingCount
 *   ratingSum
 *   averageRating
 *
 * form a single calculated projection and must be updated together.
 */
const INDEPENDENT_INCREMENTABLE_USER_STATS = [
  USER_STATS.RECIPE_COUNT,
  USER_STATS.TOTAL_RECIPE_VIEWS,
];

/**
 * Increment one independently maintained User statistic.
 *
 * The mutation:
 *
 *   - accepts only explicitly allowed statistics
 *   - requires a non-zero safe integer delta
 *   - prevents the result from becoming negative
 *   - prevents the result from exceeding Number.MAX_SAFE_INTEGER
 *
 * The final-value bounds are checked atomically in MongoDB.
 */
function incrementUserStat(userId, stat, delta = 1, session) {
  if (!INDEPENDENT_INCREMENTABLE_USER_STATS.includes(stat)) {
    throw new Error("Invalid independently incrementable user stat.");
  }

  if (!Number.isSafeInteger(delta) || delta === 0) {
    throw new Error("User stat delta must be a non-zero safe integer.");
  }

  const statPath = `stats.${stat}`;

  const currentValue = {
    $ifNull: [`$${statPath}`, 0],
  };

  const nextValue = {
    $add: [currentValue, delta],
  };

  const query = User.findOneAndUpdate(
    {
      _id: userId,
      deletedAt: null,
      $expr: {
        $and: [
          {
            $gte: [nextValue, 0],
          },
          {
            $lte: [nextValue, Number.MAX_SAFE_INTEGER],
          },
        ],
      },
    },
    {
      $inc: {
        [statPath]: delta,
      },
    },
    {
      returnDocument: "after",
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
 * ==========================================================================
 * User Statistics Reconciliation
 * ==========================================================================
 *
 * Replaces the user's stored statistics with a complete, reconciled snapshot.
 *
 * Source of truth:
 *   - Recipe collection
 *   - Rating collection
 *
 * Reconciled statistics:
 *   - recipeCount
 *   - totalRecipeViews
 *   - ratingCount
 *   - ratingSum
 *   - averageRating
 *
 * Intended for statistics reconciliation and repair operations.
 */

const SETTABLE_USER_STAT_FIELDS = [
  "recipeCount",
  "totalRecipeViews",
  "ratingCount",
  "ratingSum",
  "averageRating",
];

/**
 * Calculates the average rating rounded to two decimal places.
 *
 * Uses BigInt arithmetic to avoid floating-point precision issues and
 * reproduce MongoDB's round-half-to-even behavior.
 */
function calculateRoundedAverage(ratingSum, ratingCount) {
  // No ratings means the average rating must be zero.
  if (ratingCount === 0) {
    return 0;
  }

  // Scale the division by 100 so the result can be rounded to two decimals.
  const numerator = BigInt(ratingSum) * 100n;
  const denominator = BigInt(ratingCount);

  // Integer division gives the value before rounding.
  let rounded = numerator / denominator;

  // Determine whether the remainder requires rounding up.
  const remainder = numerator % denominator;
  const twiceRemainder = remainder * 2n;

  // Apply round-half-to-even.
  if (
    twiceRemainder > denominator ||
    (twiceRemainder === denominator && rounded % 2n === 1n)
  ) {
    rounded += 1n;
  }

  return Number(rounded) / 100;
}

/**
 * Validates a complete user statistics snapshot.
 *
 * Ensures:
 *   - All statistics are provided.
 *   - Individual field values are valid.
 *   - Cross-field rating invariants are satisfied.
 *   - averageRating matches ratingSum / ratingCount.
 */
function assertCompleteAndValidUserStats(stats) {
  // Statistics must be provided as an object.
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) {
    throw new TypeError("User stats must be a plain object.");
  }

  // Reconciliation requires the complete statistics snapshot.
  for (const field of SETTABLE_USER_STAT_FIELDS) {
    if (!Object.hasOwn(stats, field) || stats[field] === undefined) {
      throw new Error(`User stat "${field}" is required.`);
    }
  }

  const {
    recipeCount,
    totalRecipeViews,
    ratingCount,
    ratingSum,
    averageRating,
  } = stats;

  // These statistics must be non-negative safe integers.
  const nonNegativeIntegerFields = [
    ["recipeCount", recipeCount],
    ["totalRecipeViews", totalRecipeViews],
    ["ratingCount", ratingCount],
    ["ratingSum", ratingSum],
  ];

  for (const [field, value] of nonNegativeIntegerFields) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(
        `User stat "${field}" must be a non-negative safe integer.`
      );
    }
  }

  // averageRating must be a finite number in the [0, 5] range
  // with at most two decimal places.
  if (
    typeof averageRating !== "number" ||
    !Number.isFinite(averageRating) ||
    averageRating < 0 ||
    averageRating > 5
  ) {
    throw new TypeError(
      'User stat "averageRating" must be a finite number between 0 and 5.'
    );
  }

  // When there are no ratings, both their sum and average must be zero.
  if (ratingCount === 0) {
    if (ratingSum !== 0 || averageRating !== 0) {
      throw new Error(
        "When ratingCount is zero, ratingSum and averageRating must also be zero."
      );
    }

    return;
  }

  const ratingCountBigInt = BigInt(ratingCount);
  const ratingSumBigInt = BigInt(ratingSum);

  // Because each rating is between 1 and 5:
  //   ratingCount <= ratingSum <= ratingCount * 5
  if (
    ratingSumBigInt < ratingCountBigInt ||
    ratingSumBigInt > ratingCountBigInt * 5n
  ) {
    throw new Error(
      "ratingSum must be between ratingCount and ratingCount multiplied by 5."
    );
  }

  // averageRating must exactly match the reconciled rating sum and count.
  const expectedAverage = calculateRoundedAverage(ratingSum, ratingCount);

  if (averageRating !== expectedAverage) {
    throw new Error(
      "averageRating must equal the rounded average of ratingSum divided by ratingCount."
    );
  }
}

/**
 * Replaces the user's stored statistics with a complete reconciled snapshot.
 *
 * Only non-deleted users can be reconciled. The statistics are replaced
 * atomically, and Mongoose schema validators are also applied.
 */
export function setUserStats(userId, stats, session) {
  // Validate the complete snapshot and all cross-field invariants
  // before sending the update to MongoDB.
  assertCompleteAndValidUserStats(stats);

  const {
    recipeCount,
    totalRecipeViews,
    ratingCount,
    ratingSum,
    averageRating,
  } = stats;

  // Replace all stored statistics in a single update operation.
  const query = User.findOneAndUpdate(
    {
      _id: userId,

      // Statistics reconciliation is allowed only for non-deleted users.
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
      // Return the user document after the statistics have been updated.
      returnDocument: "after",

      // Also enforce the validators defined in the User schema.
      runValidators: true,
    }
  );

  // Execute the query within the provided session when one is supplied.
  return applySession(query, session);
}

/**
 * ==========================================================================
 * User Rating Statistics
 * ==========================================================================
 */

/**
 * Atomically update User rating statistics using deltas.
 *
 * This is the normal mutation path for Rating operations.
 *
 * Create:
 *
 *   ratingCountDelta = +1
 *   ratingSumDelta   = +value
 *
 * Update:
 *
 *   ratingCountDelta = 0
 *   ratingSumDelta   = newValue - oldValue
 *
 * Delete:
 *
 *   ratingCountDelta = -1
 *   ratingSumDelta   = -oldValue
 *
 * The following fields are updated together:
 *
 *   - stats.ratingCount
 *   - stats.ratingSum
 *   - stats.averageRating
 *
 * The new average is calculated from the resulting count and sum.
 *
 * $round stores the resulting average according to the application's
 * two-decimal precision contract.
 *
 * All relevant numeric and domain invariants are checked atomically
 * in the query before the update is applied.
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
   * Current stored projection values.
   *
   * $ifNull provides a safe fallback for incomplete legacy data.
   */
  const currentCount = {
    $ifNull: ["$stats.ratingCount", 0],
  };

  const currentSum = {
    $ifNull: ["$stats.ratingSum", 0],
  };

  /**
   * Resulting values after applying the requested deltas.
   */
  const nextCount = {
    $add: [currentCount, ratingCountDelta],
  };

  const nextSum = {
    $add: [currentSum, ratingSumDelta],
  };

  /**
   * Recalculate the average from the resulting count and sum.
   *
   * When there are no ratings, the average is explicitly reset to zero.
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
   * Rating-domain invariant.
   *
   * When ratingCount === 0:
   *
   *   ratingSum === 0
   *
   * When ratingCount > 0:
   *
   *   ratingCount <= ratingSum <= ratingCount * 5
   *
   * Because valid Rating values are restricted to the range 1..5,
   * these conditions keep the resulting average within 0..5.
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

  /**
   * Atomic numeric and domain constraints.
   *
   * Both resulting values must remain Safe Integers:
   *
   *   0 <= nextCount <= Number.MAX_SAFE_INTEGER
   *   0 <= nextSum   <= Number.MAX_SAFE_INTEGER
   *
   * The rating invariant is also enforced before the update is applied.
   */
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
            $lte: [nextCount, Number.MAX_SAFE_INTEGER],
          },
          {
            $gte: [nextSum, 0],
          },
          {
            $lte: [nextSum, Number.MAX_SAFE_INTEGER],
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
      returnDocument: "after",
      updatePipeline: true,
    }
  );

  return applySession(query, session);
}
