import { describe, expect, test } from "vitest";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginUserSchema,
  registerUserSchema,
  resetPasswordSchema,
  verificationCodeSchema,
} from "@/validations/auth.validation";

import { updateUserProfileSchema } from "@/validations/user.validation";

import { USER_TITLES } from "@/constants/enums";

/**
 * ============================================================================
 * Test Helpers
 * ============================================================================
 *
 * Shared helpers keep the individual tests focused on the behavior being
 * verified instead of repeating the same safeParse/assertion logic.
 */
/**
 * Assert that a schema accepts the provided input.
 *
 * The parsed result is returned so tests can also verify transformed output.
 */
function expectValid(schema, value) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(true);
  return result;
}

/**
 * Assert that a schema rejects the provided input.
 *
 * The failed result is returned so tests can inspect validation issues.
 */
function expectInvalid(schema, value) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
  return result;
}

/**
 * Check whether a validation issue exists at an exact path.
 *
 * Exact path matching prevents a nested or similarly named field from causing
 * a false-positive assertion.
 */
function hasIssueAtPath(result, path) {
  return result.error.issues.some(
    (issue) =>
      issue.path.length === path.length &&
      issue.path.every((value, index) => value === path[index])
  );
}

/**
 * Build a valid registration payload that can be overridden per test.
 */
function createValidRegistration(overrides = {}) {
  return {
    username: "Cook_123",
    email: "test@example.com",
    password: "Password123",
    ...overrides,
  };
}

/**
 * Build a valid login payload that can be overridden per test.
 */
function createValidLogin(overrides = {}) {
  return {
    identifier: "Cook_123",
    password: "CurrentPassword123",
    ...overrides,
  };
}

/**
 * Build a valid password-reset payload that can be overridden per test.
 */
function createValidResetPassword(overrides = {}) {
  return {
    newPassword: "NewPassword123",
    confirmPassword: "NewPassword123",
    ...overrides,
  };
}

/**
 * Build a valid password-change payload that can be overridden per test.
 */
function createValidChangePassword(overrides = {}) {
  return {
    currentPassword: "CurrentPassword123",
    newPassword: "NewPassword123",
    confirmPassword: "NewPassword123",
    ...overrides,
  };
}

/**
 * ============================================================================
 * registerUserSchema
 * ============================================================================
 *
 * Covers:
 * - Required registration fields
 * - Username normalization and format rules
 * - Email normalization and format rules
 * - New-password length rules
 * - User title defaults and allowed values
 * - Strict object behavior
 */
describe("registerUserSchema", () => {
  test("accepts a valid registration payload", () => {
    expectValid(registerUserSchema, createValidRegistration());
  });

  // All required registration fields must be present.
  test.each(["username", "email", "password"])(
    "rejects registration without %s",
    (field) => {
      const data = createValidRegistration();
      delete data[field];
      const result = expectInvalid(registerUserSchema, data);
      expect(hasIssueAtPath(result, [field])).toBe(true);
    }
  );

  // Username must be supplied as a string.
  test("rejects a non-string username", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        username: 123,
      })
    );
    expect(hasIssueAtPath(result, ["username"])).toBe(true);
  });

  // Leading and trailing whitespace is removed before validation.
  test("trims username", () => {
    const result = expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "  Cook_123  ",
      })
    );
    expect(result.data.username).toBe("Cook_123");
  });

  // Arabic Yeh is normalized to Persian Yeh for canonical usernames.
  test("normalizes Arabic ي to Persian ی in username", () => {
    const result = expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "علي",
      })
    );
    expect(result.data.username).toBe("علی");
  });

  // Arabic Kaf is normalized to Persian Kaf for canonical usernames.
  test("normalizes Arabic ك to Persian ک in username", () => {
    const result = expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "كوك",
      })
    );
    expect(result.data.username).toBe("کوک");
  });

  // Username normalization must not force lowercase casing.
  test("preserves username case", () => {
    const result = expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "CoOk_123",
      })
    );
    expect(result.data.username).toBe("CoOk_123");
  });

  // Supported username characters include Persian/English letters, digits and
  // underscore.
  test("accepts Persian letters, English letters, digits and underscore", () => {
    expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "آشپز_123",
      })
    );
  });

  // Minimum username length is inclusive.
  test("accepts username with exactly 3 characters", () => {
    expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "abc",
      })
    );
  });

  test("rejects username shorter than 3 characters", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        username: "ab",
      })
    );
    expect(hasIssueAtPath(result, ["username"])).toBe(true);
  });

  // Maximum username length is inclusive.
  test("accepts username with exactly 30 characters", () => {
    expectValid(
      registerUserSchema,
      createValidRegistration({
        username: "a".repeat(30),
      })
    );
  });

  test("rejects username longer than 30 characters", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        username: "a".repeat(31),
      })
    );
    expect(hasIssueAtPath(result, ["username"])).toBe(true);
  });

  // Characters outside the username contract must be rejected.
  test.each([
    "Cook Master",
    "Cook-Master",
    "Cook@123",
    "Cook.123",
    "Cook/123",
    "Cook!123",
    "Cook#123",
  ])("rejects invalid username: %s", (username) => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({ username })
    );
    expect(hasIssueAtPath(result, ["username"])).toBe(true);
  });

  // Email is normalized by trimming and lowercasing.
  test("trims and lowercases email", () => {
    const result = expectValid(
      registerUserSchema,
      createValidRegistration({
        email: "  TEST@Example.COM  ",
      })
    );
    expect(result.data.email).toBe("test@example.com");
  });

  // Maximum email length is accepted.
  test("accepts a 254-character email", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(93)}aaa`;
    const email = `${localPart}@${domain}`;
    expect(email.length).toBe(254);
    expectValid(registerUserSchema, createValidRegistration({ email }));
  });

  // Values above the maximum email length must be rejected.
  test("rejects a 255-character email", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(94)}aa`;
    const email = `${localPart}@${domain}`;
    expect(email.length).toBe(255);
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({ email })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "too_big",
        maximum: 254,
        path: ["email"],
      })
    );
  });

  // Representative malformed email formats.
  test.each([
    "invalid-email",
    "user@",
    "@example.com",
    "user.example.com",
    "user@example",
    "user name@example.com",
    "user@example..com",
    "",
  ])("rejects invalid email: %s", (email) => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({ email })
    );
    expect(hasIssueAtPath(result, ["email"])).toBe(true);
  });

  // New passwords require at least 8 characters.
  test("accepts an 8-character password", () => {
    expectValid(
      registerUserSchema,
      createValidRegistration({
        password: "12345678",
      })
    );
  });

  // Maximum new-password length is inclusive.
  test("accepts a 128-character password", () => {
    expectValid(
      registerUserSchema,
      createValidRegistration({
        password: "a".repeat(128),
      })
    );
  });

  test("rejects password shorter than 8 characters", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        password: "1234567",
      })
    );
    expect(hasIssueAtPath(result, ["password"])).toBe(true);
  });

  test("rejects password longer than 128 characters", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        password: "a".repeat(129),
      })
    );
    expect(hasIssueAtPath(result, ["password"])).toBe(true);
  });

  // Title defaults to a regular user when it is omitted.
  test("uses USER title by default", () => {
    const result = expectValid(registerUserSchema, createValidRegistration());
    expect(result.data.title).toBe(USER_TITLES.USER);
  });

  // Every enum-defined title should be accepted.
  test.each(Object.values(USER_TITLES))("accepts valid title: %s", (title) => {
    expectValid(registerUserSchema, createValidRegistration({ title }));
  });

  test("rejects an invalid title", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        title: "INVALID_TITLE",
      })
    );
    expect(hasIssueAtPath(result, ["title"])).toBe(true);
  });

  // Registration payloads must not contain fields outside the schema contract.
  test("rejects unknown fields because the schema is strict", () => {
    const result = expectInvalid(
      registerUserSchema,
      createValidRegistration({
        unexpectedField: true,
      })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["unexpectedField"],
      })
    );
  });
});

/**
 * ============================================================================
 * loginUserSchema
 * ============================================================================
 *
 * Covers:
 * - Username/email identifier handling
 * - Identifier normalization
 * - Union branch boundaries
 * - Existing-password validation
 * - Strict object behavior
 */
describe("loginUserSchema", () => {
  test("accepts a username identifier", () => {
    expectValid(loginUserSchema, createValidLogin());
  });

  test.each(["identifier", "password"])("rejects login without %s", (field) => {
    const data = createValidLogin();
    delete data[field];

    const result = expectInvalid(loginUserSchema, data);

    expect(hasIssueAtPath(result, [field])).toBe(true);
  });

  test("accepts an email identifier", () => {
    expectValid(
      loginUserSchema,
      createValidLogin({
        identifier: "test@example.com",
      })
    );
  });

  // Identifier must be a string before either union branch can validate it.
  test("rejects a non-string identifier", () => {
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({ identifier: 123 })
    );
    expect(hasIssueAtPath(result, ["identifier"])).toBe(true);
  });

  // Username branch applies trimming and canonical Arabic/Persian normalization.
  test("trims and normalizes username identifier", () => {
    const result = expectValid(
      loginUserSchema,
      createValidLogin({
        identifier: "  كوك  ",
      })
    );
    expect(result.data.identifier).toBe("کوک");
  });

  // Email branch applies trimming and lowercasing.
  test("trims and lowercases email identifier", () => {
    const result = expectValid(
      loginUserSchema,
      createValidLogin({
        identifier: "  TEST@Example.COM  ",
      })
    );
    expect(result.data.identifier).toBe("test@example.com");
  });

  test("accepts a 30-character username identifier", () => {
    expectValid(
      loginUserSchema,
      createValidLogin({
        identifier: "a".repeat(30),
      })
    );
  });

  // Inspect the nested union error to ensure the username branch specifically
  // reports the 30-character maximum.
  test("rejects username identifier longer than 30 characters", () => {
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({
        identifier: "a".repeat(31),
      })
    );
    const unionIssue = result.error.issues.find(
      (issue) => issue.code === "invalid_union"
    );
    expect(unionIssue).toBeDefined();
    expect(
      unionIssue.errors.some((branchIssues) =>
        branchIssues.some(
          (issue) => issue.code === "too_big" && issue.maximum === 30
        )
      )
    ).toBe(true);
  });

  test("accepts an email with 254 characters", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(93)}aaa`;
    const email = `${localPart}@${domain}`;
    expect(email.length).toBe(254);
    expectValid(
      loginUserSchema,
      createValidLogin({
        identifier: email,
      })
    );
  });

  // Inspect the nested union error so the email branch's 254-character limit
  // is explicitly verified.
  test("rejects an email longer than 254 characters", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(94)}aa`;
    const email = `${localPart}@${domain}`;
    expect(email.length).toBe(255);
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({
        identifier: email,
      })
    );
    expect(hasIssueAtPath(result, ["identifier"])).toBe(true);
    const unionIssue = result.error.issues.find(
      (issue) => issue.code === "invalid_union"
    );
    expect(unionIssue).toBeDefined();
    expect(
      unionIssue.errors.some((branchIssues) =>
        branchIssues.some(
          (issue) => issue.code === "too_big" && issue.maximum === 254
        )
      )
    ).toBe(true);
  });

  // These values are invalid username identifiers after trimming/validation.
  test.each(["ab", "", "  "])(
    "rejects an invalid username identifier: %s",
    (identifier) => {
      const result = expectInvalid(
        loginUserSchema,
        createValidLogin({ identifier })
      );
      expect(hasIssueAtPath(result, ["identifier"])).toBe(true);
    }
  );

  test("rejects a malformed email identifier", () => {
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({
        identifier: "invalid-email",
      })
    );
    expect(hasIssueAtPath(result, ["identifier"])).toBe(true);
  });

  // Existing credentials only need to be non-empty; password creation policy is
  // covered separately by passwordSchema in registration/reset/change flows.
  test("accepts an existing password with exactly 1 character", () => {
    expectValid(
      loginUserSchema,
      createValidLogin({
        password: "a",
      })
    );
  });

  test("accepts an existing password with exactly 128 characters", () => {
    expectValid(
      loginUserSchema,
      createValidLogin({
        password: "a".repeat(128),
      })
    );
  });

  test("rejects an empty login password", () => {
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({
        password: "",
      })
    );
    expect(hasIssueAtPath(result, ["password"])).toBe(true);
  });

  test("rejects a login password longer than 128 characters", () => {
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({
        password: "a".repeat(129),
      })
    );
    expect(hasIssueAtPath(result, ["password"])).toBe(true);
  });

  // Login payloads must not contain fields outside the schema contract.
  test("rejects unknown login fields", () => {
    const result = expectInvalid(
      loginUserSchema,
      createValidLogin({
        unexpectedField: true,
      })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["unexpectedField"],
      })
    );
  });
});

/**
 * ============================================================================
 * forgotPasswordSchema
 * ============================================================================
 *
 * Covers:
 * - Email normalization
 * - Shared email format validation
 * - Maximum email length
 * - Strict object behavior
 */
describe("forgotPasswordSchema", () => {
  test("accepts a valid email", () => {
    expectValid(forgotPasswordSchema, {
      email: "test@example.com",
    });
  });

  test("rejects a forgot-password request without email", () => {
    const result = expectInvalid(forgotPasswordSchema, {});
    expect(hasIssueAtPath(result, ["email"])).toBe(true);
  });

  test("trims and lowercases the email", () => {
    const result = expectValid(forgotPasswordSchema, {
      email: "  TEST@Example.COM  ",
    });
    expect(result.data.email).toBe("test@example.com");
  });

  // Representative invalid email formats.
  test.each([
    "invalid-email",
    "user@",
    "@example.com",
    "user.example.com",
    "user@example",
    "user name@example.com",
    "user@example..com",
    "",
  ])("rejects invalid email: %s", (email) => {
    const result = expectInvalid(forgotPasswordSchema, { email });
    expect(hasIssueAtPath(result, ["email"])).toBe(true);
  });

  test("rejects email longer than 254 characters", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(94)}aa`;
    const email = `${localPart}@${domain}`;

    expect(email.length).toBe(255);

    const result = expectInvalid(forgotPasswordSchema, { email });
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "too_big",
        maximum: 254,
        path: ["email"],
      })
    );
  });

  // Forgot-password requests accept only the declared email field.
  test("rejects unknown fields", () => {
    const result = expectInvalid(forgotPasswordSchema, {
      email: "test@example.com",
      unexpectedField: true,
    });
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["unexpectedField"],
      })
    );
  });
});

/**
 * ============================================================================
 * verificationCodeSchema
 * ============================================================================
 *
 * Covers:
 * - Six-digit verification-code format
 * - Persian and Arabic-Indic digit normalization
 * - Whitespace normalization
 * - String input contract
 * - Strict object behavior
 */
describe("verificationCodeSchema", () => {
  test("accepts a six-digit ASCII code", () => {
    expectValid(verificationCodeSchema, {
      code: "123456",
    });
  });

  test("rejects a verification-code payload without code", () => {
    const result = expectInvalid(verificationCodeSchema, {});
    expect(hasIssueAtPath(result, ["code"])).toBe(true);
  });

  // Persian digits are normalized to ASCII digits before regex validation.
  test("accepts a Persian-digit verification code", () => {
    const result = expectValid(verificationCodeSchema, {
      code: "۱۲۳۴۵۶",
    });
    expect(result.data.code).toBe("123456");
  });

  // Arabic-Indic digits are normalized in the same way.
  test("accepts an Arabic-Indic digit verification code", () => {
    const result = expectValid(verificationCodeSchema, {
      code: "١٢٣٤٥٦",
    });
    expect(result.data.code).toBe("123456");
  });

  // Surrounding whitespace is removed before format validation.
  test("trims surrounding whitespace before validation", () => {
    const result = expectValid(verificationCodeSchema, {
      code: " ۱۲۳۴۵۶ ",
    });
    expect(result.data.code).toBe("123456");
  });

  // The code must contain exactly six digits after normalization.
  test.each(["12345", "1234567", "12345a", "abcdef", "12 3456", ""])(
    "rejects an invalid verification code: %s",
    (code) => {
      const result = expectInvalid(verificationCodeSchema, { code });
      expect(hasIssueAtPath(result, ["code"])).toBe(true);
    }
  );

  // Numeric input is intentionally rejected because the schema contract is a
  // string rather than a numeric verification code.
  test("rejects numeric values because the input contract is a string", () => {
    const result = expectInvalid(verificationCodeSchema, {
      code: 123456,
    });
    expect(hasIssueAtPath(result, ["code"])).toBe(true);
  });

  // Additional fields are not permitted.
  test("rejects unknown fields", () => {
    const result = expectInvalid(verificationCodeSchema, {
      code: "123456",
      email: "test@example.com",
    });
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["email"],
      })
    );
  });
});

/**
 * ============================================================================
 * resetPasswordSchema
 * ============================================================================
 *
 * Covers:
 * - New-password boundaries
 * - Confirmation-password boundaries
 * - Password matching
 * - Preservation of password whitespace
 * - Strict object behavior
 */
describe("resetPasswordSchema", () => {
  test("accepts matching passwords", () => {
    expectValid(resetPasswordSchema, createValidResetPassword());
  });

  test.each(["newPassword", "confirmPassword"])(
    "rejects password reset without %s",
    (field) => {
      const data = createValidResetPassword();
      delete data[field];

      const result = expectInvalid(resetPasswordSchema, data);

      expect(hasIssueAtPath(result, [field])).toBe(true);
    }
  );

  // Minimum new-password length is inclusive.
  test("accepts an 8-character new password", () => {
    expectValid(resetPasswordSchema, {
      newPassword: "12345678",
      confirmPassword: "12345678",
    });
  });

  // Maximum new-password length is inclusive.
  test("accepts a 128-character new password", () => {
    const password = "a".repeat(128);
    expectValid(resetPasswordSchema, {
      newPassword: password,
      confirmPassword: password,
    });
  });

  test("rejects a new password shorter than 8 characters", () => {
    const result = expectInvalid(resetPasswordSchema, {
      newPassword: "1234567",
      confirmPassword: "1234567",
    });
    expect(hasIssueAtPath(result, ["newPassword"])).toBe(true);
  });

  test("rejects a new password longer than 128 characters", () => {
    const password = "a".repeat(129);
    const result = expectInvalid(resetPasswordSchema, {
      newPassword: password,
      confirmPassword: password,
    });
    expect(hasIssueAtPath(result, ["newPassword"])).toBe(true);
  });

  test("rejects empty confirmPassword", () => {
    const result = expectInvalid(
      resetPasswordSchema,
      createValidResetPassword({
        confirmPassword: "",
      })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "تأیید رمز عبور الزامی است.",
      })
    );
  });

  // A non-empty one-character confirmation value is valid at the field level;
  // this test should fail only because it does not match the new password.
  test("reports a mismatch, not a length error, for a 1-character confirmation", () => {
    const result = expectInvalid(resetPasswordSchema, {
      newPassword: "abcdefgh",
      confirmPassword: "a",
    });
    const confirmPasswordIssues = result.error.issues.filter(
      (issue) => issue.path.length === 1 && issue.path[0] === "confirmPassword"
    );
    expect(confirmPasswordIssues).toEqual([
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "رمزهای عبور یکسان نیستند.",
      }),
    ]);
  });

  // Verify that the 128-character maximum is enforced specifically on the
  // confirmation field.
  test("rejects confirmPassword longer than 128 characters", () => {
    const result = expectInvalid(resetPasswordSchema, {
      newPassword: "NewPassword123",
      confirmPassword: "a".repeat(129),
    });
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["confirmPassword"],
          code: "too_big",
          maximum: 128,
        }),
      ])
    );
  });

  test("rejects mismatched passwords", () => {
    const result = expectInvalid(resetPasswordSchema, {
      newPassword: "NewPassword123",
      confirmPassword: "DifferentPassword123",
    });
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["confirmPassword"],
          message: "رمزهای عبور یکسان نیستند.",
        }),
      ])
    );
  });

  // Passwords are intentionally not trimmed because whitespace is part of the
  // credential value rather than presentation-only input.
  test("does not trim passwords", () => {
    const result = expectValid(resetPasswordSchema, {
      newPassword: " password123 ",
      confirmPassword: " password123 ",
    });
    expect(result.data.newPassword).toBe(" password123 ");
    expect(result.data.confirmPassword).toBe(" password123 ");
  });

  // Reset-password payloads contain only the fields declared by the schema.
  test("rejects unknown fields", () => {
    const result = expectInvalid(
      resetPasswordSchema,
      createValidResetPassword({
        resetToken: "token",
      })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["resetToken"],
      })
    );
  });
});

/**
 * ============================================================================
 * changePasswordSchema
 * ============================================================================
 *
 * Covers:
 * - Existing-password boundaries
 * - New-password boundaries
 * - Confirmation-password boundaries
 * - Password matching
 * - Preventing reuse of the current password
 * - Multiple simultaneous validation errors
 * - Strict object behavior
 */
describe("changePasswordSchema", () => {
  test("accepts valid password-change data", () => {
    expectValid(changePasswordSchema, createValidChangePassword());
  });

  test.each(["currentPassword", "newPassword", "confirmPassword"])(
    "rejects password change without %s",
    (field) => {
      const data = createValidChangePassword();
      delete data[field];

      const result = expectInvalid(changePasswordSchema, data);

      expect(hasIssueAtPath(result, [field])).toBe(true);
    }
  );

  // Existing passwords only need to be non-empty.
  test("accepts a 1-character current password", () => {
    expectValid(
      changePasswordSchema,
      createValidChangePassword({
        currentPassword: "a",
      })
    );
  });

  // Maximum existing-password length is inclusive.
  test("accepts a 128-character current password", () => {
    expectValid(
      changePasswordSchema,
      createValidChangePassword({
        currentPassword: "a".repeat(128),
      })
    );
  });

  test("rejects empty current password", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        currentPassword: "",
      })
    );
    expect(hasIssueAtPath(result, ["currentPassword"])).toBe(true);
  });

  test("rejects current password longer than 128 characters", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        currentPassword: "a".repeat(129),
      })
    );
    expect(hasIssueAtPath(result, ["currentPassword"])).toBe(true);
  });

  // New passwords follow the password-creation minimum of 8 characters.
  test("rejects new password shorter than 8 characters", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        newPassword: "1234567",
        confirmPassword: "1234567",
      })
    );
    expect(hasIssueAtPath(result, ["newPassword"])).toBe(true);
  });

  test("accepts an 8-character new password", () => {
    const password = "12345678";
    expectValid(
      changePasswordSchema,
      createValidChangePassword({
        newPassword: password,
        confirmPassword: password,
      })
    );
  });

  test("accepts a 128-character new password", () => {
    const password = "a".repeat(128);
    expectValid(
      changePasswordSchema,
      createValidChangePassword({
        newPassword: password,
        confirmPassword: password,
      })
    );
  });

  test("rejects a new password longer than 128 characters", () => {
    const password = "a".repeat(129);
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        newPassword: password,
        confirmPassword: password,
      })
    );
    expect(hasIssueAtPath(result, ["newPassword"])).toBe(true);
  });

  // Verify the confirmation field's own maximum independently.
  test("rejects confirmPassword longer than 128 characters", () => {
    const result = expectInvalid(changePasswordSchema, {
      currentPassword: "CurrentPassword123",
      newPassword: "NewPassword123",
      confirmPassword: "a".repeat(129),
    });
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["confirmPassword"],
          code: "too_big",
          maximum: 128,
        }),
      ])
    );
  });

  test("rejects empty confirmPassword", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        confirmPassword: "",
      })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "تأیید رمز عبور الزامی است.",
      })
    );
  });

  // A one-character confirmation fails because it does not match the new
  // password, not because the value is empty.
  test("reports a mismatch, not a length error, for a 1-character confirmation", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        newPassword: "abcdefgh",
        confirmPassword: "a",
      })
    );
    const confirmPasswordIssues = result.error.issues.filter(
      (issue) => issue.path.length === 1 && issue.path[0] === "confirmPassword"
    );
    expect(confirmPasswordIssues).toEqual([
      expect.objectContaining({
        path: ["confirmPassword"],
        message: "رمزهای عبور یکسان نیستند.",
      }),
    ]);
  });

  test("rejects mismatched new password confirmation", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        confirmPassword: "DifferentPassword123",
      })
    );
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["confirmPassword"],
          message: "رمزهای عبور یکسان نیستند.",
        }),
      ])
    );
  });

  // Reusing the current password as the new password is explicitly forbidden.
  test("rejects using the current password as the new password", () => {
    const password = "SamePassword123";
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        currentPassword: password,
        newPassword: password,
        confirmPassword: password,
      })
    );
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["newPassword"],
          message: "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
        }),
      ])
    );
  });

  // Multiple independent cross-field rules may fail for the same payload.
  test("can report both confirmation mismatch and same-as-current errors", () => {
    const result = expectInvalid(changePasswordSchema, {
      currentPassword: "SamePassword123",
      newPassword: "SamePassword123",
      confirmPassword: "DifferentPassword123",
    });
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["confirmPassword"],
          message: "رمزهای عبور یکسان نیستند.",
        }),
        expect.objectContaining({
          path: ["newPassword"],
          message: "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
        }),
      ])
    );
  });

  // Change-password payloads must not contain fields outside the schema.
  test("rejects unknown fields", () => {
    const result = expectInvalid(
      changePasswordSchema,
      createValidChangePassword({
        verificationCode: "123456",
      })
    );
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "unrecognized_keys",
        keys: ["verificationCode"],
      })
    );
  });
});

/**
 * ============================================================================
 * updateUserProfileSchema
 * ============================================================================
 *
 * Covers:
 * - Optional profile fields
 * - Avatar URL rules
 * - Bio boundaries and normalization
 * - Social-link validation
 * - Nested strictness
 * - Protection of immutable/system-managed fields
 */
describe("updateUserProfileSchema", () => {
  // The schema accepts an empty object; service-level logic can enforce whether
  // an actual update operation requires at least one changed field.
  test("rejects an empty update object", () => {
    const result = expectInvalid(updateUserProfileSchema, {});

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "custom",
        message: "حداقل یک فیلد برای ویرایش باید ارسال شود.",
      })
    );
  });

  test("allows socialLinks to be omitted", () => {
    expectValid(updateUserProfileSchema, {
      bio: "Cooking",
    });
  });

  // socialLinks is optional, but null is not part of its outer contract.
  test("rejects null socialLinks", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      socialLinks: null,
    });
    expect(hasIssueAtPath(result, ["socialLinks"])).toBe(true);
  });

  test("rejects empty socialLinks even when another profile field is updated", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      bio: "Cooking",
      socialLinks: {},
    });

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "custom",
        path: ["socialLinks"],
        message: "حداقل یک پیوند اجتماعی باید ارسال شود.",
      })
    );
  });

  test("rejects an empty socialLinks object as the only update", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      socialLinks: {},
    });

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: "custom",
        message: "حداقل یک فیلد برای ویرایش باید ارسال شود.",
      })
    );
  });

  // Avatar URLs must be valid HTTPS URLs.
  test("accepts a valid HTTPS avatar", () => {
    expectValid(updateUserProfileSchema, {
      avatar: "https://example.com/avatar.jpg",
    });
  });

  // Nullable avatar allows explicit removal/reset of the current avatar.
  test("accepts null avatar", () => {
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

  // Avatar values are trimmed before URL validation/output.
  test("trims avatar", () => {
    const result = expectValid(updateUserProfileSchema, {
      avatar: "  https://example.com/avatar.jpg  ",
    });
    expect(result.data.avatar).toBe("https://example.com/avatar.jpg");
  });

  // Non-secure HTTP avatar URLs are forbidden.
  test("rejects HTTP avatar URL", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      avatar: "http://example.com/avatar.jpg",
    });
    expect(hasIssueAtPath(result, ["avatar"])).toBe(true);
  });

  test("rejects malformed avatar URL", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      avatar: "not-a-url",
    });
    expect(hasIssueAtPath(result, ["avatar"])).toBe(true);
  });

  // Bio maximum length is inclusive.
  test("accepts a 300-character bio", () => {
    expectValid(updateUserProfileSchema, {
      bio: "a".repeat(300),
    });
  });

  test("rejects a non-string bio", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      bio: 123,
    });
    expect(hasIssueAtPath(result, ["bio"])).toBe(true);
  });

  test("rejects a bio longer than 300 characters", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      bio: "a".repeat(301),
    });
    expect(hasIssueAtPath(result, ["bio"])).toBe(true);
  });

  // Bio whitespace is presentation-only and is removed during normalization.
  test("trims bio", () => {
    const result = expectValid(updateUserProfileSchema, {
      bio: "  My cooking profile  ",
    });
    expect(result.data.bio).toBe("My cooking profile");
  });

  test.each(["instagram", "telegram", "x"])(
    "rejects explicitly undefined social link: %s",
    (field) => {
      const result = expectInvalid(updateUserProfileSchema, {
        socialLinks: {
          [field]: undefined,
        },
      });

      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "custom",
          path: ["socialLinks", field],
          message: "مقدار پیوند اجتماعی نمی‌تواند undefined باشد.",
        })
      );
    }
  );

  // Each supported social network gets a representative valid URL test.
  test("accepts a valid Instagram URL", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        instagram: "https://instagram.com/test-user",
      },
    });
  });

  test("accepts www Instagram URL", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        instagram: "https://www.instagram.com/test-user",
      },
    });
  });

  test("accepts a valid Telegram URL", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        telegram: "https://t.me/test-user",
      },
    });
  });

  test("accepts telegram.me URL", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        telegram: "https://telegram.me/test-user",
      },
    });
  });

  test("accepts a valid X URL", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        x: "https://x.com/test-user",
      },
    });
  });

  test("accepts twitter.com URL", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        x: "https://twitter.com/test-user",
      },
    });
  });

  // Individual social-link values are nullable even though the socialLinks
  // object itself is not nullable.
  test("accepts null values for social links", () => {
    expectValid(updateUserProfileSchema, {
      socialLinks: {
        instagram: null,
        telegram: null,
        x: null,
      },
    });
  });

  test("rejects an empty Instagram URL", () => {
    const result = expectInvalid(updateUserProfileSchema, {
      socialLinks: {
        instagram: "",
      },
    });
    expect(hasIssueAtPath(result, ["socialLinks", "instagram"])).toBe(true);
  });

  // Social URLs are normalized by removing surrounding whitespace.
  test("trims social URLs", () => {
    const result = expectValid(updateUserProfileSchema, {
      socialLinks: {
        instagram: "  https://instagram.com/test-user  ",
      },
    });
    expect(result.data.socialLinks.instagram).toBe(
      "https://instagram.com/test-user"
    );
  });

  // All social links require HTTPS.
  test.each([
    {
      platform: "Instagram",
      field: "instagram",
      url: "http://instagram.com/test-user",
    },
    {
      platform: "Telegram",
      field: "telegram",
      url: "http://t.me/test-user",
    },
    {
      platform: "X",
      field: "x",
      url: "http://x.com/test-user",
    },
  ])("rejects HTTP $platform URL", ({ field, url }) => {
    const result = expectInvalid(updateUserProfileSchema, {
      socialLinks: {
        [field]: url,
      },
    });
    expect(hasIssueAtPath(result, ["socialLinks", field])).toBe(true);
  });

  // Each social field must match its own allowed platform domain.
  test.each([
    { platform: "Instagram", field: "instagram" },
    { platform: "Telegram", field: "telegram" },
    { platform: "X", field: "x" },
  ])("rejects non-$platform domains", ({ field }) => {
    const result = expectInvalid(updateUserProfileSchema, {
      socialLinks: {
        [field]: "https://example.com/test-user",
      },
    });
    expect(hasIssueAtPath(result, ["socialLinks", field])).toBe(true);
  });

  // Hostnames that contain an allowed domain name must still be rejected.
  test.each([
    {
      platform: "Instagram",
      field: "instagram",
      url: "https://instagram.com.evil.example/user",
    },
    {
      platform: "Instagram",
      field: "instagram",
      url: "https://evil-instagram.com/user",
    },
    {
      platform: "Telegram",
      field: "telegram",
      url: "https://t.me.evil.example/user",
    },
    {
      platform: "Telegram",
      field: "telegram",
      url: "https://evil-t.me/user",
    },
    {
      platform: "X",
      field: "x",
      url: "https://x.com.example.org/user",
    },
    {
      platform: "X",
      field: "x",
      url: "https://evil-x.com/user",
    },
    {
      platform: "X",
      field: "x",
      url: "https://twitter.com.evil.example/user",
    },
  ])("rejects lookalike $platform domain: $url", ({ field, url }) => {
    const result = expectInvalid(updateUserProfileSchema, {
      socialLinks: {
        [field]: url,
      },
    });
    expect(hasIssueAtPath(result, ["socialLinks", field])).toBe(true);
  });

  // Nested socialLinks objects are strict as well.
  test("rejects unknown social-link fields because the nested object is strict", () => {
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

  test.each([
    {
      field: "username",
      value: { username: "NewUsername" },
      expectedKeys: ["username"],
    },
    {
      field: "title",
      value: { title: USER_TITLES.COOK },
      expectedKeys: ["title"],
    },
    {
      field: "role",
      value: { role: "ADMIN" },
      expectedKeys: ["role"],
    },
    {
      field: "accountStatus",
      value: { accountStatus: "ACTIVE" },
      expectedKeys: ["accountStatus"],
    },
    {
      field: "emailVerified",
      value: { emailVerified: true },
      expectedKeys: ["emailVerified"],
    },
    {
      field: "stats",
      value: { stats: { recipeCount: 10 } },
      expectedKeys: ["stats"],
    },
    {
      field: "timestamps",
      value: {
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      expectedKeys: ["createdAt", "updatedAt"],
    },
  ])(
    "rejects immutable or system-managed field(s): $field",
    ({ value, expectedKeys }) => {
      const result = expectInvalid(updateUserProfileSchema, value);
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: expectedKeys,
        })
      );
    }
  );

  // Any other undeclared top-level field must also be rejected.
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
});
