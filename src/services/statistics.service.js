import { ERROR_CODES } from "@/constants/error-codes";

import AppError from "@/lib/errors/AppError";

import { withTransaction } from "@/lib/transaction";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { findNonDeletedRecipeById } from "@/repositories/recipe.repository";

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
 * Internal Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Ensure that the expected document was actually updated.
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
 * When no session is supplied, the reconciliation is executed inside
 * a new transaction.
 *
 * This allows the same service function to be used:
 *
 * 1. inside a domain transaction
 * 2. as an independent repair operation
 *
 * without creating nested transactions.
 */
function runReconciliation(session, operation) {
  if (session) {
    return operation(session);
  }

  return withTransaction(async (transactionSession) => {
    return operation(transactionSession);
  });
}

/**
 * --------------------------------------------------------------------------
 * Recipe Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Reconcile Recipe rating statistics.
 *
 * Source of truth:
 * Rating documents
 *
 * Projection:
 * Recipe.stats.ratingCount
 * Recipe.stats.ratingSum
 * Recipe.stats.averageRating
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
 * Reconcile Recipe comment count.
 *
 * Source of truth:
 * Active top-level Comment documents
 *
 * Projection:
 * Recipe.stats.commentCount
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
 * Reconcile all currently maintained Recipe statistics.
 *
 * Reconciled projections:
 *
 * Recipe.stats.ratingCount
 * Recipe.stats.ratingSum
 * Recipe.stats.averageRating
 * Recipe.stats.commentCount
 *
 * Recipe.stats.viewCount is intentionally excluded because
 * it is currently the stored source of truth for Recipe views.
 */
export function reconcileRecipeStatistics(recipeId, session) {
  assertValidObjectId(recipeId, "recipe ID");

  return runReconciliation(session, async (transactionSession) => {
    const recipe = await findNonDeletedRecipeById(recipeId, transactionSession);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Rating statistics.
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
     * Comment statistics.
     */
    const commentCount = await countTopLevelCommentsByRecipeId(
      recipeId,
      transactionSession
    );

    /**
     * Update rating projection.
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
     * Update comment projection.
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
 * Reconcile top-level Comment reaction statistics.
 *
 * Source of truth:
 * Reaction documents targeting the Comment
 *
 * Projection:
 * Comment.likeCount
 * Comment.dislikeCount
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
 * Reconcile embedded Reply reaction statistics.
 *
 * Source of truth:
 * Reaction documents targeting the Reply
 *
 * Projection:
 * Reply.likeCount
 * Reply.dislikeCount
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
 * Reconcile User statistics.
 *
 * Source of truth:
 *
 * Recipe collection:
 * - recipeCount
 * - totalRecipeViews
 *
 * Rating collection joined through non-deleted Recipes:
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
 * When this function receives an existing transaction session,
 * the same transaction is reused.
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
 * Reconcile Category recipe count.
 *
 * Source of truth:
 * Non-deleted Recipe documents belonging to the Category
 *
 * Projection:
 * Category.stats.recipeCount
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
