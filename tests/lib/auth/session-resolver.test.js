import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getSessionTokenFromCookie: vi.fn(),
  resolveSessionToken: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    cache: (callback) => callback,
  };
});

vi.mock("@/lib/auth/session-cookie", () => ({
  getSessionTokenFromCookie: mocks.getSessionTokenFromCookie,
}));

vi.mock("@/services/session.service", () => ({
  resolveSessionToken: mocks.resolveSessionToken,
}));

import { getCurrentSession, getCurrentUser } from "@/lib/auth/session-resolver";

// ============================================================================
// Test Helpers
// ============================================================================

// Deliberately treated as an opaque raw token.
// Token validation belongs to the Session service.
const RAW_SESSION_TOKEN = "raw-session-token";

function createSessionContext() {
  const user = {
    _id: "user-123",
    username: "test-user",
  };

  const session = {
    _id: "session-123",
    userId: user._id,
  };

  return {
    user,
    session,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
  vi.resetAllMocks();

  mocks.getSessionTokenFromCookie.mockResolvedValue(null);
  mocks.resolveSessionToken.mockResolvedValue(null);
});

// ============================================================================
// getCurrentSession()
// ============================================================================

describe("getCurrentSession()", () => {
  // ==========================================================================
  // Missing Session Token
  // ==========================================================================

  it.each([
    {
      description: "a missing Session token",
      token: null,
    },
    {
      description: "an empty Session token",
      token: "",
    },
  ])("returns null when receiving $description", async ({ token }) => {
    mocks.getSessionTokenFromCookie.mockResolvedValue(token);

    const result = await getCurrentSession();

    expect(result).toBeNull();

    expect(mocks.getSessionTokenFromCookie).toHaveBeenCalledOnce();

    expect(mocks.resolveSessionToken).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Successful Session Resolution
  // ==========================================================================

  it("forwards the raw Session token to the Session service with Touch enabled", async () => {
    const context = createSessionContext();

    mocks.getSessionTokenFromCookie.mockResolvedValue(RAW_SESSION_TOKEN);
    mocks.resolveSessionToken.mockResolvedValue(context);

    const result = await getCurrentSession();

    expect(result).toBe(context);

    expect(mocks.getSessionTokenFromCookie).toHaveBeenCalledOnce();

    expect(mocks.resolveSessionToken).toHaveBeenCalledOnce();
    expect(mocks.resolveSessionToken).toHaveBeenCalledWith(RAW_SESSION_TOKEN, {
      touch: true,
    });
  });

  // ==========================================================================
  // Cookie Access Error
  // ==========================================================================

  it("propagates errors from the Session cookie API", async () => {
    const cookieError = new Error("Cookie access failed");

    mocks.getSessionTokenFromCookie.mockRejectedValue(cookieError);

    await expect(getCurrentSession()).rejects.toBe(cookieError);

    expect(mocks.getSessionTokenFromCookie).toHaveBeenCalledOnce();

    expect(mocks.resolveSessionToken).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Session Resolution Error
  // ==========================================================================

  it("propagates errors from the Session service", async () => {
    const sessionError = new Error("Session resolution failed");

    mocks.getSessionTokenFromCookie.mockResolvedValue(RAW_SESSION_TOKEN);
    mocks.resolveSessionToken.mockRejectedValue(sessionError);

    await expect(getCurrentSession()).rejects.toBe(sessionError);

    expect(mocks.getSessionTokenFromCookie).toHaveBeenCalledOnce();

    expect(mocks.resolveSessionToken).toHaveBeenCalledOnce();
    expect(mocks.resolveSessionToken).toHaveBeenCalledWith(RAW_SESSION_TOKEN, {
      touch: true,
    });
  });
});

// ============================================================================
// getCurrentUser()
// ============================================================================

describe("getCurrentUser()", () => {
  // ==========================================================================
  // Authenticated User
  // ==========================================================================

  it("returns the authenticated User", async () => {
    const context = createSessionContext();

    mocks.getSessionTokenFromCookie.mockResolvedValue(RAW_SESSION_TOKEN);
    mocks.resolveSessionToken.mockResolvedValue(context);

    const result = await getCurrentUser();

    expect(result).toBe(context.user);

    expect(mocks.getSessionTokenFromCookie).toHaveBeenCalledOnce();

    expect(mocks.resolveSessionToken).toHaveBeenCalledOnce();
    expect(mocks.resolveSessionToken).toHaveBeenCalledWith(RAW_SESSION_TOKEN, {
      touch: true,
    });
  });

  // ==========================================================================
  // Unauthenticated User
  // ==========================================================================

  it("returns null when no authenticated Session can be resolved", async () => {
    mocks.getSessionTokenFromCookie.mockResolvedValue(RAW_SESSION_TOKEN);
    mocks.resolveSessionToken.mockResolvedValue(null);

    const result = await getCurrentUser();

    expect(result).toBeNull();

    expect(mocks.getSessionTokenFromCookie).toHaveBeenCalledOnce();

    expect(mocks.resolveSessionToken).toHaveBeenCalledOnce();
    expect(mocks.resolveSessionToken).toHaveBeenCalledWith(RAW_SESSION_TOKEN, {
      touch: true,
    });
  });
});
