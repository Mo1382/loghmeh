import { ERROR_CODES } from "@/constants/error-codes";

import AppError from "@/lib/errors/AppError";

import { withTransaction } from "@/lib/transaction";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { findNonDeletedRecipeById } from "@/repositories/recipe.repository";

import {
  countTopLevelCommentsByRecipeId,
  getCategoryStatisticsSourceData,
  getCommentReactionStats,
  getRatingStatsByRecipeId,
  getReplyReactionStats,
  getUserStatisticsSourceData,
  setCategoryRecipeCount,
  setCommentReactionStats,
  setRecipeCommentCount,
  setRecipeRatingStats,
  setReplyReactionStats,
  setUserStats,
} from "@/repositories/statistics.repository";

/**
 * --------------------------------------------------------------------------
 * Internal Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Ensure that the expected document was updated.
 */
function assertUpdatedDocument(document, errorCode, message) {
  if (!document) {
    throw new AppError(errorCode, message, {
      statusCode: 404,
    });
  }

  return document;
}

/**
 * Execute a reconciliation operation.
 *
 * When a session is supplied, the existing transaction is reused.
 *
 * When no session is supplied, a new transaction is created.
 *
 * This allows the same reconciliation function to be used:
 *
 * - inside an existing domain transaction
 * - as an independent repair/rebuild operation
 *
 * without creating nested transactions.
 */
function runReconciliation(session, operation) {
  if (session) {
    return operation(session);
  }

  return withTransaction(async (transactionSession) =>
    operation(transactionSession)
  );
}

/**
 * --------------------------------------------------------------------------
 * Recipe Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Rebuild Recipe rating statistics from Rating documents.
 *
 * Source of truth:
 * Rating collection
 *
 * Projection:
 * - Recipe.stats.ratingCount
 * - Recipe.stats.ratingSum
 * - Recipe.stats.averageRating
 */
export function reconcileRecipeRatingStats(recipeId, session) {
  assertValidObjectId(recipeId, "recipe ID");

  return runReconciliation(session, async (transactionSession) => {
    const sourceStats = await getRatingStatsByRecipeId(
      recipeId,
      transactionSession
    );

    const {
      ratingCount = 0,
      ratingSum = 0,
      averageRating = 0,
    } = sourceStats ?? {};

    const updatedRecipe = await setRecipeRatingStats(
      recipeId,
      {
        ratingCount,
        ratingSum,
        averageRating,
      },
      transactionSession
    );

    return assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/**
 * Rebuild Recipe comment count from active
 * top-level Comment documents.
 *
 * Source of truth:
 * Active top-level Comments
 *
 * Projection:
 * - Recipe.stats.commentCount
 */
export function reconcileRecipeCommentCount(recipeId, session) {
  assertValidObjectId(recipeId, "recipe ID");

  return runReconciliation(session, async (transactionSession) => {
    const commentCount = await countTopLevelCommentsByRecipeId(
      recipeId,
      transactionSession
    );

    const updatedRecipe = await setRecipeCommentCount(
      recipeId,
      commentCount,
      transactionSession
    );

    return assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/**
 * Rebuild all currently maintained Recipe statistics.
 *
 * Reconciled projections:
 *
 * - Recipe.stats.ratingCount
 * - Recipe.stats.ratingSum
 * - Recipe.stats.averageRating
 * - Recipe.stats.commentCount
 *
 * Recipe.stats.viewCount is intentionally excluded because
 * it is currently treated as the stored source of truth
 * for Recipe views.
 */
export function reconcileRecipeStatistics(recipeId, session) {
  assertValidObjectId(recipeId, "recipe ID");

  return runReconciliation(session, async (transactionSession) => {
    /**
     * Only a non-deleted Recipe has a publicly
     * maintained statistics projection.
     */
    const recipe = await findNonDeletedRecipeById(recipeId, transactionSession);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Rating source data.
     */
    const ratingStats = await getRatingStatsByRecipeId(
      recipeId,
      transactionSession
    );

    const {
      ratingCount = 0,
      ratingSum = 0,
      averageRating = 0,
    } = ratingStats ?? {};

    /**
     * Comment source data.
     */
    const commentCount = await countTopLevelCommentsByRecipeId(
      recipeId,
      transactionSession
    );

    /**
     * Rebuild rating projection.
     */
    const updatedRecipe = await setRecipeRatingStats(
      recipeId,
      {
        ratingCount,
        ratingSum,
        averageRating,
      },
      transactionSession
    );

    assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );

    /**
     * Rebuild comment projection.
     */
    const finalRecipe = await setRecipeCommentCount(
      recipeId,
      commentCount,
      transactionSession
    );

    return assertUpdatedDocument(
      finalRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/**
 * --------------------------------------------------------------------------
 * Comment Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Rebuild top-level Comment reaction counters.
 *
 * Source of truth:
 * Reaction documents targeting the Comment
 *
 * Projection:
 * - Comment.likeCount
 * - Comment.dislikeCount
 */
export function reconcileCommentReactionStats(commentId, session) {
  assertValidObjectId(commentId, "comment ID");

  return runReconciliation(session, async (transactionSession) => {
    const sourceStats = await getCommentReactionStats(
      commentId,
      transactionSession
    );

    const { likeCount = 0, dislikeCount = 0 } = sourceStats ?? {};

    const updatedComment = await setCommentReactionStats(
      commentId,
      {
        likeCount,
        dislikeCount,
      },
      transactionSession
    );

    return assertUpdatedDocument(
      updatedComment,
      ERROR_CODES.COMMENT_NOT_FOUND,
      "نظر پیدا نشد."
    );
  });
}

/**
 * --------------------------------------------------------------------------
 * Reply Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Rebuild embedded Reply reaction counters.
 *
 * Source of truth:
 * Reaction documents targeting the Reply
 *
 * Projection:
 * - Reply.likeCount
 * - Reply.dislikeCount
 */
export function reconcileReplyReactionStats(commentId, replyId, session) {
  assertValidObjectId(commentId, "comment ID");

  assertValidObjectId(replyId, "reply ID");

  return runReconciliation(session, async (transactionSession) => {
    const sourceStats = await getReplyReactionStats(
      replyId,
      transactionSession
    );

    const { likeCount = 0, dislikeCount = 0 } = sourceStats ?? {};

    const updatedComment = await setReplyReactionStats(
      commentId,
      replyId,
      {
        likeCount,
        dislikeCount,
      },
      transactionSession
    );

    return assertUpdatedDocument(
      updatedComment,
      ERROR_CODES.COMMENT_NOT_FOUND,
      "نظر یا پاسخ پیدا نشد."
    );
  });
}

/**
 * --------------------------------------------------------------------------
 * User Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Rebuild User statistics from their source collections.
 *
 * Source of truth:
 *
 * Recipe collection:
 * - recipeCount
 * - totalRecipeViews
 *
 * Rating collection belonging to the User's
 * non-deleted Recipes:
 * - ratingCount
 * - ratingSum
 * - averageRating
 *
 * Projection:
 *
 * User.stats.recipeCount
 * User.stats.totalRecipeViews
 * User.stats.ratingCount
 * User.stats.ratingSum
 * User.stats.averageRating
 *
 * IMPORTANT:
 *
 * Normal Rating mutations should use
 * updateUserRatingStatsDeltas().
 *
 * This function is intended for:
 * - reconciliation
 * - repair
 * - rebuild operations
 *
 * When a session is supplied, it is reused.
 */
export function reconcileUserStatistics(userId, session) {
  assertValidObjectId(userId, "user ID");

  return runReconciliation(session, async (transactionSession) => {
    const sourceStats = await getUserStatisticsSourceData(
      userId,
      transactionSession
    );

    const {
      recipeCount = 0,
      totalRecipeViews = 0,
      ratingCount = 0,
      ratingSum = 0,
      averageRating = 0,
    } = sourceStats ?? {};

    const updatedUser = await setUserStats(
      userId,
      {
        recipeCount,
        totalRecipeViews,
        ratingCount,
        ratingSum,
        averageRating,
      },
      transactionSession
    );

    return assertUpdatedDocument(
      updatedUser,
      ERROR_CODES.USER_NOT_FOUND,
      "کاربر پیدا نشد."
    );
  });
}

/**
 * --------------------------------------------------------------------------
 * Category Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Rebuild Category recipe count.
 *
 * Source of truth:
 * Non-deleted Recipe documents belonging
 * to the Category
 *
 * Projection:
 * - Category.stats.recipeCount
 *
 * When a session is supplied, it is reused.
 */
export function reconcileCategoryStatistics(categoryId, session) {
  assertValidObjectId(categoryId, "category ID");

  return runReconciliation(session, async (transactionSession) => {
    const sourceStats = await getCategoryStatisticsSourceData(
      categoryId,
      transactionSession
    );

    const { recipeCount = 0 } = sourceStats ?? {};

    const updatedCategory = await setCategoryRecipeCount(
      categoryId,
      recipeCount,
      transactionSession
    );

    return assertUpdatedDocument(
      updatedCategory,
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "دسته‌بندی پیدا نشد."
    );
  });
}
