// QA cadrage /demo — Passe D (§12).
// Vérifie qu'aucun titre/carte critique n'est sous le header ni coupé par le
// viewport, à plusieurs progressions de scroll, sur les dimensions obligatoires.
//
// Gated : nécessite un runner Playwright + un serveur local.
//   npm run build && npm run start    (serveur sur :3000)
//   npx playwright test e2e/demo-framing.spec.ts
// (Non inclus dans `npm test` / vitest — comme les autres specs Playwright du repo.)

import { test, expect } from "@playwright/test";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const SCENES = [
  "demo-opening", "demo-fragmentation", "demo-category", "demo-system",
  "demo-footprint", "demo-scale", "demo-trust", "demo-pierre-scope",
  "demo-organization", "demo-completion",
];
const SIZES = [
  { w: 1918, h: 1078 }, { w: 1440, h: 900 }, { w: 1280, h: 720 },
  { w: 1024, h: 768 }, { w: 768, h: 1024 }, { w: 430, h: 932 }, { w: 375, h: 667 },
];

for (const size of SIZES) {
  test(`framing ${size.w}x${size.h}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html{scroll-behavior:auto !important;}" });
    await page.waitForTimeout(500);

    const desktop = size.w >= 1024;
    const headerH = await page.evaluate(
      () => Math.round(document.querySelector(".cs-header")!.getBoundingClientRect().height),
    );
    const fracs = desktop ? [0.12, 0.5, 0.95] : [1];

    for (const id of SCENES) {
      for (const frac of fracs) {
        if (desktop) {
          await page.evaluate(
            ({ id, frac }) => {
              const el = document.getElementById(id)!;
              const top = el.getBoundingClientRect().top + window.scrollY;
              const sc = Math.max(0, el.offsetHeight - window.innerHeight);
              window.scrollTo(0, Math.round(top + sc * frac));
            },
            { id, frac },
          );
        } else {
          await page.evaluate((id) => document.getElementById(id)!.scrollIntoView({ block: "start" }), id);
        }
        await page.waitForTimeout(320);

        const issues = await page.evaluate(
          ({ id, headerH, desktop }) => {
            const vh = window.innerHeight, vw = window.innerWidth, out: string[] = [];
            const sec = document.getElementById(id)!;
            const vis = (r: DOMRect) => r.bottom > 2 && r.top < vh - 2 && r.width > 0;
            const title = sec.querySelector("[data-demo-title]");
            if (title) {
              const r = title.getBoundingClientRect();
              if (vis(r) && desktop && r.top < headerH - 1) out.push(`${id} title under header`);
              if (vis(r) && r.bottom > vh) out.push(`${id} title cut bottom`);
            }
            if (desktop) {
              sec.querySelectorAll(".demo-glass").forEach((c) => {
                const r = c.getBoundingClientRect();
                if (!vis(r)) return;
                if (r.top < headerH - 8) out.push(`${id} card under header`);
                if (r.bottom > vh + 8) out.push(`${id} card cut bottom`);
                if (r.right > vw + 2 || r.left < -2) out.push(`${id} card x-overflow`);
              });
            }
            return out;
          },
          { id, headerH, desktop },
        );
        expect(issues, `scene ${id} @ ${frac}`).toEqual([]);
      }
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
  });
}
