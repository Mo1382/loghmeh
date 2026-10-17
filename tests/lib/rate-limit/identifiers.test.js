import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmailIdentifier,
  createIpIdentifier,
  createLoginIdentifier,
  createUserIdentifier,
} from "@/lib/rate-limit/identifiers";

const TEST_SECRET = "test-only-rate-limit-hash-secret-32-bytes";

/**
 * Create an expected HMAC-SHA-256 digest for assertions.
 */
function createExpectedHash(value, secret = TEST_SECRET) {
  return crypto
    .createHmac("sha256", secret)
    .update(value, "utf8")
    .digest("hex");
}

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_HASH_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createUserIdentifier", () => {
  it("creates a stable user identifier using HMAC-SHA-256", () => {
    const expectedHash = createExpectedHash("user-123");

    const identifier = createUserIdentifier("auth:profile", "user-123");

    expect(identifier).toBe(`auth:profile:user:${expectedHash}`);
    expect(identifier).toMatch(/^auth:profile:user:[a-f0-9]{64}$/);

    expect(createUserIdentifier("auth:profile", "user-123")).toBe(identifier);

    expect(identifier).not.toContain("user-123");
  });

  it("trims surrounding whitespace from user prefixes and IDs", () => {
    const expectedHash = createExpectedHash("user-123");

    const identifierWithWhitespace = createUserIdentifier(
      " auth:profile ",
      " user-123 "
    );

    const identifierWithoutWhitespace = createUserIdentifier(
      "auth:profile",
      "user-123"
    );

    expect(identifierWithWhitespace).toBe(`auth:profile:user:${expectedHash}`);
    expect(identifierWithWhitespace).toBe(identifierWithoutWhitespace);
  });

  it("keeps user identifiers for different prefixes distinct", () => {
    const profileIdentifier = createUserIdentifier("auth:profile", "user-123");

    const settingsIdentifier = createUserIdentifier(
      "auth:settings",
      "user-123"
    );

    expect(profileIdentifier).not.toBe(settingsIdentifier);
  });
});

describe("createIpIdentifier", () => {
  it("creates a stable IP identifier using HMAC-SHA-256 without exposing the raw IP", () => {
    const ip = "203.0.113.42";
    const expectedHash = createExpectedHash(ip);

    const identifier = createIpIdentifier("auth:login", ip);

    expect(identifier).toBe(`auth:login:ip:${expectedHash}`);
    expect(identifier).toMatch(/^auth:login:ip:[a-f0-9]{64}$/);

    expect(createIpIdentifier("auth:login", ip)).toBe(identifier);
    expect(identifier).not.toContain(ip);
  });

  it("trims surrounding whitespace from IP prefixes and addresses", () => {
    const expectedHash = createExpectedHash("203.0.113.42");

    const identifierWithWhitespace = createIpIdentifier(
      " auth:login ",
      " 203.0.113.42 "
    );

    const identifierWithoutWhitespace = createIpIdentifier(
      "auth:login",
      "203.0.113.42"
    );

    expect(identifierWithWhitespace).toBe(`auth:login:ip:${expectedHash}`);
    expect(identifierWithWhitespace).toBe(identifierWithoutWhitespace);
  });
});

describe("createEmailIdentifier", () => {
  it("normalizes email and uses HMAC-SHA-256 over the normalized value", () => {
    const normalizedEmail = "user@example.com";
    const expectedHash = createExpectedHash(normalizedEmail);

    const identifier = createEmailIdentifier(
      "auth:forgot-password",
      " User@Example.com "
    );

    expect(identifier).toBe(`auth:forgot-password:email:${expectedHash}`);
    expect(createEmailIdentifier("auth:forgot-password", normalizedEmail)).toBe(
      identifier
    );
    expect(identifier).not.toContain("User@Example.com");
  });

  it("keeps email identifiers for different prefixes distinct", () => {
    const verifyEmailIdentifier = createEmailIdentifier(
      "auth:verify-email",
      "user@example.com"
    );

    const forgotPasswordIdentifier = createEmailIdentifier(
      "auth:forgot-password",
      "user@example.com"
    );

    expect(verifyEmailIdentifier).not.toBe(forgotPasswordIdentifier);
  });
});

describe("createLoginIdentifier", () => {
  it("normalizes login emails and uses HMAC-SHA-256 over the normalized value", () => {
    const normalizedEmail = "user@example.com";
    const expectedHash = createExpectedHash(normalizedEmail);

    const identifier = createLoginIdentifier(" User@Example.com ");

    expect(identifier).toBe(`auth:login:identifier:${expectedHash}`);

    expect(createLoginIdentifier(normalizedEmail)).toBe(identifier);
    expect(identifier).not.toContain("User@Example.com");
  });

  it("normalizes Arabic character variants in usernames", () => {
    expect(createLoginIdentifier("علي")).toBe(createLoginIdentifier("علی"));
    expect(createLoginIdentifier("كريم")).toBe(createLoginIdentifier("کریم"));
  });

  it("preserves username case when creating login identifiers", () => {
    const mixedCaseIdentifier = createLoginIdentifier("User123");
    const lowercaseIdentifier = createLoginIdentifier("user123");

    expect(mixedCaseIdentifier).not.toBe(lowercaseIdentifier);
  });

  it("uses HMAC-SHA-256 over the normalized username", () => {
    const normalizedUsername = "علی";
    const expectedHash = createExpectedHash(normalizedUsername);

    expect(createLoginIdentifier("علي")).toBe(
      `auth:login:identifier:${expectedHash}`
    );
  });
});

describe("identifier input validation", () => {
  it.each([
    ["user ID", () => createUserIdentifier("auth:test", null)],
    ["user ID", () => createUserIdentifier("auth:test", undefined)],
    ["user ID", () => createUserIdentifier("auth:test", 123)],
    ["user prefix", () => createUserIdentifier("   ", "user-123")],
    ["IP address", () => createIpIdentifier("auth:test", " ")],
    ["IP address", () => createIpIdentifier("auth:test", null)],
    ["IP prefix", () => createIpIdentifier(null, "203.0.113.42")],
    ["email", () => createEmailIdentifier("auth:test", 123)],
    ["email", () => createEmailIdentifier("auth:test", "   ")],
    ["email prefix", () => createEmailIdentifier("", "user@example.com")],
    ["login identifier", () => createLoginIdentifier(undefined)],
    ["login identifier", () => createLoginIdentifier(null)],
    ["login identifier", () => createLoginIdentifier("   ")],
    ["login identifier", () => createLoginIdentifier(123)],
  ])("rejects an invalid %s", (_field, createIdentifier) => {
    expect(createIdentifier).toThrow(TypeError);
  });
});

describe("RATE_LIMIT_HASH_SECRET", () => {
  it("throws when RATE_LIMIT_HASH_SECRET is missing", () => {
    vi.stubEnv("RATE_LIMIT_HASH_SECRET", undefined);

    expect(process.env.RATE_LIMIT_HASH_SECRET).toBeUndefined();

    expect(() => createUserIdentifier("auth:test", "user-123")).toThrow(
      "RATE_LIMIT_HASH_SECRET must contain at least 32 bytes."
    );
  });

  it("rejects a 31-byte ASCII secret", () => {
    vi.stubEnv("RATE_LIMIT_HASH_SECRET", "a".repeat(31));

    expect(() => createUserIdentifier("auth:test", "user-123")).toThrow(
      "RATE_LIMIT_HASH_SECRET must contain at least 32 bytes."
    );
  });

  it("accepts a secret with exactly 32 ASCII bytes", () => {
    vi.stubEnv("RATE_LIMIT_HASH_SECRET", "a".repeat(32));

    expect(createUserIdentifier("auth:test", "user-123")).toMatch(
      /^auth:test:user:[a-f0-9]{64}$/
    );
  });

  it("accepts a secret with exactly 32 UTF-8 bytes and fewer than 32 characters", () => {
    const secret = "ی".repeat(16);

    expect(secret.length).toBe(16);
    expect(Buffer.byteLength(secret, "utf8")).toBe(32);

    vi.stubEnv("RATE_LIMIT_HASH_SECRET", secret);

    expect(createUserIdentifier("auth:test", "user-123")).toMatch(
      /^auth:test:user:[a-f0-9]{64}$/
    );
  });

  it("produces different identifiers when the configured secret changes", () => {
    const firstIdentifier = createUserIdentifier("auth:test", "user-123");

    const anotherSecret = "a-different-test-only-secret-with-at-least-32-bytes";

    vi.stubEnv("RATE_LIMIT_HASH_SECRET", anotherSecret);

    const secondIdentifier = createUserIdentifier("auth:test", "user-123");

    expect(secondIdentifier).not.toBe(firstIdentifier);
  });
});
