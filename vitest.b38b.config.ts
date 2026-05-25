// vitest.b38b.config.ts
// B38B — Dedicated vitest config for dry-run CLI validation.
// Used only by: npm run b38b:dry-run
// NOT included in npm test (different config file).

import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/cloneos/ai/live-validation/dryrun-cli.ts"],
    reporters: ["verbose"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
