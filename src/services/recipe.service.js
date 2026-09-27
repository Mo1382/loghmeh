import mongoose from "mongoose";

import {
  createRecipe as createRecipeRepository,
  findDeletedRecipeById,
  findRecipeById,
  findRecipes,
  incrementCommentCount,
  incrementViewCount,
  restoreRecipe as restoreRecipeRepository,
  softDeleteRecipe,
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

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { assertCursorResource } from "@/lib/pagination/cursor-context";

import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

import { normalizeLimit } from "@/lib/pagination/limit";

import { withTransaction } from "@/lib/transaction";

import { assertEnum } from "@/lib/validation/enum";

import { pickAllowedFields } from "@/lib/validation/fields";

import { assertValidObjectId } from "@/lib/validation/object-id";

import {
  ACCOUNT_STATUSES,
  CURSOR_RESOURCES,
  RECIPE_SORTS,
  USER_ROLES,
} from "@/constants/enums";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const HOME_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 50;
const MAX_SLUG_RETRIES = 10;

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
  "calories",
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
 * The user must already be freshly authenticated
 * and active before this helper is called.
 */
function assertRecipeOwnerOrAdmin(user, recipe) {
  const isOwner = recipe.authorId?.toString() === user._id?.toString();

  const isAdmin = user.role === USER_ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      ERROR_CODES.FORBIDDEN,
      "شما اجازه انجام این عملیات روی این دستور پخت را ندارید.",
      { statusCode: 403 }
    );
  }
}

/**
 * Assert that a document/update result exists.
 */
function assertUpdatedDocument(document, errorCode, message) {
  if (!document) {
    throw new AppError(errorCode, message, { statusCode: 404 });
  }

  return document;
}

/**
 * --------------------------------------------------------------------------
 * Slug
 * --------------------------------------------------------------------------
 */

/**
 * Convert a Recipe title into a slug candidate.
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
 * Normalize a slug for lookup.
 *
 * This intentionally does not slugify arbitrary input.
 */
export function normalizeSlug(slug) {
  if (typeof slug !== "string") {
    return null;
  }

  const normalized = slug.trim().toLowerCase();

  return normalized || null;
}

/**
 * Create a deterministic slug candidate for a retry attempt.
 */
function createSlugCandidate(baseSlug, attempt) {
  if (attempt === 0) {
    return baseSlug;
  }

  return `${baseSlug}-${attempt + 1}`;
}

/**
 * Detect a duplicate-key error specifically for Recipe.slug.
 */
function isSlugDuplicateError(error) {
  return error?.code === 11000 && error?.keyPattern?.slug === 1;
}

/**
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

/**
 * Validate and normalize a decoded Recipe cursor.
 *
 * Cursor payload:
 * {
 *   v: 1,
 *   resource: CURSOR_RESOURCES.RECIPES,
 *   sort: String,
 *   value: String | Number,
 *   id: String
 * }
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
      { statusCode: 400 }
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
      { statusCode: 400 }
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
          { statusCode: 400 }
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
          { statusCode: 400 }
        );
      }

      value = payload.value;
      break;
    }

    default:
      throw new AppError(
        ERROR_CODES.INVALID_CURSOR,
        "مرتب‌سازی دستورهای پخت نامعتبر است.",
        { statusCode: 400 }
      );
  }

  return {
    sort: payload.sort,
    value,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}

/**
 * Create the next cursor from the last returned Recipe.
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
      { statusCode: 400 }
    );
  }

  assertValidObjectId(sanitizedData.categoryId, "category ID");

  const baseSlug = slugifyTitle(sanitizedData.title);

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
        /**
         * Re-resolve the current account inside
         * the transaction so a stale authentication
         * object is not trusted for the mutation.
         */
        const user = await requireActiveAuthenticatedUser(currentUser);

        const category = await findActiveCategoryById(
          sanitizedData.categoryId,
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
            ...sanitizedData,
            authorId: user._id,
            slug,
          },
          session
        );

        const updatedAuthor = await incrementRecipeCount(user._id, 1, session);

        assertUpdatedDocument(
          updatedAuthor,
          ERROR_CODES.USER_NOT_FOUND,
          "کاربر پیدا نشد یا شمارنده دستورهای پخت به‌روزرسانی نشد."
        );

        const updatedCategory = await incrementCategoryRecipeCount(
          category._id,
          1,
          session
        );

        assertUpdatedDocument(
          updatedCategory,
          ERROR_CODES.CATEGORY_NOT_FOUND,
          "دسته‌بندی پیدا نشد یا شمارنده دستورهای پخت به‌روزرسانی نشد."
        );

        return recipe;
      });
    } catch (error) {
      /**
       * Slug uniqueness is ultimately guaranteed by
       * the database unique index.
       */
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

  /**
   * Defensive fallback.
   */
  throw new AppError(
    ERROR_CODES.RECIPE_SLUG_CONFLICT,
    "امکان ایجاد شناسه متنی یکتا برای دستور پخت وجود نداشت.",
    { statusCode: 409 }
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
      { statusCode: 400 }
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
  const finalSort = sort || RECIPE_SORTS.NEWEST;

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
    decodedCursor = validateRecipeCursor(decodeCursor(cursor), normalizedSort);
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

  /**
   * findRecipes() is responsible for returning only
   * publicly accessible Recipes:
   *
   * - Recipe.deletedAt === null
   * - Author is ACTIVE and non-deleted
   * - Category is active
   *
   * These accessibility constraints must be applied
   * in the repository before pagination.
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

/**
 * --------------------------------------------------------------------------
 * Home
 * --------------------------------------------------------------------------
 */

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

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

export async function updateRecipe(currentUser, recipeId, updates) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  const sanitizedUpdates = pickAllowedFields(updates, MUTABLE_RECIPE_FIELDS);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "حداقل یک فیلد معتبر برای ویرایش باید ارسال شود.",
      { statusCode: 400 }
    );
  }

  return withTransaction(async (session) => {
    /**
     * Management operations use the non-deleted
     * Recipe directly.
     *
     * Public accessibility is not required here:
     * an administrator must be able to manage Recipes
     * even when their author or category is no longer
     * publicly accessible.
     */
    const recipe = await findRecipeById(recipeId, session);

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
          { statusCode: 404 }
        );
      }

      const updatedOldCategory = await incrementCategoryRecipeCount(
        recipe.categoryId,
        -1,
        session
      );

      assertUpdatedDocument(
        updatedOldCategory,
        ERROR_CODES.CATEGORY_NOT_FOUND,
        "دسته‌بندی قبلی پیدا نشد یا تعداد دستورهای پخت آن نامعتبر است."
      );

      const updatedNewCategory = await incrementCategoryRecipeCount(
        newCategory._id,
        1,
        session
      );

      assertUpdatedDocument(
        updatedNewCategory,
        ERROR_CODES.CATEGORY_NOT_FOUND,
        "دسته‌بندی جدید پیدا نشد."
      );
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

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete a Recipe.
 *
 * Only the Recipe owner or an administrator
 * can perform this operation.
 *
 * Related Bookmark/Rating/Comment/Reaction documents
 * are preserved for the current soft-delete policy.
 */
export async function deleteRecipe(currentUser, recipeId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    /**
     * Do not require public accessibility here.
     *
     * The owner should still be able to delete their
     * Recipe if its Category becomes inactive, and
     * administrators have full Recipe access.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    assertRecipeOwnerOrAdmin(user, recipe);

    const deletedAt = new Date();

    const deletedRecipe = await softDeleteRecipe(recipeId, deletedAt, session);

    if (!deletedRecipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت حذف نشد.", {
        statusCode: 404,
      });
    }

    /**
     * User recipe count is meaningful only for
     * non-deleted User accounts.
     *
     * An administrator may delete a Recipe whose
     * author has already been soft-deleted, so in that
     * case the author's internal counters are not a
     * reason to fail the Recipe deletion.
     */
    const author = await findUserById(recipe.authorId, session);

    if (author) {
      const updatedAuthor = await incrementRecipeCount(
        recipe.authorId,
        -1,
        session
      );

      assertUpdatedDocument(
        updatedAuthor,
        ERROR_CODES.USER_NOT_FOUND,
        "شمارنده دستورهای پخت کاربر به‌روزرسانی نشد."
      );

      const viewCount = recipe.stats?.viewCount ?? 0;

      if (viewCount > 0) {
        const updatedAuthorViews = await incrementTotalRecipeViews(
          recipe.authorId,
          -viewCount,
          session
        );

        assertUpdatedDocument(
          updatedAuthorViews,
          ERROR_CODES.USER_NOT_FOUND,
          "شمارنده بازدیدهای دستورهای پخت کاربر به‌روزرسانی نشد."
        );
      }
    }

    const updatedCategory = await incrementCategoryRecipeCount(
      recipe.categoryId,
      -1,
      session
    );

    assertUpdatedDocument(
      updatedCategory,
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "شمارنده دستورهای پخت دسته‌بندی به‌روزرسانی نشد."
    );

    return deletedRecipe;
  });
}

/**
 * --------------------------------------------------------------------------
 * Restore
 * --------------------------------------------------------------------------
 */

/**
 * Restore a soft-deleted Recipe.
 *
 * Only an administrator can restore a Recipe.
 *
 * The author and Category must both be currently active
 * so the restored Recipe can immediately become accessible.
 */
export async function restoreDeletedRecipe(currentUser, recipeId) {
  assertAdmin(currentUser);

  assertValidObjectId(recipeId, "recipe ID");

  return withTransaction(async (session) => {
    const recipe = await findDeletedRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * The author must currently be ACTIVE
     * and non-deleted.
     */
    const author = await findUserById(recipe.authorId, session);

    if (!author || author.accountStatus !== ACCOUNT_STATUSES.ACTIVE) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        "دستور پخت به دلیل غیرفعال بودن نویسنده قابل بازیابی نیست.",
        { statusCode: 403 }
      );
    }

    /**
     * The Category must currently be active.
     */
    const category = await findActiveCategoryById(recipe.categoryId, session);

    if (!category) {
      throw new AppError(
        ERROR_CODES.CATEGORY_NOT_FOUND,
        "دستور پخت به دلیل غیرفعال بودن دسته‌بندی قابل بازیابی نیست.",
        { statusCode: 404 }
      );
    }

    const restoredRecipe = await restoreRecipeRepository(recipeId, session);

    if (!restoredRecipe) {
      throw new AppError(
        ERROR_CODES.RECIPE_NOT_FOUND,
        "بازیابی دستور پخت ممکن نبود.",
        { statusCode: 404 }
      );
    }

    const updatedAuthor = await incrementRecipeCount(
      recipe.authorId,
      1,
      session
    );

    assertUpdatedDocument(
      updatedAuthor,
      ERROR_CODES.USER_NOT_FOUND,
      "شمارنده دستورهای پخت کاربر به‌روزرسانی نشد."
    );

    const viewCount = recipe.stats?.viewCount ?? 0;

    if (viewCount > 0) {
      const updatedAuthorViews = await incrementTotalRecipeViews(
        recipe.authorId,
        viewCount,
        session
      );

      assertUpdatedDocument(
        updatedAuthorViews,
        ERROR_CODES.USER_NOT_FOUND,
        "شمارنده بازدیدهای دستورهای پخت کاربر به‌روزرسانی نشد."
      );
    }

    const updatedCategory = await incrementCategoryRecipeCount(
      recipe.categoryId,
      1,
      session
    );

    assertUpdatedDocument(
      updatedCategory,
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "شمارنده دستورهای پخت دسته‌بندی به‌روزرسانی نشد."
    );

    return restoredRecipe;
  });
}

/**
 * --------------------------------------------------------------------------
 * Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Increment a Recipe's view count and the corresponding
 * author's total Recipe views atomically.
 *
 * A view is allowed only for an accessible Recipe.
 */
export async function incrementRecipeView(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  /**
   * Resolve the current publicly accessible state
   * before opening the transaction.
   */
  const { recipe } = await getAccessibleRecipe(recipeId);

  return withTransaction(async (session) => {
    const updatedRecipe = await incrementViewCount(recipe._id, 1, session);

    if (!updatedRecipe) {
      throw new AppError(ERROR_CODES.RECIPE_NOT_FOUND, "دستور پخت پیدا نشد.", {
        statusCode: 404,
      });
    }

    const updatedAuthor = await incrementTotalRecipeViews(
      recipe.authorId,
      1,
      session
    );

    if (!updatedAuthor) {
      throw new AppError(
        ERROR_CODES.USER_NOT_FOUND,
        "کاربر نویسنده پیدا نشد.",
        { statusCode: 404 }
      );
    }

    return updatedRecipe;
  });
}

/**
 * Increment or decrement a Recipe's top-level
 * comment count.
 *
 * The repository performs the atomic update.
 */
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
      { statusCode: 400 }
    );
  }

  const updatedRecipe = await incrementCommentCount(recipeId, amount, session);

  if (!updatedRecipe) {
    throw new AppError(
      ERROR_CODES.RECIPE_NOT_FOUND,
      "دستور پخت پیدا نشد یا شمارنده نظرهای آن نامعتبر است.",
      { statusCode: 404 }
    );
  }

  return updatedRecipe;
}
