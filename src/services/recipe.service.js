import mongoose from "mongoose";

import {
  createRecipe as createRecipeRepository,
  findDeletedRecipeById,
  findRecipes,
  incrementCommentCount,
  incrementRatingCount,
  incrementViewCount,
  restoreRecipe as restoreRecipeRepository,
  softDeleteRecipe,
  updateAverageRating,
  updateRecipeById,
} from "@/repositories/recipe.repository";

import {
  findUserById,
  incrementRecipeCount,
  incrementTotalRecipeViews,
} from "@/repositories/user.repository";

import {
  findActiveCategoryById,
  incrementRecipeCount as incrementCategoryRecipeCount,
} from "@/repositories/category.repository";

import {
  getAccessibleRecipe,
  getAccessibleRecipeBySlug,
} from "@/lib/helpers/recipe-access";

import { ERROR_CODES } from "@/constants/error-codes";
import { assertAdmin, assertAuthenticated } from "@/lib/auth/guards";
import AppError from "@/lib/errors/AppError";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";
import { normalizeLimit } from "@/lib/pagination/limit";
import { withTransaction } from "@/lib/transaction";
import { assertEnum } from "@/lib/validation/enum";
import { pickAllowedFields } from "@/lib/validation/fields";
import { assertValidObjectId } from "@/lib/validation/object-id";
import { RECIPE_SORTS } from "@/constants/enums";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIST_LIMIT = 16;
const HOME_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 50;
const MAX_SLUG_RETRIES = 10;

const MUTABLE_RECIPE_FIELDS = [
  "categoryId",
  "title",
  "description",
  "origin",
  "difficulty",
  "preparationTime",
  "defaultServings",
  "image",
  "ingredients",
  "steps",
  "calories",
];

function assertRecipeOwnerOrAdmin(currentUser, recipe) {
  assertAuthenticated(currentUser);

  const isOwner = recipe.authorId?.toString() === currentUser._id?.toString();

  const isAdmin = currentUser.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه انجام این عملیات روی این دستور پخت را ندارید.",
      { statusCode: 403 }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Slug                                                                       */
/* -------------------------------------------------------------------------- */

function slugifyTitle(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createSlugCandidate(baseSlug, attempt) {
  if (attempt === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${attempt + 1}`;
}

function isSlugDuplicateError(error) {
  return error?.code === 11000 && error?.keyPattern?.slug === 1;
}

/* -------------------------------------------------------------------------- */
/* Cursor                                                                     */
/* -------------------------------------------------------------------------- */

function validateRecipeCursor(payload, sort) {
  if (
    !payload ||
    payload.sort !== sort ||
    payload.value === undefined ||
    !payload.id
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  assertEnum(payload.sort, Object.values(RECIPE_SORTS), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "ترتیب مرتب‌سازی دستورهای پخت نامعتبر است.",
    statusCode: 400,
  });

  assertValidObjectId(payload.id, "cursor ID");

  let value = payload.value;

  if (
    payload.sort === RECIPE_SORTS.NEWEST ||
    payload.sort === RECIPE_SORTS.OLDEST
  ) {
    value = new Date(payload.value);

    if (Number.isNaN(value.getTime())) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST,
        "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
        { statusCode: 400 }
      );
    }
  } else {
    value = Number(payload.value);

    if (!Number.isFinite(value)) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST,
        "مقدار نشانگر صفحه‌بندی نامعتبر است.",
        { statusCode: 400 }
      );
    }
  }

  return {
    sort: payload.sort,
    value,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}

function createNextCursor(recipes, sort) {
  if (!recipes.length) {
    return null;
  }

  const lastRecipe = recipes[recipes.length - 1];

  let value;

  switch (sort) {
    case RECIPE_SORTS.NEWEST:
    case RECIPE_SORTS.OLDEST:
      value = lastRecipe.createdAt?.toISOString();
      break;

    case RECIPE_SORTS.MOST_VIEWED:
      value = lastRecipe.stats?.viewCount ?? 0;
      break;

    case RECIPE_SORTS.HIGHEST_RATED:
      value = lastRecipe.stats?.averageRating ?? 0;
      break;

    default:
      return null;
  }

  if (value === undefined) {
    return null;
  }

  return encodeCursor({
    sort,
    value,
    id: lastRecipe._id,
  });
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createRecipe(currentUser, recipeData) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeData.categoryId, "category ID");

  const baseSlug = slugifyTitle(recipeData.title);

  if (!baseSlug) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "عنوان دستور پخت نمی‌تواند معتبر باشد.",
      { statusCode: 400 }
    );
  }

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = createSlugCandidate(baseSlug, attempt);

    try {
      return await withTransaction(async (session) => {
        const author = await findUserById(currentUser._id, session);

        if (!author) {
          throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
            statusCode: 404,
          });
        }

        if (author.accountStatus !== "ACTIVE") {
          throw new AppError(
            ERROR_CODES.FORBIDDEN,
            "حساب کاربری شما فعال نیست.",
            { statusCode: 403 }
          );
        }

        const category = await findActiveCategoryById(
          recipeData.categoryId,
          session
        );

        if (!category) {
          throw new AppError(
            ERROR_CODES.CATEGORY_NOT_FOUND,
            "دسته‌بندی پیدا نشد یا فعال نیست.",
            { statusCode: 404 }
          );
        }

        const recipe = await createRecipeRepository(
          {
            ...recipeData,
            authorId: author._id,
            slug,
          },
          session
        );

        await incrementRecipeCount(author._id, 1, session);

        await incrementCategoryRecipeCount(category._id, 1, session);

        return recipe;
      });
    } catch (error) {
      if (isSlugDuplicateError(error) && attempt < MAX_SLUG_RETRIES - 1) {
        continue;
      }

      if (isSlugDuplicateError(error)) {
        throw new AppError(
          ERROR_CODES.RECIPE_SLUG_CONFLICT,
          "امکان ایجاد یک شناسه متنی یکتا برای دستور پخت وجود نداشت.",
          { statusCode: 409 }
        );
      }

      throw error;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

export async function getRecipeById(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  const { recipe } = await getAccessibleRecipe(recipeId);

  return recipe;
}

export async function getRecipeBySlug(slug) {
  if (!slug || typeof slug !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "شناسه متنی دستور پخت نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const { recipe } = await getAccessibleRecipeBySlug(slug.trim());

  return recipe;
}

export async function getRecipes({
  filter = {},
  sort = RECIPE_SORTS.NEWEST,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  let finalSort = sort;
  if (!sort) finalSort = RECIPE_SORTS.NEWEST;

  const normalizedSort = assertEnum(finalSort, Object.values(RECIPE_SORTS), {
    errorCode: ERROR_CODES.INVALID_REQUEST,
    message: "ترتیب مرتب‌سازی دستورهای پخت نامعتبر است.",
    statusCode: 400,
  });

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let decodedCursor = null;

  if (cursor) {
    decodedCursor = cursor
      ? validateRecipeCursor(decodeCursor(cursor), normalizedSort)
      : null;

    if (decodedCursor.sort !== normalizedSort) {
      throw new AppError(
        ERROR_CODES.INVALID_REQUEST,
        "نشانگر صفحه‌بندی با مرتب‌سازی انتخاب‌شده مطابقت ندارد.",
        { statusCode: 400 }
      );
    }
  }

  const safeFilter = {};

  if (filter.categoryId !== undefined) {
    assertValidObjectId(filter.categoryId, "category ID");
    safeFilter.categoryId = filter.categoryId;
  }

  if (filter.authorId !== undefined) {
    assertValidObjectId(filter.authorId, "author ID");
    safeFilter.authorId = filter.authorId;
  }

  /*
   * findRecipes() must return only accessible Recipes:
   *
   * Recipe.deletedAt === null
   * AND Author.deletedAt === null
   * AND Author.accountStatus === "ACTIVE"
   * AND Category.isActive === true
   *
   * These conditions must be applied inside the repository BEFORE
   * cursor pagination and limit calculation.
   */

  const recipes = await findRecipes({
    filter: safeFilter,
    sort: normalizedSort,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = recipes.length > normalizedLimit;

  const items = hasMore ? recipes.slice(0, normalizedLimit) : recipes;

  const nextCursor = hasMore ? createNextCursor(items, normalizedSort) : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

export function getHomePopularRecipes() {
  return getRecipes({
    sort: RECIPE_SORTS.MOST_VIEWED,
    limit: HOME_LIST_LIMIT,
  }).then((result) => result.items);
}

export function getHomeCategoryRecipes(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  return getRecipes({
    filter: {
      categoryId,
    },
    sort: RECIPE_SORTS.NEWEST,
    limit: HOME_LIST_LIMIT,
  }).then((result) => result.items);
}

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateRecipe(currentUser, recipeId, updates) {
  assertAuthenticated(currentUser);
  assertValidObjectId(recipeId, "recipe ID");

  const sanitizedUpdates = pickAllowedFields(updates, MUTABLE_RECIPE_FIELDS);

  return withTransaction(async (session) => {
    /*
     * Recipe must be accessible before it can be updated.
     * This checks the Recipe, its Author and its Category.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    assertRecipeOwnerOrAdmin(currentUser, recipe);

    const categoryChanged =
      sanitizedUpdates.categoryId !== undefined &&
      sanitizedUpdates.categoryId.toString() !== recipe.categoryId.toString();

    if (categoryChanged) {
      assertValidObjectId(sanitizedUpdates.categoryId, "category ID");

      const newCategory = await findActiveCategoryById(
        sanitizedUpdates.categoryId,
        session
      );

      if (!newCategory) {
        throw new AppError(
          ERROR_CODES.CATEGORY_NOT_FOUND,
          "دسته‌بندی پیدا نشد یا فعال نیست.",
          { statusCode: 404 }
        );
      }

      await incrementCategoryRecipeCount(recipe.categoryId, -1, session);

      await incrementCategoryRecipeCount(newCategory._id, 1, session);
    }

    const updatedRecipe = await updateRecipeById(
      recipeId,
      sanitizedUpdates,
      session
    );

    if (!updatedRecipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    return updatedRecipe;
  });
}

/* -------------------------------------------------------------------------- */
/* Delete                                                                     */
/* -------------------------------------------------------------------------- */

export async function deleteRecipe(currentUser, recipeId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    /*
     * Recipe must be fully accessible before delete.
     */
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    assertRecipeOwnerOrAdmin(currentUser, recipe);

    /*
     * Only the Recipe is soft-deleted.
     *
     * Bookmarks, Ratings, Comments, Reactions and all other
     * relationships are intentionally preserved.
     */

    const deletedRecipe = await softDeleteRecipe(recipeId, new Date(), session);

    if (!deletedRecipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    await incrementRecipeCount(recipe.authorId, -1, session);

    await incrementCategoryRecipeCount(recipe.categoryId, -1, session);

    return deletedRecipe;
  });
}

/* -------------------------------------------------------------------------- */
/* Restore                                                                    */
/* -------------------------------------------------------------------------- */

export async function restoreDeletedRecipe(currentUser, recipeId) {
  assertAdmin(currentUser);
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    /*
     * Restore intentionally uses the deleted-Recipe lookup because
     * getAccessibleRecipe() only works with non-deleted Recipes.
     */
    const recipe = await findDeletedRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /*
     * A restored Recipe must have an active author and category.
     */
    await assertAccessibleRecipe(recipe, session);

    const restoredRecipe = await restoreRecipeRepository(recipeId, session);

    if (!restoredRecipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "بازیابی دستور پخت ممکن نبود.",
        { statusCode: 404 }
      );
    }

    await incrementRecipeCount(recipe.authorId, 1, session);

    await incrementCategoryRecipeCount(recipe.categoryId, 1, session);

    return restoredRecipe;
  });
}

/* -------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* -------------------------------------------------------------------------- */

export async function incrementRecipeView(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  /*
   * A Recipe view is allowed only for an accessible Recipe.
   */
  const { recipe } = await getAccessibleRecipe(recipeId);

  /*
   * View counters are atomic and intentionally non-transactional.
   */
  const updatedRecipe = await incrementViewCount(recipe._id, 1);

  if (!updatedRecipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  await incrementTotalRecipeViews(recipe.authorId, 1);

  return updatedRecipe;
}

export async function incrementRecipeCommentCount(
  recipeId,
  amount = 1,
  session
) {
  assertValidObjectId(recipeId, "recipe ID");

  return incrementCommentCount(recipeId, amount, session);
}

export async function incrementRecipeRatingCount(
  recipeId,
  amount = 1,
  session
) {
  assertValidObjectId(recipeId, "recipe ID");

  return incrementRatingCount(recipeId, amount, session);
}

export async function setRecipeAverageRating(recipeId, averageRating, session) {
  assertValidObjectId(recipeId, "recipe ID");

  return updateAverageRating(recipeId, averageRating, session);
}
