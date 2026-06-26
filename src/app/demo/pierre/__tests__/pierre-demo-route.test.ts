// PIERRE FINAL INTERACTIVE DEMO — route + page structure tests.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { DEMO_CTA_ALLOWED_HREFS } from "@/lib/pierre/demo";
import { FORBIDDEN_CLAIM_PATTERNS } from "@/lib/pierre/demo/demo-validation";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const page = read("src/app/demo/pierre/page.tsx");
const experience = read("src/components/pierre/demo/PierreDemoExperience.tsx");

describe("pierre-demo route — page fundamentals", () => {
  it("page exists and is substantial", () => {
    expect(page.length).toBeGreaterThan(2000);
  });
  it("page is a client component rendering the experience", () => {
    expect(page).toMatch(/^"use client";/);
    expect(page).toContain("PierreDemoExperience");
  });
  it("page imports its scoped stylesheet", () => {
    expect(page).toContain("pierre-demo.css");
  });
  it("page mentions Pierre, price 449, illustrative + fictif framing", () => {
    expect(page).toMatch(/pierre/i);
    expect(page).toMatch(/449|PIERRE_PRICE_LABEL/);
    expect(page).toMatch(/illustrative|illustratif/i);
    expect(page).toMatch(/fictives?|fictif/i);
    expect(page).toMatch(/validation humaine/i);
  });
  it("page mentions mission, document, trace, tâches", () => {
    expect(page).toMatch(/mission/i);
    expect(page).toMatch(/document/i);
    expect(page).toMatch(/trace/i);
    expect(page).toMatch(/tâches?/i);
  });
});

describe("pierre-demo route — links are real (no dead links)", () => {
  it("links to discover, reserve and legal pages", () => {
    expect(page).toContain("/agents/pierre");
    expect(page).toContain("/reserver/pierre");
    expect(page).toMatch(/\/legal\/cg[vu]/);
    expect(page).toContain("/legal/confidentialite");
  });
  it("provides the variant-hero anchor (no dead anchor from layout)", () => {
    expect(page).toContain("demo-pierre-cockpit");
  });
  it("every href in the experience that is internal points at an allow-listed or in-page target", () => {
    const hrefs = [...experience.matchAll(/href=\{?["'`]([^"'`}]+)["'`]\}?/g)].map((m) => m[1]);
    for (const h of hrefs) {
      if (h.startsWith("#") || h.includes("DEMO_CTA_DESTINATIONS")) continue;
      if (h.startsWith("/")) expect(DEMO_CTA_ALLOWED_HREFS.has(h), `unexpected route ${h}`).toBe(true);
    }
  });
});

describe("pierre-demo route — safety copy", () => {
  it("no forbidden commercial claims in the page", () => {
    for (const re of FORBIDDEN_CLAIM_PATTERNS) {
      expect(re.test(page), re.source).toBe(false);
    }
  });
  it("no fabricated time-savings claim without an explicit estimate label", () => {
    // We must not assert a bare "Xh économisées" without "estimation".
    const bareHours = /\b\d+\s*h\b[^.]{0,40}économis/i;
    if (bareHours.test(page)) expect(page).toMatch(/estimation indicative/i);
    else expect(true).toBe(true);
  });
  it("no public launch flag flip / proof auto-verification", () => {
    expect(page).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
    expect(page).not.toMatch(/markProofVerified/);
  });
});
