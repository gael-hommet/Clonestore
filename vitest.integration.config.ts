import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

// PHASE 8.1 — integration tests run against a real in-process Postgres (PGlite).
// Separate from the default unit config; *.itest.ts are excluded from `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.itest.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
