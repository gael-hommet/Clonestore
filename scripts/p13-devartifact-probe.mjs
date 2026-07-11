// scripts/p13-devartifact-probe.mjs — isole les artefacts dev/navigateur : charge des pages PUBLIQUES
// (pré-P12, sans auth) et capture console.error + pageerror BRUTS (aucun filtre). Si les mêmes signatures
// (hydration caret-color, "Invalid or unexpected token") apparaissent sur le site public, ce sont des
// artefacts globaux dev/Playwright, PAS des régressions P12/P13.
import { chromium } from "playwright";
const BASE = process.env.P13_BASE ?? "http://127.0.0.1:3273";
const pages = ["/", "/agents/pierre", "/login"];
const browser = await chromium.launch();
const out = {};
for (const p of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 120)); });
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 120)));
  await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => errs.push("goto-fail: " + e.message.slice(0, 80)));
  await page.waitForTimeout(2500);
  out[p] = {
    caretColorHydration: errs.some((e) => /hydrat|caret-color/i.test(e)),
    invalidToken: errs.some((e) => /Invalid or unexpected token/i.test(e)),
    sample: errs.slice(0, 6),
  };
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
