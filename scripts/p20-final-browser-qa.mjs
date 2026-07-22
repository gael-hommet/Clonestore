// scripts/p20-final-browser-qa.mjs
// P20 — real local Playwright QA, desktop + mobile, against a local server.
// Never touches production/remote DB, never visits /assistant, single browser instance,
// closes cleanly, writes JSON proof, exits 1 on a real control failure.
//
// AUTH: uses ONLY the repository's pre-existing dev/test bypass (NEXT_PUBLIC_E2E_BYPASS_AUTH=1),
// which src/lib/auth/dev-bypass.ts hard-gates behind `NODE_ENV !== "production"` — it is dead
// code in a production build. No new bypass is introduced by this script.

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE_URL = process.env.P20_QA_BASE_URL || "http://localhost:3779";
const AUTHENTICATED = process.env.P20_QA_AUTHENTICATED === "1";

// The three surfaces classified REAL_TECH_SURFACE in P20_2_SURFACE_MAP.json.
// `tabbed: true` means only the active tab's content is in visible innerText, so presence is
// asserted against the rendered DOM/HTML instead (the technologies are real, just not all visible
// at once). This is a measurement choice, never a relaxation: absence in the HTML still fails.
const SURFACES = [
  { route: "/profile/technologies", authRequired: true, tabbed: false },
  { route: "/profile/agents", authRequired: true, tabbed: false },
  { route: "/demo", authRequired: false, tabbed: true },
];

// The canonical public technology set — the assertion target for every surface.
const CANONICAL_IDS = [
  "cloneos", "cloneadn", "clonecontinuum", "clonepolicy", "clonesignals",
  "cloneguard", "clonetrace", "clonetrust", "clonereview", "clonebrief", "clonelearn",
  "clonechat", "clonevoice", "clonecall", "cloneroom",
];
const DISPLAY_NAMES = {
  cloneos: "CloneOS", cloneadn: "CloneADN", clonecontinuum: "CloneContinuum",
  clonepolicy: "ClonePolicy", clonesignals: "CloneSignals", cloneguard: "CloneGuard",
  clonetrace: "CloneTrace", clonetrust: "CloneTrust", clonereview: "CloneReview",
  clonebrief: "CloneBrief", clonelearn: "CloneLearn", clonechat: "CloneChat",
  clonevoice: "CloneVoice", clonecall: "CloneCall", cloneroom: "CloneRoom",
};

const results = { baseUrl: BASE_URL, authenticated: AUTHENTICATED, surfaces: [] };
let failed = false;
const fail = (entry, msg) => { entry.assertionFailures.push(msg); failed = true; };

const browser = await chromium.launch({ headless: true });

async function testSurface(surface, viewport, label) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const networkFailures = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) => networkFailures.push({ url: r.url(), failure: r.failure()?.errorText }));

  const entry = {
    route: surface.route, label, viewport,
    httpStatus: null, finalUrl: null, redirectedToLogin: null,
    hasHorizontalOverflow: null, technologiesFound: [], technologiesMissing: [],
    duplicateTechnologies: [], forbiddenCountText: [], assertionFailures: [],
    consoleErrors: [], pageErrors: [], networkFailures: [], error: null,
  };

  try {
    const resp = await page.goto(`${BASE_URL}${surface.route}`, { waitUntil: "networkidle", timeout: 180000 });
    entry.httpStatus = resp ? resp.status() : null;
    await page.waitForTimeout(1500);
    entry.finalUrl = page.url();
    entry.redirectedToLogin = entry.finalUrl.includes("/login");
    entry.title = await page.title().catch(() => null);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    entry.bodyTextSample = bodyText.slice(0, 300);
    entry.hasHorizontalOverflow = await page
      .evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 5)
      .catch(() => null);

    if (surface.authRequired && entry.redirectedToLogin) {
      if (AUTHENTICATED) fail(entry, "Authenticated run still redirected to /login — the dev bypass did not apply.");
    } else {
      // Content assertions: every canonical technology must be present on the surface.
      const haystack = surface.tabbed ? await page.content() : bodyText;
      entry.assertedAgainst = surface.tabbed ? "rendered HTML (tabbed surface)" : "visible text";
      for (const id of CANONICAL_IDS) {
        const name = DISPLAY_NAMES[id];
        const occurrences = (haystack.match(new RegExp(name, "g")) || []).length;
        if (occurrences === 0) entry.technologiesMissing.push(id);
        else entry.technologiesFound.push(id);
      }
      if (entry.technologiesMissing.length > 0) {
        fail(entry, `Missing technologies: ${entry.technologiesMissing.join(", ")}`);
      }

      // No stale public count of 13 or 14 anywhere in the rendered text.
      for (const bad of [/\b13\s+(?:couches|technologies)/i, /\b14\s+(?:couches|technologies)/i]) {
        const m = bodyText.match(bad);
        if (m) { entry.forbiddenCountText.push(m[0]); fail(entry, `Stale public count rendered: "${m[0]}"`); }
      }

      // On /profile/agents, assert the canonical inventory data attributes directly.
      if (surface.route === "/profile/agents") {
        const cards = await page.locator("[data-testid^='canonical-tech-']").all();
        entry.canonicalInventoryCount = cards.length;
        if (cards.length !== 15) fail(entry, `Canonical inventory rendered ${cards.length} cards, expected 15.`);
        const seen = new Set();
        for (const card of cards) {
          const id = (await card.getAttribute("data-testid")).replace("canonical-tech-", "");
          if (seen.has(id)) entry.duplicateTechnologies.push(id);
          seen.add(id);
          const ownership = await card.getAttribute("data-ownership");
          const launch = await card.getAttribute("data-launch-status");
          const cfg = await card.getAttribute("data-configuration-state");
          if (id === "clonechat" && ownership !== "EXTERNAL_CLONECHAT_WORKSTREAM") {
            fail(entry, `CloneChat ownership is "${ownership}", expected EXTERNAL_CLONECHAT_WORKSTREAM.`);
          }
          if ((id === "clonecall" || id === "cloneroom")) {
            if (launch !== "À venir") fail(entry, `${id} launchStatus is "${launch}", expected "À venir".`);
            if (cfg !== "NOT_CONFIGURABLE_YET") fail(entry, `${id} configurationState is "${cfg}", expected NOT_CONFIGURABLE_YET.`);
            const text = await card.innerText();
            if (/\d+\s*\/\s*100/.test(text)) fail(entry, `${id} renders a readiness score — must show none.`);
          }
        }
        if (entry.duplicateTechnologies.length > 0) fail(entry, `Duplicate cards: ${entry.duplicateTechnologies.join(", ")}`);
      }
    }
  } catch (err) {
    entry.error = String(err);
    failed = true;
  }

  entry.consoleErrors = consoleErrors;
  entry.pageErrors = pageErrors;
  entry.networkFailures = networkFailures.filter((f) => !/_rsc=/.test(f.url)); // Next prefetch aborts are benign
  if (pageErrors.length > 0) fail(entry, `${pageErrors.length} page error(s).`);
  if (entry.httpStatus !== null && entry.httpStatus >= 500) fail(entry, `HTTP ${entry.httpStatus}.`);
  if (entry.hasHorizontalOverflow === true) fail(entry, "Horizontal overflow.");

  await context.close();
  return entry;
}

for (const surface of SURFACES) {
  results.surfaces.push(await testSurface(surface, { width: 1440, height: 900 }, "desktop"));
  results.surfaces.push(await testSurface(surface, { width: 390, height: 844 }, "mobile"));
}

await browser.close();
results.failed = failed;
writeFileSync(
  "C:/Users/homme/clonestore/.p20-proofs/p20-final/P20_BROWSER_QA_RESULTS.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
process.exit(failed ? 1 : 0);
