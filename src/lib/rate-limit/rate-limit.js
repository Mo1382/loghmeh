import AppError from "@/lib/errors/AppError";
import { ERROR_CODES } from "@/constants/error-codes";

async function runLimitCheck(limiter, identifier) {
  const result = await limiter.limit(identifier);

  if (result.success) {
    return result;
  }

  const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));

  throw new AppError(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    "Too many requests. Please try again later.",
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

export async function checkRateLimit({ limiter, identifier }) {
  if (!limiter) {
    throw new Error("Rate limiter is required.");
  }

  if (typeof identifier !== "string" || !identifier) {
    throw new Error("Rate limit identifier is required.");
  }

  return runLimitCheck(limiter, identifier);
}

export async function checkMultipleRateLimits(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error("At least one rate-limit check is required.");
  }

  const results = await Promise.all(
    checks.map(({ limiter, identifier }) => runLimitCheck(limiter, identifier))
  );

  return results;
}
