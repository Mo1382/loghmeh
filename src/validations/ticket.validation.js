import { z } from "zod";

/**
 * Reusable fields
 */

const messageSchema = z
  .string()
  .trim()
  .min(20, "Message must be at least 20 characters.")
  .max(3000, "Message must not exceed 3000 characters.");

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
