import {
  DIFFICULTIES,
  INGREDIENT_UNITS,
  RECIPE_LIMITS,
} from "@/constants/enums";

import { z } from "zod";

/**
 * --------------------------------------------------------------------------
 * Reusable Fields
 * --------------------------------------------------------------------------
 */

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "شناسه نامعتبر است.");

const titleSchema = z
  .string()
  .trim()
  .min(5, "عنوان دستور غذا باید حداقل ۵ کاراکتر باشد.")
  .max(120, "عنوان دستور غذا نباید بیشتر از ۱۲۰ کاراکتر باشد.");

const descriptionSchema = z
  .string()
  .trim()
  .min(30, "توضیحات باید حداقل ۳۰ کاراکتر باشد.")
  .max(500, "توضیحات نباید بیشتر از ۵۰۰ کاراکتر باشد.");

const originSchema = z
  .string()
  .trim()
  .max(60, "مبدأ نباید بیشتر از ۶۰ کاراکتر باشد.");

const difficultySchema = z.enum(DIFFICULTIES);

const preparationTimeSchema = z
  .number()
  .int()
  .min(1, "زمان آماده‌سازی باید حداقل ۱ دقیقه باشد.");

const servingsSchema = z
  .number()
  .int()
  .min(1, "تعداد وعده باید حداقل ۱ باشد.")
  .max(100, "تعداد وعده نباید بیشتر از ۱۰۰ باشد.");

const imageSchema = z
  .string()
  .trim()
  .url("نشانی تصویر باید معتبر باشد.")
  .refine(
    (value) => value.startsWith("https://"),
    "نشانی تصویر باید از HTTPS استفاده کند."
  );

const caloriesSchema = z.number().min(0, "کالری نمی‌تواند منفی باشد.");

/**
 * --------------------------------------------------------------------------
 * Ingredient
 * --------------------------------------------------------------------------
 */

const ingredientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "نام ماده اولیه الزامی است.")
      .max(
        RECIPE_LIMITS.MAX_INGREDIENT_NAME_LENGTH,
        `نام ماده اولیه نباید بیشتر از ${RECIPE_LIMITS.MAX_INGREDIENT_NAME_LENGTH} کاراکتر باشد.`
      ),

    quantity: z
      .number()
      .positive({
        message: "مقدار باید بزرگ‌تر از صفر باشد.",
      })
      .nullable()
      .optional(),

    unit: z.enum(INGREDIENT_UNITS),
  })
  .strict()
  .superRefine((data, ctx) => {
    /**
     * "به مقدار کافی" is a qualitative quantity
     * and therefore must not have a numeric quantity.
     */
    if (data.unit === "به مقدار کافی") {
      if (data.quantity != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "وقتی واحد «به مقدار کافی» است، نباید مقداری وارد شود.",
          path: ["quantity"],
        });
      }

      return;
    }

    /**
     * Every other unit requires an explicit
     * positive numeric quantity.
     */
    if (data.quantity == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "مقدار ماده اولیه الزامی است.",
        path: ["quantity"],
      });
    }
  });

/**
 * --------------------------------------------------------------------------
 * Ingredients
 * --------------------------------------------------------------------------
 */

const ingredientsSchema = z
  .array(ingredientSchema)
  .min(1, "دستور غذا باید حداقل یک ماده اولیه داشته باشد.")
  .max(
    RECIPE_LIMITS.MAX_INGREDIENTS,
    `دستور غذا نمی‌تواند بیشتر از ${RECIPE_LIMITS.MAX_INGREDIENTS} ماده اولیه داشته باشد.`
  );

/**
 * --------------------------------------------------------------------------
 * Cooking Step
 * --------------------------------------------------------------------------
 */

const stepSchema = z
  .object({
    order: z.number().int().min(1, "ترتیب مرحله باید از ۱ شروع شود."),

    title: z
      .string()
      .trim()
      .min(1, "عنوان مرحله الزامی است.")
      .max(
        RECIPE_LIMITS.MAX_STEP_TITLE_LENGTH,
        `عنوان مرحله نباید بیشتر از ${RECIPE_LIMITS.MAX_STEP_TITLE_LENGTH} کاراکتر باشد.`
      ),

    description: z
      .string()
      .trim()
      .min(1, "توضیحات مرحله الزامی است.")
      .max(
        RECIPE_LIMITS.MAX_STEP_DESCRIPTION_LENGTH,
        `توضیحات مرحله نباید بیشتر از ${RECIPE_LIMITS.MAX_STEP_DESCRIPTION_LENGTH} کاراکتر باشد.`
      ),
  })
  .strict();

/**
 * --------------------------------------------------------------------------
 * Cooking Steps
 * --------------------------------------------------------------------------
 */

const stepsSchema = z
  .array(stepSchema)
  .min(1, "دستور غذا باید حداقل یک مرحله پخت داشته باشد.")
  .max(
    RECIPE_LIMITS.MAX_STEPS,
    `دستور غذا نمی‌تواند بیشتر از ${RECIPE_LIMITS.MAX_STEPS} مرحله پخت داشته باشد.`
  )
  .superRefine((steps, ctx) => {
    steps.forEach((step, index) => {
      const expectedOrder = index + 1;

      if (step.order !== expectedOrder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ترتیب مراحل پخت باید از ۱ شروع شده و پیوسته باشد.",
          path: [index, "order"],
        });
      }
    });
  });

/**
 * --------------------------------------------------------------------------
 * Create Recipe
 * --------------------------------------------------------------------------
 *
 * System-managed fields such as authorId, slug, stats,
 * deletedAt and timestamps are intentionally excluded.
 */

export const createRecipeSchema = z
  .object({
    /**
     * The UI submits categoryId rather than a category name.
     */
    categoryId: objectIdSchema,

    title: titleSchema,

    description: descriptionSchema,

    origin: originSchema.nullable().optional(),

    difficulty: difficultySchema,

    preparationTime: preparationTimeSchema,

    defaultServings: servingsSchema,

    image: imageSchema,

    ingredients: ingredientsSchema,

    steps: stepsSchema,

    calories: caloriesSchema.nullable().optional(),
  })
  .strict();

/**
 * --------------------------------------------------------------------------
 * Update Recipe
 * --------------------------------------------------------------------------
 *
 * Partial update.
 *
 * At least one supported field must be supplied.
 *
 * System-managed fields such as authorId, slug,
 * stats and deletedAt cannot be updated through this schema.
 */

export const updateRecipeSchema = z
  .object({
    categoryId: objectIdSchema.optional(),

    title: titleSchema.optional(),

    description: descriptionSchema.optional(),

    origin: originSchema.nullable().optional(),

    difficulty: difficultySchema.optional(),

    preparationTime: preparationTimeSchema.optional(),

    defaultServings: servingsSchema.optional(),

    image: imageSchema.optional(),

    ingredients: ingredientsSchema.optional(),

    steps: stepsSchema.optional(),

    calories: caloriesSchema.nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "حداقل یک فیلد باید وارد شود.",
  });

/**
 * --------------------------------------------------------------------------
 * Recipe List Filter
 * --------------------------------------------------------------------------
 *
 * Only fields supported by getRecipes() are allowed.
 *
 * Unknown filter fields are rejected rather than
 * silently ignored.
 */

export const recipeListFilterSchema = z
  .object({
    categoryId: objectIdSchema.optional(),

    authorId: objectIdSchema.optional(),
  })
  .strict();
