import {
  createBookmark as createBookmarkRepository,
  deleteBookmarkByUserAndRecipe,
  findBookmarkByUserAndRecipe,
  findBookmarksByUser,
} from "@/repositories/bookmark.repository";

import { findAccessibleRecipesByIds } from "@/repositories/recipe.repository";

import { getAccessibleRecipe } from "@/lib/helpers/recipe-access";

import { ERROR_CODES } from "@/constants/error-codes";

import { requireActiveAuthenticatedUser } from "@/lib/auth/guards";

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

import { CURSOR_RESOURCES } from "@/constants/enums";

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
    resource: CURSOR_RESOURCES.BOOKMARKS,
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
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  /**
   * A bookmark may only be created for an accessible Recipe.
   */
  await getAccessibleRecipe(recipeId);

  /**
   * The pre-check improves the normal error path.
   * The unique database index remains the final protection
   * against concurrent duplicate requests.
   */
  const existingBookmark = await findBookmarkByUserAndRecipe(
    user._id,
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
      userId: user._id,
      recipeId,
    });
  } catch (error) {
    /**
     * Handle a duplicate-key race against the unique
     * { userId, recipeId } index.
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
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Remove the current user's bookmark from a recipe.
 *
 * The Recipe itself does not need to remain accessible here.
 * A user should still be able to remove their own stale bookmark
 * after a Recipe becomes deleted or otherwise inaccessible.
 */
export async function deleteBookmark(currentUser, recipeId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  const deletedBookmark = await deleteBookmarkByUserAndRecipe(
    user._id,
    recipeId
  );

  if (!deletedBookmark) {
    throw new AppError(
      ERROR_CODES.BOOKMARK_NOT_FOUND,
      "ذخیره دستور پخت پیدا نشد.",
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
 * a specific accessible Recipe.
 *
 * Returns the Bookmark document or null.
 */
export async function getUserBookmark(currentUser, recipeId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  /**
   * Visibility/accessibility is required for reading
   * the bookmark state of a Recipe.
   */
  await getAccessibleRecipe(recipeId);

  return findBookmarkByUserAndRecipe(user._id, recipeId);
}

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
 *
 * Bookmark pagination remains based on the Bookmark collection,
 * while inaccessible Recipes are filtered after that query.
 */
export async function getUserBookmarks({
  currentUser,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let decodedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, CURSOR_RESOURCES.BOOKMARKS);

    assertCursorOwner(
      payload,
      "userId",
      user._id,
      "نشانگر صفحه‌بندی متعلق به این کاربر نیست."
    );

    decodedCursor = normalizeCreatedAtIdCursor(payload);
  }

  /**
   * Fetch one extra bookmark to determine whether
   * another page exists.
   */
  const bookmarks = await findBookmarksByUser({
    userId: user._id,
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

  /**
   * Resolve only Recipes that are currently accessible.
   */
  const recipes = await findAccessibleRecipesByIds(recipeIds);

  /**
   * MongoDB $in does not guarantee the same order
   * as the Bookmark query.
   *
   * Rebuild the original Bookmark order.
   */
  const recipesById = new Map(
    recipes.map((recipe) => [recipe._id.toString(), recipe])
  );

  const items = pageBookmarks
    .map((bookmark) => recipesById.get(bookmark.recipeId.toString()))
    .filter(Boolean);

  const nextCursor = hasMore ? createNextCursor(pageBookmarks, user._id) : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
