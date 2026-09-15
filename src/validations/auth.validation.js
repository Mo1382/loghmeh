import { z } from "zod";

/**
 * Reusable fields
 */

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must not exceed 30 characters.")
  .regex(
    /^[a-zA-Z0-9_\u0600-\u06FF]+$/,
    "Username may only contain letters, numbers, Persian characters, and underscores."
  );

const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.");

const bioSchema = z
  .string()
  .trim()
  .max(300, "Bio must not exceed 300 characters.");

const avatarSchema = z
  .string()
  .trim()
  .url("Avatar must be a valid URL.")
  .refine(
    (value) => value.startsWith("https://"),
    "Avatar URL must use HTTPS."
  );

const optionalAvatarSchema = avatarSchema.nullable().optional();

/**
 * Social links
 */

const instagramUrlSchema = z
  .string()
  .trim()
  .url("Instagram link must be a valid URL.")
  .refine(
    (value) => /^https:\/\/(www\.)?instagram\.com\//i.test(value),
    "Invalid Instagram URL."
  );

const telegramUrlSchema = z
  .string()
  .trim()
  .url("Telegram link must be a valid URL.")
  .refine(
    (value) => /^https:\/\/(www\.)?(t\.me|telegram\.me)\//i.test(value),
    "Invalid Telegram URL."
  );

const xUrlSchema = z
  .string()
  .trim()
  .url("X link must be a valid URL.")
  .refine(
    (value) => /^https:\/\/(www\.)?(x\.com|twitter\.com)\//i.test(value),
    "Invalid X URL."
  );

const optionalInstagramUrlSchema = instagramUrlSchema.nullable().optional();

const optionalTelegramUrlSchema = telegramUrlSchema.nullable().optional();

const optionalXUrlSchema = xUrlSchema.nullable().optional();

const socialLinksSchema = z
  .object({
    instagram: optionalInstagramUrlSchema,
    telegram: optionalTelegramUrlSchema,
    x: optionalXUrlSchema,
  })
  .strict()
  .optional();

/**
 * Registration
 */

export const registerUserSchema = z
  .object({
    username: usernameSchema,

    email: emailSchema,

    password: passwordSchema,

    title: z.enum(["USER", "COOK", "HEAD_CHEF", "BARISTA", "FOOD_BLOGGER"]),
  })
  .strict();

/**
 * Login
 *
 * User can sign in using either email or username.
 */

export const loginUserSchema = z
  .object({
    identifier: z.string().trim().min(3, "Username or email is required."),

    password: z.string().min(1, "Password is required."),
  })
  .strict();

/**
 * Forgot password — Step 1
 */

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

/**
 * Verify password reset code — Step 2
 */

export const verifyPasswordResetCodeSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits."),
  })
  .strict();

/**
 * Reset password — Step 3
 */

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,

    confirmPassword: z.string().min(1, "Password confirmation is required."),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Change password
 */

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),

    newPassword: passwordSchema,

    confirmPassword: z.string().min(1, "Password confirmation is required."),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password.",
    path: ["newPassword"],
  });

/**
 * Update user profile
 *
 * Username and title is immutable.
 * Role, stats, emailVerified, accountStatus,
 * createdAt and updatedAt are system-managed.
 */

export const updateUserProfileSchema = z
  .object({
    avatar: optionalAvatarSchema,

    bio: bioSchema.optional(),

    socialLinks: socialLinksSchema,
  })
  .strict();
