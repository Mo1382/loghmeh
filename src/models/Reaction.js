import mongoose from "mongoose";

import { REACTION_TYPES } from "@/constants/enums";

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Set only when the Reaction belongs to a top-level Comment.
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    // Set only when the Reaction belongs to an embedded Reply.
    // Reply is not a separate Mongoose model, so no ref is used.
    replyId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every Reaction must target exactly one resource:
 *
 * Comment:
 *   commentId = ObjectId
 *   replyId   = null
 *
 * Reply:
 *   commentId = null
 *   replyId   = ObjectId
 */
reactionSchema.pre("validate", function (next) {
  const hasComment = this.commentId != null;
  const hasReply = this.replyId != null;

  if (hasComment === hasReply) {
    const message = "A reaction must target exactly one comment or reply.";

    this.invalidate("commentId", message);
    this.invalidate("replyId", message);
  }

  next();
});

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One reaction per user for each top-level comment.
 */
reactionSchema.index(
  { userId: 1, commentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      commentId: {
        $type: "objectId",
      },
    },
  }
);

/**
 * One reaction per user for each embedded reply.
 */
reactionSchema.index(
  { userId: 1, replyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      replyId: {
        $type: "objectId",
      },
    },
  }
);

/**
 * Efficient aggregation/filtering of reactions for comments.
 */
reactionSchema.index({
  commentId: 1,
  type: 1,
});

/**
 * Efficient aggregation/filtering of reactions for replies.
 */
reactionSchema.index({
  replyId: 1,
  type: 1,
});

const Reaction =
  mongoose.models.Reaction || mongoose.model("Reaction", reactionSchema);

export default Reaction;
