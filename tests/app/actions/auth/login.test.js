import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),

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

vi.mock("next/headers", () => ({
  headers: mocks.headers,
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
const DEVELOPMENT_CLIENT_IP = "127.0.0.1";

const SESSION_TOKEN = "test-session-token";

const REDIRECT_PATH = "/";
const REDIRECT_TYPE = "replace";

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

const INVALID_REQUEST_MESSAGE = "درخواست نامعتبر است.";

const INTERNAL_SERVER_ERROR_MESSAGE = "خطای غیرمنتظره‌ای رخ داد.";

const mockUser = {
  _id: "user-id-123",
  username: "test_user",
  email: "user@example.com",
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

  formData.set("identifier", "user@example.com");
  formData.set("password", "ValidPassword123");

  return formData;
}

function mockForwardedIp(value) {
  mocks.headers.mockResolvedValue({
    get: (name) => (name === "x-forwarded-for" ? value : null),
  });
}

/**
 * Simulate Next.js redirect control flow.
 *
 * The real redirect() throws a framework-managed control-flow error.
 * This helper verifies that the Action reaches the redirect only after
 * completing the successful login flow.
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

  vi.stubEnv("NODE_ENV", "production");

  // Default request headers.
  mockForwardedIp(CLIENT_IP);

  // Default identifier implementations.
  mocks.createIpIdentifier.mockImplementation(
    (prefix, ip) => `${prefix}:ip:${ip}`
  );

  mocks.createLoginIdentifier.mockImplementation(
    (identifier) => `auth:login:identifier:${identifier}`
  );

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
  vi.unstubAllEnvs();
});

/*
 * ============================================================================
 * Client IP Address
 * ============================================================================
 */

describe("Client IP address", () => {
  describe("valid forwarded IP", () => {
    it.each([
      {
        type: "IPv4",
        ip: "203.0.113.42",
      },
      {
        type: "IPv6",
        ip: "2001:db8::1",
      },
    ])("accepts a valid $type address", async ({ ip }) => {
      mockForwardedIp(` ${ip} `);

      await expectLoginRedirect();

      expect(mocks.createIpIdentifier).toHaveBeenCalledWith("auth:login", ip);

      expect(mocks.headers).toHaveBeenCalledTimes(1);
    });
  });

  describe("production environment", () => {
    it.each([
      {
        description: "missing header",
        headerValue: null,
      },
      {
        description: "empty header",
        headerValue: "",
      },
      {
        description: "whitespace-only header",
        headerValue: "   ",
      },
      {
        description: "invalid IP",
        headerValue: "not-an-ip",
      },
      {
        description: "multiple forwarded IPs",
        headerValue: "203.0.113.42, 198.51.100.10",
      },
    ])("rejects $description", async ({ headerValue }) => {
      mockForwardedIp(headerValue);

      const response = await loginAction(createValidFormData());

      expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_UNAVAILABLE);

      expect(response.error.message).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);

      expect(mocks.createIpIdentifier).not.toHaveBeenCalled();
      expect(mocks.checkRateLimit).not.toHaveBeenCalled();

      expect(mocks.connectDB).not.toHaveBeenCalled();
      expect(mocks.loginUser).not.toHaveBeenCalled();
    });
  });

  describe("development environment", () => {
    it.each([
      {
        description: "missing header",
        headerValue: null,
      },
      {
        description: "empty header",
        headerValue: "",
      },
      {
        description: "whitespace-only header",
        headerValue: "   ",
      },
      {
        description: "invalid IP",
        headerValue: "not-an-ip",
      },
      {
        description: "multiple forwarded IPs",
        headerValue: "203.0.113.42, 198.51.100.10",
      },
    ])("uses the local fallback for $description", async ({ headerValue }) => {
      vi.stubEnv("NODE_ENV", "development");

      mockForwardedIp(headerValue);

      await expectLoginRedirect();

      expect(mocks.createIpIdentifier).toHaveBeenCalledWith(
        "auth:login",
        DEVELOPMENT_CLIENT_IP
      );

      expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(1, {
        limiter: mocks.loginIpLimiter,
        identifier: `auth:login:ip:${DEVELOPMENT_CLIENT_IP}`,
      });
    });
  });

  it("returns an internal error when reading request headers fails", async () => {
    const headersError = new Error("Request headers unavailable");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.headers.mockRejectedValueOnce(headersError);

    const response = await loginAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(mocks.createIpIdentifier).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();

    expect(mocks.connectDB).not.toHaveBeenCalled();
    expect(mocks.loginUser).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(headersError);
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
      identifier: "user@example.com",
      password: "ValidPassword123",
    });

    expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

    expect(response.error.message).toBe(INVALID_REQUEST_MESSAGE);

    // IP-based rate limiting happens before FormData validation.
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

      // Only the IP-based limit should have been checked.
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

      // Only the IP-based limit should have been checked.
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
      identifier: "user@example.com",
      password: "ValidPassword123",
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
        identifier: `auth:login:identifier:${expectedIdentifier}`,
      });

      expect(mocks.loginUser).toHaveBeenCalledWith({
        identifier: expectedIdentifier,
        password: "ValidPassword123",
      });
    }
  );

  it("preserves the password exactly as submitted", async () => {
    const formData = createValidFormData();

    const password = "  ValidPassword123  ";

    formData.set("password", password);

    await expectLoginRedirect(formData);

    expect(mocks.loginUser).toHaveBeenCalledWith({
      identifier: "user@example.com",
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
  it("checks the IP-based limit before processing login data", async () => {
    await expectLoginRedirect();

    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(1, {
      limiter: mocks.loginIpLimiter,
      identifier: `auth:login:ip:${CLIENT_IP}`,
    });

    expect(mocks.checkRateLimit).toHaveBeenNthCalledWith(2, {
      limiter: mocks.loginIdentifierLimiter,
      identifier: "auth:login:identifier:user@example.com",
    });
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
  it("connects to MongoDB after both rate limits pass and before authentication", async () => {
    await expectLoginRedirect();

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    const callOrder = [
      mocks.checkRateLimit.mock.invocationCallOrder[0],
      mocks.checkRateLimit.mock.invocationCallOrder[1],
      mocks.connectDB.mock.invocationCallOrder[0],
      mocks.loginUser.mock.invocationCallOrder[0],
    ];

    expect(callOrder.every(Number.isInteger)).toBe(true);

    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

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
 * Authentication
 * ============================================================================
 */

describe("Authentication", () => {
  it("completes the login flow and redirects to the home page", async () => {
    const formData = createValidFormData();

    formData.set("identifier", " User@Example.COM ");

    await expectLoginRedirect(formData);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(2);

    expect(mocks.connectDB).toHaveBeenCalledTimes(1);

    expect(mocks.loginUser).toHaveBeenCalledTimes(1);
    expect(mocks.createSessionForUser).toHaveBeenCalledTimes(1);
    expect(mocks.setSessionCookie).toHaveBeenCalledTimes(1);

    expect(mocks.loginUser).toHaveBeenCalledWith({
      identifier: "user@example.com",
      password: "ValidPassword123",
    });

    expect(mocks.createSessionForUser).toHaveBeenCalledWith(mockSessionContext);

    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      SESSION_TOKEN,
      mockSession
    );

    expect(mocks.revokeSessionByToken).not.toHaveBeenCalled();
  });

  it("executes the successful login flow in the expected order", async () => {
    await expectLoginRedirect();

    const callOrder = [
      mocks.headers.mock.invocationCallOrder[0],
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
});

/*
 * ============================================================================
 * Session Creation
 * ============================================================================
 */

describe("Session creation", () => {
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
