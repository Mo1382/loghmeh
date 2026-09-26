import Ticket from "@/models/Ticket";
import { applySession } from "@/lib/helpers/apply-session";

/**
 * Find a support Ticket by its ID.
 */
export function findTicketById(TicketId, session) {
  const query = Ticket.findById(TicketId);

  return applySession(query, session);
}

/**
 * Find a support Ticket belonging to a specific user.
 *
 * Useful for normal user operations where the Ticket
 * must belong to the authenticated user.
 */
export function findTicketByIdAndUser(TicketId, userId, session) {
  const query = Ticket.findOne({
    _id: TicketId,
    userId,
  });

  return applySession(query, session);
}

/**
 * Find a user's support Tickets using cursor-based loading.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 *
 * Cursor structure:
 * {
 *   createdAt: Date,
 *   id: ObjectId
 * }
 */
export function findTicketsByUser({
  userId,
  cursor = null,
  limit = 16,
  session,
}) {
  const filter = {
    userId,
  };

  if (cursor) {
    filter.$or = [
      {
        createdAt: {
          $lt: cursor.createdAt,
        },
      },
      {
        createdAt: cursor.createdAt,
        _id: {
          $lt: cursor.id,
        },
      },
    ];
  }

  const query = Ticket.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Create a support Ticket.
 *
 * userId is obtained from the authenticated user.
 */
export function createTicket(TicketData, session) {
  if (session) {
    return Ticket.create([TicketData], { session }).then(([Ticket]) => Ticket);
  }

  return Ticket.create(TicketData);
}
