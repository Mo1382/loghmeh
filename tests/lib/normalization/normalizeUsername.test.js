import { describe, expect, it } from "vitest";

import { normalizeUsername } from "@/lib/normalization/normalizeUsername";

describe("normalizeUsername", () => {
  // Arabic Yeh (ي) must be converted to Persian Yeh (ی).
  it("converts Arabic Yeh to Persian Yeh", () => {
    expect(normalizeUsername("علي")).toBe("علی");
  });

  // Arabic Kaf (ك) must be converted to Persian Kaf (ک).
  it("converts Arabic Kaf to Persian Kaf", () => {
    expect(normalizeUsername("كتاب")).toBe("کتاب");
  });

  // All occurrences of both Arabic characters must be normalized.
  it("normalizes all occurrences of Arabic Yeh and Kaf", () => {
    expect(normalizeUsername("ي ك ي ك")).toBe("ی ک ی ک");
  });

  // Both Arabic variants can appear in a username alongside Persian characters.
  it("normalizes mixed Arabic and Persian characters", () => {
    expect(normalizeUsername("علي كتاب")).toBe("علی کتاب");
  });

  // Values that are already normalized or contain unrelated characters
  // must remain unchanged.
  it.each(["علی", "کتاب", "علی_123", "Loghmeh123", "user.name", ""])(
    "preserves an already-normalized value: %s",
    (value) => {
      expect(normalizeUsername(value)).toBe(value);
    }
  );

  // Arabic characters other than Yeh and Kaf must not be modified.
  it("preserves unrelated Arabic characters", () => {
    expect(normalizeUsername("محمد")).toBe("محمد");
  });

  // The function normalizes targeted characters without trimming whitespace
  // or changing punctuation.
  it("preserves whitespace and punctuation", () => {
    expect(normalizeUsername("  علي_ك  ")).toBe("  علی_ک  ");
  });

  // Non-string inputs must be returned unchanged, without coercion.
  it.each([
    { description: "null", value: null },
    { description: "undefined", value: undefined },
    { description: "number", value: 123 },
    { description: "boolean", value: true },
    { description: "plain object", value: { username: "علي" } },
    { description: "array", value: ["علي"] },
    { description: "String object", value: Object("علي") },
    { description: "symbol", value: Symbol("username") },
    { description: "bigint", value: 123n },
  ])("returns a non-string input unchanged: $description", ({ value }) => {
    expect(normalizeUsername(value)).toBe(value);
  });
});
