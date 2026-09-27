import {
  findAccessibleRecipeById,
  findAccessibleRecipeBySlug,
} from "@/repositories/recipe.repository";

import { ERROR_CODES } from "@/constants/error-codes";

import AppError from "@/lib/errors/AppError";

import { assertValidObjectId } from "@/lib/validation/object-id";

/**
 * --------------------------------------------------------------------------
 * Error Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Create the standard public Recipe-not-found error.
 *
 * Accessibility failures intentionally do not reveal whether
 * the Recipe, its Author, or its Category caused the failure.
 */
function recipeNotFoundError() {
  return new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
    statusCode: 404,
  });
}

/**
 * --------------------------------------------------------------------------
 * Get Accessible Recipe
 * --------------------------------------------------------------------------
 */

/**
 * Get a publicly accessible Recipe by ID.
 *
 * The Repository is responsible for enforcing the complete
 * accessibility policy:
 *
 * - Recipe exists
 * - Recipe.deletedAt === null
 * - Author exists
 * - Author is ACTIVE
 * - Author is non-deleted
 * - Category exists
 * - Category is active
 *
 * The helper is responsible only for exposing a stable
 * business-level error contract.
 */
export async function getAccessibleRecipe(recipeId, session) {
  assertValidObjectId(recipeId, "recipe ID");

  const result = await findAccessibleRecipeById(recipeId, session);

  if (!result) {
    throw recipeNotFoundError();
  }

  return result;
}

/**
 * --------------------------------------------------------------------------
 * Get Accessible Recipe By Slug
 * --------------------------------------------------------------------------
 */

/**
 * Get a publicly accessible Recipe by slug.
 *
 * The slug should already have been normalized by the
 * caller/service boundary when necessary.
 *
 * The Repository is responsible for enforcing the same
 * accessibility policy used by getAccessibleRecipe().
 */
export async function getAccessibleRecipeBySlug(slug, session) {
  if (typeof slug !== "string" || !slug.trim()) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "شناسه متنی دستور پخت نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const result = await findAccessibleRecipeBySlug(slug, session);

  if (!result) {
    throw recipeNotFoundError();
  }

  return result;
}
