// e2e/clonechat-inspector-capture.spec.ts
// BLOC 10 — Preuve RÉELLE : capture d'une vraie page publique CloneStore + validation BINAIRE par
// CloneInspector (validateEvidence). La capture est prise par le navigateur dans un dossier temporaire
// HORS-REPO (jamais committée), puis ses OCTETS réels passent par la validation : format, dimensions,
// hash, association à la route fournie, absence de donnée sensible. La compréhension sémantique
// (vision) utilise le mock déterministe dans le gate unitaire ; ici on prouve la chaîne binaire.
//
// Gated (comme les autres specs Playwright) : nécessite un serveur local.
//   NEXT_DIST_DIR=.next-hotfix npx next start -p 3000
//   PLAYWRIGHT_RUN=1 npx playwright test e2e/clonechat-inspector-capture.spec.ts
// `npx playwright test --list` compile ce spec sans navigateur (preuve d'importabilité).

import { test, expect } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { validateEvidence } from "../src/lib/clonechat/inspector/evidence-validate";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = process.env.INSPECTOR_CAPTURE_DIR ?? join(tmpdir(), "clonechat-inspector-captures");

const PUBLIC_PAGES: ReadonlyArray<{ route: string; anchor: string }> = [
  { route: "/demo/pierre", anchor: "demo-entry" },
  { route: "/", anchor: "homepage-primary" },
];

for (const page_ of PUBLIC_PAGES) {
  test(`capture réelle ${page_.route} → validation binaire CloneInspector`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}${page_.route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-tour-id="${page_.anchor}"]`).first()).toBeVisible({ timeout: 30_000 });

    const path = join(OUT_DIR, `capture${page_.route.replace(/[^a-z0-9]+/gi, "_")}.png`);
    await page.screenshot({ path, fullPage: false }); // HORS-REPO, jamais committée

    const bytes = new Uint8Array(await readFile(path));
    // Validation BINAIRE réelle par CloneInspector.
    const v = validateEvidence({
      id: "capture-1", origin: "generated_capture", name: "capture.png",
      declaredMime: "image/png", extension: "png", bytes: bytes.length, content: bytes, route: page_.route,
    });
    expect(v.state, "capture réelle validée").toBe("valid");
    expect(v.type).toBe("image");
    expect(v.detectedMime).toBe("image/png");
    expect(v.width, "largeur réelle mesurée").toBeGreaterThan(0);
    expect(v.height, "hauteur réelle mesurée").toBeGreaterThan(0);
    expect(v.route, "route associée réelle").toBe(page_.route);
    expect(v.hash, "hash déterministe présent").toMatch(/^ev_/);

    // Reproductibilité du hash : re-valider les mêmes octets → même hash.
    const v2 = validateEvidence({ id: "capture-1b", origin: "generated_capture", name: "capture.png", declaredMime: "image/png", extension: "png", bytes: bytes.length, content: bytes, route: page_.route });
    expect(v2.hash).toBe(v.hash);

    // Aucune donnée sensible dans le DOM public capturé.
    const html = await page.content();
    expect(html).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{8,}/);
    expect(html).not.toMatch(/\bsk-[A-Za-z0-9]{12,}\b/);
  });
}
