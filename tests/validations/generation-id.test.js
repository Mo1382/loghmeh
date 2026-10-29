import { describe, expect, it } from "vitest";

import { isStrictGenerationId } from "@/lib/validation/generation-id";

describe("isStrictGenerationId()", () => {
  describe("valid UUID v4 values", () => {
    it.each([
      "550e8400-e29b-41d4-a716-446655440000",
      "123e4567-e89b-42d3-a456-426614174000",
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    ])("accepts a valid UUID v4: %s", (value) => {
      expect(isStrictGenerationId(value)).toBe(true);
    });

    it("accepts an uppercase UUID v4", () => {
      expect(isStrictGenerationId("550E8400-E29B-41D4-A716-446655440000")).toBe(
        true
      );
    });

    it("accepts a UUID v4 with mixed letter casing", () => {
      expect(isStrictGenerationId("550e8400-E29B-41d4-A716-446655440000")).toBe(
        true
      );
    });
  });

  describe("invalid UUID formats", () => {
    it.each([
      ["empty string", ""],
      ["arbitrary text", "not-a-uuid"],
      ["UUID without hyphens", "550e8400e29b41d4a716446655440000"],
      ["UUID with missing segments", "550e8400-e29b-41d4-a716"],
      ["UUID with an extra character", "550e8400-e29b-41d4-a716-4466554400000"],
      [
        "UUID with surrounding whitespace",
        " 550e8400-e29b-41d4-a716-446655440000 ",
      ],
      [
        "UUID with invalid hexadecimal characters",
        "550e8400-e29b-41d4-a716-44665544zzzz",
      ],
    ])("rejects %s", (_description, value) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("UUID version validation", () => {
    it.each([
      ["UUID v1", "123e4567-e89b-12d3-a456-426614174000"],
      ["UUID v3", "123e4567-e89b-32d3-a456-426614174000"],
      ["UUID v5", "123e4567-e89b-52d3-a456-426614174000"],
      ["UUID with version 7", "123e4567-e89b-72d3-a456-426614174000"],
    ])("rejects %s", (_description, value) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("UUID variant validation", () => {
    it.each([
      ["variant 0", "123e4567-e89b-42d3-0456-426614174000"],
      ["variant 1", "123e4567-e89b-42d3-1456-426614174000"],
      ["variant 7", "123e4567-e89b-42d3-7456-426614174000"],
    ])("rejects UUID v4 with %s", (_description, value) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("trailing characters", () => {
    it.each([
      ["trailing newline", "550e8400-e29b-41d4-a716-446655440000\n"],
      ["trailing carriage return", "550e8400-e29b-41d4-a716-446655440000\r"],
      ["trailing CRLF", "550e8400-e29b-41d4-a716-446655440000\r\n"],
      ["trailing tab", "550e8400-e29b-41d4-a716-446655440000\t"],
    ])("rejects a UUID with a %s", (_description, value) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("non-string inputs", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["a number", 123],
      ["a boolean", true],
      ["an object", {}],
      ["an array", []],
    ])("rejects %s", (_description, value) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });
});
