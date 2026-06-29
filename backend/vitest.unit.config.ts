import { defineConfig } from "vitest/config";

// Pure unit tests only (the domain transition guard). No database, no setup —
// fast feedback on the core workflow logic.
export default defineConfig({
  test: {
    include: ["src/domain/**/*.test.ts"],
    environment: "node",
  },
});
