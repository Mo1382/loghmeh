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

    it.each([
      {
        variant: "8",
        value: "550e8400-e29b-41d4-8716-446655440000",
      },
      {
        variant: "9",
        value: "550e8400-e29b-41d4-9716-446655440000",
      },
      {
        variant: "a",
        value: "550e8400-e29b-41d4-a716-446655440000",
      },
      {
        variant: "b",
        value: "550e8400-e29b-41d4-b716-446655440000",
      },
    ])("accepts UUID v4 with variant $variant", ({ value }) => {
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
      {
        description: "empty string",
        value: "",
      },
      {
        description: "arbitrary text",
        value: "not-a-uuid",
      },
      {
        description: "UUID without hyphens",
        value: "550e8400e29b41d4a716446655440000",
      },
      {
        description: "UUID with missing segments",
        value: "550e8400-e29b-41d4-a716",
      },
      {
        description: "UUID with an extra character",
        value: "550e8400-e29b-41d4-a716-4466554400000",
      },
      {
        description: "UUID with surrounding whitespace",
        value: " 550e8400-e29b-41d4-a716-446655440000 ",
      },
      {
        description: "UUID with invalid hexadecimal characters",
        value: "550e8400-e29b-41d4-a716-44665544zzzz",
      },
    ])("rejects $description", ({ value }) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("UUID version validation", () => {
    it.each([
      {
        description: "UUID v1",
        value: "123e4567-e89b-12d3-a456-426614174000",
      },
      {
        description: "UUID v3",
        value: "123e4567-e89b-32d3-a456-426614174000",
      },
      {
        description: "UUID v5",
        value: "123e4567-e89b-52d3-a456-426614174000",
      },
      {
        description: "UUID v7",
        value: "123e4567-e89b-72d3-a456-426614174000",
      },
    ])("rejects $description", ({ value }) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("UUID variant validation", () => {
    it.each([
      {
        description: "variant 0",
        value: "123e4567-e89b-42d3-0456-426614174000",
      },
      {
        description: "variant 1",
        value: "123e4567-e89b-42d3-1456-426614174000",
      },
      {
        description: "variant 7",
        value: "123e4567-e89b-42d3-7456-426614174000",
      },
      {
        description: "variant c",
        value: "123e4567-e89b-42d3-c456-426614174000",
      },
    ])("rejects UUID v4 with $description", ({ value }) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("trailing characters", () => {
    it.each([
      {
        description: "trailing newline",
        value: "550e8400-e29b-41d4-a716-446655440000\n",
      },
      {
        description: "trailing carriage return",
        value: "550e8400-e29b-41d4-a716-446655440000\r",
      },
      {
        description: "trailing CRLF",
        value: "550e8400-e29b-41d4-a716-446655440000\r\n",
      },
      {
        description: "trailing tab",
        value: "550e8400-e29b-41d4-a716-446655440000\t",
      },
      {
        description: "trailing line separator",
        value: "550e8400-e29b-41d4-a716-446655440000\u2028",
      },
      {
        description: "trailing paragraph separator",
        value: "550e8400-e29b-41d4-a716-446655440000\u2029",
      },
    ])("rejects a UUID with $description", ({ value }) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });

  describe("non-string inputs", () => {
    it.each([
      {
        description: "undefined",
        value: undefined,
      },
      {
        description: "null",
        value: null,
      },
      {
        description: "a number",
        value: 123,
      },
      {
        description: "a boolean",
        value: true,
      },
      {
        description: "a bigint",
        value: 123n,
      },
      {
        description: "a symbol",
        value: Symbol("generation-id"),
      },
      {
        description: "a function",
        value: () => {},
      },
      {
        description: "an object",
        value: {},
      },
      {
        description: "an array",
        value: [],
      },
    ])("rejects $description", ({ value }) => {
      expect(isStrictGenerationId(value)).toBe(false);
    });
  });
});
