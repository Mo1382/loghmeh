import { z } from "zod";
import { USER_TITLES } from "@/constants/enums";
import {
  EMAIL_PATTERN,
  INSTAGRAM_PATTERN,
  TELEGRAM_PATTERN,
  USERNAME_PATTERN,
  X_PATTERN,
} from "@/constants/regex";

/**
 * Reusable fields
 */

const usernameSchema = z
  .string()
  .trim()
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد.")
  .max(30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد.")
  .regex(
    USERNAME_PATTERN,
    "نام کاربری فقط می‌تواند شامل حروف انگلیسی، حروف فارسی، اعداد و زیرخط باشد."
  );

const emailSchema = z
  .string()
  .trim()
  .max(254, "نشانی ایمیل نباید بیشتر از ۲۵۴ نویسه باشد.")
  .regex(EMAIL_PATTERN, "لطفاً یک نشانی ایمیل معتبر وارد کنید.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
  .max(128);

const bioSchema = z
  .string()
  .trim()
  .max(300, "معرفی‌نامه نباید بیشتر از ۳۰۰ کاراکتر باشد.");

const avatarSchema = z
  .string()
  .trim()
  .url("نشانی تصویر پروفایل باید معتبر باشد.")
  .refine(
    (value) => value.startsWith("https://"),
    "نشانی تصویر پروفایل باید از HTTPS استفاده کند."
  );

const optionalAvatarSchema = avatarSchema.nullable().optional();

/**
 * Social links
 */

const instagramUrlSchema = z
  .string()
  .trim()
  .url("پیوند اینستاگرام باید یک نشانی معتبر باشد.")
  .refine(
    (value) => INSTAGRAM_PATTERN.test(value),
    "نشانی اینستاگرام نامعتبر است."
  );

const telegramUrlSchema = z
  .string()
  .trim()
  .url("پیوند تلگرام باید یک نشانی معتبر باشد.")
  .refine((value) => TELEGRAM_PATTERN.test(value), "نشانی تلگرام نامعتبر است.");

const xUrlSchema = z
  .string()
  .trim()
  .url("پیوند X باید یک نشانی معتبر باشد.")
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
 * Registration
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
 * Login
 *
 * User can sign in using either email or username.
 */

export const loginUserSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3, "نام کاربری یا ایمیل الزامی است.")
      .transform((value) =>
        value.includes("@") ? value.toLowerCase() : value
      ),

    password: z.string().min(1, "رمز عبور الزامی است."),
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
    code: z.string().regex(/^\d{6}$/, "کد تأیید باید ۶ رقمی باشد."),
  })
  .strict();

/**
 * Reset password — Step 3
 */

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,

    confirmPassword: z.string().min(1, "تأیید رمز عبور الزامی است."),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "رمزهای عبور یکسان نیستند.",
    path: ["confirmPassword"],
  });

/**
 * Change password
 */

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی الزامی است."),

    newPassword: passwordSchema,

    confirmPassword: z.string().min(1, "تأیید رمز عبور الزامی است."),
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
