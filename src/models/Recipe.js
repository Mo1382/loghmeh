import mongoose from "mongoose";

import {
  DIFFICULTIES,
  INGREDIENT_UNITS,
  RECIPE_LIMITS,
} from "@/constants/enums";

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: RECIPE_LIMITS.MAX_INGREDIENT_NAME_LENGTH,
    },

    quantity: {
      type: Number,
      default: null,
      validate: {
        validator: (value) => value === null || value > 0,
        message: "Quantity must be greater than 0.",
      },
    },

    unit: {
      type: String,
      enum: INGREDIENT_UNITS,
      required: true,
    },
  },
  { _id: false }
);

ingredientSchema.pre("validate", function (next) {
  if (this.unit === "به مقدار کافی") {
    if (this.quantity !== null) {
      this.invalidate(
        "quantity",
        "Quantity must be null when the unit is 'به مقدار کافی'."
      );
    }
  } else if (this.quantity === null) {
    this.invalidate(
      "quantity",
      "Quantity is required when the unit is not 'به مقدار کافی'."
    );
  }

  next();
});

const stepSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: RECIPE_LIMITS.MAX_STEP_TITLE_LENGTH,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: RECIPE_LIMITS.MAX_STEP_DESCRIPTION_LENGTH,
    },
  },
  { _id: false }
);

const recipeStatsSchema = new mongoose.Schema(
  {
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    ratingSum: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 30,
      maxlength: 500,
    },

    origin: {
      type: String,
      default: null,
      trim: true,
      maxlength: 60,
    },

    difficulty: {
      type: String,
      enum: DIFFICULTIES,
      required: true,
    },

    preparationTime: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (value) => Number.isInteger(value),
        message: "Preparation time must be a positive integer.",
      },
    },

    defaultServings: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      validate: {
        validator: Number.isInteger,
        message: "Default servings must be an integer.",
      },
      default: 1,
    },
    image: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value) => {
          try {
            const url = new URL(value);
            return url.protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "Image URL must be a valid HTTPS URL.",
      },
    },

    ingredients: {
      type: [ingredientSchema],
      required: true,
      validate: [
        {
          validator: (items) =>
            items.length >= 1 && items.length <= RECIPE_LIMITS.MAX_INGREDIENTS,
          message: `A recipe must contain between 1 and ${RECIPE_LIMITS.MAX_INGREDIENTS} ingredients.`,
        },
      ],
    },

    steps: {
      type: [stepSchema],
      required: true,
      validate: [
        {
          validator: (items) =>
            items.length >= 1 &&
            items.length <= RECIPE_LIMITS.MAX_STEPS &&
            items.every((step, index) => step.order === index + 1),
          message: `A recipe must contain between 1 and ${RECIPE_LIMITS.MAX_STEPS} cooking steps, with sequential ordering.`,
        },
      ],
    },

    calories: {
      type: Number,
      default: null,
      min: 0,
    },

    stats: {
      type: recipeStatsSchema,
      default: () => ({}),
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes

recipeSchema.index({
  authorId: 1,
  createdAt: -1,
});

recipeSchema.index({
  categoryId: 1,
  createdAt: -1,
});

recipeSchema.index({
  categoryId: 1,
  "stats.viewCount": -1,
});

recipeSchema.index(
  {
    slug: 1,
  },
  {
    unique: true,
  }
);

recipeSchema.index({
  "stats.averageRating": -1,
  _id: -1,
});

recipeSchema.index({
  "stats.viewCount": -1,
  _id: -1,
});

recipeSchema.index({
  createdAt: -1,
  _id: -1,
});

const Recipe = mongoose.models.Recipe || mongoose.model("Recipe", recipeSchema);

export default Recipe;
