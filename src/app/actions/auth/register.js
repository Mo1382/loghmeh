"use server";

import { createIpIdentifier } from "@/lib/rate-limit/identifiers";
import { registerIpLimiter } from "@/lib/rate-limit/policies";
import { checkRateLimit } from "@/lib/rate-limit/rate-limit";

import { redirect, RedirectType } from "next/navigation";

import { createActionErrorResponse } from "@/lib/actions/action-response";

import { registerUser } from "@/services/auth.service";

import { registerUserSchema } from "@/validations/auth.validation";

import { getClientIpAddress } from "@/lib/rate-limit/get-client-ip-address";

import { getSingleFormDataValue } from "@/lib/form-data/get-single-form-data-value";

import { ERROR_CODES } from "@/constants/error-codes";
import AppError from "@/lib/errors/AppError";

/*
 * ============================================================================
 * FormData Extraction
 * ============================================================================
 */

/**
 * Extract the supported registration fields from FormData.
 *
 * Additional fields are intentionally ignored.
 * Missing and duplicate values are passed to the schema as undefined
 * and null, respectively, so validation can reject invalid input
 * or apply the declared defaults.
 *
 * @throws {AppError} If the input is not a FormData instance.
 */
function extractRegisterInput(formData) {
  if (!(formData instanceof FormData)) {
    throw new AppError(ERROR_CODES.INVALID_REQUEST, "درخواست نامعتبر است.", {
      statusCode: 400,
    });
  }

  return {
    username: getSingleFormDataValue(formData, "username"),
    email: getSingleFormDataValue(formData, "email"),
    password: getSingleFormDataValue(formData, "password"),
    title: getSingleFormDataValue(formData, "title"),
  };
}

/*
 * ============================================================================
 * Register Action
 * ============================================================================
 */

/**
 * Register a new user and submit an email-verification code.
 *
 * The account and verification code are created atomically by the
 * authentication service.
 *
 * A failed email submission does not undo a successfully created account.
 *
 * On successful account creation, redirects to the email-verification
 * page with the email address and email-submission status.
 *
 * Returns a standardized Action error response when registration fails.
 */
export async function registerAction(formData) {
  let email;
  let verificationEmailSubmissionAccepted;

  try {
    const clientIp = await getClientIpAddress();

    // Apply the IP-based limit before processing registration data.
    await checkRateLimit({
      limiter: registerIpLimiter,
      identifier: createIpIdentifier("auth:register", clientIp),
    });

    const input = extractRegisterInput(formData);

    const parsedInput = registerUserSchema.safeParse(input);

    if (!parsedInput.success) {
      throw parsedInput.error;
    }

    const result = await registerUser(parsedInput.data);

    email = result.user.email;

    verificationEmailSubmissionAccepted =
      result.verificationEmailSubmissionAccepted;
  } catch (error) {
    return createActionErrorResponse(error);
  }

  const query = new URLSearchParams({
    email,
    emailSubmission: verificationEmailSubmissionAccepted
      ? "accepted"
      : "failed",
  });

  // Redirect only after successful account creation.
  redirect(`/verify-email?${query.toString()}`, RedirectType.replace);
}
