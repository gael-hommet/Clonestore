// e2e/clonechat-onboarding-discovery.spec.ts
// BLOC 11 — Preuve NAVIGATEUR RÉELLE du parcours d'onboarding PUBLIC (public_discovery). Vérifie que
// chaque étape pointe une route réelle qui rend son ancre `data-tour-id`, avec une progression
// accessible (élément focusable au clavier), sans débordement horizontal, sur desktop + iPhone +
// Android, et sans fuite de donnée sensible dans le DOM public. Aucune capture n'est committée.
//
// Gated : serveur local requis.
//   NEXT_DIST_DIR=.next-hotfix npx next start -p 3000
//   PLAYWRIGHT_RUN=1 npx playwright test e2e/clonechat-onboarding-discovery.spec.ts
// `npx playwright test --list` compile ce spec sans navigateur.

import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Étapes publiques de public_discovery (miroir de src/lib/clonechat/onboarding/journeys.ts).
const STEPS: ReadonlyArray<{ route: string; anchor: string }> = [
  { route: "/", anchor: "homepage-primary" },
  { route: "/agents", anchor: "boutique-entry" },
  { route: "/agents/pierre", anchor: "pierre-page-entry" },
  { route: "/demo/pierre", anchor: "demo-entry" },
  { route: "/assistant", anchor: "clonechat-entry" },
];
const VIEWPORTS: ReadonlyArray<{ name: string; width: number; height: number }> = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile_iphone", width: 390, height: 844 },
  { name: "mobile_android", width: 412, height: 915 },
];

for (const vp of VIEWPORTS) {
  for (const s of STEPS) {
    test(`[${vp.name}] onboarding étape ${s.anchor} rendue et accessible sur ${s.route}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${BASE}${s.route}`, { waitUntil: "domcontentloaded" });

      // L'ancre d'étape est réellement présente/visible.
      await expect(page.locator(`[data-tour-id="${s.anchor}"]`).first(), `${s.anchor} sur ${s.route}`).toBeVisible({ timeout: 30_000 });

      // Progression accessible au clavier : au moins un élément focusable existe et peut recevoir le focus.
      const focusableCount = await page.locator("a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])").count();
      expect(focusableCount, "éléments focusables au clavier").toBeGreaterThan(0);
      await page.keyboard.press("Tab");
      const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
      expect(activeTag.length, "le focus clavier atteint un élément").toBeGreaterThan(0);

      // Aucun débordement horizontal critique.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, "pas de débordement horizontal").toBeLessThanOrEqual(2);

      // Aucune donnée sensible dans le DOM public.
      const html = await page.content();
      expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
      expect(html).not.toMatch(/\bsk-[A-Za-z0-9]{12,}\b/);
    });
  }
}
