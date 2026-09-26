import Reaction from "@/models/Reaction";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Ensure that a reaction targets exactly one resource.
 *
 * Comment reaction:
 *   commentId = ObjectId
 *   replyId   = null
 *
 * Reply reaction:
 *   commentId = null
 *   replyId   = ObjectId
 */
function assertSingleReactionTarget({ commentId, replyId }) {
  const hasComment = commentId != null;
  const hasReply = replyId != null;

  if (hasComment === hasReply) {
    throw new Error("A reaction must target exactly one comment or reply.");
  }
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Find a user's reaction for a top-level comment.
 */
export function findReactionByUserAndComment(userId, commentId, session) {
  const query = Reaction.findOne({
    userId,
    commentId,
  });

  return applySession(query, session);
}

/**
 * Find a user's reaction for an embedded reply.
 */
export function findReactionByUserAndReply(userId, replyId, session) {
  const query = Reaction.findOne({
    userId,
    replyId,
  });

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a reaction.
 *
 * Exactly one of commentId or replyId must be provided.
 *
 * Duplicate reactions are prevented by the corresponding
 * unique partial index on the Reaction model.
 */
export function createReaction(reactionData, session) {
  assertSingleReactionTarget(reactionData);

  if (session) {
    return Reaction.create([reactionData], { session }).then(
      ([reaction]) => reaction
    );
  }

  return Reaction.create(reactionData);
}

/**
 * --------------------------------------------------------------------------
 * Update
 * --------------------------------------------------------------------------
 */

/**
 * Update the type of a reaction belonging to a top-level comment.
 */
export function updateReactionTypeByComment(userId, commentId, type, session) {
  const query = Reaction.findOneAndUpdate(
    {
      userId,
      commentId,
    },
    {
      $set: {
        type,
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
 * Update the type of a reaction belonging to an embedded reply.
 */
export function updateReactionTypeByReply(userId, replyId, type, session) {
  const query = Reaction.findOneAndUpdate(
    {
      userId,
      replyId,
    },
    {
      $set: {
        type,
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
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Delete a user's reaction from a top-level comment.
 */
export function deleteReactionByUserAndComment(userId, commentId, session) {
  const query = Reaction.findOneAndDelete({
    userId,
    commentId,
  });

  return applySession(query, session);
}

/**
 * Delete a user's reaction from an embedded reply.
 */
export function deleteReactionByUserAndReply(userId, replyId, session) {
  const query = Reaction.findOneAndDelete({
    userId,
    replyId,
  });

  return applySession(query, session);
}
