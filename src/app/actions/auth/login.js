"use server";

import { isIP } from "node:net";

import { headers } from "next/headers";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";
import {
  createIpIdentifier,
  createLoginIdentifier,
} from "@/lib/rate-limit/identifiers";
import {
  loginIdentifierLimiter,
  loginIpLimiter,
} from "@/lib/rate-limit/policies";
import {
  checkRateLimit,
} from "@/lib/rate-limit/rate-limit";
import { createActionErrorResponse, createActionSuccessResponse } from "@/lib/actions/action-response";
import {
  createSessionForUser,
  revokeSessionByToken,
} from "@/services/session.service";
import { loginUser } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { loginUserSchema } from "@/validations/auth.validation";

const DEVELOPMENT_CLIENT_IP = "127.0.0.1";
const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "در حال حاضر امکان بررسی محدودیت درخواست‌ها وجود ندارد. لطفاً کمی بعد دوباره تلاش کنید.";

/**
 * Read the client IP from the trusted ingress header.
 *
 * The reverse proxy must overwrite x-forwarded-for with the connecting
 * client's IP instead of appending an untrusted client-supplied value.
 * A single valid IP is required so this action never guesses which address
 * in a proxy chain should be trusted.
 */
async function getClientIpAddress() {
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

/**
 * Extract exactly one value for each supported login field.
 *
 * Additional FormData fields are intentionally ignored. Duplicate values
 * for a supported field are treated as missing/invalid rather than silently
 * choosing one of them.
 */
function extractLoginInput(formData) {
  if (!(formData instanceof FormData)) {
    throw new AppError(
      ERROR_CODES.INVALID_REQUEST,
      "درخواست نامعتبر است.",
      { statusCode: 400 }
    );
  }

  function getSingleValue(name) {
    const values = formData.getAll(name);
    return values.length === 1 ? values[0] : undefined;
  }

  return {
    identifier: getSingleValue("identifier"),
    password: getSingleValue("password"),
  };
}

/**
 * Best-effort cleanup for a newly created Session when its browser Cookie
 * cannot be written. Never log or expose the raw Session token.
 */
async function setCookieOrRevokeSession(token, session) {
  try {
    await setSessionCookie(token, session);
  } catch (cookieError) {
    try {
      await revokeSessionByToken(token);
    } catch (revokeError) {
      console.error(
        "Failed to revoke a Session after Cookie setup failed.",
        revokeError
      );
    }

    throw cookieError;
  }
}

/**
 * Authenticate a user, create a server-side Session, and set its HttpOnly
 * browser Cookie.
 *
 * Returns a plain Action response. Client-side navigation should happen only
 * after the caller receives a successful response.
 */
export async function loginAction(formData) {
  try {
    const clientIp = await getClientIpAddress();

    // Apply the IP limit before validation to also count malformed requests.
    await checkRateLimit({
      limiter: loginIpLimiter,
      identifier: createIpIdentifier("auth:login", clientIp),
    });

    const input = extractLoginInput(formData);
    const parsedInput = loginUserSchema.safeParse(input);

    if (!parsedInput.success) {
      throw parsedInput.error;
    }

    // Apply the per-identifier limit using the schema-normalized value.
    await checkRateLimit({
      limiter: loginIdentifierLimiter,
      identifier: createLoginIdentifier(parsedInput.data.identifier),
    });

    const { user, sessionContext } = await loginUser(parsedInput.data);

    const { token, session } = await createSessionForUser(sessionContext);

    await setCookieOrRevokeSession(token, session);

    return createActionSuccessResponse(
      { user },
      "با موفقیت وارد حساب کاربری شدید."
    );
  } catch (error) {
    return createActionErrorResponse(error);
  }
}
