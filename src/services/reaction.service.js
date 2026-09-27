import {
  createReaction as createReactionRepository,
  deleteReactionByUserAndComment,
  deleteReactionByUserAndReply,
  findReactionByUserAndComment,
  findReactionByUserAndReply,
  updateReactionTypeByComment,
  updateReactionTypeByReply,
} from "@/repositories/reaction.repository";

import {
  findCommentById,
  findCommentByReplyId,
  updateReactionCountDeltas,
  updateReplyReactionCountDeltas,
} from "@/repositories/comment.repository";

import { createSystemNotification } from "@/services/notification.service";

import { ERROR_CODES } from "@/constants/error-codes";

import { requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { withTransaction } from "@/lib/transaction";

import { assertEnum } from "@/lib/validation/enum";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { NOTIFICATION_TYPES, REACTION_TYPES } from "@/constants/enums";

import { getAccessibleRecipe } from "@/lib/helpers/recipe-access";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const REACTION_TARGET_TYPES = Object.freeze({
  COMMENT: "COMMENT",
  REPLY: "REPLY",
});

/**
 * --------------------------------------------------------------------------
 * Authentication / Validation
 * --------------------------------------------------------------------------
 */

/**
 * Get the notification type corresponding to the
 * selected Reaction type.
 */
function getReactionNotificationType(type) {
  return type === REACTION_TYPES.LIKE
    ? NOTIFICATION_TYPES.COMMENT_LIKED
    : NOTIFICATION_TYPES.COMMENT_DISLIKED;
}

/**
 * Ensure the Reaction target type is valid.
 */
function assertValidReactionTargetType(targetType) {
  assertEnum(targetType, Object.values(REACTION_TARGET_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع هدف واکنش نامعتبر است.",
    statusCode: 400,
  });
}

/**
 * Ensure the Reaction type is valid.
 */
function assertValidReactionType(type) {
  assertEnum(type, Object.values(REACTION_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع واکنش نامعتبر است.",
    statusCode: 400,
  });
}

/**
 * --------------------------------------------------------------------------
 * Comment Context
 * --------------------------------------------------------------------------
 */

/**
 * Find an active Comment and its accessible parent Recipe.
 *
 * User-facing Reaction operations on a top-level Comment
 * require both the Comment and its Recipe to be active.
 */
async function getActiveCommentContext(commentId, session) {
  const comment = await findCommentById(commentId, session);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

  return {
    comment,
    recipe,
  };
}

/**
 * --------------------------------------------------------------------------
 * Reply Context
 * --------------------------------------------------------------------------
 */

/**
 * Find an active embedded Reply, its parent Comment,
 * and its accessible parent Recipe.
 */
async function getActiveReplyContext(replyId, session) {
  const comment = await findCommentByReplyId(replyId, session);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ پیدا نشد.", {
      statusCode: 404,
    });
  }

  const reply = comment.replies?.find(
    (item) => item._id?.toString() === replyId.toString()
  );

  if (!reply) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ پیدا نشد.", {
      statusCode: 404,
    });
  }

  const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

  return {
    comment,
    reply,
    recipe,
  };
}

/**
 * --------------------------------------------------------------------------
 * Reaction Target Context
 * --------------------------------------------------------------------------
 */

/**
 * Resolve and validate a Reaction target.
 *
 * Returns the target itself together with its
 * parent Comment and Recipe.
 */
async function getActiveReactionTargetContext(targetType, targetId, session) {
  assertValidReactionTargetType(targetType);
  assertValidObjectId(targetId, "reaction target ID");

  if (targetType === REACTION_TARGET_TYPES.COMMENT) {
    const { comment, recipe } = await getActiveCommentContext(
      targetId,
      session
    );

    return {
      targetType,
      comment,
      recipe,
      target: comment,
    };
  }

  const { comment, reply, recipe } = await getActiveReplyContext(
    targetId,
    session
  );

  return {
    targetType,
    comment,
    reply,
    recipe,
    target: reply,
  };
}

/**
 * --------------------------------------------------------------------------
 * Reaction Repository Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Find the current user's Reaction for a target.
 */
function findUserReaction(userId, targetType, targetId, session) {
  if (targetType === REACTION_TARGET_TYPES.COMMENT) {
    return findReactionByUserAndComment(userId, targetId, session);
  }

  return findReactionByUserAndReply(userId, targetId, session);
}

/**
 * Delete the current user's Reaction for a target.
 */
function deleteUserReaction(userId, targetType, targetId, session) {
  if (targetType === REACTION_TARGET_TYPES.COMMENT) {
    return deleteReactionByUserAndComment(userId, targetId, session);
  }

  return deleteReactionByUserAndReply(userId, targetId, session);
}

/**
 * --------------------------------------------------------------------------
 * Reaction Counter Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Apply Reaction counter deltas to the target.
 */
function updateTargetReactionCounts({
  targetType,
  comment,
  reply,
  targetId,
  likeDelta,
  dislikeDelta,
  session,
}) {
  if (targetType === REACTION_TARGET_TYPES.COMMENT) {
    return updateReactionCountDeltas(
      comment._id,
      likeDelta,
      dislikeDelta,
      session
    );
  }

  return updateReplyReactionCountDeltas(
    comment._id,
    reply._id,
    likeDelta,
    dislikeDelta,
    session
  );
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's Reaction for a Comment or Reply.
 *
 * Returns null when the user has not reacted yet.
 */
export async function getUserReaction(currentUser, targetType, targetId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  const context = await getActiveReactionTargetContext(targetType, targetId);

  return findUserReaction(user._id, context.targetType, targetId);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a Reaction for a Comment or Reply.
 *
 * Reaction is the source of truth.
 * Target reaction counters are updated atomically
 * in the same transaction.
 */
export async function createReaction(currentUser, targetType, targetId, type) {
  assertValidReactionTargetType(targetType);

  assertValidObjectId(targetId, "reaction target ID");

  assertValidReactionType(type);

  return withTransaction(async (session) => {
    /**
     * Resolve the current account again inside
     * the transaction so the mutation uses a fresh
     * ACTIVE user.
     */
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const context = await getActiveReactionTargetContext(
      targetType,
      targetId,
      session
    );

    const { comment, reply, recipe } = context;

    /**
     * Pre-check for the normal duplicate path.
     *
     * The unique database index remains the final
     * protection against concurrent duplicates.
     */
    const existingReaction = await findUserReaction(
      user._id,
      targetType,
      targetId,
      session
    );

    if (existingReaction) {
      throw new AppError(
        ERROR_CODES.REACTION_ALREADY_EXISTS,
        "شما قبلاً به این مورد واکنش نشان داده‌اید.",
        { statusCode: 409 }
      );
    }

    let reaction;

    try {
      reaction = await createReactionRepository(
        targetType === REACTION_TARGET_TYPES.COMMENT
          ? {
              userId: user._id,
              commentId: targetId,
              type,
            }
          : {
              userId: user._id,
              replyId: targetId,
              type,
            },
        session
      );
    } catch (error) {
      /**
       * Final protection against concurrent duplicate
       * reactions via the corresponding unique index.
       */
      if (error?.code === 11000) {
        throw new AppError(
          ERROR_CODES.REACTION_ALREADY_EXISTS,
          "شما قبلاً به این مورد واکنش نشان داده‌اید.",
          { statusCode: 409 }
        );
      }

      throw error;
    }

    const likeDelta = type === REACTION_TYPES.LIKE ? 1 : 0;

    const dislikeDelta = type === REACTION_TYPES.DISLIKE ? 1 : 0;

    const updatedTarget = await updateTargetReactionCounts({
      targetType,
      comment,
      reply,
      targetId,
      likeDelta,
      dislikeDelta,
      session,
    });

    if (!updatedTarget) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "شمارنده‌های واکنش به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    const targetAuthorId =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? comment.authorId
        : reply.authorId;

    const isTargetOwner = targetAuthorId.toString() === user._id.toString();

    /**
     * Do not notify the actor about their own Reaction.
     */
    if (!isTargetOwner) {
      await createSystemNotification(
        {
          userId: targetAuthorId,
          actorId: user._id,
          type: getReactionNotificationType(type),
          title: type === REACTION_TYPES.LIKE ? "لایک جدید" : "دیس‌لایک جدید",
          message:
            type === REACTION_TYPES.LIKE
              ? `${user.username} مورد شما را پسندید.`
              : `${user.username} مورد شما را نپسندید.`,
          recipeId: recipe._id,
          commentId: comment._id,

          ...(targetType === REACTION_TARGET_TYPES.REPLY
            ? {
                replyId: reply._id,
              }
            : {}),
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
 * Update the current user's Reaction type
 * for a Comment or Reply.
 *
 * The selected type must be different from
 * the current type.
 */
export async function updateReaction(currentUser, targetType, targetId, type) {
  assertValidReactionTargetType(targetType);

  assertValidObjectId(targetId, "reaction target ID");

  assertValidReactionType(type);

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const context = await getActiveReactionTargetContext(
      targetType,
      targetId,
      session
    );

    const { comment, reply, recipe } = context;

    const existingReaction = await findUserReaction(
      user._id,
      targetType,
      targetId,
      session
    );

    if (!existingReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Idempotent behavior:
     * nothing changes when the selected type
     * is already active.
     */
    if (existingReaction.type === type) {
      return existingReaction;
    }

    const updatedReaction =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? await updateReactionTypeByComment(user._id, targetId, type, session)
        : await updateReactionTypeByReply(user._id, targetId, type, session);

    if (!updatedReaction) {
      throw new AppError(
        ERROR_CODES.REACTION_NOT_FOUND,
        "واکنش به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    /**
     * Move one Reaction from its previous type
     * to the new type.
     *
     * LIKE    -> DISLIKE : (-1, +1)
     * DISLIKE -> LIKE    : (+1, -1)
     */
    const likeDelta = existingReaction.type === REACTION_TYPES.LIKE ? -1 : 1;

    const dislikeDelta =
      existingReaction.type === REACTION_TYPES.DISLIKE ? -1 : 1;

    const updatedTarget = await updateTargetReactionCounts({
      targetType,
      comment,
      reply,
      targetId,
      likeDelta,
      dislikeDelta,
      session,
    });

    if (!updatedTarget) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "شمارنده‌های واکنش به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    const targetAuthorId =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? comment.authorId
        : reply.authorId;

    const isTargetOwner = targetAuthorId.toString() === user._id.toString();

    /**
     * Notify only when the Reaction actually changed.
     */
    if (!isTargetOwner) {
      await createSystemNotification(
        {
          userId: targetAuthorId,
          actorId: user._id,
          type: getReactionNotificationType(type),
          title: type === REACTION_TYPES.LIKE ? "لایک جدید" : "دیس‌لایک جدید",
          message:
            type === REACTION_TYPES.LIKE
              ? `${user.username} مورد شما را پسندید.`
              : `${user.username} مورد شما را نپسندید.`,
          recipeId: recipe._id,
          commentId: comment._id,

          ...(targetType === REACTION_TARGET_TYPES.REPLY
            ? {
                replyId: reply._id,
              }
            : {}),
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
 * Delete the current user's Reaction from
 * a Comment or Reply.
 *
 * The corresponding target counter is decremented
 * atomically in the same transaction.
 */
export async function deleteReaction(currentUser, targetType, targetId) {
  assertValidReactionTargetType(targetType);

  assertValidObjectId(targetId, "reaction target ID");

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const context = await getActiveReactionTargetContext(
      targetType,
      targetId,
      session
    );

    const { comment, reply } = context;

    const existingReaction = await findUserReaction(
      user._id,
      targetType,
      targetId,
      session
    );

    if (!existingReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش پیدا نشد.", {
        statusCode: 404,
      });
    }

    const deletedReaction = await deleteUserReaction(
      user._id,
      targetType,
      targetId,
      session
    );

    if (!deletedReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش حذف نشد.", {
        statusCode: 404,
      });
    }

    const likeDelta = existingReaction.type === REACTION_TYPES.LIKE ? -1 : 0;

    const dislikeDelta =
      existingReaction.type === REACTION_TYPES.DISLIKE ? -1 : 0;

    const updatedTarget = await updateTargetReactionCounts({
      targetType,
      comment,
      reply,
      targetId,
      likeDelta,
      dislikeDelta,
      session,
    });

    if (!updatedTarget) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "شمارنده‌های واکنش به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    return deletedReaction;
  });
}
