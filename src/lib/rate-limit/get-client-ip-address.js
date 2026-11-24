import "server-only";

import { isIP } from "node:net";
import { headers } from "next/headers";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

const DEVELOPMENT_CLIENT_IP = "127.0.0.1";

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

/**
 * Read the client IP from the trusted ingress header.
 *
 * The reverse proxy must overwrite x-forwarded-for with the connecting
 * client's IP instead of appending an untrusted client-supplied value.
 * A single valid IP is required so this function never guesses which
 * address in a proxy chain should be trusted.
 *
 * In non-production environments, a loopback address is used when
 * the forwarded client IP is unavailable or invalid.
 *
 * @returns {Promise<string>} The validated client IP address.
 *
 * @throws {AppError} When the client IP cannot be determined in production.
 */
export async function getClientIpAddress() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.trim();

  if (forwardedFor && isIP(forwardedFor)) {
    return forwardedFor;
  }

  // Local development does not always provide a forwarded client IP.
  if (process.env.NODE_ENV !== "production") {
    return DEVELOPMENT_CLIENT_IP;
  }

  throw new AppError(
    ERROR_CODES.RATE_LIMIT_UNAVAILABLE,
    RATE_LIMIT_UNAVAILABLE_MESSAGE,
    {
      statusCode: 503,
      details: {
        reason: "client_ip_unavailable",
      },
    }
  );
}
