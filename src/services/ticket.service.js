import mongoose from "mongoose";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import { assertAdmin, assertAuthenticated } from "@/lib/auth/guards";

import {
  createTicket as createTicketRepository,
  findTicketById,
  findTicketByIdAndUser,
  findTicketsByUser,
} from "@/repositories/ticket.repository";
import { normalizeLimit } from "@/lib/pagination/limit";
import { decodeCursor, encodeCursor } from "@/lib/pagination/cursor";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const TICKET_STATUSES = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

const DEFAULT_LIST_LIMIT = 16;
const MAX_LIST_LIMIT = 50;

/* -------------------------------------------------------------------------- */
/* Authentication / Authorization                                             */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function assertValidObjectId(value, fieldName = "ID") {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      ERROR_CODES.INVALID_OBJECT_ID,
      `شناسه ${fieldName} نامعتبر است.`,
      {
        statusCode: 400,
      }
    );
  }
}

function normalizeMessage(message) {
  if (typeof message !== "string") {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_MESSAGE,
      "متن پیام الزامی است.",
      {
        statusCode: 400,
      }
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
/* Cursor Helpers                                                              */
/* -------------------------------------------------------------------------- */

function createNextCursor(ticket, userId) {
  if (!ticket) {
    return null;
  }

  return encodeCursor({
    userId,
    createdAt: ticket.createdAt,
    id: ticket._id,
  });
}

/* -------------------------------------------------------------------------- */
/* Get Ticket                                                                  */
/* -------------------------------------------------------------------------- */

export async function getTicketById(currentUser, ticketId) {
  assertAuthenticated(currentUser);
  assertValidObjectId(ticketId, "ticket ID");

  const ticket = await findTicketByIdAndUser(ticketId, currentUser._id);

  if (!ticket) {
    throw new AppError(
      ERROR_CODES.TICKET_NOT_FOUND,
      "تیکت پشتیبانی پیدا نشد.",
      {
        statusCode: 404,
      }
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
      {
        statusCode: 404,
      }
    );
  }

  return ticket;
}

/* -------------------------------------------------------------------------- */
/* Get User Tickets                                                            */
/* -------------------------------------------------------------------------- */

export async function getUserTickets(
  currentUser,
  { cursor = null, limit = DEFAULT_LIMIT } = {}
) {
  assertAuthenticated(currentUser);

  const normalizedLimit = normalizeLimit(
    limit,
    DEFAULT_LIST_LIMIT,
    MAX_LIST_LIMIT
  );

  const payload = decodeCursor(cursor);

  if (payload.userId !== currentUser._id.toString()) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر تیکت پشتیبانی متعلق به این کاربر نیست.",
      { statusCode: 400 }
    );
  }

  const decodedCursor = normalizeCreatedAtIdCursor(payload);

  const tickets = await findTicketsByUser({
    userId: currentUser._id,
    cursor: decodedCursor,
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
/* Create Ticket                                                               */
/* -------------------------------------------------------------------------- */

export async function createSupportTicket(currentUser, message) {
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
