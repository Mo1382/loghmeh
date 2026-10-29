import { describe, expect, test } from "vitest";

import {
  updateUserProfileSchema,
  usernameSchema,
} from "@/validations/user.validation";

/**
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

function expectValid(schema, value) {
  const result = schema.safeParse(value);

  expect(result.success).toBe(true);

  return result;
}

function expectInvalid(schema, value) {
  const result = schema.safeParse(value);

  expect(result.success).toBe(false);

  return result;
}

function hasIssueAtPath(result, path) {
  return result.error.issues.some(
    (issue) =>
      issue.path.length === path.length &&
      issue.path.every((value, index) => value === path[index])
  );
}

/**
 * ============================================================================
 * usernameSchema
 * ============================================================================
 */

describe("usernameSchema", () => {
  test("accepts a valid username", () => {
    expectValid(usernameSchema, "Cook_123");
  });

  test("rejects a non-string username", () => {
    const result = expectInvalid(usernameSchema, 123);

    expect(hasIssueAtPath(result, [])).toBe(true);
  });

  test("trims surrounding whitespace", () => {
    const result = expectValid(usernameSchema, "  Cook_123  ");

    expect(result.data).toBe("Cook_123");
  });

  test("normalizes Arabic Yeh to Persian Yeh", () => {
    const result = expectValid(usernameSchema, "علي");

    expect(result.data).toBe("علی");
  });

  test("normalizes Arabic Kaf to Persian Kaf", () => {
    const result = expectValid(usernameSchema, "كوك");

    expect(result.data).toBe("کوک");
  });

  test("preserves username letter casing", () => {
    const result = expectValid(usernameSchema, "CoOk_123");

    expect(result.data).toBe("CoOk_123");
  });

  test("accepts exactly 3 characters", () => {
    expectValid(usernameSchema, "abc");
  });

  test("rejects fewer than 3 characters", () => {
    const result = expectInvalid(usernameSchema, "ab");

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "too_small",
        minimum: 3,
        path: [],
      })
    );
  });

  test("rejects a username that becomes too short after trimming", () => {
    expectInvalid(usernameSchema, "  ab  ");
  });

  test("rejects a whitespace-only username", () => {
    expectInvalid(usernameSchema, "   ");
  });

  test("accepts exactly 30 characters", () => {
    expectValid(usernameSchema, "a".repeat(30));
  });

  test("rejects more than 30 characters", () => {
    const result = expectInvalid(usernameSchema, "a".repeat(31));

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "too_big",
        maximum: 30,
        path: [],
      })
    );
  });

  test("accepts supported Persian and English characters", () => {
    expectValid(usernameSchema, "آشپز_Cook123");
  });

  test.each([
    "Cook Master",
    "Cook-Master",
    "Cook@123",
    "Cook.123",
    "Cook/123",
    "Cook!123",
    "Cook#123",
  ])("rejects unsupported username characters: %s", (username) => {
    expectInvalid(usernameSchema, username);
  });
});

/**
 * ============================================================================
 * updateUserProfileSchema
 * ============================================================================
 *
 * The profile update object and socialLinks object may be empty.
 * Explicitly supplied undefined values remain invalid.
 */

describe("updateUserProfileSchema", () => {
  describe("General object behavior", () => {
    test("accepts an empty update object", () => {
      const result = expectValid(updateUserProfileSchema, {});

      expect(result.data).toEqual({});
    });

    test("accepts an update containing only bio", () => {
      const result = expectValid(updateUserProfileSchema, {
        bio: "Cooking",
      });

      expect(result.data.bio).toBe("Cooking");
    });

    test("accepts an update containing only avatar", () => {
      const result = expectValid(updateUserProfileSchema, {
        avatar: "https://example.com/avatar.jpg",
      });

      expect(result.data.avatar).toBe("https://example.com/avatar.jpg");
    });

    test("accepts an update containing only socialLinks", () => {
      const result = expectValid(updateUserProfileSchema, {
        socialLinks: {
          instagram: "https://instagram.com/test-user",
        },
      });

      expect(result.data.socialLinks.instagram).toBe(
        "https://instagram.com/test-user"
      );
    });

    test("rejects unknown top-level fields", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        bio: "Cooking",
        unexpectedField: true,
      });

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: ["unexpectedField"],
        })
      );
    });

    test.each([
      ["username", "NewUsername"],
      ["title", "COOK"],
      ["role", "ADMIN"],
      ["accountStatus", "ACTIVE"],
      ["emailVerified", true],
      ["stats", { recipeCount: 10 }],
      ["createdAt", new Date()],
      ["updatedAt", new Date()],
    ])("rejects system-managed field %s", (field, value) => {
      const result = expectInvalid(updateUserProfileSchema, {
        [field]: value,
      });

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: [field],
        })
      );
    });
  });

  describe("Explicit undefined values", () => {
    test.each(["avatar", "bio", "socialLinks"])(
      "rejects explicitly undefined %s",
      (field) => {
        const result = expectInvalid(updateUserProfileSchema, {
          [field]: undefined,
        });

        expect(hasIssueAtPath(result, [field])).toBe(true);
      }
    );
  });

  /**
   * --------------------------------------------------------------------------
   * Avatar
   * --------------------------------------------------------------------------
   */

  describe("avatar", () => {
    test("accepts a valid HTTPS URL", () => {
      expectValid(updateUserProfileSchema, {
        avatar: "https://example.com/avatar.jpg",
      });
    });

    test("trims surrounding whitespace", () => {
      const result = expectValid(updateUserProfileSchema, {
        avatar: "  https://example.com/avatar.jpg  ",
      });

      expect(result.data.avatar).toBe("https://example.com/avatar.jpg");
    });

    test("accepts null to clear the avatar", () => {
      const result = expectValid(updateUserProfileSchema, {
        avatar: null,
      });

      expect(result.data.avatar).toBeNull();
    });

    test("rejects an empty avatar string", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        avatar: "",
      });

      expect(hasIssueAtPath(result, ["avatar"])).toBe(true);
    });

    test("rejects HTTP URLs with the HTTPS validation message", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        avatar: "http://example.com/avatar.jpg",
      });

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["avatar"],
          message: "نشانی تصویر پروفایل باید از HTTPS استفاده کند.",
        })
      );
    });

    test.each([
      "https://user@example.com/avatar.jpg",
      "https://:pass@example.com/avatar.jpg",
      "https://user:pass@example.com/avatar.jpg",
    ])("rejects HTTPS URLs containing credentials: %s", (url) => {
      const result = expectInvalid(updateUserProfileSchema, {
        avatar: url,
      });

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["avatar"],
          message: "نشانی تصویر پروفایل باید از HTTPS استفاده کند.",
        })
      );
    });

    test("rejects malformed URLs", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        avatar: "not-a-url",
      });

      expect(hasIssueAtPath(result, ["avatar"])).toBe(true);
    });

    test("rejects non-string, non-null values", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        avatar: 123,
      });

      expect(hasIssueAtPath(result, ["avatar"])).toBe(true);
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Bio
   * --------------------------------------------------------------------------
   */

  describe("bio", () => {
    test("accepts a valid bio", () => {
      const result = expectValid(updateUserProfileSchema, {
        bio: "My cooking profile",
      });

      expect(result.data.bio).toBe("My cooking profile");
    });

    test("trims surrounding whitespace", () => {
      const result = expectValid(updateUserProfileSchema, {
        bio: "  My cooking profile  ",
      });

      expect(result.data.bio).toBe("My cooking profile");
    });

    test("accepts exactly 300 characters", () => {
      const result = expectValid(updateUserProfileSchema, {
        bio: "a".repeat(300),
      });

      expect(result.data.bio).toHaveLength(300);
    });

    test("rejects more than 300 characters", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        bio: "a".repeat(301),
      });

      expect(hasIssueAtPath(result, ["bio"])).toBe(true);
    });

    test("accepts an empty bio string", () => {
      const result = expectValid(updateUserProfileSchema, {
        bio: "",
      });

      expect(result.data.bio).toBe("");
    });

    test("rejects a non-string bio", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        bio: 123,
      });

      expect(hasIssueAtPath(result, ["bio"])).toBe(true);
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Social links object
   * --------------------------------------------------------------------------
   */

  describe("socialLinks object", () => {
    test("allows socialLinks to be omitted", () => {
      expectValid(updateUserProfileSchema, {
        bio: "Cooking",
      });
    });

    test("accepts an empty socialLinks object", () => {
      const result = expectValid(updateUserProfileSchema, {
        socialLinks: {},
      });

      expect(result.data.socialLinks).toEqual({});
    });

    test("accepts empty socialLinks alongside another field", () => {
      const result = expectValid(updateUserProfileSchema, {
        bio: "Cooking",
        socialLinks: {},
      });

      expect(result.data.bio).toBe("Cooking");
      expect(result.data.socialLinks).toEqual({});
    });

    test("rejects null socialLinks", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: null,
      });

      expect(hasIssueAtPath(result, ["socialLinks"])).toBe(true);
    });

    test.each(["instagram", "telegram", "x"])(
      "rejects explicitly undefined %s",
      (field) => {
        const result = expectInvalid(updateUserProfileSchema, {
          socialLinks: {
            [field]: undefined,
          },
        });

        expect(hasIssueAtPath(result, ["socialLinks", field])).toBe(true);

        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            code: "custom",
            path: ["socialLinks", field],
            message: "مقدار پیوند اجتماعی نمی‌تواند undefined باشد.",
          })
        );
      }
    );

    test("accepts null values for all supported social links", () => {
      const result = expectValid(updateUserProfileSchema, {
        socialLinks: {
          instagram: null,
          telegram: null,
          x: null,
        },
      });

      expect(result.data.socialLinks).toEqual({
        instagram: null,
        telegram: null,
        x: null,
      });
    });

    test("rejects unknown social-link fields", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          instagram: "https://instagram.com/test-user",
          facebook: "https://facebook.com/test-user",
        },
      });

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "unrecognized_keys",
          path: ["socialLinks"],
          keys: ["facebook"],
        })
      );
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Social URL normalization
   * --------------------------------------------------------------------------
   */

  describe("Social URL normalization", () => {
    test.each([
      {
        field: "instagram",
        url: "https://instagram.com/test-user",
      },
      {
        field: "telegram",
        url: "https://t.me/test-user",
      },
      {
        field: "x",
        url: "https://x.com/test-user",
      },
    ])("trims the $field URL", ({ field, url }) => {
      const result = expectValid(updateUserProfileSchema, {
        socialLinks: {
          [field]: `  ${url}  `,
        },
      });

      expect(result.data.socialLinks[field]).toBe(url);
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Instagram URLs
   * --------------------------------------------------------------------------
   */

  describe("Instagram URL", () => {
    test.each([
      "https://instagram.com/test-user",
      "https://www.instagram.com/test-user",
    ])("accepts %s", (url) => {
      expectValid(updateUserProfileSchema, {
        socialLinks: {
          instagram: url,
        },
      });
    });

    test.each([
      "",
      "not-a-url",
      "http://instagram.com/test-user",
      "https://example.com/test-user",
      "https://instagram.com.evil.example/test-user",
      "https://evil-instagram.com/test-user",
    ])("rejects invalid Instagram URL: %s", (url) => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          instagram: url,
        },
      });

      expect(hasIssueAtPath(result, ["socialLinks", "instagram"])).toBe(true);
    });

    test("rejects a non-string Instagram URL", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          instagram: 123,
        },
      });

      expect(hasIssueAtPath(result, ["socialLinks", "instagram"])).toBe(true);
    });
  });

  /**
   * --------------------------------------------------------------------------
   * Telegram URLs
   * --------------------------------------------------------------------------
   */

  describe("Telegram URL", () => {
    test.each(["https://t.me/test-user", "https://telegram.me/test-user"])(
      "accepts %s",
      (url) => {
        expectValid(updateUserProfileSchema, {
          socialLinks: {
            telegram: url,
          },
        });
      }
    );

    test.each([
      "",
      "not-a-url",
      "http://t.me/test-user",
      "https://example.com/test-user",
      "https://t.me.evil.example/test-user",
      "https://evil-t.me/test-user",
    ])("rejects invalid Telegram URL: %s", (url) => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          telegram: url,
        },
      });

      expect(hasIssueAtPath(result, ["socialLinks", "telegram"])).toBe(true);
    });

    test("rejects a non-string Telegram URL", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          telegram: 123,
        },
      });

      expect(hasIssueAtPath(result, ["socialLinks", "telegram"])).toBe(true);
    });
  });

  /**
   * --------------------------------------------------------------------------
   * X URLs
   * --------------------------------------------------------------------------
   */

  describe("X URL", () => {
    test.each(["https://x.com/test-user", "https://twitter.com/test-user"])(
      "accepts %s",
      (url) => {
        expectValid(updateUserProfileSchema, {
          socialLinks: {
            x: url,
          },
        });
      }
    );

    test.each([
      "",
      "not-a-url",
      "http://x.com/test-user",
      "https://example.com/test-user",
      "https://x.com.example.org/test-user",
      "https://evil-x.com/test-user",
      "https://twitter.com.evil.example/test-user",
    ])("rejects invalid X URL: %s", (url) => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          x: url,
        },
      });

      expect(hasIssueAtPath(result, ["socialLinks", "x"])).toBe(true);
    });

    test("rejects a non-string X URL", () => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          x: 123,
        },
      });

      expect(hasIssueAtPath(result, ["socialLinks", "x"])).toBe(true);
    });
  });
});
