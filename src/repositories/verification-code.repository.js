import VerificationCode from "@/models/VerificationCode";

import { applySession } from "@/lib/helpers/apply-session";

import { randomUUID } from "node:crypto";
import { VERIFICATION_CODE_PURPOSES } from "@/constants/enums";

const EXPIRED_CODE_RETENTION_MS = 60 * 60 * 1000;

/*
 * ============================================================================
 * Consume
 * ============================================================================
 */

/**
 * Atomically consume a verification code.
 *
 * By default, only unexpired codes can be consumed.
 * For password-reset flows, a retained expired code can
 * be consumed when a valid reset token authorizes the operation.
 */
export function consumeVerificationCode({
  verificationCodeId,
  email,
  purpose,
  codeHash,
  generationId,
  useRetentionExpiry = false,
  session,
}) {
  if (typeof generationId !== "string" || generationId.length === 0) {
    throw new TypeError("generationId must be a non-empty string.");
  }

  if (
    useRetentionExpiry &&
    purpose !== VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
  ) {
    throw new TypeError(
      "Retention expiry can only be used for password-reset codes."
    );
  }

  const now = new Date();

  const expiryCondition = useRetentionExpiry
    ? { purgeAt: { $gt: now } }
    : { expiresAt: { $gt: now } };

  const query = VerificationCode.findOneAndDelete({
    _id: verificationCodeId,
    email,
    purpose,
    codeHash,
    generationId,
    ...expiryCondition,
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

/**
 * Find the current verification code regardless of expiration.
 *
 * Used only when the caller needs to distinguish an actually
 * expired code from a missing or incorrect code.
 */
export function findVerificationCode(email, purpose, session) {
  const query = VerificationCode.findOne({
    email,
    purpose,
    purgeAt: { $gt: new Date() },
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
  const expiresAt = new Date(codeData.expiresAt);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new TypeError("expiresAt must be a valid date.");
  }

  const purgeAt = new Date(expiresAt.getTime() + EXPIRED_CODE_RETENTION_MS);

  const generationId = randomUUID();

  const query = VerificationCode.findOneAndUpdate(
    {
      email: codeData.email,
      purpose: codeData.purpose,
    },
    {
      $set: {
        codeHash: codeData.codeHash,
        expiresAt,
        purgeAt,
        generationId,
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
