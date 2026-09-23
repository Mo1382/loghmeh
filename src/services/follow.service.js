import mongoose from "mongoose";

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
import { assertAuthenticated } from "@/lib/auth/guards";
import { assertValidObjectId } from "@/lib/validation/object-id";
import { normalizeLimit } from "@/lib/pagination/limit";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

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
 * Ensure that a user account is active.
 *
 * Soft-deleted, suspended, and deactivated accounts
 * are not considered active.
 */
function assertActiveUser(user, message = "حساب کاربری فعال نیست.") {
  if (!user || user.accountStatus !== "ACTIVE" || user.deletedAt) {
    throw new AppError(ERROR_CODES.FORBIDDEN, message, { statusCode: 403 });
  }
}

/**
 * Ensure the current user is not following themselves.
 */
function assertNotSelfFollow(currentUser, targetUserId) {
  if (currentUser._id?.toString() === targetUserId.toString()) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "شما نمی‌توانید خودتان را دنبال کنید.",
      { statusCode: 400 }
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * Cursor
 * --------------------------------------------------------------------------
 */

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
      throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
        statusCode: 404,
      });
    }

    const targetUser = await findUserById(targetUserId);

    if (!targetUser) {
      throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر هدف پیدا نشد.", {
        statusCode: 404,
      });
    }

    /**
     * Only active accounts can participate
     * in a new Follow relationship.
     */
    assertActiveUser(currentUserDocument, "حساب کاربری شما فعال نیست.");

    assertActiveUser(targetUser, "حساب کاربری هدف فعال نیست.");

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
        ERROR_CODES.FOLLOW_ALREADY_EXISTS,
        "شما در حال حاضر این کاربر را دنبال می‌کنید.",
        { statusCode: 409 }
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
          ERROR_CODES.FOLLOW_ALREADY_EXISTS,
          "شما در حال حاضر این کاربر را دنبال می‌کنید.",
          { statusCode: 409 }
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
        ERROR_CODES.FOLLOW_NOT_FOUND,
        "رابطه دنبال‌کردن پیدا نشد.",
        { statusCode: 404 }
      );
    }

    const deletedFollow = await deleteFollowByFollowerAndFollowing(
      currentUser._id,
      targetUserId,
      session
    );

    if (!deletedFollow) {
      throw new AppError(
        ERROR_CODES.FOLLOW_NOT_FOUND,
        "رابطه دنبال‌کردن حذف نشد.",
        { statusCode: 404 }
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
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر هدف پیدا نشد.", {
      statusCode: 404,
    });
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

  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "User not found.", {
      statusCode: 404,
    });
  }

  const [following, followers] = await Promise.all([
    countFollowingByUser(userId),
    countFollowersByUser(userId),
  ]);

  return {
    followers,
    following,
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
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  const payload = decodeCursor(cursor);

  if (payload.userId.toString() !== userId.toString()) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی متعلق به این کاربر نیست.",
      { statusCode: 400 }
    );
  }

  if (payload.listType !== FOLLOW_LIST_TYPES.FOLLOWING) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی با فهرست انتخاب‌شده مطابقت ندارد.",
      { statusCode: 400 }
    );
  }

  const decodedCursor = normalizeCreatedAtIdCursor(payload);

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
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  const decodedCursor = cursor
    ? normalizeFollowCursor(
        decodeCursor(cursor),
        userId,
        FOLLOW_LIST_TYPES.FOLLOWERS
      )
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
