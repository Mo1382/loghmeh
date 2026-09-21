import SupportTicket from "@/models/SupportTicket";

/**
 * Apply MongoDB session only when provided.
 */
function applySession(query, session) {
  return session ? query.session(session) : query;
}

/**
 * Find a support ticket by its ID.
 */
export function findTicketById(ticketId, session) {
  const query = SupportTicket.findById(ticketId);

  return applySession(query, session);
}

/**
 * Find a support ticket belonging to a specific user.
 *
 * Useful for normal user operations where the ticket
 * must belong to the authenticated user.
 */
export function findTicketByIdAndUser(ticketId, userId, session) {
  const query = SupportTicket.findOne({
    _id: ticketId,
    userId,
  });

  return applySession(query, session);
}

/**
 * Find a user's support tickets using cursor-based loading.
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

  const query = SupportTicket.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit);

  return applySession(query, session);
}

/**
 * Find all support tickets.
 *
 * Intended mainly for the Admin panel.
 *
 * Sort order:
 * - createdAt DESC
 * - _id DESC
 */
export function findAllTickets(session) {
  const query = SupportTicket.find({}).sort({
    createdAt: -1,
    _id: -1,
  });

  return applySession(query, session);
}

/**
 * Find support tickets by status.
 *
 * Intended mainly for the Admin panel.
 */
export function findTicketsByStatus(status, session) {
  const query = SupportTicket.find({
    status,
  }).sort({
    createdAt: -1,
    _id: -1,
  });

  return applySession(query, session);
}

/**
 * Create a support ticket.
 *
 * userId is obtained from the authenticated user.
 */
export function createTicket(ticketData, session) {
  if (session) {
    return SupportTicket.create([ticketData], { session }).then(
      ([ticket]) => ticket
    );
  }

  return SupportTicket.create(ticketData);
}

/**
 * Add an admin reply to a support ticket.
 *
 * Replies are embedded inside the ticket document.
 */
export function addTicketReply(ticketId, replyData, session) {
  const query = SupportTicket.findByIdAndUpdate(
    ticketId,
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
 * Update the status of a support ticket.
 */
export function updateTicketStatus(ticketId, status, session) {
  const query = SupportTicket.findByIdAndUpdate(
    ticketId,
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
 * Close a support ticket.
 *
 * The Service layer should decide whether the ticket
 * is allowed to be closed.
 */
export function closeTicket(ticketId, closedAt = new Date(), session) {
  const query = SupportTicket.findByIdAndUpdate(
    ticketId,
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
 * Reopen a previously closed ticket.
 */
export function reopenTicket(ticketId, session) {
  const query = SupportTicket.findByIdAndUpdate(
    ticketId,
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
 * Delete a support ticket by its ID.
 *
 * Authorization must be handled in the Service layer.
 */
export function deleteTicketById(ticketId, session) {
  const query = SupportTicket.findByIdAndDelete(ticketId);

  return applySession(query, session);
}
