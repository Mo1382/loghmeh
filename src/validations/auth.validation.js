import { z } from "zod";
import { USER_TITLES } from "@/constants/enums";

/**
 * Reusable fields
 */

const usernameSchema = z
  .string()
  .trim()
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد.")
  .max(30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد.")
  .regex(
    /^[a-zA-Z0-9_\u0600-\u06FF]+$/,
    "نام کاربری فقط می‌تواند شامل حروف، اعداد، نویسه‌های فارسی و زیرخط باشد."
  );

const emailSchema = z
  .string()
  .trim()
  .email("لطفاً یک نشانی ایمیل معتبر وارد کنید.")
  .transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.");

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
    (value) => /^https:\/\/(www\.)?instagram\.com\//i.test(value),
    "نشانی اینستاگرام نامعتبر است."
  );

const telegramUrlSchema = z
  .string()
  .trim()
  .url("پیوند تلگرام باید یک نشانی معتبر باشد.")
  .refine(
    (value) => /^https:\/\/(www\.)?(t\.me|telegram\.me)\//i.test(value),
    "نشانی تلگرام نامعتبر است."
  );

const xUrlSchema = z
  .string()
  .trim()
  .url("پیوند X باید یک نشانی معتبر باشد.")
  .refine(
    (value) => /^https:\/\/(www\.)?(x\.com|twitter\.com)\//i.test(value),
    "نشانی X نامعتبر است."
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

    title: z.enum(USER_TITLES).default("USER"),
  })
  .strict();

/**
 * Login
 *
 * User can sign in using either email or username.
 */

export const loginUserSchema = z
  .object({
    identifier: z.string().trim().min(3, "نام کاربری یا ایمیل الزامی است."),

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
