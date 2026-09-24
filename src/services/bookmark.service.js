import {
  createBookmark as createBookmarkRepository,
  deleteBookmarkByUserAndRecipe,
  findBookmarkByUserAndRecipe,
  findBookmarksByUser,
} from "@/repositories/bookmark.repository";

import { findAccessibleRecipesByIds } from "@/repositories/recipe.repository";

import { getAccessibleRecipe } from "@/lib/helpers/recipe-access";

import { ERROR_CODES } from "@/constants/error-codes";
import { assertAuthenticated } from "@/lib/auth/guards";
import AppError from "@/lib/errors/AppError";
import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";
import { normalizeLimit } from "@/lib/pagination/limit";
import { assertValidObjectId } from "@/lib/validation/object-id";

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

/**
 * Create the next cursor from the last bookmark
 * included in the current page.
 */
function createNextCursor(bookmarks, userId) {
  if (!bookmarks.length) {
    return null;
  }

  const lastBookmark = bookmarks[bookmarks.length - 1];

  if (!lastBookmark.createdAt || !lastBookmark._id) {
    return null;
  }

  return encodeCursor({
    resource: "BOOKMARKS",
    userId: userId.toString(),
    createdAt: lastBookmark.createdAt.toISOString(),
    id: lastBookmark._id.toString(),
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

  const { recipe } = await getAccessibleRecipe(recipeId);

  const existingBookmark = await findBookmarkByUserAndRecipe(
    currentUser._id,
    recipeId
  );

  if (existingBookmark) {
    throw new AppError(
      ERROR_CODES.BOOKMARK_ALREADY_EXISTS,
      "شما قبلاً این دستور پخت را ذخیره کرده‌اید.",
      { statusCode: 409 }
    );
  }

  try {
    return await createBookmarkRepository({
      userId: currentUser._id,
      recipeId,
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(
        ERROR_CODES.BOOKMARK_ALREADY_EXISTS,
        "شما قبلاً این دستور پخت را ذخیره کرده‌اید.",
        { statusCode: 409 }
      );
    }

    throw error;
  }
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

  const { recipe } = await getAccessibleRecipe(recipeId);

  const existingBookmark = await findBookmarkByUserAndRecipe(
    currentUser._id,
    recipeId
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
    recipeId
  );

  if (!deletedBookmark) {
    throw new AppError(
      ERROR_CODES.BOOKMARK_NOT_FOUND,
      "ذخیره دستور پخت حذف نشد.",
      { statusCode: 404 }
    );
  }

  return deletedBookmark;
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

  const { recipe } = await getAccessibleRecipe(recipeId);

  return findBookmarkByUserAndRecipe(currentUser._id, recipeId);
}

/**
 * Get the current user's bookmarked recipes
 * using cursor-based pagination.
 *
 * Deleted recipes are excluded from the returned
 * recipe list.
 */
/**
 * --------------------------------------------------------------------------
 * Get User Bookmarks
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's bookmarked Recipes
 * using cursor-based pagination.
 *
 * Only accessible Recipes are returned.
 */
export async function getUserBookmarks({
  currentUser,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertAuthenticated(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let decodedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, "BOOKMARKS");

    assertCursorOwner(
      payload,
      "userId",
      currentUser._id,
      "نشانگر صفحه‌بندی متعلق به این کاربر نیست."
    );

    decodedCursor = normalizeCreatedAtIdCursor(payload);
  }

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

  const recipeIds = pageBookmarks.map((bookmark) => bookmark.recipeId);

  const recipes = await findAccessibleRecipesByIds(recipeIds);

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

  const nextCursor = hasMore
    ? createNextCursor(pageBookmarks, currentUser._id)
    : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
