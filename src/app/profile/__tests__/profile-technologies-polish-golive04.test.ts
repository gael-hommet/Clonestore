// GO-LIVE 04 — Profile pages polish tests
// Static file content tests — no Supabase, no API calls, no proof modification.
// Only readFileSync (NOT existsSync — causes runtime error in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, "src/app/profile", relPath), "utf-8");
}

// ── Technologies page ─────────────────────────────────────────────────────────

describe("profile/technologies — 6 active technologies", () => {
  const page = readPage("technologies/page.tsx");

  it("page exists and is a tsx file", () => {
    expect(page.length).toBeGreaterThan(500);
  });

  it("mentions CloneOS", () => {
    expect(page).toMatch(/cloneos/i);
  });

  it("mentions CloneADN", () => {
    expect(page).toMatch(/cloneadn/i);
  });

  it("mentions CloneGuard", () => {
    expect(page).toMatch(/cloneguard/i);
  });

  it("mentions CloneTrace", () => {
    expect(page).toMatch(/clonetrace/i);
  });

  it("mentions CloneVoice", () => {
    expect(page).toMatch(/clonevoice/i);
  });

  it("mentions CloneChat", () => {
    expect(page).toMatch(/clonechat/i);
  });
});

describe("profile/technologies — 6 roadmap technologies", () => {
  const page = readPage("technologies/page.tsx");

  it("mentions ClonePolicy", () => {
    expect(page).toMatch(/clonepolicy/i);
  });

  it("mentions CloneContinuum", () => {
    expect(page).toMatch(/clonecontinuum/i);
  });

  it("mentions CloneTrust", () => {
    expect(page).toMatch(/clonetrust/i);
  });

  it("mentions CloneReview", () => {
    expect(page).toMatch(/clonereview/i);
  });

  it("mentions CloneSignals", () => {
    expect(page).toMatch(/clonesignals/i);
  });

  it("mentions CloneLearn", () => {
    expect(page).toMatch(/clonelearn/i);
  });
});

describe("profile/technologies — visibility badges", () => {
  const page = readPage("technologies/page.tsx");

  it("distinguishes 'Visible client' technologies", () => {
    expect(page).toContain("Visible client");
  });

  it("distinguishes 'Moteur interne' technologies", () => {
    expect(page).toContain("Moteur interne");
  });

  it("has 'Actif' badge", () => {
    expect(page).toContain("Actif");
  });

  it("has 'Protégé' badge", () => {
    expect(page).toContain("Protégé");
  });

  it("has 'Bientôt' badge for roadmap technologies", () => {
    expect(page).toContain("Bientôt");
  });
});

describe("profile/technologies — safety rules", () => {
  const page = readPage("technologies/page.tsx");

  it("does not claim legal or payroll compliance guarantee", () => {
    expect(page).not.toMatch(/garantit.*conformité/i);
    expect(page).not.toMatch(/bulletins? de paie officiels?/i);
  });

  it("does not auto-verify any proof ID", () => {
    expect(page).not.toMatch(/status.*["']verified["']/);
    expect(page).not.toMatch(/markProofVerified/);
  });

  it("does not call external APIs", () => {
    // P19/P20 : la page DOIT lire l'état canonique du tenant via la route interne
    // same-origin /api/clonestore/technologies. La règle réelle n'est donc pas
    // « aucun fetch » (l'ancienne formulation, devenue fausse et contredite par
    // profile-tech-ui-tech04.test.ts qui EXIGE ce fetch) mais « aucun fetch externe » :
    // chaque fetch est énuméré et doit viser exactement la route canonique.
    const fetches = [...page.matchAll(/fetch\s*\(\s*(["'`])([^"'`]+)\1/g)].map((m) => m[2]);
    for (const url of fetches) {
      expect(url.startsWith("/api/clonestore/technologies"), `fetch non canonique: ${url}`).toBe(true);
    }
    expect(page).not.toMatch(/fetch\s*\(\s*["'`]https?:\/\//);
    expect(page).not.toMatch(/https:\/\/api\.stripe\.com/);
    expect(page).not.toMatch(/https:\/\/api\.openai\.com/);
  });

  it("does not set B48_PUBLIC_LAUNCH_ENABLED to true", () => {
    expect(page).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("has responsive classes (sm: or md:)", () => {
    expect(page).toMatch(/\bsm:|md:/);
  });
});

// ── Go-live page ──────────────────────────────────────────────────────────────

describe("profile/go-live — general structure", () => {
  const page = readPage("go-live/page.tsx");

  it("page exists and is substantial", () => {
    expect(page.length).toBeGreaterThan(1000);
  });

  it("is a server component (no 'use client')", () => {
    expect(page).not.toContain('"use client"');
  });

  it("has noindex/nofollow metadata", () => {
    expect(page).toContain("noindex");
    expect(page).toContain("nofollow");
  });

  it("does not auto-verify any proof ID", () => {
    expect(page).not.toMatch(/markProofVerified/);
    expect(page).not.toMatch(/status.*["']verified["']/);
  });

  it("does not call external APIs", () => {
    expect(page).not.toMatch(/https:\/\/api\.stripe\.com/);
    expect(page).not.toMatch(/https:\/\/api\.openai\.com/);
  });
});

describe("profile/go-live — content accuracy", () => {
  const page = readPage("go-live/page.tsx");

  it("shows Pierre pricing as 449€/mois (not /an)", () => {
    expect(page).toMatch(/449.*mois/i);
    expect(page).not.toMatch(/449.*\/an/i);
  });

  it("shows NO-GO state is present", () => {
    expect(page).toMatch(/NO.GO|NOGO|no.go|Bloquant/i);
  });

  it("lists Legal as a domain", () => {
    expect(page).toMatch(/legal|Legal/);
  });

  it("lists Stripe as a domain", () => {
    expect(page).toMatch(/stripe|Stripe/i);
  });

  it("lists Supabase as a domain", () => {
    expect(page).toMatch(/supabase|Supabase/i);
  });

  it("lists copy/public scan as a domain", () => {
    expect(page).toMatch(/copy|Copy|scan/i);
  });

  it("references check:legal-public-copy script", () => {
    expect(page).toContain("check:legal-public-copy");
  });

  it("has blocking count information (proofs)", () => {
    expect(page).toMatch(/blocking|Bloquant/i);
  });

  it("has responsive classes (sm: or px-4)", () => {
    expect(page).toMatch(/\bsm:|px-4/);
  });
});

// ── Launch-readiness page ─────────────────────────────────────────────────────

describe("profile/launch-readiness — polish checks", () => {
  const page = readPage("launch-readiness/page.tsx");

  it("page exists and is substantial", () => {
    expect(page.length).toBeGreaterThan(500);
  });

  it("does not expose 'B48 —' in user-visible subtitle", () => {
    const lines = page.split("\n");
    const jsxLines = lines.filter((l) => !l.trim().startsWith("//"));
    const userVisible = jsxLines.join("\n");
    expect(userVisible).not.toMatch(/B48 —.*Tableau/);
  });

  it("mentions legal pending state", () => {
    expect(page).toMatch(/legal|Legal|juridique/i);
  });

  it("mentions Stripe or billing pending state", () => {
    expect(page).toMatch(/stripe|Stripe|billing|paiement/i);
  });

  it("does not auto-verify any proof", () => {
    expect(page).not.toMatch(/markProofVerified/);
  });
});
