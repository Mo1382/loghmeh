import VerificationCode from "@/models/VerificationCode";

import { applySession } from "@/lib/helpers/apply-session";

/*
 * ============================================================================
 * Consume
 * ============================================================================
 */

/**
 * Atomically consume a verification code.
 *
 * The code is deleted only when all identifying and validity conditions match.
 */
export function consumeVerificationCode({
  verificationCodeId,
  email,
  purpose,
  codeHash,
  session,
}) {
  const query = VerificationCode.findOneAndDelete({
    _id: verificationCodeId,
    email,
    purpose,
    codeHash,
    expiresAt: {
      $gt: new Date(),
    },
  });

  return applySession(query, session);
}

/*
 * ============================================================================
 * Find active code
 * ============================================================================
 */

// Finds the active verification code for the given email and purpose.
export function findActiveVerificationCode(email, purpose, session) {
  const query = VerificationCode.findOne({
    email,
    purpose,
    expiresAt: {
      $gt: new Date(),
    },
  }).select("+codeHash");

  return applySession(query, session);
}

/*
 * ============================================================================
 * Replace
 * ============================================================================
 */

/**
 * Replace the current verification code with a new one.
 *
 * The Service layer is responsible for generating and hashing the new code.
 */
export function replaceVerificationCode(codeData, session) {
  const query = VerificationCode.findOneAndUpdate(
    {
      email: codeData.email,
      purpose: codeData.purpose,
    },
    {
      $set: {
        codeHash: codeData.codeHash,
        expiresAt: codeData.expiresAt,
      },
      $setOnInsert: {
        email: codeData.email,
        purpose: codeData.purpose,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return applySession(query, session);
}
