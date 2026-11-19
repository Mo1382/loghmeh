import { Redis } from "@upstash/redis";

import { getRateLimitEnv } from "@/lib/config/env";

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getRateLimitEnv();

export const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});
