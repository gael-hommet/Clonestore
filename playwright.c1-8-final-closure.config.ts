// C1.8 FINAL REAL-BROWSER CLOSURE — build isolé précompilé (.next-c18-final-closure), 0 recompilation
// webpack par route (contourne le mur RAM dev-mode documenté dans C18_TORTURE_FINAL_REPORT.md §7).
// Démarrage via le harnais fail-closed existant (e2e/c18-fail-closed-env.cjs) : neutralise 27 destinations
// distantes AVANT chargement de .env.local, force provider=off, refuse de démarrer si une destination
// distante subsiste.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3058;
export default defineConfig({
  testDir: "./e2e",
  testMatch: /c1-8-final-closure\.spec\.ts/,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["json", { outputFile: ".c1-8-reopened-proofs/final-browser/C18_FINAL_BROWSER_PLAYWRIGHT_RUN.json" }], ["list"]],
  use: { baseURL: `http://localhost:${PORT}`, actionTimeout: 30_000, navigationTimeout: 60_000, trace: "off", video: "off", screenshot: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node e2e/c18-fail-closed-env.cjs start ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 240_000,
    env: { NEXT_DIST_DIR: ".next-c18-final-closure", NODE_OPTIONS: "--max-old-space-size=4096" },
  },
});
