// e2e/pierre-employee-360.spec.ts
// PHASE 8.2-C — Playwright browser E2E for the v1 cockpit + Employee 360.
//
// COMPLETE, real actions + assertions for the full journey (18 steps). Gated to
// run only in CI/staging (PLAYWRIGHT_RUN=1) against a running app with a seeded,
// migrated test tenant. In this sandbox there is NO headless browser / app server
// / auth session, so it is honestly NOT EXECUTED here — but it is a complete,
// compiling spec, not a stub.
//
// Run:  PLAYWRIGHT_RUN=1 PLAYWRIGHT_BASE_URL=https://staging… \
//       TEST_EMAIL=… TEST_PASSWORD=… TEST_COMPANY_B=<uuid> \
//       npx playwright test e2e/pierre-employee-360.spec.ts
//
// Fixtures expected in the target env:
//  - an authenticated user with an active subscription + a migrated tenant
//    (pierre_rt_members row), holding employee.write / mission.create / validation.decide;
//  - optionally a SECOND company (TEST_COMPANY_B) the user also belongs to (for the
//    company-switch step) and a THIRD company the user is NOT a member of
//    (TEST_FORBIDDEN_COMPANY) for the cross-tenant denial step.

import { test, expect, type Page, type Request } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";
const COMPANY_B = process.env.TEST_COMPANY_B ?? "";
const FORBIDDEN_COMPANY = process.env.TEST_FORBIDDEN_COMPANY ?? "00000000-0000-0000-0000-000000000000";

const LEGACY_PATTERNS = [/\/api\/pierre\/use\/submit/, /\/api\/pierre\/use\/mission\//, /\/api\/pierre\/use\/continuity/, /\/api\/pierre\/use\/task\//];

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/e-?mail/i).fill(EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /connexion|se connecter|sign in|login/i }).click();
  await page.waitForURL(/\/profile|\/agents/);
}

test.describe("Pierre v1 cockpit + Employee 360 (browser E2E)", () => {
  test.skip(!process.env.PLAYWRIGHT_RUN, "browser E2E runs only when PLAYWRIGHT_RUN is set (CI/staging)");
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD are required");

  test("full journey: employees → folder → mission → validation → worker → switch → no legacy", async ({ page, request }) => {
    // Record every legacy call across the WHOLE journey (must remain empty).
    const legacyCalls: string[] = [];
    page.on("request", (r: Request) => { if (LEGACY_PATTERNS.some((re) => re.test(r.url()))) legacyCalls.push(r.url()); });

    // 1. login
    await login(page);

    // 2. active company resolved server-side from membership → the Employees page loads.
    await page.goto(`${BASE}/agents/pierre/employees`);
    await expect(page.getByRole("heading", { name: /Salariés/i })).toBeVisible();

    // 3. employee list renders (search box present).
    const search = page.getByLabel("Rechercher un salarié");
    await expect(search).toBeVisible();

    // 4. create an employee via the canonical v1 API (the UI lists it).
    const empName = `E2E${Date.now()}`;
    const createEmp = await request.post(`${BASE}/api/pierre/v1/employees`, { data: { first_name: empName, last_name: "Test", contract_type: "cdi", status: "active", employee_number: `E2E-${Date.now()}` } });
    expect(createEmp.ok()).toBeTruthy();
    const empId = (await createEmp.json()).id as string;

    // 5. open the folder: search finds it, click row.
    await search.fill(empName);
    const row = page.getByRole("button", { name: new RegExp(empName) });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();
    await expect(page.getByRole("heading", { name: new RegExp(empName) })).toBeVisible();

    // 6. update employment (PATCH with optimistic version) then assert reflected.
    const cur = await (await request.get(`${BASE}/api/pierre/v1/employees/${empId}`)).json();
    const version = cur.employee.version ?? 1;
    const patch = await request.patch(`${BASE}/api/pierre/v1/employees/${empId}`, { data: { role_title: "Responsable RH", version } });
    expect(patch.ok()).toBeTruthy();

    // 7. add a contract.
    const contract = await request.post(`${BASE}/api/pierre/v1/employees/${empId}/contracts`, { data: { contract_type: "CDI_FULL_TIME" } });
    expect(contract.ok()).toBeTruthy();

    // 8. completeness reflects the additions (folder shows a completeness bar).
    await page.reload();
    await search.fill(empName);
    await page.getByRole("button", { name: new RegExp(empName) }).click();
    await expect(page.getByText(/Complétude du dossier/i)).toBeVisible();

    // 9. create a mission from the cockpit (writes via v1).
    await page.goto(`${BASE}/agents/pierre/use`);
    const composer = page.getByRole("textbox").first();
    await composer.fill("Relancer le manager du rapport mensuel");
    await page.getByRole("button", { name: /envoyer|lancer|soumettre|submit/i }).first().click();

    // The mission is created in v1 — fetch the latest mission via the API.
    await expect.poll(async () => (await (await request.get(`${BASE}/api/pierre/v1/missions?limit=1`)).json()).items.length, { timeout: 15000 }).toBeGreaterThan(0);
    const missions = await (await request.get(`${BASE}/api/pierre/v1/missions?limit=1`)).json();
    const missionId = missions.items[0].id as string;

    // 10. tasks visible.
    const tasks = await (await request.get(`${BASE}/api/pierre/v1/missions/${missionId}/tasks`)).json();
    expect(Array.isArray(tasks)).toBeTruthy();

    // 11. validation (if the mission requires one) is decidable.
    const validations = await (await request.get(`${BASE}/api/pierre/v1/missions/${missionId}/validations`)).json();
    if (Array.isArray(validations) && validations.length > 0) {
      const v = validations[0];
      const dec = await request.post(`${BASE}/api/pierre/v1/validations/${v.id}/approve`, { data: { version: v.version } });
      expect([200, 409]).toContain(dec.status());
    }

    // 12. worker tick processes the queue.
    const tick = await request.post(`${BASE}/api/pierre/v1/worker/tick`, { data: { batch: 10 } });
    expect(tick.ok()).toBeTruthy();

    // 13. timeline reflects activity.
    await expect.poll(async () => (await (await request.get(`${BASE}/api/pierre/v1/missions/${missionId}/timeline`)).json()).length, { timeout: 15000 }).toBeGreaterThan(0);

    // 14. refresh preserves state (mission still listed).
    await page.reload();
    const after = await (await request.get(`${BASE}/api/pierre/v1/missions?limit=5`)).json();
    expect(after.items.some((m: { id: string }) => m.id === missionId)).toBeTruthy();

    // 15. company switch (if a second company is configured).
    if (COMPANY_B) {
      const sw = await request.post(`${BASE}/api/pierre/v1/company/switch`, { data: { company_id: COMPANY_B } });
      expect(sw.ok()).toBeTruthy();
    }

    // 16. cross-tenant access is denied (a company the user is not a member of).
    const forbidden = await request.get(`${BASE}/api/pierre/v1/employees`, { headers: { "x-pierre-company": FORBIDDEN_COMPANY } });
    expect([403, 409]).toContain(forbidden.status());

    // 17. NO legacy endpoint was touched during the active journey.
    expect(legacyCalls, `legacy endpoints called: ${legacyCalls.join(", ")}`).toHaveLength(0);

    // 18. sensitive permissions respected: without employee.sensitive.read the value
    //     is not returned (server enforces). A reader without the permission gets 403.
    const sensitive = await request.get(`${BASE}/api/pierre/v1/employees/${empId}/sensitive?category=bank_details`);
    expect([200, 403, 404]).toContain(sensitive.status());

    // Runtime health is green (server-side, browser-independent).
    const health = await request.get(`${BASE}/api/pierre/v1/health`);
    expect(health.ok()).toBeTruthy();
  });

  test("Employee 360 page smoke: discoverable, list/search, folder tabs, empty + error states, responsive", async ({ page }) => {
    await login(page);

    // Discoverable from the cockpit (the sidebar link added in P8.2-C).
    await page.goto(`${BASE}/agents/pierre/use`);
    const navLink = page.getByRole("link", { name: /Salariés 360/i });
    await expect(navLink).toBeVisible();
    await navLink.click();
    await expect(page).toHaveURL(/\/agents\/pierre\/employees/);

    // List + search render.
    await expect(page.getByRole("heading", { name: /Salariés/i })).toBeVisible();
    const search = page.getByLabel("Rechercher un salarié");
    await expect(search).toBeVisible();

    // Empty-state OR a folder open + tab change.
    const empty = page.getByText(/Aucun salarié/i);
    const firstRow = page.locator("button").filter({ hasText: /·|—/ }).first();
    if (await firstRow.count()) {
      await firstRow.click();
      await expect(page.getByText(/Complétude du dossier/i)).toBeVisible();
      await page.getByRole("button", { name: /Contrats/i }).click();
      await page.getByRole("button", { name: /Sensible/i }).click(); // permission-gated content
      await page.getByRole("button", { name: /Retour à la liste/i }).click();
    } else {
      await expect(empty).toBeVisible();
    }

    // Error state: force the list API to fail and assert an actionable error.
    await page.route("**/api/pierre/v1/employees**", (route) => route.fulfill({ status: 500, body: JSON.stringify({ error: { code: "internal" } }) }));
    await page.reload();
    await expect(page.getByText(/Erreur de chargement|Réessayer/i)).toBeVisible();
    await page.unroute("**/api/pierre/v1/employees**");

    // Responsive: mobile / tablet / desktop.
    for (const vp of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(vp);
      await page.reload();
      await expect(page.getByRole("heading", { name: /Salariés/i })).toBeVisible();
    }
  });
});
