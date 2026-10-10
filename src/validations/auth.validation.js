import { z } from "zod";

import { USER_TITLES } from "@/constants/enums";

import {
  INSTAGRAM_PATTERN,
  TELEGRAM_PATTERN,
  USERNAME_PATTERN,
  X_PATTERN,
} from "@/constants/regex";

import { normalizeUsername } from "@/lib/normalization/normalizeUsername";

import { isHttpsUrl } from "@/lib/validation/isHttpsUrl";
import { isValidEmail } from "@/lib/validation/isValidEmail";
import { normalizeDigits } from "@/lib/normalization/normalizeDigits";
import { usernameSchema } from "./user.validation";

/**
 * Reusable validation schemas.
 */

const emailSchema = z
  .string()
  .trim()
  .max(254, "نشانی ایمیل نباید بیشتر از ۲۵۴ کاراکتر باشد.")
  .refine(isValidEmail, "لطفاً یک نشانی ایمیل معتبر وارد کنید.")
  .transform((value) => value.toLowerCase());

/**
 * Login identifier: email or username.
 */
const identifierSchema = z.union([emailSchema, usernameSchema]);

const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
  .max(128, "رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد.");

const existingPasswordSchema = z
  .string()
  .min(1, "رمز عبور الزامی است.")
  .max(128, "رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد.");

const bioSchema = z
  .string()
  .trim()
  .max(300, "معرفی‌نامه نباید بیشتر از ۳۰۰ کاراکتر باشد.");

const avatarSchema = z
  .string()
  .trim()
  .refine(isHttpsUrl, "نشانی تصویر پروفایل باید از HTTPS استفاده کند.");

const optionalAvatarSchema = avatarSchema.nullable().optional();

/**
 * Social link validation.
 */
const instagramUrlSchema = z
  .string()
  .trim()
  .pipe(z.url("پیوند اینستاگرام باید یک نشانی معتبر باشد."))
  .refine(
    (value) => INSTAGRAM_PATTERN.test(value),
    "نشانی اینستاگرام نامعتبر است."
  );

const telegramUrlSchema = z
  .string()
  .trim()
  .pipe(z.url("پیوند تلگرام باید یک نشانی معتبر باشد."))
  .refine((value) => TELEGRAM_PATTERN.test(value), "نشانی تلگرام نامعتبر است.");

const xUrlSchema = z
  .string()
  .trim()
  .pipe(z.url("پیوند X باید یک نشانی معتبر باشد."))
  .refine((value) => X_PATTERN.test(value), "نشانی X نامعتبر است.");

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
 * User registration.
 */
export const registerUserSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    title: z.enum(Object.values(USER_TITLES)).default(USER_TITLES.USER),
  })
  .strict();

/**
 * User login with email or username.
 */
export const loginUserSchema = z
  .object({
    identifier: identifierSchema,
    password: existingPasswordSchema,
  })
  .strict();

/**
 * Forgot password — Step 1.
 */
export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

/**
 * Verify register and password reset code — Step 2.
 */
export const verificationCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform(normalizeDigits)
      .regex(/^\d{6}$/, "کد تأیید باید ۶ رقمی باشد."),
  })
  .strict();

/**
 * Reset password — Step 3.
 */
export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, "تأیید رمز عبور الزامی است.")
      .max(128, "رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد."),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "رمزهای عبور یکسان نیستند.",
    path: ["confirmPassword"],
  });

/**
 * Change password.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: existingPasswordSchema,
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, "تأیید رمز عبور الزامی است.")
      .max(128, "رمز عبور نباید بیشتر از ۱۲۸ کاراکتر باشد."),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "رمزهای عبور یکسان نیستند.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.",
    path: ["newPassword"],
  });

/**
 * Update editable user profile fields.
 *
 * Username and title are immutable.
 * System-managed fields cannot be updated through this schema.
 */
export const updateUserProfileSchema = z
  .object({
    avatar: optionalAvatarSchema,
    bio: bioSchema.optional(),
    socialLinks: socialLinksSchema,
  })
  .strict();
