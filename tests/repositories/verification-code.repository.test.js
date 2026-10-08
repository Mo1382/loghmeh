import mongoose from "mongoose";

import { MongoMemoryReplSet } from "mongodb-memory-server";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import VerificationCode from "@/models/VerificationCode";

import { VERIFICATION_CODE_PURPOSES } from "@/constants/enums";

import {
  consumeVerificationCode,
  findActiveVerificationCode,
  replaceVerificationCode,
} from "@/repositories/verification-code.repository";

/*
 * ============================================================================
 * Test Configuration
 * ============================================================================
 */

let mongoServer;

/*
 * ============================================================================
 * Test Helpers
 * ============================================================================
 */

function buildValidCodeData(overrides = {}) {
  return {
    email: "test@example.com",
    codeHash: "hashed-code",
    purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  };
}

async function createVerificationCode(overrides = {}) {
  return VerificationCode.create(buildValidCodeData(overrides));
}

async function findStoredVerificationCode(email, purpose) {
  return VerificationCode.findOne({
    email,
    purpose,
  }).select("+codeHash");
}

/*
 * ============================================================================
 * MongoDB Test Lifecycle
 * ============================================================================
 */

beforeAll(async () => {
  /*
   * A replica set is required because repository tests also verify
   * transaction/session behavior.
   */
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri());

  /*
   * Ensure all schema indexes are ready before testing repository behavior.
   */
  await VerificationCode.init();
});

beforeEach(async () => {
  /*
   * Each test starts with a clean VerificationCode collection.
   */
  await VerificationCode.deleteMany({});
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

/*
 * ============================================================================
 * findActiveVerificationCode()
 * ============================================================================
 */

describe("findActiveVerificationCode()", () => {
  it("finds a non-expired verification code for the matching email and purpose", async () => {
    const code = await createVerificationCode();

    const result = await findActiveVerificationCode(code.email, code.purpose);

    expect(result).not.toBeNull();
    expect(result?._id.toString()).toBe(code._id.toString());
    expect(result?.email).toBe(code.email);
    expect(result?.purpose).toBe(code.purpose);
  });

  it("returns the codeHash even though codeHash is select:false in the model", async () => {
    await createVerificationCode({
      email: "hash@example.com",
      codeHash: "stored-hash",
    });

    const result = await findActiveVerificationCode(
      "hash@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(result).not.toBeNull();
    expect(result?.codeHash).toBe("stored-hash");
  });

  it("does not return an expired verification code", async () => {
    await createVerificationCode({
      email: "expired@example.com",
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const result = await findActiveVerificationCode(
      "expired@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(result).toBeNull();
  });

  it("returns null when the email does not match", async () => {
    await createVerificationCode({
      email: "existing@example.com",
    });

    const result = await findActiveVerificationCode(
      "different@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(result).toBeNull();
  });

  it("returns null when the purpose does not match", async () => {
    await createVerificationCode({
      email: "purpose@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    const result = await findActiveVerificationCode(
      "purpose@example.com",
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );

    expect(result).toBeNull();
  });

  it.each(Object.values(VERIFICATION_CODE_PURPOSES))(
    "supports the purpose %s",
    async (purpose) => {
      const email = `${purpose.toLowerCase()}@example.com`;

      await createVerificationCode({
        email,
        purpose,
      });

      const result = await findActiveVerificationCode(email, purpose);

      expect(result).not.toBeNull();
      expect(result?.purpose).toBe(purpose);
    }
  );
});

/*
 * ============================================================================
 * replaceVerificationCode()
 * ============================================================================
 */

describe("replaceVerificationCode()", () => {
  it("creates a new verification code when none exists", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const result = await replaceVerificationCode({
      email: "new@example.com",
      codeHash: "first-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt,
    });

    expect(result).not.toBeNull();
    expect(result?.email).toBe("new@example.com");
    expect(result?.purpose).toBe(VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION);
    expect(result?.codeHash).toBeUndefined();

    const stored = await findStoredVerificationCode(
      "new@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(stored).not.toBeNull();
    expect(stored?.codeHash).toBe("first-hash");
    expect(stored?.expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it("replaces the existing code for the same email and purpose", async () => {
    const first = await replaceVerificationCode({
      email: "replace@example.com",
      codeHash: "first-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const secondExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const second = await replaceVerificationCode({
      email: "replace@example.com",
      codeHash: "second-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt: secondExpiresAt,
    });

    expect(second).not.toBeNull();

    expect(second?._id.toString()).toBe(first?._id.toString());

    const stored = await findStoredVerificationCode(
      "replace@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(stored).not.toBeNull();
    expect(stored?.codeHash).toBe("second-hash");
    expect(stored?.expiresAt.getTime()).toBe(secondExpiresAt.getTime());

    const count = await VerificationCode.countDocuments({
      email: "replace@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    expect(count).toBe(1);
  });

  it("preserves createdAt and updates updatedAt when replacing a code", async () => {
    const first = await replaceVerificationCode({
      email: "timestamp-replace@example.com",
      codeHash: "first-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    expect(first).not.toBeNull();

    const originalCreatedAt = first.createdAt;

    // Backdate updatedAt without triggering Mongoose timestamps.
    const oldUpdatedAt = new Date("2000-01-01T00:00:00.000Z");

    await VerificationCode.collection.updateOne(
      { _id: first._id },
      {
        $set: {
          updatedAt: oldUpdatedAt,
        },
      }
    );

    const second = await replaceVerificationCode({
      email: "timestamp-replace@example.com",
      codeHash: "second-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    expect(second).not.toBeNull();
    expect(second?._id.toString()).toBe(first?._id.toString());

    expect(second?.createdAt.getTime()).toBe(originalCreatedAt.getTime());

    expect(second?.updatedAt.getTime()).toBeGreaterThan(oldUpdatedAt.getTime());
  });

  it("keeps different purposes separate for the same email", async () => {
    await replaceVerificationCode({
      email: "multi-purpose@example.com",
      codeHash: "email-verification-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    await replaceVerificationCode({
      email: "multi-purpose@example.com",
      codeHash: "password-reset-hash",
      purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const count = await VerificationCode.countDocuments({
      email: "multi-purpose@example.com",
    });

    expect(count).toBe(2);

    const emailVerification = await findStoredVerificationCode(
      "multi-purpose@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    const passwordReset = await findStoredVerificationCode(
      "multi-purpose@example.com",
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );

    expect(emailVerification?.codeHash).toBe("email-verification-hash");
    expect(passwordReset?.codeHash).toBe("password-reset-hash");
  });

  it("normalizes the email when inserting a new code", async () => {
    await replaceVerificationCode({
      email: "  TEST@Example.COM  ",
      codeHash: "normalized-hash",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const stored = await findStoredVerificationCode(
      "test@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(stored).not.toBeNull();
    expect(stored?.email).toBe("test@example.com");
    expect(stored?.codeHash).toBe("normalized-hash");
  });

  it("rejects an invalid email", async () => {
    await expect(
      replaceVerificationCode({
        email: "invalid-email",
        codeHash: "hashed-code",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
    ).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        email: expect.anything(),
      },
    });
  });

  it("rejects an invalid purpose", async () => {
    await expect(
      replaceVerificationCode({
        email: "invalid-purpose@example.com",
        codeHash: "hashed-code",
        purpose: "INVALID_PURPOSE",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
    ).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        purpose: expect.anything(),
      },
    });
  });

  it("rejects an empty code hash", async () => {
    await expect(
      replaceVerificationCode({
        email: "empty-hash@example.com",
        codeHash: "",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })
    ).rejects.toMatchObject({
      name: "ValidationError",
      errors: {
        codeHash: expect.anything(),
      },
    });
  });

  it("rejects an invalid expiration date", async () => {
    await expect(
      replaceVerificationCode({
        email: "invalid-date@example.com",
        codeHash: "hashed-code",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        expiresAt: "not-a-date",
      })
    ).rejects.toMatchObject({
      name: "CastError",
      path: "expiresAt",
    });
  });
});

/*
 * ============================================================================
 * consumeVerificationCode()
 * ============================================================================
 */

describe("consumeVerificationCode()", () => {
  it("atomically consumes a valid active verification code", async () => {
    const code = await createVerificationCode({
      email: "consume@example.com",
      codeHash: "consume-hash",
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "consume-hash",
    });

    expect(result).not.toBeNull();
    expect(result?._id.toString()).toBe(code._id.toString());

    const stored = await VerificationCode.findById(code._id);

    expect(stored).toBeNull();
  });

  it("does not consume a code when the hash does not match", async () => {
    const code = await createVerificationCode({
      email: "wrong-hash@example.com",
      codeHash: "correct-hash",
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "wrong-hash",
    });

    expect(result).toBeNull();

    const stored = await findStoredVerificationCode(code.email, code.purpose);

    expect(stored).not.toBeNull();
    expect(stored?.codeHash).toBe("correct-hash");
  });

  it("does not consume a code when the email does not match", async () => {
    const code = await createVerificationCode({
      email: "consume-email@example.com",
      codeHash: "correct-hash",
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: "different@example.com",
      purpose: code.purpose,
      codeHash: "correct-hash",
    });

    expect(result).toBeNull();

    const stored = await VerificationCode.findById(code._id);

    expect(stored).not.toBeNull();
  });

  it("does not consume a code when the purpose does not match", async () => {
    const code = await createVerificationCode({
      email: "consume-purpose@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      codeHash: "correct-hash",
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
      codeHash: "correct-hash",
    });

    expect(result).toBeNull();

    const stored = await VerificationCode.findById(code._id);

    expect(stored).not.toBeNull();
  });

  it("does not consume an expired verification code", async () => {
    const code = await createVerificationCode({
      email: "expired-consume@example.com",
      codeHash: "correct-hash",
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "correct-hash",
    });

    expect(result).toBeNull();
  });

  it("does not consume another document when the id does not match", async () => {
    const code = await createVerificationCode({
      email: "wrong-id@example.com",
      codeHash: "correct-hash",
    });

    const result = await consumeVerificationCode({
      verificationCodeId: new mongoose.Types.ObjectId(),
      email: code.email,
      purpose: code.purpose,
      codeHash: "correct-hash",
    });

    expect(result).toBeNull();

    const stored = await VerificationCode.findById(code._id);

    expect(stored).not.toBeNull();
  });

  it("can consume a code only once", async () => {
    const code = await createVerificationCode({
      email: "single-use@example.com",
      codeHash: "single-use-hash",
    });

    const firstResult = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "single-use-hash",
    });

    const secondResult = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "single-use-hash",
    });

    expect(firstResult).not.toBeNull();
    expect(secondResult).toBeNull();
  });

  it("allows only one concurrent consumer to consume a code", async () => {
    const code = await createVerificationCode({
      email: "concurrent-consume@example.com",
      codeHash: "concurrent-hash",
    });

    const payload = {
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "concurrent-hash",
    };

    const [firstResult, secondResult] = await Promise.all([
      consumeVerificationCode(payload),
      consumeVerificationCode(payload),
    ]);

    expect([firstResult, secondResult].filter(Boolean)).toHaveLength(1);
  });

  it("returns null for a missing verification code", async () => {
    const result = await consumeVerificationCode({
      verificationCodeId: new mongoose.Types.ObjectId(),
      email: "missing@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      codeHash: "missing-hash",
    });

    expect(result).toBeNull();
  });
});

/*
 * ============================================================================
 * Session / Transaction Behavior
 * ============================================================================
 */

describe("session propagation and transactions", () => {
  it("propagates the session to findActiveVerificationCode()", async () => {
    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          await replaceVerificationCode(
            {
              email: "transaction-read@example.com",
              codeHash: "transaction-hash",
              purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
            session
          );

          /*
           * This read must occur through the same transaction session
           * because the inserted document is not committed yet.
           */
          const result = await findActiveVerificationCode(
            "transaction-read@example.com",
            VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
            session
          );

          expect(result).not.toBeNull();
          expect(result?.codeHash).toBe("transaction-hash");
        })
      ).resolves.toBeUndefined();
    } finally {
      await session.endSession();
    }
  });

  it("rolls back replaceVerificationCode() when the transaction aborts", async () => {
    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          await replaceVerificationCode(
            {
              email: "transaction-rollback@example.com",
              codeHash: "rollback-hash",
              purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
            session
          );

          throw new Error("force rollback");
        })
      ).rejects.toThrow("force rollback");
    } finally {
      await session.endSession();
    }

    const stored = await VerificationCode.findOne({
      email: "transaction-rollback@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    expect(stored).toBeNull();
  });

  it("rolls back consumeVerificationCode() when the transaction aborts", async () => {
    const code = await createVerificationCode({
      email: "transaction-consume@example.com",
      codeHash: "transaction-consume-hash",
    });

    const session = await mongoose.startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          const consumed = await consumeVerificationCode({
            verificationCodeId: code._id,
            email: code.email,
            purpose: code.purpose,
            codeHash: "transaction-consume-hash",
            session,
          });

          expect(consumed).not.toBeNull();

          throw new Error("force consume rollback");
        })
      ).rejects.toThrow("force consume rollback");
    } finally {
      await session.endSession();
    }

    const stored = await VerificationCode.findById(code._id);

    expect(stored).not.toBeNull();
  });

  it("commits repository mutations when the supplied transaction succeeds", async () => {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        await replaceVerificationCode(
          {
            email: "transaction-commit@example.com",
            codeHash: "committed-hash",
            purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          },
          session
        );
      });
    } finally {
      await session.endSession();
    }

    const stored = await findStoredVerificationCode(
      "transaction-commit@example.com",
      VERIFICATION_CODE_PURPOSES.PASSWORD_RESET
    );

    expect(stored).not.toBeNull();
    expect(stored?.codeHash).toBe("committed-hash");
  });
});
