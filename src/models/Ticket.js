import mongoose from "mongoose";
import { TICKET_STATUSES } from "@/constants/enums";

const ticketReplySchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const ticketSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: Object.values(TICKET_STATUSES),
      default: TICKET_STATUSES.OPEN,
      required: true,
    },

    replies: {
      type: [ticketReplySchema],
      default: [],
    },

    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// For queries in admin panel
ticketSchema.index({ userId: 1, createdAt: -1 });
ticketSchema.index({ status: 1, createdAt: -1 });

const ticket = mongoose.models.ticket || mongoose.model("ticket", ticketSchema);

export default ticket;
