import {
  createRating as createRatingRepository,
  findRatingByUserAndRecipe,
  updateRatingByUserAndRecipe,
} from "@/repositories/rating.repository";

import { updateRatingStatsDeltas } from "@/repositories/recipe.repository";

import { reconcileUserStatistics } from "@/services/statistics.service";
import { createSystemNotification } from "@/services/notification.service";

import { NOTIFICATION_TYPES } from "@/constants/enums";

import { ERROR_CODES } from "@/constants/error-codes";

import { requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { withTransaction } from "@/lib/transaction";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { getAccessibleRecipe } from "@/lib/helpers/recipe-access";

/**
 * --------------------------------------------------------------------------
 * Authentication / Validation
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the rating value is an integer between 1 and 5.
 *
 * Zod validation should normally enforce this at the
 * external input boundary as well.
 *
 * This check remains as a business-layer guard.
 */
function assertValidRatingValue(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "امتیاز باید یک عدد صحیح بین ۱ و ۵ باشد.",
      {
        statusCode: 400,
      }
    );
  }
}

/**
 * Users cannot rate their own Recipes.
 */
function assertNotRecipeOwner(currentUser, recipe) {
  const isOwner = recipe.authorId?.toString() === currentUser._id?.toString();

  if (isOwner) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید به دستور پخت خودتان امتیاز بدهید.",
      {
        statusCode: 403,
      }
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * Duplicate Error Handling
 * --------------------------------------------------------------------------
 */

/**
 * Convert a duplicate-key error from the unique
 * { userId, recipeId } index into a domain error.
 *
 * Only the expected Rating uniqueness violation is
 * converted. Other duplicate-key errors are rethrown.
 */
function throwRatingDuplicateError(error) {
  if (error?.code !== 11000) {
    throw error;
  }

  const keyPattern = error.keyPattern ?? {};
  const keyValue = error.keyValue ?? {};

  const isRatingDuplicate =
    Boolean(keyPattern.userId && keyPattern.recipeId) ||
    (Object.prototype.hasOwnProperty.call(keyValue, "userId") &&
      Object.prototype.hasOwnProperty.call(keyValue, "recipeId"));

  if (!isRatingDuplicate) {
    throw error;
  }

  throw new AppError(
    ERROR_CODES.RATING_ALREADY_EXISTS,
    "شما قبلاً به این دستور پخت امتیاز داده‌اید.",
    {
      statusCode: 409,
    }
  );
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's Rating for a Recipe.
 *
 * The Recipe must currently be accessible.
 */
export async function getUserRating(currentUser, recipeId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  await getAccessibleRecipe(recipeId);

  return findRatingByUserAndRecipe(user._id, recipeId);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a new Rating.
 *
 * Maintains:
 *
 * Rating
 *   ↓
 * Recipe.stats.ratingCount
 * Recipe.stats.ratingSum
 * Recipe.stats.averageRating
 *
 * Then reconciles:
 *
 * Recipe + Rating
 *   ↓
 * User.stats.ratingCount
 * User.stats.ratingSum
 * User.stats.averageRating
 */
export async function createRating(currentUser, recipeId, value) {
  assertValidObjectId(recipeId, "recipe ID");

  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    /**
     * Re-resolve the authenticated User
     * inside the transaction.
     */
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * Recipe must remain accessible
     * within this transaction.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    assertNotRecipeOwner(user, recipe);

    /**
     * Fast duplicate pre-check.
     *
     * The database unique index remains the
     * final protection against concurrent creation.
     */
    const existingRating = await findRatingByUserAndRecipe(
      user._id,
      recipeId,
      session
    );

    if (existingRating) {
      throw new AppError(
        ERROR_CODES.RATING_ALREADY_EXISTS,
        "شما قبلاً به این دستور پخت امتیاز داده‌اید.",
        {
          statusCode: 409,
        }
      );
    }

    let rating;

    try {
      rating = await createRatingRepository(
        {
          userId: user._id,
          recipeId,
          value,
        },
        session
      );
    } catch (error) {
      throwRatingDuplicateError(error);
    }

    /**
     * Rating is the source of truth.
     *
     * Atomically maintain the Recipe's
     * denormalized rating statistics.
     */
    const updatedRecipe = await updateRatingStatsDeltas(
      recipeId,
      1,
      value,
      session
    );

    if (!updatedRecipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Reconcile User statistics from the
     * underlying source data.
     *
     * IMPORTANT:
     * The existing transaction session is reused.
     */
    await reconcileUserStatistics(recipe.authorId, session);

    /**
     * Notify the Recipe owner.
     *
     * Self-rating is already prohibited above,
     * so the actor and target owner are different.
     */
    await createSystemNotification(
      {
        userId: recipe.authorId,
        actorId: user._id,
        type: NOTIFICATION_TYPES.RECIPE_RATED,
        title: "امتیاز جدید برای دستور پخت شما",
        message: `${user.username} به دستور پخت شما امتیاز داد.`,
        recipeId: recipe._id,
      },
      session
    );

    return rating;
  });
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

/**
 * Update an existing Rating.
 *
 * ratingCount remains unchanged.
 *
 * Only ratingSum changes:
 *
 * newValue - oldValue
 *
 * User statistics are reconciled from source data
 * after the Recipe projection is updated.
 */
export async function updateRating(currentUser, recipeId, value) {
  assertValidObjectId(recipeId, "recipe ID");

  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    /**
     * Re-resolve the authenticated User
     * inside the transaction.
     */
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * Recipe must remain accessible.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    assertNotRecipeOwner(user, recipe);

    /**
     * Load the current Rating.
     */
    const existingRating = await findRatingByUserAndRecipe(
      user._id,
      recipeId,
      session
    );

    if (!existingRating) {
      throw new AppError(ERROR_CODES.RATING_NOT_FOUND, "امتیاز پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Idempotent update:
     * no database mutation is required.
     */
    if (existingRating.value === value) {
      return existingRating;
    }

    /**
     * Update the source Rating first.
     */
    const updatedRating = await updateRatingByUserAndRecipe(
      user._id,
      recipeId,
      value,
      session
    );

    if (!updatedRating) {
      throw new AppError(
        ERROR_CODES.RATING_NOT_FOUND,
        "امتیاز به‌روزرسانی نشد.",
        {
          statusCode: 404,
        }
      );
    }

    /**
     * Move the difference into Recipe.ratingSum.
     *
     * Example:
     *
     * 2 -> 5  => +3
     * 5 -> 2  => -3
     */
    const ratingSumDelta = value - existingRating.value;

    const updatedRecipe = await updateRatingStatsDeltas(
      recipeId,
      0,
      ratingSumDelta,
      session
    );

    if (!updatedRecipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Recalculate User rating statistics
     * from the underlying Rating/Recipe data.
     *
     * The same transaction session is reused.
     */
    await reconcileUserStatistics(recipe.authorId, session);

    return updatedRating;
  });
}
