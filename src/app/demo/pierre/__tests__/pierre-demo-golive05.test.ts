// GO-LIVE 05 — /demo/pierre — content + safety tests.
// Updated for the PIERRE FINAL INTERACTIVE DEMO rebuild: the page is now a thin
// client shell that renders <PierreDemoExperience/>, with scenarios living in
// src/lib/pierre/demo/. All SAFETY / claims / links guardrails are preserved;
// only scenario-identity assertions point at the new scenario library.
// Safe: no AI, no Supabase, no Stripe, no real data — readFileSync only.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const readDemoPage = () => read("src/app/demo/pierre/page.tsx");
const readNewScenarios = () => read("src/lib/pierre/demo/demo-scenarios.ts");
// Untouched legacy public-demo library (still part of pfinal01-demo).
const readLegacyScenarios = () => read("src/lib/demo/public-demo/demo-scenario.ts");

// ── Page existence and fundamentals ──────────────────────────────────────────
describe("pierre-demo — page existence and structure", () => {
  it("/demo/pierre page exists and is substantial", () => {
    expect(readDemoPage().length).toBeGreaterThan(2000);
  });
  it("page is a client shell rendering the interactive experience", () => {
    const page = readDemoPage();
    expect(page).toMatch(/^"use client";/);
    expect(page).toContain("PierreDemoExperience");
  });
  it("page mentions Pierre", () => {
    expect(readDemoPage()).toMatch(/pierre/i);
  });
  it("page mentions 449 (price truth)", () => {
    expect(readDemoPage()).toMatch(/449|PIERRE_PRICE_LABEL/);
  });
  it("page mentions démonstration illustrative", () => {
    expect(readDemoPage()).toMatch(/illustrative|illustratif/i);
  });
  it("page mentions données fictives", () => {
    expect(readDemoPage()).toMatch(/fictives?|fictif/i);
  });
  it("page mentions validation humaine", () => {
    expect(readDemoPage()).toMatch(/validation humaine/i);
  });
});

// ── Demo content: core concepts ───────────────────────────────────────────────
describe("pierre-demo — core content", () => {
  it("page mentions mission, tâches, document, trace", () => {
    const page = readDemoPage();
    expect(page).toMatch(/mission/i);
    expect(page).toMatch(/tâches?/i);
    expect(page).toMatch(/document/i);
    expect(page).toMatch(/trace/i);
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
describe("pierre-demo — navigation links", () => {
  it("page links to /agents/pierre", () => {
    expect(readDemoPage()).toContain("/agents/pierre");
  });
  it("page links to /reserver/pierre (real reservation route)", () => {
    expect(readDemoPage()).toContain("/reserver/pierre");
  });
  it("page links to legal CGV or CGU", () => {
    expect(readDemoPage()).toMatch(/\/legal\/cg[vu]/i);
  });
  it("page links to confidentialite", () => {
    expect(readDemoPage()).toContain("/legal/confidentialite");
  });
  it("page has a CTA", () => {
    expect(readDemoPage()).toMatch(/ArrowRight|Réserver Pierre|Découvrir|agents\/pierre/i);
  });
});

// ── Safety rules — no forbidden API calls ─────────────────────────────────────
describe("pierre-demo — no external API calls", () => {
  it("no OpenAI API call", () => {
    expect(readDemoPage()).not.toMatch(/https:\/\/api\.openai\.com/i);
  });
  it("no Anthropic API call", () => {
    expect(readDemoPage()).not.toMatch(/api\.anthropic\.com/i);
  });
  it("no Stripe live call", () => {
    const page = readDemoPage();
    expect(page).not.toMatch(/https:\/\/api\.stripe\.com/i);
    expect(page).not.toMatch(/sk_live_/i);
  });
  it("no Supabase write call", () => {
    expect(readDemoPage()).not.toMatch(/\.from\(.*\)\.insert|\.from\(.*\)\.upsert|\.from\(.*\)\.update/);
  });
  it("no fetch to external APIs", () => {
    const nonComment = readDemoPage().split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(nonComment).not.toMatch(/fetch\s*\(\s*["']https:\/\/api\./);
  });
});

// ── Safety rules — no proof or launch flag modification ───────────────────────
describe("pierre-demo — no proof or launch flag modification", () => {
  it("no public launch flag set to true", () => {
    expect(readDemoPage()).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });
  it("no proof auto-verified", () => {
    const page = readDemoPage();
    expect(page).not.toMatch(/markProofVerified/);
    expect(page).not.toMatch(/status.*["']verified["']/);
  });
});

// ── Safety rules — no forbidden copy ─────────────────────────────────────────
describe("pierre-demo — no forbidden commercial claims", () => {
  it("no 'zéro erreur' claim", () => {
    expect(readDemoPage()).not.toMatch(/zéro erreur/i);
  });
  it("no 'conformité garantie' claim", () => {
    expect(readDemoPage()).not.toMatch(/conformité garantie/i);
  });
  it("no 'remplace avocat' claim", () => {
    expect(readDemoPage()).not.toMatch(/remplace (?:un |votre )?avocat(?! ni)/i);
  });
  it("no 'DSN autonome' claim", () => {
    expect(readDemoPage()).not.toMatch(/DSN autonome/i);
  });
  it("no 'paie officielle' claim", () => {
    expect(readDemoPage()).not.toMatch(/paie officielle|bulletins? de paie officiels?/i);
  });
  it("no 'licenciement automatique' claim", () => {
    expect(readDemoPage()).not.toMatch(/licenciement automatique/i);
  });
  it("no 'essai gratuit 7 jours open-bar' claim", () => {
    expect(readDemoPage()).not.toMatch(/essai gratuit.*7 jours|7 jours.*gratuit|open.bar/i);
  });
});

// ── Responsive design ─────────────────────────────────────────────────────────
describe("pierre-demo — responsive design", () => {
  it("page uses responsive classes sm: or md:", () => {
    expect(readDemoPage()).toMatch(/\bsm:|md:/);
  });
  it("page uses grid for responsive layout", () => {
    expect(readDemoPage()).toMatch(/grid-cols/);
  });
});
