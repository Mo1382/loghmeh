import crypto from "node:crypto";
import mongoose from "mongoose";

import {
  createRecipe as createRecipeRepository,
  findRecipeById,
  findRecipeBySlug,
  findRecipeBySlugAny,
  findDeletedRecipeById,
  findRecipes,
  updateRecipeById,
  softDeleteRecipe,
  restoreRecipe as restoreRecipeRepository,
  incrementViewCount,
  incrementBookmarkCount,
  incrementCommentCount,
  incrementRatingCount,
  updateAverageRating,
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

import { withTransaction } from "@/lib/transaction";
import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

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

/* -------------------------------------------------------------------------- */
/* Authentication / Authorization                                             */
/* -------------------------------------------------------------------------- */

function assertAuthenticated(currentUser) {
  if (!currentUser) {
    throw new AppError(
      "Authentication is required.",
      ERROR_CODES.UNAUTHORIZED,
      401
    );
  }
}

function assertAdmin(currentUser) {
  assertAuthenticated(currentUser);

  if (currentUser.role !== "ADMIN") {
    throw new AppError(
      "Administrator privileges are required.",
      ERROR_CODES.FORBIDDEN,
      403
    );
  }
}

function assertRecipeOwnerOrAdmin(currentUser, recipe) {
  assertAuthenticated(currentUser);

  const isOwner = recipe.authorId?.toString() === currentUser._id?.toString();

  const isAdmin = currentUser.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new AppError(
      "You are not allowed to modify this recipe.",
      ERROR_CODES.FORBIDDEN,
      403
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Validation / Normalization                                                 */
/* -------------------------------------------------------------------------- */

function assertValidObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      `Invalid ${fieldName}.`,
      ERROR_CODES.INVALID_REQUEST,
      400
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
      "Invalid recipe sort.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  return sort;
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

async function generateUniqueSlug(title) {
  const baseSlug = slugifyTitle(title);

  if (!baseSlug) {
    return `recipe-${Date.now()}`;
  }

  let slug = baseSlug;
  let counter = 1;

  /*
   * Important:
   * Deleted recipes are also checked here.
   *
   * Their slugs remain reserved so that restoring a deleted recipe
   * can never conflict with a newly created recipe.
   */
  while (await findRecipeBySlugAny(slug)) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

/* -------------------------------------------------------------------------- */
/* Cursor                                                                     */
/* -------------------------------------------------------------------------- */

function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("CURSOR_SECRET is not configured.");
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
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  const [payloadBase64, signatureBase64] = parts;

  /*
   * Verify HMAC before trusting the decoded payload.
   */
  let expectedSignature;
  let providedSignature;

  try {
    expectedSignature = crypto
      .createHmac("sha256", getCursorSecret())
      .update(payloadBase64)
      .digest();

    providedSignature = Buffer.from(signatureBase64, "base64url");
  } catch {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  let payload;

  try {
    const json = Buffer.from(payloadBase64, "base64url").toString("utf8");

    payload = JSON.parse(json);
  } catch {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  if (
    !payload ||
    payload.v !== CURSOR_VERSION ||
    !payload.sort ||
    payload.value === undefined ||
    !payload.id
  ) {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  if (!Object.values(RECIPE_SORTS).includes(payload.sort)) {
    throw new AppError(
      "Invalid cursor sort.",
      ERROR_CODES.INVALID_REQUEST,
      400
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
        "Invalid cursor date.",
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }
  } else {
    value = Number(payload.value);

    if (!Number.isFinite(value)) {
      throw new AppError(
        "Invalid cursor value.",
        ERROR_CODES.INVALID_REQUEST,
        400
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
  const sanitizedUpdates = { ...updates };

  /*
   * System-managed fields.
   * These must never be writable by the client.
   */
  delete sanitizedUpdates._id;
  delete sanitizedUpdates.authorId;
  delete sanitizedUpdates.slug;
  delete sanitizedUpdates.stats;
  delete sanitizedUpdates.deletedAt;
  delete sanitizedUpdates.createdAt;
  delete sanitizedUpdates.updatedAt;

  return sanitizedUpdates;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export async function createRecipe(currentUser, recipeData) {
  assertAuthenticated(currentUser);

  assertValidObjectId(recipeData.categoryId, "category ID");

  return withTransaction(async (session) => {
    /*
     * User read is part of the same transaction.
     */
    const author = await findUserById(currentUser._id, session);

    if (!author) {
      throw new AppError("User not found.", ERROR_CODES.USER_NOT_FOUND, 404);
    }

    if (author.accountStatus !== "ACTIVE" || author.deletedAt) {
      throw new AppError(
        "Your account is not active.",
        ERROR_CODES.FORBIDDEN,
        403
      );
    }

    const category = await findActiveCategoryById(
      recipeData.categoryId,
      session
    );

    if (!category) {
      throw new AppError(
        "Category not found or inactive.",
        ERROR_CODES.CATEGORY_NOT_FOUND,
        404
      );
    }

    const slug = await generateUniqueSlug(recipeData.title);

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
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

export async function getRecipeById(recipeId) {
  assertValidObjectId(recipeId, "recipe ID");

  const recipe = await findRecipeById(recipeId);

  if (!recipe) {
    throw new AppError("Recipe not found.", ERROR_CODES.RECIPE_NOT_FOUND, 404);
  }

  return recipe;
}

export async function getRecipeBySlug(slug) {
  if (!slug || typeof slug !== "string") {
    throw new AppError(
      "Invalid recipe slug.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  const recipe = await findRecipeBySlug(slug.trim());

  if (!recipe) {
    throw new AppError("Recipe not found.", ERROR_CODES.RECIPE_NOT_FOUND, 404);
  }

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
        "Cursor does not match the selected sort.",
        ERROR_CODES.INVALID_REQUEST,
        400
      );
    }
  }

  /*
   * Build only approved filters.
   * Arbitrary MongoDB filters must never come from the client.
   */
  const safeFilter = {};

  if (filter.categoryId !== undefined) {
    assertValidObjectId(filter.categoryId, "category ID");

    safeFilter.categoryId = filter.categoryId;
  }

  if (filter.authorId !== undefined) {
    assertValidObjectId(filter.authorId, "author ID");

    safeFilter.authorId = filter.authorId;
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

/* -------------------------------------------------------------------------- */
/* Home                                                                       */
/* -------------------------------------------------------------------------- */

/*
 * Home sections intentionally have separate entry points.
 *
 * Each function returns its own Promise so the page can start all
 * requests independently and render each section through Suspense
 * without one section blocking the others.
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

/* -------------------------------------------------------------------------- */
/* Update                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateRecipe(currentUser, recipeId, updates) {
  assertAuthenticated(currentUser);
  assertValidObjectId(recipeId, "recipe ID");

  const sanitizedUpdates = sanitizeRecipeUpdates(updates);

  return withTransaction(async (session) => {
    /*
     * Recipe lookup, authorization and update now belong to
     * the same transaction.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
    }

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
          "Category not found or inactive.",
          ERROR_CODES.CATEGORY_NOT_FOUND,
          404
        );
      }

      await incrementCategoryRecipeCount(recipe.categoryId, -1, session);

      await incrementCategoryRecipeCount(newCategory._id, 1, session);
    }

    /*
     * Slug is intentionally immutable.
     * Recipes have no draft/publish stage, so there is no
     * pre-publication slug that can later be changed.
     */
    const updatedRecipe = await updateRecipeById(
      recipeId,
      sanitizedUpdates,
      session
    );

    if (!updatedRecipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
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
     * Active Recipe lookup and authorization are inside
     * the same transaction.
     */
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
    }

    assertRecipeOwnerOrAdmin(currentUser, recipe);

    /*
     * Soft delete the Recipe only.
     *
     * Related bookmarks, ratings and comments are preserved.
     * Public access to them must be blocked by their respective
     * Services when the parent Recipe is deleted.
     *
     * Keeping these relations allows the Recipe to be restored
     * without losing its previous data.
     */
    const deletedRecipe = await softDeleteRecipe(recipeId, new Date(), session);

    if (!deletedRecipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
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
     * Dedicated repository query for deleted Recipes.
     */
    const recipe = await findDeletedRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
    }

    /*
     * The Recipe's category must still be active when restoring it.
     */
    const category = await findActiveCategoryById(recipe.categoryId, session);

    if (!category) {
      throw new AppError(
        "Recipe category is inactive or unavailable.",
        ERROR_CODES.CATEGORY_NOT_FOUND,
        404
      );
    }

    const restoredRecipe = await restoreRecipeRepository(recipeId, session);

    if (!restoredRecipe) {
      throw new AppError(
        "Recipe could not be restored.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
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

  return withTransaction(async (session) => {
    const recipe = await findRecipeById(recipeId, session);

    if (!recipe) {
      throw new AppError(
        "Recipe not found.",
        ERROR_CODES.RECIPE_NOT_FOUND,
        404
      );
    }

    const updatedRecipe = await incrementViewCount(recipeId, 1, session);

    await incrementTotalRecipeViews(recipe.authorId, 1, session);

    return updatedRecipe;
  });
}

export async function incrementRecipeBookmarkCount(
  recipeId,
  amount = 1,
  session
) {
  assertValidObjectId(recipeId, "recipe ID");

  return incrementBookmarkCount(recipeId, amount, session);
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
