import {
  addCommentReply,
  createComment as createCommentRepository,
  deleteCommentReplyById,
  findCommentById,
  findCommentByReplyId,
  findCommentsByRecipe,
  findDeletedCommentById,
  restoreComment as restoreCommentRepository,
  softDeleteComment,
} from "@/repositories/comment.repository";

import { incrementCommentCount } from "@/repositories/recipe.repository";

import { NOTIFICATION_TYPES, USER_ROLES } from "@/constants/enums";
import { ERROR_CODES } from "@/constants/error-codes";
import { assertAdmin, assertAuthenticated } from "@/lib/auth/guards";
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
import { createSystemNotification } from "./notification.service";

import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

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
 * Authentication / Authorization
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the current user is the comment owner
 * or an administrator.
 */
function assertCommentOwnerOrAdmin(currentUser, comment) {
  assertAuthenticated(currentUser);

  const isOwner = comment.authorId?.toString() === currentUser._id?.toString();

  const isAdmin = currentUser.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه ویرایش این نظر را ندارید.",
      { statusCode: 403 }
    );
  }
}

/**
 * Ensure the current user is the reply owner
 * or an administrator.
 */
function assertReplyOwnerOrAdmin(currentUser, reply) {
  assertAuthenticated(currentUser);

  const isOwner = reply.authorId?.toString() === currentUser._id?.toString();

  const isAdmin = currentUser.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه حذف این پاسخ را ندارید.",
      { statusCode: 403 }
    );
  }
}

/**
 * Ensure the current user can reply to a comment.
 *
 * Only the recipe owner or an administrator
 * may provide an official reply.
 */
function assertCanReplyToComment(currentUser, recipe) {
  assertAuthenticated(currentUser);

  const isRecipeOwner =
    recipe.authorId?.toString() === currentUser._id?.toString();

  const isAdmin = currentUser.role === USER_ROLES.ADMIN;

  if (!isRecipeOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "فقط صاحب دستور پخت یا مدیر سیستم می‌تواند به نظر پاسخ دهد.",
      { statusCode: 403 }
    );
  }
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

  if (normalizedText.length > MAX_COMMENT_LENGTH) {
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
    resource: "COMMENTS",
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
 * Get a comment by ID.
 *
 * The comment itself must be active and its parent
 * Recipe must also be active.
 */
export async function getCommentById(commentId) {
  assertValidObjectId(commentId, "comment ID");

  const comment = await findCommentById(commentId);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const { recipe } = await getAccessibleRecipe(comment.recipeId);

  return comment;
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

  await getAccessibleRecipe(recipeId);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let decodedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, "COMMENTS");

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
 * Create a new top-level comment.
 */
export async function createComment(currentUser, recipeId, text) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  const normalizedText = normalizeCommentText(text);

  return withTransaction(async (session) => {
    /**
     * Only active recipes can receive comments.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    const comment = await createCommentRepository(
      {
        authorId: currentUser._id,
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

    if (recipe.authorId.toString() !== currentUser._id.toString()) {
      await createSystemNotification(
        {
          userId: recipe.authorId,
          actorId: currentUser._id,
          type: NOTIFICATION_TYPES.RECIPE_COMMENTED,
          title: "نظر جدید برای دستور پخت شما",
          message: `${currentUser.username} روی دستور پخت شما نظر گذاشت.`,
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
 * Only the Recipe owner or an administrator
 * may reply.
 */
export async function createCommentReply(currentUser, commentId, text) {
  assertAuthenticated(currentUser);

  assertValidObjectId(commentId, "comment ID");

  const normalizedText = normalizeCommentText(text);

  return withTransaction(async (session) => {
    const comment = await findCommentById(commentId, session);

    if (!comment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
        statusCode: 404,
      });
    }

    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

    assertCanReplyToComment(currentUser, recipe);

    const updatedComment = await addCommentReply(
      commentId,
      {
        authorId: currentUser._id,
        text: normalizedText,
      },
      session
    );

    if (!updatedComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "پاسخ به نظر اضافه نشد.",
        { statusCode: 404 }
      );
    }

    if (comment.authorId.toString() !== currentUser._id.toString()) {
      await createSystemNotification(
        {
          userId: comment.authorId,
          actorId: currentUser._id,
          type: NOTIFICATION_TYPES.COMMENT_REPLIED,
          title: "پاسخ جدید به نظر شما",
          message: `${currentUser.username} به نظر شما پاسخ داد.`,
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
 * Soft-delete a comment.
 *
 * Only the comment author or an administrator
 * can delete it.
 */
export async function deleteComment(currentUser, commentId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(commentId, "comment ID");

  return withTransaction(async (session) => {
    const comment = await findCommentById(commentId, session);

    if (!comment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
        statusCode: 404,
      });
    }

    assertCommentOwnerOrAdmin(currentUser, comment);

    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

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
 * The parent Recipe must still be active.
 */
export async function restoreComment(currentUser, commentId) {
  assertAdmin(currentUser);

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

    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

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
     * counter, so restoring the comment must increase it.
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
 * The reply author or any administrator can delete it.
 *
 * Deleting a reply does not change
 * Recipe.stats.commentCount because replies are
 * embedded inside the parent Comment.
 */
export async function deleteCommentReply(currentUser, replyId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(replyId, "reply ID");

  return withTransaction(async (session) => {
    /**
     * Find the active parent Comment containing
     * the requested reply.
     */
    const comment = await findCommentByReplyId(replyId, session);

    if (!comment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Find the actual embedded Reply before
     * deleting it so that authorization can be checked.
     */
    const reply = comment.replies?.find(
      (item) => item._id?.toString() === replyId.toString()
    );

    if (!reply) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Only the reply author or an administrator
     * may delete the reply.
     */
    assertReplyOwnerOrAdmin(currentUser, reply);

    /**
     * Delete the embedded reply.
     */
    const updatedComment = await deleteCommentReplyById(replyId, session);

    if (!updatedComment) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ حذف نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Return the deleted reply itself because
     * the repository returns the updated parent Comment.
     */
    return reply;
  });
}
