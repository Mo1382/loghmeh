import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error("Upstash environment variables are missing.");
}

const redis = new Redis({
  url,
  token,
});

async function testConnection() {
  const key = `loghmeh:connection-test:${Date.now()}`;

  try {
    const pong = await redis.ping();

    console.log("Redis PING:", pong);

    await redis.set(key, "connection-successful", {
      ex: 30,
    });

    const value = await redis.get(key);

    console.log("Redis GET:", value);

    await redis.del(key);

    console.log("Upstash connection test completed successfully.");
  } catch (error) {
    console.error("Upstash connection test failed:", error.message);
    process.exitCode = 1;
  }
}

await testConnection();
