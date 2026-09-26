import Comment from "@/models/Comment";

import { COMMENT_STATS } from "@/constants/enums";

import { COMMENT_LIMITS } from "@/constants/comment";

import { applySession } from "@/lib/helpers/apply-session";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function assertValidReactionDeltas(likeDelta, dislikeDelta) {
  if (!Number.isInteger(likeDelta) || !Number.isInteger(dislikeDelta)) {
    throw new Error("Reaction count deltas must be integers.");
  }

  if (likeDelta === 0 && dislikeDelta === 0) {
    throw new Error("At least one reaction count delta must be non-zero.");
  }
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Find an active comment by its ID.
 */
export function findCommentById(commentId, session) {
  const query = Comment.findOne({
    _id: commentId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a soft-deleted comment by its ID.
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
 * Find comments for a specific recipe using
 * cursor-based pagination.
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
 * Find an active comment containing a specific reply.
 */
export function findCommentByReplyId(replyId, session) {
  const query = Comment.findOne({
    "replies._id": replyId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Create a comment.
 *
 * authorId and recipeId are supplied by the Service layer.
 */
export function createComment(commentData, session) {
  if (session) {
    return Comment.create([commentData], { session }).then(
      ([comment]) => comment
    );
  }

  return Comment.create(commentData);
}

/* -------------------------------------------------------------------------- */
/* Reply                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Add an admin or recipe-owner reply to a comment.
 *
 * Replies are embedded inside the Comment document.
 *
 * The maximum number of replies is enforced atomically
 * so concurrent requests cannot exceed the configured limit.
 *
 * Authorization is handled in the Service layer.
 */
export function addCommentReply(commentId, replyData, session) {
  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
      $expr: {
        $lt: [
          {
            $size: {
              $ifNull: ["$replies", []],
            },
          },
          COMMENT_LIMITS.MAX_REPLIES,
        ],
      },
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
 * Delete an embedded reply by its ID.
 *
 * Authorization is handled in the Service layer.
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

/* -------------------------------------------------------------------------- */
/* Delete / Restore                                                           */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Statistics / Counters                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Atomically update a top-level Comment's
 * reaction counters.
 *
 * Used by normal Reaction mutations.
 */
export function updateReactionCountDeltas(
  commentId,
  likeDelta,
  dislikeDelta,
  session
) {
  assertValidReactionDeltas(likeDelta, dislikeDelta);

  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
      $expr: {
        $and: [
          {
            $gte: [
              {
                $add: [
                  {
                    $ifNull: ["$likeCount", 0],
                  },
                  likeDelta,
                ],
              },
              0,
            ],
          },
          {
            $gte: [
              {
                $add: [
                  {
                    $ifNull: ["$dislikeCount", 0],
                  },
                  dislikeDelta,
                ],
              },
              0,
            ],
          },
        ],
      },
    },
    {
      $inc: {
        likeCount: likeDelta,
        dislikeCount: dislikeDelta,
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
 * Atomically update an embedded Reply's
 * reaction counters.
 *
 * commentId identifies the parent Comment.
 * replyId identifies the embedded Reply.
 */
export function updateReplyReactionCountDeltas(
  commentId,
  replyId,
  likeDelta,
  dislikeDelta,
  session
) {
  assertValidReactionDeltas(likeDelta, dislikeDelta);

  const query = Comment.findOneAndUpdate(
    {
      _id: commentId,
      deletedAt: null,
      "replies._id": replyId,
      $expr: {
        $and: [
          {
            $gte: [
              {
                $add: [
                  {
                    $ifNull: [
                      {
                        $getField: {
                          field: "likeCount",
                          input: {
                            $arrayElemAt: [
                              "$replies",
                              {
                                $indexOfArray: ["$replies._id", replyId],
                              },
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                  likeDelta,
                ],
              },
              0,
            ],
          },
          {
            $gte: [
              {
                $add: [
                  {
                    $ifNull: [
                      {
                        $getField: {
                          field: "dislikeCount",
                          input: {
                            $arrayElemAt: [
                              "$replies",
                              {
                                $indexOfArray: ["$replies._id", replyId],
                              },
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                  dislikeDelta,
                ],
              },
              0,
            ],
          },
        ],
      },
    },
    {
      $inc: {
        "replies.$.likeCount": likeDelta,
        "replies.$.dislikeCount": dislikeDelta,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}
