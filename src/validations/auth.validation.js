import { z } from "zod";

import { USER_TITLES } from "@/constants/enums";

import { normalizeDigits } from "@/lib/normalization/normalizeDigits";
import { isValidEmail } from "@/lib/validation/isValidEmail";
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
