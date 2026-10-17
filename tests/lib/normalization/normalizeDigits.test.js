import { describe, expect, it } from "vitest";

import { normalizeDigits } from "@/lib/normalization/normalizeDigits";

describe("normalizeDigits", () => {
  // Persian digits (۰ تا ۹) must be converted to ASCII digits (0 تا 9).
  it("converts all Persian digits to ASCII digits", () => {
    expect(normalizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  // Arabic-Indic digits (٠ تا ٩) must also be converted to ASCII digits.
  it("converts all Arabic-Indic digits to ASCII digits", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  // Both digit systems may occur together in the same string.
  it.each([
    {
      input: "کد تأیید: ۱۲۳۴۵۶",
      expected: "کد تأیید: 123456",
    },
    {
      input: "کد تأیید: ١٢٣٤٥٦",
      expected: "کد تأیید: 123456",
    },
    {
      input: "۱۲۳٤٥٦",
      expected: "123456",
    },
    {
      input: "۱۲٣٤٥٦ و ١٢٣٤٥٦",
      expected: "123456 و 123456",
    },
  ])(
    "normalizes mixed text and digit systems: $input",
    ({ input, expected }) => {
      expect(normalizeDigits(input)).toBe(expected);
    }
  );

  // ASCII digits and unrelated characters must remain unchanged.
  it.each([
    { input: "0123456789", expected: "0123456789" },
    { input: "Loghmeh-123", expected: "Loghmeh-123" },
    { input: "کد-۱۲۳ و ABC-456", expected: "کد-123 و ABC-456" },
    { input: "۱۲۳@٤٥٦.com", expected: "123@456.com" },
    { input: "۱۲۳ १२३ ١٢٣", expected: "123 १२३ 123" },
    { input: "", expected: "" },
  ])("preserves unrelated characters: $input", ({ input, expected }) => {
    expect(normalizeDigits(input)).toBe(expected);
  });

  // Non-string inputs must be returned unchanged, without coercion.
  it.each([
    { description: "null", value: null },
    { description: "undefined", value: undefined },
    { description: "number", value: 123 },
    { description: "boolean", value: true },
    { description: "plain object", value: { value: "۱۲۳" } },
    { description: "array", value: ["۱۲۳"] },
    { description: "String object", value: Object("۱۲۳") },
    { description: "symbol", value: Symbol("۱۲۳") },
    { description: "bigint", value: 123n },
  ])("returns a non-string input unchanged: $description", ({ value }) => {
    expect(normalizeDigits(value)).toBe(value);
  });
});
