import mongoose from "mongoose";

import { CURSOR_RESOURCES, RECIPE_SORTS, USER_ROLES } from "@/constants/enums";

import { ERROR_CODES } from "@/constants/error-codes";

import {
  createRecipe as createRecipeRepository,
  findDeletedRecipeById,
  findNonDeletedRecipeById,
  findRecipes,
  incrementCommentCount,
  incrementViewCount,
  restoreRecipe as restoreRecipeRepository,
  softDeleteRecipe,
  updateRecipeById,
} from "@/repositories/recipe.repository";

import {
  findNonDeletedUserById,
  incrementTotalRecipeViews,
} from "@/repositories/user.repository";

import { findActiveCategoryById } from "@/repositories/category.repository";

import {
  getAccessibleRecipe,
  getAccessibleRecipeBySlug,
} from "@/lib/helpers/recipe-access";

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { withTransaction } from "@/lib/transaction";

import { assertCursorResource } from "@/lib/pagination/cursor-context";

import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

import { normalizeLimit } from "@/lib/pagination/limit";

import { assertEnum } from "@/lib/validation/enum";

import { pickAllowedFields } from "@/lib/validation/fields";

import { assertValidObjectId } from "@/lib/validation/object-id";
import {
  reconcileCategoryStatistics,
  reconcileUserStatistics,
} from "./statistics.service";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;

const HOME_LIST_LIMIT = 12;

const MAX_LIST_LIMIT = 50;

const MAX_SLUG_RETRIES = 10;

/**
 * Fields allowed for user Recipe mutations.
 *
 * calories intentionally removed.
 *
 * If calories become a calculated value,
 * they must only be modified by trusted backend logic.
 */
const MUTABLE_RECIPE_FIELDS = Object.freeze([
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
]);

/**
 * --------------------------------------------------------------------------
 * Authorization Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the current user owns the Recipe
 * or is an administrator.
 *
 * The caller must already be authenticated
 * and active.
 */
function assertRecipeOwnerOrAdmin(user, recipe) {
  const isOwner = recipe.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه انجام این عملیات روی این دستور پخت را ندارید.",
      {
        statusCode: 403,
      }
    );
  }
}

/**
 * Ensure update result exists.
 */
function assertUpdatedDocument(document, errorCode, message) {
  if (!document) {
    throw new AppError(errorCode, message, {
      statusCode: 404,
    });
  }

  return document;
}

/**
 * --------------------------------------------------------------------------
 * Slug Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Convert Recipe title into slug candidate.
 */
function slugifyTitle(title) {
  if (typeof title !== "string") {
    return "";
  }

  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normalize slug for lookup.
 */
export function normalizeSlug(slug) {
  if (typeof slug !== "string") {
    return null;
  }

  const normalized = slug.trim().toLowerCase();

  return normalized || null;
}

/**
 * Create deterministic slug candidate.
 */
function createSlugCandidate(baseSlug, attempt) {
  if (attempt === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${attempt + 1}`;
}

/**
 * Detect duplicate slug conflict.
 */
function isSlugDuplicateError(error) {
  return error?.code === 11000 && error?.keyPattern?.slug === 1;
}

/**
 * --------------------------------------------------------------------------
 * Cursor Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Validate decoded Recipe cursor.
 */
function validateRecipeCursor(payload, sort) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.sort === undefined ||
    payload.value === undefined ||
    !payload.id
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  assertCursorResource(payload, CURSOR_RESOURCES.RECIPES);

  assertEnum(payload.sort, Object.values(RECIPE_SORTS), {
    errorCode: ERROR_CODES.INVALID_CURSOR,
    message: "ترتیب مرتب‌سازی دستورهای پخت نامعتبر است.",
    statusCode: 400,
  });

  if (payload.sort !== sort) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی با مرتب‌سازی انتخاب‌شده مطابقت ندارد.",
      {
        statusCode: 400,
      }
    );
  }

  assertValidObjectId(payload.id, "cursor ID");

  let value;

  switch (payload.sort) {
    case RECIPE_SORTS.NEWEST:
    case RECIPE_SORTS.OLDEST: {
      value = new Date(payload.value);

      if (Number.isNaN(value.getTime())) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "تاریخ نشانگر صفحه‌بندی نامعتبر است.",
          {
            statusCode: 400,
          }
        );
      }

      break;
    }

    case RECIPE_SORTS.MOST_VIEWED:
    case RECIPE_SORTS.HIGHEST_RATED: {
      if (
        typeof payload.value !== "number" ||
        !Number.isFinite(payload.value)
      ) {
        throw new AppError(
          ERROR_CODES.INVALID_CURSOR,
          "مقدار نشانگر صفحه‌بندی نامعتبر است.",
          {
            statusCode: 400,
          }
        );
      }

      value = payload.value;

      break;
    }

    default:
      throw new AppError(
        ERROR_CODES.INVALID_CURSOR,
        "مرتب‌سازی دستورهای پخت نامعتبر است.",
        {
          statusCode: 400,
        }
      );
  }

  return {
    sort: payload.sort,
    value,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}

/**
 * --------------------------------------------------------------------------
 * Cursor Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Create next cursor from last returned Recipe.
 */
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
    resource: CURSOR_RESOURCES.RECIPES,
    sort,
    value,
    id: lastRecipe._id.toString(),
  });
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

export async function createRecipe(currentUser, recipeData) {
  const sanitizedData = pickAllowedFields(recipeData, MUTABLE_RECIPE_FIELDS);

  if (!sanitizedData || typeof sanitizedData.title !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "عنوان دستور پخت نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  assertValidObjectId(sanitizedData.categoryId, "category ID");

  const baseSlug = slugifyTitle(sanitizedData.title);

  if (!baseSlug) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "عنوان دستور پخت نمی‌تواند معتبر باشد.",
      {
        statusCode: 400,
      }
    );
  }

  for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
    const slug = createSlugCandidate(baseSlug, attempt);

    try {
      return await withTransaction(async (session) => {
        /**
         * Always resolve the user inside
         * transaction.
         */
        const user = await requireActiveAuthenticatedUser(currentUser, session);

        const category = await findActiveCategoryById(
          sanitizedData.categoryId,
          session
        );

        if (!category) {
          throw new AppError(
            ERROR_CODES.CATEGORY_NOT_FOUND,
            "دسته‌بندی پیدا نشد یا فعال نیست.",
            {
              statusCode: 404,
            }
          );
        }

        const recipe = await createRecipeRepository(
          {
            ...sanitizedData,
            authorId: user._id,
            slug,
          },
          session
        );

        await reconcileUserStatistics(user._id, session);

        await reconcileCategoryStatistics(category._id, session);

        return recipe;
      });
    } catch (error) {
      if (isSlugDuplicateError(error) && attempt < MAX_SLUG_RETRIES - 1) {
        continue;
      }

      if (isSlugDuplicateError(error)) {
        throw new AppError(
          ERROR_CODES.RECIPE_SLUG_CONFLICT,
          "امکان ایجاد شناسه متنی یکتا برای دستور پخت وجود نداشت.",
          {
            statusCode: 409,
          }
        );
      }

      throw error;
    }
  }

  throw new AppError(
    ERROR_CODES.RECIPE_SLUG_CONFLICT,
    "امکان ایجاد شناسه متنی یکتا برای دستور پخت وجود نداشت.",
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
      {
        statusCode: 400,
      }
    );
  }

  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, "شناسه متنی نامعتبر است.", {
      statusCode: 400,
    });
  }

  return getAccessibleRecipeBySlug(normalizedSlug);
}

/**
 * --------------------------------------------------------------------------
 * Get Recipes
 * --------------------------------------------------------------------------
 */

export async function getRecipes({
  filter = {},
  sort = RECIPE_SORTS.NEWEST,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  const safeFilter = {};

  if (filter.categoryId !== undefined) {
    assertValidObjectId(filter.categoryId, "category ID");

    safeFilter.categoryId = filter.categoryId;
  }

  if (filter.authorId !== undefined) {
    assertValidObjectId(filter.authorId, "author ID");

    safeFilter.authorId = filter.authorId;
  }

  const normalizedSort = assertEnum(sort, Object.values(RECIPE_SORTS), {
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
    decodedCursor = validateRecipeCursor(decodeCursor(cursor), normalizedSort);
  }

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

/**
 * --------------------------------------------------------------------------
 * Home
 * --------------------------------------------------------------------------
 */

export async function getHomePopularRecipes() {
  const result = await getRecipes({
    sort: RECIPE_SORTS.MOST_VIEWED,
    limit: HOME_LIST_LIMIT,
  });

  return result.items;
}

export async function getHomeCategoryRecipes(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  const result = await getRecipes({
    filter: {
      categoryId,
    },
    sort: RECIPE_SORTS.NEWEST,
    limit: HOME_LIST_LIMIT,
  });

  return result.items;
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

export async function updateRecipe(currentUser, recipeId, updates) {
  assertValidObjectId(recipeId, "recipe ID");

  const sanitizedUpdates = pickAllowedFields(updates, MUTABLE_RECIPE_FIELDS);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "حداقل یک فیلد معتبر برای ویرایش باید ارسال شود.",
      {
        statusCode: 400,
      }
    );
  }

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const recipe = await findNonDeletedRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    assertRecipeOwnerOrAdmin(user, recipe);

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
          {
            statusCode: 404,
          }
        );
      }

      await reconcileCategoryStatistics(recipe.categoryId, session);

      await reconcileCategoryStatistics(newCategory._id, session);
    }

    /**
     * Generate new slug only when title changes.
     */
    if (sanitizedUpdates.title && sanitizedUpdates.title !== recipe.title) {
      const newBaseSlug = slugifyTitle(sanitizedUpdates.title);

      if (!newBaseSlug) {
        throw new AppError(
          ERROR_CODES.INVALID_REQUEST,
          "عنوان دستور پخت معتبر نیست.",
          {
            statusCode: 400,
          }
        );
      }

      let updated = false;

      for (let attempt = 0; attempt < MAX_SLUG_RETRIES; attempt++) {
        const slug = createSlugCandidate(newBaseSlug, attempt);

        try {
          const updatedRecipe = await updateRecipeById(
            recipeId,
            {
              ...sanitizedUpdates,
              slug,
            },
            session
          );

          if (!updatedRecipe) {
            throw new AppError(
              ERROR_CODES.RECIPE_NOT_FOUND,
              "دستور پخت پیدا نشد.",
              {
                statusCode: 404,
              }
            );
          }

          return updatedRecipe;
        } catch (error) {
          if (isSlugDuplicateError(error) && attempt < MAX_SLUG_RETRIES - 1) {
            continue;
          }

          throw error;
        }
      }

      throw new AppError(
        ERROR_CODES.RECIPE_SLUG_CONFLICT,
        "امکان ایجاد شناسه متنی یکتا وجود نداشت.",
        {
          statusCode: 409,
        }
      );
    }

    const updatedRecipe = await updateRecipeById(
      recipeId,
      sanitizedUpdates,
      session
    );

    return assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

export async function deleteRecipe(currentUser, recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    const user = await requireActiveAuthenticatedUser(currentUser, session);

    const recipe = await findNonDeletedRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    assertRecipeOwnerOrAdmin(user, recipe);

    const deletedRecipe = await softDeleteRecipe(recipeId, new Date(), session);

    if (!deletedRecipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "حذف دستور پخت ممکن نبود.",
        {
          statusCode: 404,
        }
      );
    }

    await reconcileUserStatistics(recipe.authorId, session);

    const views = recipe.stats?.viewCount ?? 0;

    if (views > 0) {
      await reconcileCategoryStatistics(recipe.categoryId, session);
    }

    return deletedRecipe;
  });
}

/**
 * --------------------------------------------------------------------------
 * Restore
 * --------------------------------------------------------------------------
 */

export async function restoreDeletedRecipe(currentUser, recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  await assertAdmin(currentUser);

  return withTransaction(async (session) => {
    const recipe = await findDeletedRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    const author = await findNonDeletedUserById(recipe.authorId, session);

    if (!author) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        "نویسنده دستور پخت فعال نیست.",
        {
          statusCode: 403,
        }
      );
    }

    const category = await findActiveCategoryById(recipe.categoryId, session);

    if (!category) {
      throw new AppError(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        "دسته‌بندی فعال نیست.",
        {
          statusCode: 404,
        }
      );
    }

    const restoredRecipe = await restoreRecipeRepository(recipeId, session);

    assertUpdatedDocument(
      restoredRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "بازیابی دستور پخت ممکن نبود."
    );

    await reconcileUserStatistics(recipe.authorId, session);

    const views = recipe.stats?.viewCount ?? 0;

    if (views > 0) {
      await reconcileCategoryStatistics(recipe.categoryId, session);
    }

    return restoredRecipe;
  });
}

/**
 * --------------------------------------------------------------------------
 * Statistics
 * --------------------------------------------------------------------------
 */

export async function incrementRecipeView(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    const { recipe } = await getAccessibleRecipe(recipeId, session);

    const updatedRecipe = await incrementViewCount(recipe._id, 1, session);

    assertUpdatedDocument(
      updatedRecipe,
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد."
    );

    const updatedAuthor = await incrementTotalRecipeViews(
      recipe.authorId,
      1,
      session
    );

    assertUpdatedDocument(
      updatedAuthor,
      ERROR_CODES.USER_NOT_FOUND,
      "کاربر نویسنده پیدا نشد."
    );

    return updatedRecipe;
  });
}

export async function incrementRecipeCommentCount(
  recipeId,
  amount = 1,
  session
) {
  assertValidObjectId(recipeId, "recipe ID");

  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "تغییر تعداد نظرهای دستور پخت نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  const updatedRecipe = await incrementCommentCount(recipeId, amount, session);

  return assertUpdatedDocument(
    updatedRecipe,
    ERROR_CODES.RECIPE_NOT_FOUND,
    "دستور پخت پیدا نشد."
  );
}
