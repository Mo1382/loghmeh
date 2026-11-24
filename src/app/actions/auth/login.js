"use server";

import { redirect, RedirectType } from "next/navigation";

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

import { getClientIpAddress } from "@/lib/rate-limit/get-client-ip-address";

import { connectDB } from "@/lib/db";

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
 * Returns a standardized Action error response when the login flow fails.
 * On successful authentication, redirects to the home page.
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
