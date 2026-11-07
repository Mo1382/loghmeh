import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import User from "@/models/User";

import { ACCOUNT_STATUSES, USER_ROLES, USER_TITLES } from "@/constants/enums";

import {
  expectValidationError,
  findIndexByFields,
} from "../helpers/mongoose-validation-helpers";

let mongoServer;

/**
 * --------------------------------------------------------------------------
 * Test setup
 * --------------------------------------------------------------------------
 */

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri());

  // Ensure database indexes are ready before database-level tests run.
  await User.init();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
  }
});

/**
 * --------------------------------------------------------------------------
 * Test helpers
 * --------------------------------------------------------------------------
 */

function buildValidUser(overrides = {}) {
  return new User({
    username: "TestUser",
    email: "test@example.com",
    password: "Password123!",
    ...overrides,
  });
}

async function expectValidDocument(document) {
  await document.validate();
}

/**
 * --------------------------------------------------------------------------
 * Basic validity
 * --------------------------------------------------------------------------
 */

describe("User model - basic validity", () => {
  test("accepts a valid user document", async () => {
    const user = buildValidUser();

    await expectValidDocument(user);
  });
});

/**
 * --------------------------------------------------------------------------
 * Defaults
 * --------------------------------------------------------------------------
 */

describe("User model - defaults", () => {
  test("defaults sessionVersion to 0", () => {
    const user = buildValidUser();

    expect(user.sessionVersion).toBe(0);
  });

  test("defaults avatar to null", () => {
    const user = buildValidUser();

    expect(user.avatar).toBeNull();
  });

  test("defaults bio to an empty string", () => {
    const user = buildValidUser();

    expect(user.bio).toBe("");
  });

  test("defaults title to USER", () => {
    const user = buildValidUser();

    expect(user.title).toBe(USER_TITLES.USER);
  });

  test("defaults role to USER", () => {
    const user = buildValidUser();

    expect(user.role).toBe(USER_ROLES.USER);
  });

  test("defaults social links to null", () => {
    const user = buildValidUser();

    expect(user.socialLinks.instagram).toBeNull();
    expect(user.socialLinks.telegram).toBeNull();
    expect(user.socialLinks.x).toBeNull();
  });

  test("defaults user statistics to zero", () => {
    const user = buildValidUser();

    expect(user.stats.recipeCount).toBe(0);
    expect(user.stats.totalRecipeViews).toBe(0);
    expect(user.stats.ratingCount).toBe(0);
    expect(user.stats.ratingSum).toBe(0);
    expect(user.stats.averageRating).toBe(0);
  });

  test("defaults emailVerified to false", () => {
    const user = buildValidUser();

    expect(user.emailVerified).toBe(false);
  });

  test("defaults accountStatus to PENDING_VERIFICATION", () => {
    const user = buildValidUser();

    expect(user.accountStatus).toBe(ACCOUNT_STATUSES.PENDING_VERIFICATION);
  });

  test("defaults deletedAt to null", () => {
    const user = buildValidUser();

    expect(user.deletedAt).toBeNull();
  });
});

/**
 * --------------------------------------------------------------------------
 * Required fields
 * --------------------------------------------------------------------------
 */

describe("User model - required fields", () => {
  test("requires username", async () => {
    const user = buildValidUser({
      username: undefined,
    });

    await expectValidationError(user, "username");
  });

  test("requires email", async () => {
    const user = buildValidUser({
      email: undefined,
    });

    await expectValidationError(user, "email");
  });

  test("requires password", async () => {
    const user = buildValidUser({
      password: undefined,
    });

    await expectValidationError(user, "password");
  });

  test("requires title when explicitly set to null", async () => {
    const user = buildValidUser({
      title: null,
    });

    await expectValidationError(user, "title");
  });

  test("requires role when explicitly set to null", async () => {
    const user = buildValidUser({
      role: null,
    });

    await expectValidationError(user, "role");
  });

  test("requires accountStatus when explicitly set to null", async () => {
    const user = buildValidUser({
      accountStatus: null,
    });

    await expectValidationError(user, "accountStatus");
  });

  test("requires sessionVersion when explicitly set to null", async () => {
    const user = buildValidUser({
      sessionVersion: null,
    });

    await expectValidationError(user, "sessionVersion");
  });
});

/**
 * --------------------------------------------------------------------------
 * Username
 * --------------------------------------------------------------------------
 */

describe("User model - username", () => {
  test("accepts a valid Latin username", async () => {
    const user = buildValidUser({
      username: "CookMaster",
    });

    await expectValidDocument(user);
  });

  test("accepts a valid Persian username", async () => {
    const user = buildValidUser({
      username: "آشپز",
    });

    await expectValidDocument(user);
  });

  test("accepts digits, underscores and hyphens", async () => {
    const user = buildValidUser({
      username: "Cook_Master-123",
    });

    await expectValidDocument(user);
  });

  test("accepts the Persian character آ", async () => {
    const user = buildValidUser({
      username: "آشپزخانه",
    });

    await expectValidDocument(user);
  });

  test("trims surrounding whitespace", () => {
    const user = buildValidUser({
      username: "  Cook  ",
    });

    expect(user.username).toBe("Cook");
  });

  test("preserves username case", () => {
    const user = buildValidUser({
      username: "COOK",
    });

    expect(user.username).toBe("COOK");
  });

  test("does not lowercase usernames", () => {
    const user = buildValidUser({
      username: "Cook",
    });

    expect(user.username).toBe("Cook");
  });

  test("accepts the minimum username length of 3 characters", async () => {
    const user = buildValidUser({
      username: "abc",
    });

    await expectValidDocument(user);
  });

  test("rejects usernames shorter than 3 characters", async () => {
    const user = buildValidUser({
      username: "ab",
    });

    await expectValidationError(user, "username");
  });

  test("accepts the maximum username length of 30 characters", async () => {
    const user = buildValidUser({
      username: "a".repeat(30),
    });

    await expectValidDocument(user);
  });

  test("rejects usernames longer than 30 characters", async () => {
    const user = buildValidUser({
      username: "a".repeat(31),
    });

    await expectValidationError(user, "username");
  });

  test("rejects usernames containing spaces", async () => {
    const user = buildValidUser({
      username: "Cook Master",
    });

    await expectValidationError(user, "username");
  });

  test("rejects usernames containing special characters", async () => {
    const user = buildValidUser({
      username: "Cook@123",
    });

    await expectValidationError(user, "username");
  });
});

/**
 * --------------------------------------------------------------------------
 * Email
 * --------------------------------------------------------------------------
 */

describe("User model - email", () => {
  test("accepts a valid email", async () => {
    const user = buildValidUser({
      email: "test@example.com",
    });

    await expectValidDocument(user);
  });

  test("trims surrounding whitespace", () => {
    const user = buildValidUser({
      email: "  test@example.com  ",
    });

    expect(user.email).toBe("test@example.com");
  });

  test("lowercases email", () => {
    const user = buildValidUser({
      email: "TEST@EXAMPLE.COM",
    });

    expect(user.email).toBe("test@example.com");
  });

  test("accepts an email at the schema's 254-character length boundary", async () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(93)}aaa`;
    const email = `${localPart}@${domain}`;

    expect(localPart.length).toBe(64);
    expect(domain.length).toBe(189);
    expect(email.length).toBe(254);

    const user = buildValidUser({
      email,
    });

    await expectValidDocument(user);
  });

  test("rejects an email longer than 254 characters", async () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(94)}aa`;
    const email = `${localPart}@${domain}`;

    expect(localPart.length).toBe(64);
    expect(domain.length).toBe(190);
    expect(email.length).toBe(255);

    const user = buildValidUser({
      email,
    });

    await expectValidationError(user, "email");
  });

  test.each([
    "invalid-email",
    "user@",
    "@example.com",
    "user.example.com",
    "user@example",
    "user name@example.com",
  ])("rejects malformed email: %s", async (email) => {
    const user = buildValidUser({ email });

    await expectValidationError(user, "email");
  });

  test("rejects an empty email", async () => {
    const user = buildValidUser({
      email: "",
    });

    await expectValidationError(user, "email");
  });
});

/**
 * --------------------------------------------------------------------------
 * Password
 * --------------------------------------------------------------------------
 */

describe("User model - password", () => {
  test("marks password as select:false", () => {
    const passwordPath = User.schema.path("password");

    expect(passwordPath.options.select).toBe(false);
  });

  test("rejects an empty password", async () => {
    const user = buildValidUser({
      password: "",
    });

    await expectValidationError(user, "password");
  });
});

/**
 * --------------------------------------------------------------------------
 * Avatar
 * --------------------------------------------------------------------------
 */

describe("User model - avatar", () => {
  test("accepts a valid HTTPS URL", async () => {
    const user = buildValidUser({
      avatar: "https://example.com/avatar.jpg",
    });

    await expectValidDocument(user);
  });

  test("trims surrounding whitespace", () => {
    const user = buildValidUser({
      avatar: "  https://example.com/avatar.jpg  ",
    });

    expect(user.avatar).toBe("https://example.com/avatar.jpg");
  });

  test("accepts null", async () => {
    const user = buildValidUser({
      avatar: null,
    });

    await expectValidDocument(user);
  });

  test("rejects an HTTP URL", async () => {
    const user = buildValidUser({
      avatar: "http://example.com/avatar.jpg",
    });

    await expectValidationError(user, "avatar");
  });

  test("rejects an invalid URL", async () => {
    const user = buildValidUser({
      avatar: "not-a-url",
    });

    await expectValidationError(user, "avatar");
  });
});

/**
 * --------------------------------------------------------------------------
 * Bio
 * --------------------------------------------------------------------------
 */

describe("User model - bio", () => {
  test("accepts a valid bio", async () => {
    const user = buildValidUser({
      bio: "My cooking profile.",
    });

    await expectValidDocument(user);
  });

  test("trims surrounding whitespace", () => {
    const user = buildValidUser({
      bio: "  My cooking profile  ",
    });

    expect(user.bio).toBe("My cooking profile");
  });

  test("accepts a bio with exactly 300 characters", async () => {
    const user = buildValidUser({
      bio: "a".repeat(300),
    });

    await expectValidDocument(user);
  });

  test("rejects a bio longer than 300 characters", async () => {
    const user = buildValidUser({
      bio: "a".repeat(301),
    });

    await expectValidationError(user, "bio");
  });
});

/**
 * --------------------------------------------------------------------------
 * Enum fields
 * --------------------------------------------------------------------------
 */

describe("User model - enum fields", () => {
  test.each(Object.values(USER_TITLES))(
    "accepts valid user title: %s",
    async (title) => {
      const user = buildValidUser({ title });

      await expectValidDocument(user);
    }
  );

  test("rejects an invalid user title", async () => {
    const user = buildValidUser({
      title: "__INVALID_TITLE__",
    });

    await expectValidationError(user, "title");
  });

  test.each(Object.values(USER_ROLES))(
    "accepts valid user role: %s",
    async (role) => {
      const user = buildValidUser({ role });

      await expectValidDocument(user);
    }
  );

  test("rejects an invalid user role", async () => {
    const user = buildValidUser({
      role: "__INVALID_ROLE__",
    });

    await expectValidationError(user, "role");
  });

  test.each(Object.values(ACCOUNT_STATUSES))(
    "accepts valid account status: %s",
    async (accountStatus) => {
      const user = buildValidUser({ accountStatus });

      await expectValidDocument(user);
    }
  );

  test("rejects an invalid account status", async () => {
    const user = buildValidUser({
      accountStatus: "__INVALID_STATUS__",
    });

    await expectValidationError(user, "accountStatus");
  });
});

/**
 * --------------------------------------------------------------------------
 * Social links
 * --------------------------------------------------------------------------
 */

describe("User model - social links", () => {
  test("accepts a valid Instagram URL", async () => {
    const user = buildValidUser({
      socialLinks: {
        instagram: "https://instagram.com/test",
      },
    });

    await expectValidDocument(user);
  });

  test("accepts a valid Telegram URL", async () => {
    const user = buildValidUser({
      socialLinks: {
        telegram: "https://t.me/test",
      },
    });

    await expectValidDocument(user);
  });

  test("accepts a valid X URL", async () => {
    const user = buildValidUser({
      socialLinks: {
        x: "https://x.com/test",
      },
    });

    await expectValidDocument(user);
  });

  test("rejects an HTTP Instagram URL", async () => {
    const user = buildValidUser({
      socialLinks: {
        instagram: "http://instagram.com/test",
      },
    });

    await expectValidationError(user, "socialLinks.instagram");
  });

  test("rejects an HTTP Telegram URL", async () => {
    const user = buildValidUser({
      socialLinks: {
        telegram: "http://t.me/test",
      },
    });

    await expectValidationError(user, "socialLinks.telegram");
  });

  test("rejects an HTTP X URL", async () => {
    const user = buildValidUser({
      socialLinks: {
        x: "http://x.com/test",
      },
    });

    await expectValidationError(user, "socialLinks.x");
  });

  test("rejects a non-Instagram domain", async () => {
    const user = buildValidUser({
      socialLinks: {
        instagram: "https://example.com/test",
      },
    });

    await expectValidationError(user, "socialLinks.instagram");
  });

  test("rejects a non-Telegram domain", async () => {
    const user = buildValidUser({
      socialLinks: {
        telegram: "https://example.com/test",
      },
    });

    await expectValidationError(user, "socialLinks.telegram");
  });

  test("rejects a non-X domain", async () => {
    const user = buildValidUser({
      socialLinks: {
        x: "https://example.com/test",
      },
    });

    await expectValidationError(user, "socialLinks.x");
  });
});

/**
 * --------------------------------------------------------------------------
 * sessionVersion
 * --------------------------------------------------------------------------
 */

describe("User model - sessionVersion", () => {
  test("accepts zero", async () => {
    const user = buildValidUser({
      sessionVersion: 0,
    });

    await expectValidDocument(user);
  });

  test("accepts positive safe integers", async () => {
    const user = buildValidUser({
      sessionVersion: 10,
    });

    await expectValidDocument(user);
  });

  test("accepts Number.MAX_SAFE_INTEGER", async () => {
    const user = buildValidUser({
      sessionVersion: Number.MAX_SAFE_INTEGER,
    });

    await expectValidDocument(user);
  });

  test("rejects negative values", async () => {
    const user = buildValidUser({
      sessionVersion: -1,
    });

    await expectValidationError(user, "sessionVersion");
  });

  test("rejects decimal values", async () => {
    const user = buildValidUser({
      sessionVersion: 1.5,
    });

    await expectValidationError(user, "sessionVersion");
  });

  test("rejects values outside the JavaScript safe integer range", async () => {
    const user = buildValidUser({
      sessionVersion: Number.MAX_SAFE_INTEGER + 1,
    });

    await expectValidationError(user, "sessionVersion");
  });
});

/**
 * --------------------------------------------------------------------------
 * Statistics
 * --------------------------------------------------------------------------
 */

describe("User model - statistics", () => {
  const integerStatisticFields = [
    "recipeCount",
    "totalRecipeViews",
    "ratingCount",
    "ratingSum",
  ];

  test("accepts valid counter and rating statistics", async () => {
    const user = buildValidUser({
      stats: {
        recipeCount: 10,
        totalRecipeViews: 2500,
        ratingCount: 20,
        ratingSum: 85,
        averageRating: 4.25,
      },
    });

    await expectValidDocument(user);
  });

  test.each(integerStatisticFields)(
    "accepts Number.MAX_SAFE_INTEGER for %s",
    async (field) => {
      const user = buildValidUser({
        stats: {
          [field]: Number.MAX_SAFE_INTEGER,
        },
      });

      await expectValidDocument(user);
    }
  );

  test.each(integerStatisticFields)(
    "rejects values above Number.MAX_SAFE_INTEGER for %s",
    async (field) => {
      const user = buildValidUser({
        stats: {
          [field]: Number.MAX_SAFE_INTEGER + 1,
        },
      });

      await expectValidationError(user, `stats.${field}`);
    }
  );

  test.each(integerStatisticFields)(
    "rejects decimal value for %s",
    async (field) => {
      const user = buildValidUser({
        stats: {
          [field]: 10.5,
        },
      });

      await expectValidationError(user, `stats.${field}`);
    }
  );

  test.each(integerStatisticFields)(
    "rejects negative value for %s",
    async (field) => {
      const user = buildValidUser({
        stats: {
          [field]: -1,
        },
      });

      await expectValidationError(user, `stats.${field}`);
    }
  );

  test("accepts averageRating of 0", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 0,
      },
    });

    await expectValidDocument(user);
  });

  test("accepts averageRating of 5", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 5,
      },
    });

    await expectValidDocument(user);
  });

  test("accepts averageRating of 0.01", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 0.01,
      },
    });

    await expectValidDocument(user);
  });

  test("accepts averageRating of 4.99", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 4.99,
      },
    });

    await expectValidDocument(user);
  });

  test("rejects averageRating below 0", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: -0.01,
      },
    });

    await expectValidationError(user, "stats.averageRating");
  });

  test("rejects averageRating above 5", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 5.01,
      },
    });

    await expectValidationError(user, "stats.averageRating");
  });

  test("accepts averageRating with exactly two decimal places", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 4.25,
      },
    });

    await expectValidDocument(user);
  });

  test("accepts insignificant floating-point representation error", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 0.1 + 0.2,
      },
    });

    await expectValidDocument(user);
  });

  test("rejects averageRating with more than two decimal places", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 4.123,
      },
    });

    await expectValidationError(user, "stats.averageRating");
  });

  test("rejects a value that genuinely differs from its two-decimal representation", async () => {
    const user = buildValidUser({
      stats: {
        averageRating: 2.005,
      },
    });

    await expectValidationError(user, "stats.averageRating");
  });
});

/**
 * --------------------------------------------------------------------------
 * Account lifecycle
 * --------------------------------------------------------------------------
 *
 * Cross-field lifecycle invariants are intentionally not tested here because
 * the current User model validates accountStatus and emailVerified
 * independently. Their business rules belong to the repository/service layer.
 */

describe("User model - account lifecycle", () => {
  test("accepts PENDING_VERIFICATION with emailVerified=false", async () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    await expectValidDocument(user);
  });

  test("accepts ACTIVE with emailVerified=true", async () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: true,
    });

    await expectValidDocument(user);
  });

  test("accepts SUSPENDED with emailVerified=true", async () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    await expectValidDocument(user);
  });

  test("accepts DEACTIVATED with emailVerified=true", async () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
      emailVerified: true,
    });

    await expectValidDocument(user);
  });
});

/**
 * --------------------------------------------------------------------------
 * Schema options
 * --------------------------------------------------------------------------
 */

describe("User model - schema options", () => {
  test("enables timestamps", () => {
    expect(User.schema.options.timestamps).toBe(true);
  });
});

/**
 * --------------------------------------------------------------------------
 * Index definitions
 * --------------------------------------------------------------------------
 */

describe("User model - index definitions", () => {
  test("defines a unique username index", () => {
    const index = findIndexByFields(User.schema, {
      username: 1,
    });

    expect(index).toBeDefined();
    expect(index[1]).toMatchObject({
      unique: true,
    });
  });

  test("defines a unique email index", () => {
    const index = findIndexByFields(User.schema, {
      email: 1,
    });

    expect(index).toBeDefined();
    expect(index[1]).toMatchObject({
      unique: true,
    });
  });

  test("defines the average-rating ranking index", () => {
    const index = findIndexByFields(User.schema, {
      "stats.averageRating": -1,
      _id: -1,
    });

    expect(index).toBeDefined();
  });

  test("defines the total-recipe-views ranking index", () => {
    const index = findIndexByFields(User.schema, {
      "stats.totalRecipeViews": -1,
      _id: -1,
    });

    expect(index).toBeDefined();
  });

  test("defines the chronological index", () => {
    const index = findIndexByFields(User.schema, {
      createdAt: -1,
      _id: -1,
    });

    expect(index).toBeDefined();
  });
});

/**
 * --------------------------------------------------------------------------
 * Database constraints
 * --------------------------------------------------------------------------
 */

describe("User model - database constraints", () => {
  test("rejects duplicate usernames", async () => {
    await User.create({
      username: "Cook",
      email: "first@example.com",
      password: "Password123!",
    });

    await expect(
      User.create({
        username: "Cook",
        email: "second@example.com",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  test("allows usernames that differ only by case", async () => {
    await User.create({
      username: "Cook",
      email: "first@example.com",
      password: "Password123!",
    });

    await expect(
      User.create({
        username: "cook",
        email: "second@example.com",
        password: "Password123!",
      })
    ).resolves.toBeDefined();
  });

  test("rejects duplicate emails after lowercase normalization", async () => {
    await User.create({
      username: "FirstUser",
      email: "TEST@example.com",
      password: "Password123!",
    });

    await expect(
      User.create({
        username: "SecondUser",
        email: "test@example.com",
        password: "Password123!",
      })
    ).rejects.toMatchObject({
      code: 11000,
    });
  });
});
