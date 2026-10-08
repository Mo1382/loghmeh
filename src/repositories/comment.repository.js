import Comment from "@/models/Comment";

import { MAX_COMMENT_REPLIES } from "@/constants/enums";

import { applySession } from "@/lib/helpers/apply-session";

/**
 * --------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Validate Reaction counter deltas.
 *
 * At least one counter must change.
 */
function assertValidReactionDeltas(likeDelta, dislikeDelta) {
  if (!Number.isInteger(likeDelta) || !Number.isInteger(dislikeDelta)) {
    throw new Error("Reaction count deltas must be integers.");
  }

  if (likeDelta === 0 && dislikeDelta === 0) {
    throw new Error("At least one reaction count delta must be non-zero.");
  }
}

/**
 * --------------------------------------------------------------------------
 * Read
 * --------------------------------------------------------------------------
 */

/**
 * Find an active top-level Comment by ID.
 */
export function findCommentById(commentId, session) {
  const query = Comment.findOne({
    _id: commentId,
    deletedAt: null,
  });

  return applySession(query, session);
}

/**
 * Find a soft-deleted top-level Comment by ID.
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
 * Find active top-level Comments for a Recipe
 * using cursor-based pagination.
 *
 * Sort:
 * - createdAt DESC
 * - _id DESC
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
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Create a top-level Comment.
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

/**
 * --------------------------------------------------------------------------
 * Reply
 * --------------------------------------------------------------------------
 */

/**
 * Add an admin or Recipe-owner Reply to a Comment.
 *
 * Replies are embedded inside the Comment document.
 *
 * MAX_COMMENT_REPLIES represents the maximum number
 * of ACTIVE replies.
 *
 * The active-reply limit is enforced atomically so
 * concurrent requests cannot exceed the configured limit.
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
              $filter: {
                input: {
                  $ifNull: ["$replies", []],
                },

                as: "reply",

                cond: {
                  $eq: [
                    {
                      $ifNull: ["$$reply.deletedAt", null],
                    },
                    null,
                  ],
                },
              },
            },
          },

          MAX_COMMENT_REPLIES,
        ],
      },
    },

    {
      $push: {
        replies: replyData,
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Reply Delete / Restore
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete an active embedded Reply by ID.
 *
 * The Reply remains embedded so its Reaction documents
 * remain valid and historical data is preserved.
 *
 * Authorization is handled in the Service layer.
 */
export function softDeleteCommentReplyById(
  replyId,
  deletedAt = new Date(),
  session
) {
  const query = Comment.findOneAndUpdate(
    {
      deletedAt: null,

      replies: {
        $elemMatch: {
          _id: replyId,
          deletedAt: null,
        },
      },
    },

    {
      $set: {
        "replies.$.deletedAt": deletedAt,
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

export function restoreCommentReplyById(replyId, session) {
  const query = Comment.findOneAndUpdate(
    {
      /**
       * Parent Comment must still be active.
       */
      deletedAt: null,

      /**
       * Target Reply must currently be soft-deleted.
       */
      replies: {
        $elemMatch: {
          _id: replyId,
          deletedAt: {
            $ne: null,
          },
        },
      },

      /**
       * Atomic active-reply limit.
       *
       * Before restoring the Reply:
       *
       * activeReplyCount < MAX_COMMENT_REPLIES
       *
       * After restore:
       * activeReplyCount + 1 <= MAX_COMMENT_REPLIES
       */
      $expr: {
        $lt: [
          {
            $size: {
              $filter: {
                input: {
                  $ifNull: ["$replies", []],
                },

                as: "reply",

                cond: {
                  $eq: [
                    {
                      $ifNull: ["$$reply.deletedAt", null],
                    },
                    null,
                  ],
                },
              },
            },
          },

          MAX_COMMENT_REPLIES,
        ],
      },
    },

    {
      /**
       * Restore the matched soft-deleted Reply.
       */
      $set: {
        "replies.$.deletedAt": null,
      },
    },

    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Comment Delete / Restore
 * --------------------------------------------------------------------------
 */

/**
 * Soft-delete a top-level Comment.
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Restore a soft-deleted top-level Comment.
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Statistics / Counters
 * --------------------------------------------------------------------------
 */

/**
 * Atomically update a top-level Comment's
 * Reaction counters.
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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Atomically update an active embedded Reply's
 * Reaction counters.
 *
 * commentId identifies the parent Comment.
 * replyId identifies the embedded Reply.
 *
 * Deleted Replies cannot be updated.
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

      replies: {
        $elemMatch: {
          _id: replyId,
          deletedAt: null,
        },
      },

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
      returnDocument: "after",
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * --------------------------------------------------------------------------
 * Reply Lookup
 * --------------------------------------------------------------------------
 */

/**
 * Find the active parent Comment containing an active Reply.
 *
 * Used for public Reply operations and Reaction operations.
 */
export function findCommentByReplyId(replyId, session) {
  const query = Comment.findOne({
    deletedAt: null,

    replies: {
      $elemMatch: {
        _id: replyId,
        deletedAt: null,
      },
    },
  });

  return applySession(query, session);
}

/**
 * Find the active parent Comment containing
 * a soft-deleted Reply.
 *
 * Used for administrative Reply restoration.
 */
export function findDeletedCommentByReplyId(replyId, session) {
  const query = Comment.findOne({
    deletedAt: null,

    replies: {
      $elemMatch: {
        _id: replyId,
        deletedAt: {
          $ne: null,
        },
      },
    },
  });

  return applySession(query, session);
}
