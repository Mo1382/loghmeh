import { beforeAll, describe, expect, it, vi } from "vitest";
import * as policies from "@/lib/rate-limit/policies";

const { RatelimitMock, slidingWindowMock, redisMock } = vi.hoisted(() => {
  const redisMock = { __mockRedis: true };

  const slidingWindowMock = vi.fn((requests, window) => ({
    type: "slidingWindow",
    requests,
    window,
  }));

  const RatelimitMock = vi.fn(function (options) {
    Object.assign(this, options);
  });

  RatelimitMock.slidingWindow = slidingWindowMock;

  return { RatelimitMock, slidingWindowMock, redisMock };
});

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: RatelimitMock,
}));

vi.mock("@/lib/rate-limit/redis", () => ({
  redis: redisMock,
}));

const POLICY_CASES = [
  // Authentication
  {
    exportName: "loginIpLimiter",
    name: "auth:login:ip",
    requests: 5,
    window: "1 m",
  },
  {
    exportName: "loginIdentifierLimiter",
    name: "auth:login:identifier",
    requests: 5,
    window: "1 m",
  },
  {
    exportName: "registerIpLimiter",
    name: "auth:register:ip",
    requests: 3,
    window: "10 m",
  },
  {
    exportName: "changePasswordLimiter",
    name: "auth:change-password",
    requests: 5,
    window: "10 m",
  },
  {
    exportName: "verifyEmailLimiter",
    name: "auth:verify-email",
    requests: 5,
    window: "10 m",
  },
  {
    exportName: "forgotPasswordIpLimiter",
    name: "auth:forgot-password:ip",
    requests: 3,
    window: "10 m",
  },
  {
    exportName: "forgotPasswordEmailLimiter",
    name: "auth:forgot-password:email",
    requests: 3,
    window: "10 m",
  },
  {
    exportName: "verifyPasswordResetLimiter",
    name: "auth:verify-password-reset",
    requests: 5,
    window: "10 m",
  },
  {
    exportName: "resetPasswordLimiter",
    name: "auth:reset-password",
    requests: 5,
    window: "10 m",
  },

  // Content / Social
  {
    exportName: "createRecipeLimiter",
    name: "recipe:create",
    requests: 5,
    window: "10 m",
  },
  {
    exportName: "createCommentLimiter",
    name: "comment:create",
    requests: 10,
    window: "1 m",
  },
  {
    exportName: "createReplyLimiter",
    name: "comment:reply",
    requests: 10,
    window: "1 m",
  },
  {
    exportName: "ratingLimiter",
    name: "rating",
    requests: 10,
    window: "1 m",
  },
  {
    exportName: "reactionLimiter",
    name: "reaction",
    requests: 60,
    window: "1 m",
  },
  {
    exportName: "followLimiter",
    name: "follow",
    requests: 30,
    window: "1 m",
  },
  {
    exportName: "bookmarkLimiter",
    name: "bookmark",
    requests: 60,
    window: "1 m",
  },

  // Support
  {
    exportName: "createTicketLimiter",
    name: "support:create",
    requests: 3,
    window: "10 m",
  },
  {
    exportName: "createSupportReplyLimiter",
    name: "support:reply",
    requests: 20,
    window: "10 m",
  },
];

describe("policies.js", () => {
  it("exports exactly the expected rate-limit policies", () => {
    expect(Object.keys(policies).sort()).toEqual(
      POLICY_CASES.map(({ exportName }) => exportName).sort()
    );
  });

  it.each(POLICY_CASES)(
    "configures $exportName with the expected settings",
    ({ exportName, name, requests, window }) => {
      const policy = policies[exportName];

      expect(policy).toBeInstanceOf(RatelimitMock);
      expect(policy.redis).toBe(redisMock);
      expect(policy.prefix).toBe(`loghmeh:${name}`);
      expect(policy.analytics).toBe(true);
      expect(policy.timeout).toBe(1_500);

      expect(policy.limiter).toEqual({
        type: "slidingWindow",
        requests,
        window,
      });
    }
  );

  it("creates one Ratelimit instance and one sliding-window limiter per policy", () => {
    expect(RatelimitMock).toHaveBeenCalledTimes(POLICY_CASES.length);

    expect(slidingWindowMock).toHaveBeenCalledTimes(POLICY_CASES.length);
  });

  it("uses a unique prefix for every policy", () => {
    const prefixes = RatelimitMock.mock.calls.map(
      ([options]) => options.prefix
    );

    expect(new Set(prefixes).size).toBe(POLICY_CASES.length);
  });
});
