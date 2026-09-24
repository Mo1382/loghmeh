import {
  findRecipeById,
  findRecipeBySlug,
} from "@/repositories/recipe.repository";

import { findUserById } from "@/repositories/user.repository";

import { findActiveCategoryById } from "@/repositories/category.repository";

import { ERROR_CODES } from "@/constants/error-codes";
import { ACCOUNT_STATUSES } from "@/constants/enums";
import AppError from "@/lib/errors/AppError";

async function assertAccessibleRecipe(recipe, session) {
  const [author, category] = await Promise.all([
    findUserById(recipe.authorId, session),
    findActiveCategoryById(recipe.categoryId, session),
  ]);

  if (!author || author.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (!category) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  return {
    recipe,
    author,
    category,
  };
}

export async function getAccessibleRecipe(recipeId, session) {
  const recipe = await findRecipeById(recipeId, session);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  return assertAccessibleRecipe(recipe, session);
}

export async function getAccessibleRecipeBySlug(slug, session) {
  const recipe = await findRecipeBySlug(slug, session);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  return assertAccessibleRecipe(recipe, session);
}
