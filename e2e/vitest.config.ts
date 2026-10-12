import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["e2e/fixtures/**"],
    include: ["e2e/**/*.test.ts"],
  },
});
