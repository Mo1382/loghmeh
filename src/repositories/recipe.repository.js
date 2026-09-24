import Category from "@/models/Category";
import Recipe from "@/models/Recipe";
import User from "@/models/User";
import { RECIPE_SORTS, RECIPE_STATS } from "@/constants/enums";
import { ACCOUNT_STATUSES } from "@/constants/enums";
import { applySession } from "@/lib/helpers/apply-session";

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Supported recipe sorting modes.
 *
 * The Service layer is responsible for deciding which
 * sorting modes are allowed for each use case.
 */
/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Allowed recipe statistic fields.
 */
/* -------------------------------------------------------------------------- */
/* Query Helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Build the cursor condition for the selected sort.
 *
 * The Recipe _id is used as a stable tie-breaker when multiple
 * recipes have the same sort value.
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
 * Build MongoDB lookup stages required to determine whether
 * a Recipe is publicly accessible.
 *
 * A Recipe is accessible only when:
 * - the Recipe is not deleted
 * - its author exists
 * - its author is ACTIVE
 * - its author is not deleted
 * - its category exists
 * - its category is active
 *
 * These stages are intended to run BEFORE pagination.
 */
function buildAccessibilityStages() {
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

/* -------------------------------------------------------------------------- */
/* Find Recipes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Find recipes with cursor-based infinite loading.
 *
 * Accessibility filtering is performed BEFORE sorting and pagination:
 *
 * Recipe.deletedAt === null
 * AND Author.accountStatus === ACCOUNT_STATUSES.ACTIVE
 * AND Author.deletedAt === null
 * AND Category.isActive === true
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

  let sortOption;

  switch (sort) {
    case RECIPE_SORTS.NEWEST:
      sortOption = {
        createdAt: -1,
        _id: -1,
      };
      break;

    case RECIPE_SORTS.OLDEST:
      sortOption = {
        createdAt: 1,
        _id: 1,
      };
      break;

    case RECIPE_SORTS.MOST_VIEWED:
      sortOption = {
        "stats.viewCount": -1,
        _id: -1,
      };
      break;

    case RECIPE_SORTS.HIGHEST_RATED:
      sortOption = {
        "stats.averageRating": -1,
        _id: -1,
      };
      break;

    default:
      throw new Error(`Unsupported recipe sort: ${sort}`);
  }

  const pipeline = [
    /*
     * Base Recipe filters.
     *
     * deletedAt is enforced here so deleted Recipes never
     * participate in the result set.
     */
    {
      $match: queryFilter,
    },
  ];

  /*
   * Cursor filtering is applied before the cross-document
   * accessibility checks.
   */
  if (cursorFilter) {
    pipeline.push({
      $match: cursorFilter,
    });
  }

  /*
   * Author and Category accessibility must be determined
   * BEFORE limit/hasMore pagination.
   */
  pipeline.push(...buildAccessibilityStages());

  /*
   * Sort only after inaccessible Recipes have been removed.
   */
  pipeline.push({
    $sort: sortOption,
  });

  /*
   * Apply limit after accessibility filtering so that the
   * returned page actually contains the requested number
   * of accessible Recipes.
   */
  pipeline.push({
    $limit: limit,
  });

  const query = Recipe.aggregate(pipeline);

  return applySession(query, session);
}

/* -------------------------------------------------------------------------- */
/* Find Single Recipe                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Find a Recipe by ID.
 *
 * Soft-deleted Recipes are excluded.
 *
 * Author and Category accessibility are intentionally checked
 * by the Service layer for single-Recipe operations.
 */
export function findRecipeById(recipeId, session) {
  const query = Recipe.findOne({
    _id: recipeId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a deleted Recipe by ID.
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
 * Find a Recipe by slug.
 *
 * Soft-deleted Recipes are excluded.
 */
export function findRecipeBySlug(slug, session) {
  const query = Recipe.findOne({
    slug,
    deletedAt: null,
  });

  return applySession(query, session);
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a Recipe.
 *
 * authorId is determined by the Service layer.
 * slug is generated by the Service layer.
 * stats and timestamps are system-managed.
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

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Update a Recipe by ID.
 *
 * Only explicitly provided fields are updated.
 * The Recipe itself must not be soft-deleted.
 *
 * Authorization and Author/Category accessibility are handled
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

/* -------------------------------------------------------------------------- */
/* Soft Delete / Restore                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Soft-delete a Recipe.
 *
 * Soft deletion only changes deletedAt.
 * Related Bookmarks, Ratings, Comments, Reactions and
 * other relationships are preserved.
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

/* -------------------------------------------------------------------------- */
/* Find Multiple Recipes                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Find multiple Recipes by their IDs.
 *
 * Deleted Recipes are excluded.
 *
 * This function intentionally does not perform Author/Category
 * accessibility filtering because callers may use it for internal
 * relationship checks. Public multi-Recipe loading should use
 * findRecipes().
 */
export function findRecipesByIds(recipeIds, session) {
  const query = Recipe.find({
    _id: {
      $in: recipeIds,
    },
    deletedAt: null,
  });

  return applySession(query, session);
}

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

    {
      $lookup: {
        from: "users",
        let: {
          authorId: "$authorId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$authorId"] },
                  { $eq: ["$accountStatus", ACCOUNT_STATUSES.ACTIVE] },
                  { $eq: ["$deletedAt", null] },
                ],
              },
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
      $match: {
        "accessibleAuthor.0": {
          $exists: true,
        },
      },
    },

    {
      $lookup: {
        from: "categories",
        let: {
          categoryId: "$categoryId",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$categoryId"] },
                  { $eq: ["$isActive", true] },
                ],
              },
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

  const aggregate = Recipe.aggregate(pipeline);

  if (session) {
    aggregate.session(session);
  }

  return aggregate;
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Increment or decrement a Recipe statistic.
 */
export function incrementStatCount(recipeId, stat, amount = 1, session) {
  if (!Object.values(RECIPE_STATS).includes(stat)) {
    throw new Error("Invalid recipe stat.");
  }

  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("Recipe stat amount must be a non-zero integer.");
  }

  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
      deletedAt: null,
    },
    {
      $inc: {
        [stat]: amount,
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
  return incrementStatCount(recipeId, RECIPE_STATS.VIEW_COUNT, amount, session);
}

/**
 * Increment Recipe rating count.
 */
export function incrementRatingCount(recipeId, amount = 1, session) {
  return incrementStatCount(
    recipeId,
    RECIPE_STATS.RATING_COUNT,
    amount,
    session
  );
}

/**
 * Increment Recipe comment count.
 */
export function incrementCommentCount(recipeId, amount = 1, session) {
  return incrementStatCount(
    recipeId,
    RECIPE_STATS.COMMENT_COUNT,
    amount,
    session
  );
}

/**
 * Update Recipe average rating.
 */
export function updateAverageRating(recipeId, averageRating, session) {
  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
      deletedAt: null,
    },
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
