import mongoose from "mongoose";

import { VERIFICATION_CODE_PURPOSES } from "@/constants/enums";
import { isValidEmail } from "@/lib/validation/isValidEmail";

/*
 * ============================================================================
 * Verification Code Schema
 * ============================================================================
 *
 * Stores verification and password reset codes.
 * Only the hashed code is persisted.
 */
const verificationCodeSchema = new mongoose.Schema(
  {
    /*
     * Email is normalized and validated consistently with User.email.
     */
    email: {
      type: String,
      required: [true, "آدرس ایمیل الزامی است."],
      lowercase: true,
      trim: true,
      maxlength: [254, "آدرس ایمیل نباید بیشتر از ۲۵۴ نویسه باشد."],
      validate: {
        validator: isValidEmail,
        message: "لطفاً یک آدرس ایمیل معتبر وارد کنید.",
      },
    },

    /*
     * Excluded from normal queries; explicitly select when needed.
     */
    codeHash: {
      type: String,
      required: true,
      select: false,
    },

    /*
     * Identifies the authentication flow.
     */
    purpose: {
      type: String,
      enum: Object.values(VERIFICATION_CODE_PURPOSES),
      required: true,
    },

    /*
     * Determines when the code expires.
     */
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * ============================================================================
 * Indexes
 * ============================================================================
 */

/* Allows only one code per email and purpose. */
verificationCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });

/* Removes expired documents automatically. */
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/*
 * ============================================================================
 * Model
 * ============================================================================
 *
 * Reuse the compiled model in environments where modules may be reloaded.
 */
const VerificationCode =
  mongoose.models.VerificationCode ||
  mongoose.model("VerificationCode", verificationCodeSchema);

export default VerificationCode;
