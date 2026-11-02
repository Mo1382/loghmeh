import "server-only";

import { z } from "zod";
import { isValidEmail } from "../validation/isValidEmail";

// ============================================================================
// Environment Variable Schemas
// ============================================================================

/**
 * Validate the authentication secret.
 *
 * The value must contain between 32 and 256 characters
 * and must not have surrounding whitespace.
 */
const authSecretSchema = z
  .string()
  .min(32, "AUTH_SECRET must contain at least 32 characters.")
  .max(256, "AUTH_SECRET is too long.")
  .refine((value) => value.trim() === value, {
    message: "AUTH_SECRET must not contain surrounding whitespace.",
  });

/**
 * Validate a canonical Base64URL-encoded 32-byte key.
 *
 * The encoded value must contain exactly 43 characters,
 * decode to 32 bytes, and round-trip to the original value.
 */
const passwordResetTokenSecretSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, {
    message: "Must be a canonical Base64URL-encoded 32-byte key.",
  })
  .refine(
    (value) => {
      const decoded = Buffer.from(value, "base64url");

      return decoded.length === 32 && decoded.toString("base64url") === value;
    },
    {
      message: "Must decode to exactly 32 bytes.",
    }
  );

/**
 * Validate the Resend API key.
 */
const resendApiKeySchema = z
  .string()
  .min(1, "RESEND_API_KEY is required.")
  .max(256, "RESEND_API_KEY is too long.")
  .refine((value) => value.trim() === value, {
    message: "RESEND_API_KEY must not contain surrounding whitespace.",
  });

/**
 * Validate the sender email address.
 *
 * Uses the shared email validator to maintain consistent
 * email validation rules across the application.
 * Surrounding whitespace is not allowed.
 */
const resendFromEmailSchema = z
  .string()
  .refine((value) => value.trim() === value, {
    message: "RESEND_FROM_EMAIL must not contain surrounding whitespace.",
  })
  .refine(isValidEmail, {
    message: "RESEND_FROM_EMAIL must be a valid email address.",
  });

// ============================================================================
// Server Environment Schema
// ============================================================================

/**
 * Validate all required server-side environment variables.
 */
const serverEnvSchema = z.object({
  AUTH_SECRET: authSecretSchema,
  PASSWORD_RESET_TOKEN_SECRET: passwordResetTokenSecretSchema,
  RESEND_API_KEY: resendApiKeySchema,
  RESEND_FROM_EMAIL: resendFromEmailSchema,
});

// ============================================================================
// Environment Validation and Access
// ============================================================================

let validatedEnv;

/**
 * Validate all required server environment variables.
 *
 * Only the names of invalid variables are included in the error message.
 * Secret values are never exposed.
 *
 * On successful validation, stores and returns an immutable configuration
 * snapshot for subsequent access through getServerEnv().
 */
export function validateServerEnv() {
  validatedEnv = undefined;

  const result = serverEnvSchema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    PASSWORD_RESET_TOKEN_SECRET: process.env.PASSWORD_RESET_TOKEN_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  });

  if (!result.success) {
    const invalidVariables = [
      ...new Set(
        result.error.issues.map((issue) =>
          String(issue.path[0] ?? "SERVER_ENV")
        )
      ),
    ];

    throw new Error(
      `Invalid server environment configuration: ${invalidVariables.join(", ")}`
    );
  }

  validatedEnv = Object.freeze(result.data);

  return validatedEnv;
}

/**
 * Return validated server environment variables.
 *
 * Environment variables are validated lazily on the first access
 * and cached for subsequent calls.
 */
export function getServerEnv() {
  return validatedEnv ?? validateServerEnv();
}
