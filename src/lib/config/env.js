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
// Rate Limit Hash Environment Schemas
// ============================================================================

/**
 * Validate the secret used for HMAC-based Rate Limiting identifiers.
 *
 * The value must contain at least 32 bytes in UTF-8 encoding
 * and must not have surrounding whitespace.
 */
const rateLimitHashSecretSchema = z
  .string()
  .refine((value) => value.trim() === value, {
    message: "RATE_LIMIT_HASH_SECRET must not contain surrounding whitespace.",
  })
  .refine((value) => Buffer.byteLength(value, "utf8") >= 32, {
    message: "RATE_LIMIT_HASH_SECRET must contain at least 32 bytes.",
  });

const rateLimitHashEnvSchema = z.object({
  RATE_LIMIT_HASH_SECRET: rateLimitHashSecretSchema,
});

// ============================================================================
// Upstash Redis Environment Schemas
// ============================================================================

/**
 * Validate the Upstash Redis REST URL.
 *
 * Only HTTPS URLs are accepted.
 */
const upstashRedisUrlSchema = z
  .string()
  .refine((value) => value.trim() === value, {
    message: "UPSTASH_REDIS_REST_URL must not contain surrounding whitespace.",
    abort: true,
  })
  .pipe(
    z.url({
      protocol: /^https$/,
      error: "UPSTASH_REDIS_REST_URL must be a valid HTTPS URL.",
    })
  );

/**
 * Validate the Upstash Redis REST authentication token.
 */
const upstashRedisTokenSchema = z
  .string()
  .min(1, "UPSTASH_REDIS_REST_TOKEN is required.")
  .refine((value) => value.trim() === value, {
    message:
      "UPSTASH_REDIS_REST_TOKEN must not contain surrounding whitespace.",
  });

const upstashRedisEnvSchema = z.object({
  UPSTASH_REDIS_REST_URL: upstashRedisUrlSchema,
  UPSTASH_REDIS_REST_TOKEN: upstashRedisTokenSchema,
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
// Internal Environment Helpers
// ============================================================================

/**
 * Parse and validate an environment configuration.
 *
 * Only invalid variable names are included in the error message.
 * Secret values and other environment variable contents are never exposed.
 *
 * Returns an immutable snapshot of the validated configuration.
 */
function parseEnvironment(schema, values, label, fallbackName) {
  const result = schema.safeParse(values);

  if (!result.success) {
    const invalidVariables = [
      ...new Set(
        result.error.issues.map((issue) =>
          String(issue.path[0] ?? fallbackName)
        )
      ),
    ];

    throw new Error(
      `Invalid ${label} environment configuration: ${invalidVariables.join(", ")}`
    );
  }

  return Object.freeze(result.data);
}

// ============================================================================
// Server Environment Validation and Access
// ============================================================================

let validatedEnv;

/**
 * Validate all required server environment variables.
 *
 * On successful validation, stores and returns an immutable
 * configuration snapshot for subsequent calls.
 */
export function validateServerEnv() {
  validatedEnv = undefined;

  validatedEnv = parseEnvironment(
    serverEnvSchema,
    {
      AUTH_SECRET: process.env.AUTH_SECRET,
      PASSWORD_RESET_TOKEN_SECRET: process.env.PASSWORD_RESET_TOKEN_SECRET,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    },
    "server",
    "SERVER_ENV"
  );

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

// ============================================================================
// Rate Limit Hash Environment Validation and Access
// ============================================================================

let validatedRateLimitHashEnv;

/**
 * Validate the environment variables required for Rate Limiting identifiers.
 *
 * The validated configuration is cached for subsequent calls.
 */
export function validateRateLimitHashEnv() {
  validatedRateLimitHashEnv = undefined;

  validatedRateLimitHashEnv = parseEnvironment(
    rateLimitHashEnvSchema,
    {
      RATE_LIMIT_HASH_SECRET: process.env.RATE_LIMIT_HASH_SECRET,
    },
    "Rate Limit Hash",
    "RATE_LIMIT_HASH"
  );

  return validatedRateLimitHashEnv;
}

/**
 * Return validated Rate Limit Hash environment variables.
 *
 * Environment variables are validated lazily on the first access
 * and cached for subsequent calls.
 */
export function getRateLimitHashEnv() {
  return validatedRateLimitHashEnv ?? validateRateLimitHashEnv();
}

// ============================================================================
// Upstash Redis Environment Validation and Access
// ============================================================================

let validatedUpstashRedisEnv;

/**
 * Validate the environment variables required for the Upstash Redis connection.
 *
 * The validated configuration is cached for subsequent calls.
 */
export function validateUpstashRedisEnv() {
  validatedUpstashRedisEnv = undefined;

  validatedUpstashRedisEnv = parseEnvironment(
    upstashRedisEnvSchema,
    {
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
    "Upstash Redis",
    "UPSTASH_REDIS"
  );

  return validatedUpstashRedisEnv;
}

/**
 * Return validated Upstash Redis environment variables.
 *
 * Environment variables are validated lazily on the first access
 * and cached for subsequent calls.
 */
export function getUpstashRedisEnv() {
  return validatedUpstashRedisEnv ?? validateUpstashRedisEnv();
}
