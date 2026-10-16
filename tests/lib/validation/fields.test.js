import { describe, expect, it } from "vitest";

import { pickAllowedFields } from "@/lib/validation/fields";

// ============================================================================
// pickAllowedFields
// ============================================================================

describe("pickAllowedFields", () => {
  // --------------------------------------------------------------------------
  // Allowed Fields
  // --------------------------------------------------------------------------

  it("returns only explicitly allowed own properties", () => {
    const input = {
      title: "Ash Reshteh",
      description: "A traditional Persian dish",
      authorId: "user-123",
      isApproved: true,
    };

    const result = pickAllowedFields(input, ["title", "description"]);

    expect(result).toEqual({
      title: "Ash Reshteh",
      description: "A traditional Persian dish",
    });
  });

  it("ignores allowed fields that do not exist on the input object", () => {
    const input = {
      title: "Ash Reshteh",
    };

    const result = pickAllowedFields(input, [
      "title",
      "description",
      "authorId",
    ]);

    expect(result).toEqual({
      title: "Ash Reshteh",
    });
  });

  it("returns an empty object when allowedFields is an empty array", () => {
    expect(pickAllowedFields({ title: "Ash Reshteh" }, [])).toEqual({});
  });

  it("returns an empty object when no allowed fields exist on the input", () => {
    expect(
      pickAllowedFields({ title: "Ash Reshteh" }, ["description", "authorId"])
    ).toEqual({});
  });

  // --------------------------------------------------------------------------
  // Values and References
  // --------------------------------------------------------------------------

  it("preserves allowed values without validating or transforming them", () => {
    const input = {
      title: 123,
      isPublished: false,
      description: null,
      rating: 0,
      tags: [],
    };

    const result = pickAllowedFields(input, [
      "title",
      "isPublished",
      "description",
      "rating",
      "tags",
    ]);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it("preserves references to nested objects", () => {
    const ingredients = ["spinach", "beans"];

    const input = {
      title: "Ash Reshteh",
      ingredients,
    };

    const result = pickAllowedFields(input, ["ingredients"]);

    expect(result.ingredients).toBe(ingredients);
  });

  it("does not mutate the input object", () => {
    const input = {
      title: "Ash Reshteh",
      authorId: "user-123",
    };

    const originalInput = { ...input };

    const result = pickAllowedFields(input, ["title"]);

    expect(input).toEqual(originalInput);
    expect(result).not.toBe(input);
    expect(result).toEqual({
      title: "Ash Reshteh",
    });
  });

  // --------------------------------------------------------------------------
  // Own Properties
  // --------------------------------------------------------------------------

  it("does not copy inherited properties", () => {
    const parent = {
      role: "ADMIN",
    };

    const input = Object.create(parent);
    input.username = "ali";

    const result = pickAllowedFields(input, ["username", "role"]);

    expect(result).toEqual({
      username: "ali",
    });

    expect(Object.prototype.hasOwnProperty.call(result, "role")).toBe(false);
  });

  it("supports objects with a null prototype", () => {
    const input = Object.assign(Object.create(null), {
      title: "Ash Reshteh",
      authorId: "user-123",
    });

    const result = pickAllowedFields(input, ["title"]);

    expect(result).toEqual({
      title: "Ash Reshteh",
    });
  });

  // --------------------------------------------------------------------------
  // Invalid Input Objects
  // --------------------------------------------------------------------------

  it.each([
    { label: "null", object: null },
    { label: "undefined", object: undefined },
    { label: "a string", object: "invalid" },
    { label: "a number", object: 123 },
    { label: "zero", object: 0 },
    { label: "false", object: false },
    { label: "an empty string", object: "" },
    { label: "an array", object: [] },
  ])("returns an empty object when the input is $label", ({ object }) => {
    expect(pickAllowedFields(object, ["title"])).toEqual({});
  });

  it("validates allowedFields before handling an invalid input object", () => {
    expect(() => pickAllowedFields(null, "title")).toThrow(
      "allowedFields must be an array."
    );
  });

  // --------------------------------------------------------------------------
  // Invalid allowedFields
  // --------------------------------------------------------------------------

  it.each([
    { label: "undefined", allowedFields: undefined },
    { label: "null", allowedFields: null },
    { label: "a string", allowedFields: "title" },
    { label: "a number", allowedFields: 123 },
    { label: "an object", allowedFields: { title: true } },
    { label: "a Set", allowedFields: new Set(["title"]) },
  ])("throws TypeError when allowedFields is $label", ({ allowedFields }) => {
    expect(() =>
      pickAllowedFields({ title: "Ash Reshteh" }, allowedFields)
    ).toThrow(TypeError);
  });

  it("provides the expected message when allowedFields is not an array", () => {
    expect(() => pickAllowedFields({}, "title")).toThrow(
      "allowedFields must be an array."
    );
  });

  it.each([
    { label: "undefined", field: undefined },
    { label: "null", field: null },
    { label: "a number", field: 123 },
    { label: "an object", field: {} },
    { label: "an empty string", field: "" },
  ])("throws TypeError when allowedFields contains $label", ({ field }) => {
    expect(() =>
      pickAllowedFields({ title: "Ash Reshteh" }, ["title", field])
    ).toThrow(TypeError);
  });

  it("provides the expected message when an allowed field is invalid", () => {
    expect(() => pickAllowedFields({}, ["title", ""])).toThrow(
      "allowedFields must contain non-empty strings."
    );
  });

  // --------------------------------------------------------------------------
  // Special Property Names
  // --------------------------------------------------------------------------

  it("copies an explicitly allowed own __proto__ property without changing the result prototype", () => {
    const input = {
      title: "Ash Reshteh",
    };

    Object.defineProperty(input, "__proto__", {
      value: "ordinary-property-value",
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const result = pickAllowedFields(input, ["__proto__"]);

    expect(Object.prototype.hasOwnProperty.call(result, "__proto__")).toBe(
      true
    );

    expect(result.__proto__).toBe("ordinary-property-value");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
