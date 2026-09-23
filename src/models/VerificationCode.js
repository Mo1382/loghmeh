import mongoose from "mongoose";
import { VERIFICATION_CODE_PURPOSES } from "@/constants/enums";

const verificationCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    codeHash: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: Object.values(VERIFICATION_CODE_PURPOSES),
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// Indexes
verificationCodeSchema.index({ email: 1, purpose: 1 });
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationCode =
  mongoose.models.VerificationCode ||
  mongoose.model("VerificationCode", verificationCodeSchema);

export default VerificationCode;
