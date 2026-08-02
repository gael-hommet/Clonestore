// e2e/clonechat-visual-targets.spec.ts
// BLOC 9 — Preuve NAVIGATEUR RÉELLE des cibles visuelles « verified » de CloneChat.
//
// Une cible n'est « verified » que si sa présence est prouvée par un rendu réel. Ce spec charge les
// routes PUBLIQUES réelles sur un serveur local et vérifie que chaque ancre `data-tour-id` déclarée
// est présente et visible, sur desktop ET mobile. Il produit des captures officielles redigées dans
// un dossier HORS-REPO (jamais committées ; états publics uniquement).
//
// Gated (comme les autres specs Playwright) : nécessite un serveur local.
//   NEXT_DIST_DIR=.next-hotfix npx next start -p 3000
//   PLAYWRIGHT_RUN=1 npx playwright test e2e/clonechat-visual-targets.spec.ts
// `npx playwright test --list` compile ce spec sans navigateur (preuve d'importabilité).

import { test, expect } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
// Captures HORS-REPO (jamais committées) — états publics uniquement.
const CAPTURE_DIR = process.env.VISUAL_CAPTURE_DIR ?? join(tmpdir(), "clonechat-visual-captures");

// Cibles PUBLIQUES vérifiables (miroir de src/lib/clonechat/visual/registry.ts, status "verified").
const PUBLIC_TARGETS: ReadonlyArray<{ id: string; route: string; tourId: string }> = [
  { id: "vt_home", route: "/", tourId: "homepage-primary" },
  { id: "vt_boutique", route: "/agents", tourId: "boutique-entry" },
  { id: "vt_pierre_page", route: "/agents/pierre", tourId: "pierre-page-entry" },
  { id: "vt_clonechat_entry", route: "/assistant", tourId: "clonechat-entry" },
  { id: "vt_clonechat_input", route: "/assistant", tourId: "clonechat-input" },
  { id: "vt_demo", route: "/demo/pierre", tourId: "demo-entry" },
  { id: "vt_login", route: "/login", tourId: "client-space-entry" },
];

const VIEWPORTS: ReadonlyArray<{ name: string; width: number; height: number }> = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile_iphone", width: 390, height: 844 },
  { name: "mobile_android", width: 412, height: 915 },
];

for (const vp of VIEWPORTS) {
  for (const t of PUBLIC_TARGETS) {
    test(`[${vp.name}] cible verified ${t.id} (${t.tourId}) présente sur ${t.route}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}${t.route}`, { waitUntil: "domcontentloaded" });
      const el = page.locator(`[data-tour-id="${t.tourId}"]`).first();
      // La PRÉSENCE/visibilité est la preuve de vérification.
      await expect(el, `${t.tourId} présent sur ${t.route}`).toBeVisible({ timeout: 30_000 });

      // Rectangle RÉELLEMENT mesuré (jamais codé en dur) — seulement quand l'élément a un box de
      // rendu propre. Un conteneur `display:contents` est visible mais sans box : le rect reste
      // alors non mesuré (null), conformément à la doctrine « rectangle seulement s'il est mesuré ».
      const box = await el.boundingBox();
      if (box) {
        expect(box.width, `${t.tourId} largeur mesurée`).toBeGreaterThan(0);
        expect(box.height, `${t.tourId} hauteur mesurée`).toBeGreaterThan(0);
      }
      // Cible ramenée dans le viewport par un scroll normal (best-effort : un conteneur
      // display:contents n'a pas de box scrollable — non bloquant pour la vérification de présence).
      await el.scrollIntoViewIfNeeded().catch(() => { /* wrapper sans box : présence déjà prouvée */ });

      // Aucun débordement horizontal critique.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "pas de débordement horizontal").toBeLessThanOrEqual(2);

      // Capture officielle redigée, HORS-REPO (état public uniquement).
      await page.screenshot({ path: join(CAPTURE_DIR, `${t.id}.${vp.name}.png`), fullPage: false });
    });
  }
}

test("aucune donnée sensible dans le DOM public (token/cookie/bearer)", async ({ page }) => {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const html = await page.content();
  expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
  expect(html).not.toMatch(/\bsk-[A-Za-z0-9]{12,}\b/);
});
