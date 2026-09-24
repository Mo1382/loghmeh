import AppError from "@/lib/errors/AppError";

import { ERROR_CODES } from "@/constants/error-codes";

import { assertAdmin, assertAuthenticated } from "@/lib/auth/guards";

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

import { TICKET_STATUSES } from "@/constants/enums";

import { normalizeLimit } from "@/lib/pagination/limit";

import {
  createTicket as createTicketRepository,
  findTicketById,
  findTicketByIdAndUser,
  findTicketsByUser,
} from "@/repositories/ticket.repository";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Cursor Helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Create the next cursor from the last ticket in the current page.
 */
function createNextCursor(ticket, userId) {
  if (!ticket || !ticket.createdAt || !ticket._id) {
    return null;
  }

  return encodeCursor({
    resource: "SUPPORT_TICKETS",
    userId: userId.toString(),
    createdAt: ticket.createdAt.toISOString(),
    id: ticket._id.toString(),
  });
}

/* -------------------------------------------------------------------------- */
/* Get Ticket                                                                 */
/* -------------------------------------------------------------------------- */

export async function getTicketById(currentUser, ticketId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(ticketId, "ticket ID");

  const ticket = await findTicketByIdAndUser(ticketId, currentUser._id);

  if (!ticket) {
    throw new AppError(
      ERROR_CODES.TICKET_NOT_FOUND,
      "تیکت پشتیبانی پیدا نشد.",
      { statusCode: 404 }
    );
  }

  return ticket;
}

export async function getTicketByIdForAdmin(currentUser, ticketId) {
  assertAdmin(currentUser);
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

/* -------------------------------------------------------------------------- */
/* Get User Tickets                                                           */
/* -------------------------------------------------------------------------- */

export async function getUserTickets(
  currentUser,
  { cursor = null, limit = DEFAULT_LIST_LIMIT } = {}
) {
  assertAuthenticated(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  let normalizedCursor = null;

  if (cursor) {
    const payload = decodeCursor(cursor);

    assertCursorResource(payload, "SUPPORT_TICKETS");

    assertCursorOwner(
      payload,
      "userId",
      currentUser._id,
      "نشانگر تیکت پشتیبانی متعلق به این کاربر نیست."
    );

    normalizedCursor = normalizeCreatedAtIdCursor(payload);
  }

  const tickets = await findTicketsByUser({
    userId: currentUser._id,
    cursor: normalizedCursor,
    limit: normalizedLimit + 1,
  });

  const hasMore = tickets.length > normalizedLimit;

  const pageTickets = hasMore ? tickets.slice(0, normalizedLimit) : tickets;

  const lastTicket = pageTickets[pageTickets.length - 1];

  const nextCursor = hasMore
    ? createNextCursor(lastTicket, currentUser._id)
    : null;

  return {
    tickets: pageTickets,
    nextCursor,
    hasMore,
  };
}

/* -------------------------------------------------------------------------- */
/* Create Ticket                                                              */
/* -------------------------------------------------------------------------- */

export async function createTicket(currentUser, message) {
  assertAuthenticated(currentUser);

  const normalizedMessage = normalizeMessage(message);

  return createTicketRepository({
    userId: currentUser._id,
    message: normalizedMessage,
    status: TICKET_STATUSES.OPEN,
    replies: [],
    closedAt: null,
  });
}
