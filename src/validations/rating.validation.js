import { z } from "zod";

/**
 * Rating value
 */

const ratingValueSchema = z
  .number()
  .int("مقدار امتیاز باید یک عدد صحیح باشد.")
  .min(1, "امتیاز باید حداقل ۱ باشد.")
  .max(5, "امتیاز نباید بیشتر از ۵ باشد.");

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
