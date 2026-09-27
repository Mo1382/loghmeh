import mongoose from "mongoose";

import { ACCOUNT_STATUSES, USER_ROLES, USER_TITLES } from "@/constants/enums";

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

function isValidSocialUrl(value, domainPattern) {
  if (value == null) {
    return true;
  }

  return isValidHttpsUrl(value) && domainPattern.test(value);
}

const userSchema = new mongoose.Schema(
  {
    sessionVersion: {
      type: Number,
      default: 0,
      min: 0,
    },

    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,

      // Allows numbers, Latin letters, Persian letters, and underscore.
      match: /^[a-zA-Z0-9_\u0600-\u06FF]+$/,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    avatar: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: isValidHttpsUrl,
        message: "Avatar URL must be a valid HTTPS URL.",
      },
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    title: {
      type: String,
      enum: Object.values(USER_TITLES),
      default: USER_TITLES.USER,
      required: true,
    },

    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
      required: true,
    },

    socialLinks: {
      instagram: {
        type: String,
        default: null,
        trim: true,
        validate: {
          validator: (value) =>
            isValidSocialUrl(value, /^https:\/\/(www\.)?instagram\.com\//i),
          message: "Instagram URL must be a valid HTTPS Instagram URL.",
        },
      },

      telegram: {
        type: String,
        default: null,
        trim: true,
        validate: {
          validator: (value) =>
            isValidSocialUrl(
              value,
              /^https:\/\/(www\.)?(t\.me|telegram\.me)\//i
            ),
          message: "Telegram URL must be a valid HTTPS Telegram URL.",
        },
      },

      x: {
        type: String,
        default: null,
        trim: true,
        validate: {
          validator: (value) =>
            isValidSocialUrl(
              value,
              /^https:\/\/(www\.)?(x\.com|twitter\.com)\//i
            ),
          message: "X URL must be a valid HTTPS X URL.",
        },
      },
    },

    stats: {
      recipeCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },

      totalRecipeViews: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    accountStatus: {
      type: String,
      enum: Object.values(ACCOUNT_STATUSES),
      default: ACCOUNT_STATUSES.ACTIVE,
      required: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ createdAt: -1 });
userSchema.index({ "stats.averageRating": -1 });
userSchema.index({ "stats.totalRecipeViews": -1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
