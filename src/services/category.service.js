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

import { assertAdmin } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import { assertValidObjectId } from "@/lib/validation/object-id";

import { pickAllowedFields } from "@/lib/validation/fields";

const MUTABLE_CATEGORY_FIELDS = Object.freeze([
  "name",
  "slug",
  "icon",
  "order",
]);

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

/**
 * --------------------------------------------------------------------------
 * Normalization
 * --------------------------------------------------------------------------
 */

/**
 * Normalize and validate a category name.
 */
function normalizeCategoryName(name) {
  if (typeof name !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نام دسته‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "نام دسته‌بندی نمی‌تواند خالی باشد.",
      { statusCode: 400 }
    );
  }

  return normalizedName;
}

/**
 * Normalize and validate a category slug.
 *
 * This intentionally performs only read/update normalization.
 * It does not attempt to generate a slug from arbitrary text.
 */
function normalizeCategorySlug(slug) {
  if (typeof slug !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "شناسه متنی دسته‌بندی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "شناسه متنی دسته‌بندی نمی‌تواند خالی باشد.",
      { statusCode: 400 }
    );
  }

  return normalizedSlug;
}

/**
 * Convert a category name into a slug candidate.
 */
function slugifyCategoryName(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a unique slug candidate.
 *
 * The unique database index remains the final protection
 * against concurrent requests.
 */
async function generateUniqueSlug(name) {
  const baseSlug = slugifyCategoryName(name);

  if (!baseSlug) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "تولید شناسه متنی معتبر برای دسته‌بندی ممکن نبود.",
      { statusCode: 400 }
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

/**
 * --------------------------------------------------------------------------
 * Uniqueness
 * --------------------------------------------------------------------------
 */

async function assertUniqueCategoryName(name, currentCategoryId = null) {
  const existingCategory = await findCategoryByName(name);

  if (
    existingCategory &&
    (!currentCategoryId ||
      existingCategory._id.toString() !== currentCategoryId.toString())
  ) {
    throw new AppError(
      ERROR_CODES.CATEGORY_ALREADY_EXISTS,
      "دسته‌بندی‌ای با این نام از قبل وجود دارد.",
      { statusCode: 409 }
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
      ERROR_CODES.CATEGORY_ALREADY_EXISTS,
      "دسته‌بندی‌ای با این شناسه متنی از قبل وجود دارد.",
      { statusCode: 409 }
    );
  }
}

/**
 * Map a MongoDB duplicate-key error to the appropriate
 * category application error.
 */
function throwCategoryDuplicateError(error) {
  if (error?.code !== 11000) {
    throw error;
  }

  const keyPattern = error.keyPattern ?? {};
  const keyValue = error.keyValue ?? {};

  if (
    keyPattern.name ||
    Object.prototype.hasOwnProperty.call(keyValue, "name")
  ) {
    throw new AppError(
      ERROR_CODES.CATEGORY_ALREADY_EXISTS,
      "دسته‌بندی‌ای با این نام از قبل وجود دارد.",
      { statusCode: 409 }
    );
  }

  if (
    keyPattern.slug ||
    Object.prototype.hasOwnProperty.call(keyValue, "slug")
  ) {
    throw new AppError(
      ERROR_CODES.CATEGORY_ALREADY_EXISTS,
      "دسته‌بندی‌ای با این شناسه متنی از قبل وجود دارد.",
      { statusCode: 409 }
    );
  }

  throw error;
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

export async function getCategoryById(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  return category;
}

export async function getActiveCategoryById(categoryId) {
  assertValidObjectId(categoryId, "category ID");

  const category = await findActiveCategoryById(categoryId);

  if (!category) {
    throw new AppError(
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "دسته‌بندی پیدا نشد یا فعال نیست.",
      { statusCode: 404 }
    );
  }

  return category;
}

export async function getCategoryBySlug(slug) {
  const normalizedSlug = normalizeCategorySlug(slug);

  const category = await findCategoryBySlug(normalizedSlug);

  if (!category) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  return category;
}

export async function getCategories({ activeOnly = true } = {}) {
  if (activeOnly) {
    return findActiveCategories();
  }

  return findAllCategories();
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

export async function createCategory(currentUser, categoryData) {
  assertAdmin(currentUser);

  const sanitizedData = pickAllowedFields(
    categoryData,
    MUTABLE_CATEGORY_FIELDS
  );

  const name = normalizeCategoryName(sanitizedData.name);

  await assertUniqueCategoryName(name);

  let slug;

  if (sanitizedData.slug !== undefined) {
    slug = normalizeCategorySlug(sanitizedData.slug);
  } else {
    slug = await generateUniqueSlug(name);
  }

  await assertUniqueCategorySlug(slug);

  try {
    return await createCategoryRepository({
      name,
      slug,

      ...(sanitizedData.icon !== undefined && {
        icon: sanitizedData.icon,
      }),

      ...(sanitizedData.order !== undefined && {
        order: sanitizedData.order,
      }),
    });
  } catch (error) {
    /**
     * The pre-checks above are only an optimization.
     * The unique database indexes remain the final
     * protection against concurrent duplicate writes.
     */
    throwCategoryDuplicateError(error);
  }
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

export async function updateCategory(currentUser, categoryId, updates) {
  await assertAdmin(currentUser);

  assertValidObjectId(categoryId, "category ID");

  const sanitizedUpdates = pickAllowedFields(updates, MUTABLE_CATEGORY_FIELDS);

  if (Object.keys(sanitizedUpdates).length === 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "هیچ فیلد معتبری برای دسته‌بندی ارائه نشده است.",
      {
        statusCode: 400,
      }
    );
  }

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (sanitizedUpdates.name !== undefined) {
    const normalizedName = normalizeCategoryName(sanitizedUpdates.name);

    sanitizedUpdates.name = normalizedName;

    if (normalizedName !== category.name) {
      await assertUniqueCategoryName(normalizedName, category._id);
    }
  }

  if (sanitizedUpdates.slug !== undefined) {
    const normalizedSlug = normalizeCategorySlug(sanitizedUpdates.slug);

    sanitizedUpdates.slug = normalizedSlug;

    if (normalizedSlug !== category.slug) {
      await assertUniqueCategorySlug(normalizedSlug, category._id);
    }
  }

  let updatedCategory;

  try {
    updatedCategory = await updateCategoryById(categoryId, sanitizedUpdates);
  } catch (error) {
    /**
     * The database unique indexes remain the
     * final protection against concurrent
     * duplicate name/slug updates.
     */
    throwCategoryDuplicateError(error);
  }

  if (!updatedCategory) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  return updatedCategory;
}

/**
 * --------------------------------------------------------------------------
 * Activation
 * --------------------------------------------------------------------------
 */

export async function deactivateCategory(currentUser, categoryId) {
  assertAdmin(currentUser);

  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (!category.isActive) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "دسته‌بندی از قبل غیرفعال است.",
      { statusCode: 400 }
    );
  }

  /**
   * Based on the current project business rule,
   * categories containing recipes cannot be deactivated.
   */
  if ((category.stats?.recipeCount ?? 0) > 0) {
    throw new AppError(
      ERROR_CODES.CATEGORY_HAS_RECIPES,
      "دسته‌بندی دارای دستور پخت را نمی‌توان غیرفعال کرد.",
      { statusCode: 409 }
    );
  }

  const updatedCategory = await setCategoryActive(categoryId, false);

  if (!updatedCategory) {
    throw new AppError(
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "غیرفعال‌سازی دسته‌بندی انجام نشد.",
      { statusCode: 404 }
    );
  }

  return updatedCategory;
}

export async function activateCategory(currentUser, categoryId) {
  assertAdmin(currentUser);

  assertValidObjectId(categoryId, "category ID");

  const category = await findCategoryById(categoryId);

  if (!category) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  if (category.isActive) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "دسته‌بندی از قبل فعال است.",
      { statusCode: 400 }
    );
  }

  const updatedCategory = await setCategoryActive(categoryId, true);

  if (!updatedCategory) {
    throw new AppError(
      ERROR_CODES.CATEGORY_NOT_FOUND,
      "فعال‌سازی دسته‌بندی انجام نشد.",
      { statusCode: 404 }
    );
  }

  return updatedCategory;
}

/**
 * --------------------------------------------------------------------------
 * Statistics
 * --------------------------------------------------------------------------
 */

/**
 * Increment or decrement the number of Recipes
 * associated with a Category.
 *
 * This is an internal synchronization operation and
 * expects the repository to perform the atomic update.
 */
export async function incrementRecipeCount(categoryId, amount = 1, session) {
  assertValidObjectId(categoryId, "category ID");

  if (!Number.isInteger(amount) || amount === 0) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "تغییر تعداد دستورهای پخت نامعتبر است.",
      { statusCode: 400 }
    );
  }

  const updatedCategory = await incrementCategoryRecipeCount(
    categoryId,
    amount,
    session
  );

  if (!updatedCategory) {
    throw new AppError(ERROR_CODES.CATEGORY_NOT_FOUND, "دسته‌بندی پیدا نشد.", {
      statusCode: 404,
    });
  }

  return updatedCategory;
}
