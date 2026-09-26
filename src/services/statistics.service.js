import { ERROR_CODES } from "@/constants/error-codes";

import AppError from "@/lib/errors/AppError";

import { withTransaction } from "@/lib/transaction";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { findRecipeById } from "@/repositories/recipe.repository";

import {
  getRatingStatsByRecipeId,
  setRecipeRatingStats,
  countTopLevelCommentsByRecipeId,
  setRecipeCommentCount,
  getCommentReactionStats,
  setCommentReactionStats,
  getReplyReactionStats,
  setReplyReactionStats,
  getUserStatisticsSourceData,
  setUserStats,
  getCategoryStatisticsSourceData,
  setCategoryRecipeCount,
} from "@/repositories/statistics.repository";

/**
 * --------------------------------------------------------------------------
 * Statistics Service
 * --------------------------------------------------------------------------
 *
 * This service is responsible for reconciliation of denormalized statistics.
 *
 * Source of truth remains in the domain collections.
 *
 * Rating
 *   -> Recipe.stats.ratingCount
 *   -> Recipe.stats.ratingSum
 *   -> Recipe.stats.averageRating
 *
 * Active top-level Comment documents
 *   -> Recipe.stats.commentCount
 *
 * Reaction documents targeting Comments
 *   -> Comment.likeCount
 *   -> Comment.dislikeCount
 *
 * Reaction documents targeting Replies
 *   -> Reply.likeCount
 *   -> Reply.dislikeCount
 *
 * Recipe documents
 *   -> User.stats.recipeCount
 *   -> User.stats.totalRecipeViews
 *
 * Rating documents belonging to a user's recipes
 *   -> User.stats.averageRating
 *
 * Recipe documents belonging to a Category
 *   -> Category.stats.recipeCount
 *
 * Normal business operations should keep projections synchronized
 * transactionally. These functions are the repair mechanism when
 * a projection has drifted from its source of truth.
 */

/* -------------------------------------------------------------------------- */
/* Internal Helpers                                                           */
/* -------------------------------------------------------------------------- */

function assertUpdatedDocument(document, errorCode, message) {
  if (!document) {
    throw new AppError(errorCode, message, {
      statusCode: 404,
    });
  }

  return document;
}

/* -------------------------------------------------------------------------- */
/* Recipe Statistics                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Reconcile Recipe rating statistics from the Rating collection.
 *
 * Invariants:
 * - Recipe.stats.ratingCount = count(Rating)
 * - Recipe.stats.ratingSum = sum(Rating.value)
 * - Recipe.stats.averageRating = avg(Rating.value)
 */
export async function reconcileRecipeRatingStats(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    const sourceStats = await getRatingStatsByRecipeId(recipeId, session);

    const updatedRecipe = await setRecipeRatingStats(
      recipeId,
      {
        ratingCount: sourceStats.ratingCount,

        ratingSum: sourceStats.ratingSum,

        averageRating: sourceStats.averageRating,
      },
      session
    );

    return assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/**
 * Reconcile Recipe comment count from active
 * top-level comments.
 *
 * Replies are intentionally excluded.
 *
 * Invariant:
 * Recipe.stats.commentCount =
 * active top-level comments
 */
export async function reconcileRecipeCommentCount(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    const commentCount = await countTopLevelCommentsByRecipeId(
      recipeId,
      session
    );

    const updatedRecipe = await setRecipeCommentCount(
      recipeId,
      commentCount,
      session
    );

    return assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/**
 * Reconcile all currently supported derived
 * statistics of one Recipe.
 *
 * Recipe.stats.viewCount is not reconciled here because
 * the counter itself is currently the stored source
 * of truth for views.
 */
export async function reconcileRecipeStatistics(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    const ratingStats = await getRatingStatsByRecipeId(recipeId, session);

    const commentCount = await countTopLevelCommentsByRecipeId(
      recipeId,
      session
    );

    const updatedRecipe = await setRecipeRatingStats(
      recipeId,
      {
        ratingCount: ratingStats.ratingCount,

        ratingSum: ratingStats.ratingSum,

        averageRating: ratingStats.averageRating,
      },
      session
    );

    assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );

    const finalRecipe = await setRecipeCommentCount(
      recipeId,
      commentCount,
      session
    );

    return assertUpdatedDocument(
      finalRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Comment Statistics                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Reconcile top-level Comment reaction counters
 * from the Reaction collection.
 *
 * Invariants:
 * - Comment.likeCount =
 *     count(Reaction type=LIKE where commentId is set)
 *
 * - Comment.dislikeCount =
 *     count(Reaction type=DISLIKE where commentId is set)
 */
export async function reconcileCommentReactionStats(commentId) {
  assertValidObjectId(commentId, "comment ID");

  return withTransaction(async (session) => {
    const sourceStats = await getCommentReactionStats(commentId, session);

    const updatedComment = await setCommentReactionStats(
      commentId,
      {
        likeCount: sourceStats.likeCount,

        dislikeCount: sourceStats.dislikeCount,
      },
      session
    );

    return assertUpdatedDocument(
      updatedComment,
      ERROR_CODES.COMMENT_NOT_FOUND,
      "نظر پیدا نشد."
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Reply Statistics                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Reconcile an embedded Reply's reaction counters
 * from the Reaction collection.
 *
 * Invariants:
 * - Reply.likeCount =
 *     count(Reaction type=LIKE where replyId is set)
 *
 * - Reply.dislikeCount =
 *     count(Reaction type=DISLIKE where replyId is set)
 */
export async function reconcileReplyReactionStats(commentId, replyId) {
  assertValidObjectId(commentId, "comment ID");

  assertValidObjectId(replyId, "reply ID");

  return withTransaction(async (session) => {
    const sourceStats = await getReplyReactionStats(replyId, session);

    const updatedComment = await setReplyReactionStats(
      commentId,
      replyId,
      {
        likeCount: sourceStats.likeCount,

        dislikeCount: sourceStats.dislikeCount,
      },
      session
    );

    return assertUpdatedDocument(
      updatedComment,
      ERROR_CODES.COMMENT_NOT_FOUND,
      "نظر یا پاسخ پیدا نشد."
    );
  });
}

/* -------------------------------------------------------------------------- */
/* User Statistics                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Reconcile User statistics from their
 * source collections.
 *
 * Expected source-data contract:
 * {
 *   recipeCount,
 *   totalRecipeViews,
 *   averageRating
 * }
 */
export async function reconcileUserStatistics(userId) {
  assertValidObjectId(userId, "user ID");

  return withTransaction(async (session) => {
    const sourceStats = await getUserStatisticsSourceData(userId, session);

    const updatedUser = await setUserStats(
      userId,
      {
        recipeCount: sourceStats.recipeCount,

        totalRecipeViews: sourceStats.totalRecipeViews,

        averageRating: sourceStats.averageRating,
      },
      session
    );

    return assertUpdatedDocument(
      updatedUser,
      ERROR_CODES.USER_NOT_FOUND,
      "کاربر پیدا نشد."
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Category Statistics                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Reconcile Category recipe count
 * from the Recipe collection.
 *
 * Invariant:
 * Category.stats.recipeCount =
 * number of non-deleted Recipes in Category
 */
export async function reconcileCategoryStatistics(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  return withTransaction(async (session) => {
    const sourceStats = await getCategoryStatisticsSourceData(
      categoryId,
      session
    );

    const updatedCategory = await setCategoryRecipeCount(
      categoryId,
      sourceStats.recipeCount,
      session
    );

    return assertUpdatedDocument(
      updatedCategory,
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "دسته‌بندی پیدا نشد."
    );
  });
}
