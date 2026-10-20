import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

function createRateLimitUnavailableError(reason) {
  return new AppError(
    ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
    RATE_LIMIT_UNAVAILABLE_MESSAGE,
    {
      statusCode: 503,
      details: { reason },
    }
  );
}

/**
 * Validate a single rate-limit check.
 */
function validateRateLimitCheck(check) {
  if (!check || typeof check !== "object" || Array.isArray(check)) {
    throw new Error("Rate limit check must be an object.");
  }

  const { limiter, identifier, timeoutPolicy = "closed" } = check;

  if (!limiter || typeof limiter.limit !== "function") {
    throw new Error("Rate limiter is required.");
  }

  if (typeof identifier !== "string" || identifier.trim().length === 0) {
    throw new Error("Rate limit identifier is required.");
  }

  if (identifier !== identifier.trim()) {
    throw new Error(
      "Rate limit identifier must not contain surrounding whitespace."
    );
  }

  if (timeoutPolicy !== "open" && timeoutPolicy !== "closed") {
    throw new Error('Rate limit timeoutPolicy must be "open" or "closed".');
  }

  return { limiter, identifier, timeoutPolicy };
}

/**
 * Validate the response returned by the rate limiter.
 */
function validateRateLimitResult(result) {
  const isValid =
    result !== null &&
    typeof result === "object" &&
    !Array.isArray(result) &&
    typeof result.success === "boolean" &&
    Number.isFinite(result.limit) &&
    result.limit > 0 &&
    Number.isFinite(result.remaining) &&
    Number.isFinite(result.reset) &&
    result.reset >= 0;

  if (!isValid) {
    throw createRateLimitUnavailableError("invalid_response");
  }

  return result;
}

async function runLimitCheck(limiter, identifier, timeoutPolicy) {
  let result;

  try {
    result = await limiter.limit(identifier);
  } catch (error) {
    console.error("Rate limiter execution failed", error);

    throw createRateLimitUnavailableError("limiter_error");
  }

  result = validateRateLimitResult(result);

  if (result.reason === "timeout") {
    if (timeoutPolicy === "open") {
      return result;
    }

    throw createRateLimitUnavailableError("timeout");
  }

  if (result.success) {
    return result;
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

  throw new AppError(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کنید.",
    {
      statusCode: 429,
      details: {
        retryAfter,
        limit: result.limit,
        remaining: result.remaining,
      },
    }
  );
}

export async function checkRateLimit(check) {
  const { limiter, identifier, timeoutPolicy } = validateRateLimitCheck(check);

  return runLimitCheck(limiter, identifier, timeoutPolicy);
}

export async function checkMultipleRateLimits(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error("At least one rate-limit check is required.");
  }

  // Validate every check before executing any limiter.
  const validatedChecks = checks.map((check) => validateRateLimitCheck(check));

  return Promise.all(
    validatedChecks.map(({ limiter, identifier, timeoutPolicy }) =>
      runLimitCheck(limiter, identifier, timeoutPolicy)
    )
  );
}
