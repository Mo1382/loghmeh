import {
  addCommentReply,
  createComment as createCommentRepository,
  findCommentById,
  findCommentByReplyId,
  findCommentsByRecipe,
  findDeletedCommentById,
  restoreComment as restoreCommentRepository,
  softDeleteComment,
} from "@/repositories/comment.repository";

import { incrementCommentCount } from "@/repositories/recipe.repository";

import {
  CURSOR_RESOURCES,
  MAX_COMMENT_REPLIES,
  NOTIFICATION_TYPES,
  USER_ROLES,
} from "@/constants/enums";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { getAccessibleRecipe } from "@/lib/helpers/recipe-access";

import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";

import { normalizeLimit } from "@/lib/pagination/limit";

import { withTransaction } from "@/lib/transaction";

import { assertValidObjectId } from "@/lib/validation/object-id";

import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

import { createSystemNotification } from "./notification.service";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/**
 * --------------------------------------------------------------------------
 * Authentication / Authorization
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the authenticated user is the comment owner
 * or an administrator.
 *
 * The user must already be authenticated and active.
 */
function assertCommentOwnerOrAdmin(user, comment) {
  const isOwner = comment.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه حذف این نظر را ندارید.",
      { statusCode: 403 }
    );
  }
}

/**
 * Ensure the authenticated user is the reply owner
 * or an administrator.
 */
function assertReplyOwnerOrAdmin(user, reply) {
  const isOwner = reply.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه حذف این پاسخ را ندارید.",
      { statusCode: 403 }
    );
  }
}

/**
 * Ensure the authenticated user can provide an official
 * reply to a Recipe comment.
 *
 * Only the Recipe owner or an administrator may reply.
 */
function assertCanReplyToComment(user, recipe) {
  const isRecipeOwner = recipe.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isRecipeOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "فقط صاحب دستور پخت یا مدیر سیستم می‌تواند به نظر پاسخ دهد.",
      { statusCode: 403 }
    );
  }
}

function toPublicComment(comment) {
  const data = comment.toObject ? comment.toObject() : { ...comment };

  return {
    ...data,
    replies: (data.replies ?? []).filter((reply) => reply.deletedAt === null),
  };
}

/**
 * --------------------------------------------------------------------------
 * Validation / Normalization
 * --------------------------------------------------------------------------
 */

/**
 * Normalize and validate comment text.
 *
 * Zod validation should normally enforce these rules
 * at the input boundary as well.
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
      { statusCode: 400 }
    );
  }

  if (normalizedText.length > 1000) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نظر از حداکثر طول مجاز بیشتر است.",
      { statusCode: 400 }
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
 * Create the next cursor from the last comment
 * in the current page.
 */
function createNextCursor(comments, recipeId) {
  if (!comments.length) {
    return null;
  }

  const lastComment = comments[comments.length - 1];

  if (!lastComment.createdAt || !lastComment._id) {
    return null;
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.COMMENTS,
    recipeId: recipeId.toString(),
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
 * Get an active comment by ID.
 *
 * The parent Recipe must also be accessible.
 */
export async function getCommentById(commentId) {
  assertValidObjectId(commentId, "comment ID");

  const comment = await findCommentById(commentId);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
      statusCode: 404,
    });
  }

  /**
   * The comment is only publicly readable when its
   * parent Recipe is currently accessible.
   */
  await getAccessibleRecipe(comment.recipeId);

  return toPublicComment(comment);
}

/**
 * Get comments for an active Recipe using
 * cursor-based pagination.
 */
export async function getCommentsByRecipe({
  recipeId,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertValidObjectId(recipeId, "recipe ID");

  /**
   * Only comments belonging to an accessible Recipe
   * should be publicly returned.
   */
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

    assertCursorOwner(
      payload,
      "recipeId",
      recipeId,
      "نشانگر صفحه‌بندی با دستور پخت انتخاب‌شده مطابقت ندارد."
    );

    decodedCursor = normalizeCreatedAtIdCursor(payload);
  }

  const comments = await findCommentsByRecipe({
    recipeId,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = comments.length > normalizedLimit;

  const items = hasMore ? comments.slice(0, normalizedLimit) : comments;

  const nextCursor = hasMore ? createNextCursor(items, recipeId) : null;

  return {
    items: items.map(toPublicComment),
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
 * Create a new top-level comment.
 *
 * Only active authenticated users can create comments.
 *
 * Recipe.stats.commentCount is updated atomically
 * with the Comment creation.
 */
export async function createComment(currentUser, recipeId, text) {
  assertValidObjectId(recipeId, "recipe ID");

  const normalizedText = normalizeCommentText(text);

  return withTransaction(async (session) => {
    /**
     * Re-check the current account inside the transaction
     * so the mutation uses a fresh active user.
     */
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * Only active/accessibile Recipes can receive comments.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    const comment = await createCommentRepository(
      {
        authorId: user._id,
        recipeId,
        text: normalizedText,
      },
      session
    );

    /**
     * Only top-level comments affect
     * Recipe.stats.commentCount.
     */
    const updatedRecipe = await incrementCommentCount(recipeId, 1, session);

    if (!updatedRecipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "شمارنده نظرهای دستور پخت به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    /**
     * Do not notify the Recipe owner about their
     * own comment.
     */
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
 * Create an official reply to a comment.
 *
 * Only the Recipe owner or an administrator may reply.
 */
export async function createCommentReply(currentUser, commentId, text) {
  assertValidObjectId(commentId, "comment ID");

  const normalizedText = normalizeCommentText(text);

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * The parent Comment must still be active.
     */
    const comment = await findCommentById(commentId, session);

    if (!comment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Fast business-rule check.
     *
     * addCommentReply must still enforce the maximum
     * atomically at the repository/database level.
     */
    if ((comment.replies?.length ?? 0) >= MAX_COMMENT_REPLIES) {
      throw new AppError(
        ERROR_CODES.COMMENT_REPLY_LIMIT_REACHED,
        "این نظر به حداکثر تعداد پاسخ مجاز رسیده است.",
        { statusCode: 409 }
      );
    }

    /**
     * Replying is allowed only when the parent Recipe
     * is accessible.
     */
    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

    assertCanReplyToComment(user, recipe);

    const updatedComment = await addCommentReply(
      commentId,
      {
        authorId: user._id,
        text: normalizedText,
      },
      session
    );

    if (!updatedComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_REPLY_LIMIT_REACHED,
        "این نظر به حداکثر تعداد پاسخ مجاز رسیده است.",
        { statusCode: 409 }
      );
    }

    /**
     * Do not notify the comment author when the
     * Recipe owner is replying to their own comment.
     */
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
 * Soft-delete a top-level comment.
 *
 * Only the comment author or an administrator can delete it.
 *
 * Deleting the Comment also decrements
 * Recipe.stats.commentCount atomically.
 *
 * The parent Recipe does not need to remain publicly accessible
 * for the author/admin to remove an existing comment.
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

    if (!deletedComment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر حذف نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Only a successful top-level Comment deletion
     * decrements the counter.
     */
    const updatedRecipe = await incrementCommentCount(
      comment.recipeId,
      -1,
      session
    );

    if (!updatedRecipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "شمارنده نظرهای دستور پخت به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    return deletedComment;
  });
}

/**
 * --------------------------------------------------------------------------
 * Restore Comment - Admin
 * --------------------------------------------------------------------------
 */

/**
 * Restore a soft-deleted comment.
 *
 * This operation is intended for the Admin Panel.
 *
 * The parent Recipe must still be accessible.
 */
export async function restoreComment(currentUser, commentId) {
  await assertAdmin(currentUser);

  assertValidObjectId(commentId, "comment ID");

  return withTransaction(async (session) => {
    /**
     * Find the comment specifically among
     * soft-deleted comments.
     */
    const comment = await findDeletedCommentById(commentId, session);

    if (!comment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "نظر حذف‌شده پیدا نشد.",
        { statusCode: 404 }
      );
    }

    /**
     * The Recipe must still be accessible before
     * the Comment becomes active again.
     */
    await getAccessibleRecipe(comment.recipeId, session);

    const restoredComment = await restoreCommentRepository(commentId, session);

    if (!restoredComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "بازیابی نظر ممکن نبود.",
        { statusCode: 404 }
      );
    }

    /**
     * deleteComment() previously decreased this
     * counter, so restoring the Comment must increase it.
     */
    const updatedRecipe = await incrementCommentCount(
      comment.recipeId,
      1,
      session
    );

    if (!updatedRecipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "شمارنده نظرهای دستور پخت به‌روزرسانی نشد.",
        { statusCode: 404 }
      );
    }

    return restoredComment;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete Reply
 * --------------------------------------------------------------------------
 */

/**
 * Delete an embedded reply.
 *
 * Only the reply author or an administrator can delete it.
 *
 * Deleting a Reply does not change
 * Recipe.stats.commentCount because Replies are
 * embedded inside the parent Comment.
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
      (item) =>
        item._id?.toString() === replyId.toString() && item.deletedAt === null
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

    if (!deletedReply) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ حذف نشد.", {
        statusCode: 404,
      });
    }

    return deletedReply;
  });
}

export async function restoreCommentReply(currentUser, replyId) {
  assertValidObjectId(replyId, "reply ID");

  return withTransaction(async (session) => {
    await assertAdmin(currentUser, session);

    const comment = await findDeletedCommentByReplyId(replyId, session);

    if (!comment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "پاسخ حذف‌شده پیدا نشد.",
        { statusCode: 404 }
      );
    }

    const restoredComment = await restoreCommentReplyById(replyId, session);

    if (!restoredComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "بازیابی پاسخ ممکن نبود.",
        { statusCode: 404 }
      );
    }

    const restoredReply = restoredComment.replies?.find(
      (item) =>
        item._id?.toString() === replyId.toString() && item.deletedAt === null
    );

    if (!restoredReply) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "بازیابی پاسخ ممکن نبود.",
        { statusCode: 404 }
      );
    }

    return restoredReply;
  });
}
