import { z } from "zod";

import {
  INSTAGRAM_PATTERN,
  TELEGRAM_PATTERN,
  USERNAME_PATTERN,
  X_PATTERN,
} from "@/constants/regex";

import { normalizeUsername } from "@/lib/normalization/normalizeUsername";
import { isHttpsUrl } from "@/lib/validation/isHttpsUrl";

export const usernameSchema = z
  .string()
  .trim()
  .transform(normalizeUsername)
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد.")
  .max(30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد.")
  .regex(
    USERNAME_PATTERN,
    "نام کاربری فقط می‌تواند شامل حروف انگلیسی، حروف فارسی، ارقام انگلیسی و زیرخط باشد."
  );

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
  .superRefine((socialLinks, ctx) => {
    const fields = Object.keys(socialLinks);

    if (fields.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "حداقل یک پیوند اجتماعی باید ارسال شود.",
      });
      return;
    }

    for (const field of fields) {
      if (socialLinks[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "مقدار پیوند اجتماعی نمی‌تواند undefined باشد.",
        });
      }
    }
  })
  .optional();

export const updateUserProfileSchema = z
  .object({
    avatar: optionalAvatarSchema,
    bio: bioSchema.optional(),
    socialLinks: socialLinksSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "حداقل یک فیلد برای ویرایش باید ارسال شود.",
      });
    }

    for (const field of ["avatar", "bio", "socialLinks"]) {
      if (Object.hasOwn(data, field) && data[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message:
            field === "socialLinks"
              ? "پیوندهای اجتماعی ارسال‌شده نامعتبر هستند."
              : "مقدار فیلد ارسالی نمی‌تواند undefined باشد.",
        });
      }
    }
  });
