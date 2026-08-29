import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run source tests — the `tsc` build emits compiled .test.js files
    // into dist/ which must not be picked up (they're CommonJS and can't
    // import vitest).
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
