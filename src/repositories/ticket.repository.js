import Ticket from "@/models/Ticket";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

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
 * Find all support Tickets.
 *
 * Intended mainly for the Admin panel.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 */
export function findAllTickets(session) {
  const query = Ticket.find({}).sort({
    createdAt: -1,
    _id: -1,
  });

  return applySession(query, session);
}

/**
 * Find support Tickets by status.
 *
 * Intended mainly for the Admin panel.
 */
export function findTicketsByStatus(status, session) {
  const query = Ticket.find({
    status,
  }).sort({
    createdAt: -1,
    _id: -1,
  });

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

/**
 * Add an admin reply to a support Ticket.
 *
 * Replies are embedded inside the Ticket document.
 */
export function addTicketReply(TicketId, replyData, session) {
  const query = Ticket.findByIdAndUpdate(
    TicketId,
    {
      $push: {
        replies: replyData,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Update the status of a support Ticket.
 */
export function updateTicketStatus(TicketId, status, session) {
  const query = Ticket.findByIdAndUpdate(
    TicketId,
    {
      $set: {
        status,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Close a support Ticket.
 *
 * The Service layer should decide whether the Ticket
 * is allowed to be closed.
 */
export function closeTicket(TicketId, closedAt = new Date(), session) {
  const query = Ticket.findByIdAndUpdate(
    TicketId,
    {
      $set: {
        status: "CLOSED",
        closedAt,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Reopen a previously closed Ticket.
 */
export function reopenTicket(TicketId, session) {
  const query = Ticket.findByIdAndUpdate(
    TicketId,
    {
      $set: {
        status: "OPEN",
        closedAt: null,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  return applySession(query, session);
}

/**
 * Delete a support Ticket by its ID.
 *
 * Authorization must be handled in the Service layer.
 */
export function deleteTicketById(TicketId, session) {
  const query = Ticket.findByIdAndDelete(TicketId);

  return applySession(query, session);
}
