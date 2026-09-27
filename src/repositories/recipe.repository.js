import Category from "@/models/Category";
import Recipe from "@/models/Recipe";
import User from "@/models/User";

import {
  RECIPE_SORTS,
  RECIPE_STATS,
  ACCOUNT_STATUSES,
} from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * --------------------------------------------------------------------------
 * Query Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Build the cursor condition for the selected sort.
 *
 * The Recipe _id is used as a stable tie-breaker when
 * multiple Recipes have the same sort value.
 */
function buildCursorFilter(sort, cursor) {
  if (!cursor) {
    return null;
  }

  const { value, id } = cursor;

  switch (sort) {
    case RECIPE_SORTS.NEWEST:
      return {
        $or: [
          {
            createdAt: {
              $lt: value,
            },
          },
          {
            createdAt: value,
            _id: {
              $lt: id,
            },
          },
        ],
      };

    case RECIPE_SORTS.OLDEST:
      return {
        $or: [
          {
            createdAt: {
              $gt: value,
            },
          },
          {
            createdAt: value,
            _id: {
              $gt: id,
            },
          },
        ],
      };

    case RECIPE_SORTS.MOST_VIEWED:
      return {
        $or: [
          {
            "stats.viewCount": {
              $lt: value,
            },
          },
          {
            "stats.viewCount": value,
            _id: {
              $lt: id,
            },
          },
        ],
      };

    case RECIPE_SORTS.HIGHEST_RATED:
      return {
        $or: [
          {
            "stats.averageRating": {
              $lt: value,
            },
          },
          {
            "stats.averageRating": value,
            _id: {
              $lt: id,
            },
          },
        ],
      };

    default:
      throw new Error(`Unsupported recipe sort: ${sort}`);
  }
}

/**
 * Build the MongoDB sort option for the selected Recipe sort.
 */
function buildRecipeSortOption(sort) {
  switch (sort) {
    case RECIPE_SORTS.NEWEST:
      return {
        createdAt: -1,
        _id: -1,
      };

    case RECIPE_SORTS.OLDEST:
      return {
        createdAt: 1,
        _id: 1,
      };

    case RECIPE_SORTS.MOST_VIEWED:
      return {
        "stats.viewCount": -1,
        _id: -1,
      };

    case RECIPE_SORTS.HIGHEST_RATED:
      return {
        "stats.averageRating": -1,
        _id: -1,
      };

    default:
      throw new Error(`Unsupported recipe sort: ${sort}`);
  }
}

/**
 * --------------------------------------------------------------------------
 * Accessibility
 * --------------------------------------------------------------------------
 */

/**
 * Build the lookup stages required to determine whether
 * a Recipe is publicly accessible.
 *
 * A Recipe is accessible only when:
 *
 * - Recipe.deletedAt === null
 * - Author exists
 * - Author is ACTIVE
 * - Author is non-deleted
 * - Category exists
 * - Category is active
 *
 * IMPORTANT:
 *
 * These stages only determine accessibility.
 * Authorization remains the responsibility of the Service layer.
 *
 * The same stages are reused by:
 * - findRecipes()
 * - findAccessibleRecipeById()
 * - findAccessibleRecipeBySlug()
 * - findAccessibleRecipesByIds()
 */
function buildRecipeAccessibilityStages() {
  return [
    {
      $lookup: {
        from: User.collection.name,
        localField: "authorId",
        foreignField: "_id",

        pipeline: [
          {
            $match: {
              accountStatus: ACCOUNT_STATUSES.ACTIVE,
              deletedAt: null,
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],

        as: "accessibleAuthor",
      },
    },

    {
      $lookup: {
        from: Category.collection.name,
        localField: "categoryId",
        foreignField: "_id",

        pipeline: [
          {
            $match: {
              isActive: true,
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],

        as: "accessibleCategory",
      },
    },

    {
      $match: {
        "accessibleAuthor.0": {
          $exists: true,
        },

        "accessibleCategory.0": {
          $exists: true,
        },
      },
    },

    {
      $project: {
        accessibleAuthor: 0,
        accessibleCategory: 0,
      },
    },
  ];
}

/**
 * --------------------------------------------------------------------------
 * Find Recipes
 * --------------------------------------------------------------------------
 */

/**
 * Find publicly accessible Recipes with cursor-based pagination.
 *
 * Accessibility filtering is performed before sorting and limiting.
 */
export function findRecipes({
  filter = {},
  sort = RECIPE_SORTS.NEWEST,
  cursor = null,
  limit = 16,
  session,
}) {
  const queryFilter = {
    ...filter,
    deletedAt: null,
  };

  const cursorFilter = buildCursorFilter(sort, cursor);

  const pipeline = [
    {
      $match: queryFilter,
    },
  ];

  if (cursorFilter) {
    pipeline.push({
      $match: cursorFilter,
    });
  }

  pipeline.push(...buildRecipeAccessibilityStages());

  pipeline.push({
    $sort: buildRecipeSortOption(sort),
  });

  pipeline.push({
    $limit: limit,
  });

  const query = Recipe.aggregate(pipeline);

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Find Single Recipe
 * --------------------------------------------------------------------------
 */

/**
 * Find a non-deleted Recipe by ID.
 *
 * Persistence primitive only.
 *
 * This method does NOT verify:
 * - Author accessibility
 * - Category accessibility
 * - Public visibility
 * - Authorization
 */
export function findNonDeletedRecipeById(recipeId, session) {
  const query = Recipe.findOne({
    _id: recipeId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a publicly accessible Recipe by ID.
 *
 * Accessibility policy is enforced inside the Repository.
 */
export async function findAccessibleRecipeById(recipeId, session) {
  const pipeline = [
    {
      $match: {
        _id: recipeId,
        deletedAt: null,
      },
    },

    ...buildRecipeAccessibilityStages(),

    {
      $limit: 1,
    },
  ];

  const query = Recipe.aggregate(pipeline);

  const recipes = await applySession(query, session);

  return recipes[0] ?? null;
}

/**
 * Find a soft-deleted Recipe by ID.
 *
 * Persistence primitive only.
 */
export function findDeletedRecipeById(recipeId, session) {
  const query = Recipe.findOne({
    _id: recipeId,
    deletedAt: {
      $ne: null,
    },
  });

  return applySession(query, session);
}

/**
 * Find a non-deleted Recipe by slug.
 *
 * Persistence primitive only.
 *
 * Does NOT verify:
 * - Author accessibility
 * - Category accessibility
 * - Public visibility
 * - Authorization
 */
export function findNonDeletedRecipeBySlug(slug, session) {
  const query = Recipe.findOne({
    slug,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a publicly accessible Recipe by slug.
 *
 * Accessibility policy is enforced inside the Repository.
 */
export async function findAccessibleRecipeBySlug(slug, session) {
  const pipeline = [
    {
      $match: {
        slug,
        deletedAt: null,
      },
    },

    ...buildRecipeAccessibilityStages(),

    {
      $limit: 1,
    },
  ];

  const query = Recipe.aggregate(pipeline);

  const recipes = await applySession(query, session);

  return recipes[0] ?? null;
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a Recipe.
 *
 * authorId and slug are supplied by the Service layer.
 * Stats, deletedAt and timestamps are system-managed.
 */
export function createRecipe(recipeData, session) {
  if (session) {
    return Recipe.create(
      [
        {
          ...recipeData,
        },
      ],
      {
        session,
      }
    ).then(([recipe]) => recipe);
  }

  return Recipe.create(recipeData);
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

/**
 * Update a non-deleted Recipe by ID.
 *
 * Authorization and business rules are handled
 * by the Service layer.
 */
export function updateRecipeById(recipeId, updates, session) {
  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
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
 * --------------------------------------------------------------------------
 * Soft Delete / Restore
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete a Recipe.
 *
 * Related Bookmarks, Ratings, Comments, Reactions
 * and other relationship documents are preserved.
 */
export function softDeleteRecipe(recipeId, deletedAt = new Date(), session) {
  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
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
 * Restore a soft-deleted Recipe.
 */
export function restoreRecipe(recipeId, session) {
  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
      deletedAt: {
        $ne: null,
      },
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
 * --------------------------------------------------------------------------
 * Find Multiple Accessible Recipes
 * --------------------------------------------------------------------------
 */

/**
 * Find publicly accessible Recipes by IDs.
 *
 * Accessibility filtering is performed inside
 * the Repository.
 *
 * MongoDB does not guarantee that the order of $in
 * results matches the input ID order. Callers that need
 * the original order must rebuild it explicitly.
 */
export function findAccessibleRecipesByIds(recipeIds, session) {
  const pipeline = [
    {
      $match: {
        _id: {
          $in: recipeIds,
        },
        deletedAt: null,
      },
    },

    ...buildRecipeAccessibilityStages(),
  ];

  const query = Recipe.aggregate(pipeline);

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Statistics / Counters
 * --------------------------------------------------------------------------
 */

/**
 * Increment or decrement a Recipe statistic.
 *
 * Negative deltas are guarded atomically so that
 * counters cannot become negative.
 */
export function updateStatCountByDelta(recipeId, stat, delta = 1, session) {
  if (!Object.values(RECIPE_STATS).includes(stat)) {
    throw new Error("Invalid recipe stat.");
  }

  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error("Recipe stat delta must be a non-zero integer.");
  }

  const filter = {
    _id: recipeId,
    deletedAt: null,
  };

  if (delta < 0) {
    filter[stat] = {
      $gte: Math.abs(delta),
    };
  }

  const query = Recipe.findOneAndUpdate(
    filter,

    {
      $inc: {
        [stat]: delta,
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
 * Increment Recipe view count.
 */
export function incrementViewCount(recipeId, amount = 1, session) {
  return updateStatCountByDelta(
    recipeId,
    RECIPE_STATS.VIEW_COUNT,
    amount,
    session
  );
}

/**
 * Increment Recipe top-level comment count.
 */
export function incrementCommentCount(recipeId, amount = 1, session) {
  return updateStatCountByDelta(
    recipeId,
    RECIPE_STATS.COMMENT_COUNT,
    amount,
    session
  );
}

/**
 * --------------------------------------------------------------------------
 * Rating Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Atomically update the denormalized Recipe rating statistics.
 *
 * Source of truth:
 * Rating collection.
 *
 * Projection:
 * - stats.ratingCount
 * - stats.ratingSum
 * - stats.averageRating
 *
 * ratingCountDelta may be zero when an existing Rating
 * changes its value.
 */
export function updateRatingStatsDeltas(
  recipeId,
  ratingCountDelta,
  ratingSumDelta,
  session
) {
  if (
    !Number.isInteger(ratingCountDelta) ||
    !Number.isInteger(ratingSumDelta)
  ) {
    throw new Error("Rating statistic deltas must be integers.");
  }

  if (ratingCountDelta === 0 && ratingSumDelta === 0) {
    throw new Error("At least one rating statistic delta must be non-zero.");
  }

  const currentCount = {
    $ifNull: ["$stats.ratingCount", 0],
  };

  const currentSum = {
    $ifNull: ["$stats.ratingSum", 0],
  };

  const nextCount = {
    $add: [currentCount, ratingCountDelta],
  };

  const nextSum = {
    $add: [currentSum, ratingSumDelta],
  };

  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
      deletedAt: null,

      /**
       * Prevent the denormalized counters from
       * becoming negative.
       */
      $expr: {
        $and: [
          {
            $gte: [nextCount, 0],
          },
          {
            $gte: [nextSum, 0],
          },
        ],
      },
    },

    [
      {
        $set: {
          "stats.ratingCount": nextCount,

          "stats.ratingSum": nextSum,

          "stats.averageRating": {
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
          },
        },
      },
    ],

    {
      new: true,
    }
  );

  return applySession(query, session);
}
