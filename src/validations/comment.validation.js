import { z } from "zod";

/**
 * Reusable fields
 */

const commentTextSchema = z
  .string()
  .trim()
  .min(1, "Comment cannot be empty.")
  .max(1000, "Comment must not exceed 1000 characters.");

const replyTextSchema = z
  .string()
  .trim()
  .min(1, "Reply cannot be empty.")
  .max(1000, "Reply must not exceed 1000 characters.");

/**
 * Create comment
 *
 * authorId is obtained from the authenticated user.
 * recipeId is obtained from the route/context.
 */

export const createCommentSchema = z
  .object({
    text: commentTextSchema,
  })
  .strict();

/**
 * Create admin/recipe-owner reply
 *
 * authorId is obtained from the authenticated user.
 * commentId is obtained from the route/context.
 *
 * Authorization is handled in the Service:
 * - ADMIN
 * - Recipe owner
 */

export const createCommentReplySchema = z
  .object({
    text: replyTextSchema,
  })
  .strict();
