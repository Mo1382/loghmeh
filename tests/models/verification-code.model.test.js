import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { MongoMemoryServer } from "mongodb-memory-server";

import mongoose from "mongoose";

import VerificationCode from "@/models/VerificationCode";

import { VERIFICATION_CODE_PURPOSES } from "@/constants/enums";

import {
  expectValidationError,
  findIndexByFields,
} from "@/tests/helpers/mongoose-test-helpers";

let mongoServer;

/*
 * ============================================================================
 * Test setup
 * ============================================================================
 *
 * Uses an in-memory MongoDB instance for schema and database-level tests.
 */
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri());

  // Ensure indexes are ready before database constraint tests run.
  await VerificationCode.init();
});

afterEach(async () => {
  await VerificationCode.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

/*
 * ============================================================================
 * Test helpers
 * ============================================================================
 */

function buildValidVerificationCode(overrides = {}) {
  return new VerificationCode({
    email: "test@example.com",
    codeHash: "hashed-verification-code",
    purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  });
}

/*
 * ============================================================================
 * Basic validity
 * ============================================================================
 */

describe("VerificationCode model - basic validity", () => {
  test("accepts a valid verification code document", () => {
    const verificationCode = buildValidVerificationCode();

    expect(verificationCode.validateSync()).toBeUndefined();
  });
});

/*
 * ============================================================================
 * Required fields
 * ============================================================================
 */

describe("VerificationCode model - required fields", () => {
  test("requires email", () => {
    const verificationCode = buildValidVerificationCode({
      email: undefined,
    });

    expectValidationError(verificationCode, "email");
  });

  test("requires codeHash", () => {
    const verificationCode = buildValidVerificationCode({
      codeHash: undefined,
    });

    expectValidationError(verificationCode, "codeHash");
  });

  test("requires purpose", () => {
    const verificationCode = buildValidVerificationCode({
      purpose: undefined,
    });

    expectValidationError(verificationCode, "purpose");
  });

  test("requires expiresAt", () => {
    const verificationCode = buildValidVerificationCode({
      expiresAt: undefined,
    });

    expectValidationError(verificationCode, "expiresAt");
  });
});

/*
 * ============================================================================
 * Email
 * ============================================================================
 */

describe("VerificationCode model - email", () => {
  test("accepts a valid email", () => {
    const verificationCode = buildValidVerificationCode({
      email: "test@example.com",
    });

    expect(verificationCode.validateSync()).toBeUndefined();
  });

  test("trims surrounding whitespace", () => {
    const verificationCode = buildValidVerificationCode({
      email: "  test@example.com  ",
    });

    expect(verificationCode.email).toBe("test@example.com");
  });

  test("lowercases email", () => {
    const verificationCode = buildValidVerificationCode({
      email: "TEST@EXAMPLE.COM",
    });

    expect(verificationCode.email).toBe("test@example.com");
  });

  test("accepts the 254-character email boundary", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(93)}aaa`;
    const email = `${localPart}@${domain}`;

    expect(email.length).toBe(254);

    const verificationCode = buildValidVerificationCode({
      email,
    });

    expect(verificationCode.validateSync()).toBeUndefined();
  });

  test("rejects an email longer than 254 characters", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(94)}aa`;
    const email = `${localPart}@${domain}`;

    expect(email.length).toBe(255);

    const verificationCode = buildValidVerificationCode({
      email,
    });

    expectValidationError(verificationCode, "email");
  });

  test.each([
    "invalid-email",
    "user@",
    "@example.com",
    "user.example.com",
    "user@example",
    "user name@example.com",
    "",
  ])("rejects an invalid email: %s", (email) => {
    const verificationCode = buildValidVerificationCode({
      email,
    });

    expectValidationError(verificationCode, "email");
  });
});

/*
 * ============================================================================
 * codeHash
 * ============================================================================
 */

describe("VerificationCode model - codeHash", () => {
  test("accepts a hashed code value", () => {
    const verificationCode = buildValidVerificationCode({
      codeHash: "bcrypt-hashed-code",
    });

    expect(verificationCode.validateSync()).toBeUndefined();
  });

  test("marks codeHash as select:false", () => {
    const codeHashPath = VerificationCode.schema.path("codeHash");

    expect(codeHashPath.options.select).toBe(false);
  });
});

/*
 * ============================================================================
 * Purpose
 * ============================================================================
 */

describe("VerificationCode model - purpose", () => {
  test.each(Object.values(VERIFICATION_CODE_PURPOSES))(
    "accepts valid purpose: %s",
    (purpose) => {
      const verificationCode = buildValidVerificationCode({
        purpose,
      });

      expect(verificationCode.validateSync()).toBeUndefined();
    }
  );

  test("rejects an invalid purpose", () => {
    const verificationCode = buildValidVerificationCode({
      purpose: "INVALID_PURPOSE",
    });

    expectValidationError(verificationCode, "purpose");
  });
});

/*
 * ============================================================================
 * expiresAt
 * ============================================================================
 */

describe("VerificationCode model - expiresAt", () => {
  test("accepts a future expiration date", () => {
    const verificationCode = buildValidVerificationCode({
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    expect(verificationCode.validateSync()).toBeUndefined();
  });

  test("accepts a past expiration date at the model level", () => {
    /*
     * The model only requires expiresAt to be a valid Date.
     * Repository logic determines whether the code is still active.
     */
    const verificationCode = buildValidVerificationCode({
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    expect(verificationCode.validateSync()).toBeUndefined();
  });

  test("rejects a non-date expiresAt value", () => {
    const verificationCode = buildValidVerificationCode({
      expiresAt: "not-a-date",
    });

    expectValidationError(verificationCode, "expiresAt");
  });
});

/*
 * ============================================================================
 * Timestamps
 * ============================================================================
 */

describe("VerificationCode model - timestamps", () => {
  test("enables createdAt and updatedAt timestamps", () => {
    expect(VerificationCode.schema.options.timestamps).toBe(true);
  });

  test("creates timestamps when the document is saved", async () => {
    const verificationCode = await VerificationCode.create(
      buildValidVerificationCode()
    );

    expect(verificationCode.createdAt).toBeInstanceOf(Date);
    expect(verificationCode.updatedAt).toBeInstanceOf(Date);
  });
});

/*
 * ============================================================================
 * Index definitions
 * ============================================================================
 */

describe("VerificationCode model - index definitions", () => {
  test("defines a unique email + purpose index", () => {
    const index = findIndexByFields(VerificationCode.schema, {
      email: 1,
      purpose: 1,
    });

    expect(index).toBeDefined();
    expect(index[1]).toMatchObject({
      unique: true,
    });
  });

  test("defines an expiresAt TTL index", () => {
    const index = findIndexByFields(VerificationCode.schema, {
      expiresAt: 1,
    });

    expect(index).toBeDefined();
    expect(index[1]).toMatchObject({
      expireAfterSeconds: 0,
    });
  });
});

/*
 * ============================================================================
 * Database constraints
 * ============================================================================
 */

describe("VerificationCode model - database constraints", () => {
  test("rejects duplicate email + purpose combinations", async () => {
    await VerificationCode.create(
      buildValidVerificationCode({
        email: "duplicate@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    await expect(
      VerificationCode.create(
        buildValidVerificationCode({
          email: "duplicate@example.com",
          purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        })
      )
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  test("allows the same email to have different purposes", async () => {
    await VerificationCode.create(
      buildValidVerificationCode({
        email: "purpose@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    await expect(
      VerificationCode.create(
        buildValidVerificationCode({
          email: "purpose@example.com",
          purpose: VERIFICATION_CODE_PURPOSES.PASSWORD_RESET,
        })
      )
    ).resolves.toBeDefined();
  });

  test("treats differently cased emails as the same normalized email", async () => {
    await VerificationCode.create(
      buildValidVerificationCode({
        email: "TEST@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    await expect(
      VerificationCode.create(
        buildValidVerificationCode({
          email: "test@example.com",
          purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        })
      )
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  test("treats surrounding whitespace as the same normalized email", async () => {
    await VerificationCode.create(
      buildValidVerificationCode({
        email: "test@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    await expect(
      VerificationCode.create(
        buildValidVerificationCode({
          email: "  test@example.com  ",
          purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        })
      )
    ).rejects.toMatchObject({
      code: 11000,
    });
  });
});

/*
 * ============================================================================
 * Model-level security contract
 * ============================================================================
 */

describe("VerificationCode model - security contract", () => {
  test("does not include codeHash in normal query results", async () => {
    await VerificationCode.create(
      buildValidVerificationCode({
        email: "hidden-hash@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
      })
    );

    const result = await VerificationCode.findOne({
      email: "hidden-hash@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    });

    expect(result).not.toBeNull();
    expect(result?.codeHash).toBeUndefined();
  });

  test("allows explicit selection of codeHash when required", async () => {
    await VerificationCode.create(
      buildValidVerificationCode({
        email: "explicit-hash@example.com",
        purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
        codeHash: "stored-hash",
      })
    );

    const result = await VerificationCode.findOne({
      email: "explicit-hash@example.com",
      purpose: VERIFICATION_CODE_PURPOSES.EMAIL_VERIFICATION,
    }).select("+codeHash");

    expect(result).not.toBeNull();
    expect(result?.codeHash).toBe("stored-hash");
  });
});
