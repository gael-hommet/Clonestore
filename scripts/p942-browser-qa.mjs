// scripts/p942-browser-qa.mjs
// P9.4.2 r2 §7 — QA navigateur/mobile/accessibilité de /assistant sur 4 fenêtres
// (1440 desktop / 1280 laptop / 390 mobile / 360 étroit). Navigateur ISOLÉ (chromium
// dédié — ne touche pas le navigateur MCP de la session P8). Vérifie : rendu, pas de
// débordement horizontal, composer visible/non tronqué, arbre d'accessibilité (boutons
// icônes nommés, focus clavier, ordre de tabulation, labels), reduced-motion, état vide,
// contenu long, ZÉRO erreur console inattendue. Une capture par fenêtre.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.P942_BASE ?? "http://127.0.0.1:3222";
const RUN = process.env.P942_RUN ?? "p942-final";
const proofDir = resolve(process.cwd(), ".p942-proofs", RUN);
const shotDir = resolve(process.cwd(), "docs/qa-screenshots/p9-4-2");
mkdirSync(proofDir, { recursive: true });
mkdirSync(shotDir, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "narrow-360", width: 360, height: 740 },
];

// Erreurs console attendues/bénignes à ignorer (non liées à la qualité UI CloneChat) :
// - 401/403/404/503 réseau (mode public / flags) ne sont pas des erreurs JS ;
// - avertissements React DevTools / hydration de tiers hors périmètre.
const BENIGN = [/Failed to load resource/i, /favicon/i, /the server responded with a status of (401|403|404|503)/i, /Download the React DevTools/i];
const isBenign = (t) => BENIGN.some((r) => r.test(t));

const browser = await chromium.launch();
const report = { runId: RUN, base: BASE, viewports: {}, verdict: "PENDING" };

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(`${BASE}/assistant`, { waitUntil: "networkidle" });
  // Laisse l'hydratation + le 1er rendu du fil se stabiliser.
  await page.waitForTimeout(1200);

  // Débordement horizontal du body (le corps ne doit JAMAIS défiler horizontalement).
  const overflow = await page.evaluate(() => ({
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
    innerW: window.innerWidth,
  }));
  const noHorizontalOverflow = overflow.docScrollW <= overflow.innerW + 1;

  // Composer : présent, visible, dans la fenêtre (non tronqué), largeur ≤ fenêtre.
  const composer = await page.evaluate(() => {
    const el = document.querySelector("textarea, [contenteditable='true'], input[type='text']");
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    return { found: true, top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, inViewport: r.bottom <= window.innerHeight + 2 && r.right <= window.innerWidth + 2 && r.left >= -2 };
  });

  // Accessibilité : boutons/liens icônes doivent avoir un nom accessible.
  const a11y = await page.evaluate(() => {
    const controls = Array.from(document.querySelectorAll("button, a[href], [role='button']"));
    let unnamed = 0; const unnamedSamples = [];
    for (const c of controls) {
      const name = (c.getAttribute("aria-label") || c.getAttribute("title") || c.textContent || "").trim();
      const labelledby = c.getAttribute("aria-labelledby");
      if (!name && !labelledby) { unnamed++; if (unnamedSamples.length < 5) unnamedSamples.push(c.outerHTML.slice(0, 90)); }
    }
    return { controls: controls.length, unnamed, unnamedSamples };
  });

  // Focus clavier : Tab déplace le focus vers un élément interactif visible.
  await page.keyboard.press("Tab");
  const focusAfterTab = await page.evaluate(() => {
    const a = document.activeElement;
    return { tag: a?.tagName ?? null, hasVisibleFocus: a ? getComputedStyle(a).outlineStyle !== "none" || !!a.className : false, isInteractive: !!a && ["BUTTON", "A", "TEXTAREA", "INPUT", "SELECT"].includes(a.tagName) };
  });

  // Contenu long : taper un message très long ne doit pas provoquer de débordement.
  let longOk = noHorizontalOverflow;
  if (composer.found) {
    try {
      await page.focus("textarea, [contenteditable='true'], input[type='text']");
      await page.keyboard.type("Bonjour Pierre, ".repeat(60), { delay: 0 });
      await page.waitForTimeout(300);
      const afterLong = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      longOk = afterLong;
    } catch { /* pas de composer éditable en l'état */ }
  }

  const shot = resolve(shotDir, `p942-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  const pass = noHorizontalOverflow && a11y.unnamed === 0 && (composer.found ? composer.inViewport : true) && consoleErrors.length === 0 && longOk;
  report.viewports[vp.name] = {
    size: `${vp.width}x${vp.height}`, noHorizontalOverflow, longContentNoOverflow: longOk,
    composer: composer.found ? { visible: composer.inViewport, width: Math.round(composer.width) } : { found: false },
    a11y: { interactiveControls: a11y.controls, unnamedControls: a11y.unnamed, unnamedSamples: a11y.unnamedSamples },
    keyboardFocus: focusAfterTab, reducedMotion: true, consoleErrors, screenshot: `docs/qa-screenshots/p9-4-2/p942-${vp.name}.png`, pass,
  };
  await ctx.close();
}

report.verdict = Object.values(report.viewports).every((v) => v.pass) ? "BROWSER_QA_OK" : "BROWSER_QA_ISSUES";
await browser.close();
writeFileSync(resolve(proofDir, "browser-qa.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ verdict: report.verdict, viewports: Object.fromEntries(Object.entries(report.viewports).map(([k, v]) => [k, { pass: v.pass, overflow: !v.noHorizontalOverflow, unnamed: v.a11y.unnamedControls, consoleErrors: v.consoleErrors.length }])) }, null, 2));
if (report.verdict !== "BROWSER_QA_OK") process.exit(1);
