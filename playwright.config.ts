// playwright.config.ts
// PHASE 8.2-C — Playwright config for the Pierre v1 cockpit + Employee 360 browser E2E.
// The suite is gated by PLAYWRIGHT_RUN (CI/staging). `npx playwright test --list`
// loads + compiles the spec without a browser, proving it is importable.
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    // Responsive checks drive their own viewports; this is the default desktop.
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Escape hatch (CI/sandbox) : pointer vers un binaire Chromium déjà présent
        // quand le téléchargement Playwright est bloqué. Sans effet si non défini.
        ...(process.env.PW_CHROME_PATH ? { launchOptions: { executablePath: process.env.PW_CHROME_PATH } } : {}),
      },
    },
  ],
});
