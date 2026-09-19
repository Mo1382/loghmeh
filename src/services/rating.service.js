import mongoose from "mongoose";

import {
  findRatingByUserAndRecipe,
  createRating as createRatingRepository,
  updateRatingByUserAndRecipe,
  deleteRatingByUserAndRecipe,
  calculateRecipeRatingStats,
} from "@/repositories/rating.repository";

import {
  findRecipeById,
  incrementRatingCount,
  updateAverageRating,
} from "@/repositories/recipe.repository";

import { withTransaction } from "@/lib/transaction";
import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

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
      "Authentication is required.",
      ERROR_CODES.UNAUTHORIZED,
      401
    );
  }
}

/**
 * Ensure the rating value is an integer between 1 and 5.
 *
 * Zod validation should normally enforce this at the input boundary.
 * This check is kept in the Service as an additional business-layer guard.
 */
function assertValidRatingValue(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError(
      "Rating must be an integer between 1 and 5.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }
}

/**
 * Ensure the provided ID is a valid MongoDB ObjectId.
 */
function assertValidObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      `Invalid ${fieldName}.`,
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }
}

/**
 * Ensure the current user is not the recipe owner.
 *
 * Users cannot rate their own recipes.
 */
function assertNotRecipeOwner(currentUser, recipe) {
  const isOwner = recipe.authorId?.toString() === currentUser._id?.toString();

  if (isOwner) {
    throw new AppError(
      "You cannot rate your own recipe.",
      ERROR_CODES.FORBIDDEN,
      403
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * Rating Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Recalculate the recipe's average rating from the Rating collection.
 *
 * Rating is the source of truth for the average.
 * Recipe.stats.averageRating is a denormalized value.
 */
async function refreshRecipeAverageRating(recipeId, session) {
  const statsResult = await calculateRecipeRatingStats(recipeId, session);

  const stats = statsResult[0] ?? {
    ratingCount: 0,
    averageRating: 0,
  };

  await updateAverageRating(recipeId, stats.averageRating, session);

  return stats;
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's rating for a recipe.
 *
 * Returns null when the user has not rated the recipe yet.
 */
export async function getUserRating(currentUser, recipeId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  /**
   * Only active recipes are available through
   * the public/user-facing rating flow.
   */
  const recipe = await findRecipeById(recipeId);

  if (!recipe) {
    throw new AppError("Recipe not found.", ERROR_CODES.RECIPE_NOT_FOUND, 404);
  }

  return findRatingByUserAndRecipe(currentUser._id, recipeId);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a new rating for a recipe.
 */
export async function createRating(currentUser, recipeId, value) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    /**
     * Only active / non-deleted recipes can receive ratings.
     *
     * The repository query is part of the same transaction.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
    }

    /**
     * Users cannot rate their own recipes.
     */
    assertNotRecipeOwner(currentUser, recipe);

    /**
     * Check whether this user already has a rating.
     *
     * The unique { userId, recipeId } index in MongoDB
     * remains the final protection against duplicate relations.
     */
    const existingRating = await findRatingByUserAndRecipe(
      currentUser._id,
      recipeId,
      session
    );

    if (existingRating) {
      throw new AppError(
        "You have already rated this recipe.",
        ERROR_CODES.RATING_ALREADY_EXISTS,
        409
      );
    }

    let rating;

    try {
      rating = await createRatingRepository(
        {
          userId: currentUser._id,
          recipeId,
          value,
        },
        session
      );
    } catch (error) {
      /**
       * Convert a duplicate-key violation from the
       * unique user/recipe index into a domain-level error.
       */
      if (error?.code === 11000) {
        throw new AppError(
          "You have already rated this recipe.",
          ERROR_CODES.RATING_ALREADY_EXISTS,
          409
        );
      }

      throw error;
    }

    /**
     * Rating count changes only when a new Rating is created.
     */
    await incrementRatingCount(recipeId, 1, session);

    /**
     * Recalculate the average from the Rating collection.
     */
    await refreshRecipeAverageRating(recipeId, session);

    return rating;
  });
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

/**
 * Update the current user's existing rating.
 */
export async function updateRating(currentUser, recipeId, value) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    /**
     * Recipe must still be active.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
    }

    /**
     * The recipe owner cannot have a rating relationship.
     */
    assertNotRecipeOwner(currentUser, recipe);

    /**
     * Find the user's existing rating.
     */
    const existingRating = await findRatingByUserAndRecipe(
      currentUser._id,
      recipeId,
      session
    );

    if (!existingRating) {
      throw new AppError(
        "Rating not found.",
        ERROR_CODES.RATING_NOT_FOUND,
        404
      );
    }

    /**
     * Nothing changes when the new value equals the old value.
     */
    if (existingRating.value === value) {
      return existingRating;
    }

    const updatedRating = await updateRatingByUserAndRecipe(
      currentUser._id,
      recipeId,
      value,
      session
    );

    if (!updatedRating) {
      throw new AppError(
        "Rating could not be updated.",
        ERROR_CODES.RATING_NOT_FOUND,
        404
      );
    }

    /**
     * Rating count stays unchanged during an update.
     * Only the average rating must be recalculated.
     */
    await refreshRecipeAverageRating(recipeId, session);

    return updatedRating;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Delete the current user's rating.
 *
 * After deletion:
 * - Recipe.stats.ratingCount decreases by one.
 * - Recipe.stats.averageRating is recalculated.
 */
// export async function deleteRating(currentUser, recipeId) {
//   assertAuthenticated(currentUser);

//   assertValidObjectId(recipeId, "recipe ID");

//   return withTransaction(async (session) => {
//     /**
//      * Recipe must still be active.
//      */
//     const recipe = await findRecipeById(recipeId, session);

//     if (!recipe) {
//       throw new AppError(
//         "Recipe not found.",
//         ERROR_CODES.RECIPE_NOT_FOUND,
//         404
//       );
//     }

//     /**
//      * Find the user's existing rating.
//      */
//     const existingRating = await findRatingByUserAndRecipe(
//       currentUser._id,
//       recipeId,
//       session
//     );

//     if (!existingRating) {
//       throw new AppError(
//         "Rating not found.",
//         ERROR_CODES.RATING_NOT_FOUND,
//         404
//       );
//     }

//     /**
//      * Delete the Rating document.
//      */
//     const deletedRating = await deleteRatingByUserAndRecipe(
//       currentUser._id,
//       recipeId,
//       session
//     );

//     if (!deletedRating) {
//       throw new AppError(
//         "Rating could not be deleted.",
//         ERROR_CODES.RATING_NOT_FOUND,
//         404
//       );
//     }

//     /**
//      * Rating count changes only when a Rating is deleted.
//      */
//     await incrementRatingCount(recipeId, -1, session);

//     /**
//      * Recalculate the average.
//      *
//      * If this was the last Rating,
//      * averageRating becomes 0.
//      */
//     await refreshRecipeAverageRating(recipeId, session);

//     return deletedRating;
//   });
// }
