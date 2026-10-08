import Rating from "@/models/Rating";
import { applySession } from "@/lib/helpers/apply-session";

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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}
