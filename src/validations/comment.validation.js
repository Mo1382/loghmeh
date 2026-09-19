import { z } from "zod";

/**
 * Reusable fields
 */

const commentTextSchema = z
  .string()
  .trim()
  .min(1, "دیدگاه نمی‌تواند خالی باشد.")
  .max(1000, "دیدگاه نباید بیشتر از ۱۰۰۰ کاراکتر باشد.");

const replyTextSchema = z
  .string()
  .trim()
  .min(1, "پاسخ نمی‌تواند خالی باشد.")
  .max(1000, "پاسخ نباید بیشتر از ۱۰۰۰ کاراکتر باشد.");

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
