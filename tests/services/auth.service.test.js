import crypto from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_STATUSES,
  VERIFICATION_CODE_PURPOSES,
} from "@/constants/enums";
import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import {
  changePassword,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerificationCode,
  resetPassword,
  verifyEmail,
  verifyPasswordResetCode,
} from "@/services/auth.service";

const mocks = vi.hoisted(() => ({
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),

  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByIdentifier: vi.fn(),
  findUserByIdWithPassword: vi.fn(),
  findUserByUsername: vi.fn(),
  verifyUserEmail: vi.fn(),
  updateUserPassword: vi.fn(),

  consumeVerificationCode: vi.fn(),
  findActiveVerificationCode: vi.fn(),
  findVerificationCode: vi.fn(),
  replaceVerificationCode: vi.fn(),

  withTransaction: vi.fn(),
  requireActiveAuthenticatedUser: vi.fn(),
  getServerEnv: vi.fn(),

  sendVerificationCodeEmail: vi.fn(),
  sendPasswordResetCodeEmail: vi.fn(),
}));

// ============================================================================
// Module mocks
// ============================================================================

vi.mock("bcryptjs", () => ({
  default: {
    hash: mocks.bcryptHash,
    compare: mocks.bcryptCompare,
  },
}));

vi.mock("@/repositories/user.repository", () => ({
  createUser: mocks.createUser,
  findUserByEmail: mocks.findUserByEmail,
  findUserByIdentifier: mocks.findUserByIdentifier,
  findUserByIdWithPassword: mocks.findUserByIdWithPassword,
  findUserByUsername: mocks.findUserByUsername,
  verifyUserEmail: mocks.verifyUserEmail,
  updateUserPassword: mocks.updateUserPassword,
}));

vi.mock("@/repositories/verification-code.repository", () => ({
  consumeVerificationCode: mocks.consumeVerificationCode,
  findActiveVerificationCode: mocks.findActiveVerificationCode,
  findVerificationCode: mocks.findVerificationCode,
  replaceVerificationCode: mocks.replaceVerificationCode,
}));

vi.mock("@/lib/transaction", () => ({
  withTransaction: mocks.withTransaction,
}));

vi.mock("@/lib/auth/guards", () => ({
  requireActiveAuthenticatedUser: mocks.requireActiveAuthenticatedUser,
}));

vi.mock("@/lib/config/env", () => ({
  getServerEnv: mocks.getServerEnv,
}));

vi.mock("@/lib/email", () => ({
  sendVerificationCodeEmail: mocks.sendVerificationCodeEmail,
  sendPasswordResetCodeEmail: mocks.sendPasswordResetCodeEmail,
}));

// ============================================================================
// Mock aliases
// ============================================================================

const {
  bcryptHash,
  bcryptCompare,

  createUser: createUserInRepository,
  findUserByEmail,
  findUserByIdentifier,
  findUserByIdWithPassword,
  findUserByUsername,
  verifyUserEmail,
  updateUserPassword,

  consumeVerificationCode,
  findActiveVerificationCode,
  findVerificationCode,
  replaceVerificationCode,

  withTransaction,
  requireActiveAuthenticatedUser,
  getServerEnv,

  sendVerificationCodeEmail,
  sendPasswordResetCodeEmail,
} = mocks;

// ============================================================================
// Test constants
// ============================================================================

const TEST_USER_ID = "64f1a2b3c4d5e6f708090a01";
const TEST_VERIFICATION_CODE_ID = "64f1a2b3c4d5e6f708090a02";
const TEST_GENERATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const PASSWORD_RESET_TOKEN_SECRET = "A".repeat(43);

const VALID_PASSWORD = "Password123";
const INVALID_UTF16_PASSWORD = "Pass\uD800word";
const OVER_LIMIT_PASSWORD = "a".repeat(73);

const TEST_SESSION = { id: "test-session" };

// ============================================================================
// Test factories
// ============================================================================

function createUser(overrides = {}) {
  return {
    _id: TEST_USER_ID,
    username: "Cook_123",
    email: "cook@example.com",
    avatar: null,
    bio: "",
    title: "USER",
    role: "USER",
    socialLinks: {},
    stats: {
      recipeCount: 3,
      averageRating: 4.5,
      totalRecipeViews: 120,
    },
    emailVerified: true,
    accountStatus: ACCOUNT_STATUSES.ACTIVE,
    sessionVersion: 0,
    password: "stored-password-hash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function createVerificationCode(overrides = {}) {
  return {
    _id: TEST_VERIFICATION_CODE_ID,
    email: "cook@example.com",
    purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
    codeHash: "stored-verification-code-hash",
    generationId: TEST_GENERATION_ID,
    expiresAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function createPasswordResetToken(overrides = {}) {
  const payload = {
    v: 1,
    purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
    userId: TEST_USER_ID,
    sessionVersion: 0,
    verificationCodeId: TEST_VERIFICATION_CODE_ID,
    generationId: TEST_GENERATION_ID,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );

  const key = crypto.createSecretKey(
    Buffer.from(PASSWORD_RESET_TOKEN_SECRET, "base64url")
  );

  const signature = crypto
    .createHmac("sha256", key)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

// ============================================================================
// Test helpers
// ============================================================================

async function expectAppError(promise, code, statusCode = 400, message) {
  const error = await promise.then(
    () => undefined,
    (reason) => reason
  );

  expect(error).toBeInstanceOf(AppError);

  const expectedError = {
    code,
    statusCode,
  };

  if (message !== undefined) {
    expectedError.message = message;
  }

  expect(error).toMatchObject(expectedError);
}

function expectNoBcryptCalls() {
  expect(bcryptHash).not.toHaveBeenCalled();
  expect(bcryptCompare).not.toHaveBeenCalled();
}

// ============================================================================
// Test setup
// ============================================================================

beforeEach(() => {
  vi.resetAllMocks();

  bcryptHash.mockImplementation(async (value) => `hashed:${value}`);
  bcryptCompare.mockResolvedValue(true);

  createUserInRepository.mockResolvedValue(
    createUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    })
  );

  findUserByEmail.mockResolvedValue(null);
  findUserByIdentifier.mockResolvedValue(createUser());
  findUserByIdWithPassword.mockResolvedValue(createUser());
  findUserByUsername.mockResolvedValue(null);
  verifyUserEmail.mockResolvedValue(createUser());
  updateUserPassword.mockResolvedValue(createUser());

  consumeVerificationCode.mockResolvedValue({ deletedCount: 1 });

  findActiveVerificationCode.mockResolvedValue(
    createVerificationCode({
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    })
  );

  findVerificationCode.mockResolvedValue(createVerificationCode());
  replaceVerificationCode.mockResolvedValue({ acknowledged: true });

  withTransaction.mockImplementation(async (callback) =>
    callback(TEST_SESSION)
  );

  requireActiveAuthenticatedUser.mockImplementation(
    async (currentUser) => currentUser
  );

  getServerEnv.mockReturnValue({
    PASSWORD_RESET_TOKEN_SECRET,
  });

  sendVerificationCodeEmail.mockResolvedValue({ id: "email-id" });
  sendPasswordResetCodeEmail.mockResolvedValue({ id: "email-id" });
});

// ============================================================================
// registerUser
// ============================================================================

describe("registerUser()", () => {
  it("rejects a password with malformed UTF-16 before database or bcrypt operations", async () => {
    await expectAppError(
      registerUser({
        username: "Cook_123",
        email: "cook@example.com",
        password: INVALID_UTF16_PASSWORD,
      }),
      ERROR_CODES.INVALID_PASSWORD_ENCODING
    );

    expectNoBcryptCalls();
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect(findUserByUsername).not.toHaveBeenCalled();
    expect(createUserInRepository).not.toHaveBeenCalled();
  });

  it("rejects a password that exceeds bcrypt's 72-byte limit before database or bcrypt operations", async () => {
    await expectAppError(
      registerUser({
        username: "Cook_123",
        email: "cook@example.com",
        password: OVER_LIMIT_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_EXCEEDS_BCRYPT_LIMIT
    );

    expectNoBcryptCalls();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("rejects a non-string password before database or bcrypt operations", async () => {
    await expectAppError(
      registerUser({
        username: "Cook_123",
        email: "cook@example.com",
        password: 123,
      }),
      ERROR_CODES.INVALID_PASSWORD_TYPE
    );

    expectNoBcryptCalls();
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it("hashes the password, creates the user and verification code, and submits the email", async () => {
    const pendingUser = createUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    createUserInRepository.mockResolvedValue(pendingUser);

    const result = await registerUser({
      username: "Cook_123",
      email: "cook@example.com",
      password: VALID_PASSWORD,
      title: "USER",
    });

    expect(bcryptHash).toHaveBeenNthCalledWith(1, VALID_PASSWORD, 12);
    expect(bcryptHash).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^\d{6}$/),
      10
    );

    expect(createUserInRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "Cook_123",
        email: "cook@example.com",
        password: `hashed:${VALID_PASSWORD}`,
        title: "USER",
      }),
      TEST_SESSION
    );

    expect(replaceVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "cook@example.com",
        codeHash: expect.any(String),
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt: expect.any(Date),
      }),
      TEST_SESSION
    );

    expect(sendVerificationCodeEmail).toHaveBeenCalledWith({
      to: "cook@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresInMinutes: 10,
    });

    expect(result.user).toMatchObject({
      id: TEST_USER_ID,
      username: "Cook_123",
      email: "cook@example.com",
    });

    expect(result.user).not.toHaveProperty("password");
    expect(result.verificationEmailSubmissionAccepted).toBe(true);
  });

  it("rejects registration when the email already exists", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    await expectAppError(
      registerUser({
        username: "AnotherUser",
        email: "cook@example.com",
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.EMAIL_ALREADY_EXISTS,
      409
    );

    expect(findUserByUsername).not.toHaveBeenCalled();
    expect(createUserInRepository).not.toHaveBeenCalled();
    expectNoBcryptCalls();
  });

  it("rejects registration when the username already exists", async () => {
    findUserByEmail.mockResolvedValue(null);
    findUserByUsername.mockResolvedValue(createUser());

    await expectAppError(
      registerUser({
        username: "Cook_123",
        email: "another@example.com",
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.USERNAME_ALREADY_EXISTS,
      409
    );

    expect(createUserInRepository).not.toHaveBeenCalled();
    expectNoBcryptCalls();
  });

  it.each([
    {
      field: "email",
      duplicateKey: {
        keyPattern: { email: 1 },
        keyValue: { email: "cook@example.com" },
      },
      expectedCode: ERROR_CODES.EMAIL_ALREADY_EXISTS,
    },
    {
      field: "username",
      duplicateKey: {
        keyPattern: { username: 1 },
        keyValue: { username: "Cook_123" },
      },
      expectedCode: ERROR_CODES.USERNAME_ALREADY_EXISTS,
    },
  ])(
    "maps a duplicate $field database error to the corresponding AppError",
    async ({ duplicateKey, expectedCode }) => {
      const duplicateError = Object.assign(new Error("Duplicate key"), {
        code: 11000,
        ...duplicateKey,
      });

      findUserByEmail.mockResolvedValue(null);
      findUserByUsername.mockResolvedValue(null);
      createUserInRepository.mockRejectedValue(duplicateError);

      await expectAppError(
        registerUser({
          username: "Cook_123",
          email: "cook@example.com",
          password: VALID_PASSWORD,
        }),
        expectedCode,
        409
      );

      expect(createUserInRepository).toHaveBeenCalledOnce();
      expect(replaceVerificationCode).not.toHaveBeenCalled();
      expect(sendVerificationCodeEmail).not.toHaveBeenCalled();
    }
  );

  it("returns a failed email submission status when verification email delivery fails", async () => {
    const pendingUser = createUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    createUserInRepository.mockResolvedValue(pendingUser);

    sendVerificationCodeEmail.mockRejectedValue(
      new Error("Email provider unavailable")
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await registerUser({
      username: "Cook_123",
      email: "cook@example.com",
      password: VALID_PASSWORD,
      title: "USER",
    });

    expect(result.verificationEmailSubmissionAccepted).toBe(false);

    expect(result.user).not.toHaveProperty("password");

    expect(createUserInRepository).toHaveBeenCalledOnce();
    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(sendVerificationCodeEmail).toHaveBeenCalledOnce();

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// resendVerificationCode
// ============================================================================

describe("resendVerificationCode()", () => {
  it.each([
    {
      description: "a missing user",
      overrides: null,
    },
    {
      description: "a pending account whose email is already verified",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: true,
      },
    },
    {
      description: "an active account with an unverified email",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      },
    },
    {
      description: "a suspended account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        emailVerified: false,
      },
    },
    {
      description: "a deactivated account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
        emailVerified: false,
      },
    },
  ])(
    "returns a generic response without side effects for $description",
    async ({ overrides }) => {
      findUserByEmail.mockResolvedValue(
        overrides === null ? null : createUser(overrides)
      );

      const result = await resendVerificationCode({
        email: "cook@example.com",
      });

      expect(result.message).toBe(
        "در صورت واجد شرایط بودن حساب، کد تأیید ارسال خواهد شد."
      );

      expectNoBcryptCalls();
      expect(replaceVerificationCode).not.toHaveBeenCalled();
      expect(sendVerificationCodeEmail).not.toHaveBeenCalled();
    }
  );

  it("replaces the verification code and submits a new email for a pending account", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    const result = await resendVerificationCode({
      email: "cook@example.com",
    });

    expect(bcryptHash).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{6}$/),
      10
    );

    expect(replaceVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "cook@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );

    expect(sendVerificationCodeEmail).toHaveBeenCalledOnce();

    expect(result.message).toBe(
      "در صورت واجد شرایط بودن حساب، کد تأیید ارسال خواهد شد."
    );
  });

  it("returns a generic response when verification email delivery fails", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    sendVerificationCodeEmail.mockRejectedValue(
      new Error("Email provider unavailable")
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await resendVerificationCode({
      email: "cook@example.com",
    });

    expect(result.message).toBe(
      "در صورت واجد شرایط بودن حساب، کد تأیید ارسال خواهد شد."
    );

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(sendVerificationCodeEmail).toHaveBeenCalledOnce();

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// verifyEmail
// ============================================================================

describe("verifyEmail()", () => {
  it("rejects a missing user", async () => {
    findUserByEmail.mockResolvedValue(null);

    await expectAppError(
      verifyEmail({
        email: "missing@example.com",
        code: "123456",
      }),
      ERROR_CODES.USER_NOT_FOUND,
      404
    );

    expectNoBcryptCalls();

    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(verifyUserEmail).not.toHaveBeenCalled();
  });

  it("rejects an already verified email before looking up a verification code", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    await expectAppError(
      verifyEmail({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      409
    );

    expect(findActiveVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(verifyUserEmail).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "an active account",
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
    },
    {
      description: "a suspended account",
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
    },
    {
      description: "a deactivated account",
      accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
    },
  ])(
    "rejects email verification for $description",
    async ({ accountStatus }) => {
      findUserByEmail.mockResolvedValue(
        createUser({
          accountStatus,
          emailVerified: false,
        })
      );

      await expectAppError(
        verifyEmail({
          email: "cook@example.com",
          code: "123456",
        }),
        ERROR_CODES.FORBIDDEN,
        403
      );

      expect(findActiveVerificationCode).not.toHaveBeenCalled();
      expectNoBcryptCalls();
      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(verifyUserEmail).not.toHaveBeenCalled();
      expect(withTransaction).not.toHaveBeenCalled();
    }
  );

  it("rejects email verification when no active verification code exists", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    findActiveVerificationCode.mockResolvedValue(null);

    await expectAppError(
      verifyEmail({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.VERIFICATION_CODE_NOT_FOUND,
      400
    );

    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(verifyUserEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid generation ID before comparing the verification code", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    findActiveVerificationCode.mockResolvedValue(
      createVerificationCode({
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        generationId: "invalid-generation-id",
      })
    );

    await expectAppError(
      verifyEmail({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.INVALID_VERIFICATION_CODE
    );

    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(verifyUserEmail).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a code containing letters",
      code: "12AB56",
    },
    {
      description: "a code with fewer than six digits",
      code: "12345",
    },
    {
      description: "a code with more than six digits",
      code: "1234567",
    },
    {
      description: "a code containing non-ASCII digits",
      code: "۱۲۳۴۵۶",
    },
    {
      description: "a non-string value",
      code: null,
    },
  ])(
    "rejects $description before bcrypt comparison or code consumption",
    async ({ code }) => {
      findUserByEmail.mockResolvedValue(
        createUser({
          accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
          emailVerified: false,
        })
      );

      findActiveVerificationCode.mockResolvedValue(
        createVerificationCode({
          purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        })
      );

      await expectAppError(
        verifyEmail({
          email: "cook@example.com",
          code,
        }),
        ERROR_CODES.INVALID_VERIFICATION_CODE,
        400
      );

      expect(bcryptCompare).not.toHaveBeenCalled();
      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(verifyUserEmail).not.toHaveBeenCalled();
    }
  );

  it("rejects a validly formatted but incorrect verification code", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    findActiveVerificationCode.mockResolvedValue(
      createVerificationCode({
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    bcryptCompare.mockResolvedValue(false);

    await expectAppError(
      verifyEmail({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.INVALID_VERIFICATION_CODE,
      400
    );

    expect(bcryptCompare).toHaveBeenCalledWith(
      "123456",
      "stored-verification-code-hash"
    );

    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(verifyUserEmail).not.toHaveBeenCalled();
  });

  it("compares and consumes a valid code, then verifies the user email", async () => {
    const pendingUser = createUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    const verifiedUser = createUser();

    findUserByEmail.mockResolvedValue(pendingUser);
    verifyUserEmail.mockResolvedValue(verifiedUser);

    const result = await verifyEmail({
      email: "cook@example.com",
      code: "123456",
    });

    expect(bcryptCompare).toHaveBeenCalledWith(
      "123456",
      "stored-verification-code-hash"
    );

    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationCodeId: TEST_VERIFICATION_CODE_ID,
        email: "cook@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        codeHash: "stored-verification-code-hash",
        generationId: TEST_GENERATION_ID,
        session: TEST_SESSION,
      })
    );

    expect(verifyUserEmail).toHaveBeenCalledOnce();
    expect(verifyUserEmail).toHaveBeenCalledWith(TEST_USER_ID, TEST_SESSION);

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(consumeVerificationCode.mock.invocationCallOrder[0]).toBeLessThan(
      verifyUserEmail.mock.invocationCallOrder[0]
    );

    expect(findActiveVerificationCode).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(withTransaction).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      id: TEST_USER_ID,
      email: "cook@example.com",
      emailVerified: true,
    });

    expect(result).not.toHaveProperty("password");
  });

  it("rejects email verification when the user email cannot be updated", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    findActiveVerificationCode.mockResolvedValue(
      createVerificationCode({
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    bcryptCompare.mockResolvedValue(true);
    verifyUserEmail.mockResolvedValue(null);

    await expectAppError(
      verifyEmail({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.EMAIL_ALREADY_VERIFIED,
      409
    );

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(verifyUserEmail).toHaveBeenCalledOnce();
  });

  it("rejects email verification when the verification code cannot be consumed", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    bcryptCompare.mockResolvedValue(true);
    consumeVerificationCode.mockResolvedValue(null);

    await expectAppError(
      verifyEmail({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.INVALID_VERIFICATION_CODE
    );

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(verifyUserEmail).not.toHaveBeenCalled();
  });
});

// ============================================================================
// loginUser
// ============================================================================

describe("loginUser()", () => {
  it("returns the generic credentials error for malformed UTF-16 without querying or calling bcrypt", async () => {
    await expectAppError(
      loginUser({
        identifier: "Cook_123",
        password: INVALID_UTF16_PASSWORD,
      }),
      ERROR_CODES.INVALID_CREDENTIALS,
      401,
      "ایمیل، نام کاربری یا رمز عبور نامعتبر است."
    );

    expectNoBcryptCalls();
    expect(findUserByIdentifier).not.toHaveBeenCalled();
  });

  it("returns the generic credentials error when the password exceeds 72 bytes", async () => {
    await expectAppError(
      loginUser({
        identifier: "Cook_123",
        password: OVER_LIMIT_PASSWORD,
      }),
      ERROR_CODES.INVALID_CREDENTIALS,
      401
    );

    expectNoBcryptCalls();
    expect(findUserByIdentifier).not.toHaveBeenCalled();
  });

  it("returns the generic credentials error for a non-string password", async () => {
    await expectAppError(
      loginUser({
        identifier: "Cook_123",
        password: null,
      }),
      ERROR_CODES.INVALID_CREDENTIALS,
      401
    );

    expectNoBcryptCalls();
    expect(findUserByIdentifier).not.toHaveBeenCalled();
  });

  it("authenticates an active, verified user", async () => {
    const user = createUser();

    findUserByIdentifier.mockResolvedValue(user);
    bcryptCompare.mockResolvedValue(true);

    const result = await loginUser({
      identifier: " Cook_123 ",
      password: VALID_PASSWORD,
    });

    expect(findUserByIdentifier).toHaveBeenCalledWith("Cook_123");

    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);

    expect(result).toMatchObject({
      id: TEST_USER_ID,
      username: "Cook_123",
    });

    expect(result).not.toHaveProperty("password");
  });

  it("rejects an incorrect password for an existing user", async () => {
    const user = createUser();

    findUserByIdentifier.mockResolvedValue(user);
    bcryptCompare.mockResolvedValue(false);

    await expectAppError(
      loginUser({
        identifier: user.username,
        password: "IncorrectPassword123",
      }),
      ERROR_CODES.INVALID_CREDENTIALS,
      401
    );

    expect(bcryptCompare).toHaveBeenCalledWith(
      "IncorrectPassword123",
      user.password
    );
  });

  it("performs a dummy bcrypt comparison when the user does not exist", async () => {
    findUserByIdentifier.mockResolvedValue(null);
    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      loginUser({
        identifier: "missing",
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.INVALID_CREDENTIALS,
      401
    );

    expect(bcryptCompare).toHaveBeenCalledWith(
      VALID_PASSWORD,
      expect.stringMatching(/^\$2[aby]\$12\$/)
    );
  });

  it("rejects a pending user whose email has not been verified", async () => {
    findUserByIdentifier.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    await expectAppError(
      loginUser({
        identifier: "Cook_123",
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.EMAIL_NOT_VERIFIED,
      403
    );
  });

  it("rejects a suspended user even when the password is correct", async () => {
    const user = createUser({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
    });

    findUserByIdentifier.mockResolvedValue(user);
    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      loginUser({
        identifier: user.username,
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.ACCOUNT_NOT_ELIGIBLE_FOR_LOGIN,
      403
    );

    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);
  });

  it("rejects a deactivated user even when the password is correct", async () => {
    const user = createUser({
      accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
    });

    findUserByIdentifier.mockResolvedValue(user);
    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      loginUser({
        identifier: user.username,
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.ACCOUNT_NOT_ELIGIBLE_FOR_LOGIN,
      403
    );

    expect(findUserByIdentifier).toHaveBeenCalledOnce();
    expect(findUserByIdentifier).toHaveBeenCalledWith(user.username);

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);
  });
});

// ============================================================================
// requestPasswordReset
// ============================================================================

describe("requestPasswordReset()", () => {
  it.each([
    {
      description: "a pending-verification account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      },
    },
    {
      description: "a suspended account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      },
    },
    {
      description: "a deactivated account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
      },
    },
    {
      description: "an active account with an unverified email",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      },
    },
  ])(
    "returns a generic response without side effects for $description",
    async ({ overrides }) => {
      findUserByEmail.mockResolvedValue(createUser(overrides));

      const result = await requestPasswordReset({
        email: "cook@example.com",
      });

      expect(result.message).toBe(
        "اگر حسابی با این ایمیل وجود داشته باشد، درخواست بازیابی رمز عبور ثبت شده است."
      );

      expectNoBcryptCalls();
      expect(replaceVerificationCode).not.toHaveBeenCalled();
      expect(sendPasswordResetCodeEmail).not.toHaveBeenCalled();
    }
  );

  it("returns the same generic response when no eligible account exists", async () => {
    findUserByEmail.mockResolvedValue(null);

    const result = await requestPasswordReset({
      email: "missing@example.com",
    });

    expect(result.message).toBe(
      "اگر حسابی با این ایمیل وجود داشته باشد، درخواست بازیابی رمز عبور ثبت شده است."
    );

    expectNoBcryptCalls();
    expect(replaceVerificationCode).not.toHaveBeenCalled();
    expect(sendPasswordResetCodeEmail).not.toHaveBeenCalled();
  });

  it("stores a hashed reset code and submits the reset email for an eligible account", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    const result = await requestPasswordReset({
      email: "cook@example.com",
    });

    expect(bcryptHash).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{6}$/),
      10
    );

    expect(replaceVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "cook@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        codeHash: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );

    expect(sendPasswordResetCodeEmail).toHaveBeenCalledWith({
      to: "cook@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresInMinutes: 10,
    });

    expect(result.message).toBe(
      "اگر حسابی با این ایمیل وجود داشته باشد، درخواست بازیابی رمز عبور ثبت شده است."
    );
  });

  it("returns a generic response when password reset email delivery fails", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    sendPasswordResetCodeEmail.mockRejectedValue(
      new Error("Email provider unavailable")
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await requestPasswordReset({
      email: "cook@example.com",
    });

    expect(result.message).toBe(
      "اگر حسابی با این ایمیل وجود داشته باشد، درخواست بازیابی رمز عبور ثبت شده است."
    );

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(sendPasswordResetCodeEmail).toHaveBeenCalledOnce();

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// verifyPasswordResetCode
// ============================================================================

describe("verifyPasswordResetCode()", () => {
  it.each([
    {
      description: "a pending-verification account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      }),
    },
    {
      description: "a missing user",
      user: null,
    },
    {
      description: "a suspended account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      }),
    },
    {
      description: "a deactivated account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
      }),
    },
    {
      description: "an active account with an unverified email",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      }),
    },
  ])(
    "rejects password reset-code verification for $description",
    async ({ user }) => {
      findUserByEmail.mockResolvedValue(user);

      await expectAppError(
        verifyPasswordResetCode({
          email: "cook@example.com",
          code: "123456",
        }),
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        400
      );

      expect(findVerificationCode).not.toHaveBeenCalled();
      expectNoBcryptCalls();
    }
  );

  it.each([
    {
      description: "a code containing letters",
      code: "12AB56",
    },
    {
      description: "a code with fewer than six digits",
      code: "12345",
    },
    {
      description: "a code with more than six digits",
      code: "1234567",
    },
    {
      description: "a code containing non-ASCII digits",
      code: "۱۲۳۴۵۶",
    },
    {
      description: "a non-string value",
      code: null,
    },
  ])("rejects $description without issuing a reset token", async ({ code }) => {
    findUserByEmail.mockResolvedValue(createUser());

    await expectAppError(
      verifyPasswordResetCode({
        email: "cook@example.com",
        code,
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400
    );

    expect(findVerificationCode).not.toHaveBeenCalled();
    expect(bcryptCompare).not.toHaveBeenCalled();
  });

  it("rejects password reset when no verification code exists", async () => {
    findUserByEmail.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(null);

    await expectAppError(
      verifyPasswordResetCode({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400
    );

    expect(findVerificationCode).toHaveBeenCalledOnce();
    expect(bcryptCompare).not.toHaveBeenCalled();
  });

  it("rejects a validly formatted but incorrect reset code", async () => {
    findUserByEmail.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(false);

    await expectAppError(
      verifyPasswordResetCode({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
  });

  it("rejects a reset code with an invalid generation ID", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    findVerificationCode.mockResolvedValue(
      createVerificationCode({
        generationId: "invalid-generation-id",
      })
    );

    await expectAppError(
      verifyPasswordResetCode({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(bcryptCompare).not.toHaveBeenCalled();
  });

  it("rejects an expired reset code after verifying its hash", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    findVerificationCode.mockResolvedValue(
      createVerificationCode({
        expiresAt: new Date(Date.now() - 1000),
      })
    );

    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      verifyPasswordResetCode({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_EXPIRED
    );

    expect(bcryptCompare).toHaveBeenCalledWith(
      "123456",
      "stored-verification-code-hash"
    );
  });

  it.each([
    {
      description: "an undefined value",
      sessionVersion: undefined,
    },
    {
      description: "a null value",
      sessionVersion: null,
    },
    {
      description: "a non-numeric value",
      sessionVersion: "0",
    },
    {
      description: "a negative value",
      sessionVersion: -1,
    },
    {
      description: "a fractional value",
      sessionVersion: 0.5,
    },
    {
      description: "a value outside the safe integer range",
      sessionVersion: Number.MAX_SAFE_INTEGER + 1,
    },
  ])(
    "rejects a reset code when the user's session version is $description",
    async ({ sessionVersion }) => {
      findUserByEmail.mockResolvedValue(createUser({ sessionVersion }));

      findVerificationCode.mockResolvedValue(createVerificationCode());

      bcryptCompare.mockResolvedValue(true);

      await expectAppError(
        verifyPasswordResetCode({
          email: "cook@example.com",
          code: "123456",
        }),
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        400
      );

      expect(bcryptCompare).toHaveBeenCalledWith(
        "123456",
        "stored-verification-code-hash"
      );

      expect(bcryptCompare).toHaveBeenCalledOnce();
    }
  );

  it("rejects reset token issuance when the session version reaches the maximum safe integer", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        sessionVersion: Number.MAX_SAFE_INTEGER,
      })
    );

    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      verifyPasswordResetCode({
        email: "cook@example.com",
        code: "123456",
      }),
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      409
    );

    expect(bcryptCompare).toHaveBeenCalledWith(
      "123456",
      "stored-verification-code-hash"
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
  });

  it("verifies a valid reset code and returns a signed reset token", async () => {
    findUserByEmail.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(true);

    const result = await verifyPasswordResetCode({
      email: "cook@example.com",
      code: "123456",
    });

    expect(bcryptCompare).toHaveBeenCalledWith(
      "123456",
      "stored-verification-code-hash"
    );

    expect(result.resetToken).toEqual(expect.any(String));
    expect(result.resetToken).toContain(".");

    expect(findVerificationCode).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledWith(
      "cook@example.com",
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );
    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
  });
});

// ============================================================================
// resetPassword
// ============================================================================

describe("resetPassword()", () => {
  describe("reset token validation", () => {
    it("rejects a reset token with an invalid signature before database or bcrypt operations", async () => {
      const token = createPasswordResetToken();
      const [payload, signature] = token.split(".");

      const modifiedSignature = `${
        signature[0] === "A" ? "B" : "A"
      }${signature.slice(1)}`;

      await expectAppError(
        resetPassword({
          resetToken: `${payload}.${modifiedSignature}`,
          newPassword: VALID_PASSWORD,
        }),
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID
      );

      expectNoBcryptCalls();
      expect(findUserByIdWithPassword).not.toHaveBeenCalled();
      expect(findVerificationCode).not.toHaveBeenCalled();
      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(updateUserPassword).not.toHaveBeenCalled();
    });

    it.each([
      {
        description: "an unsupported payload version",
        overrides: {
          v: 2,
        },
      },
      {
        description: "an unsupported token purpose",
        overrides: {
          purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        },
      },
      {
        description: "an invalid user ID",
        overrides: {
          userId: "invalid-user-id",
        },
      },
      {
        description: "an invalid verification-code ID",
        overrides: {
          verificationCodeId: "invalid-verification-code-id",
        },
      },
      {
        description: "a negative session version",
        overrides: {
          sessionVersion: -1,
        },
      },
      {
        description: "a fractional session version",
        overrides: {
          sessionVersion: 0.5,
        },
      },
      {
        description: "a session version outside the safe integer range",
        overrides: {
          sessionVersion: Number.MAX_SAFE_INTEGER + 1,
        },
      },
      {
        description: "a missing session version",
        overrides: {
          sessionVersion: undefined,
        },
      },
      {
        description: "a null session version",
        overrides: {
          sessionVersion: null,
        },
      },
      {
        description: "a non-numeric session version",
        overrides: {
          sessionVersion: "0",
        },
      },
      {
        description: "an invalid expiration value",
        overrides: {
          expiresAt: "invalid-expiration",
        },
      },
      {
        description: "an invalid generation ID",
        overrides: {
          generationId: "invalid-generation-id",
        },
      },
    ])(
      "rejects a correctly signed reset token with $description",
      async ({ overrides }) => {
        const resetToken = createPasswordResetToken(overrides);

        await expectAppError(
          resetPassword({
            resetToken,
            newPassword: VALID_PASSWORD,
          }),
          ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
          400
        );

        expectNoBcryptCalls();

        expect(findUserByIdWithPassword).not.toHaveBeenCalled();
        expect(findVerificationCode).not.toHaveBeenCalled();
        expect(consumeVerificationCode).not.toHaveBeenCalled();
        expect(updateUserPassword).not.toHaveBeenCalled();
      }
    );

    it("rejects a correctly signed reset token exceeding the maximum allowed length", async () => {
      const resetToken = createPasswordResetToken({
        extra: "x".repeat(3000),
      });

      expect(resetToken.length).toBeGreaterThan(2048);

      await expectAppError(
        resetPassword({
          resetToken,
          newPassword: VALID_PASSWORD,
        }),
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        400
      );

      expectNoBcryptCalls();

      expect(findUserByIdWithPassword).not.toHaveBeenCalled();
      expect(findVerificationCode).not.toHaveBeenCalled();
      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(updateUserPassword).not.toHaveBeenCalled();
    });

    it("rejects an expired reset token before database or bcrypt operations", async () => {
      const resetToken = createPasswordResetToken({
        expiresAt: Date.now() - 1000,
      });

      await expectAppError(
        resetPassword({
          resetToken,
          newPassword: VALID_PASSWORD,
        }),
        ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED
      );

      expectNoBcryptCalls();
      expect(findUserByIdWithPassword).not.toHaveBeenCalled();
      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(updateUserPassword).not.toHaveBeenCalled();
      expect(findVerificationCode).not.toHaveBeenCalled();
    });
  });

  it("rejects password reset when the user does not exist", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.USER_NOT_FOUND,
      404
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledWith(TEST_USER_ID);

    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a suspended account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        emailVerified: true,
      },
    },
    {
      description: "a deactivated account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
        emailVerified: true,
      },
    },
    {
      description: "a pending-verification account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      },
    },
    {
      description: "an active account with an unverified email",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      },
    },
  ])("rejects password reset for $description", async ({ overrides }) => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser(overrides));

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.FORBIDDEN,
      403
    );

    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects a reset token when the user's session version has changed", async () => {
    const resetToken = createPasswordResetToken({
      sessionVersion: 0,
    });

    findUserByIdWithPassword.mockResolvedValue(
      createUser({ sessionVersion: 1 })
    );

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects password reset when the verification code no longer exists", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expectNoBcryptCalls();

    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects a reset token when the verification code ID has changed", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser());

    findVerificationCode.mockResolvedValue(
      createVerificationCode({
        _id: "64f1a2b3c4d5e6f708090099",
      })
    );

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects a reset token when the verification code generation ID has changed", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser());

    findVerificationCode.mockResolvedValue(
      createVerificationCode({
        generationId: "550e8400-e29b-41d4-a716-446655440001",
      })
    );

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects malformed UTF-16 before database access or bcrypt operations", async () => {
    const resetToken = createPasswordResetToken();

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: INVALID_UTF16_PASSWORD,
      }),
      ERROR_CODES.INVALID_PASSWORD_ENCODING
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("rejects a password exceeding 72 bytes before database access or bcrypt operations", async () => {
    const resetToken = createPasswordResetToken();

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: OVER_LIMIT_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_EXCEEDS_BCRYPT_LIMIT
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("rejects a non-string new password before database access or bcrypt operations", async () => {
    const resetToken = createPasswordResetToken();

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: null,
      }),
      ERROR_CODES.INVALID_PASSWORD_TYPE
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("rejects reuse of the current password", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
  });

  it("rejects password reset when the verification code cannot be consumed", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(false);
    consumeVerificationCode.mockResolvedValue(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(bcryptHash).toHaveBeenCalledWith("DifferentPassword123", 12);

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects password reset when the password update fails", async () => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(false);

    consumeVerificationCode.mockResolvedValue({
      deletedCount: 1,
    });

    updateUserPassword.mockResolvedValue(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID
    );

    expect(consumeVerificationCode).toHaveBeenCalledOnce();

    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationCodeId: TEST_VERIFICATION_CODE_ID,
        generationId: TEST_GENERATION_ID,
        session: TEST_SESSION,
      })
    );

    expect(updateUserPassword).toHaveBeenCalledOnce();

    expect(updateUserPassword).toHaveBeenCalledWith(
      TEST_USER_ID,
      "hashed:DifferentPassword123",
      expect.objectContaining({
        session: TEST_SESSION,
        expectedSessionVersion: 0,
      })
    );

    expect(consumeVerificationCode.mock.invocationCallOrder[0]).toBeLessThan(
      updateUserPassword.mock.invocationCallOrder[0]
    );

    expect(withTransaction).toHaveBeenCalledOnce();
  });

  it("rejects password reset when the reset token expires before verification-code consumption", async () => {
    const now = Date.now();
    const tokenExpiresAt = now + 1000;

    const resetToken = createPasswordResetToken({
      expiresAt: tokenExpiresAt,
    });

    findUserByIdWithPassword.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(false);

    const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(now);

    try {
      withTransaction.mockImplementationOnce(async (callback) => {
        dateNowSpy.mockReturnValue(tokenExpiresAt);

        return callback(TEST_SESSION);
      });

      await expectAppError(
        resetPassword({
          resetToken,
          newPassword: "DifferentPassword123",
        }),
        ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED,
        400
      );

      expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
      expect(findVerificationCode).toHaveBeenCalledOnce();
      expect(withTransaction).toHaveBeenCalledOnce();

      expect(bcryptCompare).toHaveBeenCalledOnce();
      expect(bcryptHash).toHaveBeenCalledWith("DifferentPassword123", 12);

      expect(consumeVerificationCode).not.toHaveBeenCalled();

      expect(updateUserPassword).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("allows password reset with an expired but retained verification code", async () => {
    const resetToken = createPasswordResetToken();

    const expiredVerificationCode = createVerificationCode({
      expiresAt: new Date(Date.now() - 1000),
    });

    findUserByIdWithPassword.mockResolvedValue(createUser());
    findVerificationCode.mockResolvedValue(expiredVerificationCode);

    bcryptCompare.mockResolvedValue(false);

    const result = await resetPassword({
      resetToken,
      newPassword: "DifferentPassword123",
    });

    expect(findVerificationCode).toHaveBeenCalledWith(
      "cook@example.com",
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );

    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        codeHash: expiredVerificationCode.codeHash,
        useRetentionExpiry: true,
        generationId: TEST_GENERATION_ID,
      })
    );

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(updateUserPassword).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      id: TEST_USER_ID,
    });

    expect(result).not.toHaveProperty("password");
  });

  it("compares, hashes, and updates the password using the verified reset authorization", async () => {
    const user = createUser();
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(createVerificationCode());

    bcryptCompare.mockResolvedValue(false);

    updateUserPassword.mockResolvedValue(createUser({ sessionVersion: 1 }));

    const result = await resetPassword({
      resetToken,
      newPassword: "DifferentPassword123",
    });

    expect(bcryptCompare).toHaveBeenCalledWith(
      "DifferentPassword123",
      user.password
    );

    expect(bcryptHash).toHaveBeenCalledWith("DifferentPassword123", 12);

    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationCodeId: TEST_VERIFICATION_CODE_ID,
        email: "cook@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        generationId: TEST_GENERATION_ID,
        useRetentionExpiry: true,
        session: TEST_SESSION,
      })
    );

    expect(consumeVerificationCode).toHaveBeenCalledOnce();

    expect(updateUserPassword).toHaveBeenCalledWith(
      TEST_USER_ID,
      "hashed:DifferentPassword123",
      expect.objectContaining({
        session: TEST_SESSION,
        expectedSessionVersion: 0,
      })
    );

    expect(updateUserPassword).toHaveBeenCalledOnce();

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledWith(
      user.email,
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );
    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(withTransaction).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      id: TEST_USER_ID,
    });

    expect(result).not.toHaveProperty("password");
  });
});

// ============================================================================
// Password reset token flow
// ============================================================================

describe("password reset token flow", () => {
  it("issues a reset token and uses it to successfully reset the password", async () => {
    // Arrange
    const user = createUser();
    const verificationCode = createVerificationCode();

    const resetCode = "123456";
    const newPassword = "NewPassword456";

    const updatedUser = createUser({
      password: `hashed:${newPassword}`,
      sessionVersion: user.sessionVersion + 1,
    });

    findUserByEmail.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(verificationCode);
    findUserByIdWithPassword.mockResolvedValue(user);
    consumeVerificationCode.mockResolvedValue({ deletedCount: 1 });
    updateUserPassword.mockResolvedValue(updatedUser);

    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    // Act
    const { resetToken } = await verifyPasswordResetCode({
      email: user.email,
      code: resetCode,
    });

    const result = await resetPassword({
      resetToken,
      newPassword,
    });

    // Assert
    expect(result).toMatchObject({
      id: user._id,
    });

    expect(result).not.toHaveProperty("password");

    expect(findVerificationCode).toHaveBeenCalledTimes(2);

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      1,
      resetCode,
      verificationCode.codeHash
    );

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      2,
      newPassword,
      user.password
    );

    expect(bcryptHash).toHaveBeenCalledWith(newPassword, 12);

    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationCodeId: verificationCode._id,
        email: user.email,
        purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        codeHash: verificationCode.codeHash,
        generationId: verificationCode.generationId,
        useRetentionExpiry: true,
        session: TEST_SESSION,
      })
    );

    expect(updateUserPassword).toHaveBeenCalledWith(
      user._id,
      `hashed:${newPassword}`,
      {
        session: TEST_SESSION,
        expectedSessionVersion: user.sessionVersion,
      }
    );
  });
});

// ============================================================================
// changePassword
// ============================================================================

describe("changePassword()", () => {
  const currentUser = { _id: TEST_USER_ID };

  it("rejects password change when the authentication guard fails", async () => {
    requireActiveAuthenticatedUser.mockRejectedValue(
      new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "برای انجام این کار باید ابتدا وارد حساب کاربری خود شوید.",
        { statusCode: 401 }
      )
    );

    await expectAppError(
      changePassword(null, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.UNAUTHORIZED,
      401
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(null);

    expect(findUserByIdWithPassword).not.toHaveBeenCalled();

    expectNoBcryptCalls();

    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects password change when the authenticated user ID is invalid", async () => {
    const invalidUser = {
      _id: "invalid-user-id",
    };

    await expectAppError(
      changePassword(invalidUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.INVALID_REQUEST,
      400
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(invalidUser);

    expect(findUserByIdWithPassword).not.toHaveBeenCalled();

    expectNoBcryptCalls();

    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("maps malformed current-password encoding to the generic current-password error", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: INVALID_UTF16_PASSWORD,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
      400,
      "رمز عبور فعلی نادرست است."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("maps a current password exceeding 72 bytes to the generic current-password error", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: OVER_LIMIT_PASSWORD,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("maps a non-string current password to the generic current-password error", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: null,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("returns the specific encoding error for malformed new-password UTF-16", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: INVALID_UTF16_PASSWORD,
      }),
      ERROR_CODES.INVALID_PASSWORD_ENCODING
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("returns the byte-limit error for a new password exceeding 72 bytes", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: OVER_LIMIT_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_EXCEEDS_BCRYPT_LIMIT
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("returns the specific type error for a non-string new password", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: null,
      }),
      ERROR_CODES.INVALID_PASSWORD_TYPE
    );

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "an undefined value",
      sessionVersion: undefined,
    },
    {
      description: "a null value",
      sessionVersion: null,
    },
    {
      description: "a negative value",
      sessionVersion: -1,
    },
    {
      description: "a fractional value",
      sessionVersion: 0.5,
    },
    {
      description: "a non-numeric value",
      sessionVersion: "0",
    },
    {
      description: "a value outside the safe integer range",
      sessionVersion: Number.MAX_SAFE_INTEGER + 1,
    },
  ])(
    "rejects password change when sessionVersion is $description",
    async ({ sessionVersion }) => {
      findUserByIdWithPassword.mockResolvedValue(
        createUser({ sessionVersion })
      );

      await expectAppError(
        changePassword(currentUser, {
          currentPassword: "CurrentPassword123",
          newPassword: "NewPassword123",
        }),
        ERROR_CODES.PASSWORD_CHANGE_CONFLICT,
        409
      );

      expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

      expectNoBcryptCalls();
      expect(updateUserPassword).not.toHaveBeenCalled();
    }
  );

  it("rejects password change when sessionVersion reaches the maximum safe integer", async () => {
    findUserByIdWithPassword.mockResolvedValue(
      createUser({
        sessionVersion: Number.MAX_SAFE_INTEGER,
      })
    );

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      409
    );

    expectNoBcryptCalls();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects password change when the user cannot be found", async () => {
    findUserByIdWithPassword.mockResolvedValue(null);

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.USER_NOT_FOUND,
      404
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledWith(TEST_USER_ID);

    expectNoBcryptCalls();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a suspended account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        emailVerified: true,
      },
    },
    {
      description: "a deactivated account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
        emailVerified: true,
      },
    },
    {
      description: "a pending-verification account",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      },
    },
    {
      description: "an active account with an unverified email",
      overrides: {
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      },
    },
  ])("rejects password change for $description", async ({ overrides }) => {
    findUserByIdWithPassword.mockResolvedValue(createUser(overrides));

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.FORBIDDEN,
      403
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

    expectNoBcryptCalls();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("verifies the current password and updates a different new password", async () => {
    const user = createUser();
    const updatedUser = createUser({ sessionVersion: 1 });

    findUserByIdWithPassword.mockResolvedValue(user);

    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    updateUserPassword.mockResolvedValue(updatedUser);

    const result = await changePassword(currentUser, {
      currentPassword: "CurrentPassword123",
      newPassword: "NewPassword123",
    });

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      1,
      "CurrentPassword123",
      user.password
    );

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      2,
      "NewPassword123",
      user.password
    );

    expect(bcryptCompare).toHaveBeenCalledTimes(2);

    expect(bcryptHash).toHaveBeenCalledWith("NewPassword123", 12);

    expect(updateUserPassword).toHaveBeenCalledWith(
      TEST_USER_ID,
      "hashed:NewPassword123",
      {
        expectedSessionVersion: 0,
      }
    );

    expect(updateUserPassword).toHaveBeenCalledOnce();

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findUserByIdWithPassword).toHaveBeenCalledWith(TEST_USER_ID);

    expect(result).toMatchObject({
      id: TEST_USER_ID,
    });

    expect(result).not.toHaveProperty("password");
  });

  it("rejects the password change when the repository update fails", async () => {
    const user = createUser();

    findUserByIdWithPassword.mockResolvedValue(user);

    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    updateUserPassword.mockResolvedValue(null);

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.PASSWORD_CHANGE_CONFLICT,
      409
    );

    expect(updateUserPassword).toHaveBeenCalledOnce();
  });

  it("rejects a new password that matches the current password without hashing or updating", async () => {
    findUserByIdWithPassword.mockResolvedValue(createUser());

    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT
    );

    expect(bcryptCompare).toHaveBeenCalledTimes(2);
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password without hashing or updating", async () => {
    findUserByIdWithPassword.mockResolvedValue(createUser());

    bcryptCompare.mockResolvedValueOnce(false);

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "IncorrectPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });
});
