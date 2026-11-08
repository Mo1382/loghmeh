/**
 * ==========================================================================
 * Session Security Policy
 * ==========================================================================
 *
 * Centralized security and lifecycle settings for user Sessions.
 *
 * All durations are expressed in milliseconds.
 */

export const SESSION_POLICY = Object.freeze({
  /**
   * Cryptographically secure Session token size.
   * 32 bytes = 256 bits of entropy.
   */
  TOKEN_BYTES: 32,

  /**
   * Maximum inactivity period before a Session expires.
   */
  IDLE_TIMEOUT_MS: 24 * 60 * 60 * 1000,

  /**
   * Maximum lifetime of a Session, regardless of activity.
   */
  ABSOLUTE_TIMEOUT_MS: 30 * 24 * 60 * 60 * 1000,

  /**
   * Minimum interval between persisted activity updates.
   */
  TOUCH_INTERVAL_MS: 5 * 60 * 1000,

  MAX_CLOCK_SKEW_MS: 30 * 1000,
});
