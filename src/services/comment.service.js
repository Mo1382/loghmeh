import mongoose from "mongoose";

import {
  addCommentReply,
  createComment as createCommentRepository,
  findCommentById,
  findCommentByReplyId,
  findCommentsByRecipe,
  findDeletedCommentById,
  findDeletedCommentByReplyId,
  restoreComment as restoreCommentRepository,
  restoreCommentReplyById,
  softDeleteComment,
  softDeleteCommentReplyById,
} from "@/repositories/comment.repository";

import {
  findNonDeletedRecipeById,
  incrementCommentCount,
} from "@/repositories/recipe.repository";

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

import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

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
 * Authentication / Authorization
 * --------------------------------------------------------------------------
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
 * --------------------------------------------------------------------------
 * Internal Helpers
 * --------------------------------------------------------------------------
 */

function toPublicComment(comment) {
  const data = comment?.toObject ? comment.toObject() : { ...comment };

  return {
    ...data,

    replies: (data.replies ?? []).filter((reply) => reply.deletedAt === null),
  };
}

function getActiveReplyCount(comment) {
  return (comment.replies ?? []).filter((reply) => reply.deletedAt === null)
    .length;
}

function findReplyById(comment, replyId) {
  return comment.replies?.find(
    (reply) => reply._id?.toString() === replyId.toString()
  );
}

function findActiveReplyById(comment, replyId) {
  return comment.replies?.find(
    (reply) =>
      reply._id?.toString() === replyId.toString() && reply.deletedAt === null
  );
}

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

export async function getCommentById(commentId) {
  assertValidObjectId(commentId, "comment ID");

  const comment = await findCommentById(commentId);

  if (!comment) {
    throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "نظر پیدا نشد.", {
      statusCode: 404,
    });
  }

  await getAccessibleRecipe(comment.recipeId);

  return toPublicComment(comment);
}

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
 * Create Comment
 * --------------------------------------------------------------------------
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
 * Create Reply
 * --------------------------------------------------------------------------
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

    /**
     * Fast-fail check.
     *
     * The repository performs the final
     * atomic enforcement.
     */
    if (getActiveReplyCount(comment) >= MAX_COMMENT_REPLIES) {
      throw new AppError(
        ERROR_CODES.COMMENT_REPLY_LIMIT_REACHED,
        "این نظر به حداکثر تعداد پاسخ مجاز رسیده است.",
        {
          statusCode: 409,
        }
      );
    }

    const { recipe } = await getAccessibleRecipe(comment.recipeId, session);

    assertCanReplyToComment(user, recipe);

    /**
     * Generate the Reply ID before persistence.
     *
     * The same ID is subsequently used by
     * the COMMENT_REPLIED notification.
     */
    const replyId = new mongoose.Types.ObjectId();

    const updatedComment = await addCommentReply(
      commentId,
      {
        _id: replyId,
        authorId: user._id,
        text: normalizedText,
        deletedAt: null,
      },
      session
    );

    if (!updatedComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_REPLY_LIMIT_REACHED,
        "این نظر به حداکثر تعداد پاسخ مجاز رسیده است.",
        {
          statusCode: 409,
        }
      );
    }

    const reply = findReplyById(updatedComment, replyId);

    if (!reply) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ ایجاد نشد.", {
        statusCode: 404,
      });
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

          replyId: reply._id,
        },
        session
      );
    }

    return reply;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete Comment
 * --------------------------------------------------------------------------
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
     * A deleted Recipe is allowed to have
     * independently deleted Comments.
     *
     * Therefore Comment deletion must not fail
     * just because the parent Recipe is soft-deleted.
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
 * Restore Comment - Admin
 * --------------------------------------------------------------------------
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

    /**
     * A Comment can be restored only when
     * its parent Recipe is currently accessible.
     */
    await getAccessibleRecipe(comment.recipeId, session);

    const restoredComment = await restoreCommentRepository(commentId, session);

    if (!restoredComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "بازیابی نظر ممکن نبود.",
        {
          statusCode: 404,
        }
      );
    }

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

    const reply = findActiveReplyById(comment, replyId);

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

    const deletedReply = findReplyById(updatedComment, replyId);

    if (!deletedReply) {
      throw new AppError(ERROR_CODES.COMMENT_NOT_FOUND, "پاسخ حذف نشد.", {
        statusCode: 404,
      });
    }

    return deletedReply;
  });
}

/**
 * --------------------------------------------------------------------------
 * Restore Reply - Admin
 * --------------------------------------------------------------------------
 */

export async function restoreCommentReply(currentUser, replyId) {
  assertValidObjectId(replyId, "reply ID");

  return withTransaction(async (session) => {
    await assertAdmin(currentUser, session);

    const comment = await findDeletedCommentByReplyId(replyId, session);

    if (!comment) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "پاسخ حذف‌شده پیدا نشد.",
        {
          statusCode: 404,
        }
      );
    }

    /**
     * Fast-fail check.
     *
     * The Repository must enforce the same rule
     * atomically because another Reply may be
     * created/restored concurrently.
     */
    if (getActiveReplyCount(comment) >= MAX_COMMENT_REPLIES) {
      throw new AppError(
        ERROR_CODES.COMMENT_REPLY_LIMIT_REACHED,
        "این نظر به حداکثر تعداد پاسخ مجاز رسیده است.",
        {
          statusCode: 409,
        }
      );
    }

    /**
     * Repository-level restore must also contain
     * the atomic active-reply limit predicate.
     */
    const restoredComment = await restoreCommentReplyById(replyId, session);

    /**
     * A null result can occur when the repository's
     * atomic predicate no longer matches, e.g. another
     * concurrent operation filled the active-reply limit.
     *
     * The repository is therefore the final authority
     * for the invariant.
     */
    if (!restoredComment) {
      throw new AppError(
        ERROR_CODES.COMMENT_REPLY_LIMIT_REACHED,
        "بازیابی پاسخ انجام نشد؛ تعداد پاسخ‌های فعال به حد مجاز رسیده است یا وضعیت پاسخ تغییر کرده است.",
        {
          statusCode: 409,
        }
      );
    }

    const restoredReply = findActiveReplyById(restoredComment, replyId);

    if (!restoredReply) {
      throw new AppError(
        ERROR_CODES.COMMENT_NOT_FOUND,
        "بازیابی پاسخ ممکن نبود.",
        {
          statusCode: 404,
        }
      );
    }

    return restoredReply;
  });
}
