// GO-LIVE 05 — /demo/pierre — content + safety tests.
// REWRITTEN for the ZERO-SCROLL PLAYER rebuild. The page is now a thin client shell
// that renders <DemoPlayer/> (a single-viewport, 6-scene interactive film); the rich
// content lives in src/components/pierre/demo/player/**. All PRODUCT / SAFETY / claims
// / legal guardrails are PRESERVED — they are simply asserted against the player tree
// (page + player components) instead of the old long-page body. Only the assertions
// that protected the OLD stacked layout were changed to the new zero-scroll contract.
// Safe: no AI, no Supabase, no Stripe, no real data — readFileSync only.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const readDemoPage = () => read("src/app/demo/pierre/page.tsx");
const readNewScenarios = () => read("src/lib/pierre/demo/demo-scenarios.ts");
const readLegacyScenarios = () => read("src/lib/demo/public-demo/demo-scenario.ts");

// The whole player tree (page + every player component/scene/overlay) — the new home
// of the copy that used to sit inline in the page body.
function playerTree(): string {
  const dir = join(ROOT, "src/components/pierre/demo/player");
  const files = (readdirSync(dir, { recursive: true }) as unknown as string[]).filter((f) => /\.tsx?$/.test(String(f)) && !String(f).includes("__tests__"));
  return [readDemoPage(), ...files.map((f) => read(join("src/components/pierre/demo/player", String(f))))].join("\n\n");
}
const TREE = playerTree();
const css = read("src/app/demo/pierre/pierre-demo.css");

// ── Page existence and fundamentals ──────────────────────────────────────────
describe("pierre-demo — page existence and structure", () => {
  it("/demo/pierre page exists and is substantial", () => {
    expect(readDemoPage().length).toBeGreaterThan(2000);
  });
  it("page is a client shell rendering the interactive player", () => {
    const page = readDemoPage();
    expect(page).toMatch(/^"use client";/);
    expect(page).toContain("DemoPlayer");
  });
  it("page mentions Pierre", () => {
    expect(readDemoPage()).toMatch(/pierre/i);
  });
  it("the player tree mentions 449 (price truth, from commercial-state)", () => {
    expect(TREE).toMatch(/449|FOUNDER_PRICE_MONTHLY/);
  });
  it("the player tree mentions démonstration illustrative", () => {
    expect(TREE).toMatch(/illustrative|illustratif/i);
  });
  it("the player tree mentions données fictives", () => {
    expect(TREE).toMatch(/fictives?|fictif/i);
  });
  it("the player tree mentions validation humaine", () => {
    expect(TREE).toMatch(/validation humaine/i);
  });
});

// ── Demo content: core concepts ───────────────────────────────────────────────
describe("pierre-demo — core content", () => {
  it("the player tree mentions mission, tâches, document, trace", () => {
    expect(TREE).toMatch(/mission/i);
    expect(TREE).toMatch(/tâches?/i);
    expect(TREE).toMatch(/document/i);
    expect(TREE).toMatch(/trace/i);
  });
});

// ── Zero-scroll paradigm (replaces the old "stacked/grid layout" assertions) ──
describe("pierre-demo — zero-scroll player contract", () => {
  it("the root player is exactly one viewport and never scrolls the page", () => {
    expect(css).toMatch(/\.pdp-root\b[\s\S]*height:\s*100dvh/);
    expect(css).toMatch(/\.pdp-root\b[\s\S]*overflow:\s*hidden/);
    expect(css).toMatch(/\.pdp-root\b[\s\S]*flex-direction:\s*column/);
  });
  it("the scene area is a bounded flex child (flex:1; min-height:0; overflow:hidden)", () => {
    expect(css).toMatch(/\.pdp-stage\b[\s\S]*min-height:\s*0/);
    expect(css).toMatch(/\.pdp-stage\b[\s\S]*overflow:\s*hidden/);
  });
  it("scenes switch via React state, not by scrolling to anchors", () => {
    expect(TREE).toContain("SceneViewport");
    expect(TREE).not.toMatch(/scrollIntoView/);
  });
});

// ── Scenarios (new library) ───────────────────────────────────────────────────
describe("pierre-demo — scenarios (new library)", () => {
  it("exposes three scenarios with the expected ids", () => {
    const lib = readNewScenarios();
    expect(lib).toMatch(/id:\s*"semaine_rh"/);
    expect(lib).toMatch(/id:\s*"recrutement"/);
    expect(lib).toMatch(/id:\s*"contrat_sensible"/);
    const ids = lib.match(/id:\s*"(semaine_rh|recrutement|contrat_sensible)"/g);
    expect(ids?.length).toBe(3);
  });
  it("the recommended scenario is the default ('une semaine RH')", () => {
    const lib = readNewScenarios();
    expect(lib).toMatch(/recommended:\s*true/);
    expect(lib).toContain('DEFAULT_SCENARIO_ID = "semaine_rh"');
  });
  it("covers onboarding, recruitment and sensitive-contract narratives", () => {
    const lib = readNewScenarios();
    expect(lib).toMatch(/onboarding/i);
    expect(lib).toMatch(/recrutement|commercial/i);
    expect(lib).toMatch(/avenant/i);
  });
});

// ── Legacy public-demo library (unchanged — must remain intact) ───────────────
describe("demo-scenario legacy library — backwards compatibility", () => {
  it("library still has scenario_recrutement", () => {
    expect(readLegacyScenarios()).toContain("scenario_recrutement");
  });
  it("library still has scenario_absence_justificatif", () => {
    expect(readLegacyScenarios()).toContain("scenario_absence_justificatif");
  });
  it("original scenario_rh_onboarding still present", () => {
    expect(readLegacyScenarios()).toContain("scenario_rh_onboarding");
  });
  it("scenarios remain illustrative and non-real-data", () => {
    const lib = readLegacyScenarios();
    const block = lib.slice(lib.indexOf("scenario_recrutement"));
    expect(block).toContain("is_illustrative: true");
    expect(block).toContain("uses_real_data: false");
  });
});

// ── Navigation and links ──────────────────────────────────────────────────────
// The player consumes the canonical DEMO_CTA_DESTINATIONS constants; asserting the
// references + their resolved values proves the links are real (no dead links).
describe("pierre-demo — navigation links", () => {
  it("references the discover destination (/agents/pierre)", () => {
    expect(TREE).toContain("DEMO_CTA_DESTINATIONS.discover");
    expect(DEMO_CTA_DESTINATIONS.discover).toBe("/agents/pierre");
  });
  it("references the reservation route (/reserver/pierre)", () => {
    expect(TREE).toContain("DEMO_CTA_DESTINATIONS.reserve");
    expect(DEMO_CTA_DESTINATIONS.reserve).toBe("/reserver/pierre");
  });
  it("references legal CGV/CGU + confidentialité", () => {
    expect(TREE).toMatch(/DEMO_CTA_DESTINATIONS\.legal_/);
    expect(DEMO_CTA_DESTINATIONS.legal_cgv).toMatch(/\/legal\/cg[vu]/i);
    expect(DEMO_CTA_DESTINATIONS.legal_privacy).toBe("/legal/confidentialite");
  });
  it("player has a reserve CTA", () => {
    expect(TREE).toMatch(/Réserver Pierre/);
  });
});

// ── Safety rules — no forbidden API calls ─────────────────────────────────────
describe("pierre-demo — no external API calls", () => {
  it("no OpenAI API call", () => {
    expect(TREE).not.toMatch(/https:\/\/api\.openai\.com/i);
  });
  it("no Anthropic API call", () => {
    expect(TREE).not.toMatch(/api\.anthropic\.com/i);
  });
  it("no Stripe live call", () => {
    expect(TREE).not.toMatch(/https:\/\/api\.stripe\.com/i);
    expect(TREE).not.toMatch(/sk_live_/i);
  });
  it("no Supabase write call", () => {
    expect(TREE).not.toMatch(/\.from\(.*\)\.insert|\.from\(.*\)\.upsert|\.from\(.*\)\.update/);
  });
  it("no fetch to external APIs", () => {
    const nonComment = TREE.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(nonComment).not.toMatch(/fetch\s*\(\s*["']https:\/\/api\./);
  });
});

// ── Safety rules — no proof or launch flag modification ───────────────────────
describe("pierre-demo — no proof or launch flag modification", () => {
  it("no public launch flag set to true", () => {
    expect(TREE).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });
  it("no proof auto-verified", () => {
    expect(TREE).not.toMatch(/markProofVerified/);
    expect(TREE).not.toMatch(/status.*["']verified["']/);
  });
});

// ── Safety rules — no forbidden copy ─────────────────────────────────────────
describe("pierre-demo — no forbidden commercial claims", () => {
  it("no 'zéro erreur' claim", () => {
    expect(TREE).not.toMatch(/zéro erreur/i);
  });
  it("no 'conformité garantie' claim", () => {
    expect(TREE).not.toMatch(/conformité garantie/i);
  });
  it("no 'remplace avocat' claim", () => {
    expect(TREE).not.toMatch(/remplace (?:un |votre )?avocat(?! ni)/i);
  });
  it("no 'DSN autonome' claim", () => {
    expect(TREE).not.toMatch(/DSN autonome/i);
  });
  it("no 'paie officielle' claim", () => {
    expect(TREE).not.toMatch(/paie officielle|bulletins? de paie officiels?/i);
  });
  it("no 'licenciement automatique' claim", () => {
    expect(TREE).not.toMatch(/licenciement automatique/i);
  });
  it("no 'essai gratuit 7 jours open-bar' claim", () => {
    expect(TREE).not.toMatch(/essai gratuit.*7 jours|7 jours.*gratuit|open.bar/i);
  });
});

// ── Responsive / mobile-own-composition (replaces old grid-cols assertions) ───
describe("pierre-demo — responsive design", () => {
  it("the player CSS sizes with dvh/clamp and defines a mobile composition", () => {
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/clamp\(/);
    expect(css).toMatch(/@media\s*\(max-width:\s*720px\)/);
  });
  it("does not rely on a horizontal-scrolling table layout", () => {
    expect(TREE).not.toMatch(/<table/);
  });
});
