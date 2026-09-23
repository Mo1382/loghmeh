import mongoose from "mongoose";
import { REACTION_TYPES } from "@/constants/enums";

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },

    type: {
      type: String,
      enum: Object.values(REACTION_TYPES),
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
reactionSchema.index({ userId: 1, commentId: 1 }, { unique: true });

reactionSchema.index({ commentId: 1, type: 1 });

const Reaction =
  mongoose.models.Reaction || mongoose.model("Reaction", reactionSchema);

export default Reaction;
