import mongoose from "mongoose";

import {
  createCategory as createCategoryRepository,
  findActiveCategories,
  findActiveCategoryById,
  findAllCategories,
  findCategoryById,
  findCategoryByName,
  findCategoryBySlug,
  incrementRecipeCount as incrementCategoryRecipeCount,
  setCategoryActive,
  updateCategoryById,
} from "@/repositories/category.repository";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

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

function normalizeCategoryName(name) {
  if (typeof name !== "string") {
    throw new AppError(
      "Invalid category name.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new AppError(
      "Category name cannot be empty.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  return normalizedName;
}

function normalizeCategorySlug(slug) {
  if (typeof slug !== "string") {
    throw new AppError(
      "Invalid category slug.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    throw new AppError(
      "Category slug cannot be empty.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  return normalizedSlug;
}

function slugifyCategoryName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(name) {
  const baseSlug = slugifyCategoryName(name);

  if (!baseSlug) {
    throw new AppError(
      "A valid category slug could not be generated.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  let slug = baseSlug;
  let counter = 1;

  while (await findCategoryBySlug(slug)) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

function sanitizeCategoryCreateData(categoryData) {
  const sanitizedData = {};

  if (categoryData.name !== undefined) {
    sanitizedData.name = categoryData.name;
  }

  if (categoryData.slug !== undefined) {
    sanitizedData.slug = categoryData.slug;
  }

  if (categoryData.icon !== undefined) {
    sanitizedData.icon = categoryData.icon;
  }

  if (categoryData.order !== undefined) {
    sanitizedData.order = categoryData.order;
  }

  return sanitizedData;
}

function sanitizeCategoryUpdates(updates) {
  const sanitizedUpdates = {};

  if (updates.name !== undefined) {
    sanitizedUpdates.name = updates.name;
  }

  if (updates.slug !== undefined) {
    sanitizedUpdates.slug = updates.slug;
  }

  if (updates.icon !== undefined) {
    sanitizedUpdates.icon = updates.icon;
  }

  if (updates.order !== undefined) {
    sanitizedUpdates.order = updates.order;
  }

  return sanitizedUpdates;
}

async function assertUniqueCategoryName(name, currentCategoryId = null) {
  const existingCategory = await findCategoryByName(name);

  if (
    existingCategory &&
    (!currentCategoryId ||
      existingCategory._id.toString() !== currentCategoryId.toString())
  ) {
    throw new AppError(
      "A category with this name already exists.",
      ERROR_CODES.CATEGORY_ALREADY_EXISTS,
      409
    );
  }
}

async function assertUniqueCategorySlug(slug, currentCategoryId = null) {
  const existingCategory = await findCategoryBySlug(slug);

  if (
    existingCategory &&
    (!currentCategoryId ||
      existingCategory._id.toString() !== currentCategoryId.toString())
  ) {
    throw new AppError(
      "A category with this slug already exists.",
      ERROR_CODES.CATEGORY_ALREADY_EXISTS,
      409
    );
  }
}

export async function getCategoryById(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(
      "Category not found.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  return category;
}

export async function getActiveCategoryById(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  const category = await findActiveCategoryById(categoryId);

  if (!category) {
    throw new AppError(
      "Category not found or inactive.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  return category;
}

export async function getCategoryBySlug(slug) {
  const normalizedSlug = normalizeCategorySlug(slug);

  const category = await findCategoryBySlug(normalizedSlug);

  if (!category) {
    throw new AppError(
      "Category not found.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  return category;
}

export async function getCategories({ activeOnly = true } = {}) {
  if (activeOnly) {
    return findActiveCategories();
  }

  return findAllCategories();
}

export async function createCategory(currentUser, categoryData) {
  assertAdmin(currentUser);

  const sanitizedData = sanitizeCategoryCreateData(categoryData);

  const name = normalizeCategoryName(sanitizedData.name);

  await assertUniqueCategoryName(name);

  let slug;

  if (sanitizedData.slug !== undefined) {
    slug = normalizeCategorySlug(sanitizedData.slug);
  } else {
    slug = await generateUniqueSlug(name);
  }

  await assertUniqueCategorySlug(slug);

  return createCategoryRepository({
    ...(sanitizedData.icon !== undefined && {
      icon: sanitizedData.icon,
    }),
    ...(sanitizedData.order !== undefined && {
      order: sanitizedData.order,
    }),
    name,
    slug,
  });
}

export async function updateCategory(currentUser, categoryId, updates) {
  assertAdmin(currentUser);
  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(
      "Category not found.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  const sanitizedUpdates = sanitizeCategoryUpdates(updates);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new AppError(
      "No valid category fields were provided.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  if (sanitizedUpdates.name !== undefined) {
    sanitizedUpdates.name = normalizeCategoryName(sanitizedUpdates.name);

    if (sanitizedUpdates.name !== category.name) {
      await assertUniqueCategoryName(sanitizedUpdates.name, category._id);
    }
  }

  if (sanitizedUpdates.slug !== undefined) {
    sanitizedUpdates.slug = normalizeCategorySlug(sanitizedUpdates.slug);

    if (sanitizedUpdates.slug !== category.slug) {
      await assertUniqueCategorySlug(sanitizedUpdates.slug, category._id);
    }
  }

  const updatedCategory = await updateCategoryById(
    categoryId,
    sanitizedUpdates
  );

  if (!updatedCategory) {
    throw new AppError(
      "Category not found.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  return updatedCategory;
}

export async function deactivateCategory(currentUser, categoryId) {
  assertAdmin(currentUser);
  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(
      "Category not found.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  if (!category.isActive) {
    throw new AppError(
      "Category is already inactive.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  if ((category.stats?.recipeCount ?? 0) > 0) {
    throw new AppError(
      "A category containing recipes cannot be deactivated.",
      ERROR_CODES.CATEGORY_HAS_RECIPES,
      409
    );
  }

  const updatedCategory = await setCategoryActive(categoryId, false);

  if (!updatedCategory) {
    throw new AppError(
      "Category could not be deactivated.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  return updatedCategory;
}

export async function activateCategory(currentUser, categoryId) {
  assertAdmin(currentUser);
  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(
      "Category not found.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  if (category.isActive) {
    throw new AppError(
      "Category is already active.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  const updatedCategory = await setCategoryActive(categoryId, true);

  if (!updatedCategory) {
    throw new AppError(
      "Category could not be activated.",
      ERROR_CODES.CATEGORY_NOT_FOUND,
      404
    );
  }

  return updatedCategory;
}

export async function incrementRecipeCount(categoryId, amount = 1, session) {
  assertValidObjectId(categoryId, "category ID");

  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(
      "Invalid recipe count change.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  return incrementCategoryRecipeCount(categoryId, amount, session);
}
