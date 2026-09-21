import Reaction from "@/models/Reaction";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a reaction by its ID.
 */
export function findReactionById(reactionId, session) {
  const query = Reaction.findById(reactionId);

  return applySession(query, session);
}

/**
 * Find a user's reaction for a specific comment.
 *
 * Useful for checking whether the user has already
 * reacted to the comment.
 */
export function findReactionByUserAndComment(userId, commentId, session) {
  const query = Reaction.findOne({
    userId,
    commentId,
  });

  return applySession(query, session);
}

/**
 * Create a reaction.
 *
 * userId is obtained from the authenticated user.
 * commentId is obtained from the route/context.
 */
export function createReaction(reactionData, session) {
  if (session) {
    return Reaction.create([reactionData], { session }).then(
      ([reaction]) => reaction
    );
  }

  return Reaction.create(reactionData);
}

/**
 * Update the type of an existing reaction.
 *
 * Useful when a user switches:
 * LIKE -> DISLIKE
 * or
 * DISLIKE -> LIKE
 */
export function updateReactionType(userId, commentId, type, session) {
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
 * Delete a user's reaction from a specific comment.
 */
export function deleteReactionByUserAndComment(userId, commentId, session) {
  const query = Reaction.findOneAndDelete({
    userId,
    commentId,
  });

  return applySession(query, session);
}

/**
 * Delete a reaction by its ID.
 *
 * Authorization must be handled in the Service layer.
 * Prefer deleteReactionByUserAndComment() for normal
 * user operations.
 */
export function deleteReactionById(reactionId, session) {
  const query = Reaction.findByIdAndDelete(reactionId);

  return applySession(query, session);
}

/**
 * Calculate reaction counts for a comment.
 *
 * Returns:
 * {
 *   likeCount,
 *   dislikeCount
 * }
 *
 * The Service layer can use these values to update
 * the denormalized Comment fields.
 */
export function calculateCommentReactionStats(commentId, session) {
  const query = Reaction.aggregate([
    {
      $match: {
        commentId,
      },
    },
    {
      $group: {
        _id: null,
        likeCount: {
          $sum: {
            $cond: [{ $eq: ["$type", "LIKE"] }, 1, 0],
          },
        },
        dislikeCount: {
          $sum: {
            $cond: [{ $eq: ["$type", "DISLIKE"] }, 1, 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        likeCount: 1,
        dislikeCount: 1,
      },
    },
  ]);

  return applySession(query, session);
}
