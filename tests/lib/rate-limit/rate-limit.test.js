import { afterEach, describe, expect, it, vi } from "vitest";

import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";
import {
  checkMultipleRateLimits,
  checkRateLimit,
} from "@/lib/rate-limit/rate-limit";

const NOW = 1_800_000_000_000;

const RATE_LIMIT_MESSAGE =
  "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.";

/**
 * Create a mock rate limiter with a configurable result.
 */
function createLimiter(
  result = {
    success: true,
    limit: 5,
    remaining: 4,
    reset: NOW + 60_000,
  }
) {
  return {
    limit: vi.fn().mockResolvedValue(result),
  };
}

/**
 * Create a promise whose resolution can be controlled by the test.
 */
function createDeferred() {
  let resolve;

  const promise = new Promise((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
  it("returns the limiter result when the request is allowed", async () => {
    const result = {
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW + 60_000,
    };

    const limiter = createLimiter(result);

    const response = await checkRateLimit({
      limiter,
      identifier: "auth:login:user-123",
    });

    expect(response).toBe(result);
    expect(limiter.limit).toHaveBeenCalledOnce();
    expect(limiter.limit).toHaveBeenCalledWith("auth:login:user-123");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "invalid check"],
    ["an array", []],
  ])("rejects %s instead of a check object", async (_label, check) => {
    await expect(checkRateLimit(check)).rejects.toThrow(
      "Rate limit check must be an object."
    );
  });

  it.each([
    ["a missing limiter", undefined],
    ["a null limiter", null],
    ["a limiter without limit()", {}],
    ["a limiter with a non-function limit", { limit: true }],
  ])("rejects %s", async (_label, limiter) => {
    await expect(
      checkRateLimit({
        limiter,
        identifier: "user-123",
      })
    ).rejects.toThrow("Rate limiter is required.");
  });

  it.each([
    ["an undefined identifier", undefined],
    ["a null identifier", null],
    ["a numeric identifier", 123],
    ["an empty identifier", ""],
    ["a whitespace-only identifier", "   "],
  ])("rejects %s", async (_label, identifier) => {
    const limiter = createLimiter();

    await expect(
      checkRateLimit({
        limiter,
        identifier,
      })
    ).rejects.toThrow("Rate limit identifier is required.");

    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it("rejects an identifier with surrounding whitespace without calling the limiter", async () => {
    const limiter = createLimiter();

    await expect(
      checkRateLimit({
        limiter,
        identifier: " user-123 ",
      })
    ).rejects.toThrow(
      "Rate limit identifier must not contain surrounding whitespace."
    );

    expect(limiter.limit).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown string", "sometimes"],
    ["null", null],
    ["a number", 123],
  ])(
    "rejects %s as an invalid timeoutPolicy without calling the limiter",
    async (_label, timeoutPolicy) => {
      const limiter = createLimiter();

      await expect(
        checkRateLimit({
          limiter,
          identifier: "user-123",
          timeoutPolicy,
        })
      ).rejects.toThrow('Rate limit timeoutPolicy must be "open" or "closed".');

      expect(limiter.limit).not.toHaveBeenCalled();
    }
  );

  it("converts a rejected limiter promise to a 503 AppError", async () => {
    const limiterError = new Error("Redis connection failed");

    const limiter = {
      limit: vi.fn().mockRejectedValue(limiterError),
    };

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const resultPromise = checkRateLimit({
      limiter,
      identifier: "auth:login:user-123",
    });

    await expect(resultPromise).rejects.toBeInstanceOf(AppError);

    await expect(resultPromise).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "limiter_error",
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Rate limiter execution failed",
      limiterError
    );

    expect(limiter.limit).toHaveBeenCalledOnce();
    expect(limiter.limit).toHaveBeenCalledWith("auth:login:user-123");
  });

  it("converts a synchronous limiter exception to a 503 AppError", async () => {
    const limiterError = new Error("Redis connection failed");

    const limiter = {
      limit: vi.fn(() => {
        throw limiterError;
      }),
    };

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      checkRateLimit({
        limiter,
        identifier: "user-123",
      })
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "limiter_error",
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Rate limiter execution failed",
      limiterError
    );

    expect(limiter.limit).toHaveBeenCalledOnce();
  });

  it("returns a 503 AppError when the limiter response is null", async () => {
    const limiter = createLimiter(null);

    await expect(
      checkRateLimit({
        limiter,
        identifier: "user-123",
      })
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "invalid_response",
      },
    });

    expect(limiter.limit).toHaveBeenCalledOnce();
  });

  it.each([
    ["an undefined response", undefined],
    ["an array response", []],
    [
      "a response without success",
      {
        limit: 5,
        remaining: 4,
        reset: NOW + 60_000,
      },
    ],
    [
      "a response with a non-boolean success",
      {
        success: "true",
        limit: 5,
        remaining: 4,
        reset: NOW + 60_000,
      },
    ],
    [
      "a response with a zero limit",
      {
        success: true,
        limit: 0,
        remaining: 0,
        reset: NOW + 60_000,
      },
    ],
    [
      "a response with an infinite limit",
      {
        success: true,
        limit: Infinity,
        remaining: 4,
        reset: NOW + 60_000,
      },
    ],
    [
      "a response with a non-finite remaining value",
      {
        success: false,
        limit: 5,
        remaining: NaN,
        reset: NOW + 60_000,
      },
    ],
    [
      "a response with a non-finite reset timestamp",
      {
        success: true,
        limit: 5,
        remaining: 4,
        reset: NaN,
      },
    ],
    [
      "a response with a negative reset timestamp",
      {
        success: true,
        limit: 5,
        remaining: 4,
        reset: -1,
      },
    ],
  ])("rejects %s with a 503 AppError", async (_label, result) => {
    // Preserve an explicit undefined response instead of using a default.
    const limiter = {
      limit: vi.fn().mockResolvedValue(result),
    };

    await expect(
      checkRateLimit({
        limiter,
        identifier: "user-123",
      })
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "invalid_response",
      },
    });

    expect(limiter.limit).toHaveBeenCalledOnce();
  });

  it("throws an AppError with status 429 and the expected retry details when the limit is exceeded", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const limiter = createLimiter({
      success: false,
      limit: 5,
      remaining: 0,
      reset: NOW + 1_500,
    });

    const rateLimitPromise = checkRateLimit({
      limiter,
      identifier: "auth:login:user-123",
    });

    await expect(rateLimitPromise).rejects.toBeInstanceOf(AppError);

    await expect(rateLimitPromise).rejects.toMatchObject({
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: RATE_LIMIT_MESSAGE,
      statusCode: 429,
      details: {
        retryAfter: 2,
        limit: 5,
        remaining: 0,
      },
    });

    expect(limiter.limit).toHaveBeenCalledOnce();
    expect(limiter.limit).toHaveBeenCalledWith("auth:login:user-123");
  });

  it("allows a negative remaining value in a valid rate-limit response", async () => {
    // Upstash slidingWindow may return remaining: -1 for a blocked request.
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const limiter = createLimiter({
      success: false,
      limit: 5,
      remaining: -1,
      reset: NOW + 1_000,
    });

    await expect(
      checkRateLimit({
        limiter,
        identifier: "user-123",
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      details: {
        retryAfter: 1,
        limit: 5,
        remaining: -1,
      },
    });

    expect(limiter.limit).toHaveBeenCalledOnce();
  });

  it("sets retryAfter to at least one second when the reset time has passed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const limiter = createLimiter({
      success: false,
      limit: 5,
      remaining: 0,
      reset: NOW - 1_000,
    });

    await expect(
      checkRateLimit({
        limiter,
        identifier: "user-123",
      })
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      details: {
        retryAfter: 1,
      },
    });
  });

  it("throws a 503 AppError when Upstash times out and the policy is closed by default", async () => {
    const result = {
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW + 60_000,
      reason: "timeout",
    };

    const limiter = createLimiter(result);

    await expect(
      checkRateLimit({
        limiter,
        identifier: "auth:login:user-123",
      })
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "timeout",
      },
    });

    expect(limiter.limit).toHaveBeenCalledOnce();
  });

  it("returns the timeout result when timeoutPolicy is open", async () => {
    const result = {
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW + 60_000,
      reason: "timeout",
    };

    const limiter = createLimiter(result);

    const response = await checkRateLimit({
      limiter,
      identifier: "reaction:user-123",
      timeoutPolicy: "open",
    });

    expect(response).toBe(result);
    expect(limiter.limit).toHaveBeenCalledOnce();
  });
});

describe("checkMultipleRateLimits", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an object", {}],
    ["a string", "invalid checks"],
    ["a number", 123],
    ["an empty array", []],
  ])(
    "rejects %s instead of a non-empty checks array",
    async (_label, checks) => {
      await expect(checkMultipleRateLimits(checks)).rejects.toThrow(
        "At least one rate-limit check is required."
      );
    }
  );

  it("validates every check before invoking any limiter", async () => {
    const firstLimiter = createLimiter();

    await expect(
      checkMultipleRateLimits([
        {
          limiter: firstLimiter,
          identifier: "user-123",
        },
        {
          limiter: createLimiter(),
          identifier: "   ",
        },
      ])
    ).rejects.toThrow("Rate limit identifier is required.");

    expect(firstLimiter.limit).not.toHaveBeenCalled();
  });

  it("validates every timeoutPolicy before invoking any limiter", async () => {
    const firstLimiter = createLimiter();

    await expect(
      checkMultipleRateLimits([
        {
          limiter: firstLimiter,
          identifier: "user-123",
        },
        {
          limiter: createLimiter(),
          identifier: "user-456",
          timeoutPolicy: "sometimes",
        },
      ])
    ).rejects.toThrow('Rate limit timeoutPolicy must be "open" or "closed".');

    expect(firstLimiter.limit).not.toHaveBeenCalled();
  });

  it("returns results in input order when all checks pass", async () => {
    const firstResult = {
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW + 60_000,
    };

    const secondResult = {
      success: true,
      limit: 10,
      remaining: 8,
      reset: NOW + 60_000,
    };

    const firstLimiter = createLimiter(firstResult);
    const secondLimiter = createLimiter(secondResult);

    const results = await checkMultipleRateLimits([
      {
        limiter: firstLimiter,
        identifier: "auth:login:ip:abc",
      },
      {
        limiter: secondLimiter,
        identifier: "auth:login:email:def",
      },
    ]);

    expect(results).toEqual([firstResult, secondResult]);

    expect(firstLimiter.limit).toHaveBeenCalledOnce();
    expect(firstLimiter.limit).toHaveBeenCalledWith("auth:login:ip:abc");

    expect(secondLimiter.limit).toHaveBeenCalledOnce();
    expect(secondLimiter.limit).toHaveBeenCalledWith("auth:login:email:def");
  });

  it("applies timeoutPolicy independently to each check", async () => {
    const firstResult = {
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW + 60_000,
      reason: "timeout",
    };

    const secondResult = {
      success: true,
      limit: 10,
      remaining: 8,
      reset: NOW + 60_000,
      reason: "timeout",
    };

    const firstLimiter = createLimiter(firstResult);
    const secondLimiter = createLimiter(secondResult);

    await expect(
      checkMultipleRateLimits([
        {
          limiter: firstLimiter,
          identifier: "reaction:user-123",
          timeoutPolicy: "open",
        },
        {
          limiter: secondLimiter,
          identifier: "bookmark:user-123",
          timeoutPolicy: "closed",
        },
      ])
    ).rejects.toMatchObject({
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "timeout",
      },
    });

    expect(firstLimiter.limit).toHaveBeenCalledOnce();
    expect(secondLimiter.limit).toHaveBeenCalledOnce();
  });

  it("throws a rate-limit AppError if any check exceeds its limit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const allowedLimiter = createLimiter({
      success: true,
      limit: 5,
      remaining: 4,
      reset: NOW + 60_000,
    });

    const blockedLimiter = createLimiter({
      success: false,
      limit: 3,
      remaining: 0,
      reset: NOW + 5_000,
    });

    await expect(
      checkMultipleRateLimits([
        {
          limiter: allowedLimiter,
          identifier: "auth:login:ip:abc",
        },
        {
          limiter: blockedLimiter,
          identifier: "auth:login:email:def",
        },
      ])
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      details: {
        retryAfter: 5,
        limit: 3,
        remaining: 0,
      },
    });

    expect(allowedLimiter.limit).toHaveBeenCalledOnce();
    expect(blockedLimiter.limit).toHaveBeenCalledOnce();
  });

  it("converts a rejected limiter promise to a 503 AppError and starts all checks", async () => {
    const limiterError = new Error("Redis connection failed");

    const firstLimiter = createLimiter();

    const secondLimiter = {
      limit: vi.fn().mockRejectedValue(limiterError),
    };

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      checkMultipleRateLimits([
        {
          limiter: firstLimiter,
          identifier: "auth:login:ip:abc",
        },
        {
          limiter: secondLimiter,
          identifier: "auth:login:email:def",
        },
      ])
    ).rejects.toMatchObject({
      name: "AppError",
      code: ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
      statusCode: 503,
      details: {
        reason: "limiter_error",
      },
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Rate limiter execution failed",
      limiterError
    );

    expect(firstLimiter.limit).toHaveBeenCalledOnce();
    expect(secondLimiter.limit).toHaveBeenCalledOnce();
  });

  it("returns the rate-limit error from the first check to complete unsuccessfully when multiple checks are blocked", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const firstResult = createDeferred();
    const secondResult = createDeferred();

    const firstLimiter = {
      limit: vi.fn(() => firstResult.promise),
    };

    const secondLimiter = {
      limit: vi.fn(() => secondResult.promise),
    };

    const resultPromise = checkMultipleRateLimits([
      {
        limiter: firstLimiter,
        identifier: "auth:login:ip:abc",
      },
      {
        limiter: secondLimiter,
        identifier: "auth:login:email:def",
      },
    ]);

    const rejectionExpectation = expect(resultPromise).rejects.toMatchObject({
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      details: {
        retryAfter: 3,
        limit: 3,
        remaining: 0,
      },
    });

    expect(firstLimiter.limit).toHaveBeenCalledOnce();
    expect(secondLimiter.limit).toHaveBeenCalledOnce();

    // Make the second check fail first.
    secondResult.resolve({
      success: false,
      limit: 3,
      remaining: 0,
      reset: NOW + 2_500,
    });

    await rejectionExpectation;

    // The first check also fails, but its rejection occurs later.
    firstResult.resolve({
      success: false,
      limit: 5,
      remaining: 0,
      reset: NOW + 9_000,
    });
  });
});
