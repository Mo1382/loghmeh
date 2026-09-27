import {
  createRating as createRatingRepository,
  findRatingByUserAndRecipe,
  updateRatingByUserAndRecipe,
} from "@/repositories/rating.repository";

import { updateRatingStatsDeltas } from "@/repositories/recipe.repository";

import { NOTIFICATION_TYPES } from "@/constants/enums";

import { createSystemNotification } from "@/services/notification.service";

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
 * Zod validation should normally enforce this at the input boundary.
 * This check is kept in the Service as an additional business-layer guard.
 */
function assertValidRatingValue(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "امتیاز باید یک عدد صحیح بین ۱ و ۵ باشد.",
      { statusCode: 400 }
    );
  }
}

/**
 * Ensure the current user is not the Recipe owner.
 *
 * Users cannot rate their own Recipes.
 */
function assertNotRecipeOwner(currentUser, recipe) {
  const isOwner = recipe.authorId?.toString() === currentUser._id?.toString();

  if (isOwner) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما نمی‌توانید به دستور پخت خودتان امتیاز بدهید.",
      { statusCode: 403 }
    );
  }
}

/**
 * Ensure a MongoDB duplicate-key error is specifically
 * caused by the unique user/Recipe rating relationship.
 */
function throwRatingDuplicateError(error) {
  if (error?.code !== 11000) {
    throw error;
  }

  const keyPattern = error.keyPattern ?? {};
  const keyValue = error.keyValue ?? {};

  const isRatingDuplicate =
    (keyPattern.userId && keyPattern.recipeId) ||
    (Object.prototype.hasOwnProperty.call(keyValue, "userId") &&
      Object.prototype.hasOwnProperty.call(keyValue, "recipeId"));

  if (!isRatingDuplicate) {
    throw error;
  }

  throw new AppError(
    ERROR_CODES.RATING_ALREADY_EXISTS,
    "شما قبلاً به این دستور پخت امتیاز داده‌اید.",
    { statusCode: 409 }
  );
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's rating for a Recipe.
 *
 * Returns null when the user has not rated the Recipe yet.
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
 * Create a new rating for a Recipe.
 *
 * Rating statistics are updated atomically with the
 * Rating creation:
 *
 * ratingCount += 1
 * ratingSum   += value
 * averageRating = newSum / newCount
 */
export async function createRating(currentUser, recipeId, value) {
  assertValidObjectId(recipeId, "recipe ID");
  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * Only accessible Recipes can be rated.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    /**
     * Users cannot rate their own Recipes.
     */
    assertNotRecipeOwner(user, recipe);

    /**
     * Pre-check for the normal duplicate path.
     *
     * The unique database index remains the final
     * protection against concurrent duplicate requests.
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
        { statusCode: 409 }
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
      /**
       * Handle a duplicate-key race against the
       * unique { userId, recipeId } index.
       */
      throwRatingDuplicateError(error);
    }

    /**
     * Keep Recipe rating projections synchronized
     * inside the same transaction.
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
     * Notify the Recipe owner.
     *
     * assertNotRecipeOwner() guarantees that the
     * actor and recipient cannot be the same user.
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
 * Update the current user's existing rating.
 *
 * Only ratingSum changes because ratingCount remains unchanged.
 *
 * ratingSumDelta = newValue - oldValue
 */
export async function updateRating(currentUser, recipeId, value) {
  assertValidObjectId(recipeId, "recipe ID");
  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * Only accessible Recipes can have their
     * rating updated.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    assertNotRecipeOwner(user, recipe);

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
     * Idempotent behavior:
     * if the selected value is already stored,
     * no database mutation is required.
     */
    if (existingRating.value === value) {
      return existingRating;
    }

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
        { statusCode: 404 }
      );
    }

    /**
     * Replace the old contribution with the new one.
     *
     * Example:
     * old = 3
     * new = 5
     * delta = +2
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

    return updatedRating;
  });
}
