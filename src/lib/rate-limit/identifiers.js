import crypto from "node:crypto";

import { normalizeUsername } from "@/lib/normalization/normalizeUsername";

/**
 * Validate a required, non-empty string and trim surrounding whitespace.
 */
function requireNonEmptyString(value, name) {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a non-empty string.`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }

  return normalizedValue;
}

/**
 * Get the secret used to hash rate-limit identifiers.
 *
 * The secret must be shared by all application instances.
 */
function getHashSecret() {
  const secret = process.env.RATE_LIMIT_HASH_SECRET;

  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("RATE_LIMIT_HASH_SECRET must contain at least 32 bytes.");
  }

  return secret;
}

/**
 * Generate a keyed SHA-256 digest.
 *
 * HMAC prevents someone with access to stored identifiers
 * from verifying guesses without knowing the secret.
 */
function hashValue(value) {
  return crypto
    .createHmac("sha256", getHashSecret())
    .update(value, "utf8")
    .digest("hex");
}

/**
 * Create a rate-limit identifier for a user.
 */
export function createUserIdentifier(prefix, userId) {
  const normalizedPrefix = requireNonEmptyString(prefix, "prefix");
  const normalizedUserId = requireNonEmptyString(userId, "userId");

  return `${normalizedPrefix}:user:${hashValue(normalizedUserId)}`;
}

/**
 * Create a rate-limit identifier for an IP address.
 */
export function createIpIdentifier(prefix, ip) {
  const normalizedPrefix = requireNonEmptyString(prefix, "prefix");
  const normalizedIp = requireNonEmptyString(ip, "ip");

  return `${normalizedPrefix}:ip:${hashValue(normalizedIp)}`;
}

/**
 * Create a rate-limit identifier for an email address.
 */
export function createEmailIdentifier(prefix, email) {
  const normalizedPrefix = requireNonEmptyString(prefix, "prefix");
  const normalizedEmail = requireNonEmptyString(email, "email").toLowerCase();

  return `${normalizedPrefix}:email:${hashValue(normalizedEmail)}`;
}

/**
 * Create a rate-limit identifier for a login attempt.
 *
 * Email addresses are case-insensitive.
 * Usernames retain their case but normalize Persian/Arabic character variants.
 */
export function createLoginIdentifier(identifier) {
  const normalizedIdentifier = requireNonEmptyString(identifier, "identifier");

  const value = normalizedIdentifier.includes("@")
    ? normalizedIdentifier.toLowerCase()
    : normalizeUsername(normalizedIdentifier);

  return `auth:login:identifier:${hashValue(value)}`;
}
