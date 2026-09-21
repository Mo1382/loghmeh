import mongoose from "mongoose";
import crypto from "node:crypto";

import {
  createRecipe as createRecipeRepository,
  findDeletedRecipeById,
  findRecipeById,
  findRecipeBySlug,
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

import { ERROR_CODES } from "@/constants/error-codes";
import { AppError } from "@/lib/errors/AppError";
import { withTransaction } from "@/lib/transaction";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const RECIPE_SORTS = {
  NEWEST: "NEWEST",
  OLDEST: "OLDEST",
  MOST_VIEWED: "MOST_VIEWED",
  HIGHEST_RATED: "HIGHEST_RATED",
};

const DEFAULT_LIST_LIMIT = 16;
const HOME_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 50;
const CURSOR_VERSION = 1;
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

/* -------------------------------------------------------------------------- */
/* Authentication / Authorization                                             */
/* -------------------------------------------------------------------------- */

function assertAuthenticated(currentUser) {
  if (!currentUser) {
    throw new AppError(
      ERROR_CODES.UNAUTHORIZED,
      "ورود به حساب کاربری الزامی است.",
      { statusCode: 401 }
    );
  }
}

function assertAdmin(currentUser) {
  assertAuthenticated(currentUser);

  if (currentUser.role !== "ADMIN") {
    throw new AppError(ERROR_CODES.FORBIDDEN, "دسترسی مدیر سیستم الزامی است.", {
      statusCode: 403,
    });
  }
}

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
/* Validation / Normalization                                                 */
/* -------------------------------------------------------------------------- */

function assertValidObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      `شناسه ${fieldName} نامعتبر است.`,
      { statusCode: 400 }
    );
  }
}

function normalizeLimit(limit, defaultLimit = DEFAULT_LIST_LIMIT) {
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return defaultLimit;
  }

  return Math.min(parsedLimit, MAX_LIST_LIMIT);
}

function normalizeSort(sort) {
  if (!sort) {
    return RECIPE_SORTS.NEWEST;
  }

  if (!Object.values(RECIPE_SORTS).includes(sort)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "ترتیب مرتب‌سازی دستورهای پخت نامعتبر است.",
      { statusCode: 400 }
    );
  }

  return sort;
}

/* -------------------------------------------------------------------------- */
/* Recipe Accessibility                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Checks whether the Recipe's required dependencies are active and usable.
 *
 * A Recipe is accessible only when:
 * - the Recipe itself is not deleted
 * - its author exists
 * - its author is ACTIVE
 * - its author is not deleted
 * - its category exists
 * - its category is active
 */
async function getAccessibleRecipeContext(recipe, session) {
  const [author, category] = await Promise.all([
    findUserById(recipe.authorId, session),
    findActiveCategoryById(recipe.categoryId, session),
  ]);

  if (!author || author.accountStatus !== "ACTIVE") {
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

async function getAccessibleRecipe(recipeId, session) {
  const recipe = await findRecipeById(recipeId, session);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  return getAccessibleRecipeContext(recipe, session);
}

async function getAccessibleRecipeBySlug(slug, session) {
  const recipe = await findRecipeBySlug(slug, session);

  if (!recipe) {
    throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
      statusCode: 404,
    });
  }

  return getAccessibleRecipeContext(recipe, session);
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

function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("متغیر CURSOR_SECRET تنظیم نشده است.");
  }

  return secret;
}

function encodeCursor({ sort, value, id }) {
  const payload = {
    v: CURSOR_VERSION,
    sort,
    value,
    id: id.toString(),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", getCursorSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const [payloadBase64, signatureBase64] = parts;

  let expectedSignature;
  let providedSignature;

  try {
    expectedSignature = crypto
      .createHmac("sha256", getCursorSecret())
      .update(payloadBase64)
      .digest();

    providedSignature = Buffer.from(signatureBase64, "base64url");
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  let payload;

  try {
    const json = Buffer.from(payloadBase64, "base64url").toString("utf8");

    payload = JSON.parse(json);
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (
    !payload ||
    payload.v !== CURSOR_VERSION ||
    !payload.sort ||
    payload.value === undefined ||
    !payload.id
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  if (!Object.values(RECIPE_SORTS).includes(payload.sort)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "مرتب‌سازی نشانگر صفحه‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

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
/* Update Sanitization                                                        */
/* -------------------------------------------------------------------------- */

function sanitizeRecipeUpdates(updates) {
  if (!updates || typeof updates !== "object") {
    return {};
  }

  const sanitizedUpdates = {};

  for (const field of MUTABLE_RECIPE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      sanitizedUpdates[field] = updates[field];
    }
  }

  return sanitizedUpdates;
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
  const normalizedSort = normalizeSort(sort);
  const normalizedLimit = normalizeLimit(limit);

  let decodedCursor = null;

  if (cursor) {
    decodedCursor = decodeCursor(cursor);

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

  const sanitizedUpdates = sanitizeRecipeUpdates(updates);

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
    await getAccessibleRecipeContext(recipe, session);

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
