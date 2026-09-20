import mongoose from "mongoose";
import crypto from "node:crypto";

import {
  countFollowersByUser,
  countFollowingByUser,
  createFollow as createFollowRepository,
  deleteFollowByFollowerAndFollowing,
  findFollowByFollowerAndFollowing,
  findFollowersByUser,
  findFollowingByUser,
} from "@/repositories/follow.repository";

import {
  findActiveUsersByIds,
  findUserById,
  incrementFollowerCount,
  incrementFollowingCount,
} from "@/repositories/user.repository";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import { withTransaction } from "@/lib/transaction";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

const CURSOR_VERSION = 1;

const FOLLOW_LIST_TYPES = {
  FOLLOWING: "FOLLOWING",
  FOLLOWERS: "FOLLOWERS",
};

/**
 * --------------------------------------------------------------------------
 * Authentication / Validation
 * --------------------------------------------------------------------------
 */

/**
 * Ensure the current user is authenticated.
 */
function assertAuthenticated(currentUser) {
  if (!currentUser) {
    throw new AppError(
      "Authentication is required.",
      ERROR_CODES.UNAUTHORIZED,
      401
    );
  }
}

/**
 * Ensure the provided ID is a valid MongoDB ObjectId.
 */
function assertValidObjectId(id, fieldName = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      `Invalid ${fieldName}.`,
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }
}

/**
 * Ensure that a user account is active.
 *
 * Soft-deleted, suspended, and deactivated accounts
 * are not considered active.
 */
function assertActiveUser(user, message = "User account is not active.") {
  if (!user || user.accountStatus !== "ACTIVE" || user.deletedAt) {
    throw new AppError(message, ERROR_CODES.FORBIDDEN, 403);
  }
}

/**
 * Ensure the current user is not following themselves.
 */
function assertNotSelfFollow(currentUser, targetUserId) {
  if (currentUser._id?.toString() === targetUserId.toString()) {
    throw new AppError(
      "You cannot follow yourself.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }
}

/**
 * Normalize the requested list size.
 */
function normalizeLimit(limit, defaultLimit = DEFAULT_LIST_LIMIT) {
  const parsedLimit = Number(limit);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return defaultLimit;
  }

  return Math.min(parsedLimit, MAX_LIST_LIMIT);
}

/**
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

/**
 * Get the secret used to sign Follow cursors.
 */
function getCursorSecret() {
  const secret = process.env.CURSOR_SECRET;

  if (!secret) {
    throw new Error("CURSOR_SECRET is not configured.");
  }

  return secret;
}

/**
 * Encode a cursor for a Followers/Following list.
 *
 * The cursor is bound to:
 * - the user whose list is being viewed
 * - the list direction
 * - the pagination position
 */
function encodeCursor({ userId, listType, createdAt, id }) {
  const payload = {
    v: CURSOR_VERSION,
    userId: userId.toString(),
    listType,
    createdAt,
    id: id.toString(),
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );

  const signature = crypto
    .createHmac("sha256", getCursorSecret())
    .update(payloadBase64)
    .digest("base64url");

  return `${payloadBase64}.${signature}`;
}

/**
 * Decode and verify a Followers/Following cursor.
 */
function decodeCursor(cursor, expectedUserId, expectedListType) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  const [payloadBase64, signatureBase64] = parts;

  let expectedSignature;
  let providedSignature;

  try {
    expectedSignature = crypto
      .createHmac("sha256", getCursorSecret())
      .update(payloadBase64)
      .digest();

    providedSignature = Buffer.from(signatureBase64, "base64url");
  } catch {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(providedSignature, expectedSignature)
  ) {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  let payload;

  try {
    const json = Buffer.from(payloadBase64, "base64url").toString("utf8");

    payload = JSON.parse(json);
  } catch {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  if (
    !payload ||
    payload.v !== CURSOR_VERSION ||
    !payload.userId ||
    !payload.listType ||
    !payload.createdAt ||
    !payload.id
  ) {
    throw new AppError("Invalid cursor.", ERROR_CODES.INVALID_REQUEST, 400);
  }

  assertValidObjectId(payload.userId, "cursor user ID");

  assertValidObjectId(payload.id, "cursor ID");

  if (payload.userId.toString() !== expectedUserId.toString()) {
    throw new AppError(
      "Cursor does not belong to this user.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  if (payload.listType !== expectedListType) {
    throw new AppError(
      "Cursor does not match the selected list.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  const createdAt = new Date(payload.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new AppError(
      "Invalid cursor date.",
      ERROR_CODES.INVALID_REQUEST,
      400
    );
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(payload.id),
  };
}

/**
 * Create the next cursor from the last Follow
 * included in the current page.
 */
function createNextCursor({ follows, userId, listType }) {
  if (!follows.length) {
    return null;
  }

  const lastFollow = follows[follows.length - 1];

  if (!lastFollow.createdAt) {
    return null;
  }

  return encodeCursor({
    userId,
    listType,
    createdAt: lastFollow.createdAt.toISOString(),
    id: lastFollow._id,
  });
}

/**
 * --------------------------------------------------------------------------
 * User mapping
 * --------------------------------------------------------------------------
 */

/**
 * Convert Follow documents into active User documents
 * while preserving the original Follow order.
 *
 * For:
 * - FOLLOWING -> use followingId
 * - FOLLOWERS -> use followerId
 *
 * Suspended, deactivated, and soft-deleted users
 * are excluded from the result.
 */
async function mapFollowsToUsers(follows, listType) {
  if (!follows.length) {
    return [];
  }

  const userIds = follows.map((follow) =>
    listType === FOLLOW_LIST_TYPES.FOLLOWING
      ? follow.followingId
      : follow.followerId
  );

  const users = await findActiveUsersByIds(userIds);

  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  return follows
    .map((follow) => {
      const userId =
        listType === FOLLOW_LIST_TYPES.FOLLOWING
          ? follow.followingId
          : follow.followerId;

      return usersById.get(userId.toString());
    })
    .filter(Boolean);
}

/**
 * --------------------------------------------------------------------------
 * Create
 * --------------------------------------------------------------------------
 */

/**
 * Follow another user.
 */
export async function createFollow(currentUser, targetUserId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(targetUserId, "target user ID");

  assertNotSelfFollow(currentUser, targetUserId);

  return withTransaction(async (session) => {
    const currentUser = await findUserById(currentUser._id);

    if (!currentUser) {
      throw new AppError("User not found.", ERROR_CODES.USER_NOT_FOUND, 404);
    }

    const targetUser = await findUserById(targetUserId);

    if (!targetUser) {
      throw new AppError(
        "Target user not found.",
        ERROR_CODES.USER_NOT_FOUND,
        404
      );
    }

    /**
     * Only active accounts can participate
     * in a new Follow relationship.
     */
    assertActiveUser(currentUserDocument, "Your account is not active.");

    assertActiveUser(targetUser, "The target user account is not active.");

    /**
     * Check whether the relationship already exists.
     */
    const existingFollow = await findFollowByFollowerAndFollowing(
      currentUserDocument._id,
      targetUser._id,
      session
    );

    if (existingFollow) {
      throw new AppError(
        "You are already following this user.",
        ERROR_CODES.FOLLOW_ALREADY_EXISTS,
        409
      );
    }

    let follow;

    try {
      follow = await createFollowRepository(
        {
          followerId: currentUserDocument._id,
          followingId: targetUser._id,
        },
        session
      );
    } catch (error) {
      /**
       * The unique follower/following index
       * is the final protection against duplicates.
       */
      if (error?.code === 11000) {
        throw new AppError(
          "You are already following this user.",
          ERROR_CODES.FOLLOW_ALREADY_EXISTS,
          409
        );
      }

      throw error;
    }

    /**
     * Update both denormalized user counters
     * inside the same transaction.
     */
    await incrementFollowingCount(currentUserDocument._id, 1, session);

    await incrementFollowerCount(targetUser._id, 1, session);

    return follow;
  });
}

/**
 * --------------------------------------------------------------------------
 * Delete
 * --------------------------------------------------------------------------
 */

/**
 * Unfollow another user.
 *
 * A user can only remove a relationship where
 * they are the follower.
 */
export async function deleteFollow(currentUser, targetUserId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(targetUserId, "target user ID");

  assertNotSelfFollow(currentUser, targetUserId);

  return withTransaction(async (session) => {
    const existingFollow = await findFollowByFollowerAndFollowing(
      currentUser._id,
      targetUserId,
      session
    );

    if (!existingFollow) {
      throw new AppError(
        "Follow relationship not found.",
        ERROR_CODES.FOLLOW_NOT_FOUND,
        404
      );
    }

    const deletedFollow = await deleteFollowByFollowerAndFollowing(
      currentUser._id,
      targetUserId,
      session
    );

    if (!deletedFollow) {
      throw new AppError(
        "Follow relationship could not be deleted.",
        ERROR_CODES.FOLLOW_NOT_FOUND,
        404
      );
    }

    /**
     * Update both denormalized counters.
     */
    await incrementFollowingCount(currentUser._id, -1, session);

    await incrementFollowerCount(targetUserId, -1, session);

    return deletedFollow;
  });
}

/**
 * --------------------------------------------------------------------------
 * Follow status
 * --------------------------------------------------------------------------
 */

/**
 * Check whether the current user follows a target user.
 */
export async function isFollowing(currentUser, targetUserId) {
  assertAuthenticated(currentUser);

  assertValidObjectId(targetUserId, "target user ID");

  assertNotSelfFollow(currentUser, targetUserId);

  /**
   * The target account must exist and must not
   * be soft-deleted.
   */
  const targetUser = await findUserById(targetUserId);

  if (!targetUser) {
    throw new AppError(
      "Target user not found.",
      ERROR_CODES.USER_NOT_FOUND,
      404
    );
  }

  const follow = await findFollowByFollowerAndFollowing(
    currentUser._id,
    targetUserId
  );

  return Boolean(follow);
}

/**
 * --------------------------------------------------------------------------
 * Counts
 * --------------------------------------------------------------------------
 */

/**
 * Get the number of users a specific user follows
 * and the number of their followers.
 */
export async function getFollowCounts(userId) {
  assertValidObjectId(userId, "user ID");

  /**
   * Make sure the user exists and is not soft-deleted.
   */
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError("User not found.", ERROR_CODES.USER_NOT_FOUND, 404);
  }

  const [followingCount, followerCount] = await Promise.all([
    countFollowingByUser(userId),
    countFollowersByUser(userId),
  ]);

  return {
    followingCount,
    followerCount,
  };
}

/**
 * --------------------------------------------------------------------------
 * Following list
 * --------------------------------------------------------------------------
 */

/**
 * Get the users followed by a specific user.
 *
 * Uses cursor-based pagination.
 */
export async function getFollowing({
  userId,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertValidObjectId(userId, "user ID");

  /**
   * Make sure the requested user exists
   * and is not soft-deleted.
   */

  const user = await findUserById(userId);

  if (!user) {
    throw new AppError("User not found.", ERROR_CODES.USER_NOT_FOUND, 404);
  }

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor = cursor
    ? decodeCursor(cursor, userId, FOLLOW_LIST_TYPES.FOLLOWING)
    : null;

  /**
   * Fetch one extra Follow to determine hasMore.
   */
  const follows = await findFollowingByUser({
    followerId: userId,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = follows.length > normalizedLimit;

  const pageFollows = hasMore ? follows.slice(0, normalizedLimit) : follows;

  const items = await mapFollowsToUsers(
    pageFollows,
    FOLLOW_LIST_TYPES.FOLLOWING
  );

  const nextCursor = hasMore
    ? createNextCursor({
        follows: pageFollows,
        userId,
        listType: FOLLOW_LIST_TYPES.FOLLOWING,
      })
    : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * --------------------------------------------------------------------------
 * Followers list
 * --------------------------------------------------------------------------
 */

/**
 * Get the users who follow a specific user.
 *
 * Uses cursor-based pagination.
 */
export async function getFollowers({
  userId,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertValidObjectId(userId, "user ID");

  /**
   * Make sure the requested user exists
   * and is not soft-deleted.
   */

  const user = await findUserById(userId);

  if (!user) {
    throw new AppError("User not found.", ERROR_CODES.USER_NOT_FOUND, 404);
  }

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor = cursor
    ? decodeCursor(cursor, userId, FOLLOW_LIST_TYPES.FOLLOWERS)
    : null;

  /**
   * Fetch one extra Follow to determine hasMore.
   */
  const follows = await findFollowersByUser({
    followingId: userId,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = follows.length > normalizedLimit;

  const pageFollows = hasMore ? follows.slice(0, normalizedLimit) : follows;

  const items = await mapFollowsToUsers(
    pageFollows,
    FOLLOW_LIST_TYPES.FOLLOWERS
  );

  const nextCursor = hasMore
    ? createNextCursor({
        follows: pageFollows,
        userId,
        listType: FOLLOW_LIST_TYPES.FOLLOWERS,
      })
    : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
