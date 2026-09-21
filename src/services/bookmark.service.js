import crypto from "node:crypto";
import mongoose from "mongoose";

import {
  findBookmarkByUserAndRecipe,
  createBookmark as createBookmarkRepository,
  deleteBookmarkByUserAndRecipe,
  findBookmarksByUser,
} from "@/repositories/bookmark.repository";

import {
  findRecipeById,
  findRecipesByIds,
  incrementBookmarkCount,
} from "@/repositories/recipe.repository";

import { withTransaction } from "@/lib/transaction";
import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

const CURSOR_VERSION = 1;

/**
 * --------------------------------------------------------------------------
 * Authentication / Validation
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
 * Get the secret used to sign bookmark cursors.
 */
function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("متغیر CURSOR_SECRET تنظیم نشده است.");
  }

  return secret;
}

/**
 * Encode a bookmark pagination cursor.
 *
 * Cursor payload:
 * {
 *   v: 1,
 *   createdAt: ISO date string,
 *   id: bookmark ObjectId string
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
 * Decode and verify a bookmark pagination cursor.
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
 * Create the next cursor from the last bookmark
 * included in the current page.
 */
function createNextCursor(bookmarks) {
  if (!bookmarks.length) {
    return null;
  }

  const lastBookmark = bookmarks[bookmarks.length - 1];

  if (!lastBookmark.createdAt) {
    return null;
  }

  return encodeCursor({
    createdAt: lastBookmark.createdAt.toISOString(),
    id: lastBookmark._id,
  });
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a bookmark for the current user.
 */
export async function createBookmark(currentUser, recipeId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    /**
     * Only active / non-deleted recipes
     * can be bookmarked.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * A user can bookmark a recipe only once.
     */
    const existingBookmark = await findBookmarkByUserAndRecipe(
      currentUser._id,
      recipeId,
      session
    );

    if (existingBookmark) {
      throw new AppError(
        ERROR_CODES.BOOKMARK_ALREADY_EXISTS,
        "شما قبلاً این دستور پخت را ذخیره کرده‌اید.",
        { statusCode: 409 }
      );
    }

    let bookmark;

    try {
      bookmark = await createBookmarkRepository(
        {
          userId: currentUser._id,
          recipeId,
        },
        session
      );
    } catch (error) {
      /**
       * The unique { userId, recipeId }
       * index is the final protection
       * against concurrent duplicates.
       */
      if (error?.code === 11000) {
        throw new AppError(
          ERROR_CODES.BOOKMARK_ALREADY_EXISTS,
          "شما قبلاً این دستور پخت را ذخیره کرده‌اید.",
          { statusCode: 409 }
        );
      }

      throw error;
    }

    /**
     * Keep Recipe.stats.bookmarkCount synchronized.
     */
    await incrementBookmarkCount(recipeId, 1, session);

    return bookmark;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Remove the current user's bookmark from a recipe.
 */
export async function deleteBookmark(currentUser, recipeId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    /**
     * The parent Recipe must still be active.
     *
     * This is consistent with the domain rule that
     * operations on deleted Recipes are blocked.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    const existingBookmark = await findBookmarkByUserAndRecipe(
      currentUser._id,
      recipeId,
      session
    );

    if (!existingBookmark) {
      throw new AppError(
        ERROR_CODES.BOOKMARK_NOT_FOUND,
        "ذخیره دستور پخت پیدا نشد.",
        { statusCode: 404 }
      );
    }

    const deletedBookmark = await deleteBookmarkByUserAndRecipe(
      currentUser._id,
      recipeId,
      session
    );

    if (!deletedBookmark) {
      throw new AppError(
        ERROR_CODES.BOOKMARK_NOT_FOUND,
        "ذخیره دستور پخت حذف نشد.",
        { statusCode: 404 }
      );
    }

    /**
     * Keep Recipe.stats.bookmarkCount synchronized.
     */
    await incrementBookmarkCount(recipeId, -1, session);

    return deletedBookmark;
  });
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Check whether the current user has bookmarked
 * a specific recipe.
 *
 * Returns the Bookmark document or null.
 */
export async function getUserBookmark(currentUser, recipeId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  const recipe = await findRecipeById(recipeId);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  return findBookmarkByUserAndRecipe(currentUser._id, recipeId);
}

/**
 * Get the current user's bookmarked recipes
 * using cursor-based pagination.
 *
 * Deleted recipes are excluded from the returned
 * recipe list.
 */
export async function getUserBookmarks({
  currentUser,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertAuthenticated(currentUser);

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor = cursor ? decodeCursor(cursor) : null;

  const bookmarks = await findBookmarksByUser({
    userId: currentUser._id,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = bookmarks.length > normalizedLimit;

  const pageBookmarks = hasMore
    ? bookmarks.slice(0, normalizedLimit)
    : bookmarks;

  if (!pageBookmarks.length) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  /**
   * Fetch Recipes in one query instead of
   * querying once for every Bookmark.
   */
  const recipeIds = pageBookmarks.map((bookmark) => bookmark.recipeId);

  const recipes = await findRecipesByIds(recipeIds);

  /**
   * MongoDB $in does not guarantee the same
   * ordering as the Bookmark query.
   *
   * Rebuild the original Bookmark order.
   */
  const recipesById = new Map(
    recipes.map((recipe) => [recipe._id.toString(), recipe])
  );

  const items = pageBookmarks
    .map((bookmark) => recipesById.get(bookmark.recipeId.toString()))
    .filter(Boolean);

  const nextCursor = hasMore ? createNextCursor(pageBookmarks) : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
