import Rating from "@/db/models/Rating";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a rating by ID.
 */
export function findRatingById(ratingId, session) {
  const query = Rating.findById(ratingId);

  return applySession(query, session);
}

/**
 * Find a user's rating for a specific recipe.
 *
 * Useful for checking whether the user has already rated
 * the recipe and for retrieving the existing rating.
 */
export function findRatingByUserAndRecipe(userId, recipeId, session) {
  const query = Rating.findOne({
    userId,
    recipeId,
  });

  return applySession(query, session);
}

/**
 * Create a rating.
 *
 * userId is obtained from the authenticated user.
 * recipeId is obtained from the route/context.
 */
export function createRating(ratingData, session) {
  if (session) {
    return Rating.create([ratingData], { session }).then(([rating]) => rating);
  }

  return Rating.create(ratingData);
}

/**
 * Update a rating by user and recipe.
 *
 * This keeps the update scoped to the existing relationship.
 */
export function updateRatingByUserAndRecipe(userId, recipeId, value, session) {
  const query = Rating.findOneAndUpdate(
    {
      userId,
      recipeId,
    },
    {
      $set: {
        value,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Update a rating by its ID.
 */
export function updateRatingById(ratingId, value, session) {
  const query = Rating.findByIdAndUpdate(
    ratingId,
    {
      $set: {
        value,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Delete a rating by user and recipe.
 */
export function deleteRatingByUserAndRecipe(userId, recipeId, session) {
  const query = Rating.findOneAndDelete({
    userId,
    recipeId,
  });

  return applySession(query, session);
}

/**
 * Delete a rating by ID.
 */
export function deleteRatingById(ratingId, session) {
  const query = Rating.findByIdAndDelete(ratingId);

  return applySession(query, session);
}

/**
 * Calculate rating statistics for a recipe.
 *
 * Returns:
 * {
 *   ratingCount,
 *   averageRating
 * }
 *
 * The Service layer can use these values to update
 * the denormalized Recipe.stats fields.
 */
export function calculateRecipeRatingStats(recipeId, session) {
  const query = Rating.aggregate([
    {
      $match: {
        recipeId,
      },
    },
    {
      $group: {
        _id: null,
        ratingCount: {
          $sum: 1,
        },
        averageRating: {
          $avg: "$value",
        },
      },
    },
    {
      $project: {
        _id: 0,
        ratingCount: 1,
        averageRating: {
          $ifNull: ["$averageRating", 0],
        },
      },
    },
  ]);

  return applySession(query, session);
}
