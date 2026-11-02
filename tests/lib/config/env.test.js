import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The module is server-only in Next.js. Mock the marker so the environment
// configuration can be tested in Vitest's Node environment.
vi.mock("server-only", () => ({}));

const ENV_KEYS = [
  "AUTH_SECRET",
  "PASSWORD_RESET_TOKEN_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

const VALID_ENV = {
  AUTH_SECRET: "a".repeat(32),
  PASSWORD_RESET_TOKEN_SECRET: Buffer.alloc(32, 0x42).toString("base64url"),
  RESEND_API_KEY: "re_test_valid_key",
  RESEND_FROM_EMAIL: "no-reply@example.com",
};

function setValidEnvironment(overrides = {}) {
  for (const [key, value] of Object.entries({
    ...VALID_ENV,
    ...overrides,
  })) {
    vi.stubEnv(key, value);
  }
}

async function loadEnvModule() {
  return import("@/lib/config/env");
}

beforeEach(() => {
  // Reset the module registry so each test starts with a fresh validatedEnv cache.
  vi.resetModules();

  setValidEnvironment();
});

afterEach(() => {
  // Restore all environment variables to their original values.
  vi.unstubAllEnvs();
});

describe("validateServerEnv", () => {
  it("returns all validated server environment variables", async () => {
    const { validateServerEnv } = await loadEnvModule();

    expect(validateServerEnv()).toEqual(VALID_ENV);
  });

  it.each(ENV_KEYS)("rejects a missing %s", async (variable) => {
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
        VALID_ENV.PASSWORD_RESET_TOKEN_SECRET.slice(1);

      const { validateServerEnv } = await loadEnvModule();

      expect(() => validateServerEnv()).toThrow(/PASSWORD_RESET_TOKEN_SECRET/);
    });

    it("rejects characters outside the Base64URL alphabet", async () => {
      process.env.PASSWORD_RESET_TOKEN_SECRET = `.${VALID_ENV.PASSWORD_RESET_TOKEN_SECRET.slice(1)}`;

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

describe("getServerEnv", () => {
  it("validates lazily on the first access", async () => {
    delete process.env.AUTH_SECRET;

    const { getServerEnv } = await loadEnvModule();

    expect(getServerEnv).toBeTypeOf("function");

    expect(() => getServerEnv()).toThrow(
      "Invalid server environment configuration: AUTH_SECRET"
    );
  });

  it("retries validation after the environment is corrected", async () => {
    delete process.env.AUTH_SECRET;

    const { getServerEnv } = await loadEnvModule();

    expect(() => getServerEnv()).toThrow(/AUTH_SECRET/);

    process.env.AUTH_SECRET = VALID_ENV.AUTH_SECRET;

    expect(getServerEnv()).toEqual(VALID_ENV);
  });

  it("returns the cached configuration on subsequent calls", async () => {
    const { getServerEnv } = await loadEnvModule();

    const firstResult = getServerEnv();

    process.env.AUTH_SECRET = "b".repeat(32);

    const secondResult = getServerEnv();

    expect(secondResult).toBe(firstResult);
    expect(secondResult.AUTH_SECRET).toBe(VALID_ENV.AUTH_SECRET);
  });

  it("returns an immutable configuration object", async () => {
    const { getServerEnv } = await loadEnvModule();

    const env = getServerEnv();

    expect(Object.isFrozen(env)).toBe(true);
    expect(Reflect.set(env, "AUTH_SECRET", "modified-secret")).toBe(false);
    expect(env.AUTH_SECRET).toBe(VALID_ENV.AUTH_SECRET);
  });

  it("uses a newly validated snapshot when validateServerEnv is called again", async () => {
    const { getServerEnv, validateServerEnv } = await loadEnvModule();

    const firstResult = getServerEnv();

    const updatedSecret = "b".repeat(32);

    process.env.AUTH_SECRET = updatedSecret;

    const secondResult = validateServerEnv();

    expect(secondResult).not.toBe(firstResult);
    expect(secondResult.AUTH_SECRET).toBe(updatedSecret);
    expect(getServerEnv()).toBe(secondResult);
  });

  it("does not return a previously cached configuration after revalidation fails", async () => {
    const { getServerEnv, validateServerEnv } = await loadEnvModule();

    const firstResult = getServerEnv();

    expect(firstResult.AUTH_SECRET).toBe(VALID_ENV.AUTH_SECRET);

    process.env.AUTH_SECRET = "short";

    expect(() => validateServerEnv()).toThrow(/AUTH_SECRET/);
    expect(() => getServerEnv()).toThrow(/AUTH_SECRET/);
  });
});
