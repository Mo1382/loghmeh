import User from "@/models/User";
import Recipe from "@/models/Recipe";
import Rating from "@/models/Rating";
import Comment from "@/models/Comment";
import Reaction from "@/models/Reaction";
import Category from "@/models/Category";

import { REACTION_TYPES } from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/* -------------------------------------------------------------------------- */
/* Recipe Statistics                                                          */
/* -------------------------------------------------------------------------- */

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
  ];

  const aggregate = Rating.aggregate(pipeline);

  if (session) {
    aggregate.session(session);
  }

  const [result] = await aggregate;

  return {
    ratingCount: result?.ratingCount ?? 0,

    ratingSum: result?.ratingSum ?? 0,

    averageRating:
      result?.averageRating !== undefined
        ? Number(result.averageRating.toFixed(2))
        : 0,
  };
}

/**
 * Replace the stored Recipe rating statistics
 * with calculated values.
 *
 * Projection:
 * - Recipe.stats.ratingCount
 * - Recipe.stats.ratingSum
 * - Recipe.stats.averageRating
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
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Count active top-level comments for a Recipe.
 *
 * Replies are embedded inside Comment documents
 * and are not counted.
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
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/* -------------------------------------------------------------------------- */
/* Comment Statistics                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Calculate top-level Comment reaction statistics
 * from the Reaction collection.
 *
 * Source of truth:
 * - Reaction documents whose commentId is set.
 *
 * Returns:
 * {
 *   likeCount: Number,
 *   dislikeCount: Number
 * }
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
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/* -------------------------------------------------------------------------- */
/* Reply Statistics                                                           */
/* -------------------------------------------------------------------------- */

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
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/* -------------------------------------------------------------------------- */
/* User Statistics                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Calculate User statistics from source collections.
 *
 * Current invariants:
 * - recipeCount =
 *     number of non-deleted Recipes authored by the User
 *
 * - totalRecipeViews =
 *     sum of viewCount on non-deleted authored Recipes
 *
 * - averageRating =
 *     average of Rating.value for non-deleted authored Recipes
 */
export async function getUserStatisticsSourceData(userId, session) {
  const recipeFilter = {
    authorId: userId,
    deletedAt: null,
  };

  const recipeCountQuery = Recipe.countDocuments(recipeFilter);

  const recipeCount = await applySession(recipeCountQuery, session);

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

        averageRating: {
          $avg: "$ratings.value",
        },
      },
    },
  ];

  const ratingAggregate = Recipe.aggregate(ratingPipeline);

  if (session) {
    ratingAggregate.session(session);
  }

  const [ratingResult] = await ratingAggregate;

  return {
    recipeCount,

    totalRecipeViews: viewResult?.totalRecipeViews ?? 0,

    averageRating:
      ratingResult?.averageRating !== undefined
        ? Number(ratingResult.averageRating.toFixed(2))
        : 0,
  };
}

/**
 * Replace the stored User statistics.
 *
 * Projection:
 * - User.stats.recipeCount
 * - User.stats.totalRecipeViews
 * - User.stats.averageRating
 */
export function setUserStats(
  userId,
  { recipeCount, totalRecipeViews, averageRating },
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

/* -------------------------------------------------------------------------- */
/* Category Statistics                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Calculate Category recipe count
 * from the Recipe collection.
 *
 * Current invariant:
 * - Category.stats.recipeCount =
 *     number of non-deleted Recipes in Category
 */
export function getCategoryStatisticsSourceData(categoryId, session) {
  const query = Recipe.countDocuments({
    categoryId,
    deletedAt: null,
  });

  return applySession(query, session).then((recipeCount) => ({
    recipeCount,
  }));
}

/**
 * Replace the stored Category recipe count.
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
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}
