import { z } from "zod";

/**
 * Reusable fields
 */

const messageSchema = z
  .string()
  .trim()
  .min(20, "پیام باید حداقل ۲۰ کاراکتر باشد.")
  .max(3000, "پیام نباید بیشتر از ۳۰۰۰ کاراکتر باشد.");

/**
 * Create support ticket
 *
 * userId is obtained from the authenticated user's session.
 * status is system-managed and defaults to OPEN.
 * replies are added by administrators.
 */

export const createSupportTicketSchema = z
  .object({
    message: messageSchema,
  })
  .strict();
