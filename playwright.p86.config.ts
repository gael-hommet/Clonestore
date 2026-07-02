// playwright.p86.config.ts
// PHASE 8.6 — self-contained LOCAL E2E: Playwright boots its own Next dev server backed by the in-process
// PGlite test DB (PIERRE_E2E_TEST_MODE=1) with the Fake providers — NO Docker / Postgres / Supabase /
// live accounts / manual server. The webServer env enables the test-only adapter, identity and
// paid-customer-test mode (non-production). Workers=1 because the test DB is a single shared instance.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.P86_E2E_PORT ?? 3219);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /p86-customer-lifecycle-step[12]\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/pierre/v1/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PIERRE_E2E_TEST_MODE: "1",
      PIERRE_E2E_SECRET: "p86-local-secret",
      PIERRE_PAID_CUSTOMER_TEST_MODE: "1",
      PIERRE_HANDOFF_TOKEN_SECRET: "p86-local-handoff-secret",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PW_CHROME_PATH ? { launchOptions: { executablePath: process.env.PW_CHROME_PATH } } : {}),
      },
    },
  ],
});
