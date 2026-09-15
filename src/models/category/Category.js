import mongoose from "mongoose";

const categoryStatsSchema = new mongoose.Schema(
  {
    recipeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    icon: {
      type: String,
      required: true,
      trim: true,
    },

    order: {
      type: Number,
      required: true,
      min: 0,
    },

    stats: {
      type: categoryStatsSchema,
      default: () => ({}),
    },

    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// For queries in admin panel
categorySchema.index({ order: 1 });
categorySchema.index({ "stats.recipeCount": -1 });

// For queries in admin panel and customer website
categorySchema.index({ isActive: 1, order: 1 });

const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;
