import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

// PHASE 8.1 — local benchmark config (real in-process Postgres via PGlite).
// Separate from unit + integration configs.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.bench.ts"],
    testTimeout: 120000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
