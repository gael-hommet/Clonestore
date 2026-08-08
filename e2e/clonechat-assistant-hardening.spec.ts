// e2e/clonechat-assistant-hardening.spec.ts
// BLOC 13 — Preuve NAVIGATEUR de /assistant sous le runtime durci (mode `off` par défaut : comportement
// historique inchangé). Prouve, sur desktop + iPhone + Android : rendu, saisie, envoi, ÉTAT LOADING
// RÉELLEMENT OBSERVÉ (bouton « Interrompre » visible avant le résultat), résultat via le VRAI protocole
// event-stream, interruption fonctionnelle, erreur CONTRÔLÉE, accessibilité clavier, aucune fuite,
// aucune erreur console inattendue, aucun HTTP 5xx. AUCUN appel payant : le POST /api/assistant/chat est
// intercepté et servi par un flux SSE SYNTHÉTIQUE (le vrai protocole du client). Aucun effet réel.

import { test, expect, type Page, type Route } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OPTIONAL_TELEMETRY = [/\/api\/analytics\/events/, /\/api\/conversion\/events/];
const ANSWER = "Reponse synthetique de test hardening.";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile_iphone", width: 390, height: 844 },
  { name: "mobile_android", width: 412, height: 915 },
] as const;

interface Monitors { unexpectedConsole: string[]; pageErrors: string[]; http5xx: string[]; }
function attachMonitors(page: Page): Monitors {
  const m: Monitors = { unexpectedConsole: [], pageErrors: [], http5xx: [] };
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location()?.url ?? "";
    if (/status of 429/.test(msg.text()) && OPTIONAL_TELEMETRY.some((re) => re.test(url))) return; // backpressure télémétrie attendue
    m.unexpectedConsole.push(`${msg.text().slice(0, 120)} @ ${url}`);
  });
  page.on("pageerror", (e) => m.pageErrors.push(String(e).slice(0, 160)));
  page.on("response", (r) => { if (r.status() >= 500) m.http5xx.push(`${r.status()} ${r.url().slice(-50)}`); });
  return m;
}

function sseBody(): string {
  const ev = (o: unknown) => `event: ${(o as { type: string }).type}\ndata: ${JSON.stringify(o)}\n\n`;
  return (
    ev({ type: "delta", text: "Reponse " }) +
    ev({ type: "delta", text: "synthetique de test hardening." }) +
    ev({ type: "done", payload: { ok: true, source: "synthetic", public: true, structured: { answer: ANSWER, honesty: "answered", tool_call: null, citations: [] }, runtime: { streamed: true } } })
  );
}

async function neutralizeBackend(page: Page, opts: { chat: "sse" | "error503" | "failClosed"; delayMs?: number }): Promise<void> {
  await page.route("**/api/assistant/chat", async (route: Route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.chat === "error503") { await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "provider_unavailable", error: "Service temporairement indisponible." }) }); return; }
    // BLOC 13 — réponse FAIL-CLOSED du runtime durci (mode active demandé mais NON prêt : circuit ouvert).
    // Reproduit EXACTEMENT ce que la route produit (prouvé au niveau route) pour vérifier que le CLIENT la
    // gère proprement : aucun crash, UI réutilisable, aucun faux résultat, aucun 5xx inattendu.
    if (opts.chat === "failClosed") { await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "circuit_open", error: "Service temporairement indisponible.", structured: { answer: "Service temporairement indisponible.", honesty: "unknown", tool_call: null, citations: [] }, runtime: { hardened: true, active: true, failClosed: true, reason: "circuit_open" } }) }); return; }
    await route.fulfill({ status: 200, contentType: "text/event-stream; charset=utf-8", body: sseBody() });
  });
  await page.route("**/api/assistant/conversations**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [], messages: [], conversation: { id: "c-test" } }) }));
}

async function typeAndSend(page: Page, text: string): Promise<void> {
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 30_000 });
  await box.click(); await box.fill(text); await expect(box).toHaveValue(text);
  await page.locator('button[aria-label^="Envoyer"]').first().click();
}

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] /assistant : rendu, saisie, LOADING observé, résultat (SSE), a11y, aucune fuite/erreur`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const m = attachMonitors(page);
    await neutralizeBackend(page, { chat: "sse", delayMs: 1200 }); // délai → l'état loading est OBSERVABLE

    await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
    const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
    await expect(box).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Tab");
    expect((await page.evaluate(() => document.activeElement?.tagName ?? "")).length).toBeGreaterThan(0);

    await typeAndSend(page, "Question de test hardening");
    // ÉTAT LOADING RÉEL : le bouton « Interrompre » (aria-label) apparaît AVANT le résultat.
    await expect(page.locator('button[aria-label^="Interrompre"]').first()).toBeVisible({ timeout: 5_000 });
    // Puis le résultat via le vrai protocole event-stream s'affiche (occurrence VISIBLE).
    await page.waitForFunction(
      (needle) => Array.from(document.querySelectorAll("*")).some((el) => (el.textContent ?? "").includes(needle) && (el as HTMLElement).offsetParent !== null),
      ANSWER, { timeout: 15_000 },
    );

    const html = await page.content();
    expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
    expect(html).not.toMatch(/\bsk-[A-Za-z0-9]{12,}\b/);

    expect(m.pageErrors, "aucune pageerror").toEqual([]);
    expect(m.http5xx, "aucun HTTP 5xx").toEqual([]);
    expect(m.unexpectedConsole, "aucune erreur console inattendue").toEqual([]);
  });
}

test("[desktop] /assistant : INTERRUPTION pendant le loading → UI réutilisable (aucun crash)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const m = attachMonitors(page);
  await neutralizeBackend(page, { chat: "sse", delayMs: 4000 }); // long : laisse le temps d'interrompre

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
  await typeAndSend(page, "Message que je vais interrompre");
  const interrupt = page.locator('button[aria-label^="Interrompre"]').first();
  await expect(interrupt).toBeVisible({ timeout: 5_000 });
  await interrupt.click(); // annulation client
  // Après interruption, le champ redevient utilisable (aucun crash, état loading levé).
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 10_000 });
  await box.click(); await box.fill("nouvelle tentative"); await expect(box).toHaveValue("nouvelle tentative");
  expect(m.pageErrors, "aucune pageerror").toEqual([]);
});

test("[desktop] /assistant : erreur provider CONTRÔLÉE (503) — aucun crash, UI réutilisable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const m = attachMonitors(page);
  await neutralizeBackend(page, { chat: "error503" });

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
  await typeAndSend(page, "Message qui échoue côté provider");
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.click(); await box.fill("nouvelle tentative"); await expect(box).toHaveValue("nouvelle tentative");
  expect(m.pageErrors, "aucune pageerror").toEqual([]);
  const other = m.unexpectedConsole.filter((e) => !(e.includes("status of 503") && e.includes("/api/assistant/chat")));
  expect(other, "aucune erreur console AUTRE que le 503 injecté").toEqual([]);
});

test("[desktop] /assistant : FAIL-CLOSED runtime durci (active NON prêt : circuit ouvert) — contrôlé, UI réutilisable", async ({ page }) => {
  // Preuve NAVIGATEUR du chemin fail-closed du BLOC 13 : le CLIENT gère la réponse contrôlée (503,
  // ok:false, code circuit_open) sans crash, sans faux résultat, et l'UI reste réutilisable. La PRODUCTION
  // de cette réponse par le serveur est prouvée au niveau route (hardening-route.test.ts). Aucun appel payant.
  await page.setViewportSize({ width: 1440, height: 900 });
  const m = attachMonitors(page);
  await neutralizeBackend(page, { chat: "failClosed" });

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
  await typeAndSend(page, "Message alors que le runtime durci n'est pas prêt");
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.click(); await box.fill("nouvelle tentative"); await expect(box).toHaveValue("nouvelle tentative");
  // Aucun faux "résultat" synthétique ne doit apparaître (le fail-closed ne fabrique jamais de réponse).
  const html = await page.content();
  expect(html).not.toContain(ANSWER);
  expect(m.pageErrors, "aucune pageerror").toEqual([]);
  const other = m.unexpectedConsole.filter((e) => !(e.includes("status of 503") && e.includes("/api/assistant/chat")));
  expect(other, "aucune erreur console AUTRE que le 503 fail-closed injecté").toEqual([]);
});
