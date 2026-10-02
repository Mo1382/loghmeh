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
});
