import mongoose from "mongoose";

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
      // Expect nums, Latin small and capital letters, Persian letters and _
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
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },

    title: {
      type: String,
      enum: ["USER", "COOK", "HEAD_CHEF", "BARISTA", "FOOD_BLOGGER"],
      default: "USER",
      required: true,
    },

    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
      required: true,
    },

    socialLinks: {
      instagram: {
        type: String,
        default: null,
        trim: true,
      },
      telegram: {
        type: String,
        default: null,
        trim: true,
      },
      x: {
        type: String,
        default: null,
        trim: true,
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
      enum: ["ACTIVE", "SUSPENDED", "DEACTIVATED"],
      default: "ACTIVE",
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
