import Bookmark from "@/models/Bookmark";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a bookmark by its ID.
 */
export function findBookmarkById(bookmarkId, session) {
  const query = Bookmark.findById(bookmarkId);

  return applySession(query, session);
}

/**
 * Find a bookmark created by a specific user
 * for a specific recipe.
 *
 * Useful for checking whether the user has already
 * bookmarked the recipe.
 */
export function findBookmarkByUserAndRecipe(userId, recipeId, session) {
  const query = Bookmark.findOne({
    userId,
    recipeId,
  });

  return applySession(query, session);
}

/**
 * Create a bookmark.
 *
 * userId is obtained from the authenticated user.
 * recipeId is obtained from the route/context.
 */
export function createBookmark(bookmarkData, session) {
  if (session) {
    return Bookmark.create([bookmarkData], { session }).then(
      ([bookmark]) => bookmark
    );
  }

  return Bookmark.create(bookmarkData);
}

/**
 * Delete a bookmark created by a specific user
 * for a specific recipe.
 */
export function deleteBookmarkByUserAndRecipe(userId, recipeId, session) {
  const query = Bookmark.findOneAndDelete({
    userId,
    recipeId,
  });

  return applySession(query, session);
}

/**
 * Delete a bookmark by its ID.
 *
 * Authorization must be handled in the Service layer.
 */
export function deleteBookmarkById(bookmarkId, session) {
  const query = Bookmark.findByIdAndDelete(bookmarkId);

  return applySession(query, session);
}

/**
 * Find a user's bookmarks using cursor-based loading.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 *
 * The cursor should contain:
 * {
 *   createdAt: Date,
 *   id: ObjectId
 * }
 */
export function findBookmarksByUser({
  userId,
  cursor = null,
  limit = 16,
  session,
}) {
  const filter = {
    userId,
  };

  if (cursor) {
    filter.$or = [
      {
        createdAt: {
          $lt: cursor.createdAt,
        },
      },
      {
        createdAt: cursor.createdAt,
        _id: {
          $lt: cursor.id,
        },
      },
    ];
  }

  const query = Bookmark.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Count bookmarks for a specific recipe.
 *
 * Useful when recalculating or verifying
 * Recipe.stats.bookmarkCount.
 */
export function countBookmarksByRecipe(recipeId, session) {
  const query = Bookmark.countDocuments({
    recipeId,
  });

  return applySession(query, session);
}
