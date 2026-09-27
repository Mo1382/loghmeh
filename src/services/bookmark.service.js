import {
  createBookmark as createBookmarkRepository,
  deleteBookmarkByUserAndRecipe,
  findBookmarkByUserAndRecipe,
  findAccessibleBookmarksByUser,
} from "@/repositories/bookmark.repository";

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
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

/**
 * Create the next cursor from the last Bookmark
 * included in the current page.
 */
function createNextCursor(bookmark, userId) {
  if (!bookmark?.createdAt || !bookmark?._id) {
    return null;
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.BOOKMARKS,
    userId: userId.toString(),
    createdAt: bookmark.createdAt.toISOString(),
    id: bookmark._id.toString(),
  });
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a Bookmark for the current user.
 *
 * A Bookmark may only be created for an accessible Recipe.
 *
 * The database unique index remains the final protection
 * against concurrent duplicate requests.
 */
export async function createBookmark(currentUser, recipeId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  /**
   * Only accessible Recipes may be bookmarked.
   */
  await getAccessibleRecipe(recipeId);

  /**
   * Fast duplicate pre-check.
   *
   * The unique { userId, recipeId } index remains
   * the final protection against concurrent requests.
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
     * Handle a duplicate-key race against the
     * unique { userId, recipeId } index.
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
 * Remove the current user's Bookmark from a Recipe.
 *
 * The Recipe does not need to remain accessible.
 *
 * This allows stale Bookmarks to be removed even after
 * the Recipe is deleted or becomes otherwise inaccessible.
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
   * Reading Bookmark state for a Recipe requires
   * the Recipe to be currently accessible.
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
 * IMPORTANT:
 *
 * Pagination is performed by the Repository over
 * accessible Bookmark/Recipe pairs.
 *
 * Therefore:
 *
 * limit = number of visible Recipes requested
 * hasMore = whether another visible Recipe exists
 *
 * Inaccessible Recipes do not consume page slots.
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

  let normalizedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, CURSOR_RESOURCES.BOOKMARKS);

    assertCursorOwner(
      payload,
      "userId",
      user._id,
      "نشانگر صفحه‌بندی متعلق به این کاربر نیست."
    );

    normalizedCursor = normalizeCreatedAtIdCursor(payload);
  }

  /**
   * Fetch only accessible Bookmarks and their
   * corresponding Recipes.
   *
   * Fetch one extra visible Bookmark to determine
   * whether another visible page exists.
   */
  const records = await findAccessibleBookmarksByUser({
    userId: user._id,
    cursor: normalizedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = records.length > normalizedLimit;

  const pageRecords = hasMore ? records.slice(0, normalizedLimit) : records;

  if (!pageRecords.length) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  /**
   * The Repository preserves Bookmark order.
   *
   * Each record contains:
   *
   * {
   *   bookmark,
   *   recipe
   * }
   */
  const items = pageRecords.map((record) => record.recipe);

  const lastRecord = pageRecords[pageRecords.length - 1];

  const nextCursor = hasMore
    ? createNextCursor(lastRecord.bookmark, user._id)
    : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
