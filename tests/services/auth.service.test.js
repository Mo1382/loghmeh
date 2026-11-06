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

  consumeVerificationCode.mockImplementation(
    async ({ verificationCodeId, email, purpose, codeHash, generationId }) =>
      createVerificationCode({
        _id: verificationCodeId,
        email,
        purpose,
        codeHash,
        generationId,
      })
  );

  replaceVerificationCode.mockImplementation(async (codeData) =>
    createVerificationCode(codeData)
  );

  findActiveVerificationCode.mockResolvedValue(
    createVerificationCode({
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    })
  );

  findVerificationCode.mockResolvedValue(createVerificationCode());

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

    withTransaction.mockImplementationOnce(async (callback) => {
      const transactionResult = await callback(TEST_SESSION);

      expect(sendVerificationCodeEmail).not.toHaveBeenCalled();

      return transactionResult;
    });

    const registrationStartedAt = Date.now();

    const result = await registerUser({
      username: "Cook_123",
      email: "cook@example.com",
      password: VALID_PASSWORD,
      title: "USER",
    });

    const registrationFinishedAt = Date.now();

    expect(bcryptHash).toHaveBeenNthCalledWith(1, VALID_PASSWORD, 12);

    expect(createUserInRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "Cook_123",
        email: "cook@example.com",
        password: `hashed:${VALID_PASSWORD}`,
        title: "USER",
      }),
      TEST_SESSION
    );

    expect(sendVerificationCodeEmail).toHaveBeenCalledWith({
      to: "cook@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresInMinutes: 10,
    });

    const sentCode = sendVerificationCodeEmail.mock.calls[0][0].code;

    expect(bcryptHash).toHaveBeenNthCalledWith(2, sentCode, 10);

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(replaceVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "cook@example.com",
        codeHash: `hashed:${sentCode}`,
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt: expect.any(Date),
      }),
      TEST_SESSION
    );

    const storedCodeData = replaceVerificationCode.mock.calls[0][0];
    const expiresAt = storedCodeData.expiresAt;

    const tenMinutesInMs = 10 * 60 * 1000;

    expect(expiresAt).toBeInstanceOf(Date);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      registrationStartedAt + tenMinutesInMs
    );

    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      registrationFinishedAt + tenMinutesInMs
    );

    expect(result.user).toMatchObject({
      id: TEST_USER_ID,
      username: "Cook_123",
      email: "cook@example.com",
    });

    expect(result.user).not.toHaveProperty("password");
    expect(result.verificationEmailSubmissionAccepted).toBe(true);
    expect(sendVerificationCodeEmail).toHaveBeenCalledOnce();
  });

  it("does not send a verification email when storing the verification code fails", async () => {
    const pendingUser = createUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    createUserInRepository.mockResolvedValue(pendingUser);

    replaceVerificationCode.mockRejectedValue(
      new Error("Database unavailable")
    );

    await expect(
      registerUser({
        username: "Cook_123",
        email: "cook@example.com",
        password: VALID_PASSWORD,
        title: "USER",
      })
    ).rejects.toThrow("Database unavailable");

    expect(createUserInRepository).toHaveBeenCalledOnce();
    expect(replaceVerificationCode).toHaveBeenCalledOnce();

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(sendVerificationCodeEmail).not.toHaveBeenCalled();
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

    const emailError = new Error("Email provider unavailable", {
      cause: {
        code: "PROVIDER_ERROR",
        statusCode: 503,
      },
    });

    sendVerificationCodeEmail.mockRejectedValue(emailError);

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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Registration verification email failed.",
      {
        userId: TEST_USER_ID,
        errorName: "Error",
        providerErrorCode: "PROVIDER_ERROR",
        providerStatusCode: 503,
      }
    );
  });
});

// ============================================================================
// resendVerificationCode
// ============================================================================

describe("resendVerificationCode()", () => {
  it.each([
    {
      description: "a missing user",
      user: null,
    },
    {
      description: "a pending account whose email is already verified",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: true,
      }),
    },
    {
      description: "an active account with an unverified email",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      }),
    },
    {
      description: "a suspended account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        emailVerified: false,
      }),
    },
    {
      description: "a deactivated account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
        emailVerified: false,
      }),
    },
  ])(
    "returns a generic response without side effects for $description",
    async ({ user }) => {
      findUserByEmail.mockResolvedValue(user);

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

    const resendStartedAt = Date.now();

    const result = await resendVerificationCode({
      email: "cook@example.com",
    });

    const resendFinishedAt = Date.now();

    expect(sendVerificationCodeEmail).toHaveBeenCalledOnce();

    expect(sendVerificationCodeEmail).toHaveBeenCalledWith({
      to: "cook@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresInMinutes: 10,
    });

    const sentCode = sendVerificationCodeEmail.mock.calls[0][0].code;

    expect(bcryptHash).toHaveBeenCalledOnce();
    expect(bcryptHash).toHaveBeenCalledWith(sentCode, 10);

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(replaceVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "cook@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        codeHash: `hashed:${sentCode}`,
        expiresAt: expect.any(Date),
      })
    );

    const storedCodeData = replaceVerificationCode.mock.calls[0][0];
    const expiresAt = storedCodeData.expiresAt;

    const tenMinutesInMs = 10 * 60 * 1000;

    expect(expiresAt).toBeInstanceOf(Date);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      resendStartedAt + tenMinutesInMs
    );

    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      resendFinishedAt + tenMinutesInMs
    );

    expect(result.message).toBe(
      "در صورت واجد شرایط بودن حساب، کد تأیید ارسال خواهد شد."
    );
  });

  it("does not send a verification email when storing the verification code fails", async () => {
    findUserByEmail.mockResolvedValue(
      createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      })
    );

    replaceVerificationCode.mockRejectedValue(
      new Error("Database unavailable")
    );

    await expect(
      resendVerificationCode({
        email: "cook@example.com",
      })
    ).rejects.toThrow("Database unavailable");

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(sendVerificationCodeEmail).not.toHaveBeenCalled();
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

    bcryptCompare.mockResolvedValue(true);
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
    const userData = createUser();

    const user = {
      ...userData,
      toObject: vi.fn(() => userData),
    };

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
    expect(user.toObject).toHaveBeenCalledOnce();
  });

  it("normalizes email identifiers before looking up the user", async () => {
    const user = createUser();

    findUserByIdentifier.mockResolvedValue(user);

    const result = await loginUser({
      identifier: " COOK@EXAMPLE.COM ",
      password: VALID_PASSWORD,
    });

    expect(findUserByIdentifier).toHaveBeenCalledOnce();
    expect(findUserByIdentifier).toHaveBeenCalledWith("cook@example.com");

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);

    expect(result).toMatchObject({
      id: TEST_USER_ID,
      email: "cook@example.com",
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
      401,
      "ایمیل، نام کاربری یا رمز عبور نامعتبر است."
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(
      VALID_PASSWORD,
      expect.stringMatching(/^\$2[aby]\$12\$/)
    );
  });

  it("rejects a pending user whose email has not been verified", async () => {
    const user = createUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    findUserByIdentifier.mockResolvedValue(user);
    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      loginUser({
        identifier: "Cook_123",
        password: VALID_PASSWORD,
      }),
      ERROR_CODES.EMAIL_NOT_VERIFIED,
      403
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);
  });

  it("rejects an active user whose email has not been verified", async () => {
    const user = createUser({
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: false,
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

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);
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

    expect(bcryptCompare).toHaveBeenCalledOnce();
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
      description: "a missing user",
      user: null,
    },
    {
      description: "a pending-verification account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      }),
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
    "returns a generic response without side effects for $description",
    async ({ user }) => {
      findUserByEmail.mockResolvedValue(user);

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

  it("stores a hashed reset code and submits the reset email for an eligible account", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    const resetStartedAt = Date.now();

    const result = await requestPasswordReset({
      email: "cook@example.com",
    });

    const resetFinishedAt = Date.now();

    expect(sendPasswordResetCodeEmail).toHaveBeenCalledOnce();
    expect(sendPasswordResetCodeEmail).toHaveBeenCalledWith({
      to: "cook@example.com",
      code: expect.stringMatching(/^\d{6}$/),
      expiresInMinutes: 10,
    });

    const sentCode = sendPasswordResetCodeEmail.mock.calls[0][0].code;

    expect(bcryptHash).toHaveBeenCalledOnce();
    expect(bcryptHash).toHaveBeenCalledWith(sentCode, 10);

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(replaceVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "cook@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        codeHash: `hashed:${sentCode}`,
        expiresAt: expect.any(Date),
      })
    );

    const storedCodeData = replaceVerificationCode.mock.calls[0][0];
    const expiresAt = storedCodeData.expiresAt;
    const tenMinutesInMs = 10 * 60 * 1000;

    expect(expiresAt).toBeInstanceOf(Date);

    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      resetStartedAt + tenMinutesInMs
    );

    expect(expiresAt.getTime()).toBeLessThanOrEqual(
      resetFinishedAt + tenMinutesInMs
    );

    expect(result.message).toBe(
      "اگر حسابی با این ایمیل وجود داشته باشد، درخواست بازیابی رمز عبور ثبت شده است."
    );
  });

  it("does not send a reset email when storing the verification code fails", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    replaceVerificationCode.mockRejectedValue(
      new Error("Database unavailable")
    );

    await expect(
      requestPasswordReset({
        email: "cook@example.com",
      })
    ).rejects.toThrow("Database unavailable");

    expect(replaceVerificationCode).toHaveBeenCalledOnce();
    expect(sendPasswordResetCodeEmail).not.toHaveBeenCalled();
  });

  it("returns a generic response when password reset email delivery fails", async () => {
    findUserByEmail.mockResolvedValue(createUser());

    const emailError = new Error("Email provider unavailable", {
      cause: {
        code: "PROVIDER_ERROR",
        statusCode: 503,
      },
    });

    sendPasswordResetCodeEmail.mockRejectedValue(emailError);

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
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Password reset email submission failed.",
      {
        userId: TEST_USER_ID,
        errorName: "Error",
        providerErrorCode: "PROVIDER_ERROR",
        providerStatusCode: 503,
      }
    );
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

    expect(findVerificationCode).toHaveBeenCalledOnce();
    expect(bcryptCompare).not.toHaveBeenCalled();
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
    "rejects $description without comparing the code or issuing a reset token",
    async ({ code }) => {
      findUserByEmail.mockResolvedValue(createUser());

      await expectAppError(
        verifyPasswordResetCode({
          email: "cook@example.com",
          code,
        }),
        ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
        400
      );

      expect(findVerificationCode).toHaveBeenCalledOnce();
      expect(findVerificationCode).toHaveBeenCalledWith(
        "cook@example.com",
        VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
      );

      expect(bcryptCompare).not.toHaveBeenCalled();
    }
  );

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
    it.each([
      {
        description: "a missing token",
        resetToken: undefined,
      },
      {
        description: "a null token",
        resetToken: null,
      },
      {
        description: "an empty token",
        resetToken: "",
      },
      {
        description: "a non-string token",
        resetToken: 123,
      },
      {
        description: "a token without a signature",
        resetToken: "payload",
      },
      {
        description: "a token with extra segments",
        resetToken: "payload.signature.extra",
      },
    ])(
      "rejects $description before database or bcrypt operations",
      async ({ resetToken }) => {
        await expectAppError(
          resetPassword({
            resetToken,
            newPassword: VALID_PASSWORD,
          }),
          ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
          400,
          "توکن بازیابی رمز عبور نامعتبر است."
        );

        expectNoBcryptCalls();

        expect(findUserByIdWithPassword).not.toHaveBeenCalled();
        expect(findVerificationCode).not.toHaveBeenCalled();
        expect(consumeVerificationCode).not.toHaveBeenCalled();
        expect(updateUserPassword).not.toHaveBeenCalled();
      }
    );

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
          400,
          "توکن بازیابی رمز عبور نامعتبر است."
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
        400,
        "توکن بازیابی رمز عبور نامعتبر است."
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
        ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED,
        400,
        "توکن بازیابی رمز عبور منقضی شده است."
      );

      expectNoBcryptCalls();
      expect(findUserByIdWithPassword).not.toHaveBeenCalled();
      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(updateUserPassword).not.toHaveBeenCalled();
      expect(findVerificationCode).not.toHaveBeenCalled();
    });
  });

  it("rejects malformed UTF-16 before database access or bcrypt operations", async () => {
    const resetToken = createPasswordResetToken();

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: INVALID_UTF16_PASSWORD,
      }),
      ERROR_CODES.INVALID_PASSWORD_ENCODING,
      400,
      "رمز عبور دارای کدگذاری نامعتبر است."
    );

    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects a password exceeding 72 bytes before database access or bcrypt operations", async () => {
    const resetToken = createPasswordResetToken();

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: OVER_LIMIT_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_EXCEEDS_BCRYPT_LIMIT,
      400,
      "رمز عبور نباید بیشتر از ۷۲ بایت در UTF-8 باشد."
    );

    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects a non-string new password before database access or bcrypt operations", async () => {
    const resetToken = createPasswordResetToken();

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: null,
      }),
      ERROR_CODES.INVALID_PASSWORD_TYPE,
      400,
      "رمز عبور باید از نوع رشته باشد."
    );

    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
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
      404,
      "کاربر پیدا نشد."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findUserByIdWithPassword).toHaveBeenCalledWith(TEST_USER_ID);

    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a suspended account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        emailVerified: true,
      }),
    },
    {
      description: "a deactivated account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
        emailVerified: true,
      }),
    },
    {
      description: "a pending-verification account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      }),
    },
    {
      description: "an active account with an unverified email",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      }),
    },
  ])("rejects password reset for $description", async ({ user }) => {
    const resetToken = createPasswordResetToken();

    findUserByIdWithPassword.mockResolvedValue(user);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.FORBIDDEN,
      403,
      "این حساب کاربری نمی‌تواند رمز عبور خود را بازیابی کند."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

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
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400,
      "توکن بازیابی رمز عبور نامعتبر است."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects password reset when sessionVersion reaches the maximum safe integer", async () => {
    const resetToken = createPasswordResetToken({
      sessionVersion: Number.MAX_SAFE_INTEGER,
    });

    const user = createUser({
      sessionVersion: Number.MAX_SAFE_INTEGER,
    });

    findUserByIdWithPassword.mockResolvedValue(user);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.SESSION_VERSION_LIMIT_REACHED,
      409,
      "امکان بازیابی رمز عبور در وضعیت فعلی وجود ندارد."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

    expect(findVerificationCode).not.toHaveBeenCalled();
    expectNoBcryptCalls();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects password reset when the verification code no longer exists", async () => {
    const resetToken = createPasswordResetToken();

    const user = createUser();

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400,
      "توکن بازیابی رمز عبور نامعتبر است."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

    expect(findVerificationCode).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledWith(
      user.email,
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );

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
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400,
      "توکن بازیابی رمز عبور نامعتبر است."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
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
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400,
      "توکن بازیابی رمز عبور نامعتبر است."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(bcryptHash).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("rejects reuse of the current password", async () => {
    const resetToken = createPasswordResetToken();

    const user = createUser();
    const verificationCode = createVerificationCode();

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(verificationCode);

    bcryptCompare.mockResolvedValueOnce(true);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      400,
      "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(VALID_PASSWORD, user.password);

    expect(bcryptHash).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(consumeVerificationCode).not.toHaveBeenCalled();
  });

  it("rejects password reset when the verification code cannot be consumed", async () => {
    const resetToken = createPasswordResetToken();
    const user = createUser();
    const verificationCode = createVerificationCode();

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(verificationCode);

    bcryptCompare.mockResolvedValueOnce(false);
    consumeVerificationCode.mockResolvedValue(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword: "DifferentPassword123",
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400,
      "توکن بازیابی رمز عبور نامعتبر یا قبلاً استفاده شده است."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledOnce();

    expect(bcryptHash).toHaveBeenCalledOnce();
    expect(bcryptHash).toHaveBeenCalledWith("DifferentPassword123", 12);

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationCodeId: verificationCode._id,
        email: user.email,
        purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        codeHash: verificationCode.codeHash,
        generationId: TEST_GENERATION_ID,
        useRetentionExpiry: true,
        session: TEST_SESSION,
      })
    );

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects password reset when the password update fails", async () => {
    const resetToken = createPasswordResetToken();

    const user = createUser();
    const verificationCode = createVerificationCode();
    const newPassword = "DifferentPassword123";

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(verificationCode);

    bcryptCompare.mockResolvedValueOnce(false);

    consumeVerificationCode.mockResolvedValueOnce(verificationCode);
    updateUserPassword.mockResolvedValueOnce(null);

    await expectAppError(
      resetPassword({
        resetToken,
        newPassword,
      }),
      ERROR_CODES.PASSWORD_RESET_CODE_INVALID,
      400,
      "توکن بازیابی رمز عبور نامعتبر یا دیگر معتبر نیست."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expect(bcryptCompare).toHaveBeenCalledOnce();

    expect(bcryptHash).toHaveBeenCalledOnce();

    expect(consumeVerificationCode).toHaveBeenCalledOnce();

    expect(updateUserPassword).toHaveBeenCalledOnce();
    expect(updateUserPassword).toHaveBeenCalledWith(
      user._id,
      `hashed:${newPassword}`,
      expect.objectContaining({
        session: TEST_SESSION,
        expectedSessionVersion: user.sessionVersion,
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
        400,
        "توکن بازیابی رمز عبور منقضی شده است."
      );

      expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
      expect(findVerificationCode).toHaveBeenCalledOnce();

      expect(bcryptCompare).toHaveBeenCalledOnce();
      expect(bcryptHash).toHaveBeenCalledOnce();

      expect(withTransaction).toHaveBeenCalledOnce();

      expect(consumeVerificationCode).not.toHaveBeenCalled();
      expect(updateUserPassword).not.toHaveBeenCalled();
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("allows password reset with an expired but retained verification code", async () => {
    const user = createUser();
    const newPassword = "DifferentPassword123";
    const resetToken = createPasswordResetToken();

    const expiredVerificationCode = createVerificationCode({
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(expiredVerificationCode.expiresAt.getTime()).toBeLessThan(
      Date.now()
    );

    const updatedUser = createUser({
      password: `hashed:${newPassword}`,
      sessionVersion: user.sessionVersion + 1,
    });

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(expiredVerificationCode);

    bcryptCompare.mockResolvedValueOnce(false);

    consumeVerificationCode.mockResolvedValueOnce(expiredVerificationCode);
    updateUserPassword.mockResolvedValueOnce(updatedUser);

    const result = await resetPassword({
      resetToken,
      newPassword,
    });

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptHash).toHaveBeenCalledOnce();

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
    expect(consumeVerificationCode).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationCodeId: expiredVerificationCode._id,
        email: user.email,
        purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        codeHash: expiredVerificationCode.codeHash,
        generationId: expiredVerificationCode.generationId,
        useRetentionExpiry: true,
        session: TEST_SESSION,
      })
    );

    expect(updateUserPassword).toHaveBeenCalledOnce();
    expect(updateUserPassword).toHaveBeenCalledWith(
      user._id,
      `hashed:${newPassword}`,
      expect.objectContaining({
        session: TEST_SESSION,
        expectedSessionVersion: user.sessionVersion,
      })
    );

    expect(consumeVerificationCode.mock.invocationCallOrder[0]).toBeLessThan(
      updateUserPassword.mock.invocationCallOrder[0]
    );

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      id: user._id,
      email: user.email,
    });

    expect(result).not.toHaveProperty("password");
  });

  it("compares, hashes, and updates the password using the verified reset authorization", async () => {
    const user = createUser();
    const newPassword = "DifferentPassword123";
    const resetToken = createPasswordResetToken();

    const verificationCode = createVerificationCode();

    const updatedUser = createUser({
      password: `hashed:${newPassword}`,
      sessionVersion: user.sessionVersion + 1,
    });

    findUserByIdWithPassword.mockResolvedValue(user);
    findVerificationCode.mockResolvedValue(verificationCode);

    bcryptCompare.mockResolvedValueOnce(false);

    consumeVerificationCode.mockResolvedValueOnce(verificationCode);
    updateUserPassword.mockResolvedValueOnce(updatedUser);

    const result = await resetPassword({
      resetToken,
      newPassword,
    });

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findVerificationCode).toHaveBeenCalledOnce();

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptHash).toHaveBeenCalledOnce();

    expect(consumeVerificationCode).toHaveBeenCalledOnce();
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

    expect(updateUserPassword).toHaveBeenCalledOnce();
    expect(updateUserPassword).toHaveBeenCalledWith(
      user._id,
      `hashed:${newPassword}`,
      expect.objectContaining({
        session: TEST_SESSION,
        expectedSessionVersion: user.sessionVersion,
      })
    );

    expect(consumeVerificationCode.mock.invocationCallOrder[0]).toBeLessThan(
      updateUserPassword.mock.invocationCallOrder[0]
    );

    expect(withTransaction).toHaveBeenCalledOnce();

    expect(result).toMatchObject({
      id: user._id,
      email: user.email,
    });

    expect(result).not.toHaveProperty("password");
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
      401,
      "برای انجام این کار باید ابتدا وارد حساب کاربری خود شوید."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledOnce();
    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(null);

    expect(findUserByIdWithPassword).not.toHaveBeenCalled();

    expectNoBcryptCalls();

    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("propagates an invalid user ID error from the authentication guard", async () => {
    const invalidUser = {
      _id: "invalid-user-id",
    };

    requireActiveAuthenticatedUser.mockRejectedValueOnce(
      new AppError(ERROR_CODES.INVALID_REQUEST, "شناسه user ID نامعتبر است.", {
        statusCode: 400,
      })
    );

    await expectAppError(
      changePassword(invalidUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.INVALID_REQUEST,
      400,
      "شناسه user ID نامعتبر است."
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
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
      400,
      "رمز عبور نباید بیشتر از ۷۲ بایت در UTF-8 باشد."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("maps a non-string current password to the generic current-password error", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: null,
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

  it("returns the specific encoding error for malformed new-password UTF-16", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: INVALID_UTF16_PASSWORD,
      }),
      ERROR_CODES.INVALID_PASSWORD_ENCODING,
      400,
      "رمز عبور دارای کدگذاری نامعتبر است."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("returns the byte-limit error for a new password exceeding 72 bytes", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: OVER_LIMIT_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_EXCEEDS_BCRYPT_LIMIT,
      400,
      "رمز عبور نباید بیشتر از ۷۲ بایت در UTF-8 باشد."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it("returns the specific type error for a non-string new password", async () => {
    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: null,
      }),
      ERROR_CODES.INVALID_PASSWORD_TYPE,
      400,
      "رمز عبور باید از نوع رشته باشد."
    );

    expect(requireActiveAuthenticatedUser).toHaveBeenCalledWith(currentUser);

    expectNoBcryptCalls();
    expect(findUserByIdWithPassword).not.toHaveBeenCalled();
  });

  it.each([
    {
      description: "a user that cannot be found",
      user: null,
    },
    {
      description: "a suspended account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.SUSPENDED,
        emailVerified: true,
      }),
    },
    {
      description: "a deactivated account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
        emailVerified: true,
      }),
    },
    {
      description: "a pending-verification account",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
        emailVerified: false,
      }),
    },
    {
      description: "an active account with an unverified email",
      user: createUser({
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        emailVerified: false,
      }),
    },
  ])("rejects password change for $description", async ({ user }) => {
    findUserByIdWithPassword.mockResolvedValue(user);

    const isUserMissing = user === null;

    const errorCode = isUserMissing
      ? ERROR_CODES.USER_NOT_FOUND
      : ERROR_CODES.FORBIDDEN;

    const statusCode = isUserMissing ? 404 : 403;

    const message = isUserMissing
      ? "کاربر پیدا نشد."
      : "این حساب کاربری نمی‌تواند رمز عبور خود را تغییر دهد.";

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "CurrentPassword123",
        newPassword: "NewPassword123",
      }),
      errorCode,
      statusCode,
      message
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findUserByIdWithPassword).toHaveBeenCalledWith(TEST_USER_ID);

    expectNoBcryptCalls();
    expect(updateUserPassword).not.toHaveBeenCalled();
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
        409,
        "امکان تغییر رمز عبور در وضعیت فعلی وجود ندارد."
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
      409,
      "امکان تغییر رمز عبور در وضعیت فعلی وجود ندارد."
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();

    expectNoBcryptCalls();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password without hashing or updating", async () => {
    const user = createUser();

    findUserByIdWithPassword.mockResolvedValue(user);
    bcryptCompare.mockResolvedValueOnce(false);

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: "IncorrectPassword123",
        newPassword: "NewPassword123",
      }),
      ERROR_CODES.CURRENT_PASSWORD_INCORRECT,
      400,
      "رمز عبور فعلی نادرست است."
    );

    expect(bcryptCompare).toHaveBeenCalledOnce();
    expect(bcryptCompare).toHaveBeenCalledWith(
      "IncorrectPassword123",
      user.password
    );

    expect(bcryptHash).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects a new password that matches the current password without hashing or updating", async () => {
    const user = createUser();

    findUserByIdWithPassword.mockResolvedValue(user);

    // bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    bcryptCompare.mockResolvedValue(true);

    await expectAppError(
      changePassword(currentUser, {
        currentPassword: VALID_PASSWORD,
        newPassword: VALID_PASSWORD,
      }),
      ERROR_CODES.PASSWORD_SAME_AS_CURRENT,
      400,
      "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد."
    );

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      1,
      VALID_PASSWORD,
      user.password
    );

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      2,
      VALID_PASSWORD,
      user.password
    );

    expect(bcryptHash).not.toHaveBeenCalled();
    expect(updateUserPassword).not.toHaveBeenCalled();
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
      409,
      "اطلاعات احراز هویت هم‌زمان تغییر کرده است. لطفاً دوباره تلاش کنید."
    );

    expect(bcryptCompare).toHaveBeenCalledTimes(2);
    expect(bcryptHash).toHaveBeenCalledOnce();

    expect(updateUserPassword).toHaveBeenCalledOnce();
    expect(updateUserPassword).toHaveBeenCalledWith(
      user._id,
      "hashed:NewPassword123",
      { expectedSessionVersion: user.sessionVersion }
    );
  });

  it("verifies the current password and updates a different new password", async () => {
    const user = createUser();
    const currentPassword = "CurrentPassword123";
    const newPassword = "NewPassword123";

    const updatedUser = createUser({
      password: `hashed:${newPassword}`,
      sessionVersion: user.sessionVersion + 1,
    });

    findUserByIdWithPassword.mockResolvedValue(user);

    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    updateUserPassword.mockResolvedValue(updatedUser);

    const result = await changePassword(currentUser, {
      currentPassword,
      newPassword,
    });

    expect(bcryptCompare).toHaveBeenCalledTimes(2);
    expect(bcryptCompare).toHaveBeenNthCalledWith(
      1,
      currentPassword,
      user.password
    );

    expect(bcryptCompare).toHaveBeenNthCalledWith(
      2,
      newPassword,
      user.password
    );

    expect(bcryptHash).toHaveBeenCalledOnce();
    expect(bcryptHash).toHaveBeenCalledWith(newPassword, 12);

    expect(updateUserPassword).toHaveBeenCalledOnce();
    expect(updateUserPassword).toHaveBeenCalledWith(
      user._id,
      `hashed:${newPassword}`,
      { expectedSessionVersion: user.sessionVersion }
    );

    expect(findUserByIdWithPassword).toHaveBeenCalledOnce();
    expect(findUserByIdWithPassword).toHaveBeenCalledWith(user._id);

    expect(result).toMatchObject({
      id: user._id,
    });
    expect(result).not.toHaveProperty("password");
  });
});
