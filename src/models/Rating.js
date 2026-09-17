import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },

    value: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating value must be an integer.",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ratingSchema.index({ userId: 1, recipeId: 1 }, { unique: true });

ratingSchema.index({ recipeId: 1 });

const Rating = mongoose.models.Rating || mongoose.model("Rating", ratingSchema);

export default Rating;
