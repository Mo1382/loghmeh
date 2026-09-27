import mongoose from "mongoose";
import { MAX_COMMENT_REPLIES } from "@/constants/enums";

const replySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_COMMENT_LENGTH,
    },

    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dislikeCount: {
      type: Number,
      default: 0,
      min: 0,
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

const commentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    replies: {
      type: [replySchema],
      default: [],
      validate: {
        validator: (items) => items.length <= MAX_COMMENT_REPLIES,
        message: `A comment cannot have more than ${MAX_COMMENT_REPLIES} replies.`,
      },
    },

    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dislikeCount: {
      type: Number,
      default: 0,
      min: 0,
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
commentSchema.index({ recipeId: 1, createdAt: -1 });

commentSchema.index({ "replies._id": 1 });

const Comment =
  mongoose.models.Comment || mongoose.model("Comment", commentSchema);

export default Comment;
