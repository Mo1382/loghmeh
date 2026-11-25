import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import { USER_TITLES } from "@/constants/enums";
import AppError from "@/lib/errors/AppError";

const mocks = vi.hoisted(() => ({
  getClientIpAddress: vi.fn(),

  createIpIdentifier: vi.fn(),

  checkRateLimit: vi.fn(),

  registerIpLimiter: { name: "register-ip-limiter" },

  registerUser: vi.fn(),

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

vi.mock("@/lib/rate-limit/identifiers", () => ({
  createIpIdentifier: mocks.createIpIdentifier,
}));

vi.mock("@/lib/rate-limit/policies", () => ({
  registerIpLimiter: mocks.registerIpLimiter,
}));

vi.mock("@/lib/rate-limit/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/services/auth.service", () => ({
  registerUser: mocks.registerUser,
}));

import { registerAction } from "@/app/actions/auth/register";

/*
 * ============================================================================
 * Test Constants
 * ============================================================================
 */

const CLIENT_IP = "203.0.113.42";

const IP_RATE_LIMIT_IDENTIFIER = "mock-register-ip-rate-limit-identifier";

const REGISTRATION_USERNAME = "کاربر_یک";
const REGISTRATION_EMAIL = "user+tag@example.com";
const REGISTRATION_PASSWORD = "ValidPassword123";

const ACCEPTED_EMAIL_REDIRECT =
  "/verify-email?email=user%2Btag%40example.com&emailSubmission=accepted";

const FAILED_EMAIL_REDIRECT =
  "/verify-email?email=user%2Btag%40example.com&emailSubmission=failed";

const REDIRECT_TYPE = "replace";

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

const INVALID_REQUEST_MESSAGE = "درخواست نامعتبر است.";

const INTERNAL_SERVER_ERROR_MESSAGE = "خطای غیرمنتظره‌ای رخ داد.";

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

function createValidFormData() {
  const formData = new FormData();

  formData.set("username", " کاربر_يك ");
  formData.set("email", " User+Tag@Example.COM ");
  formData.set("password", REGISTRATION_PASSWORD);

  // title is intentionally omitted to test the Zod default.

  return formData;
}

/**
 * Simulate the Next.js redirect control flow.
 *
 * The real redirect() throws a framework-managed control-flow error.
 */
async function expectRegisterRedirect(
  destination,
  formData = createValidFormData()
) {
  await expect(registerAction(formData)).rejects.toBe(mocks.redirectSignal);

  expect(mocks.redirect).toHaveBeenCalledTimes(1);

  expect(mocks.redirect).toHaveBeenCalledWith(destination, REDIRECT_TYPE);
}

/**
 * Validate a failed Action response.
 *
 * A failed registration must never trigger navigation.
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

/**
 * Create an IP rate-limit error.
 */
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

/**
 * Create a rate-limit infrastructure error.
 */
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

  // Identifier generation succeeds by default.
  mocks.createIpIdentifier.mockReturnValue(IP_RATE_LIMIT_IDENTIFIER);

  // Rate limit passes by default.
  mocks.checkRateLimit.mockResolvedValue({
    success: true,
  });

  // Registration succeeds by default.
  mocks.registerUser.mockImplementation(async ({ email }) => ({
    user: {
      email,
    },
    verificationEmailSubmissionAccepted: true,
  }));

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
  it("stops when retrieving the client IP fails with a rate-limit error", async () => {
    const ipError = createRateLimitUnavailableError();

    mocks.getClientIpAddress.mockRejectedValueOnce(ipError);

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_UNAVAILABLE);

    expect(response.error.message).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.createIpIdentifier).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();

    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it("returns an internal error when the client IP helper throws an unexpected error", async () => {
    const helperError = new Error("Client IP helper failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.getClientIpAddress.mockRejectedValueOnce(helperError);

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.createIpIdentifier).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();

    expect(mocks.registerUser).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(helperError);
  });

  it("returns an internal error when IP identifier creation fails", async () => {
    const identifierError = new Error("IP identifier creation failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.createIpIdentifier.mockImplementationOnce(() => {
      throw identifierError;
    });

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);
    expect(mocks.createIpIdentifier).toHaveBeenCalledTimes(1);

    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.registerUser).not.toHaveBeenCalled();

    expect(mocks.redirect).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(identifierError);
  });
});

/*
 * ============================================================================
 * FormData Extraction and Validation
 * ============================================================================
 */

describe("FormData extraction and validation", () => {
  it("rejects a non-FormData input", async () => {
    const response = await registerAction({
      username: "test_user",
      email: "test@example.com",
      password: REGISTRATION_PASSWORD,
    });

    expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

    expect(response.error.message).toBe(INVALID_REQUEST_MESSAGE);

    // IP-based rate limiting happens before FormData validation.
    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it.each(["username", "email", "password"])(
    "rejects a missing %s field",
    async (field) => {
      const formData = createValidFormData();

      formData.delete(field);

      const response = await registerAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.registerUser).not.toHaveBeenCalled();
    }
  );

  it.each(["username", "email", "password", "title"])(
    "rejects duplicate values for the %s field",
    async (field) => {
      const formData = createValidFormData();

      const firstValues = {
        username: "another_user",
        email: "another@example.com",
        password: "AnotherPassword123",
        title: USER_TITLES.COOK,
      };

      const secondValues = {
        username: "second_user",
        email: "second@example.com",
        password: "DifferentPassword456",
        title: USER_TITLES.HEAD_CHEF,
      };

      formData.set(field, firstValues[field]);
      formData.append(field, secondValues[field]);

      expect(formData.getAll(field)).toHaveLength(2);

      const response = await registerAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
      expect(mocks.registerUser).not.toHaveBeenCalled();
    }
  );

  it.each(["username", "email", "password", "title"])(
    "rejects an empty %s field",
    async (field) => {
      const formData = createValidFormData();

      formData.set(field, "");

      const response = await registerAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.registerUser).not.toHaveBeenCalled();
    }
  );

  it.each(["username", "email", "password", "title"])(
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

      const response = await registerAction(formData);

      expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

      expect(response.error.fieldErrors).toHaveProperty(field);

      expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

      expect(mocks.registerUser).not.toHaveBeenCalled();
    }
  );

  it("rejects invalid registration data before calling the service", async () => {
    const formData = createValidFormData();

    formData.set("username", "x");
    formData.set("email", "invalid-email");
    formData.set("password", "short");
    formData.set("title", "INVALID_TITLE");

    const response = await registerAction(formData);

    expectErrorResponse(response, ERROR_CODES.INVALID_REQUEST);

    expect(response.error.fieldErrors).toMatchObject({
      username: expect.any(Array),
      email: expect.any(Array),
      password: expect.any(Array),
      title: expect.any(Array),
    });

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it("ignores unsupported FormData fields", async () => {
    const formData = createValidFormData();

    formData.set("role", "ADMIN");
    formData.set("isAdmin", "true");
    formData.set("unexpectedField", "unexpected-value");

    await expectRegisterRedirect(ACCEPTED_EMAIL_REDIRECT, formData);

    expect(mocks.registerUser).toHaveBeenCalledTimes(1);

    expect(mocks.registerUser).toHaveBeenCalledWith({
      username: REGISTRATION_USERNAME,
      email: REGISTRATION_EMAIL,
      password: REGISTRATION_PASSWORD,
      title: USER_TITLES.USER,
    });
  });

  it("passes an explicitly selected title to the registration service", async () => {
    const formData = createValidFormData();

    formData.set("title", USER_TITLES.COOK);

    await expectRegisterRedirect(ACCEPTED_EMAIL_REDIRECT, formData);

    expect(mocks.registerUser).toHaveBeenCalledWith({
      username: REGISTRATION_USERNAME,
      email: REGISTRATION_EMAIL,
      password: REGISTRATION_PASSWORD,
      title: USER_TITLES.COOK,
    });
  });

  it("preserves the password exactly as submitted", async () => {
    const formData = createValidFormData();

    const password = "  ValidPassword123  ";

    formData.set("password", password);

    await expectRegisterRedirect(ACCEPTED_EMAIL_REDIRECT, formData);

    expect(mocks.registerUser).toHaveBeenCalledWith({
      username: REGISTRATION_USERNAME,
      email: REGISTRATION_EMAIL,
      password,
      title: USER_TITLES.USER,
    });
  });
});

/*
 * ============================================================================
 * Rate Limiting
 * ============================================================================
 */

describe("Rate limiting", () => {
  it("uses only the registration IP limiter", async () => {
    await expectRegisterRedirect(ACCEPTED_EMAIL_REDIRECT);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.checkRateLimit).toHaveBeenCalledWith({
      limiter: mocks.registerIpLimiter,
      identifier: IP_RATE_LIMIT_IDENTIFIER,
    });
  });

  it("stops registration when the IP-based rate limit rejects the request", async () => {
    const rateLimitError = createRateLimitError();

    mocks.checkRateLimit.mockRejectedValueOnce(rateLimitError);

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_EXCEEDED);

    expect(response.error.retryAfter).toBe(45);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.registerUser).not.toHaveBeenCalled();
  });

  it("stops registration when the rate limiter is unavailable", async () => {
    const rateLimitError = createRateLimitUnavailableError();

    mocks.checkRateLimit.mockRejectedValueOnce(rateLimitError);

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.RATE_LIMIT_UNAVAILABLE);

    expect(response.error.message).toBe(RATE_LIMIT_UNAVAILABLE_MESSAGE);

    // Internal limiter details must not be exposed to the client.
    expect(response.error).not.toHaveProperty("details");

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.registerUser).not.toHaveBeenCalled();
  });
});

/*
 * ============================================================================
 * Registration Service
 * ============================================================================
 */

describe("Registration service", () => {
  it.each([
    {
      code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
      message: "حسابی با این ایمیل از قبل وجود دارد.",
    },
    {
      code: ERROR_CODES.USERNAME_ALREADY_EXISTS,
      message: "این نام کاربری قبلاً استفاده شده است.",
    },
  ])("preserves registration errors: $code", async ({ code, message }) => {
    const registrationError = new AppError(code, message, {
      statusCode: 409,
    });

    mocks.registerUser.mockRejectedValueOnce(registrationError);

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, code);

    expect(response.error.message).toBe(message);

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.registerUser).toHaveBeenCalledTimes(1);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns an internal error when the registration service throws an unexpected error", async () => {
    const serviceError = new Error("Registration service failed");

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mocks.registerUser.mockRejectedValueOnce(serviceError);

    const response = await registerAction(createValidFormData());

    expectErrorResponse(response, ERROR_CODES.INTERNAL_SERVER_ERROR);

    expect(response.error.message).toBe(INTERNAL_SERVER_ERROR_MESSAGE);

    expect(mocks.registerUser).toHaveBeenCalledTimes(1);

    expect(mocks.redirect).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(serviceError);
  });
});

/*
 * ============================================================================
 * Successful Registration and Redirect
 * ============================================================================
 */

describe("Successful registration and redirect", () => {
  it("redirects to email verification when email submission is accepted", async () => {
    await expectRegisterRedirect(ACCEPTED_EMAIL_REDIRECT);

    expect(mocks.getClientIpAddress).toHaveBeenCalledTimes(1);

    expect(mocks.createIpIdentifier).toHaveBeenCalledWith(
      "auth:register",
      CLIENT_IP
    );

    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(1);

    expect(mocks.registerUser).toHaveBeenCalledTimes(1);

    // Username and email are normalized by the registration schema.
    // The missing title receives its default value.
    expect(mocks.registerUser).toHaveBeenCalledWith({
      username: REGISTRATION_USERNAME,
      email: REGISTRATION_EMAIL,
      password: REGISTRATION_PASSWORD,
      title: USER_TITLES.USER,
    });

    const callOrder = [
      mocks.getClientIpAddress.mock.invocationCallOrder[0],
      mocks.createIpIdentifier.mock.invocationCallOrder[0],
      mocks.checkRateLimit.mock.invocationCallOrder[0],
      mocks.registerUser.mock.invocationCallOrder[0],
      mocks.redirect.mock.invocationCallOrder[0],
    ];

    expect(callOrder.every(Number.isInteger)).toBe(true);

    expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
  });

  it("redirects to email verification even when email submission fails", async () => {
    mocks.registerUser.mockResolvedValueOnce({
      user: {
        email: REGISTRATION_EMAIL,
      },
      verificationEmailSubmissionAccepted: false,
    });

    await expectRegisterRedirect(FAILED_EMAIL_REDIRECT);

    expect(mocks.registerUser).toHaveBeenCalledTimes(1);

    expect(mocks.redirect).toHaveBeenCalledWith(
      FAILED_EMAIL_REDIRECT,
      REDIRECT_TYPE
    );
  });

  it("uses the email returned by the registration service in the redirect URL", async () => {
    const serviceEmail = "normalized@example.com";

    mocks.registerUser.mockResolvedValueOnce({
      user: {
        email: serviceEmail,
      },
      verificationEmailSubmissionAccepted: true,
    });

    await expectRegisterRedirect(
      "/verify-email?email=normalized%40example.com&emailSubmission=accepted"
    );

    expect(mocks.registerUser).toHaveBeenCalledTimes(1);
  });
});
