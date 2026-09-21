import Comment from "@/models/Comment";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Allowed comment statistics that can be updated using $inc.
 *
 * Using a fixed list prevents arbitrary fields from being
 * modified through the generic comment-stat update function.
 */
export const COMMENT_STATS = {
  LIKE_COUNT: "likeCount",
  DISLIKE_COUNT: "dislikeCount",
};

/**
 * Find a comment by its ID.
 */
export function findCommentById(commentId, session) {
  const query = Comment.findOne({
    _id: commentId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a soft-deleted comment by ID.
 *
 * Used by the Admin Panel when restoring a comment.
 */
export function findDeletedCommentById(commentId, session) {
  const query = Comment.findOne({
    _id: commentId,
    deletedAt: {
      $ne: null,
    },
  });

  return applySession(query, session);
}

/**
 * Find a comment by its ID and author.
 *
 * Useful for operations that belong specifically
 * to the comment author.
 */
export function findCommentByIdAndAuthor(commentId, authorId, session) {
  const query = Comment.findOne({
    _id: commentId,
    authorId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find comments for a specific recipe using
 * cursor-based loading.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 *
 * Cursor structure:
 * {
 *   createdAt: Date,
 *   id: ObjectId
 * }
 */
export function findCommentsByRecipe({
  recipeId,
  cursor = null,
  limit = 16,
  session,
}) {
  const filter = {
    recipeId,
    deletedAt: null,
  };

  if (cursor) {
    filter.$or = [
      {
        createdAt: {
          $lt: cursor.createdAt,
        },
      },
      {
        createdAt: cursor.createdAt,
        _id: {
          $lt: cursor.id,
        },
      },
    ];
  }

  const query = Comment.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Create a comment.
 *
 * authorId is obtained from the authenticated user.
 * recipeId is obtained from the route/context.
 */
export function createComment(commentData, session) {
  if (session) {
    return Comment.create([commentData], { session }).then(
      ([comment]) => comment
    );
  }

  return Comment.create(commentData);
}

/**
 * Add an admin or recipe-owner reply to a comment.
 *
 * Replies are embedded inside the comment document.
 */
export function addCommentReply(commentId, replyData, session) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
    },
    {
      $push: {
        replies: replyData,
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
 * Soft-delete a comment.
 *
 * Authorization belongs to the Service layer.
 */
export function softDeleteComment(commentId, deletedAt = new Date(), session) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
    },
    {
      $set: {
        deletedAt,
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
 * Restore a soft-deleted comment.
 */
export function restoreComment(commentId, session) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: {
        $ne: null,
      },
    },
    {
      $set: {
        deletedAt: null,
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
 * Increment a comment's reaction statistic.
 */
export function incrementCommentStat(commentId, stat, amount = 1, session) {
  if (!Object.values(COMMENT_STATS).includes(stat)) {
    throw new Error("Invalid comment stat.");
  }

  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
    },
    {
      $inc: {
        [stat]: amount,
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
 * Increment a comment's like count.
 */
export function incrementLikeCount(commentId, amount = 1, session) {
  return incrementCommentStat(
    commentId,
    COMMENT_STATS.LIKE_COUNT,
    amount,
    session
  );
}

/**
 * Increment a comment's dislike count.
 */
export function incrementDislikeCount(commentId, amount = 1, session) {
  return incrementCommentStat(
    commentId,
    COMMENT_STATS.DISLIKE_COUNT,
    amount,
    session
  );
}

/**
 * Update a comment's reaction statistics.
 *
 * Used when recalculating denormalized reaction counts
 * from the Reaction collection.
 */
export function updateReactionCounts(
  commentId,
  likeCount,
  dislikeCount,
  session
) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
    },
    {
      $set: {
        likeCount,
        dislikeCount,
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
 * Find an active comment containing a specific reply.
 *
 * The Service layer uses the returned comment to:
 * - identify the reply author
 * - perform authorization
 * - retrieve the reply before deletion
 */
export function findCommentByReplyId(replyId, session) {
  const query = Comment.findOne({
    "replies._id": replyId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Delete an embedded reply by its ID.
 *
 * Authorization is intentionally handled by the Service layer.
 */
export function deleteCommentReplyById(replyId, session) {
  const query = Comment.findOneAndUpdate(
    {
      "replies._id": replyId,
      deletedAt: null,
    },
    {
      $pull: {
        replies: {
          _id: replyId,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}
