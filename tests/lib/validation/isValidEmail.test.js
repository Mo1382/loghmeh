import { describe, expect, it } from "vitest";

import { isValidEmail } from "@/lib/validation/isValidEmail";

describe("isValidEmail", () => {
  // Common email formats supported by the current EMAIL_PATTERN.
  describe("valid email addresses", () => {
    it.each([
      "user@example.com",
      "first.last@example.com",
      "user+tag@example.com",
      "user@sub.example.co.uk",
      "USER@EXAMPLE.COM",
    ])("returns true for %s", (email) => {
      expect(isValidEmail(email)).toBe(true);
    });
  });

  // The validator trims surrounding whitespace but does not remove
  // whitespace occurring inside the email address.
  describe("whitespace handling", () => {
    it("returns true for an email with leading and trailing whitespace", () => {
      expect(isValidEmail("  user@example.com  ")).toBe(true);
    });

    it("returns false for an empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("returns false for a whitespace-only string", () => {
      expect(isValidEmail("   ")).toBe(false);
    });

    it("returns false when whitespace appears inside the email", () => {
      expect(isValidEmail("user name@example.com")).toBe(false);
    });
  });

  // Verify rejection of malformed addresses covered by the current regex.
  describe("invalid email formats", () => {
    it.each([
      "userexample.com",
      "@example.com",
      "user@",
      "user@example",
      "user@@example.com",
      "user@example .com",
      "user..name@example.com",
      "user@example..com",
    ])("returns false for %s", (email) => {
      expect(isValidEmail(email)).toBe(false);
    });
  });

  // Test the 254-character limit using domain labels that do not exceed
  // 63 characters, keeping the test focused on the overall email length.
  describe("email length", () => {
    it("returns true when the trimmed email is exactly 254 characters long", () => {
      const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}`;
      const email = `user@${domain}`;

      expect(email).toHaveLength(254);
      expect(isValidEmail(email)).toBe(true);
    });

    it("returns false when the email is 255 characters long", () => {
      const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}`;
      const email = `user@${domain}`;

      expect(email).toHaveLength(255);
      expect(isValidEmail(email)).toBe(false);
    });

    it("applies the length limit after trimming whitespace", () => {
      const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}`;
      const email = `user@${domain}`;

      expect(isValidEmail(`  ${email}  `)).toBe(true);
    });
  });

  // Reject non-string values, including String objects, because the
  // validator explicitly requires a primitive string.
  describe("non-string inputs", () => {
    it.each([
      null,
      undefined,
      0,
      123,
      true,
      false,
      {},
      [],
      new String("user@example.com"),
      new Date(),
    ])("returns false for a non-string input: %s", (value) => {
      expect(isValidEmail(value)).toBe(false);
    });
  });
});
