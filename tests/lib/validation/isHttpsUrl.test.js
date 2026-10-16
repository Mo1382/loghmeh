import { describe, expect, it } from "vitest";

import { isHttpsUrl } from "@/lib/validation/isHttpsUrl";

describe("isHttpsUrl", () => {
  describe("valid HTTPS URLs", () => {
    it.each([
      "https://example.com",
      "https://www.example.com",
      "https://example.com/avatar.png",
      "https://cdn.example.com/images/avatar.webp",
      "https://example.com:8443/avatar.png",
      "https://example.com/avatar.png?size=200",
      "https://example.com/avatar.png#preview",
      "HTTPS://EXAMPLE.COM/avatar.png",
    ])("returns true for %s", (url) => {
      expect(isHttpsUrl(url)).toBe(true);
    });
  });

  describe("invalid protocols", () => {
    it.each([
      "http://example.com",
      "ftp://example.com/avatar.png",
      "javascript:alert(1)",
      "file:///avatar.png",
    ])("returns false for %s", (url) => {
      expect(isHttpsUrl(url)).toBe(false);
    });
  });

  describe("invalid URL strings", () => {
    it.each([
      "",
      "example.com",
      "not a URL",
      "/images/avatar.png",
      "//example.com/avatar.png",
      "https://",
      "https://example .com",
      "https://example.com:invalid",
    ])("returns false for %s", (url) => {
      expect(isHttpsUrl(url)).toBe(false);
    });
  });

  describe("URLs containing credentials", () => {
    it.each([
      "https://user@example.com",
      "https://user:password@example.com",
      "https://:password@example.com",
      "https://user:@example.com",
    ])("returns false for %s", (url) => {
      expect(isHttpsUrl(url)).toBe(false);
    });
  });

  it.each([
    null,
    undefined,
    123,
    0,
    true,
    false,
    {},
    [],
    new URL("https://example.com"),
    new String("https://example.com"),
  ])("returns false for a non-string input: %s", (value) => {
    expect(isHttpsUrl(value)).toBe(false);
  });
});
