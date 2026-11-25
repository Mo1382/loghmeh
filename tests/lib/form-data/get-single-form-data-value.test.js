import { describe, expect, it } from "vitest";

import { getSingleFormDataValue } from "@/lib/form-data/get-single-form-data-value";

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

function createFormData(entries = []) {
  const formData = new FormData();

  for (const [name, value] of entries) {
    formData.append(name, value);
  }

  return formData;
}

/*
 * ============================================================================
 * Missing Fields
 * ============================================================================
 */

describe("Missing fields", () => {
  it("returns undefined when the field does not exist", () => {
    const formData = createFormData([
      ["username", "test_user"],
      ["email", "test@example.com"],
    ]);

    expect(getSingleFormDataValue(formData, "password")).toBeUndefined();
  });

  it("returns undefined when FormData is empty", () => {
    const formData = new FormData();

    expect(getSingleFormDataValue(formData, "username")).toBeUndefined();
  });
});

/*
 * ============================================================================
 * Single Values
 * ============================================================================
 */

describe("Single values", () => {
  it("returns the original string value", () => {
    const value = "test@example.com";

    const formData = createFormData([["email", value]]);

    expect(getSingleFormDataValue(formData, "email")).toBe(value);
  });

  it("preserves an empty string instead of returning undefined", () => {
    const formData = createFormData([["username", ""]]);

    expect(getSingleFormDataValue(formData, "username")).toBe("");
  });

  it("returns the File entry stored in FormData with its original content", async () => {
    const formData = new FormData();

    const blob = new Blob(["test file content"], {
      type: "text/plain",
    });

    formData.append("attachment", blob, "test-file.txt");

    const result = getSingleFormDataValue(formData, "attachment");

    expect(result).toBeInstanceOf(Blob);

    expect(result).toHaveProperty("name", "test-file.txt");
    expect(result).toHaveProperty("type", "text/plain");

    await expect(result.text()).resolves.toBe("test file content");
  });
});

/*
 * ============================================================================
 * Duplicate Values
 * ============================================================================
 */

describe("Duplicate values", () => {
  it("returns null when the field contains identical values", () => {
    const formData = createFormData([
      ["email", "test@example.com"],
      ["email", "test@example.com"],
    ]);

    expect(getSingleFormDataValue(formData, "email")).toBeNull();
  });

  it("returns null when the field contains different values", () => {
    const formData = createFormData([
      ["email", "first@example.com"],
      ["email", "second@example.com"],
    ]);

    expect(getSingleFormDataValue(formData, "email")).toBeNull();
  });

  it("returns null when the field contains more than two values", () => {
    const formData = createFormData([
      ["username", "first_user"],
      ["username", "second_user"],
      ["username", "third_user"],
    ]);

    expect(getSingleFormDataValue(formData, "username")).toBeNull();
  });

  it("returns null when duplicate values contain both strings and Files", () => {
    const formData = new FormData();

    formData.append("attachment", "unexpected-value");

    formData.append(
      "attachment",
      new Blob(["file content"], {
        type: "text/plain",
      }),
      "test-file.txt"
    );

    expect(getSingleFormDataValue(formData, "attachment")).toBeNull();
  });
});
