import crypto from "node:crypto";
import mongoose from "mongoose";

import {
  findCommentById,
  findCommentsByRecipe,
  findCommentByReplyId,
  findDeletedCommentById,
  createComment as createCommentRepository,
  addCommentReply,
  deleteCommentReplyById,
  softDeleteComment,
  restoreComment as restoreCommentRepository,
} from "@/repositories/comment.repository";

import {
  findRecipeById,
  incrementCommentCount,
} from "@/repositories/recipe.repository";

import { withTransaction } from "@/lib/transaction";
import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import {
  createSystemNotification,
  NOTIFICATION_TYPES,
} from "./notification.service";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

const CURSOR_VERSION = 1;
const MAX_COMMENT_LENGTH = 1000;

/**
 * --------------------------------------------------------------------------
 * Authentication / Authorization
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the current user is authenticated.
 */
function assertAuthenticated(currentUser) {
  if (!currentUser) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "ورود به حساب کاربری الزامی است.",
      { statusCode: 401 }
    );
  }
}

/**
 * Ensure the current user is an administrator.
 */
function assertAdmin(currentUser) {
  assertAuthenticated(currentUser);

  if (currentUser.role !== "ADMIN") {
    throw new AppError(ERROR_CODES.FORBIDDEN, "دسترسی مدیر سیستم الزامی است.", {
      statusCode: 403,
    });
  }
}

/**
 * Ensure the provided ID is a valid MongoDB ObjectId.
 */
function assertValidObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }
}

/**
 * Ensure the current user is the comment owner
 * or an administrator.
 */
function assertCommentOwnerOrAdmin(currentUser, comment) {
  assertAuthenticated(currentUser);

  const isOwner = comment.authorId?.toString() === currentUser._id?.toString();

  const isAdmin = currentUser.role === "ADMIN";

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

  const isAdmin = currentUser.role === "ADMIN";

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

  const isAdmin = currentUser.role === "ADMIN";

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
 * Normalize the requested list size.
 */
function normalizeLimit(limit, defaultLimit = DEFAULT_LIST_LIMIT) {
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return defaultLimit;
  }

  return Math.min(parsedLimit, MAX_LIST_LIMIT);
}

/**
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

/**
 * Get the secret used to sign comment cursors.
 */
function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("متغیر CURSOR_SECRET تنظیم نشده است.");
  }

  return secret;
}

/**
 * Encode a comment pagination cursor.
 *
 * Payload:
 *
 * {
 *   v: 1,
 *   createdAt: ISO date string,
 *   id: comment ObjectId string
 * }
 */
function encodeCursor({ createdAt, id }) {
  const payload = {
    v: CURSOR_VERSION,
    createdAt,
    id: id.toString(),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", getCursorSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Decode and verify a comment pagination cursor.
 */
function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const [payloadBase64, signatureBase64] = parts;

  let expectedSignature;
  let providedSignature;

  try {
    expectedSignature = crypto
      .createHmac("sha256", getCursorSecret())
      .update(payloadBase64)
      .digest();

    providedSignature = Buffer.from(signatureBase64, "base64url");
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  let payload;

  try {
    const json = Buffer.from(payloadBase64, "base64url").toString("utf8");

    payload = JSON.parse(json);
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (
    !payload ||
    payload.v !== CURSOR_VERSION ||
    !payload.createdAt ||
    !payload.id
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  assertValidObjectId(payload.id, "cursor ID");

  const createdAt = new Date(payload.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}

/**
 * Create the next cursor from the last comment
 * in the current page.
 */
function createNextCursor(comments) {
  if (!comments.length) {
    return null;
  }

  const lastComment = comments[comments.length - 1];

  if (!lastComment.createdAt) {
    return null;
  }

  return encodeCursor({
    createdAt: lastComment.createdAt.toISOString(),
    id: lastComment._id,
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

  const recipe = await findRecipeById(comment.recipeId);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

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

  const recipe = await findRecipeById(recipeId);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor = cursor ? decodeCursor(cursor) : null;

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
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

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

    const recipe = await findRecipeById(comment.recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

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

    const recipe = await findRecipeById(comment.recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

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

    /**
     * The parent Recipe must be active before
     * the comment can become publicly visible again.
     */
    const recipe = await findRecipeById(comment.recipeId, session);

    if (!recipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "دستور پخت پیدا نشد یا غیرفعال است.",
        { statusCode: 404 }
      );
    }

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
