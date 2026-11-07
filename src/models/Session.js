import mongoose from "mongoose";

/**
 * SHA-256 hashes are stored as 64-character lowercase hexadecimal strings.
 * The negative lookahead enforces the absolute end of the input, rejecting
 * trailing line terminators as well as other extra characters.
 */
const SHA256_HASH_PATTERN = /^[a-f0-9]{64}(?![\s\S])/;

/**
 * Check whether a value is a valid JavaScript Date.
 */
function isValidDate(value) {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * ============================================================================
 * Session Schema
 * ============================================================================
 *
 * Stores server-side authentication sessions.
 * Only the SHA-256 hash of the opaque browser token is persisted.
 */
const sessionSchema = new mongoose.Schema(
  {
    /**
     * User who owns this Session.
     * A Session must never be reassigned to another User.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    /**
     * SHA-256 hash of the opaque Session token.
     * Excluded from normal query results; select it explicitly when needed.
     */
    tokenHash: {
      type: String,
      required: true,
      select: false,
      immutable: true,
      match: [
        SHA256_HASH_PATTERN,
        "Session token hash must be a 64-character lowercase SHA-256 hex string.",
      ],
    },

    /**
     * User.sessionVersion captured when this Session is issued.
     * This value is immutable and is compared with the User's current version
     * whenever the Session is authenticated.
     */
    sessionVersion: {
      type: Number,
      required: true,
      min: [0, "Session version must be non-negative."],
      immutable: true,
      validate: {
        validator: Number.isSafeInteger,
        message: "Session version must be a non-negative safe integer.",
      },
    },

    /**
     * Last activity timestamp.
     * The Session service updates this value when refreshing idle expiry.
     */
    lastActivityAt: {
      type: Date,
      required: true,
    },

    /**
     * Expiration caused by inactivity.
     * Must be later than lastActivityAt and cannot exceed absoluteExpiresAt.
     *
     * Cross-field validation is implemented in document validation middleware
     * below. Query-based updates must enforce the same invariant atomically in
     * their MongoDB filter/update because document middleware does not run for
     * findOneAndUpdate().
     */
    idleExpiresAt: {
      type: Date,
      required: true,
    },

    /**
     * Hard expiration timestamp.
     * Unlike idleExpiresAt, this value must not be extended by activity.
     */
    absoluteExpiresAt: {
      type: Date,
      required: true,
      immutable: true,
    },

    /**
     * Null while the Session is active; set to a Date when it is revoked.
     */
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    // Session documents need createdAt, but do not need updatedAt.
    // lastActivityAt is the explicit activity timestamp.
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

/**
 * Validate the relationship between the Session expiry timestamps.
 *
 * This document-level hook is intentionally used instead of a path validator
 * that reads `this.lastActivityAt` / `this.absoluteExpiresAt`: in Mongoose,
 * `this` inside update validators is a Query rather than the full document.
 */
sessionSchema.pre("validate", function () {
  const { lastActivityAt, idleExpiresAt, absoluteExpiresAt } = this;

  // Let the required and Date-casting validators report missing/invalid dates.
  if (
    !isValidDate(lastActivityAt) ||
    !isValidDate(idleExpiresAt) ||
    !isValidDate(absoluteExpiresAt)
  ) {
    return;
  }

  const lastActivityTime = lastActivityAt.getTime();
  const idleExpiryTime = idleExpiresAt.getTime();
  const absoluteExpiryTime = absoluteExpiresAt.getTime();

  if (
    idleExpiryTime <= lastActivityTime ||
    idleExpiryTime > absoluteExpiryTime
  ) {
    this.invalidate(
      "idleExpiresAt",
      "Idle expiry must be later than last activity and no later than absolute expiry."
    );
  }
});

/**
 * ============================================================================
 * Indexes
 * ============================================================================
 */

/** Ensure that a token hash can identify at most one Session. */
sessionSchema.index({ tokenHash: 1 }, { unique: true });

/** Support listing and managing a User's Sessions. */
sessionSchema.index({
  userId: 1,
  revokedAt: 1,
  sessionVersion: 1,
  createdAt: -1,
  _id: -1,
});

/**
 * Remove documents after their absolute lifetime ends.
 * This TTL index is for storage cleanup only; Session authentication must
 * independently check revokedAt, idleExpiresAt, and absoluteExpiresAt.
 */
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * ============================================================================
 * Model
 * ============================================================================
 *
 * Reuse the compiled model in environments where modules may be reloaded.
 */
const Session =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);

export default Session;
