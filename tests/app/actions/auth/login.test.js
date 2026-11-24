import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

const mocks = vi.hoisted(() => ({
  getClientIpAddress: vi.fn(),

  createIpIdentifier: vi.fn(),
  createLoginIdentifier: vi.fn(),

  checkRateLimit: vi.fn(),

  loginIpLimiter: { name: "login-ip-limiter" },
  loginIdentifierLimiter: { name: "login-identifier-limiter" },

  connectDB: vi.fn(),

  loginUser: vi.fn(),

  createSessionForUser: vi.fn(),
  revokeSessionByToken: vi.fn(),

  setSessionCookie: vi.fn(),

  redirect: vi.fn(),
  redirectSignal: new Error("Mocked Next.js redirect"),
}));

/*
 * ============================================================================
 * Module Mocks
 * ============================================================================
 */

vi.mock("@/lib/rate-limit/get-client-ip-address", () => ({
  getClientIpAddress: mocks.getClientIpAddress,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  RedirectType: {
    replace: "replace",
  },
}));

vi.mock("@/lib/db", () => ({
  connectDB: mocks.connectDB,
}));

vi.mock("@/lib/rate-limit/identifiers", () => ({
  createIpIdentifier: mocks.createIpIdentifier,
  createLoginIdentifier: mocks.createLoginIdentifier,
}));

vi.mock("@/lib/rate-limit/policies", () => ({
  loginIpLimiter: mocks.loginIpLimiter,
  loginIdentifierLimiter: mocks.loginIdentifierLimiter,
}));

vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/services/auth.service", () => ({
  loginUser: mocks.loginUser,
}));

vi.mock("@/services/session.service", () => ({
  createSessionForUser: mocks.createSessionForUser,
  revokeSessionByToken: mocks.revokeSessionByToken,
}));

vi.mock("@/lib/auth/session-cookie", () => ({
  setSessionCookie: mocks.setSessionCookie,
}));

import { loginAction } from "@/app/actions/auth/login";

/*
 * ============================================================================
 * Test Constants
 * ============================================================================
 */

const CLIENT_IP = "203.0.113.42";

const LOGIN_IDENTIFIER = "user@example.com";
const LOGIN_PASSWORD = "ValidPassword123";

const SESSION_TOKEN = "test-session-token";

const REDIRECT_PATH = "/";
const REDIRECT_TYPE = "replace";

const IP_RATE_LIMIT_IDENTIFIER = "mock-ip-rate-limit-identifier";
const LOGIN_RATE_LIMIT_IDENTIFIER = "mock-login-rate-limit-identifier";

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

const INVALID_REQUEST_MESSAGE = "درخواست نامعتبر است.";

const INTERNAL_SERVER_ERROR_MESSAGE = "خطای غیرمنتظره‌ای رخ داد.";

const mockUser = {
  _id: "user-id-123",
  username: "test_user",
  email: LOGIN_IDENTIFIER,
};

const mockSessionContext = {
  userId: mockUser._id,
  sessionVersion: 0,
};

const mockSession = {
  _id: "session-id-123",
};

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

function createValidFormData() {
  const formData = new FormData();

  formData.set("identifier", LOGIN_IDENTIFIER);
  formData.set("password", LOGIN_PASSWORD);

  return formData;
}

/**
 * Simulate the Next.js redirect control flow.
 *
 * The real redirect() throws a framework-managed control-flow error.
 */
async function expectLoginRedirect(formData = createValidFormData()) {
  await expect(loginAction(formData)).rejects.toBe(mocks.redirectSignal);

  expect(mocks.redirect).toHaveBeenCalledTimes(1);

  expect(mocks.redirect).toHaveBeenCalledWith(REDIRECT_PATH, REDIRECT_TYPE);
}

/**
 * Validate a failed Action response.
 *
 * A failed login must never trigger navigation.
 */
function expectErrorResponse(response, code) {
  expect(response).toMatchObject({
    success: false,
    error: {
      code,
      fieldErrors: expect.any(Object),
      formErrors: expect.any(Array),
    },
  });

  expect(mocks.redirect).not.toHaveBeenCalled();
}

function createRateLimitError() {
  return new AppError(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    "تعداد درخواست‌ها بیش از حد مجاز است.",
    {
      statusCode: 429,
      details: {
        retryAfter: 45,
      },
    }
  );
}

function createRateLimitUnavailableError() {
  return new AppError(
    ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
    RATE_LIMIT_UNAVAILABLE_MESSAGE,
    {
      statusCode: 503,
      details: {
        reason: "limiter_error",
      },
    }
  );
}

/*
 * ============================================================================
 * Setup
 * ============================================================================
 */

beforeEach(() => {
  vi.resetAllMocks();

  // Client IP helper succeeds by default.
  mocks.getClientIpAddress.mockResolvedValue(CLIENT_IP);

  // Default identifier implementations.
  mocks.createIpIdentifier.mockReturnValue(IP_RATE_LIMIT_IDENTIFIER);

  mocks.createLoginIdentifier.mockReturnValue(LOGIN_RATE_LIMIT_IDENTIFIER);

  // Rate limits pass by default.
  mocks.checkRateLimit.mockResolvedValue({
    success: true,
  });

  // MongoDB connection succeeds by default.
  mocks.connectDB.mockResolvedValue(undefined);

  // Authentication succeeds by default.
  mocks.loginUser.mockResolvedValue({
    user: mockUser,
    sessionContext: mockSessionContext,
  });

  // Session creation succeeds by default.
  mocks.createSessionForUser.mockResolvedValue({
    token: SESSION_TOKEN,
    session: mockSession,
  });

  // Cookie setup succeeds by default.
  mocks.setSessionCookie.mockResolvedValue(undefined);

  // Session revocation succeeds by default.
  mocks.revokeSessionByToken.mockResolvedValue(true);

  // Simulate the Next.js redirect control-flow error.
  mocks.redirect.mockImplementation(() => {
    throw mocks.redirectSignal;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/*
 * ============================================================================
 * Client IP Dependency
 * ============================================================================
 */

describe("Client IP dependency", () => {
  it("retrieves and uses the client IP for IP-based rate limiting", async () => {
    await expectLoginRedirect();

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.createIpIdentifier).toHaveBeenCalledTimes(1);
    expect(mocks.createIpIdentifier).toHaveBeenCalledWith(
      "auth:login",
      CLIENT_IP
    );

    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(1, {
      limiter: mocks.loginIpLimiter,
      identifier: IP_RATE_LIMIT_IDENTIFIER,
    });

    const callOrder = [
      mocks.getClientIpAddress.mock.invocationCallOrder[0],
      mocks.createIpIdentifier.mock.invocationCallOrder[0],
      mocks.checkRateLimit.mock.invocationCallOrder[0],
    ];

    expect(callOrder.every(Number.isInteger)).toBe(true);

    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

  it("stops when retrieving the client IP fails with a rate-limit error", async () => {
    const ipError = createRateLimitUnavailableError();

    mocks.getClientIpAddress.mockRejectedValueOnce(ipError);

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_UNAVAILABLE);

    expect(response.error.message).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.createIpIdentifier).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.loginUser).not.toHaveBeenCalled();
    expect(mocks.createSessionForUser).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("returns an internal error when the client IP helper throws an unexpected error", async () => {
    const helperError = new Error("Client IP helper failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.getClientIpAddress.mockRejectedValueOnce(helperError);

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.createIpIdentifier).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.loginUser).not.toHaveBeenCalled();
    expect(mocks.createSessionForUser).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(helperError);
  });
});

/*
 * ============================================================================
 * FormData Extraction and Validation
 * ============================================================================
 */

describe("FormData extraction and validation", () => {
  it("rejects a non-FormData input", async () => {
    const response = await loginAction({
      identifier: LOGIN_IDENTIFIER,
      password: LOGIN_PASSWORD,
    });

    expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

    expect(response.error.message).toBe(INVALID_REQUEST_MESSAGE);

    // IP-based rate limiting happens before FormData validation.
    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.loginUser).not.toHaveBeenCalled();
  });

  it.each(["identifier", "password"])(
    "rejects duplicate values for the %s field",
    async (field) => {
      const formData = createValidFormData();

      formData.append(
        field,
        field === "identifier" ? "another@example.com" : "AnotherPassword123"
      );

      const response = await loginAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      // Only the IP-based limit should have been checked.
      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

      expect(mocks.connectDB).not.toHaveBeenCalled();
      expect(mocks.loginUser).not.toHaveBeenCalled();
    }
  );

  it.each(["identifier", "password"])(
    "rejects a missing %s field",
    async (field) => {
      const formData = createValidFormData();

      formData.delete(field);

      const response = await loginAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

      expect(mocks.connectDB).not.toHaveBeenCalled();
      expect(mocks.loginUser).not.toHaveBeenCalled();
    }
  );

  it.each(["identifier", "password"])(
    "rejects an empty %s field",
    async (field) => {
      const formData = createValidFormData();

      formData.set(field, "");

      const response = await loginAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

      expect(mocks.connectDB).not.toHaveBeenCalled();
      expect(mocks.loginUser).not.toHaveBeenCalled();
    }
  );

  it.each(["identifier", "password"])(
    "rejects a File value for the %s field",
    async (field) => {
      const formData = createValidFormData();

      formData.set(
        field,
        new Blob(["unexpected-value"], {
          type: "text/plain",
        }),
        "unexpected.txt"
      );

      const response = await loginAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      // File values must be rejected before identifier-based limiting.
      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

      expect(mocks.connectDB).not.toHaveBeenCalled();
      expect(mocks.loginUser).not.toHaveBeenCalled();
    }
  );

  it("ignores unsupported FormData fields", async () => {
    const formData = createValidFormData();

    formData.set("unexpectedField", "unexpected-value");

    await expectLoginRedirect(formData);

    expect(mocks.loginUser).toHaveBeenCalledWith({
      identifier: LOGIN_IDENTIFIER,
      password: LOGIN_PASSWORD,
    });
  });

  it.each([
    {
      type: "email",
      inputIdentifier: " User@Example.COM ",
      expectedIdentifier: "user@example.com",
    },
    {
      type: "Persian username",
      inputIdentifier: "کاربر_يك",
      expectedIdentifier: "کاربر_یک",
    },
  ])(
    "passes schema-normalized $type to identifier rate limiting and authentication",
    async ({ inputIdentifier, expectedIdentifier }) => {
      const formData = createValidFormData();

      formData.set("identifier", inputIdentifier);

      await expectLoginRedirect(formData);

      expect(mocks.createLoginIdentifier).toHaveBeenCalledWith(
        expectedIdentifier
      );

      expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(2, {
        limiter: mocks.loginIdentifierLimiter,
        identifier: LOGIN_RATE_LIMIT_IDENTIFIER,
      });

      expect(mocks.loginUser).toHaveBeenCalledWith({
        identifier: expectedIdentifier,
        password: LOGIN_PASSWORD,
      });
    }
  );

  it("preserves the password exactly as submitted", async () => {
    const formData = createValidFormData();

    const password = "  ValidPassword123  ";

    formData.set("password", password);

    await expectLoginRedirect(formData);

    expect(mocks.loginUser).toHaveBeenCalledWith({
      identifier: LOGIN_IDENTIFIER,
      password,
    });
  });

  it("rejects invalid login data before checking the identifier limit", async () => {
    const formData = createValidFormData();

    formData.set("identifier", "invalid identifier!");
    formData.set("password", "short");

    const response = await loginAction(formData);

    expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.loginUser).not.toHaveBeenCalled();
  });
});

/*
 * ============================================================================
 * Rate Limiting
 * ============================================================================
 */

describe("Rate limiting", () => {
  it("checks IP and identifier limits in the expected order", async () => {
    await expectLoginRedirect();

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(2);

    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(1, {
      limiter: mocks.loginIpLimiter,
      identifier: IP_RATE_LIMIT_IDENTIFIER,
    });

    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(2, {
      limiter: mocks.loginIdentifierLimiter,
      identifier: LOGIN_RATE_LIMIT_IDENTIFIER,
    });

    expect(mocks.checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.checkRateLimit.mock.invocationCallOrder[1]
    );
  });

  it("stops when the IP-based rate limit rejects the request", async () => {
    const rateLimitError = createRateLimitError();

    mocks.checkRateLimit.mockRejectedValueOnce(rateLimitError);

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_EXCEEDED);

    expect(response.error.retryAfter).toBe(45);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.loginUser).not.toHaveBeenCalled();
    expect(mocks.createSessionForUser).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("stops when the identifier-based rate limit rejects the request", async () => {
    const rateLimitError = createRateLimitError();

    mocks.checkRateLimit
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(rateLimitError);

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_EXCEEDED);

    expect(response.error.retryAfter).toBe(45);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(2);

    expect(mocks.connectDB).not.toHaveBeenCalled();

    expect(mocks.loginUser).not.toHaveBeenCalled();
    expect(mocks.createSessionForUser).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it.each([
    {
      limiterType: "IP",
      expectedCalls: 1,
    },
    {
      limiterType: "identifier",
      expectedCalls: 2,
    },
  ])(
    "stops login when the $limiterType rate limiter is unavailable",
    async ({ limiterType, expectedCalls }) => {
      const rateLimitError = createRateLimitUnavailableError();

      if (limiterType === "IP") {
        mocks.checkRateLimit.mockRejectedValueOnce(rateLimitError);
      } else {
        mocks.checkRateLimit
          .mockResolvedValueOnce({ success: true })
          .mockRejectedValueOnce(rateLimitError);
      }

      const response = await loginAction(createValidFormData());

      expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_UNAVAILABLE);

      expect(response.error.message).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);

      expect(response.error).not.toHaveProperty("details");

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(expectedCalls);

      expect(mocks.connectDB).not.toHaveBeenCalled();

      expect(mocks.loginUser).not.toHaveBeenCalled();
      expect(mocks.createSessionForUser).not.toHaveBeenCalled();

      expect(mocks.setSessionCookie).not.toHaveBeenCalled();
      expect(mocks.revokeSessionByToken).not.toHaveBeenCalled();

      if (limiterType === "IP") {
        expect(mocks.createLoginIdentifier).not.toHaveBeenCalled();
      } else {
        expect(mocks.createLoginIdentifier).toHaveBeenCalledTimes(1);
      }
    }
  );
});

/*
 * ============================================================================
 * Database Connection
 * ============================================================================
 */

describe("Database connection", () => {
  it("returns an internal error when the database connection fails", async () => {
    const databaseError = new Error("MongoDB connection failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.connectDB.mockRejectedValueOnce(databaseError);

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(2);

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.loginUser).not.toHaveBeenCalled();
    expect(mocks.createSessionForUser).not.toHaveBeenCalled();

    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.revokeSessionByToken).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(databaseError);
  });
});

/*
 * ============================================================================
 * Authentication and Session Creation
 * ============================================================================
 */

describe("Authentication and session creation", () => {
  it("completes the login flow and redirects to the home page", async () => {
    const formData = createValidFormData();

    formData.set("identifier", " User@Example.COM ");

    await expectLoginRedirect(formData);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(2);

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.loginUser).toHaveBeenCalledTimes(1);
    expect(mocks.createSessionForUser).toHaveBeenCalledTimes(1);
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);

    expect(mocks.loginUser).toHaveBeenCalledWith({
      identifier: LOGIN_IDENTIFIER,
      password: LOGIN_PASSWORD,
    });

    expect(mocks.createSessionForUser).toHaveBeenCalledWith(mockSessionContext);

    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      SESSION_TOKEN,
      mockSession
    );

    expect(mocks.revokeSessionByToken).not.toHaveBeenCalled();

    const callOrder = [
      mocks.getClientIpAddress.mock.invocationCallOrder[0],
      mocks.createIpIdentifier.mock.invocationCallOrder[0],
      mocks.checkRateLimit.mock.invocationCallOrder[0],
      mocks.createLoginIdentifier.mock.invocationCallOrder[0],
      mocks.checkRateLimit.mock.invocationCallOrder[1],
      mocks.connectDB.mock.invocationCallOrder[0],
      mocks.loginUser.mock.invocationCallOrder[0],
      mocks.createSessionForUser.mock.invocationCallOrder[0],
      mocks.setSessionCookie.mock.invocationCallOrder[0],
      mocks.redirect.mock.invocationCallOrder[0],
    ];

    expect(callOrder.every(Number.isInteger)).toBe(true);

    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

  it("preserves authentication errors and does not create a session", async () => {
    mocks.loginUser.mockRejectedValueOnce(
      new AppError(
        ERROR_CODES.INVALID_CREDENTIALS,
        "ایمیل، نام کاربری یا رمز عبور نامعتبر است.",
        {
          statusCode: 401,
        }
      )
    );

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INVALID_CREDENTIALS);

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.createSessionForUser).not.toHaveBeenCalled();

    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.revokeSessionByToken).not.toHaveBeenCalled();
  });

  it("does not set a cookie when session creation fails", async () => {
    mocks.createSessionForUser.mockRejectedValueOnce(
      new AppError(
        ERROR_CODES.USER_LIFECYCLE_CONFLICT,
        "امکان ایجاد نشست وجود ندارد.",
        {
          statusCode: 409,
        }
      )
    );

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.USER_LIFECYCLE_CONFLICT);

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.createSessionForUser).toHaveBeenCalledTimes(1);

    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.revokeSessionByToken).not.toHaveBeenCalled();
  });
});

/*
 * ============================================================================
 * Cookie Setup and Session Cleanup
 * ============================================================================
 */

describe("Cookie setup and session cleanup", () => {
  it("revokes the newly created session when cookie setup fails", async () => {
    const cookieError = new Error("Cookie setup failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.setSessionCookie.mockRejectedValueOnce(cookieError);

    mocks.revokeSessionByToken.mockResolvedValueOnce(true);

    const response = await loginAction(createValidFormData());

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);

    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      SESSION_TOKEN,
      mockSession
    );

    expect(mocks.revokeSessionByToken).toHaveBeenCalledTimes(1);

    expect(mocks.revokeSessionByToken).toHaveBeenCalledWith(SESSION_TOKEN);

    expect(mocks.setSessionCookie.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.revokeSessionByToken.mock.invocationCallOrder[0]
    );

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(response.error.message).not.toContain(cookieError.message);

    expect(JSON.stringify(response)).not.toContain(SESSION_TOKEN);

    // The original cookie error is logged by handleError().
    expect(consoleErrorSpy).toHaveBeenCalledWith(cookieError);
  });

  it("does not treat a false revocation result as a cleanup exception", async () => {
    const cookieError = new Error("Cookie setup failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.setSessionCookie.mockRejectedValueOnce(cookieError);

    // Revocation is idempotent and may return false for an already-revoked
    // or unknown token. This is not an exception.
    mocks.revokeSessionByToken.mockResolvedValueOnce(false);

    const response = await loginAction(createValidFormData());

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);

    expect(mocks.revokeSessionByToken).toHaveBeenCalledTimes(1);

    expect(mocks.revokeSessionByToken).toHaveBeenCalledWith(SESSION_TOKEN);

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(consoleErrorSpy).toHaveBeenCalledWith(cookieError);

    const cleanupFailureWasLogged = consoleErrorSpy.mock.calls.some(
      ([message]) =>
        message === "Failed to revoke a Session after Cookie setup failed."
    );

    expect(cleanupFailureWasLogged).toBe(false);

    expect(JSON.stringify(response)).not.toContain(SESSION_TOKEN);
  });

  it("preserves the original cookie error when session revocation also fails", async () => {
    const cookieError = new Error("Cookie setup failed");
    const revokeError = new Error("Session revocation failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.setSessionCookie.mockRejectedValueOnce(cookieError);

    mocks.revokeSessionByToken.mockRejectedValueOnce(revokeError);

    const response = await loginAction(createValidFormData());

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);

    expect(mocks.revokeSessionByToken).toHaveBeenCalledTimes(1);

    expect(mocks.revokeSessionByToken).toHaveBeenCalledWith(SESSION_TOKEN);

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    // The cleanup error is logged internally.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to revoke a Session after Cookie setup failed.",
      revokeError
    );

    // The original cookie error is still propagated to the Action's
    // error handler rather than being replaced by the cleanup error.
    expect(consoleErrorSpy).toHaveBeenCalledWith(cookieError);

    expect(JSON.stringify(response)).not.toContain(SESSION_TOKEN);
  });
});
