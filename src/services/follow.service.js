import {
  countFollowersByUser,
  countFollowingByUser,
  createFollow as createFollowRepository,
  deleteFollowByFollowerAndFollowing,
  findFollowByFollowerAndFollowing,
  findFollowersByUser,
  findFollowingByUser,
} from "@/repositories/follow.repository";

import { findActiveUserById } from "@/repositories/user.repository";

import { CURSOR_RESOURCES, FOLLOW_LIST_TYPES } from "@/constants/enums";

import { ERROR_CODES } from "@/constants/error-codes";

import { requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import AppError from "@/lib/errors/AppError";

import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";

import { normalizeLimit } from "@/lib/pagination/limit";

import { assertValidObjectId } from "@/lib/validation/object-id";

import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

/**
 * --------------------------------------------------------------------------
 * Constants
 * --------------------------------------------------------------------------
 */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/**
 * --------------------------------------------------------------------------
 * Validation
 * --------------------------------------------------------------------------
 */

/**
 * Ensure that the current user cannot follow themselves.
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
 *
 * Cursor context:
 * - resource: CURSOR_RESOURCES.FOLLOWS
 * - userId: the user whose list is being requested
 * - listType: FOLLOWING or FOLLOWERS
 */
function createNextCursor({ follows, userId, listType }) {
  if (!follows.length) {
    return null;
  }

  const lastFollow = follows[follows.length - 1];

  if (!lastFollow.createdAt || !lastFollow._id) {
    return null;
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.FOLLOWS,
    userId: userId.toString(),
    listType,
    createdAt: lastFollow.createdAt.toISOString(),
    id: lastFollow._id.toString(),
  });
}

/**
 * Validate and normalize a Follow cursor.
 *
 * The cursor must belong to:
 * - the Follow resource
 * - the requested user
 * - the requested list type
 */
function normalizeFollowCursor(payload, expectedUserId, expectedListType) {
  assertCursorResource(payload, CURSOR_RESOURCES.FOLLOWS);

  assertCursorOwner(
    payload,
    "userId",
    expectedUserId,
    "نشانگر صفحه‌بندی متعلق به این کاربر نیست."
  );

  if (payload.listType !== expectedListType) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر صفحه‌بندی با فهرست انتخاب‌شده مطابقت ندارد.",
      { statusCode: 400 }
    );
  }

  return normalizeCreatedAtIdCursor(payload);
}

/**
 * --------------------------------------------------------------------------
 * User mapping
 * --------------------------------------------------------------------------
 */

/**
 * Convert Follow documents into users while preserving
 * the original Follow order.
 *
 * The Follow repository is responsible for joining only
 * ACTIVE, non-deleted users.
 */
function mapFollowsToUsers(follows, listType) {
  return follows
    .map((follow) =>
      listType === FOLLOW_LIST_TYPES.FOLLOWING
        ? follow.followingUser
        : follow.followerUser
    )
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
  const authenticatedUser = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(targetUserId, "target user ID");

  assertNotSelfFollow(authenticatedUser, targetUserId);

  /**
   * Public follow relationships may only target
   * currently active, non-deleted users.
   */
  const targetUser = await findActiveUserById(targetUserId);

  if (!targetUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر هدف پیدا نشد.", {
      statusCode: 404,
    });
  }

  /**
   * This pre-check improves the normal error path.
   * The unique database index remains the final
   * protection against concurrent duplicate requests.
   */
  const existingFollow = await findFollowByFollowerAndFollowing(
    authenticatedUser._id,
    targetUser._id
  );

  if (existingFollow) {
    throw new AppError(
      ERROR_CODES.FOLLOW_ALREADY_EXISTS,
      "شما در حال حاضر این کاربر را دنبال می‌کنید.",
      { statusCode: 409 }
    );
  }

  try {
    return await createFollowRepository({
      followerId: authenticatedUser._id,
      followingId: targetUser._id,
    });
  } catch (error) {
    /**
     * Handle a duplicate-key race against the
     * unique { followerId, followingId } index.
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
  const authenticatedUser = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(targetUserId, "target user ID");

  assertNotSelfFollow(authenticatedUser, targetUserId);

  /**
   * Do not require the target user to remain active here.
   *
   * An existing Follow should still be removable if the
   * target account was later suspended, deactivated, or deleted.
   */
  const existingFollow = await findFollowByFollowerAndFollowing(
    authenticatedUser._id,
    targetUserId
  );

  if (!existingFollow) {
    throw new AppError(
      ERROR_CODES.FOLLOW_NOT_FOUND,
      "رابطه دنبال‌کردن پیدا نشد.",
      { statusCode: 404 }
    );
  }

  const deletedFollow = await deleteFollowByFollowerAndFollowing(
    authenticatedUser._id,
    targetUserId
  );

  if (!deletedFollow) {
    throw new AppError(
      ERROR_CODES.FOLLOW_NOT_FOUND,
      "رابطه دنبال‌کردن حذف نشد.",
      { statusCode: 404 }
    );
  }

  return deletedFollow;
}

/**
 * --------------------------------------------------------------------------
 * Follow status
 * --------------------------------------------------------------------------
 */

/**
 * Check whether the current user follows a target user.
 *
 * The target user must currently be ACTIVE and non-deleted.
 */
export async function isFollowing(currentUser, targetUserId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(targetUserId, "target user ID");

  assertNotSelfFollow(user, targetUserId);

  const targetUser = await findActiveUserById(targetUserId);

  if (!targetUser) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر هدف پیدا نشد.", {
      statusCode: 404,
    });
  }

  const follow = await findFollowByFollowerAndFollowing(
    user._id,
    targetUser._id
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
 *
 * The repository count methods must count only
 * relationships involving ACTIVE, non-deleted users.
 */
export async function getFollowCounts(userId) {
  assertValidObjectId(userId, "user ID");

  /**
   * Public user visibility:
   * ACTIVE + non-deleted.
   */
  const user = await findActiveUserById(userId);

  if (!user) {
    throw new AppError(ERROR_CODES.USER_NOT_FOUND, "کاربر پیدا نشد.", {
      statusCode: 404,
    });
  }

  const [following, followers] = await Promise.all([
    countFollowingByUser(user._id),
    countFollowersByUser(user._id),
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
 *
 * Only ACTIVE, non-deleted users are exposed.
 */
export async function getFollowing({
  userId,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertValidObjectId(userId, "user ID");

  /**
   * Public follow lists are available only for
   * currently active, non-deleted users.
   */
  const user = await findActiveUserById(userId);

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

  let decodedCursor = null;

  if (cursor) {
    decodedCursor = normalizeFollowCursor(
      decodeCursor(cursor),
      user._id,
      FOLLOW_LIST_TYPES.FOLLOWING
    );
  }

  /**
   * Fetch one extra Follow to determine hasMore.
   *
   * The repository filters out inaccessible users
   * before applying the final limit.
   */
  const follows = await findFollowingByUser({
    followerId: user._id,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = follows.length > normalizedLimit;

  const pageFollows = hasMore ? follows.slice(0, normalizedLimit) : follows;

  const items = mapFollowsToUsers(pageFollows, FOLLOW_LIST_TYPES.FOLLOWING);

  const nextCursor = hasMore
    ? createNextCursor({
        follows: pageFollows,
        userId: user._id,
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
 *
 * Only ACTIVE, non-deleted users are exposed.
 */
export async function getFollowers({
  userId,
  cursor = null,
  limit = DEFAULT_LIST_LIMIT,
} = {}) {
  assertValidObjectId(userId, "user ID");

  /**
   * Public follow lists are available only for
   * currently active, non-deleted users.
   */
  const user = await findActiveUserById(userId);

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

  let decodedCursor = null;

  if (cursor) {
    decodedCursor = normalizeFollowCursor(
      decodeCursor(cursor),
      user._id,
      FOLLOW_LIST_TYPES.FOLLOWERS
    );
  }

  /**
   * Fetch one extra Follow to determine hasMore.
   *
   * The repository filters out inaccessible users
   * before applying the final limit.
   */
  const follows = await findFollowersByUser({
    followingId: user._id,
    cursor: decodedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = follows.length > normalizedLimit;

  const pageFollows = hasMore ? follows.slice(0, normalizedLimit) : follows;

  const items = mapFollowsToUsers(pageFollows, FOLLOW_LIST_TYPES.FOLLOWERS);

  const nextCursor = hasMore
    ? createNextCursor({
        follows: pageFollows,
        userId: user._id,
        listType: FOLLOW_LIST_TYPES.FOLLOWERS,
      })
    : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
