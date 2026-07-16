import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/_setup.ts"],
    testTimeout: 60_000,   // generous — integration tests hit live API
    hookTimeout: 60_000,   // beforeAll does fixture discovery + retries on 429
    pool: "forks",         // each test file in its own process; cleaner stdio harness lifecycle
    fileParallelism: false, // serialize files — avoid 429s from Atlassian during fixture discovery
    reporters: ["default"],
    silent: false,
  },
});
