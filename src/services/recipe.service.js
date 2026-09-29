import {
  addCommentReply,
  createComment as createCommentRepository,
  findCommentById,
  findCommentByReplyId,
  findCommentsByRecipe,
  findDeletedCommentById,
  restoreComment as restoreCommentRepository,
  softDeleteComment,
  softDeleteCommentReplyById,
} from "@/repositories/comment.repository";

import { incrementCommentCount } from "@/repositories/recipe.repository";

import { findNonDeletedRecipeById } from "@/repositories/recipe.repository";

import {
  CURSOR_RESOURCES,
  NOTIFICATION_TYPES,
  USER_ROLES,
} from "@/constants/enums";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { getAccessibleRecipe } from "@/lib/helpers/recipe-access";

import { assertCursorResource } from "@/lib/pagination/cursor-context";

import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";

import { normalizeLimit } from "@/lib/pagination/limit";

import { withTransaction } from "@/lib/transaction";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { createSystemNotification } from "./notification.service";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;

const MAX_LIST_LIMIT = 50;

const MAX_COMMENT_LENGTH = 1000;

/**
 * --------------------------------------------------------------------------
 * Authorization Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the current user owns the Comment
 * or is an administrator.
 *
 * Authentication and active-account validation
 * are performed by the caller.
 */
function assertCommentOwnerOrAdmin(user, comment) {
  const isOwner = comment.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه حذف این نظر را ندارید.",
      {
        statusCode: 403,
      }
    );
  }
}

/**
 * Ensure the current user owns the Reply
 * or is an administrator.
 */
function assertReplyOwnerOrAdmin(user, reply) {
  const isOwner = reply.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه حذف این پاسخ را ندارید.",
      {
        statusCode: 403,
      }
    );
  }
}

/**
 * Only the Recipe owner or an administrator
 * may provide an official reply.
 */
function assertCanReplyToComment(user, recipe) {
  const isRecipeOwner = recipe.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isRecipeOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "فقط صاحب دستور پخت یا مدیر سیستم می‌تواند به نظر پاسخ دهد.",
      {
        statusCode: 403,
      }
    );
  }
}

/**
 * Ensure an update result exists.
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
 * --------------------------------------------------------------------------
 * Validation / Normalization
 * --------------------------------------------------------------------------
 */

/**
 * Normalize and validate Comment text.
 *
 * Zod validation should normally enforce these rules
 * at the external input boundary as well.
 */
function normalizeCommentText(text) {
  if (typeof text !== "string") {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, "متن نظر نامعتبر است.", {
      statusCode: 400,
    });
  }

  const normalizedText = text.trim();

  if (!normalizedText) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نظر نمی‌تواند خالی باشد.",
      {
        statusCode: 400,
      }
    );
  }

  if (normalizedText.length > MAX_COMMENT_LENGTH) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نظر از حداکثر طول مجاز بیشتر است.",
      {
        statusCode: 400,
      }
    );
  }

  return normalizedText;
}

/**
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

/**
 * Create the next cursor from the last Comment
 * in the current page.
 */
function createNextCursor(comments) {
  if (!comments.length) {
    return null;
  }

  const lastComment = comments[comments.length - 1];

  if (!lastComment.createdAt || !lastComment._id) {
    return null;
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.COMMENTS,

    createdAt: lastComment.createdAt.toISOString(),

    id: lastComment._id.toString(),
  });
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get a single active Comment by ID.
 *
 * The parent Recipe must currently be accessible.
 */
export async function getCommentById(commentId) {
  assertValidObjectId(commentId, "comment ID");

  const comment = await findCommentById(commentId);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
      statusCode: 404,
    });
  }

  await getAccessibleRecipe(comment.recipeId);

  return comment;
}

/**
 * Get active Comments for an accessible Recipe
 * using cursor-based pagination.
 */
export async function getCommentsByRecipe({
  recipeId,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertValidObjectId(recipeId, "recipe ID");

  await getAccessibleRecipe(recipeId);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let decodedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, CURSOR_RESOURCES.COMMENTS);

    decodedCursor = normalizeCreatedAtIdCursor(payload);
  }

  const comments = await findCommentsByRecipe({
    recipeId,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = comments.length > normalizedLimit;

  const items = hasMore ? comments.slice(0, normalizedLimit) : comments;

  const nextCursor = hasMore ? createNextCursor(items) : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a new top-level Comment.
 *
 * Only an active authenticated user may create a Comment.
 */
export async function createComment(currentUser, recipeId, text) {
  assertValidObjectId(recipeId, "recipe ID");

  const normalizedText = normalizeCommentText(text);

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const { recipe } = await getAccessibleRecipe(recipeId, session);

    const comment = await createCommentRepository(
      {
        authorId: user._id,
        recipeId,
        text: normalizedText,
      },
      session
    );

    const updatedRecipe = await incrementCommentCount(recipeId, 1, session);

    assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "شمارنده نظرهای دستور پخت به‌روزرسانی نشد."
    );

    if (recipe.authorId.toString() !== user._id.toString()) {
      await createSystemNotification(
        {
          userId: recipe.authorId,

          actorId: user._id,

          type: NOTIFICATION_TYPES.RECIPE_COMMENTED,

          title: "نظر جدید برای دستور پخت شما",

          message: `${user.username} روی دستور پخت شما نظر گذاشت.`,

          recipeId: recipe._id,

          commentId: comment._id,
        },
        session
      );
    }

    return comment;
  });
}

/**
 * --------------------------------------------------------------------------
 * Reply
 * --------------------------------------------------------------------------
 */

/**
 * Create an official Reply to a Comment.
 *
 * Only the Recipe owner or an administrator
 * may create the Reply.
 */
export async function createCommentReply(currentUser, commentId, text) {
  assertValidObjectId(commentId, "comment ID");

  const normalizedText = normalizeCommentText(text);

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const comment = await findCommentById(commentId, session);

    if (!comment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
        statusCode: 404,
      });
    }

    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

    assertCanReplyToComment(user, recipe);

    const updatedComment = await addCommentReply(
      commentId,
      {
        authorId: user._id,

        text: normalizedText,

        deletedAt: null,
      },
      session
    );

    if (!updatedComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "پاسخ به نظر اضافه نشد.",
        {
          statusCode: 404,
        }
      );
    }

    if (comment.authorId.toString() !== user._id.toString()) {
      await createSystemNotification(
        {
          userId: comment.authorId,

          actorId: user._id,

          type: NOTIFICATION_TYPES.COMMENT_REPLIED,

          title: "پاسخ جدید به نظر شما",

          message: `${user.username} به نظر شما پاسخ داد.`,

          recipeId: recipe._id,

          commentId: comment._id,
        },
        session
      );
    }

    return updatedComment;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete Comment
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete a top-level Comment.
 *
 * The parent Recipe does not need to be publicly accessible
 * in order to delete the Comment.
 *
 * If the Recipe itself has already been soft-deleted,
 * its comment counter is no longer updated.
 */
export async function deleteComment(currentUser, commentId) {
  assertValidObjectId(commentId, "comment ID");

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const comment = await findCommentById(commentId, session);

    if (!comment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
        statusCode: 404,
      });
    }

    assertCommentOwnerOrAdmin(user, comment);

    const deletedComment = await softDeleteComment(
      commentId,
      new Date(),
      session
    );

    assertUpdatedDocument(
      deletedComment,
      ERROR_CODES.COMMENT_NOT_FOUND,
      "نظر حذف نشد."
    );

    /**
     * Update Recipe.commentCount only when
     * the parent Recipe itself is still non-deleted.
     */
    const recipe = await findNonDeletedRecipeById(comment.recipeId, session);

    if (recipe) {
      const updatedRecipe = await incrementCommentCount(
        comment.recipeId,
        -1,
        session
      );

      assertUpdatedDocument(
        updatedRecipe,
        ERROR_CODES.RECIPE_NOT_FOUND,
        "شمارنده نظرهای دستور پخت به‌روزرسانی نشد."
      );
    }

    return deletedComment;
  });
}

/**
 * --------------------------------------------------------------------------
 * Restore Comment
 * --------------------------------------------------------------------------
 */

/**
 * Restore a soft-deleted top-level Comment.
 *
 * Only an active administrator may restore it.
 *
 * The parent Recipe must currently be accessible.
 */
export async function restoreComment(currentUser, commentId) {
  assertValidObjectId(commentId, "comment ID");

  return withTransaction(async (session) => {
    await assertAdmin(currentUser, session);

    const comment = await findDeletedCommentById(commentId, session);

    if (!comment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "نظر حذف‌شده پیدا نشد.",
        {
          statusCode: 404,
        }
      );
    }

    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

    const restoredComment = await restoreCommentRepository(commentId, session);

    assertUpdatedDocument(
      restoredComment,
      ERROR_CODES.COMMENT_NOT_FOUND,
      "بازیابی نظر ممکن نبود."
    );

    const updatedRecipe = await incrementCommentCount(
      comment.recipeId,
      1,
      session
    );

    assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "شمارنده نظرهای دستور پخت به‌روزرسانی نشد."
    );

    return restoredComment;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete Reply
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete an embedded Reply.
 *
 * The Reply remains embedded so its Reaction documents
 * remain valid.
 *
 * Only the Reply author or an administrator
 * may delete it.
 */
export async function deleteCommentReply(currentUser, replyId) {
  assertValidObjectId(replyId, "reply ID");

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

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

    assertReplyOwnerOrAdmin(user, reply);

    const deletedAt = new Date();

    const updatedComment = await softDeleteCommentReplyById(
      replyId,
      deletedAt,
      session
    );

    if (!updatedComment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ حذف نشد.", {
        statusCode: 404,
      });
    }

    const deletedReply = updatedComment.replies?.find(
      (item) => item._id?.toString() === replyId.toString()
    );

    return deletedReply ?? reply;
  });
}
