import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import VerificationCode from "@/models/VerificationCode";
import { VERIFICATION_CODE_PURPOSES } from "@/constants/enums";
import {
  consumeVerificationCode,
  findActiveVerificationCode,
  findVerificationCode,
  replaceVerificationCode,
} from "@/repositories/verification-code.repository";

import { randomUUID } from "node:crypto";

import { isStrictGenerationId } from "@/lib/validation/generation-id";

const EXPIRED_CODE_RETENTION_MS = 60 * 60 * 1000;

const CODE_EXPIRATION_MS = 10 * 60 * 1000;

let mongoServer;

function buildValidCodeData(overrides = {}) {
  const defaultExpiresAt = new Date(Date.now() + CODE_EXPIRATION_MS);

  const expiresAt = Object.prototype.hasOwnProperty.call(overrides, "expiresAt")
    ? overrides.expiresAt
    : defaultExpiresAt;

  const expiresAtDate =
    expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

  const purgeAt = Number.isNaN(expiresAtDate.getTime())
    ? new Date(Date.now() + CODE_EXPIRATION_MS + EXPIRED_CODE_RETENTION_MS)
    : new Date(expiresAtDate.getTime() + EXPIRED_CODE_RETENTION_MS);

  return {
    email: "test@example.com",
    codeHash: "hashed-code",
    purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    expiresAt,
    purgeAt,
    generationId: randomUUID(),
    ...overrides,
  };
}

/**
 * Data passed to repository functions.
 *
 * purgeAt is intentionally omitted because the repository must
 * calculate it from expiresAt.
 */
function buildRepositoryCodeData(overrides = {}) {
  const { email, codeHash, purpose, expiresAt } = buildValidCodeData(overrides);

  return {
    email,
    codeHash,
    purpose,
    expiresAt,
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

async function startSession() {
  return mongoose.startSession();
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  await mongoose.connect(mongoServer.getUri());
  await VerificationCode.init();
});

beforeEach(async () => {
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

describe("findActiveVerificationCode()", () => {
  it("returns an active code and explicitly includes codeHash", async () => {
    const code = await createVerificationCode({
      email: "active-code@example.com",
      codeHash: "active-hash",
    });

    const result = await findActiveVerificationCode(code.email, code.purpose);

    expect(result).not.toBeNull();
    expect(result._id.toString()).toBe(code._id.toString());
    expect(result.codeHash).toBe("active-hash");
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.generationId).toBe(code.generationId);
  });

  it("does not return an expired code", async () => {
    const code = await createVerificationCode({
      email: "expired-code@example.com",
      expiresAt: new Date(Date.now() - 60 * 1000),
      purgeAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const result = await findActiveVerificationCode(code.email, code.purpose);

    expect(result).toBeNull();
  });

  it("returns null when the email does not match", async () => {
    const code = await createVerificationCode({
      email: "correct-email@example.com",
    });

    const result = await findActiveVerificationCode(
      "different-email@example.com",
      code.purpose
    );

    expect(result).toBeNull();
  });

  it("returns null when the purpose does not match", async () => {
    const purposes = Object.values(VERIFICATION_CODE_PURPOSES);
    const otherPurpose = purposes.find(
      (purpose) => purpose !== VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    if (!otherPurpose) {
      throw new Error(
        "This test requires at least two verification-code purposes."
      );
    }

    const code = await createVerificationCode({
      email: "purpose-mismatch@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    const result = await findActiveVerificationCode(code.email, otherPurpose);

    expect(result).toBeNull();
  });

  it.each(Object.values(VERIFICATION_CODE_PURPOSES))(
    "finds an active code for the %s purpose",
    async (purpose) => {
      const code = await createVerificationCode({
        email: `purpose-${purpose}@example.com`,
        purpose,
      });

      const result = await findActiveVerificationCode(code.email, purpose);

      expect(result).not.toBeNull();
      expect(result._id.toString()).toBe(code._id.toString());
      expect(result.generationId).toBe(code.generationId);
    }
  );

  it("uses the provided session", async () => {
    const session = await startSession();
    const email = "active-session@example.com";
    const purpose = VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION;

    try {
      await session.withTransaction(async () => {
        const createdCode = await replaceVerificationCode(
          buildRepositoryCodeData({
            email,
            purpose,
            codeHash: "session-hash",
          }),
          session
        );

        const result = await findActiveVerificationCode(
          email,
          purpose,
          session
        );

        expect(result).not.toBeNull();
        expect(result.codeHash).toBe("session-hash");
        expect(result.generationId).toBe(createdCode.generationId);
      });
    } finally {
      await session.endSession();
    }

    const storedCode = await findStoredVerificationCode(email, purpose);

    expect(storedCode).not.toBeNull();
  });
});

describe("findVerificationCode()", () => {
  it("finds a non-expired code and explicitly includes codeHash", async () => {
    const code = await createVerificationCode({
      email: "find-code@example.com",
      codeHash: "stored-hash",
    });

    const result = await findVerificationCode(code.email, code.purpose);

    expect(result).not.toBeNull();
    expect(result._id.toString()).toBe(code._id.toString());
    expect(result.codeHash).toBe("stored-hash");
    expect(result.generationId).toBe(code.generationId);
  });

  it("finds an expired code while it is within the retention period", async () => {
    const code = await createVerificationCode({
      email: "expired-retained@example.com",
      codeHash: "expired-hash",
      expiresAt: new Date(Date.now() - 60 * 1000),
      purgeAt: new Date(Date.now() + 59 * 60 * 1000),
    });

    const result = await findVerificationCode(code.email, code.purpose);

    expect(result).not.toBeNull();
    expect(result._id.toString()).toBe(code._id.toString());
    expect(result.codeHash).toBe("expired-hash");
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("does not return a code after its retention period has ended", async () => {
    await createVerificationCode({
      email: "retention-ended@example.com",
      expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      purgeAt: new Date(Date.now() - 60 * 1000),
    });

    const result = await findVerificationCode(
      "retention-ended@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(result).toBeNull();
  });

  it("returns null when the email does not match", async () => {
    await createVerificationCode({
      email: "find-correct-email@example.com",
    });

    const result = await findVerificationCode(
      "find-wrong-email@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(result).toBeNull();
  });

  it("returns null when the purpose does not match", async () => {
    const purposes = Object.values(VERIFICATION_CODE_PURPOSES);
    const otherPurpose = purposes.find(
      (purpose) => purpose !== VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    if (!otherPurpose) {
      throw new Error(
        "This test requires at least two verification-code purposes."
      );
    }

    await createVerificationCode({
      email: "find-purpose@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    const result = await findVerificationCode(
      "find-purpose@example.com",
      otherPurpose
    );

    expect(result).toBeNull();
  });

  it("uses the provided session", async () => {
    const session = await startSession();
    const email = "find-session@example.com";
    const purpose = VERIFICATION_CODE_PURPOSES.PASSWORD_RESET;

    try {
      await session.withTransaction(async () => {
        const createdCode = await replaceVerificationCode(
          buildRepositoryCodeData({
            email,
            purpose,
            codeHash: "transaction-hash",
          }),
          session
        );

        const result = await findVerificationCode(email, purpose, session);

        expect(result).not.toBeNull();
        expect(result.codeHash).toBe("transaction-hash");
        expect(result.generationId).toBe(createdCode.generationId);
      });
    } finally {
      await session.endSession();
    }

    const storedCode = await findStoredVerificationCode(email, purpose);

    expect(storedCode).not.toBeNull();
  });
});

describe("replaceVerificationCode()", () => {
  it("creates a new verification code", async () => {
    const codeData = buildRepositoryCodeData({
      email: "new-code@example.com",
      codeHash: "new-hash",
    });

    const result = await replaceVerificationCode(codeData);

    expect(result).not.toBeNull();
    expect(result.email).toBe(codeData.email);
    expect(result.codeHash).toBe("new-hash");
    expect(result.purpose).toBe(codeData.purpose);
    expect(result.expiresAt.getTime()).toBe(codeData.expiresAt.getTime());
    expect(isStrictGenerationId(result.generationId)).toBe(true);

    const expectedPurgeAt =
      new Date(codeData.expiresAt).getTime() + EXPIRED_CODE_RETENTION_MS;

    expect(result.purgeAt.getTime()).toBe(expectedPurgeAt);
  });

  it("replaces a code for the same email and purpose", async () => {
    const email = "replace-code@example.com";
    const purpose = VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION;

    const firstExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const firstResult = await replaceVerificationCode(
      buildRepositoryCodeData({
        email,
        purpose,
        codeHash: "first-hash",
        expiresAt: firstExpiresAt,
      })
    );

    const secondExpiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const secondResult = await replaceVerificationCode(
      buildRepositoryCodeData({
        email,
        purpose,
        codeHash: "second-hash",
        expiresAt: secondExpiresAt,
      })
    );

    expect(secondResult._id.toString()).toBe(firstResult._id.toString());
    expect(secondResult.codeHash).toBe("second-hash");
    expect(secondResult.expiresAt.getTime()).toBe(secondExpiresAt.getTime());
    expect(secondResult.createdAt.getTime()).toBe(
      firstResult.createdAt.getTime()
    );
    expect(secondResult.updatedAt.getTime()).toBeGreaterThanOrEqual(
      firstResult.updatedAt.getTime()
    );
    expect(isStrictGenerationId(secondResult.generationId)).toBe(true);
    expect(secondResult.generationId).not.toBe(firstResult.generationId);
    expect(secondResult.purgeAt.getTime()).toBe(
      secondExpiresAt.getTime() + EXPIRED_CODE_RETENTION_MS
    );

    const allCodes = await VerificationCode.find({
      email,
      purpose,
    });

    expect(allCodes).toHaveLength(1);
  });

  it("keeps codes for different purposes separate", async () => {
    const email = "different-purposes@example.com";
    const purposes = Object.values(VERIFICATION_CODE_PURPOSES);

    if (purposes.length < 2) {
      throw new Error(
        "This test requires at least two verification-code purposes."
      );
    }

    const firstPurpose = purposes[0];
    const secondPurpose = purposes.find((purpose) => purpose !== firstPurpose);

    await replaceVerificationCode(
      buildRepositoryCodeData({
        email,
        purpose: firstPurpose,
        codeHash: "first-purpose-hash",
      })
    );

    await replaceVerificationCode(
      buildRepositoryCodeData({
        email,
        purpose: secondPurpose,
        codeHash: "second-purpose-hash",
      })
    );

    const codes = await VerificationCode.find({ email }).select("+codeHash");

    expect(codes).toHaveLength(2);
    expect(codes.map((code) => code.purpose)).toContain(firstPurpose);
    expect(codes.map((code) => code.purpose)).toContain(secondPurpose);
  });

  it("normalizes the email address", async () => {
    const result = await replaceVerificationCode(
      buildRepositoryCodeData({
        email: "  Test.User@Example.com  ",
      })
    );

    expect(result.email).toBe("test.user@example.com");

    const storedCode = await findStoredVerificationCode(
      "test.user@example.com",
      VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    expect(storedCode).not.toBeNull();
  });

  it("rejects an invalid email address", async () => {
    await expect(
      replaceVerificationCode(
        buildRepositoryCodeData({
          email: "invalid-email",
        })
      )
    ).rejects.toThrow();
  });

  it("rejects an invalid purpose", async () => {
    await expect(
      replaceVerificationCode(
        buildRepositoryCodeData({
          purpose: "INVALID_PURPOSE",
        })
      )
    ).rejects.toThrow();
  });

  it("rejects an empty code hash", async () => {
    await expect(
      replaceVerificationCode(
        buildRepositoryCodeData({
          codeHash: "",
        })
      )
    ).rejects.toThrow();
  });

  it("rejects an invalid expiration date before writing a record", async () => {
    const codeData = buildRepositoryCodeData({
      email: "invalid-expiration@example.com",
      expiresAt: "not-a-valid-date",
    });

    expect(() => replaceVerificationCode(codeData)).toThrow(
      "expiresAt must be a valid date."
    );

    const storedCount = await VerificationCode.countDocuments({
      email: codeData.email,
      purpose: codeData.purpose,
    });

    expect(storedCount).toBe(0);
  });

  it("uses the provided session", async () => {
    const session = await startSession();
    const email = "replace-session@example.com";
    const purpose = VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION;

    try {
      await session.withTransaction(async () => {
        const result = await replaceVerificationCode(
          buildRepositoryCodeData({
            email,
            purpose,
            codeHash: "transaction-replace-hash",
          }),
          session
        );

        expect(result).not.toBeNull();
        expect(result.codeHash).toBe("transaction-replace-hash");
      });
    } finally {
      await session.endSession();
    }

    const storedCode = await findStoredVerificationCode(email, purpose);

    expect(storedCode).not.toBeNull();
    expect(storedCode.codeHash).toBe("transaction-replace-hash");
  });

  it("rolls back the replacement when the transaction aborts", async () => {
    const session = await startSession();
    const email = "replace-rollback@example.com";
    const purpose = VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION;

    try {
      await expect(
        session.withTransaction(async () => {
          await replaceVerificationCode(
            buildRepositoryCodeData({
              email,
              purpose,
              codeHash: "rollback-hash",
            }),
            session
          );

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");
    } finally {
      await session.endSession();
    }

    const storedCode = await findStoredVerificationCode(email, purpose);

    expect(storedCode).toBeNull();
  });
});

describe("consumeVerificationCode()", () => {
  it("consumes a valid, unexpired verification code", async () => {
    const code = await createVerificationCode({
      email: "consume-code@example.com",
      codeHash: "consume-hash",
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "consume-hash",
      generationId: code.generationId,
    });

    expect(result).not.toBeNull();
    expect(result._id.toString()).toBe(code._id.toString());

    const storedCode = await findStoredVerificationCode(
      code.email,
      code.purpose
    );

    expect(storedCode).toBeNull();
  });

  it("returns null when the verification-code ID does not match", async () => {
    const code = await createVerificationCode();

    const result = await consumeVerificationCode({
      verificationCodeId: new mongoose.Types.ObjectId(),
      email: code.email,
      purpose: code.purpose,
      codeHash: code.codeHash,
      generationId: code.generationId,
    });

    expect(result).toBeNull();

    const storedCode = await findStoredVerificationCode(
      code.email,
      code.purpose
    );

    expect(storedCode).not.toBeNull();
  });

  it("returns null when the email does not match", async () => {
    const code = await createVerificationCode();

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: "different-email@example.com",
      purpose: code.purpose,
      codeHash: code.codeHash,
      generationId: code.generationId,
    });

    expect(result).toBeNull();
  });

  it("returns null when the purpose does not match", async () => {
    const purposes = Object.values(VERIFICATION_CODE_PURPOSES);
    const otherPurpose = purposes.find(
      (purpose) => purpose !== VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION
    );

    if (!otherPurpose) {
      throw new Error(
        "This test requires at least two verification-code purposes."
      );
    }

    const code = await createVerificationCode({
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: otherPurpose,
      codeHash: code.codeHash,
      generationId: code.generationId,
    });

    expect(result).toBeNull();
  });

  it("returns null when the code hash does not match", async () => {
    const code = await createVerificationCode();

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: "wrong-hash",
      generationId: code.generationId,
    });

    expect(result).toBeNull();

    const storedCode = await findStoredVerificationCode(
      code.email,
      code.purpose
    );

    expect(storedCode).not.toBeNull();
  });

  it("does not consume an expired verification code", async () => {
    const code = await createVerificationCode({
      expiresAt: new Date(Date.now() - 60 * 1000),
      purgeAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const result = await consumeVerificationCode({
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: code.codeHash,
      generationId: code.generationId,
    });

    expect(result).toBeNull();

    const storedCode = await findStoredVerificationCode(
      code.email,
      code.purpose
    );

    expect(storedCode).not.toBeNull();
  });

  it("allows a code to be consumed only once", async () => {
    const code = await createVerificationCode();

    const payload = {
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: code.codeHash,
      generationId: code.generationId,
    };

    const firstResult = await consumeVerificationCode(payload);
    const secondResult = await consumeVerificationCode(payload);

    expect(firstResult).not.toBeNull();
    expect(secondResult).toBeNull();
  });

  it("allows only one successful consumption when called concurrently", async () => {
    const code = await createVerificationCode();

    const payload = {
      verificationCodeId: code._id,
      email: code.email,
      purpose: code.purpose,
      codeHash: code.codeHash,
      generationId: code.generationId,
    };

    const results = await Promise.all([
      consumeVerificationCode(payload),
      consumeVerificationCode(payload),
    ]);

    const successfulResults = results.filter((result) => result !== null);

    expect(successfulResults).toHaveLength(1);
  });

  it("returns null when the code does not exist", async () => {
    const result = await consumeVerificationCode({
      verificationCodeId: new mongoose.Types.ObjectId(),
      email: "missing-code@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      codeHash: "missing-hash",
      generationId: randomUUID(),
    });

    expect(result).toBeNull();
  });

  it("rolls back consumption when the transaction aborts", async () => {
    const code = await createVerificationCode({
      email: "consume-rollback@example.com",
    });

    const session = await startSession();

    try {
      await expect(
        session.withTransaction(async () => {
          const result = await consumeVerificationCode({
            verificationCodeId: code._id,
            email: code.email,
            purpose: code.purpose,
            codeHash: code.codeHash,
            generationId: code.generationId,
            session,
          });

          expect(result).not.toBeNull();

          throw new Error("Force transaction rollback");
        })
      ).rejects.toThrow("Force transaction rollback");
    } finally {
      await session.endSession();
    }

    const storedCode = await findStoredVerificationCode(
      code.email,
      code.purpose
    );

    expect(storedCode).not.toBeNull();
  });

  it("commits consumption when the transaction completes", async () => {
    const code = await createVerificationCode({
      email: "consume-commit@example.com",
    });

    const session = await startSession();

    try {
      await session.withTransaction(async () => {
        const result = await consumeVerificationCode({
          verificationCodeId: code._id,
          email: code.email,
          purpose: code.purpose,
          codeHash: code.codeHash,
          generationId: code.generationId,
          session,
        });

        expect(result).not.toBeNull();
      });
    } finally {
      await session.endSession();
    }

    const storedCode = await findStoredVerificationCode(
      code.email,
      code.purpose
    );

    expect(storedCode).toBeNull();
  });

  it("throws when generationId is missing", async () => {
    const code = await createVerificationCode();

    expect(() =>
      consumeVerificationCode({
        verificationCodeId: code._id,
        email: code.email,
        purpose: code.purpose,
        codeHash: code.codeHash,
      })
    ).toThrow(TypeError);
  });

  it("does not consume a code after its generation has been replaced", async () => {
    const email = "stale-generation@example.com";
    const purpose = VERIFICATION_CODE_PURPOSES.PASSWORD_RESET;
    const codeHash = "same-hash-for-both-generations";

    const firstResult = await replaceVerificationCode(
      buildRepositoryCodeData({
        email,
        purpose,
        codeHash,
      })
    );

    const secondResult = await replaceVerificationCode(
      buildRepositoryCodeData({
        email,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      })
    );

    // The existing document is updated rather than replaced.
    expect(secondResult._id.toString()).toBe(firstResult._id.toString());

    // But every replacement must create a new generation.
    expect(secondResult.generationId).not.toBe(firstResult.generationId);

    // Consumption with the stale generation must fail.
    const result = await consumeVerificationCode({
      verificationCodeId: firstResult._id,
      email,
      purpose,
      codeHash,
      generationId: firstResult.generationId,
    });

    expect(result).toBeNull();

    // The current code must remain stored.
    const storedCode = await findStoredVerificationCode(email, purpose);

    expect(storedCode).not.toBeNull();
    expect(storedCode.generationId).toBe(secondResult.generationId);
    expect(storedCode.codeHash).toBe(codeHash);
  });
});
