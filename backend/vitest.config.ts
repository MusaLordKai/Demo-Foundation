import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/setup/constants";

// Full suite: pure domain unit tests + API integration tests. The global setup
// boots an embedded Postgres; integration files reset the schema before each
// test, so files must run serially (fileParallelism: false).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.int.test.ts"],
    environment: "node",
    globalSetup: ["./tests/setup/globalSetup.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-secret",
      UPLOAD_DIR: "./.test-uploads",
      CORS_ORIGIN: "http://localhost:5173",
      MAX_UPLOAD_BYTES: "1024",
    },
  },
});
