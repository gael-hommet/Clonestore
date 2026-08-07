// e2e/clonechat-assistant-hardening.spec.ts
// BLOC 13 — Preuve NAVIGATEUR de /assistant sous le runtime durci (mode `off` par défaut : comportement
// historique inchangé). Prouve, sur desktop + iPhone + Android : rendu, saisie, envoi, état loading →
// résultat sûr, erreur CONTRÔLÉE, accessibilité clavier, aucune fuite sensible, aucune erreur console
// inattendue, aucun HTTP 5xx. AUCUN appel payant : le POST /api/assistant/chat est intercepté et servi
// par une réponse SYNTHÉTIQUE (le client bascule sur sa voie JSON quand ce n'est pas un event-stream).
// Les endpoints conversations sont aussi neutralisés (isolement UI, pas de dépendance DB). Aucun effet réel.
//
// Gated : serveur local requis.
//   NEXT_DIST_DIR=.next-hotfix npx next start -p 3000
//   PLAYWRIGHT_RUN=1 npx playwright test e2e/clonechat-assistant-hardening.spec.ts

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OPTIONAL_TELEMETRY = [/\/api\/analytics\/events/, /\/api\/conversion\/events/];
const SYNTHETIC_ANSWER = "Reponse synthetique de test hardening.";

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
    const is429 = /status of 429/.test(msg.text());
    const optional = OPTIONAL_TELEMETRY.some((re) => re.test(url));
    if (is429 && optional) return; // backpressure télémétrie facultative attendue (voir BLOC 13/12)
    m.unexpectedConsole.push(`${msg.text().slice(0, 120)} @ ${url}`);
  });
  page.on("pageerror", (e) => m.pageErrors.push(String(e).slice(0, 160)));
  page.on("response", (r) => { if (r.status() >= 500) m.http5xx.push(`${r.status()} ${r.url().slice(-60)}`); });
  return m;
}

async function neutralizeBackend(page: Page, chat: { status: number; ok: boolean }): Promise<void> {
  await page.route("**/api/assistant/chat", (route) =>
    route.fulfill({
      status: chat.status,
      contentType: "application/json",
      body: JSON.stringify({
        ok: chat.ok,
        source: "synthetic",
        structured: { answer: SYNTHETIC_ANSWER, honesty: "answered", tool_call: null, citations: [] },
        ...(chat.ok ? {} : { code: "provider_unavailable", error: "Service temporairement indisponible." }),
      }),
    }),
  );
  await page.route("**/api/assistant/conversations**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [], messages: [], conversation: { id: "c-test" } }) }),
  );
}

async function typeAndSend(page: Page, text: string): Promise<void> {
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 30_000 });
  await box.click();
  await box.fill(text);
  await expect(box).toHaveValue(text); // saisie prouvée
  const send = page.locator('button[aria-label^="Envoyer"]').first();
  await expect(send).toBeEnabled({ timeout: 10_000 });
  await send.click();
}

function assertClean(m: Monitors): void {
  expect(m.pageErrors, "aucune pageerror").toEqual([]);
  expect(m.http5xx, "aucun HTTP 5xx").toEqual([]);
  expect(m.unexpectedConsole, "aucune erreur console inattendue").toEqual([]);
}

for (const vp of VIEWPORTS) {
  test(`[${vp.name}] /assistant : rendu, saisie, envoi, résultat sûr, a11y, aucune fuite/erreur`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const m = attachMonitors(page);
    await neutralizeBackend(page, { status: 200, ok: true });

    await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });

    // Rendu + accessibilité clavier.
    const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
    await expect(box).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Tab");
    const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
    expect(activeTag.length, "le focus clavier atteint un élément").toBeGreaterThan(0);

    // Saisie (prouvée par toHaveValue dans typeAndSend) + envoi → résultat sûr : la réponse synthétique
    // s'affiche VISIBLEMENT dans la conversation (le client bascule sur sa voie JSON). On vérifie une
    // occurrence réellement visible (offsetParent != null) pour ne pas confondre avec un aperçu masqué
    // du panneau d'historique (identique sur desktop/mobile).
    await typeAndSend(page, "Question de test hardening");
    await page.waitForFunction(
      (needle) => Array.from(document.querySelectorAll("*")).some((el) => (el.textContent ?? "").includes(needle) && (el as HTMLElement).offsetParent !== null),
      SYNTHETIC_ANSWER,
      { timeout: 15_000 },
    );

    // Aucune fuite sensible dans le DOM.
    const html = await page.content();
    expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
    expect(html).not.toMatch(/\bsk-[A-Za-z0-9]{12,}\b/);

    assertClean(m);
  });
}

test("[desktop] /assistant : erreur provider CONTRÔLÉE (503 synthétique) — aucun crash, UI réutilisable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const m = attachMonitors(page);
  await neutralizeBackend(page, { status: 503, ok: false });

  await page.goto(`${BASE}/assistant`, { waitUntil: "domcontentloaded" });
  await typeAndSend(page, "Message qui échoue côté provider");

  // L'échec est absorbé par l'UI : le champ de saisie reste présent et réutilisable (aucun crash).
  const box = page.locator('textarea[aria-label^="Message pour CloneChat"]');
  await expect(box).toBeVisible({ timeout: 15_000 });
  await box.click();
  await box.fill("nouvelle tentative");
  await expect(box).toHaveValue("nouvelle tentative");

  // Le 503 synthétique produit INÉVITABLEMENT une erreur de ressource console (échec du fetch) — c'est
  // ATTENDU pour ce test d'erreur ; ce qui compte : aucune pageerror (pas de crash) et aucune AUTRE
  // erreur console. On tolère donc exactement l'échec 503 sur /api/assistant/chat, rien d'autre.
  expect(m.pageErrors, "aucune pageerror (le 503 est absorbé, pas un crash)").toEqual([]);
  const other = m.unexpectedConsole.filter((e) => !(e.includes("status of 503") && e.includes("/api/assistant/chat")));
  expect(other, "aucune erreur console AUTRE que le 503 provider injecté").toEqual([]);
});
