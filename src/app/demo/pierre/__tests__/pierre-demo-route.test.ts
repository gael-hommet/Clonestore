// PIERRE ZERO-SCROLL DEMO PLAYER — route + player structure tests.
// REWRITTEN for the rebuild: the page renders <DemoPlayer/>; the copy/links that used
// to sit inline in the page body now live in the player tree (page + player/**). All
// link-integrity + forbidden-claim protections are preserved, asserted against that tree.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { DEMO_CTA_ALLOWED_HREFS, DEMO_CTA_DESTINATIONS } from "@/lib/pierre/demo";
import { FORBIDDEN_CLAIM_PATTERNS } from "@/lib/pierre/demo/demo-validation";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const page = read("src/app/demo/pierre/page.tsx");

function playerFiles(): string[] {
  const dir = join(ROOT, "src/components/pierre/demo/player");
  return (readdirSync(dir, { recursive: true }) as unknown as string[])
    .filter((f) => /\.tsx?$/.test(String(f)) && !String(f).includes("__tests__"))
    .map((f) => join("src/components/pierre/demo/player", String(f)));
}
const TREE = [page, ...playerFiles().map(read)].join("\n\n");

describe("pierre-demo route — page fundamentals", () => {
  it("page exists and is substantial", () => {
    expect(page.length).toBeGreaterThan(2000);
  });
  it("page is a client component rendering the player", () => {
    expect(page).toMatch(/^"use client";/);
    expect(page).toContain("DemoPlayer");
  });
  it("page imports its scoped stylesheet", () => {
    expect(page).toContain("pierre-demo.css");
  });
  it("player tree mentions Pierre, price 449, illustrative + fictif framing", () => {
    expect(TREE).toMatch(/pierre/i);
    expect(TREE).toMatch(/449|FOUNDER_PRICE_MONTHLY/);
    expect(TREE).toMatch(/illustrative|illustratif/i);
    expect(TREE).toMatch(/fictives?|fictif/i);
    expect(TREE).toMatch(/validation humaine/i);
  });
  it("player tree mentions mission, document, trace, tâches", () => {
    expect(TREE).toMatch(/mission/i);
    expect(TREE).toMatch(/document/i);
    expect(TREE).toMatch(/trace/i);
    expect(TREE).toMatch(/tâches?/i);
  });
});

describe("pierre-demo route — links are real (no dead links)", () => {
  it("references discover, reserve and legal destinations that resolve to real routes", () => {
    // The player consumes the canonical DEMO_CTA_DESTINATIONS constants (single source
    // of truth); asserting the references + the resolved values proves no dead links.
    expect(TREE).toContain("DEMO_CTA_DESTINATIONS.reserve");
    expect(TREE).toContain("DEMO_CTA_DESTINATIONS.discover");
    expect(TREE).toMatch(/DEMO_CTA_DESTINATIONS\.legal_/);
    expect(DEMO_CTA_DESTINATIONS.reserve).toBe("/reserver/pierre");
    expect(DEMO_CTA_DESTINATIONS.discover).toBe("/agents/pierre");
    expect(DEMO_CTA_DESTINATIONS.legal_privacy).toBe("/legal/confidentialite");
    expect(DEMO_CTA_DESTINATIONS.legal_cgv).toMatch(/\/legal\/cg[vu]/);
  });
  it("provides the variant-hero anchor (no dead anchor from layout)", () => {
    expect(TREE).toContain("demo-pierre-cockpit");
  });
  it("every literal internal href in the player tree points at an allow-listed route", () => {
    const hrefs = [...TREE.matchAll(/href=\{?["'`]([^"'`}]+)["'`]\}?/g)].map((m) => m[1]);
    for (const h of hrefs) {
      if (h.startsWith("#") || h.startsWith("mailto:")) continue;
      if (h.startsWith("/")) expect(DEMO_CTA_ALLOWED_HREFS.has(h), `unexpected route ${h}`).toBe(true);
    }
  });
  it("every declared CTA destination is a real, allow-listed route", () => {
    for (const dest of Object.values(DEMO_CTA_DESTINATIONS)) {
      expect(DEMO_CTA_ALLOWED_HREFS.has(dest)).toBe(true);
      expect(dest.startsWith("/")).toBe(true);
    }
  });
});

describe("pierre-demo route — safety copy", () => {
  it("no forbidden commercial claims in the player tree", () => {
    for (const re of FORBIDDEN_CLAIM_PATTERNS) {
      expect(re.test(TREE), re.source).toBe(false);
    }
  });
  it("no fabricated time-savings claim without an explicit estimate label", () => {
    const bareHours = /\b\d+\s*h\b[^.]{0,40}économis/i;
    if (bareHours.test(TREE)) expect(TREE).toMatch(/estimation indicative/i);
    else expect(true).toBe(true);
  });
  it("no public launch flag flip / proof auto-verification", () => {
    expect(TREE).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
    expect(TREE).not.toMatch(/markProofVerified/);
  });
});
