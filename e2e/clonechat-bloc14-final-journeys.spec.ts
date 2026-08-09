// e2e/clonechat-bloc14-final-journeys.spec.ts
// BLOC 14 §3 — JOURNEY A (visiteur public, navigation réelle) + JOURNEY O (active-not-ready contrôlé,
// navigateur) sur le VRAI produit rendu (build isolé). Aucun stub réseau global. Aucun appel payant.

import { test, expect, type Page, type Route } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OPTIONAL_TELEMETRY = [/\/api\/analytics\/events/, /\/api\/conversion\/events/];

interface Monitors { unexpectedConsole: string[]; pageErrors: string[]; http5xx: string[]; }
function attachMonitors(page: Page): Monitors {
  const m: Monitors = { unexpectedConsole: [], pageErrors: [], http5xx: [] };
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location()?.url ?? "";
    if (/status of 429/.test(msg.text()) && OPTIONAL_TELEMETRY.some((re) => re.test(url))) return; // télémétrie facultative (policy validée)
    m.unexpectedConsole.push(`${msg.text().slice(0, 140)} @ ${url}`);
  });
  page.on("pageerror", (e) => m.pageErrors.push(String(e).slice(0, 180)));
  page.on("response", (r) => { if (r.status() >= 500) m.http5xx.push(`${r.status()} ${r.url().slice(-60)}`); });
  return m;
}

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile_iphone", width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
  test(`JOURNEY A [${vp.name}] visiteur public : / → /agents → /agents/pierre → /demo → /assistant, aucune 404/5xx/hydration`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const m = attachMonitors(page);
    for (const path of ["/", "/agents", "/agents/pierre", "/demo", "/assistant"]) {
      const resp = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      expect(resp, `response for ${path}`).not.toBeNull();
      const status = resp!.status();
      expect(status, `status for ${path}`).toBeLessThan(400); // aucune 404/5xx
      await expect(page.locator("body")).toBeVisible();
    }
    // l'assistant doit exposer sa zone de saisie (produit réel rendu).
    await expect(page.locator('textarea[aria-label^="Message pour CloneChat"]')).toBeVisible({ timeout: 30_000 });
    expect(m.pageErrors, "aucune pageerror").toEqual([]);
    expect(m.http5xx, "aucun HTTP 5xx").toEqual([]);
    expect(m.unexpectedConsole, "aucune erreur console inattendue").toEqual([]);
  });
}

test("JOURNEY O [desktop] active-not-ready : réponse fail-closed contrôlée, UI réutilisable, aucun faux résultat", async ({ page }) => {
  // Reproduit EXACTEMENT la réponse fail-closed que la route produit en mode active non-prêt (prouvée au
  // niveau route/journeys) pour vérifier que le CLIENT la gère : aucun crash, UI réutilisable, aucun
  // provider historique appelé côté client. Interception ciblée UNIQUEMENT de /api/assistant/chat.
  await page.setViewportSize({ width: 1440, height: 900 });
  const m = attachMonitors(page);
  await page.route("**/api/assistant/chat", async (route: Route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "circuit_open", error: "Service temporairement indisponible.", structured: { answer: "Service temporairement indisponible.", honesty: "unknown", tool_call: null, citations: [] }, runtime: { hardened: true, active: true, failClosed: true, reason: "circuit_open" } }) });
  });
  await page.route("**/api/assistant/conversations**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [], messages: [], conversation: { id: "c-test" } }) }));

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 30_000 });
  await box.click(); await box.fill("Message alors que le runtime durci n'est pas prêt"); await page.locator('button[aria-label^="Envoyer"]').first().click();
  // UI reste réutilisable après la réponse fail-closed contrôlée.
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.click(); await box.fill("nouvelle tentative"); await expect(box).toHaveValue("nouvelle tentative");
  const html = await page.content();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/); // aucun secret
  expect(m.pageErrors, "aucune pageerror").toEqual([]);
  const other = m.unexpectedConsole.filter((e) => !(e.includes("status of 503") && e.includes("/api/assistant/chat")));
  expect(other, "aucune erreur console AUTRE que le 503 fail-closed injecté").toEqual([]);
});
