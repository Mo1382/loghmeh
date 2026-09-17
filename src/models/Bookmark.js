import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema(
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
bookmarkSchema.index({ userId: 1, recipeId: 1 }, { unique: true });

bookmarkSchema.index({ userId: 1, createdAt: -1 });

const Bookmark =
  mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);

export default Bookmark;
