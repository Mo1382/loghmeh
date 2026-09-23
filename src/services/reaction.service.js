import {
  calculateCommentReactionStats,
  createReaction as createReactionRepository,
  deleteReactionByUserAndComment,
  findReactionByUserAndComment,
  updateReactionType,
} from "@/repositories/reaction.repository";

import {
  findCommentById,
  updateReactionCounts,
} from "@/repositories/comment.repository";

import { createSystemNotification } from "@/services/notification.service";

import { ERROR_CODES } from "@/constants/error-codes";
import { assertAuthenticated } from "@/lib/auth/guards";
import AppError from "@/lib/errors/AppError";
import { withTransaction } from "@/lib/transaction";
import { assertEnum } from "@/lib/validation/enum";
import { assertValidObjectId } from "@/lib/validation/object-id";
import { NOTIFICATION_TYPES, REACTION_TYPES } from "@/constants/enums";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

/**
 * --------------------------------------------------------------------------
 * Authentication / Validation
 * --------------------------------------------------------------------------
 */

function getReactionNotificationType(type) {
  return type === REACTION_TYPES.LIKE
    ? NOTIFICATION_TYPES.COMMENT_LIKED
    : NOTIFICATION_TYPES.COMMENT_DISLIKED;
}

/**
 * --------------------------------------------------------------------------
 * Comment / Recipe validation
 * --------------------------------------------------------------------------
 */

/**
 * Find an active comment and its active parent recipe.
 *
 * All user-facing Reaction operations require both
 * the Comment and its parent Recipe to be active.
 */
async function getActiveCommentContext(commentId, session) {
  const comment = await findCommentById(commentId, session);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
      statusCode: 404,
    });
  }

  await getAccessibleRecipe(comment.recipeId);

  return {
    comment,
    recipe,
  };
}

/**
 * --------------------------------------------------------------------------
 * Reaction statistics
 * --------------------------------------------------------------------------
 */

/**
 * Recalculate Reaction counts from the Reaction collection
 * and synchronize the denormalized fields stored on Comment.
 *
 * Reaction is the source of truth.
 */
async function refreshCommentReactionStats(commentId, session) {
  const statsResult = await calculateCommentReactionStats(commentId, session);

  const stats = statsResult[0] ?? {
    likeCount: 0,
    dislikeCount: 0,
  };

  const updatedComment = await updateReactionCounts(
    commentId,
    stats.likeCount,
    stats.dislikeCount,
    session
  );

  if (!updatedComment) {
    throw new AppError(
      ERROR_CODES.COMMENT_NOT_FOUND,
      "شمارنده‌های واکنش نظر به‌روزرسانی نشد.",
      { statusCode: 404 }
    );
  }

  return {
    likeCount: stats.likeCount,
    dislikeCount: stats.dislikeCount,
  };
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's reaction for a comment.
 *
 * Returns null when the user has not reacted yet.
 */
export async function getUserReaction(currentUser, commentId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(commentId, "comment ID");

  await getActiveCommentContext(commentId);

  return findReactionByUserAndComment(currentUser._id, commentId);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a reaction for a comment.
 *
 * A user can have only one reaction per comment.
 */
export async function createReaction(currentUser, commentId, type) {
  assertAuthenticated(currentUser);

  assertValidObjectId(commentId, "comment ID");

  assertEnum(type, Object.values(REACTION_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع واکنش نامعتبر است.",
    statusCode: 400,
  });

  return withTransaction(async (session) => {
    await getActiveCommentContext(commentId, session);

    /**
     * Check whether this user already has
     * a reaction for the comment.
     *
     * The unique database index is the final
     * protection against concurrent duplicates.
     */
    const existingReaction = await findReactionByUserAndComment(
      currentUser._id,
      commentId,
      session
    );

    if (existingReaction) {
      throw new AppError(
        ERROR_CODES.REACTION_ALREADY_EXISTS,
        "شما قبلاً به این نظر واکنش نشان داده‌اید.",
        { statusCode: 409 }
      );
    }

    let reaction;

    try {
      reaction = await createReactionRepository(
        {
          userId: currentUser._id,
          commentId,
          type,
        },
        session
      );
    } catch (error) {
      /**
       * Handle a duplicate-key error from the
       * unique { userId, commentId } index.
       */
      if (error?.code === 11000) {
        throw new AppError(
          ERROR_CODES.REACTION_ALREADY_EXISTS,
          "شما قبلاً به این نظر واکنش نشان داده‌اید.",
          { statusCode: 409 }
        );
      }

      throw error;
    }

    /**
     * Reaction collection is the source of truth.
     * Recalculate and synchronize Comment counts.
     */
    await refreshCommentReactionStats(commentId, session);

    if (comment.authorId.toString() !== currentUser._id.toString()) {
      await createSystemNotification(
        {
          userId: comment.authorId,
          actorId: currentUser._id,
          type: getReactionNotificationType(type),
          title:
            type === REACTION_TYPES.LIKE
              ? "لایک جدید برای نظر شما"
              : "دیس‌لایک جدید برای نظر شما",
          message:
            type === REACTION_TYPES.LIKE
              ? `${currentUser.username} نظر شما را پسندید.`
              : `${currentUser.username} نظر شما را نپسندید.`,
          recipeId: recipe._id,
          commentId: comment._id,
        },
        session
      );
    }

    return reaction;
  });
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

/**
 * Change the current user's reaction type.
 *
 * Examples:
 * LIKE -> DISLIKE
 * DISLIKE -> LIKE
 */
export async function updateReaction(currentUser, commentId, type) {
  assertAuthenticated(currentUser);

  assertValidObjectId(commentId, "comment ID");

  assertEnum(type, Object.values(REACTION_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع واکنش نامعتبر است.",
    statusCode: 400,
  });

  return withTransaction(async (session) => {
    await getActiveCommentContext(commentId, session);

    const existingReaction = await findReactionByUserAndComment(
      currentUser._id,
      commentId,
      session
    );

    if (!existingReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Nothing needs to change when the selected
     * reaction type is already active.
     */
    if (existingReaction.type === type) {
      return existingReaction;
    }

    const updatedReaction = await updateReactionType(
      currentUser._id,
      commentId,
      type,
      session
    );

    if (!updatedReaction) {
      throw new AppError(
        ERROR_CODES.REACTION_NOT_FOUND,
        "واکنش به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    /**
     * Recalculate both counts because one reaction
     * moved from one type to the other.
     */
    await refreshCommentReactionStats(commentId, session);

    if (comment.authorId.toString() !== currentUser._id.toString()) {
      await createSystemNotification(
        {
          userId: comment.authorId,
          actorId: currentUser._id,
          type: getReactionNotificationType(type),
          title:
            type === REACTION_TYPES.LIKE
              ? "لایک جدید برای نظر شما"
              : "دیس‌لایک جدید برای نظر شما",
          message:
            type === REACTION_TYPES.LIKE
              ? `${currentUser.username} نظر شما را پسندید.`
              : `${currentUser.username} نظر شما را نپسندید.`,
          recipeId: recipe._id,
          commentId: comment._id,
        },
        session
      );
    }

    return updatedReaction;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Delete the current user's reaction from a comment.
 *
 * The user can remove their own reaction.
 */
export async function deleteReaction(currentUser, commentId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(commentId, "comment ID");

  return withTransaction(async (session) => {
    await getActiveCommentContext(commentId, session);

    const existingReaction = await findReactionByUserAndComment(
      currentUser._id,
      commentId,
      session
    );

    if (!existingReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش پیدا نشد.", {
        statusCode: 404,
      });
    }

    const deletedReaction = await deleteReactionByUserAndComment(
      currentUser._id,
      commentId,
      session
    );

    if (!deletedReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش حذف نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Recalculate the denormalized Comment counts
     * after removing the Reaction.
     */
    await refreshCommentReactionStats(commentId, session);

    return deletedReaction;
  });
}
