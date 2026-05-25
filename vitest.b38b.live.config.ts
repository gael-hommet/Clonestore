// vitest.b38b.live.config.ts
// B38B — Dedicated vitest config for live OpenAI validation.
// Used only by: npm run b38b:live-openai
// NOT included in npm test (different config file).
//
// This config intentionally has no testTimeout override — live calls may take
// up to 30s per scenario. Vitest default (5000ms) would be too short.
// Set hookTimeout to allow beforeAll (safety gate + live run) to complete.

import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/cloneos/ai/live-validation/live-cli.ts"],
    reporters: ["verbose"],
    // Live OpenAI calls can take 10-30s each; 10 scenarios × 30s = 300s max
    hookTimeout: 300_000,
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
