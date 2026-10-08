import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import User from "@/models/User";

import { ACCOUNT_STATUSES, USER_ROLES, USER_TITLES } from "@/constants/enums";

import {
  expectValidationError,
  findIndexByFields,
} from "@/tests/helpers/mongoose-test-helpers";

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

/**
 * --------------------------------------------------------------------------
 * Basic validity
 * --------------------------------------------------------------------------
 */

describe("User model - basic validity", () => {
  test("accepts a valid user document", () => {
    const user = buildValidUser();

    expect(user.validateSync()).toBeUndefined();
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
  test("requires username", () => {
    const user = buildValidUser({
      username: undefined,
    });

    expectValidationError(user, "username");
  });

  test("requires email", () => {
    const user = buildValidUser({
      email: undefined,
    });

    expectValidationError(user, "email");
  });

  test("requires password", () => {
    const user = buildValidUser({
      password: undefined,
    });

    expectValidationError(user, "password");
  });

  test("requires title when explicitly set to null", () => {
    const user = buildValidUser({
      title: null,
    });

    expectValidationError(user, "title");
  });

  test("requires role when explicitly set to null", () => {
    const user = buildValidUser({
      role: null,
    });

    expectValidationError(user, "role");
  });

  test("requires accountStatus when explicitly set to null", () => {
    const user = buildValidUser({
      accountStatus: null,
    });

    expectValidationError(user, "accountStatus");
  });

  test("requires sessionVersion when explicitly set to null", () => {
    const user = buildValidUser({
      sessionVersion: null,
    });

    expectValidationError(user, "sessionVersion");
  });
});

/**
 * --------------------------------------------------------------------------
 * Username
 * --------------------------------------------------------------------------
 */

describe("User model - username", () => {
  test("accepts a valid Latin username", () => {
    const user = buildValidUser({
      username: "CookMaster",
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts a valid Persian username", () => {
    const user = buildValidUser({
      username: "آشپز",
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts digits and underscore", () => {
    const user = buildValidUser({
      username: "Cook_123",
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts the Persian character آ", () => {
    const user = buildValidUser({
      username: "آشپزخانه",
    });

    expect(user.validateSync()).toBeUndefined();
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

  test("accepts the minimum username length of 3 characters", () => {
    const user = buildValidUser({
      username: "abc",
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects usernames shorter than 3 characters", () => {
    const user = buildValidUser({
      username: "ab",
    });

    expectValidationError(user, "username");
  });

  test("accepts the maximum username length of 30 characters", () => {
    const user = buildValidUser({
      username: "a".repeat(30),
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects usernames longer than 30 characters", () => {
    const user = buildValidUser({
      username: "a".repeat(31),
    });

    expectValidationError(user, "username");
  });

  test("rejects usernames containing spaces", () => {
    const user = buildValidUser({
      username: "Cook Master",
    });

    expectValidationError(user, "username");
  });

  test("rejects usernames containing special characters", () => {
    const user = buildValidUser({
      username: "Cook@123",
    });

    expectValidationError(user, "username");
  });

  test("rejects usernames containing hyphens", () => {
    const user = buildValidUser({
      username: "Cook-Master",
    });

    expectValidationError(user, "username");
  });
});

/**
 * --------------------------------------------------------------------------
 * Email
 * --------------------------------------------------------------------------
 */

describe("User model - email", () => {
  test("accepts a valid email", () => {
    const user = buildValidUser({
      email: "test@example.com",
    });

    expect(user.validateSync()).toBeUndefined();
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

  test("accepts an email at the schema's 254-character length boundary", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(93)}aaa`;
    const email = `${localPart}@${domain}`;

    expect(localPart.length).toBe(64);
    expect(domain.length).toBe(189);
    expect(email.length).toBe(254);

    const user = buildValidUser({
      email,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects an email longer than 254 characters", () => {
    const localPart = "a".repeat(64);
    const domain = `${"a.".repeat(94)}aa`;
    const email = `${localPart}@${domain}`;

    expect(localPart.length).toBe(64);
    expect(domain.length).toBe(190);
    expect(email.length).toBe(255);

    const user = buildValidUser({
      email,
    });

    expectValidationError(user, "email");
  });

  test.each([
    "invalid-email",
    "user@",
    "@example.com",
    "user.example.com",
    "user@example",
    "user name@example.com",
  ])("rejects malformed email: %s", (email) => {
    const user = buildValidUser({ email });

    expectValidationError(user, "email");
  });

  test("rejects an empty email", () => {
    const user = buildValidUser({
      email: "",
    });

    expectValidationError(user, "email");
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

  test("rejects an empty password", () => {
    const user = buildValidUser({
      password: "",
    });

    expectValidationError(user, "password");
  });
});

/**
 * --------------------------------------------------------------------------
 * Avatar
 * --------------------------------------------------------------------------
 */

describe("User model - avatar", () => {
  test("accepts a valid HTTPS URL", () => {
    const user = buildValidUser({
      avatar: "https://example.com/avatar.jpg",
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("trims surrounding whitespace", () => {
    const user = buildValidUser({
      avatar: "  https://example.com/avatar.jpg  ",
    });

    expect(user.avatar).toBe("https://example.com/avatar.jpg");
  });

  test("accepts null", () => {
    const user = buildValidUser({
      avatar: null,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects an HTTP URL", () => {
    const user = buildValidUser({
      avatar: "http://example.com/avatar.jpg",
    });

    expectValidationError(user, "avatar");
  });

  test("rejects an invalid URL", () => {
    const user = buildValidUser({
      avatar: "not-a-url",
    });

    expectValidationError(user, "avatar");
  });
});

/**
 * --------------------------------------------------------------------------
 * Bio
 * --------------------------------------------------------------------------
 */

describe("User model - bio", () => {
  test("accepts a valid bio", () => {
    const user = buildValidUser({
      bio: "My cooking profile.",
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("trims surrounding whitespace", () => {
    const user = buildValidUser({
      bio: "  My cooking profile  ",
    });

    expect(user.bio).toBe("My cooking profile");
  });

  test("accepts a bio with exactly 300 characters", () => {
    const user = buildValidUser({
      bio: "a".repeat(300),
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects a bio longer than 300 characters", () => {
    const user = buildValidUser({
      bio: "a".repeat(301),
    });

    expectValidationError(user, "bio");
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
    (title) => {
      const user = buildValidUser({ title });

      expect(user.validateSync()).toBeUndefined();
    }
  );

  test("rejects an invalid user title", () => {
    const user = buildValidUser({
      title: "__INVALID_TITLE__",
    });

    expectValidationError(user, "title");
  });

  test.each(Object.values(USER_ROLES))(
    "accepts valid user role: %s",
    (role) => {
      const user = buildValidUser({ role });

      expect(user.validateSync()).toBeUndefined();
    }
  );

  test("rejects an invalid user role", () => {
    const user = buildValidUser({
      role: "__INVALID_ROLE__",
    });

    expectValidationError(user, "role");
  });

  test.each(Object.values(ACCOUNT_STATUSES))(
    "accepts valid account status: %s",
    (accountStatus) => {
      const user = buildValidUser({ accountStatus });

      expect(user.validateSync()).toBeUndefined();
    }
  );

  test("rejects an invalid account status", () => {
    const user = buildValidUser({
      accountStatus: "__INVALID_STATUS__",
    });

    expectValidationError(user, "accountStatus");
  });
});

/**
 * --------------------------------------------------------------------------
 * Social links
 * --------------------------------------------------------------------------
 */

describe("User model - social links", () => {
  test("accepts a valid Instagram URL", () => {
    const user = buildValidUser({
      socialLinks: {
        instagram: "https://instagram.com/test",
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts a valid Telegram URL", () => {
    const user = buildValidUser({
      socialLinks: {
        telegram: "https://t.me/test",
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts a valid X URL", () => {
    const user = buildValidUser({
      socialLinks: {
        x: "https://x.com/test",
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects an HTTP Instagram URL", () => {
    const user = buildValidUser({
      socialLinks: {
        instagram: "http://instagram.com/test",
      },
    });

    expectValidationError(user, "socialLinks.instagram");
  });

  test("rejects an HTTP Telegram URL", () => {
    const user = buildValidUser({
      socialLinks: {
        telegram: "http://t.me/test",
      },
    });

    expectValidationError(user, "socialLinks.telegram");
  });

  test("rejects an HTTP X URL", () => {
    const user = buildValidUser({
      socialLinks: {
        x: "http://x.com/test",
      },
    });

    expectValidationError(user, "socialLinks.x");
  });

  test("rejects a non-Instagram domain", () => {
    const user = buildValidUser({
      socialLinks: {
        instagram: "https://example.com/test",
      },
    });

    expectValidationError(user, "socialLinks.instagram");
  });

  test("rejects a non-Telegram domain", () => {
    const user = buildValidUser({
      socialLinks: {
        telegram: "https://example.com/test",
      },
    });

    expectValidationError(user, "socialLinks.telegram");
  });

  test("rejects a non-X domain", () => {
    const user = buildValidUser({
      socialLinks: {
        x: "https://example.com/test",
      },
    });

    expectValidationError(user, "socialLinks.x");
  });
});

/**
 * --------------------------------------------------------------------------
 * sessionVersion
 * --------------------------------------------------------------------------
 */

describe("User model - sessionVersion", () => {
  test("accepts zero", () => {
    const user = buildValidUser({
      sessionVersion: 0,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts positive safe integers", () => {
    const user = buildValidUser({
      sessionVersion: 10,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts Number.MAX_SAFE_INTEGER", () => {
    const user = buildValidUser({
      sessionVersion: Number.MAX_SAFE_INTEGER,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects negative values", () => {
    const user = buildValidUser({
      sessionVersion: -1,
    });

    expectValidationError(user, "sessionVersion");
  });

  test("rejects decimal values", () => {
    const user = buildValidUser({
      sessionVersion: 1.5,
    });

    expectValidationError(user, "sessionVersion");
  });

  test("rejects values outside the JavaScript safe integer range", () => {
    const user = buildValidUser({
      sessionVersion: Number.MAX_SAFE_INTEGER + 1,
    });

    expectValidationError(user, "sessionVersion");
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

  test("accepts valid counter and rating statistics", () => {
    const user = buildValidUser({
      stats: {
        recipeCount: 10,
        totalRecipeViews: 2500,
        ratingCount: 20,
        ratingSum: 85,
        averageRating: 4.25,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test.each(integerStatisticFields)(
    "accepts Number.MAX_SAFE_INTEGER for %s",
    (field) => {
      const user = buildValidUser({
        stats: {
          [field]: Number.MAX_SAFE_INTEGER,
        },
      });

      expect(user.validateSync()).toBeUndefined();
    }
  );

  test.each(integerStatisticFields)(
    "rejects values above Number.MAX_SAFE_INTEGER for %s",
    (field) => {
      const user = buildValidUser({
        stats: {
          [field]: Number.MAX_SAFE_INTEGER + 1,
        },
      });

      expectValidationError(user, `stats.${field}`);
    }
  );

  test.each(integerStatisticFields)("rejects decimal value for %s", (field) => {
    const user = buildValidUser({
      stats: {
        [field]: 10.5,
      },
    });

    expectValidationError(user, `stats.${field}`);
  });

  test.each(integerStatisticFields)(
    "rejects negative value for %s",
    (field) => {
      const user = buildValidUser({
        stats: {
          [field]: -1,
        },
      });

      expectValidationError(user, `stats.${field}`);
    }
  );

  test("accepts averageRating of 0", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 0,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts averageRating of 5", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 5,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts averageRating of 0.01", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 0.01,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts averageRating of 4.99", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 4.99,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects averageRating below 0", () => {
    const user = buildValidUser({
      stats: {
        averageRating: -0.01,
      },
    });

    expectValidationError(user, "stats.averageRating");
  });

  test("rejects averageRating above 5", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 5.01,
      },
    });

    expectValidationError(user, "stats.averageRating");
  });

  test("accepts averageRating with exactly two decimal places", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 4.25,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts insignificant floating-point representation error", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 0.1 + 0.2,
      },
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("rejects averageRating with more than two decimal places", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 4.123,
      },
    });

    expectValidationError(user, "stats.averageRating");
  });

  test("rejects a value that genuinely differs from its two-decimal representation", () => {
    const user = buildValidUser({
      stats: {
        averageRating: 2.005,
      },
    });

    expectValidationError(user, "stats.averageRating");
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
  test("accepts PENDING_VERIFICATION with emailVerified=false", () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.PENDING_VERIFICATION,
      emailVerified: false,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts ACTIVE with emailVerified=true", () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: true,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts SUSPENDED with emailVerified=true", () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.SUSPENDED,
      emailVerified: true,
    });

    expect(user.validateSync()).toBeUndefined();
  });

  test("accepts DEACTIVATED with emailVerified=true", () => {
    const user = buildValidUser({
      accountStatus: ACCOUNT_STATUSES.DEACTIVATED,
      emailVerified: true,
    });

    expect(user.validateSync()).toBeUndefined();
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
