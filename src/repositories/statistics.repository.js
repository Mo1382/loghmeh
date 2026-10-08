import User from "@/models/User";
import Recipe from "@/models/Recipe";
import Rating from "@/models/Rating";
import Comment from "@/models/Comment";
import Reaction from "@/models/Reaction";
import Category from "@/models/Category";

import { REACTION_TYPES } from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * --------------------------------------------------------------------------
 * Recipe Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Calculate Recipe rating statistics from the Rating collection.
 *
 * Source of truth:
 * - Rating documents
 *
 * Returns:
 * {
 *   ratingCount: Number,
 *   ratingSum: Number,
 *   averageRating: Number
 * }
 */
export async function getRatingStatsByRecipeId(recipeId, session) {
  const pipeline = [
    {
      $match: {
        recipeId,
      },
    },

    {
      $group: {
        _id: null,

        ratingCount: {
          $sum: 1,
        },

        ratingSum: {
          $sum: "$value",
        },

        averageRating: {
          $avg: "$value",
        },
      },
    },

    {
      $project: {
        _id: 0,

        ratingCount: 1,

        ratingSum: 1,

        averageRating: {
          $cond: [
            {
              $gt: ["$ratingCount", 0],
            },

            {
              $round: ["$averageRating", 2],
            },

            0,
          ],
        },
      },
    },
  ];

  const aggregate = Rating.aggregate(pipeline);

  if (session) {
    aggregate.session(session);
  }

  const [result] = await aggregate;

  return {
    ratingCount: result?.ratingCount ?? 0,

    ratingSum: result?.ratingSum ?? 0,

    averageRating: result?.averageRating ?? 0,
  };
}

/**
 * Replace the stored Recipe rating statistics.
 *
 * Projection:
 * - Recipe.stats.ratingCount
 * - Recipe.stats.ratingSum
 * - Recipe.stats.averageRating
 *
 * Only non-deleted Recipes are updated.
 */
export function setRecipeRatingStats(
  recipeId,
  { ratingCount, ratingSum, averageRating },
  session
) {
  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
      deletedAt: null,
    },

    {
      $set: {
        "stats.ratingCount": ratingCount,

        "stats.ratingSum": ratingSum,

        "stats.averageRating": averageRating,
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
 * Count active top-level Comments for a Recipe.
 *
 * Embedded Replies are intentionally excluded.
 */
export function countTopLevelCommentsByRecipeId(recipeId, session) {
  const query = Comment.countDocuments({
    recipeId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Replace the stored Recipe comment count.
 *
 * Projection:
 * - Recipe.stats.commentCount
 *
 * Only non-deleted Recipes are updated.
 */
export function setRecipeCommentCount(recipeId, commentCount, session) {
  const query = Recipe.findOneAndUpdate(
    {
      _id: recipeId,
      deletedAt: null,
    },

    {
      $set: {
        "stats.commentCount": commentCount,
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
 * --------------------------------------------------------------------------
 * Comment Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Calculate top-level Comment reaction statistics
 * from the Reaction collection.
 *
 * Source of truth:
 * - Reaction documents whose commentId is set.
 */
export async function getCommentReactionStats(commentId, session) {
  const pipeline = [
    {
      $match: {
        commentId,
      },
    },

    {
      $group: {
        _id: "$type",

        count: {
          $sum: 1,
        },
      },
    },
  ];

  const aggregate = Reaction.aggregate(pipeline);

  if (session) {
    aggregate.session(session);
  }

  const results = await aggregate;

  const likeCount =
    results.find((item) => item._id === REACTION_TYPES.LIKE)?.count ?? 0;

  const dislikeCount =
    results.find((item) => item._id === REACTION_TYPES.DISLIKE)?.count ?? 0;

  return {
    likeCount,
    dislikeCount,
  };
}

/**
 * Replace the stored top-level Comment
 * reaction counters.
 *
 * Projection:
 * - Comment.likeCount
 * - Comment.dislikeCount
 *
 * Only non-deleted Comments are updated.
 */
export function setCommentReactionStats(
  commentId,
  { likeCount, dislikeCount },
  session
) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
    },

    {
      $set: {
        likeCount,
        dislikeCount,
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
 * --------------------------------------------------------------------------
 * Reply Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Calculate embedded Reply reaction statistics
 * from the Reaction collection.
 *
 * Source of truth:
 * - Reaction documents whose replyId is set.
 */
export async function getReplyReactionStats(replyId, session) {
  const pipeline = [
    {
      $match: {
        replyId,
      },
    },

    {
      $group: {
        _id: "$type",

        count: {
          $sum: 1,
        },
      },
    },
  ];

  const aggregate = Reaction.aggregate(pipeline);

  if (session) {
    aggregate.session(session);
  }

  const results = await aggregate;

  const likeCount =
    results.find((item) => item._id === REACTION_TYPES.LIKE)?.count ?? 0;

  const dislikeCount =
    results.find((item) => item._id === REACTION_TYPES.DISLIKE)?.count ?? 0;

  return {
    likeCount,
    dislikeCount,
  };
}

/**
 * Replace the stored reaction counters
 * of an embedded Reply.
 *
 * commentId identifies the parent Comment.
 * replyId identifies the embedded Reply.
 */
export function setReplyReactionStats(
  commentId,
  replyId,
  { likeCount, dislikeCount },
  session
) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
      "replies._id": replyId,
    },

    {
      $set: {
        "replies.$.likeCount": likeCount,

        "replies.$.dislikeCount": dislikeCount,
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
 * --------------------------------------------------------------------------
 * User Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Calculate User statistics from source collections.
 *
 * Source of truth:
 *
 * Recipe collection:
 * - recipeCount
 * - totalRecipeViews
 *
 * Rating collection joined through the User's
 * non-deleted Recipes:
 * - ratingCount
 * - ratingSum
 * - averageRating
 *
 * Returned contract:
 *
 * {
 *   recipeCount,
 *   totalRecipeViews,
 *   ratingCount,
 *   ratingSum,
 *   averageRating
 * }
 */
export async function getUserStatisticsSourceData(userId, session) {
  const recipeFilter = {
    authorId: userId,
    deletedAt: null,
  };

  /**
   * ----------------------------------------------------
   * Recipe Count
   * ----------------------------------------------------
   */
  const recipeCountQuery = Recipe.countDocuments(recipeFilter);

  const recipeCount = await applySession(recipeCountQuery, session);

  /**
   * ----------------------------------------------------
   * Total Recipe Views
   * ----------------------------------------------------
   */
  const viewPipeline = [
    {
      $match: recipeFilter,
    },

    {
      $group: {
        _id: null,

        totalRecipeViews: {
          $sum: {
            $ifNull: ["$stats.viewCount", 0],
          },
        },
      },
    },
  ];

  const viewAggregate = Recipe.aggregate(viewPipeline);

  if (session) {
    viewAggregate.session(session);
  }

  const [viewResult] = await viewAggregate;

  /**
   * ----------------------------------------------------
   * Rating Statistics
   * ----------------------------------------------------
   *
   * Only Ratings belonging to non-deleted
   * Recipes authored by this User are included.
   */
  const ratingPipeline = [
    {
      $match: recipeFilter,
    },

    {
      $lookup: {
        from: Rating.collection.name,

        localField: "_id",

        foreignField: "recipeId",

        as: "ratings",
      },
    },

    {
      $unwind: "$ratings",
    },

    {
      $group: {
        _id: null,

        ratingCount: {
          $sum: 1,
        },

        ratingSum: {
          $sum: "$ratings.value",
        },
      },
    },

    {
      $project: {
        _id: 0,

        ratingCount: 1,

        ratingSum: 1,

        averageRating: {
          $cond: [
            {
              $gt: ["$ratingCount", 0],
            },

            {
              $round: [
                {
                  $divide: ["$ratingSum", "$ratingCount"],
                },
                2,
              ],
            },

            0,
          ],
        },
      },
    },
  ];

  const ratingAggregate = Recipe.aggregate(ratingPipeline);

  if (session) {
    ratingAggregate.session(session);
  }

  const [ratingResult] = await ratingAggregate;

  /**
   * ----------------------------------------------------
   * Final Source-Data Contract
   * ----------------------------------------------------
   */
  return {
    recipeCount,

    totalRecipeViews: viewResult?.totalRecipeViews ?? 0,

    ratingCount: ratingResult?.ratingCount ?? 0,

    ratingSum: ratingResult?.ratingSum ?? 0,

    averageRating: ratingResult?.averageRating ?? 0,
  };
}

/**
 * Replace stored User statistics.
 *
 * Projection:
 *
 * User.stats.recipeCount
 * User.stats.totalRecipeViews
 * User.stats.ratingCount
 * User.stats.ratingSum
 * User.stats.averageRating
 */
export function setUserStats(
  userId,
  { recipeCount, totalRecipeViews, ratingCount, ratingSum, averageRating },
  session
) {
  const query = User.findOneAndUpdate(
    {
      _id: userId,
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Category Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Calculate Category recipe count
 * from the Recipe collection.
 *
 * Source of truth:
 * - non-deleted Recipe documents
 *
 * Current invariant:
 *
 * Category.stats.recipeCount =
 * number of non-deleted Recipes in Category
 */
export async function getCategoryStatisticsSourceData(categoryId, session) {
  const query = Recipe.countDocuments({
    categoryId,
    deletedAt: null,
  });

  const recipeCount = await applySession(query, session);

  return {
    recipeCount,
  };
}

/**
 * Replace the stored Category recipe count.
 *
 * Projection:
 * - Category.stats.recipeCount
 */
export function setCategoryRecipeCount(categoryId, recipeCount, session) {
  const query = Category.findOneAndUpdate(
    {
      _id: categoryId,
    },

    {
      $set: {
        "stats.recipeCount": recipeCount,
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}
