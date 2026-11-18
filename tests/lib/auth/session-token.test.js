import { Buffer } from "node:buffer";
import { randomBytes } from "node:crypto";

import { SESSION_POLICY } from "@/constants/session";

import {
  assertValidSessionToken,
  isValidSessionToken,
} from "@/lib/auth/session-token";

// ============================================================================
// Test Helpers
// ============================================================================

const SESSION_TOKEN_LENGTH = Math.ceil((SESSION_POLICY.TOKEN_BYTES * 8) / 6);

const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const INVALID_TOKEN_ERROR =
  "Session token must be a valid canonical Base64URL token.";

function createValidSessionToken() {
  return randomBytes(SESSION_POLICY.TOKEN_BYTES).toString("base64url");
}

/**
 * Create a non-canonical Base64URL token by modifying only the unused
 * trailing bits of its final character.
 *
 * The original and modified tokens decode to exactly the same bytes,
 * but only the original has a canonical representation.
 *
 * Requires TOKEN_BYTES % 3 !== 0.
 */
function createNonCanonicalSessionToken() {
  const canonicalToken = Buffer.alloc(SESSION_POLICY.TOKEN_BYTES).toString(
    "base64url"
  );

  const remainder = SESSION_POLICY.TOKEN_BYTES % 3;

  if (remainder === 0) {
    throw new Error(
      "Cannot create a non-canonical token by modifying unused trailing bits."
    );
  }

  const lastCharacterIndex = BASE64URL_ALPHABET.indexOf(canonicalToken.at(-1));

  const nonCanonicalLastCharacter = BASE64URL_ALPHABET[lastCharacterIndex + 1];

  const nonCanonicalToken =
    canonicalToken.slice(0, -1) + nonCanonicalLastCharacter;

  return {
    canonicalToken,
    nonCanonicalToken,
  };
}

const {
  canonicalToken: CANONICAL_TOKEN,
  nonCanonicalToken: NON_CANONICAL_TOKEN,
} = createNonCanonicalSessionToken();

// ============================================================================
// isValidSessionToken()
// ============================================================================

describe("isValidSessionToken()", () => {
  // ==========================================================================
  // Valid Tokens
  // ==========================================================================

  it("accepts a valid canonical Base64URL Session token", () => {
    const token = createValidSessionToken();

    expect(token).toHaveLength(SESSION_TOKEN_LENGTH);

    expect(Buffer.from(token, "base64url")).toHaveLength(
      SESSION_POLICY.TOKEN_BYTES
    );

    expect(isValidSessionToken(token)).toBe(true);
  });

  it("accepts a token containing both Base64URL-specific characters", () => {
    const bytes = Buffer.alloc(SESSION_POLICY.TOKEN_BYTES);

    bytes.set([0xfb, 0xff, 0xff]);

    const token = bytes.toString("base64url");

    expect(token).toContain("-");
    expect(token).toContain("_");

    expect(isValidSessionToken(token)).toBe(true);
  });

  // ==========================================================================
  // Invalid Input Types
  // ==========================================================================

  it.each([
    {
      description: "null",
      token: null,
    },
    {
      description: "undefined",
      token: undefined,
    },
    {
      description: "a number",
      token: 123,
    },
    {
      description: "a boolean",
      token: true,
    },
    {
      description: "an object",
      token: {},
    },
    {
      description: "an array",
      token: [],
    },
  ])("returns false for $description input", ({ token }) => {
    expect(isValidSessionToken(token)).toBe(false);
  });

  // ==========================================================================
  // Invalid Token Length
  // ==========================================================================

  it.each([
    {
      description: "an empty string",
      token: "",
    },
    {
      description: "a token shorter than the expected length",
      token: "A".repeat(SESSION_TOKEN_LENGTH - 1),
    },
    {
      description: "a token longer than the expected length",
      token: "A".repeat(SESSION_TOKEN_LENGTH + 1),
    },
  ])("returns false for $description", ({ token }) => {
    expect(isValidSessionToken(token)).toBe(false);
  });

  // ==========================================================================
  // Invalid Base64URL Characters
  // ==========================================================================

  it.each([
    {
      description: "a token containing a plus sign",
      token: `${"A".repeat(SESSION_TOKEN_LENGTH - 1)}+`,
    },
    {
      description: "a token containing a slash",
      token: `${"A".repeat(SESSION_TOKEN_LENGTH - 1)}/`,
    },
    {
      description: "a token containing padding",
      token: `${"A".repeat(SESSION_TOKEN_LENGTH - 1)}=`,
    },
    {
      description: "a token containing whitespace",
      token: `${"A".repeat(SESSION_TOKEN_LENGTH - 1)} `,
    },
    {
      description: "a token containing a newline",
      token: `${"A".repeat(SESSION_TOKEN_LENGTH - 1)}\n`,
    },
    {
      description: "a token containing a carriage return",
      token: `${"A".repeat(SESSION_TOKEN_LENGTH - 1)}\r`,
    },
  ])("returns false for $description", ({ token }) => {
    expect(isValidSessionToken(token)).toBe(false);
  });

  it("rejects a trailing newline after an otherwise valid token", () => {
    const validToken = createValidSessionToken();
    const token = `${validToken}\n`;

    expect(isValidSessionToken(validToken)).toBe(true);
    expect(isValidSessionToken(token)).toBe(false);
  });

  // ==========================================================================
  // Canonical Base64URL Representation
  // ==========================================================================

  it("rejects a non-canonical Base64URL token with valid length and characters", () => {
    const canonicalDecoded = Buffer.from(CANONICAL_TOKEN, "base64url");

    const nonCanonicalDecoded = Buffer.from(NON_CANONICAL_TOKEN, "base64url");

    expect(CANONICAL_TOKEN).toHaveLength(SESSION_TOKEN_LENGTH);
    expect(NON_CANONICAL_TOKEN).toHaveLength(SESSION_TOKEN_LENGTH);

    expect(NON_CANONICAL_TOKEN).toMatch(/^[A-Za-z0-9_-]+$/);

    expect(canonicalDecoded).toHaveLength(SESSION_POLICY.TOKEN_BYTES);
    expect(nonCanonicalDecoded).toHaveLength(SESSION_POLICY.TOKEN_BYTES);

    // Both representations must decode to exactly the same bytes.
    expect(nonCanonicalDecoded).toEqual(canonicalDecoded);

    // Only the original representation is canonical.
    expect(canonicalDecoded.toString("base64url")).toBe(CANONICAL_TOKEN);
    expect(nonCanonicalDecoded.toString("base64url")).toBe(CANONICAL_TOKEN);

    expect(isValidSessionToken(CANONICAL_TOKEN)).toBe(true);
    expect(isValidSessionToken(NON_CANONICAL_TOKEN)).toBe(false);
  });
});

// ============================================================================
// assertValidSessionToken()
// ============================================================================

describe("assertValidSessionToken()", () => {
  // ==========================================================================
  // Valid Tokens
  // ==========================================================================

  it("does not throw for a valid canonical Base64URL Session token", () => {
    const token = createValidSessionToken();

    expect(() => assertValidSessionToken(token)).not.toThrow();
  });

  // ==========================================================================
  // Invalid Tokens
  // ==========================================================================

  it.each([
    {
      description: "a malformed string",
      token: "invalid-token",
    },
    {
      description: "a token with an invalid length",
      token: "A".repeat(SESSION_TOKEN_LENGTH - 1),
    },
    {
      description: "a non-canonical Base64URL token",
      token: NON_CANONICAL_TOKEN,
    },
    {
      description: "a null value",
      token: null,
    },
    {
      description: "an undefined value",
      token: undefined,
    },
  ])("throws TypeError for $description", ({ token }) => {
    expect(() => assertValidSessionToken(token)).toThrowError(
      new TypeError(INVALID_TOKEN_ERROR)
    );
  });
});
