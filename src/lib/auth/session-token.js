import "server-only";

import { SESSION_POLICY } from "@/constants/session";

const SESSION_TOKEN_LENGTH = Math.ceil((SESSION_POLICY.TOKEN_BYTES * 8) / 6);

const SESSION_TOKEN_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${SESSION_TOKEN_LENGTH}}(?![\\s\\S])`
);

/**
 * Check whether a value is a canonical Base64URL Session token.
 *
 * The token must:
 * - Have the expected Base64URL length.
 * - Contain only Base64URL characters.
 * - Decode to exactly TOKEN_BYTES bytes.
 * - Round-trip to the original canonical representation.
 */
export function isValidSessionToken(token) {
  if (typeof token !== "string" || !SESSION_TOKEN_PATTERN.test(token)) {
    return false;
  }

  const decoded = Buffer.from(token, "base64url");

  return (
    decoded.length === SESSION_POLICY.TOKEN_BYTES &&
    decoded.toString("base64url") === token
  );
}

/**
 * Validate a raw opaque Session token.
 */
export function assertValidSessionToken(token) {
  if (!isValidSessionToken(token)) {
    throw new TypeError(
      "Session token must be a valid canonical Base64URL token."
    );
  }
}
