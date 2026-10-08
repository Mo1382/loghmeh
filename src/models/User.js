import mongoose from "mongoose";
import { isValidEmail } from "@/lib/validation/isValidEmail";
import { ACCOUNT_STATUSES, USER_ROLES, USER_TITLES } from "@/constants/enums";

import {
  EMAIL_PATTERN,
  INSTAGRAM_PATTERN,
  TELEGRAM_PATTERN,
  USERNAME_PATTERN,
  X_PATTERN,
  DECIMAL_TOLERANCE,
} from "@/constants/regex";
import { normalizeUsername } from "@/lib/normalization/normalizeUsername";

/**
 * --------------------------------------------------------------------------
 * Validators
 * --------------------------------------------------------------------------
 */

/**
 * Validate that a URL uses HTTPS.
 *
 * Null/undefined values are considered valid so the same validator
 * can be reused for optional fields.
 */
function isValidHttpsUrl(value) {
  if (value == null) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Validate a social-network URL against both:
 * 1. HTTPS protocol
 * 2. The expected platform domain pattern
 */
function isValidSocialUrl(value, domainPattern) {
  if (value == null) {
    return true;
  }

  return isValidHttpsUrl(value) && domainPattern.test(value);
}

/**
 * Validate non-negative integer statistics.
 *
 * Used for counters and aggregate values that must never contain
 * fractional or negative values.
 */
function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validate that a rating average is represented with at most
 * two decimal places.
 *
 * A small tolerance is used because JavaScript floating-point
 * representation can introduce tiny rounding errors.
 */
function hasAtMostTwoDecimalPlaces(value) {
  if (value == null) {
    return true;
  }

  if (!Number.isFinite(value)) {
    return false;
  }

  const rounded = Math.round(value * 100) / 100;

  return Math.abs(value - rounded) <= DECIMAL_TOLERANCE;
}

/**
 * --------------------------------------------------------------------------
 * User Schema
 * --------------------------------------------------------------------------
 */

const userSchema = new mongoose.Schema(
  {
    /**
     * Incremented whenever an authentication/security event should
     * invalidate previously issued sessions.
     */
    sessionVersion: {
      type: Number,
      required: [true, "نسخهٔ session الزامی است."],
      default: 0,
      min: [0, "نسخهٔ session نمی‌تواند منفی باشد."],
      validate: {
        validator: Number.isSafeInteger,
        message: "نسخهٔ session باید یک عدد صحیح نامنفی باشد.",
      },
    },

    /**
     * Public username.
     *
     * The username is intentionally case-sensitive. It may contain
     * Latin letters, Persian letters, digits, and underscores only.
     */
    username: {
      type: String,
      required: [true, "نام کاربری الزامی است."],
      unique: true,
      trim: true,
      set: normalizeUsername,
      minlength: [3, "نام کاربری باید حداقل ۳ کاراکتر باشد."],
      maxlength: [30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد."],
      match: [
        USERNAME_PATTERN,
        "نام کاربری فقط می‌تواند شامل حروف انگلیسی، حروف فارسی، اعداد و _ باشد.",
      ],
    },

    /**
     * Login identifier.
     *
     * Email addresses are stored in their normalized lowercase form so
     * lookups remain consistent across registration and authentication.
     */
    email: {
      type: String,
      required: [true, "آدرس ایمیل الزامی است."],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "آدرس ایمیل نباید بیشتر از ۲۵۴ نویسه باشد."],
      validate: {
        validator: isValidEmail,
        message: "لطفاً یک آدرس ایمیل معتبر وارد کنید.",
      },
    },

    /**
     * Stored password hash.
     *
     * Password is excluded from query results by default and must be
     * explicitly selected by authentication flows when required.
     */
    password: {
      type: String,
      required: [true, "رمز عبور الزامی است."],
      select: false,
    },

    /**
     * Optional profile image.
     *
     * Only HTTPS URLs are accepted.
     */
    avatar: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: isValidHttpsUrl,
        message: "آدرس تصویر پروفایل باید یک URL معتبر با پروتکل HTTPS باشد.",
      },
    },

    /**
     * Short public profile description.
     */
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "بیوگرافی نباید بیشتر از ۳۰۰ کاراکتر باشد."],
    },

    /**
     * User-facing title displayed alongside the profile.
     */
    title: {
      type: String,
      enum: {
        values: Object.values(USER_TITLES),
        message: "عنوان کاربر نامعتبر است.",
      },
      default: USER_TITLES.USER,
      required: [true, "عنوان کاربر الزامی است."],
    },

    /**
     * Authorization role used by the application.
     */
    role: {
      type: String,
      enum: {
        values: Object.values(USER_ROLES),
        message: "نقش کاربر نامعتبر است.",
      },
      default: USER_ROLES.USER,
      required: [true, "نقش کاربر الزامی است."],
    },

    /**
     * Optional links to the user's social profiles.
     *
     * Each platform has its own domain validation in addition to
     * the shared HTTPS requirement.
     */
    socialLinks: {
      instagram: {
        type: String,
        default: null,
        trim: true,
        validate: {
          validator: (value) => isValidSocialUrl(value, INSTAGRAM_PATTERN),
          message: "آدرس اینستاگرام باید یک URL معتبر با پروتکل HTTPS باشد.",
        },
      },

      telegram: {
        type: String,
        default: null,
        trim: true,
        validate: {
          validator: (value) => isValidSocialUrl(value, TELEGRAM_PATTERN),
          message: "آدرس تلگرام باید یک URL معتبر با پروتکل HTTPS باشد.",
        },
      },

      x: {
        type: String,
        default: null,
        trim: true,
        validate: {
          validator: (value) => isValidSocialUrl(value, X_PATTERN),
          message: "آدرس ایکس باید یک URL معتبر با پروتکل HTTPS باشد.",
        },
      },
    },

    /**
     * Denormalized user statistics.
     *
     * These values are projections maintained by the service/repository
     * layer. The related source-of-truth data lives in other collections.
     */
    stats: {
      /**
       * Number of non-deleted recipes authored by the user.
       */
      recipeCount: {
        type: Number,
        default: 0,
        min: [0, "تعداد دستورهای پخت نمی‌تواند منفی باشد."],
        validate: {
          validator: isNonNegativeInteger,
          message: "تعداد دستورهای پخت باید یک عدد صحیح و نامنفی باشد.",
        },
      },

      /**
       * Total views accumulated across the user's non-deleted recipes.
       */
      totalRecipeViews: {
        type: Number,
        default: 0,
        min: [0, "مجموع بازدید دستورهای پخت نمی‌تواند منفی باشد."],
        validate: {
          validator: isNonNegativeInteger,
          message: "مجموع بازدید دستورهای پخت باید یک عدد صحیح و نامنفی باشد.",
        },
      },

      /**
       * Number of ratings associated with the user's non-deleted recipes.
       */
      ratingCount: {
        type: Number,
        default: 0,
        min: [0, "تعداد امتیازها نمی‌تواند منفی باشد."],
        validate: {
          validator: isNonNegativeInteger,
          message: "تعداد امتیازها باید یک عدد صحیح و نامنفی باشد.",
        },
      },

      /**
       * Sum of all rating values associated with the user's
       * non-deleted recipes.
       */
      ratingSum: {
        type: Number,
        default: 0,
        min: [0, "مجموع امتیازها نمی‌تواند منفی باشد."],
        validate: {
          validator: isNonNegativeInteger,
          message: "مجموع امتیازها باید یک عدد صحیح و نامنفی باشد.",
        },
      },

      /**
       * Denormalized average rating.
       *
       * The normal write path derives this value from ratingCount
       * and ratingSum and rounds it to two decimal places.
       */
      averageRating: {
        type: Number,
        default: 0,
        min: [0, "میانگین امتیاز نمی‌تواند کمتر از صفر باشد."],
        max: [5, "میانگین امتیاز نمی‌تواند بیشتر از ۵ باشد."],
        validate: {
          validator: hasAtMostTwoDecimalPlaces,
          message: "میانگین امتیاز حداکثر می‌تواند دو رقم اعشار داشته باشد.",
        },
      },
    },

    /**
     * Indicates whether the user's email has been successfully verified.
     *
     * For a newly registered account this remains false until the
     * verification flow activates the account.
     */
    emailVerified: {
      type: Boolean,
      default: false,
    },

    /**
     * Account lifecycle state.
     *
     * Newly registered users remain pending until email verification.
     * Transition to ACTIVE is performed by the email-verification flow.
     */
    accountStatus: {
      type: String,
      enum: {
        values: Object.values(ACCOUNT_STATUSES),
        message: "وضعیت حساب کاربری نامعتبر است.",
      },
      default: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      required: [true, "وضعیت حساب کاربری الزامی است."],
    },

    /**
     * Soft-deletion timestamp.
     *
     * A null value means the account has not been soft-deleted.
     */
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * --------------------------------------------------------------------------
 * Indexes
 * --------------------------------------------------------------------------
 */

/**
 * Ranking by average rating.
 *
 * `_id` provides a deterministic tie-breaker for cursor pagination.
 */
userSchema.index({
  "stats.averageRating": -1,
  _id: -1,
});

/**
 * Ranking by total recipe views.
 *
 * `_id` provides a deterministic tie-breaker for cursor pagination.
 */
userSchema.index({
  "stats.totalRecipeViews": -1,
  _id: -1,
});

/**
 * Chronological ordering from newest to oldest.
 *
 * `_id` provides a deterministic tie-breaker when multiple Users
 * have the same creation timestamp.
 */
userSchema.index({
  createdAt: -1,
  _id: -1,
});

/**
 * Chronological ordering from oldest to newest.
 *
 * `_id` provides a deterministic tie-breaker when multiple Users
 * have the same creation timestamp.
 */
// userSchema.index({
//   createdAt: 1,
//   _id: 1,
// });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
