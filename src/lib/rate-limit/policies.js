import { Ratelimit } from "@upstash/ratelimit";

import { redis } from "./redis";

function createLimiter({ name, requests, window }) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `loghmeh:${name}`,
    analytics: true,
  });
}

/*
 * Authentication
 */

export const loginIpLimiter = createLimiter({
  name: "auth:login:ip",
  requests: 5,
  window: "1 m",
});

export const loginIdentifierLimiter = createLimiter({
  name: "auth:login:identifier",
  requests: 5,
  window: "1 m",
});

export const registerIpLimiter = createLimiter({
  name: "auth:register:ip",
  requests: 3,
  window: "10 m",
});

export const changePasswordLimiter = createLimiter({
  name: "auth:change-password",
  requests: 5,
  window: "10 m",
});

export const verifyEmailLimiter = createLimiter({
  name: "auth:verify-email",
  requests: 5,
  window: "10 m",
});

export const forgotPasswordIpLimiter = createLimiter({
  name: "auth:forgot-password:ip",
  requests: 3,
  window: "10 m",
});

export const forgotPasswordEmailLimiter = createLimiter({
  name: "auth:forgot-password:email",
  requests: 3,
  window: "10 m",
});

export const verifyPasswordResetLimiter = createLimiter({
  name: "auth:verify-reset",
  requests: 5,
  window: "10 m",
});

export const resetPasswordLimiter = createLimiter({
  name: "auth:reset-password",
  requests: 5,
  window: "10 m",
});

/*
 * Content / Social
 */

export const createRecipeLimiter = createLimiter({
  name: "recipe:create",
  requests: 5,
  window: "10 m",
});

export const createCommentLimiter = createLimiter({
  name: "comment:create",
  requests: 10,
  window: "1 m",
});

export const createReplyLimiter = createLimiter({
  name: "comment:reply",
  requests: 10,
  window: "1 m",
});

export const ratingLimiter = createLimiter({
  name: "rating",
  requests: 10,
  window: "1 m",
});

export const reactionLimiter = createLimiter({
  name: "reaction",
  requests: 60,
  window: "1 m",
});

export const followLimiter = createLimiter({
  name: "follow",
  requests: 30,
  window: "1 m",
});

export const bookmarkLimiter = createLimiter({
  name: "bookmark",
  requests: 60,
  window: "1 m",
});

/*
 * Support
 */

export const createTicketLimiter = createLimiter({
  name: "support:create",
  requests: 3,
  window: "10 m",
});

export const createSupportReplyLimiter = createLimiter({
  name: "support:reply",
  requests: 20,
  window: "10 m",
});
