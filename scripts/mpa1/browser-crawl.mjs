// MPA-1 — bounded real browser crawl of NON-MODEL surfaces against the production build.
// Single Chromium instance. Records HTTP / console errors / pageerror / network failures /
// horizontal overflow per route per viewport. Never visits a model-generating flow to "prove"
// an answer (OpenAI is quota-blocked); auth-gated routes correctly redirect to /login in a
// production build (dev bypass is dead in prod) and that redirect is the expected secure result.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.MPA1_BASE || "http://localhost:3790";

// Representative product surfaces across the census (public + demo + auth-gated + legal + payment entry).
const ROUTES = [
  { path: "/", authExpected: false },
  { path: "/demo", authExpected: false, expectTechnologies: true },
  { path: "/comprendre-clonestore", authExpected: false },
  { path: "/agents", authExpected: false },
  { path: "/agents/pierre", authExpected: false },
  { path: "/questions", authExpected: false },
  { path: "/reserver/pierre", authExpected: false },
  { path: "/founding-partners", authExpected: false },
  { path: "/legal/cgv", authExpected: false },
  { path: "/legal/confidentialite", authExpected: false },
  { path: "/profile/technologies", authExpected: true },
  { path: "/profile/agents", authExpected: true },
  { path: "/cockpit/pierre", authExpected: true },
];

const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "desktop-1920", width: 1920, height: 1080 },
  { label: "mobile-390", width: 390, height: 844 },
  { label: "mobile-430", width: 430, height: 932 },
];

const results = { base: BASE, entries: [], failed: false };
const browser = await chromium.launch({ headless: true });

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const r of ROUTES) {
    const page = await context.newPage();
    const consoleErrors = [], pageErrors = [], netFail = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("requestfailed", (req) => { const u = req.url(); if (!/_rsc=/.test(u)) netFail.push({ url: u, err: req.failure()?.errorText }); });
    const entry = { route: r.path, viewport: vp.label, http: null, finalUrl: null, redirectedToLogin: null, overflow: null, consoleErrors: 0, pageErrors: 0, netFail: 0, techCount: null, ok: true, notes: [] };
    try {
      const resp = await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle", timeout: 45000 });
      entry.http = resp ? resp.status() : null;
      await page.waitForTimeout(600);
      entry.finalUrl = page.url();
      entry.redirectedToLogin = entry.finalUrl.includes("/login");
      entry.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5).catch(() => null);
      if (r.expectTechnologies) {
        const html = await page.content();
        entry.techCount = ["CloneOS","CloneADN","CloneGuard","CloneTrace","CloneVoice","CloneChat","ClonePolicy","CloneContinuum","CloneTrust","CloneReview","CloneSignals","CloneLearn","CloneBrief","CloneCall","CloneRoom"].filter((n) => html.includes(n)).length;
      }
      // Auth-gated route in a production build MUST redirect to /login (dev bypass dead in prod).
      if (r.authExpected && !entry.redirectedToLogin) { entry.notes.push("auth-gated route did NOT redirect to /login in prod build"); }
    } catch (e) { entry.notes.push("nav error: " + String(e).slice(0, 80)); entry.ok = false; results.failed = true; }
    entry.consoleErrors = consoleErrors.length;
    entry.pageErrors = pageErrors.length;
    entry.netFail = netFail.length;
    // Fail conditions: server error, pageerror, hard overflow, or nav failure. Console/net noise recorded but 4xx-on-auth is expected.
    if ((entry.http !== null && entry.http >= 500)) { entry.ok = false; results.failed = true; entry.notes.push("HTTP>=500"); }
    if (entry.pageErrors > 0) { entry.ok = false; results.failed = true; entry.notes.push("pageerror"); }
    if (entry.overflow === true) { entry.ok = false; results.failed = true; entry.notes.push("horizontal overflow"); }
    results.entries.push(entry);
    await page.close();
  }
  await context.close();
}
await browser.close();

// Summaries
const bad = results.entries.filter((e) => !e.ok);
const pageErrTotal = results.entries.reduce((s, e) => s + e.pageErrors, 0);
const overflowTotal = results.entries.filter((e) => e.overflow === true).length;
const authRedirects = results.entries.filter((e) => e.redirectedToLogin).length;
results.summary = {
  routesCrawled: ROUTES.length, viewports: VIEWPORTS.length, totalObservations: results.entries.length,
  failing: bad.length, totalPageErrors: pageErrTotal, totalHorizontalOverflow: overflowTotal,
  authGatedCorrectlyRedirected: authRedirects,
  demoTechCount: results.entries.filter((e) => e.techCount != null).map((e) => e.techCount),
};
writeFileSync("C:/Users/homme/clonestore/.mpa1-proofs/MPA1_BROWSER_RESULTS.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
console.log("FAILED=" + results.failed);
process.exit(results.failed ? 1 : 0);
