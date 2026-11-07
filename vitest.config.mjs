import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  test: {
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
    hookTimeout: 60_000,

    env: {
      AUTH_SECRET: "test-only-auth-secret-that-is-long-enough-123",
      PASSWORD_RESET_TOKEN_SECRET:
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      RESEND_API_KEY: "re_test_only_key",
      RESEND_FROM_EMAIL: "no-reply@example.com",
    },
  },
});
