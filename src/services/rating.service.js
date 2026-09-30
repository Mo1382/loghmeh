import {
  createRating as createRatingRepository,
  findRatingByUserAndRecipe,
  updateRatingByUserAndRecipe,
} from "@/repositories/rating.repository";

import { updateRatingStatsDeltas } from "@/repositories/recipe.repository";

import { updateUserRatingStatsDeltas } from "@/repositories/user.repository";

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
 * Convert the expected unique-index violation for:
 *
 * { userId, recipeId }
 *
 * into a domain error.
 *
 * Other duplicate-key errors are rethrown unchanged.
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
 * Normal statistics path:
 *
 * Rating
 *   ↓
 * Recipe statistics → Delta
 *   ↓
 * User statistics   → Delta
 *
 * All changes occur inside one transaction.
 *
 * User reconciliation is intentionally NOT performed here.
 * It remains available as a repair/rebuild mechanism.
 */
export async function createRating(currentUser, recipeId, value) {
  assertValidObjectId(recipeId, "recipe ID");

  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    /**
     * Resolve the authenticated User again
     * inside the transaction.
     */
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * The Recipe must currently be accessible.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    assertNotRecipeOwner(user, recipe);

    /**
     * Fast duplicate pre-check.
     *
     * The unique database index remains the
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
     * Maintain Recipe rating statistics
     * using atomic deltas.
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
     * Maintain User rating statistics
     * using the same delta.
     *
     * Create:
     *   ratingCount + 1
     *   ratingSum   + value
     *
     * averageRating is recalculated atomically
     * by the Repository from the new values.
     */
    const updatedUser = await updateUserRatingStatsDeltas(
      recipe.authorId,
      1,
      value,
      session
    );

    if (!updatedUser) {
      throw new AppError(
        ERROR_CODES.USER_NOT_FOUND,
        "آمار امتیازات کاربر به‌روزرسانی نشد.",
        {
          statusCode: 404,
        }
      );
    }

    /**
     * Notify the Recipe owner.
     *
     * Self-rating has already been prohibited,
     * so the notification target and actor differ.
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
 * Update the current user's existing Rating.
 *
 * ratingCount remains unchanged.
 *
 * Only ratingSum changes:
 *
 *     newValue - oldValue
 *
 * The same delta is applied to both:
 *
 * Recipe.stats
 * User.stats
 *
 * User reconciliation is intentionally NOT performed
 * during the normal mutation path.
 */
export async function updateRating(currentUser, recipeId, value) {
  assertValidObjectId(recipeId, "recipe ID");

  assertValidRatingValue(value);

  return withTransaction(async (session) => {
    /**
     * Resolve the authenticated User again
     * inside the transaction.
     */
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    /**
     * The Recipe must currently be accessible.
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
     *
     * Nothing needs to change when the selected
     * value is already active.
     */
    if (existingRating.value === value) {
      return existingRating;
    }

    /**
     * Calculate the delta from the source Rating.
     *
     * Example:
     *
     * 2 -> 5 = +3
     * 5 -> 2 = -3
     */
    const ratingSumDelta = value - existingRating.value;

    /**
     * Update the source Rating.
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
     * Maintain Recipe rating statistics.
     *
     * ratingCountDelta = 0
     * ratingSumDelta   = newValue - oldValue
     */
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
     * Maintain User rating statistics
     * using exactly the same delta.
     *
     * ratingCount remains unchanged.
     * ratingSum changes by ratingSumDelta.
     *
     * averageRating is recalculated atomically
     * by the Repository from the new values.
     */
    const updatedUser = await updateUserRatingStatsDeltas(
      recipe.authorId,
      0,
      ratingSumDelta,
      session
    );

    if (!updatedUser) {
      throw new AppError(
        ERROR_CODES.USER_NOT_FOUND,
        "آمار امتیازات کاربر به‌روزرسانی نشد.",
        {
          statusCode: 404,
        }
      );
    }

    return updatedRating;
  });
}
