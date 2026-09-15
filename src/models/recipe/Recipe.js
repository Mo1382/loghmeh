import mongoose from "mongoose";

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      default: null,
      min: 0,
    },

    unit: {
      type: String,
      enum: [
        "به مقدار کافی",
        "عدد",
        "گرم",
        "کیلوگرم",
        "میلی‌گرم",
        "میلی‌لیتر",
        "لیتر",
        "قاشق غذاخوری",
        "قاشق چای‌خوری",
        "پیمانه",
        "لیوان",
        "فنجان",
        "حبه",
        "پر",
        "برش",
      ],
      required: true,
    },
  },
  { _id: false }
);

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
    },

    description: {
      type: String,
      required: true,
      trim: true,
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

    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    bookmarkCount: {
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
      enum: ["آسان", "متوسط", "سخت"],
      required: true,
    },

    preparationTime: {
      type: Number,
      required: true,
      min: 1,
    },

    defaultServings: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
      default: 1,
    },

    image: {
      type: String,
      required: true,
      trim: true,
    },

    ingredients: {
      type: [ingredientSchema],
      required: true,
      validate: {
        validator: (items) => items.length >= 1,
        message: "A recipe must contain at least one ingredient.",
      },
    },

    steps: {
      type: [stepSchema],
      required: true,
      validate: {
        validator: (items) => items.length >= 1,
        message: "A recipe must contain at least one cooking step.",
      },
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
recipeSchema.index({ authorId: 1, createdAt: -1 });

recipeSchema.index({ categoryId: 1, createdAt: -1 });

recipeSchema.index({
  categoryId: 1,
  "stats.viewCount": -1,
});

recipeSchema.index({ "stats.averageRating": -1 });

recipeSchema.index({ "stats.viewCount": -1 });

recipeSchema.index({ createdAt: -1 });

const Recipe = mongoose.models.Recipe || mongoose.model("Recipe", recipeSchema);

export default Recipe;
