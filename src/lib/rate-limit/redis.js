import { Redis } from "@upstash/redis";

import { getUpstashRedisEnv } from "@/lib/config/env";

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } =
  getUpstashRedisEnv();

export const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});
