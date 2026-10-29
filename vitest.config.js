import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],

  test: {
    environment: "node",
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
  },

  env: {
    AUTH_SECRET: "test-only-auth-secret-that-is-long-enough-123",
    PASSWORD_RESET_TOKEN_SECRET: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
});
