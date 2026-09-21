import mongoose from "mongoose";
import { createHmac, timingSafeEqual } from "node:crypto";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

import {
  createTicket as createTicketRepository,
  findTicketById,
  findTicketByIdAndUser,
  findTicketsByUser,
} from "@/db/repositories/ticket.repository";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const TICKET_STATUSES = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

const NON_CLOSED_TICKET_STATUSES = new Set([
  TICKET_STATUSES.OPEN,
  TICKET_STATUSES.IN_PROGRESS,
  TICKET_STATUSES.RESOLVED,
]);

const VALID_TICKET_STATUSES = new Set(Object.values(TICKET_STATUSES));

const DEFAULT_LIMIT = 16;
const MAX_LIMIT = 50;

const CURSOR_VERSION = 1;
const CURSOR_SECRET = process.env.CURSOR_SECRET;

if (!CURSOR_SECRET) {
  throw new Error("متغیر CURSOR_SECRET تنظیم نشده است.");
}

/* -------------------------------------------------------------------------- */
/* Authentication / Authorization                                             */
/* -------------------------------------------------------------------------- */

function assertAuthenticated(currentUser) {
  if (!currentUser?._id) {
    throw new AppError(
      ERROR_CODES.AUTHENTICATION_REQUIRED,
      "ورود به حساب کاربری الزامی است.",
      { statusCode: 401 }
    );
  }
}

function assertAdmin(currentUser) {
  assertAuthenticated(currentUser);

  if (currentUser.role !== "ADMIN") {
    throw new AppError(
      ERROR_CODES.ADMIN_ACCESS_REQUIRED,
      "دسترسی مدیر سیستم الزامی است.",
      { statusCode: 403 }
    );
  }
}

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

function assertValidTicketStatus(status) {
  if (!VALID_TICKET_STATUSES.has(status)) {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_STATUS,
      "وضعیت تیکت پشتیبانی نامعتبر است.",
      { statusCode: 400 }
    );
  }
}

function assertNonClosedTicketStatus(status) {
  if (!NON_CLOSED_TICKET_STATUSES.has(status)) {
    throw new AppError(
      ERROR_CODES.INVALID_TICKET_STATUS_TRANSITION,
      "وضعیت بسته فقط باید از طریق عملیات بستن یا بازگشایی مدیریت شود.",
      { statusCode: 400 }
    );
  }
}

function normalizeLimit(limit) {
  if (limit === undefined || limit === null) {
    return DEFAULT_LIMIT;
  }

  const normalizedLimit = Number(limit);

  if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
    throw new AppError(
      ERROR_CODES.INVALID_LIMIT,
      "تعداد تیکت‌ها باید یک عدد صحیح مثبت باشد.",
      { statusCode: 400 }
    );
  }

  return Math.min(normalizedLimit, MAX_LIMIT);
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

function createCursorSignature(payload) {
  return createHmac("sha256", CURSOR_SECRET).update(payload).digest("hex");
}

function encodeCursor({ userId, createdAt, id }) {
  const payloadObject = {
    v: CURSOR_VERSION,
    userId: userId.toString(),
    createdAt: new Date(createdAt).toISOString(),
    id: id.toString(),
  };

  const payload = Buffer.from(JSON.stringify(payloadObject)).toString(
    "base64url"
  );

  const signature = createCursorSignature(payload);

  return `${payload}.${signature}`;
}

function decodeCursor(cursor, userId) {
  if (typeof cursor !== "string" || !cursor.trim()) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر تیکت پشتیبانی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  const parts = cursor.split(".");

  if (parts.length !== 2) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر تیکت پشتیبانی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  const [payload, signature] = parts;

  const expectedSignature = createCursorSignature(payload);

  const actualBuffer = Buffer.from(signature, "utf8");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر تیکت پشتیبانی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  let parsedPayload;

  try {
    parsedPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
  } catch {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر تیکت پشتیبانی نامعتبر است.",
      {
        statusCode: 400,
      }
    );
  }

  if (parsedPayload.v !== CURSOR_VERSION) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نسخه نشانگر تیکت پشتیبانی پشتیبانی نمی‌شود.",
      { statusCode: 400 }
    );
  }

  assertValidObjectId(parsedPayload.userId, "cursor user ID");

  assertValidObjectId(parsedPayload.id, "cursor ticket ID");

  if (parsedPayload.userId !== userId.toString()) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "نشانگر تیکت پشتیبانی متعلق به این کاربر نیست.",
      { statusCode: 400 }
    );
  }

  const createdAt = new Date(parsedPayload.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    throw new AppError(
      ERROR_CODES.INVALID_CURSOR,
      "تاریخ نشانگر تیکت پشتیبانی نامعتبر است.",
      { statusCode: 400 }
    );
  }

  return {
    createdAt,
    id: new mongoose.Types.ObjectId(parsedPayload.id),
  };
}

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

  const normalizedLimit = normalizeLimit(limit);

  const decodedCursor = cursor ? decodeCursor(cursor, currentUser._id) : null;

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
