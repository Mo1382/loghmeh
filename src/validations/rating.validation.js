import { z } from "zod";

/**
 * Rating value
 */

const ratingValueSchema = z
  .number()
  .int("Rating value must be an integer.")
  .min(1, "Rating must be at least 1.")
  .max(5, "Rating must not exceed 5.");

/**
 * Create rating
 *
 * userId and recipeId are obtained from the authenticated user
 * and the recipe route/context. They must not come from the client.
 */

export const createRatingSchema = z
  .object({
    value: ratingValueSchema,
  })
  .strict();

/**
 * Update rating
 *
 * A user can update their previous rating.
 */

export const updateRatingSchema = z
  .object({
    value: ratingValueSchema,
  })
  .strict();
