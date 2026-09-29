import Bookmark from "@/models/Bookmark";
import Recipe from "@/models/Recipe";
import User from "@/models/User";
import Category from "@/models/Category";

import { ACCOUNT_STATUSES } from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * --------------------------------------------------------------------------
 * Find Bookmark
 * --------------------------------------------------------------------------
 */

/**
 * Find a Bookmark created by a specific User
 * for a specific Recipe.
 */
export function findBookmarkByUserAndRecipe(userId, recipeId, session) {
  const query = Bookmark.findOne({
    userId,
    recipeId,
  });

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a Bookmark.
 *
 * userId is supplied by the Service layer.
 * recipeId is supplied by the Service layer.
 */
export function createBookmark(bookmarkData, session) {
  if (session) {
    return Bookmark.create([bookmarkData], {
      session,
    }).then(([bookmark]) => bookmark);
  }

  return Bookmark.create(bookmarkData);
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Delete a Bookmark created by a specific User
 * for a specific Recipe.
 *
 * Bookmark deletion is a hard delete because the
 * Bookmark represents the current relationship state.
 */
export function deleteBookmarkByUserAndRecipe(userId, recipeId, session) {
  const query = Bookmark.findOneAndDelete({
    userId,
    recipeId,
  });

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Accessible User Bookmarks
 * --------------------------------------------------------------------------
 */

/**
 * Find a User's Bookmarks whose Recipes are currently
 * publicly accessible.
 *
 * Accessibility requirements:
 *
 * Recipe:
 * - exists
 * - deletedAt === null
 *
 * Author:
 * - exists
 * - accountStatus === ACTIVE
 * - deletedAt === null
 *
 * Category:
 * - exists
 * - isActive === true
 *
 *
 * IMPORTANT:
 *
 * Accessibility filtering is completed BEFORE cursor
 * pagination, sorting and limiting.
 *
 * Therefore:
 * - inaccessible Recipes do not consume page slots
 * - cursor pagination is based on visible Bookmarks
 * - limit represents visible Recipes
 *
 *
 * Returned record contract:
 *
 * {
 *   bookmark,
 *   recipe
 * }
 */
export function findAccessibleBookmarksByUser({
  userId,
  cursor = null,
  limit = 16,
  session,
}) {
  const pipeline = [
    /**
     * --------------------------------------------------
     * 1. Restrict to this User's Bookmarks
     * --------------------------------------------------
     */
    {
      $match: {
        userId,
      },
    },

    /**
     * --------------------------------------------------
     * 2. Resolve the referenced Recipe and determine
     *    whether it is publicly accessible.
     * --------------------------------------------------
     */
    {
      $lookup: {
        from: Recipe.collection.name,

        localField: "recipeId",

        foreignField: "_id",

        pipeline: [
          /**
           * Recipe itself must not be deleted.
           */
          {
            $match: {
              deletedAt: null,
            },
          },

          /**
           * Author must exist, be active and
           * must not be soft-deleted.
           */
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

          /**
           * Category must exist and be active.
           */
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

          /**
           * Keep only Recipes whose Author and
           * Category satisfy the accessibility policy.
           */
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

          /**
           * Temporary accessibility lookup fields
           * are not part of the returned Recipe.
           */
          {
            $project: {
              accessibleAuthor: 0,
              accessibleCategory: 0,
            },
          },
        ],

        as: "recipe",
      },
    },

    /**
     * --------------------------------------------------
     * 3. Remove Bookmarks whose Recipe is inaccessible.
     * --------------------------------------------------
     */
    {
      $match: {
        "recipe.0": {
          $exists: true,
        },
      },
    },
  ];

  /**
   * ----------------------------------------------------
   * 4. Apply cursor AFTER accessibility filtering.
   *
   * This is important because inaccessible Bookmarks
   * must not affect visible-page pagination.
   * ----------------------------------------------------
   */
  if (cursor) {
    pipeline.push({
      $match: {
        $or: [
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
        ],
      },
    });
  }

  /**
   * ----------------------------------------------------
   * 5. Preserve Bookmark ordering.
   * ----------------------------------------------------
   */
  pipeline.push({
    $sort: {
      createdAt: -1,
      _id: -1,
    },
  });

  /**
   * ----------------------------------------------------
   * 6. Fetch only the requested visible records.
   * ----------------------------------------------------
   */
  pipeline.push({
    $limit: limit,
  });

  /**
   * ----------------------------------------------------
   * 7. Return the explicit Repository contract:
   *
   * {
   *   bookmark,
   *   recipe
   * }
   * ----------------------------------------------------
   */
  pipeline.push({
    $project: {
      bookmark: {
        _id: "$_id",
        userId: "$userId",
        recipeId: "$recipeId",
        createdAt: "$createdAt",
      },

      recipe: {
        $arrayElemAt: ["$recipe", 0],
      },
    },
  });

  const query = Bookmark.aggregate(pipeline);

  return applySession(query, session);
}
