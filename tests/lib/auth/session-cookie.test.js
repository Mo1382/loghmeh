import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { randomBytes } from "node:crypto";

import { SESSION_POLICY } from "@/constants/session";

// ============================================================================
// Mocks
// ============================================================================

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  assertValidSessionToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

vi.mock("@/lib/auth/session-token", () => ({
  assertValidSessionToken: mocks.assertValidSessionToken,
}));

// ============================================================================
// Test Helpers
// ============================================================================

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const TEST_NOW = new Date("2026-06-15T12:00:00.000Z");

const INVALID_TOKEN_ERROR =
  "Session token must be a valid canonical Base64URL token.";

const DEFAULT_SESSION_COOKIE_NAME = "loghmeh-session";
const PRODUCTION_SESSION_COOKIE_NAME = "__Host-loghmeh-session";

function createValidSessionToken() {
  return randomBytes(SESSION_POLICY.TOKEN_BYTES).toString("base64url");
}

function makeSession(overrides = {}) {
  return {
    revokedAt: null,

    lastActivityAt: new Date(TEST_NOW.getTime() - MINUTE_MS),

    idleExpiresAt: new Date(TEST_NOW.getTime() + HOUR_MS),

    absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),

    ...overrides,
  };
}

function loadSessionCookieModule(environment = "development") {
  vi.resetModules();

  vi.stubEnv("NODE_ENV", environment);

  return import("@/lib/auth/session-cookie");
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  vi.resetAllMocks();

  vi.useFakeTimers();
  vi.setSystemTime(TEST_NOW);

  mocks.cookies.mockResolvedValue({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
  });

  mocks.cookieGet.mockReturnValue(undefined);

  mocks.assertValidSessionToken.mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ============================================================================
// getSessionTokenFromCookie()
// ============================================================================

describe("getSessionTokenFromCookie()", () => {
  // ==========================================================================
  // Valid Cookie
  // ==========================================================================

  it.each([
    {
      environment: "development",
      expectedCookieName: DEFAULT_SESSION_COOKIE_NAME,
    },
    {
      environment: "production",
      expectedCookieName: PRODUCTION_SESSION_COOKIE_NAME,
    },
  ])(
    "returns the raw Session token in $environment",
    async ({ environment, expectedCookieName }) => {
      const { getSessionTokenFromCookie, SESSION_COOKIE_NAME } =
        await loadSessionCookieModule(environment);

      expect(SESSION_COOKIE_NAME).toBe(expectedCookieName);

      const token = createValidSessionToken();

      mocks.cookieGet.mockReturnValue({
        value: token,
      });

      const result = await getSessionTokenFromCookie();

      expect(result).toBe(token);

      expect(mocks.cookies).toHaveBeenCalledOnce();

      expect(mocks.cookieGet).toHaveBeenCalledOnce();
      expect(mocks.cookieGet).toHaveBeenCalledWith(expectedCookieName);

      expect(mocks.assertValidSessionToken).not.toHaveBeenCalled();
    }
  );

  it("returns a non-empty malformed token without validating its structure", async () => {
    const { getSessionTokenFromCookie, SESSION_COOKIE_NAME } =
      await loadSessionCookieModule();

    const token = "invalid-token";

    mocks.cookieGet.mockReturnValue({
      name: SESSION_COOKIE_NAME,
      value: token,
    });

    const result = await getSessionTokenFromCookie();

    expect(result).toBe(token);

    expect(mocks.assertValidSessionToken).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Missing or Empty Cookie
  // ==========================================================================

  it("returns null when the Session cookie does not exist", async () => {
    const { getSessionTokenFromCookie, SESSION_COOKIE_NAME } =
      await loadSessionCookieModule();

    mocks.cookieGet.mockReturnValue(undefined);

    const result = await getSessionTokenFromCookie();

    expect(result).toBeNull();

    expect(mocks.cookies).toHaveBeenCalledOnce();

    expect(mocks.cookieGet).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
  });

  it("returns null when the Session cookie has an empty value", async () => {
    const { getSessionTokenFromCookie } = await loadSessionCookieModule();

    mocks.cookieGet.mockReturnValue({
      value: "",
    });

    const result = await getSessionTokenFromCookie();

    expect(result).toBeNull();
  });

  // ==========================================================================
  // Invalid Cookie Values
  // ==========================================================================

  it.each([
    {
      description: "undefined",
      value: undefined,
    },
    {
      description: "null",
      value: null,
    },
    {
      description: "a number",
      value: 123,
    },
    {
      description: "a boolean",
      value: true,
    },
    {
      description: "an object",
      value: {},
    },
  ])("returns null for $description cookie values", async ({ value }) => {
    const { getSessionTokenFromCookie } = await loadSessionCookieModule();

    mocks.cookieGet.mockReturnValue({
      value,
    });

    const result = await getSessionTokenFromCookie();

    expect(result).toBeNull();
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  it("propagates errors from the Next.js cookies API", async () => {
    const { getSessionTokenFromCookie } = await loadSessionCookieModule();

    const cookieError = new Error("Cookie access failed");

    mocks.cookies.mockRejectedValue(cookieError);

    await expect(getSessionTokenFromCookie()).rejects.toBe(cookieError);

    expect(mocks.cookieGet).not.toHaveBeenCalled();
  });
});

// ============================================================================
// setSessionCookie()
// ============================================================================

describe("setSessionCookie()", () => {
  // ==========================================================================
  // Successful Cookie Creation
  // ==========================================================================

  it.each([
    {
      environment: "development",
      expectedCookieName: DEFAULT_SESSION_COOKIE_NAME,
      secure: false,
    },
    {
      environment: "production",
      expectedCookieName: PRODUCTION_SESSION_COOKIE_NAME,
      secure: true,
    },
  ])(
    "sets a Session cookie with the expected security attributes in $environment",
    async ({ environment, expectedCookieName, secure }) => {
      const { setSessionCookie, SESSION_COOKIE_NAME } =
        await loadSessionCookieModule(environment);

      expect(SESSION_COOKIE_NAME).toBe(expectedCookieName);

      const token = createValidSessionToken();
      const session = makeSession();

      await setSessionCookie(token, session);

      expect(mocks.assertValidSessionToken).toHaveBeenCalledOnce();
      expect(mocks.assertValidSessionToken).toHaveBeenCalledWith(token);

      expect(mocks.cookies).toHaveBeenCalledOnce();

      expect(mocks.cookieSet).toHaveBeenCalledOnce();
      expect(mocks.cookieSet).toHaveBeenCalledWith(expectedCookieName, token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        expires: session.absoluteExpiresAt,
      });

      const cookieOptions = mocks.cookieSet.mock.calls[0][2];

      expect(cookieOptions).not.toHaveProperty("domain");
    }
  );

  // ==========================================================================
  // Token Validation
  // ==========================================================================

  it("rejects an invalid token before accessing the Cookie Store", async () => {
    const { setSessionCookie } = await loadSessionCookieModule();

    const tokenError = new TypeError(INVALID_TOKEN_ERROR);

    mocks.assertValidSessionToken.mockImplementation(() => {
      throw tokenError;
    });

    await expect(setSessionCookie("invalid-token", makeSession())).rejects.toBe(
      tokenError
    );

    expect(mocks.assertValidSessionToken).toHaveBeenCalledOnce();

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Session Object Validation
  // ==========================================================================

  it.each([
    {
      description: "null",
      session: null,
    },
    {
      description: "undefined",
      session: undefined,
    },
    {
      description: "an array",
      session: [],
    },
    {
      description: "a string",
      session: "invalid-session",
    },
    {
      description: "a number",
      session: 123,
    },
  ])("rejects $description Session values", async ({ session }) => {
    const { setSessionCookie } = await loadSessionCookieModule();

    await expect(
      setSessionCookie(createValidSessionToken(), session)
    ).rejects.toThrow("session must be an object.");

    expect(mocks.assertValidSessionToken).toHaveBeenCalledOnce();

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Session Revocation Validation
  // ==========================================================================

  it.each([
    {
      description: "a Session with a non-null revokedAt",
      overrides: {
        revokedAt: new Date(TEST_NOW.getTime() - MINUTE_MS),
      },
    },
    {
      description: "a Session with a missing revokedAt",
      overrides: {
        revokedAt: undefined,
      },
    },
  ])("rejects $description", async ({ overrides }) => {
    const { setSessionCookie } = await loadSessionCookieModule();

    const session = makeSession(overrides);

    await expect(
      setSessionCookie(createValidSessionToken(), session)
    ).rejects.toThrow("Cannot set a cookie for a revoked Session.");

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Session Date Validation
  // ==========================================================================

  it.each([
    {
      description: "a missing lastActivityAt",
      overrides: {
        lastActivityAt: undefined,
      },
      expectedMessage: "lastActivityAt must be a valid Date.",
    },
    {
      description: "an invalid lastActivityAt",
      overrides: {
        lastActivityAt: new Date(Number.NaN),
      },
      expectedMessage: "lastActivityAt must be a valid Date.",
    },
    {
      description: "a missing idleExpiresAt",
      overrides: {
        idleExpiresAt: undefined,
      },
      expectedMessage: "idleExpiresAt must be a valid Date.",
    },
    {
      description: "an invalid idleExpiresAt",
      overrides: {
        idleExpiresAt: new Date(Number.NaN),
      },
      expectedMessage: "idleExpiresAt must be a valid Date.",
    },
    {
      description: "a missing absoluteExpiresAt",
      overrides: {
        absoluteExpiresAt: undefined,
      },
      expectedMessage: "absoluteExpiresAt must be a valid Date.",
    },
    {
      description: "an invalid absoluteExpiresAt",
      overrides: {
        absoluteExpiresAt: new Date(Number.NaN),
      },
      expectedMessage: "absoluteExpiresAt must be a valid Date.",
    },
  ])("rejects $description", async ({ overrides, expectedMessage }) => {
    const { setSessionCookie } = await loadSessionCookieModule();

    const session = makeSession(overrides);

    await expect(
      setSessionCookie(createValidSessionToken(), session)
    ).rejects.toThrow(expectedMessage);

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Session Timestamp Relationships
  // ==========================================================================

  it.each([
    {
      description: "lastActivityAt equal to idleExpiresAt",
      overrides: {
        lastActivityAt: new Date(TEST_NOW),
        idleExpiresAt: new Date(TEST_NOW),
        absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),
      },
    },
    {
      description: "lastActivityAt later than idleExpiresAt",
      overrides: {
        lastActivityAt: new Date(TEST_NOW.getTime() + HOUR_MS),
        idleExpiresAt: new Date(TEST_NOW.getTime() + MINUTE_MS),
        absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),
      },
    },
    {
      description: "idleExpiresAt later than absoluteExpiresAt",
      overrides: {
        lastActivityAt: new Date(TEST_NOW.getTime() - MINUTE_MS),
        idleExpiresAt: new Date(TEST_NOW.getTime() + 2 * DAY_MS),
        absoluteExpiresAt: new Date(TEST_NOW.getTime() + DAY_MS),
      },
    },
  ])("rejects inconsistent timestamps: $description", async ({ overrides }) => {
    const { setSessionCookie } = await loadSessionCookieModule();

    const session = makeSession(overrides);

    await expect(
      setSessionCookie(createValidSessionToken(), session)
    ).rejects.toThrow("Session expiration timestamps are inconsistent.");

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("accepts a Session whose idle and absolute expiration timestamps are equal", async () => {
    const { setSessionCookie } = await loadSessionCookieModule();

    const token = createValidSessionToken();
    const absoluteExpiresAt = new Date(TEST_NOW.getTime() + DAY_MS);

    const session = makeSession({
      idleExpiresAt: absoluteExpiresAt,
      absoluteExpiresAt,
    });

    await setSessionCookie(token, session);

    expect(mocks.cookieSet).toHaveBeenCalledOnce();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      DEFAULT_SESSION_COOKIE_NAME,
      token,
      expect.objectContaining({
        expires: absoluteExpiresAt,
      })
    );
  });

  // ==========================================================================
  // Session Expiration
  // ==========================================================================

  it.each([
    {
      description: "idleExpiresAt equal to the current time",
      idleExpiresAt: new Date(TEST_NOW),
    },
    {
      description: "idleExpiresAt earlier than the current time",
      idleExpiresAt: new Date(TEST_NOW.getTime() - 1),
    },
  ])(
    "rejects an expired Session when $description",
    async ({ idleExpiresAt }) => {
      const { setSessionCookie } = await loadSessionCookieModule();

      const session = makeSession({
        idleExpiresAt,
      });

      await expect(
        setSessionCookie(createValidSessionToken(), session)
      ).rejects.toThrow("Cannot set a cookie for an expired Session.");

      expect(mocks.cookies).not.toHaveBeenCalled();
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    }
  );

  // ==========================================================================
  // Cookie Store Error Handling
  // ==========================================================================

  it("propagates errors when setting the Session cookie", async () => {
    const { setSessionCookie } = await loadSessionCookieModule();

    const cookieError = new Error("Cookie writing failed");

    mocks.cookieSet.mockImplementation(() => {
      throw cookieError;
    });

    await expect(
      setSessionCookie(createValidSessionToken(), makeSession())
    ).rejects.toBe(cookieError);

    expect(mocks.cookies).toHaveBeenCalledOnce();
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
  });
});

// ============================================================================
// clearSessionCookie()
// ============================================================================

describe("clearSessionCookie()", () => {
  // ==========================================================================
  // Successful Cookie Removal
  // ==========================================================================

  it.each([
    {
      environment: "development",
      expectedCookieName: DEFAULT_SESSION_COOKIE_NAME,
      secure: false,
    },
    {
      environment: "production",
      expectedCookieName: PRODUCTION_SESSION_COOKIE_NAME,
      secure: true,
    },
  ])(
    "clears the Session cookie in $environment",
    async ({ environment, expectedCookieName, secure }) => {
      const { clearSessionCookie, SESSION_COOKIE_NAME } =
        await loadSessionCookieModule(environment);

      expect(SESSION_COOKIE_NAME).toBe(expectedCookieName);

      await clearSessionCookie();

      expect(mocks.cookies).toHaveBeenCalledOnce();

      expect(mocks.cookieSet).toHaveBeenCalledOnce();
      expect(mocks.cookieSet).toHaveBeenCalledWith(expectedCookieName, "", {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      });

      expect(mocks.assertValidSessionToken).not.toHaveBeenCalled();
      expect(mocks.cookieGet).not.toHaveBeenCalled();
    }
  );

  // ==========================================================================
  // Cookie Store Error Handling
  // ==========================================================================

  it("propagates errors from the Next.js cookies API", async () => {
    const { clearSessionCookie } = await loadSessionCookieModule();

    const cookieError = new Error("Cookie access failed");

    mocks.cookies.mockRejectedValue(cookieError);

    await expect(clearSessionCookie()).rejects.toBe(cookieError);

    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
