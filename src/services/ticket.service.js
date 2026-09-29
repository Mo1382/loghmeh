import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, requireActiveAuthenticatedUser } from "@/lib/auth/guards";

import { assertValidObjectId } from "@/lib/validation/object-id";

import {
  decodeCursor,
  encodeCursor,
  normalizeCreatedAtIdCursor,
} from "@/lib/pagination/cursor";

import {
  assertCursorOwner,
  assertCursorResource,
} from "@/lib/pagination/cursor-context";

import { CURSOR_RESOURCES, TICKET_STATUSES } from "@/constants/enums";

import { normalizeLimit } from "@/lib/pagination/limit";

import {
  createTicket as createTicketRepository,
  findTicketById,
  findTicketByIdAndUser,
  findTicketsByUser,
} from "@/repositories/ticket.repository";

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
 * Normalize and validate a support-ticket message.
 *
 * The input validation layer should enforce the same contract.
 * This check is retained at the Service boundary as a defense
 * against incorrect internal callers.
 */
function normalizeMessage(message) {
  if (typeof message !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_MESSAGE,
      "متن پیام الزامی است.",
      { statusCode: 400 }
    );
  }

  const normalizedMessage = message.trim();

  if (!normalizedMessage) {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_MESSAGE,
      "متن پیام نمی‌تواند خالی باشد.",
      { statusCode: 400 }
    );
  }

  if (normalizedMessage.length < 20) {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_MESSAGE,
      "متن پیام باید حداقل ۲۰ کاراکتر داشته باشد.",
      { statusCode: 400 }
    );
  }

  if (normalizedMessage.length > 3000) {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_MESSAGE,
      "متن پیام نمی‌تواند بیشتر از ۳۰۰۰ کاراکتر باشد.",
      { statusCode: 400 }
    );
  }

  return normalizedMessage;
}

/**
 * --------------------------------------------------------------------------
 * Cursor Helpers
 * --------------------------------------------------------------------------
 */

/**
 * Create the next cursor from the last Ticket
 * in the current page.
 */
function createNextCursor(ticket, userId) {
  if (!ticket?.createdAt || !ticket?._id) {
    return null;
  }

  return encodeCursor({
    resource: CURSOR_RESOURCES.SUPPORT_TICKETS,
    userId: userId.toString(),
    createdAt: ticket.createdAt.toISOString(),
    id: ticket._id.toString(),
  });
}

/**
 * --------------------------------------------------------------------------
 * Get Ticket
 * --------------------------------------------------------------------------
 */

/**
 * Get a Ticket belonging to the current user.
 *
 * Ownership is enforced by the repository query.
 */
export async function getTicketById(currentUser, ticketId) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  assertValidObjectId(ticketId, "ticket ID");

  const ticket = await findTicketByIdAndUser(ticketId, user._id);

  if (!ticket) {
    throw new AppError(
      ERROR_CODES.TICKET_NOT_FOUND,
      "تیکت پشتیبانی پیدا نشد.",
      { statusCode: 404 }
    );
  }

  return ticket;
}

/**
 * Get any Ticket for the Admin Panel.
 *
 * The current account must be ACTIVE and have
 * administrator privileges.
 */
export async function getTicketByIdForAdmin(currentUser, ticketId) {
  await assertAdmin(currentUser);

  assertValidObjectId(ticketId, "ticket ID");

  const ticket = await findTicketById(ticketId);

  if (!ticket) {
    throw new AppError(
      ERROR_CODES.TICKET_NOT_FOUND,
      "تیکت پشتیبانی پیدا نشد.",
      { statusCode: 404 }
    );
  }

  return ticket;
}

/**
 * --------------------------------------------------------------------------
 * Get User Tickets
 * --------------------------------------------------------------------------
 */

/**
 * Get the current user's support tickets
 * using cursor-based pagination.
 */
export async function getUserTickets(
  currentUser,
  { cursor = null, limit = DEFAULT_LIST_LIMIT } = {}
) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let normalizedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, CURSOR_RESOURCES.SUPPORT_TICKETS);

    assertCursorOwner(
      payload,
      "userId",
      user._id,
      "نشانگر تیکت پشتیبانی متعلق به این کاربر نیست."
    );

    normalizedCursor = normalizeCreatedAtIdCursor(payload);
  }

  /**
   * Fetch one extra Ticket to determine
   * whether another page exists.
   */
  const tickets = await findTicketsByUser({
    userId: user._id,
    cursor: normalizedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = tickets.length > normalizedLimit;

  const pageTickets = hasMore ? tickets.slice(0, normalizedLimit) : tickets;

  const lastTicket = pageTickets[pageTickets.length - 1];

  const nextCursor = hasMore ? createNextCursor(lastTicket, user._id) : null;

  return {
    tickets: pageTickets,
    nextCursor,
    hasMore,
  };
}

/**
 * --------------------------------------------------------------------------
 * Create Ticket
 * --------------------------------------------------------------------------
 */

/**
 * Create a new support Ticket for the current user.
 *
 * The initial status and system-managed fields are
 * controlled by the Service and cannot be supplied
 * by the caller.
 */
export async function createTicket(currentUser, message) {
  const user = await requireActiveAuthenticatedUser(currentUser);

  const normalizedMessage = normalizeMessage(message);

  return createTicketRepository({
    userId: user._id,
    message: normalizedMessage,

    /**
     * System-managed initial state.
     */
    status: TICKET_STATUSES.OPEN,
    replies: [],
    closedAt: null,
  });
}
