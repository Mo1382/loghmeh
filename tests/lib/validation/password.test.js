import { describe, expect, it } from "vitest";

import {
  isWellFormedPassword,
  isWithinBcryptByteLimit,
} from "@/lib/validation/password";

const NON_STRING_VALUES = [
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
    value: Symbol("password"),
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
  {
    description: "a String object",
    value: Object("Password"),
  },
];

describe("isWellFormedPassword()", () => {
  describe("well-formed UTF-16 strings", () => {
    it.each([
      {
        description: "an empty string",
        value: "",
      },
      {
        description: "an ASCII string",
        value: "Password123",
      },
      {
        description: "a Persian string",
        value: "رمزعبور",
      },
      {
        description: "a valid surrogate pair",
        value: "😀",
      },
      {
        description: "a surrogate pair at the beginning",
        value: "😀Password",
      },
      {
        description: "a surrogate pair in the middle",
        value: "Pass😀word",
      },
      {
        description: "a surrogate pair at the end",
        value: "Password😀",
      },
      {
        description: "multiple valid surrogate pairs",
        value: "😀🍕🚀",
      },
      {
        description: "a string combining ASCII, Persian, and emoji characters",
        value: "Passرمز😀word",
      },
    ])("accepts $description", ({ value }) => {
      expect(isWellFormedPassword(value)).toBe(true);
    });
  });

  describe("unpaired high surrogates", () => {
    it.each([
      {
        description: "at the beginning",
        value: "\uD800Password",
      },
      {
        description: "in the middle",
        value: "Pass\uD800word",
      },
      {
        description: "at the end",
        value: "Password\uD800",
      },
    ])("rejects an unpaired high surrogate $description", ({ value }) => {
      expect(isWellFormedPassword(value)).toBe(false);
    });
  });

  describe("unpaired low surrogates", () => {
    it.each([
      {
        description: "at the beginning",
        value: "\uDC00Password",
      },
      {
        description: "in the middle",
        value: "Pass\uDC00word",
      },
      {
        description: "at the end",
        value: "Password\uDC00",
      },
    ])("rejects an unpaired low surrogate $description", ({ value }) => {
      expect(isWellFormedPassword(value)).toBe(false);
    });
  });

  describe("malformed surrogate sequences", () => {
    it.each([
      {
        description: "consecutive high surrogates",
        value: "\uD800\uD801Password",
      },
      {
        description: "consecutive low surrogates",
        value: "\uDC00\uDC01Password",
      },
      {
        description: "a low surrogate followed by a high surrogate",
        value: "\uDC00\uD800Password",
      },
      {
        description: "a high and low surrogate separated by another character",
        value: "\uD800A\uDC00Password",
      },
    ])("rejects $description", ({ value }) => {
      expect(isWellFormedPassword(value)).toBe(false);
    });
  });

  describe("non-string inputs", () => {
    it.each(NON_STRING_VALUES)("rejects $description", ({ value }) => {
      expect(isWellFormedPassword(value)).toBe(false);
    });
  });
});

describe("isWithinBcryptByteLimit()", () => {
  describe("passwords within the 72-byte limit", () => {
    it("accepts an empty string", () => {
      expect(isWithinBcryptByteLimit("")).toBe(true);
    });

    it("accepts an ASCII password shorter than 72 bytes", () => {
      expect(isWithinBcryptByteLimit("a".repeat(71))).toBe(true);
    });

    it("accepts an ASCII password that is exactly 72 bytes long", () => {
      expect(isWithinBcryptByteLimit("a".repeat(72))).toBe(true);
    });

    it("accepts 36 two-byte Persian characters", () => {
      expect(isWithinBcryptByteLimit("ا".repeat(36))).toBe(true);
    });

    it("accepts 24 three-byte Unicode characters", () => {
      expect(isWithinBcryptByteLimit("€".repeat(24))).toBe(true);
    });

    it("accepts 18 four-byte emoji characters", () => {
      expect(isWithinBcryptByteLimit("😀".repeat(18))).toBe(true);
    });

    it("accepts a mixed password that is exactly 72 UTF-8 bytes long", () => {
      const password = `${"a".repeat(68)}😀`;

      expect(isWithinBcryptByteLimit(password)).toBe(true);
    });

    it("accepts a password combining one-, two-, three-, and four-byte characters", () => {
      const password = `${"a".repeat(59)}${"ا".repeat(3)}€😀`;

      expect(isWithinBcryptByteLimit(password)).toBe(true);
    });
  });

  describe("passwords exceeding the 72-byte limit", () => {
    it("rejects an ASCII password that is 73 bytes long", () => {
      expect(isWithinBcryptByteLimit("a".repeat(73))).toBe(false);
    });

    it("rejects 37 two-byte Persian characters", () => {
      expect(isWithinBcryptByteLimit("ا".repeat(37))).toBe(false);
    });

    it("rejects 25 three-byte Unicode characters", () => {
      expect(isWithinBcryptByteLimit("€".repeat(25))).toBe(false);
    });

    it("rejects 19 four-byte emoji characters", () => {
      expect(isWithinBcryptByteLimit("😀".repeat(19))).toBe(false);
    });

    it("rejects a mixed password that is 73 UTF-8 bytes long", () => {
      const password = `${"a".repeat(69)}😀`;

      expect(isWithinBcryptByteLimit(password)).toBe(false);
    });
  });

  describe("non-string inputs", () => {
    it.each(NON_STRING_VALUES)("rejects $description", ({ value }) => {
      expect(isWithinBcryptByteLimit(value)).toBe(false);
    });
  });

  describe("independent validation responsibilities", () => {
    it("checks byte length independently of UTF-16 validity", () => {
      const password = "\uD800";

      expect(isWellFormedPassword(password)).toBe(false);

      expect(isWithinBcryptByteLimit(password)).toBe(true);
    });
  });
});
