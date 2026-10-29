import { z } from "zod";

const authSecretSchema = z
  .string()
  .min(32, "AUTH_SECRET must contain at least 32 characters.")
  .max(256, "AUTH_SECRET is too long.")
  .refine((value) => value.trim() === value, {
    message: "AUTH_SECRET must not contain surrounding whitespace.",
  });

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

const serverEnvSchema = z.object({
  AUTH_SECRET: authSecretSchema,
  PASSWORD_RESET_TOKEN_SECRET: passwordResetTokenSecretSchema,
});

let validatedEnv;

export function validateServerEnv() {
  const result = serverEnvSchema.safeParse({
    AUTH_SECRET: process.env.AUTH_SECRET,
    PASSWORD_RESET_TOKEN_SECRET: process.env.PASSWORD_RESET_TOKEN_SECRET,
  });

  if (!result.success) {
    const invalidVariables = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];

    throw new Error(
      `Invalid server environment configuration: ${invalidVariables.join(", ")}`
    );
  }

  validatedEnv = result.data;

  return validatedEnv;
}

export function getServerEnv() {
  return validatedEnv ?? validateServerEnv();
}
