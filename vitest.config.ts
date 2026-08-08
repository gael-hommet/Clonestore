import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  // DEMO AND MOBILE CONVERSION CLOSURE (2026-07-24) — tsconfig.json sets "jsx":"preserve"
  // (required by Next.js's own SWC pipeline, not changed here). Vitest's esbuild transform
  // reads that same tsconfig by default and therefore refuses to strip JSX from .tsx files,
  // failing with "invalid JS syntax" on any component test. This override is Vitest-only
  // (esbuild config lives in this file, never touches tsconfig.json/the Next.js build) and
  // unblocks component-level SSR/hydration tests that were previously impossible to write.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Several unit tests (analytics store/correlation/server-events/funnel-e2e, founder-access
    // adapter) spin up a real in-process Postgres (getTestRuntimeDb — PGlite/embedded-postgres)
    // in beforeAll. A COLD start (binary extraction + initdb) legitimately exceeds Vitest's
    // default 10s hookTimeout, so `npm test` flaked on a fresh checkout (reproducibility defect,
    // not a logic failure). Raise the hook/test budgets — strictly more lenient, never hides a
    // real failure (assertions are unchanged and still fail fast).
    hookTimeout: 60000,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
