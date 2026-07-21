// C1.8 — AI-ASSISTED OWNER ACCEPTANCE — même build isolé précompilé, même harnais fail-closed que
// la campagne 65 flux. Assistance IA d'une checklist normalement humaine : ne remplace pas la
// signature du propriétaire (voir C18_AI_OWNER_ACCEPTANCE_AUDIT.md).
import { defineConfig, devices } from "@playwright/test";

const PORT = 3058;
export default defineConfig({
  testDir: "./e2e",
  testMatch: /c18-owner-acceptance\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, actionTimeout: 30_000, navigationTimeout: 60_000, trace: "off", video: "off", screenshot: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node e2e/c18-fail-closed-env.cjs start ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
    env: { NEXT_DIST_DIR: ".next-c18-final-closure", NODE_OPTIONS: "--max-old-space-size=4096" },
  },
});
