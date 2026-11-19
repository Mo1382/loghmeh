import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module is server-only in Next.js. Mock the marker so the environment
// configuration can be tested in Vitest's Node environment.
vi.mock("server-only", () => ({}));

// ============================================================================
// Environment Variables
// ============================================================================

const SERVER_ENV_KEYS = [
  "AUTH_SECRET",
  "PASSWORD_RESET_TOKEN_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

const RATE_LIMIT_HASH_ENV_KEYS = ["RATE_LIMIT_HASH_SECRET"];

const UPSTASH_REDIS_ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
];

const VALID_SERVER_ENV = {
  AUTH_SECRET: "a".repeat(32),
  PASSWORD_RESET_TOKEN_SECRET: Buffer.alloc(32, 0x42).toString("base64url"),
  RESEND_API_KEY: "re_test_valid_key",
  RESEND_FROM_EMAIL: "no-reply@example.com",
};

const VALID_RATE_LIMIT_HASH_ENV = {
  RATE_LIMIT_HASH_SECRET: "h".repeat(32),
};

const VALID_UPSTASH_REDIS_ENV = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test_upstash_token",
};

// ============================================================================
// Environment Setup Helpers
// ============================================================================

function setValidServerEnvironment(overrides = {}) {
  for (const [key, value] of Object.entries({
    ...VALID_SERVER_ENV,
    ...overrides,
  })) {
    vi.stubEnv(key, value);
  }
}

function setValidRateLimitHashEnvironment(overrides = {}) {
  for (const [key, value] of Object.entries({
    ...VALID_RATE_LIMIT_HASH_ENV,
    ...overrides,
  })) {
    vi.stubEnv(key, value);
  }
}

function setValidUpstashRedisEnvironment(overrides = {}) {
  for (const [key, value] of Object.entries({
    ...VALID_UPSTASH_REDIS_ENV,
    ...overrides,
  })) {
    vi.stubEnv(key, value);
  }
}

async function loadEnvModule() {
  return import("@/lib/config/env");
}

// ============================================================================
// Test Lifecycle
// ============================================================================

beforeEach(() => {
  // Reset the module registry so each test starts with fresh environment caches.
  vi.resetModules();

  setValidServerEnvironment();
  setValidRateLimitHashEnvironment();
  setValidUpstashRedisEnvironment();
});

afterEach(() => {
  // Restore all environment variables to their original values.
  vi.unstubAllEnvs();
});

// ============================================================================
// Server Environment Validation
// ============================================================================

describe("validateServerEnv", () => {
  it("returns all validated server environment variables", async () => {
    const { validateServerEnv } = await loadEnvModule();

    expect(validateServerEnv()).toEqual(VALID_SERVER_ENV);
  });

  it.each(SERVER_ENV_KEYS)("rejects a missing %s", async (variable) => {
    delete process.env[variable];

    const { validateServerEnv } = await loadEnvModule();

    expect(() => validateServerEnv()).toThrow(
      `Invalid server environment configuration: ${variable}`
    );
  });

  describe("AUTH_SECRET", () => {
    it("rejects values shorter than 32 characters", async () => {
      process.env.AUTH_SECRET = "a".repeat(31);

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/AUTH_SECRET/);
    });

    it("accepts a value that is exactly 256 characters long", async () => {
      process.env.AUTH_SECRET = "a".repeat(256);

      const { validateServerEnv } = await loadEnvModule();

      expect(validateServerEnv().AUTH_SECRET).toHaveLength(256);
    });

    it("rejects values longer than 256 characters", async () => {
      process.env.AUTH_SECRET = "a".repeat(257);

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/AUTH_SECRET/);
    });

    it.each(["leading", "trailing"])(
      "rejects %s surrounding whitespace",
      async (position) => {
        const secret = "a".repeat(32);

        process.env.AUTH_SECRET =
          position === "leading" ? ` ${secret}` : `${secret} `;

        const { validateServerEnv } = await loadEnvModule();

        expect(() => validateServerEnv()).toThrow(/AUTH_SECRET/);
      }
    );
  });

  describe("PASSWORD_RESET_TOKEN_SECRET", () => {
    it("accepts a canonical Base64URL key that decodes to exactly 32 bytes", async () => {
      const secret = Buffer.alloc(32, 0x42).toString("base64url");

      process.env.PASSWORD_RESET_TOKEN_SECRET = secret;

      const { validateServerEnv } = await loadEnvModule();

      expect(validateServerEnv().PASSWORD_RESET_TOKEN_SECRET).toBe(secret);
      expect(Buffer.from(secret, "base64url")).toHaveLength(32);
    });

    it("rejects a key with an incorrect encoded length", async () => {
      process.env.PASSWORD_RESET_TOKEN_SECRET =
        VALID_SERVER_ENV.PASSWORD_RESET_TOKEN_SECRET.slice(1);

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/PASSWORD_RESET_TOKEN_SECRET/);
    });

    it("rejects characters outside the Base64URL alphabet", async () => {
      process.env.PASSWORD_RESET_TOKEN_SECRET = `.${VALID_SERVER_ENV.PASSWORD_RESET_TOKEN_SECRET.slice(1)}`;

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/PASSWORD_RESET_TOKEN_SECRET/);
    });

    // The final Base64URL character contains unused padding bits.
    // Changing one of these bits preserves the decoded bytes but
    // produces a non-canonical representation.
    it("rejects a non-canonical Base64URL representation", async () => {
      const canonicalSecret = Buffer.alloc(32).toString("base64url");

      const nonCanonicalSecret = `${canonicalSecret.slice(0, -1)}B`;

      expect(
        Buffer.from(nonCanonicalSecret, "base64url").equals(
          Buffer.from(canonicalSecret, "base64url")
        )
      ).toBe(true);

      process.env.PASSWORD_RESET_TOKEN_SECRET = nonCanonicalSecret;

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/PASSWORD_RESET_TOKEN_SECRET/);
    });
  });

  describe("RESEND_API_KEY", () => {
    it("rejects an empty API key", async () => {
      process.env.RESEND_API_KEY = "";

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/RESEND_API_KEY/);
    });

    it("accepts a value that is exactly 256 characters long", async () => {
      process.env.RESEND_API_KEY = "r".repeat(256);

      const { validateServerEnv } = await loadEnvModule();

      expect(validateServerEnv().RESEND_API_KEY).toHaveLength(256);
    });

    it("rejects an API key longer than 256 characters", async () => {
      process.env.RESEND_API_KEY = "r".repeat(257);

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/RESEND_API_KEY/);
    });

    it.each(["leading", "trailing"])(
      "rejects %s surrounding whitespace",
      async (position) => {
        const apiKey = "re_test_valid_key";

        process.env.RESEND_API_KEY =
          position === "leading" ? ` ${apiKey}` : `${apiKey} `;

        const { validateServerEnv } = await loadEnvModule();

        expect(() => validateServerEnv()).toThrow(/RESEND_API_KEY/);
      }
    );
  });

  describe("RESEND_FROM_EMAIL", () => {
    it("accepts a valid sender email address", async () => {
      process.env.RESEND_FROM_EMAIL = "no-reply@example.com";

      const { validateServerEnv } = await loadEnvModule();

      expect(validateServerEnv().RESEND_FROM_EMAIL).toBe(
        "no-reply@example.com"
      );
    });

    it("accepts a sender email address that is exactly 254 characters long", async () => {
      const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(57)}`;
      const email = `user@${domain}`;

      expect(email).toHaveLength(254);

      process.env.RESEND_FROM_EMAIL = email;

      const { validateServerEnv } = await loadEnvModule();

      expect(validateServerEnv().RESEND_FROM_EMAIL).toBe(email);
    });

    it("rejects email addresses longer than 254 characters", async () => {
      const domain = `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}`;
      const email = `user@${domain}`;

      expect(email).toHaveLength(255);

      process.env.RESEND_FROM_EMAIL = email;

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/RESEND_FROM_EMAIL/);
    });

    it.each(["not-an-email", "user@example", "user@@example.com"])(
      "rejects an invalid email address: %s",
      async (email) => {
        process.env.RESEND_FROM_EMAIL = email;

        const { validateServerEnv } = await loadEnvModule();

        expect(() => validateServerEnv()).toThrow(/RESEND_FROM_EMAIL/);
      }
    );

    it.each(["leading", "trailing"])(
      "rejects %s surrounding whitespace",
      async (position) => {
        const email = "no-reply@example.com";

        process.env.RESEND_FROM_EMAIL =
          position === "leading" ? ` ${email}` : `${email} `;

        const { validateServerEnv } = await loadEnvModule();

        expect(() => validateServerEnv()).toThrow(/RESEND_FROM_EMAIL/);
      }
    );
  });

  it("reports invalid variable names without exposing their values", async () => {
    const sensitiveAuthSecret = "sensitive-auth-secret-value";
    const sensitivePasswordResetTokenSecret =
      "sensitive-password-reset-token-secret";
    const sensitiveResendApiKey = "sensitive-resend-api-key";

    process.env.AUTH_SECRET = ` ${sensitiveAuthSecret} `;
    process.env.PASSWORD_RESET_TOKEN_SECRET = ` ${sensitivePasswordResetTokenSecret} `;
    process.env.RESEND_API_KEY = ` ${sensitiveResendApiKey} `;

    const { validateServerEnv } = await loadEnvModule();

    let thrownError;

    try {
      validateServerEnv();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);

    expect(thrownError.message).toBe(
      "Invalid server environment configuration: AUTH_SECRET, PASSWORD_RESET_TOKEN_SECRET, RESEND_API_KEY"
    );

    expect(thrownError.message).not.toContain(sensitiveAuthSecret);
    expect(thrownError.message).not.toContain(
      sensitivePasswordResetTokenSecret
    );
    expect(thrownError.message).not.toContain(sensitiveResendApiKey);
  });
});

// ============================================================================
// Rate Limit Hash Environment Validation
// ============================================================================

describe("validateRateLimitHashEnv", () => {
  it("returns all validated Rate Limit Hash environment variables", async () => {
    const { validateRateLimitHashEnv } = await loadEnvModule();

    expect(validateRateLimitHashEnv()).toEqual(VALID_RATE_LIMIT_HASH_ENV);
  });

  it.each(RATE_LIMIT_HASH_ENV_KEYS)(
    "rejects a missing %s",
    async (variable) => {
      delete process.env[variable];

      const { validateRateLimitHashEnv } = await loadEnvModule();

      expect(() => validateRateLimitHashEnv()).toThrow(
        `Invalid Rate Limit Hash environment configuration: ${variable}`
      );
    }
  );

  describe("RATE_LIMIT_HASH_SECRET", () => {
    it("rejects a secret shorter than 32 bytes", async () => {
      process.env.RATE_LIMIT_HASH_SECRET = "h".repeat(31);

      const { validateRateLimitHashEnv } = await loadEnvModule();

      expect(() => validateRateLimitHashEnv()).toThrow(
        /RATE_LIMIT_HASH_SECRET/
      );
    });

    it("accepts a secret that contains exactly 32 bytes", async () => {
      const secret = "h".repeat(32);

      process.env.RATE_LIMIT_HASH_SECRET = secret;

      const { validateRateLimitHashEnv } = await loadEnvModule();

      expect(validateRateLimitHashEnv().RATE_LIMIT_HASH_SECRET).toBe(secret);
      expect(Buffer.byteLength(secret, "utf8")).toBe(32);
    });

    it("validates the secret length using UTF-8 bytes rather than character count", async () => {
      const secret = "é".repeat(16);

      expect(secret).toHaveLength(16);
      expect(Buffer.byteLength(secret, "utf8")).toBe(32);

      process.env.RATE_LIMIT_HASH_SECRET = secret;

      const { validateRateLimitHashEnv } = await loadEnvModule();

      expect(validateRateLimitHashEnv().RATE_LIMIT_HASH_SECRET).toBe(secret);
    });

    it("rejects a multi-byte secret containing fewer than 32 UTF-8 bytes", async () => {
      const secret = "é".repeat(15);

      expect(Buffer.byteLength(secret, "utf8")).toBe(30);

      process.env.RATE_LIMIT_HASH_SECRET = secret;

      const { validateRateLimitHashEnv } = await loadEnvModule();

      expect(() => validateRateLimitHashEnv()).toThrow(
        /RATE_LIMIT_HASH_SECRET/
      );
    });

    it.each(["leading", "trailing"])(
      "rejects %s surrounding whitespace",
      async (position) => {
        const secret = "h".repeat(32);

        process.env.RATE_LIMIT_HASH_SECRET =
          position === "leading" ? ` ${secret}` : `${secret} `;

        const { validateRateLimitHashEnv } = await loadEnvModule();

        expect(() => validateRateLimitHashEnv()).toThrow(
          /RATE_LIMIT_HASH_SECRET/
        );
      }
    );
  });

  it("does not expose the secret value in validation errors", async () => {
    const sensitiveSecret = "sensitive-rate-limit-hash-secret";

    process.env.RATE_LIMIT_HASH_SECRET = ` ${sensitiveSecret} `;

    const { validateRateLimitHashEnv } = await loadEnvModule();

    let thrownError;

    try {
      validateRateLimitHashEnv();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);

    expect(thrownError.message).toBe(
      "Invalid Rate Limit Hash environment configuration: RATE_LIMIT_HASH_SECRET"
    );

    expect(thrownError.message).not.toContain(sensitiveSecret);
  });
});

// ============================================================================
// Upstash Redis Environment Validation
// ============================================================================

describe("validateUpstashRedisEnv", () => {
  it("returns all validated Upstash Redis environment variables", async () => {
    const { validateUpstashRedisEnv } = await loadEnvModule();

    expect(validateUpstashRedisEnv()).toEqual(VALID_UPSTASH_REDIS_ENV);
  });

  it.each(UPSTASH_REDIS_ENV_KEYS)("rejects a missing %s", async (variable) => {
    delete process.env[variable];

    const { validateUpstashRedisEnv } = await loadEnvModule();

    expect(() => validateUpstashRedisEnv()).toThrow(
      `Invalid Upstash Redis environment configuration: ${variable}`
    );
  });

  describe("UPSTASH_REDIS_REST_URL", () => {
    it("accepts a valid HTTPS URL", async () => {
      const { validateUpstashRedisEnv } = await loadEnvModule();

      expect(validateUpstashRedisEnv().UPSTASH_REDIS_REST_URL).toBe(
        VALID_UPSTASH_REDIS_ENV.UPSTASH_REDIS_REST_URL
      );
    });

    it.each([
      "http://example.upstash.io",
      "ftp://example.upstash.io",
      "not-a-valid-url",
    ])("rejects an invalid or non-HTTPS URL: %s", async (url) => {
      process.env.UPSTASH_REDIS_REST_URL = url;

      const { validateUpstashRedisEnv } = await loadEnvModule();

      expect(() => validateUpstashRedisEnv()).toThrow(/UPSTASH_REDIS_REST_URL/);
    });

    it.each(["leading", "trailing"])(
      "rejects %s surrounding whitespace",
      async (position) => {
        const url = "https://example.upstash.io";

        process.env.UPSTASH_REDIS_REST_URL =
          position === "leading" ? ` ${url}` : `${url} `;

        const { validateUpstashRedisEnv } = await loadEnvModule();

        expect(() => validateUpstashRedisEnv()).toThrow(
          /UPSTASH_REDIS_REST_URL/
        );
      }
    );
  });

  describe("UPSTASH_REDIS_REST_TOKEN", () => {
    it("accepts a non-empty token", async () => {
      const { validateUpstashRedisEnv } = await loadEnvModule();

      expect(validateUpstashRedisEnv().UPSTASH_REDIS_REST_TOKEN).toBe(
        VALID_UPSTASH_REDIS_ENV.UPSTASH_REDIS_REST_TOKEN
      );
    });

    it("rejects an empty token", async () => {
      process.env.UPSTASH_REDIS_REST_TOKEN = "";

      const { validateUpstashRedisEnv } = await loadEnvModule();

      expect(() => validateUpstashRedisEnv()).toThrow(
        /UPSTASH_REDIS_REST_TOKEN/
      );
    });

    it("rejects a whitespace-only token", async () => {
      process.env.UPSTASH_REDIS_REST_TOKEN = "   ";

      const { validateUpstashRedisEnv } = await loadEnvModule();

      expect(() => validateUpstashRedisEnv()).toThrow(
        /UPSTASH_REDIS_REST_TOKEN/
      );
    });

    it.each(["leading", "trailing"])(
      "rejects %s surrounding whitespace",
      async (position) => {
        const token = "test_upstash_token";

        process.env.UPSTASH_REDIS_REST_TOKEN =
          position === "leading" ? ` ${token}` : `${token} `;

        const { validateUpstashRedisEnv } = await loadEnvModule();

        expect(() => validateUpstashRedisEnv()).toThrow(
          /UPSTASH_REDIS_REST_TOKEN/
        );
      }
    );
  });

  it("reports invalid variable names without exposing their values", async () => {
    const sensitiveUrl = "sensitive-upstash-url";
    const sensitiveToken = "sensitive-upstash-token";

    process.env.UPSTASH_REDIS_REST_URL = sensitiveUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = ` ${sensitiveToken} `;

    const { validateUpstashRedisEnv } = await loadEnvModule();

    let thrownError;

    try {
      validateUpstashRedisEnv();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(Error);

    expect(thrownError.message).toBe(
      "Invalid Upstash Redis environment configuration: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN"
    );

    expect(thrownError.message).not.toContain(sensitiveUrl);
    expect(thrownError.message).not.toContain(sensitiveToken);
  });
});

// ============================================================================
// Environment Configuration Independence
// ============================================================================

describe("environment configuration independence", () => {
  // --------------------------------------------------------------------------
  // Validation Functions
  // --------------------------------------------------------------------------

  it("validates server environment without requiring Rate Limit or Upstash variables", async () => {
    for (const variable of [
      ...RATE_LIMIT_HASH_ENV_KEYS,
      ...UPSTASH_REDIS_ENV_KEYS,
    ]) {
      delete process.env[variable];
    }

    const { validateServerEnv } = await loadEnvModule();

    expect(validateServerEnv()).toEqual(VALID_SERVER_ENV);
  });

  it("validates Rate Limit Hash environment without requiring server or Upstash variables", async () => {
    for (const variable of [...SERVER_ENV_KEYS, ...UPSTASH_REDIS_ENV_KEYS]) {
      delete process.env[variable];
    }

    const { validateRateLimitHashEnv } = await loadEnvModule();

    expect(validateRateLimitHashEnv()).toEqual(VALID_RATE_LIMIT_HASH_ENV);
  });

  it("validates Upstash Redis environment without requiring server or Rate Limit Hash variables", async () => {
    for (const variable of [...SERVER_ENV_KEYS, ...RATE_LIMIT_HASH_ENV_KEYS]) {
      delete process.env[variable];
    }

    const { validateUpstashRedisEnv } = await loadEnvModule();

    expect(validateUpstashRedisEnv()).toEqual(VALID_UPSTASH_REDIS_ENV);
  });

  // --------------------------------------------------------------------------
  // Getter Functions
  // --------------------------------------------------------------------------

  it("getServerEnv does not require Rate Limit or Upstash variables", async () => {
    for (const variable of [
      ...RATE_LIMIT_HASH_ENV_KEYS,
      ...UPSTASH_REDIS_ENV_KEYS,
    ]) {
      delete process.env[variable];
    }

    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv()).toEqual(VALID_SERVER_ENV);
  });

  it("getRateLimitHashEnv does not require server or Upstash variables", async () => {
    for (const variable of [...SERVER_ENV_KEYS, ...UPSTASH_REDIS_ENV_KEYS]) {
      delete process.env[variable];
    }

    const { getRateLimitHashEnv } = await loadEnvModule();

    expect(getRateLimitHashEnv()).toEqual(VALID_RATE_LIMIT_HASH_ENV);
  });

  it("getUpstashRedisEnv does not require server or Rate Limit variables", async () => {
    for (const variable of [...SERVER_ENV_KEYS, ...RATE_LIMIT_HASH_ENV_KEYS]) {
      delete process.env[variable];
    }

    const { getUpstashRedisEnv } = await loadEnvModule();

    expect(getUpstashRedisEnv()).toEqual(VALID_UPSTASH_REDIS_ENV);
  });

  it("maintains independent caches for all three environment configurations", async () => {
    const envModule = await loadEnvModule();

    // Initialize all three independent caches.
    const serverSnapshot = envModule.getServerEnv();
    const rateLimitHashSnapshot = envModule.getRateLimitHashEnv();
    const upstashRedisSnapshot = envModule.getUpstashRedisEnv();

    expect(serverSnapshot).toEqual(VALID_SERVER_ENV);
    expect(rateLimitHashSnapshot).toEqual(VALID_RATE_LIMIT_HASH_ENV);
    expect(upstashRedisSnapshot).toEqual(VALID_UPSTASH_REDIS_ENV);

    // Revalidate Rate Limit Hash configuration.
    const updatedRateLimitHashSecret = "r".repeat(32);

    process.env.RATE_LIMIT_HASH_SECRET = updatedRateLimitHashSecret;

    const updatedRateLimitHashSnapshot = envModule.validateRateLimitHashEnv();

    expect(envModule.getRateLimitHashEnv()).toBe(updatedRateLimitHashSnapshot);
    expect(envModule.getServerEnv()).toBe(serverSnapshot);
    expect(envModule.getUpstashRedisEnv()).toBe(upstashRedisSnapshot);

    // Revalidate Upstash Redis configuration.
    const updatedRedisUrl = "https://updated-example.upstash.io";

    process.env.UPSTASH_REDIS_REST_URL = updatedRedisUrl;

    const updatedUpstashRedisSnapshot = envModule.validateUpstashRedisEnv();

    expect(envModule.getUpstashRedisEnv()).toBe(updatedUpstashRedisSnapshot);
    expect(envModule.getServerEnv()).toBe(serverSnapshot);
    expect(envModule.getRateLimitHashEnv()).toBe(updatedRateLimitHashSnapshot);

    // Revalidate Server configuration.
    const updatedAuthSecret = "b".repeat(32);

    process.env.AUTH_SECRET = updatedAuthSecret;

    const updatedServerSnapshot = envModule.validateServerEnv();

    expect(envModule.getServerEnv()).toBe(updatedServerSnapshot);
    expect(envModule.getRateLimitHashEnv()).toBe(updatedRateLimitHashSnapshot);
    expect(envModule.getUpstashRedisEnv()).toBe(updatedUpstashRedisSnapshot);
  });
});

// ============================================================================
// Shared Environment Getter Tests
// ============================================================================

function describeEnvironmentGetter({
  getterName,
  validatorName,
  environmentKey,
  validValue,
  changedValue,
  invalidValue,
  expectedConfig,
  environmentLabel,
}) {
  describe(getterName, () => {
    const expectedError = `Invalid ${environmentLabel} environment configuration: ${environmentKey}`;

    it("validates lazily on the first access", async () => {
      delete process.env[environmentKey];

      const envModule = await loadEnvModule();
      const getEnv = envModule[getterName];

      expect(getEnv).toBeTypeOf("function");

      expect(() => getEnv()).toThrow(expectedError);
    });

    it("retries validation after the environment is corrected", async () => {
      delete process.env[environmentKey];

      const envModule = await loadEnvModule();
      const getEnv = envModule[getterName];

      expect(() => getEnv()).toThrow(expectedError);

      process.env[environmentKey] = validValue;

      expect(getEnv()).toEqual(expectedConfig);
    });

    it("returns the cached configuration on subsequent calls", async () => {
      const envModule = await loadEnvModule();
      const getEnv = envModule[getterName];

      const firstResult = getEnv();

      process.env[environmentKey] = changedValue;

      const secondResult = getEnv();

      expect(secondResult).toBe(firstResult);
      expect(secondResult[environmentKey]).toBe(validValue);
    });

    it("returns an immutable configuration object", async () => {
      const envModule = await loadEnvModule();
      const getEnv = envModule[getterName];

      const env = getEnv();

      expect(Object.isFrozen(env)).toBe(true);
      expect(Reflect.set(env, environmentKey, "modified-value")).toBe(false);
      expect(env[environmentKey]).toBe(validValue);
    });

    it(`uses a newly validated snapshot when ${validatorName} is called again`, async () => {
      const envModule = await loadEnvModule();

      const getEnv = envModule[getterName];
      const validateEnv = envModule[validatorName];

      const firstResult = getEnv();

      process.env[environmentKey] = changedValue;

      const secondResult = validateEnv();

      const expectedUpdatedConfig = {
        ...expectedConfig,
        [environmentKey]: changedValue,
      };

      expect(secondResult).not.toBe(firstResult);
      expect(secondResult).toEqual(expectedUpdatedConfig);
      expect(getEnv()).toBe(secondResult);
    });

    it("does not return a previously cached configuration after revalidation fails", async () => {
      const envModule = await loadEnvModule();

      const getEnv = envModule[getterName];
      const validateEnv = envModule[validatorName];

      const firstResult = getEnv();

      expect(firstResult[environmentKey]).toBe(validValue);

      process.env[environmentKey] = invalidValue;

      expect(() => validateEnv()).toThrow(expectedError);
      expect(() => getEnv()).toThrow(expectedError);
    });
  });
}

// ============================================================================
// Server Environment Getter
// ============================================================================

describeEnvironmentGetter({
  getterName: "getServerEnv",
  validatorName: "validateServerEnv",
  environmentKey: "AUTH_SECRET",
  validValue: VALID_SERVER_ENV.AUTH_SECRET,
  changedValue: "b".repeat(32),
  invalidValue: "short",
  expectedConfig: VALID_SERVER_ENV,
  environmentLabel: "server",
});

// ============================================================================
// Rate Limit Hash Environment Getter
// ============================================================================

describeEnvironmentGetter({
  getterName: "getRateLimitHashEnv",
  validatorName: "validateRateLimitHashEnv",
  environmentKey: "RATE_LIMIT_HASH_SECRET",
  validValue: VALID_RATE_LIMIT_HASH_ENV.RATE_LIMIT_HASH_SECRET,
  changedValue: "r".repeat(32),
  invalidValue: "short",
  expectedConfig: VALID_RATE_LIMIT_HASH_ENV,
  environmentLabel: "Rate Limit Hash",
});

// ============================================================================
// Upstash Redis Environment Getter
// ============================================================================

describeEnvironmentGetter({
  getterName: "getUpstashRedisEnv",
  validatorName: "validateUpstashRedisEnv",
  environmentKey: "UPSTASH_REDIS_REST_URL",
  validValue: VALID_UPSTASH_REDIS_ENV.UPSTASH_REDIS_REST_URL,
  changedValue: "https://updated-example.upstash.io",
  invalidValue: "http://example.upstash.io",
  expectedConfig: VALID_UPSTASH_REDIS_ENV,
  environmentLabel: "Upstash Redis",
});

describe("getUpstashRedisEnv additional validation", () => {
  it("rejects a missing Redis token on the first access", async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { getUpstashRedisEnv } = await loadEnvModule();

    expect(() => getUpstashRedisEnv()).toThrow(
      "Invalid Upstash Redis environment configuration: UPSTASH_REDIS_REST_TOKEN"
    );
  });
});
