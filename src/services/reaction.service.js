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

import { assertAuthenticated } from "@/lib/auth/guards";

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

function getReactionNotificationType(type) {
  return type === REACTION_TYPES.LIKE
    ? NOTIFICATION_TYPES.COMMENT_LIKED
    : NOTIFICATION_TYPES.COMMENT_DISLIKED;
}

function assertValidReactionTargetType(targetType) {
  assertEnum(targetType, Object.values(REACTION_TARGET_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع هدف واکنش نامعتبر است.",
    statusCode: 400,
  });
}

/**
 * --------------------------------------------------------------------------
 * Comment Context
 * --------------------------------------------------------------------------
 */

/**
 * Find an active comment and its active parent recipe.
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

  const recipe = await getAccessibleRecipe(comment.recipeId, session);

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
 * and its active parent Recipe.
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

  const recipe = await getAccessibleRecipe(comment.recipeId, session);

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
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's reaction for a Comment or Reply.
 *
 * Returns null when the user has not reacted yet.
 */
export async function getUserReaction(currentUser, targetType, targetId) {
  assertAuthenticated(currentUser);

  const context = await getActiveReactionTargetContext(targetType, targetId);

  if (context.targetType === REACTION_TARGET_TYPES.COMMENT) {
    return findReactionByUserAndComment(currentUser._id, targetId);
  }

  return findReactionByUserAndReply(currentUser._id, targetId);
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
  assertAuthenticated(currentUser);

  assertValidReactionTargetType(targetType);

  assertValidObjectId(targetId, "reaction target ID");

  assertEnum(type, Object.values(REACTION_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع واکنش نامعتبر است.",
    statusCode: 400,
  });

  return withTransaction(async (session) => {
    const context = await getActiveReactionTargetContext(
      targetType,
      targetId,
      session
    );

    const { comment, reply, recipe } = context;

    const existingReaction =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? await findReactionByUserAndComment(currentUser._id, targetId, session)
        : await findReactionByUserAndReply(currentUser._id, targetId, session);

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
              userId: currentUser._id,
              commentId: targetId,
              type,
            }
          : {
              userId: currentUser._id,
              replyId: targetId,
              type,
            },
        session
      );
    } catch (error) {
      // Final protection against concurrent duplicate
      // reactions via the corresponding unique index.
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

    let updatedTarget;

    if (targetType === REACTION_TARGET_TYPES.COMMENT) {
      updatedTarget = await updateReactionCountDeltas(
        comment._id,
        likeDelta,
        dislikeDelta,
        session
      );
    } else {
      updatedTarget = await updateReplyReactionCountDeltas(
        comment._id,
        reply._id,
        likeDelta,
        dislikeDelta,
        session
      );
    }

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

    const isTargetOwner =
      targetAuthorId.toString() === currentUser._id.toString();

    if (!isTargetOwner) {
      await createSystemNotification(
        {
          userId: targetAuthorId,
          actorId: currentUser._id,
          type: getReactionNotificationType(type),
          title: type === REACTION_TYPES.LIKE ? "لایک جدید" : "دیس‌لایک جدید",
          message:
            type === REACTION_TYPES.LIKE
              ? `${currentUser.username} مورد شما را پسندید.`
              : `${currentUser.username} مورد شما را نپسندید.`,
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
  assertAuthenticated(currentUser);

  assertValidReactionTargetType(targetType);

  assertValidObjectId(targetId, "reaction target ID");

  assertEnum(type, Object.values(REACTION_TYPES), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "نوع واکنش نامعتبر است.",
    statusCode: 400,
  });

  return withTransaction(async (session) => {
    const context = await getActiveReactionTargetContext(
      targetType,
      targetId,
      session
    );

    const { comment, reply, recipe } = context;

    const existingReaction =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? await findReactionByUserAndComment(currentUser._id, targetId, session)
        : await findReactionByUserAndReply(currentUser._id, targetId, session);

    if (!existingReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش پیدا نشد.", {
        statusCode: 404,
      });
    }

    // Nothing changes when the selected reaction
    // type is already active.
    if (existingReaction.type === type) {
      return existingReaction;
    }

    const updatedReaction =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? await updateReactionTypeByComment(
            currentUser._id,
            targetId,
            type,
            session
          )
        : await updateReactionTypeByReply(
            currentUser._id,
            targetId,
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

    const likeDelta = existingReaction.type === REACTION_TYPES.LIKE ? -1 : 1;

    const dislikeDelta =
      existingReaction.type === REACTION_TYPES.DISLIKE ? -1 : 1;

    let updatedTarget;

    if (targetType === REACTION_TARGET_TYPES.COMMENT) {
      updatedTarget = await updateReactionCountDeltas(
        comment._id,
        likeDelta,
        dislikeDelta,
        session
      );
    } else {
      updatedTarget = await updateReplyReactionCountDeltas(
        comment._id,
        reply._id,
        likeDelta,
        dislikeDelta,
        session
      );
    }

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

    const isTargetOwner =
      targetAuthorId.toString() === currentUser._id.toString();

    if (!isTargetOwner) {
      await createSystemNotification(
        {
          userId: targetAuthorId,
          actorId: currentUser._id,
          type: getReactionNotificationType(type),
          title: type === REACTION_TYPES.LIKE ? "لایک جدید" : "دیس‌لایک جدید",
          message:
            type === REACTION_TYPES.LIKE
              ? `${currentUser.username} مورد شما را پسندید.`
              : `${currentUser.username} مورد شما را نپسندید.`,
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
  assertAuthenticated(currentUser);

  assertValidReactionTargetType(targetType);

  assertValidObjectId(targetId, "reaction target ID");

  return withTransaction(async (session) => {
    const context = await getActiveReactionTargetContext(
      targetType,
      targetId,
      session
    );

    const { comment, reply } = context;

    const existingReaction =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? await findReactionByUserAndComment(currentUser._id, targetId, session)
        : await findReactionByUserAndReply(currentUser._id, targetId, session);

    if (!existingReaction) {
      throw new AppError(ERROR_CODES.REACTION_NOT_FOUND, "واکنش پیدا نشد.", {
        statusCode: 404,
      });
    }

    const deletedReaction =
      targetType === REACTION_TARGET_TYPES.COMMENT
        ? await deleteReactionByUserAndComment(
            currentUser._id,
            targetId,
            session
          )
        : await deleteReactionByUserAndReply(
            currentUser._id,
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

    let updatedTarget;

    if (targetType === REACTION_TARGET_TYPES.COMMENT) {
      updatedTarget = await updateReactionCountDeltas(
        comment._id,
        likeDelta,
        dislikeDelta,
        session
      );
    } else {
      updatedTarget = await updateReplyReactionCountDeltas(
        comment._id,
        reply._id,
        likeDelta,
        dislikeDelta,
        session
      );
    }

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
