"use server";

import { isIP } from "node:net";

import { headers } from "next/headers";

import { redirect, RedirectType } from "next/navigation";

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
import { checkRateLimit } from "@/lib/rate-limit/rate-limit";
import { createActionErrorResponse } from "@/lib/actions/action-response";
import {
  createSessionForUser,
  revokeSessionByToken,
} from "@/services/session.service";
import { loginUser } from "@/services/auth.service";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { loginUserSchema } from "@/validations/auth.validation";

import { connectDB } from "@/lib/db";

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
 * Return the single value associated with a FormData field.
 *
 * Returns undefined when the field is missing or contains multiple values.
 */
function getSingleFormDataValue(formData, name) {
  const values = formData.getAll(name);

  return values.length === 1 ? values[0] : undefined;
}

/**
 * Extract the supported login fields from FormData.
 *
 * Additional fields are intentionally ignored. Missing or duplicate values
 * for supported fields are returned as undefined so the login schema can
 * reject them during validation.
 *
 * @throws {AppError} If the input is not a FormData instance.
 */
function extractLoginInput(formData) {
  if (!(formData instanceof FormData)) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, "درخواست نامعتبر است.", {
      statusCode: 400,
    });
  }

  return {
    identifier: getSingleFormDataValue(formData, "identifier"),
    password: getSingleFormDataValue(formData, "password"),
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

    // Apply the IP limit before validation.
    await checkRateLimit({
      limiter: loginIpLimiter,
      identifier: createIpIdentifier("auth:login", clientIp),
    });

    const input = extractLoginInput(formData);
    const parsedInput = loginUserSchema.safeParse(input);

    if (!parsedInput.success) {
      throw parsedInput.error;
    }

    await checkRateLimit({
      limiter: loginIdentifierLimiter,
      identifier: createLoginIdentifier(parsedInput.data.identifier),
    });

    await connectDB();

    const { sessionContext } = await loginUser(parsedInput.data);

    const { token, session } = await createSessionForUser(sessionContext);

    await setCookieOrRevokeSession(token, session);
  } catch (error) {
    return createActionErrorResponse(error);
  }

  // Redirect only after successful authentication.
  redirect("/", RedirectType.replace);
}
