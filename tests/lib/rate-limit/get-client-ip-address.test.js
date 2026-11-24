import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}));

/*
 * ============================================================================
 * Module Mocks
 * ============================================================================
 */

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

import { getClientIpAddress } from "@/lib/rate-limit/get-client-ip-address";

/*
 * ============================================================================
 * Test Constants
 * ============================================================================
 */

const DEVELOPMENT_CLIENT_IP = "127.0.0.1";

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

const FORWARDED_FOR_HEADER = "x-forwarded-for";

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

/**
 * Mock request headers with a realistic get() implementation.
 *
 * Only the x-forwarded-for header returns the supplied value.
 * Other headers return null, matching the Headers API behavior.
 */
function mockForwardedIp(value) {
  const get = vi.fn((name) =>
    name.toLowerCase() === FORWARDED_FOR_HEADER ? value : null
  );

  mocks.headers.mockResolvedValue({
    get,
  });

  return get;
}

/*
 * ============================================================================
 * Setup
 * ============================================================================
 */

beforeEach(() => {
  vi.resetAllMocks();

  vi.stubEnv("NODE_ENV", "production");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/*
 * ============================================================================
 * Valid Client IP
 * ============================================================================
 */

describe("Valid client IP", () => {
  it.each([
    {
      type: "IPv4",
      ip: "203.0.113.42",
    },
    {
      type: "IPv6",
      ip: "2001:db8::1",
    },
  ])("returns a valid $type address", async ({ ip }) => {
    const getHeader = mockForwardedIp(ip);

    await expect(getClientIpAddress()).resolves.toBe(ip);

    expect(mocks.headers).toHaveBeenCalledOnce();

    expect(getHeader).toHaveBeenCalledOnce();
    expect(getHeader).toHaveBeenCalledWith(FORWARDED_FOR_HEADER);
  });

  it("trims surrounding whitespace from a valid forwarded IP", async () => {
    const ip = "203.0.113.42";

    const getHeader = mockForwardedIp(`  ${ip}  `);

    await expect(getClientIpAddress()).resolves.toBe(ip);

    expect(mocks.headers).toHaveBeenCalledOnce();

    expect(getHeader).toHaveBeenCalledOnce();
    expect(getHeader).toHaveBeenCalledWith(FORWARDED_FOR_HEADER);
  });

  it("returns a valid forwarded IP in a non-production environment", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const ip = "203.0.113.42";

    mockForwardedIp(ip);

    await expect(getClientIpAddress()).resolves.toBe(ip);

    expect(mocks.headers).toHaveBeenCalledOnce();
  });
});

/*
 * ============================================================================
 * Production Environment
 * ============================================================================
 */

describe("Production environment", () => {
  it.each([
    {
      description: "a missing header",
      headerValue: null,
    },
    {
      description: "an empty header",
      headerValue: "",
    },
    {
      description: "a whitespace-only header",
      headerValue: "   ",
    },
    {
      description: "an invalid IP address",
      headerValue: "not-an-ip",
    },
    {
      description: "an invalid IPv4 address",
      headerValue: "999.0.0.1",
    },
    {
      description: "an invalid IPv6 address",
      headerValue: "2001:db8:::1",
    },
    {
      description: "multiple forwarded IP addresses",
      headerValue: "203.0.113.42, 198.51.100.10",
    },
  ])("rejects $description", async ({ headerValue }) => {
    const getHeader = mockForwardedIp(headerValue);

    const resultPromise = getClientIpAddress();

    await expect(resultPromise).rejects.toBeInstanceOf(AppError);

    await expect(resultPromise).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      message: RATE_LIMIT_UNAVAILABLE_MESSAGE,
      statusCode: 503,
      details: {
        reason: "client_ip_unavailable",
      },
    });

    expect(mocks.headers).toHaveBeenCalledOnce();

    expect(getHeader).toHaveBeenCalledOnce();
    expect(getHeader).toHaveBeenCalledWith(FORWARDED_FOR_HEADER);
  });
});

/*
 * ============================================================================
 * Non-Production Environment
 * ============================================================================
 */

describe("Non-production environment", () => {
  it.each([
    {
      description: "a missing header",
      headerValue: null,
    },
    {
      description: "an empty header",
      headerValue: "",
    },
    {
      description: "a whitespace-only header",
      headerValue: "   ",
    },
    {
      description: "an invalid IP address",
      headerValue: "not-an-ip",
    },
    {
      description: "an invalid IPv4 address",
      headerValue: "999.0.0.1",
    },
    {
      description: "multiple forwarded IP addresses",
      headerValue: "203.0.113.42, 198.51.100.10",
    },
    {
      description: "an invalid IPv6 address",
      headerValue: "2001:db8:::1",
    },
  ])("uses the loopback fallback for $description", async ({ headerValue }) => {
    vi.stubEnv("NODE_ENV", "development");

    const getHeader = mockForwardedIp(headerValue);

    await expect(getClientIpAddress()).resolves.toBe(DEVELOPMENT_CLIENT_IP);

    expect(mocks.headers).toHaveBeenCalledOnce();

    expect(getHeader).toHaveBeenCalledOnce();
    expect(getHeader).toHaveBeenCalledWith(FORWARDED_FOR_HEADER);
  });

  it("uses the loopback fallback when NODE_ENV is test", async () => {
    vi.stubEnv("NODE_ENV", "test");

    mockForwardedIp(null);

    await expect(getClientIpAddress()).resolves.toBe(DEVELOPMENT_CLIENT_IP);

    expect(mocks.headers).toHaveBeenCalledOnce();
  });
});

/*
 * ============================================================================
 * Request Header Errors
 * ============================================================================
 */

describe("Request header errors", () => {
  it.each(["production", "development"])(
    "propagates an error thrown while reading request headers in %s",
    async (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);

      const headersError = new Error("Request headers unavailable");

      mocks.headers.mockRejectedValueOnce(headersError);

      await expect(getClientIpAddress()).rejects.toBe(headersError);

      expect(mocks.headers).toHaveBeenCalledOnce();
    }
  );
});
