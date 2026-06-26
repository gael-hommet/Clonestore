// GO-LIVE 06 — Public funnel demo integration tests
// Static file content tests — no AI, no Supabase, no Stripe, no real data.
// Only readFileSync (NOT existsSync — causes TypeError in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, "src/app", relPath), "utf-8");
}

// ── Funnel links — /demo/pierre is reachable from public pages ────────────────

describe("public-funnel — /demo/pierre linked from key pages", () => {
  it("homepage contains link to /demo/pierre", () => {
    const page = readPage("page.tsx");
    expect(page).toContain("/demo/pierre");
  });

  it("/agents/pierre contains link to /demo/pierre", () => {
    const page = readPage("agents/pierre/page.tsx");
    expect(page).toContain("/demo/pierre");
  });

  it("/questions contains link or mention of /demo/pierre", () => {
    const page = readPage("questions/page.tsx");
    expect(page).toContain("/demo/pierre");
  });

  it("/agents (boutique) contains link to /demo/pierre for Pierre", () => {
    const page = readPage("agents/page.tsx");
    expect(page).toContain("/demo/pierre");
  });
});

// ── Pierre pricing reference ───────────────────────────────────────────────────

describe("public-funnel — Pierre pricing reference", () => {
  it("/agents/pierre mentions 449", () => {
    const page = readPage("agents/pierre/page.tsx");
    expect(page).toMatch(/449/);
  });

  it("/agents (boutique) mentions 449", () => {
    const page = readPage("agents/page.tsx");
    expect(page).toMatch(/449/);
  });

  it("homepage has a CTA to the demo or Pierre page", () => {
    const page = readPage("page.tsx");
    expect(page).toMatch(/demo\/pierre|agents\/pierre/);
  });
});

// ── FAQ / Questions page — Pierre content ─────────────────────────────────────

describe("public-funnel — FAQ Pierre content", () => {
  it("questions page mentions Pierre", () => {
    const page = readPage("questions/page.tsx");
    expect(page).toMatch(/pierre/i);
  });

  it("questions page has FAQ entry about demo or démo", () => {
    const page = readPage("questions/page.tsx");
    expect(page).toMatch(/démo|demo/i);
  });

  it("questions page mentions validation humaine", () => {
    const page = readPage("questions/page.tsx");
    expect(page).toMatch(/validation humaine/i);
  });
});

// ── CTA presence on Pierre page ───────────────────────────────────────────────

describe("public-funnel — CTA on Pierre page", () => {
  it("/agents/pierre has demo CTA label", () => {
    const page = readPage("agents/pierre/page.tsx");
    expect(page).toMatch(/Voir la démo Pierre|demo\/pierre/i);
  });

  it("/agents/pierre has 'Préparer l'accès' or equivalent non-aggressive CTA", () => {
    const page = readPage("agents/pierre/page.tsx");
    expect(page).toMatch(/Préparer|Voir l'offre|Commencer|paiement/i);
  });
});

// ── Safety: no forbidden claims ───────────────────────────────────────────────

describe("public-funnel — no forbidden commercial claims", () => {
  const pagePaths = [
    "page.tsx",
    "agents/pierre/page.tsx",
    "agents/page.tsx",
    "questions/page.tsx",
  ];

  for (const path of pagePaths) {
    it(`${path} — no 'zéro erreur' claim`, () => {
      expect(readPage(path)).not.toMatch(/zéro erreur/i);
    });

    it(`${path} — no 'conformité garantie' claim`, () => {
      expect(readPage(path)).not.toMatch(/conformité garantie/i);
    });

    it(`${path} — no 'remplace avocat' claim`, () => {
      expect(readPage(path)).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
    });

    it(`${path} — no 'DSN autonome' claim`, () => {
      expect(readPage(path)).not.toMatch(/DSN autonome/i);
    });

    it(`${path} — no 'paie officielle' claim`, () => {
      expect(readPage(path)).not.toMatch(/paie officielle/i);
    });

    it(`${path} — no 'licenciement automatique' claim`, () => {
      expect(readPage(path)).not.toMatch(/licenciement automatique/i);
    });

    it(`${path} — no '7 jours gratuits open-bar'`, () => {
      expect(readPage(path)).not.toMatch(/7 jours gratuits|open.bar/i);
    });
  }
});

// ── Safety: no external API calls introduced ──────────────────────────────────

describe("public-funnel — no external API calls introduced", () => {
  const pagePaths = [
    "page.tsx",
    "agents/pierre/page.tsx",
    "agents/page.tsx",
    "questions/page.tsx",
  ];

  for (const path of pagePaths) {
    it(`${path} — no OpenAI API call`, () => {
      expect(readPage(path)).not.toMatch(/https:\/\/api\.openai\.com/i);
    });

    it(`${path} — no Anthropic API call`, () => {
      expect(readPage(path)).not.toMatch(/https:\/\/api\.anthropic\.com/i);
    });

    it(`${path} — no Stripe live call`, () => {
      expect(readPage(path)).not.toMatch(/sk_live_/i);
      expect(readPage(path)).not.toMatch(/https:\/\/api\.stripe\.com/i);
    });

    it(`${path} — no Supabase write`, () => {
      expect(readPage(path)).not.toMatch(/\.from\(.*\)\.insert|\.from\(.*\)\.upsert/);
    });
  }
});

// ── Safety: no proof or launch flag modification ──────────────────────────────

describe("public-funnel — no proof or launch flag modification", () => {
  const pagePaths = [
    "page.tsx",
    "agents/pierre/page.tsx",
    "agents/page.tsx",
    "questions/page.tsx",
  ];

  for (const path of pagePaths) {
    it(`${path} — no public launch flag set to true`, () => {
      expect(readPage(path)).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
    });

    it(`${path} — no proof auto-verified`, () => {
      expect(readPage(path)).not.toMatch(/markProofVerified/);
    });
  }
});

// ── Responsive design ─────────────────────────────────────────────────────────

describe("public-funnel — responsive design", () => {
  it("homepage uses responsive layout (clone- CSS classes or flex-wrap)", () => {
    const page = readPage("page.tsx");
    // Homepage uses clone-* CSS classes with media queries — not Tailwind sm:/md: prefixes
    expect(page).toMatch(/clone-home|flex-wrap|clone-section/);
  });

  it("/agents/pierre uses responsive classes", () => {
    expect(readPage("agents/pierre/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });

  it("/agents uses responsive classes", () => {
    expect(readPage("agents/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });

  it("/questions uses responsive classes", () => {
    expect(readPage("questions/page.tsx")).toMatch(/\bsm:|md:/);
  });
});
