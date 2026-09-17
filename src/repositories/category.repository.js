import Category from "@/db/models/Category";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a category by ID.
 *
 * Includes both active and inactive categories.
 * This is useful for administrative operations.
 */
export function findCategoryById(categoryId, session) {
  const query = Category.findById(categoryId);

  return applySession(query, session);
}

/**
 * Find an active category by ID.
 *
 * Used when a category is required for public/user-facing operations.
 */
export function findActiveCategoryById(categoryId, session) {
  const query = Category.findOne({
    _id: categoryId,
    isActive: true,
  });

  return applySession(query, session);
}

/**
 * Find a category by slug.
 */
export function findCategoryBySlug(slug, session) {
  const query = Category.findOne({
    slug,
  });

  return applySession(query, session);
}

/**
 * Find an active category by slug.
 */
export function findActiveCategoryBySlug(slug, session) {
  const query = Category.findOne({
    slug,
    isActive: true,
  });

  return applySession(query, session);
}

/**
 * Find an active category by name.
 *
 * Useful when resolving a category from user-facing input.
 */
export function findActiveCategoryByName(name, session) {
  const query = Category.findOne({
    name,
    isActive: true,
  });

  return applySession(query, session);
}

/**
 * Get all active categories ordered by display order.
 *
 * Categories are usually small in number, so infinite loading
 * is not needed here.
 */
export function findActiveCategories(session) {
  const query = Category.find({
    isActive: true,
  }).sort({
    order: 1,
    _id: 1,
  });

  return applySession(query, session);
}

/**
 * Get all categories ordered by display order.
 *
 * Intended mainly for the Admin Panel.
 */
export function findAllCategories(session) {
  const query = Category.find({}).sort({
    order: 1,
    _id: 1,
  });

  return applySession(query, session);
}

/**
 * Create a category.
 *
 * System-managed fields such as stats and timestamps
 * are handled by the model/system.
 */
export function createCategory(categoryData, session) {
  if (session) {
    return Category.create([categoryData], { session }).then(
      ([category]) => category
    );
  }

  return Category.create(categoryData);
}

/**
 * Update a category by ID.
 *
 * Only explicitly provided fields are updated.
 */
export function updateCategoryById(categoryId, updates, session) {
  const query = Category.findByIdAndUpdate(
    categoryId,
    {
      $set: updates,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Activate or deactivate a category.
 */
export function setCategoryActive(categoryId, isActive, session) {
  const query = Category.findByIdAndUpdate(
    categoryId,
    {
      $set: {
        isActive,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Permanently delete a category.
 *
 * The Service layer must first verify that the category
 * can safely be deleted according to business rules.
 */
export function deleteCategoryById(categoryId, session) {
  const query = Category.findByIdAndDelete(categoryId);

  return applySession(query, session);
}

/**
 * Increment or decrement recipe count.
 */
export function incrementRecipeCount(categoryId, amount = 1, session) {
  const query = Category.findOneAndUpdate(
    {
      _id: categoryId,
    },
    {
      $inc: {
        "stats.recipeCount": amount,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}
