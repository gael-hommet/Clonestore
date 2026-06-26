// GO-LIVE 07 — Public Visual QA & Mobile Polish integration tests
// Static file content tests — no AI, no Supabase, no Stripe, no real data.
// Only readFileSync (NOT existsSync — causes TypeError in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, "src/app", relPath), "utf-8");
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf-8");
}

// ── Funnel link integrity ─────────────────────────────────────────────────────

describe("public-visual-qa — funnel link integrity", () => {
  it("homepage links to /demo/pierre", () => {
    expect(readPage("page.tsx")).toContain("/demo/pierre");
  });

  it("homepage links to /agents/pierre or /agents", () => {
    const page = readPage("page.tsx");
    expect(page).toMatch(/\/agents\/pierre|\/agents/);
  });

  it("/agents links to /demo/pierre", () => {
    expect(readPage("agents/page.tsx")).toContain("/demo/pierre");
  });

  it("/agents/pierre links to /demo/pierre", () => {
    expect(readPage("agents/pierre/page.tsx")).toContain("/demo/pierre");
  });

  it("/demo/pierre links back to /agents/pierre", () => {
    expect(readPage("demo/pierre/page.tsx")).toContain("/agents/pierre");
  });

  it("/questions links to /demo/pierre", () => {
    expect(readPage("questions/page.tsx")).toContain("/demo/pierre");
  });

  it("/paiement/cancel links to /demo/pierre (re-engagement)", () => {
    expect(readPage("paiement/cancel/page.tsx")).toContain("/demo/pierre");
  });
});

// ── Checkout legal mention ────────────────────────────────────────────────────

describe("public-visual-qa — checkout legal mention", () => {
  it("checkout page mentions CGV or confidentialité before payment", () => {
    const page = readPage("checkout/page.tsx");
    expect(page).toMatch(/cgv|confidentialit/i);
  });

  it("checkout page links to /legal/cgv or /legal/confidentialite", () => {
    const page = readPage("checkout/page.tsx");
    expect(page).toMatch(/\/legal\/cgv|\/legal\/confidentialit/);
  });
});

// ── Success / Cancel copy ─────────────────────────────────────────────────────

describe("public-visual-qa — success and cancel pages copy", () => {
  it("success page has next-step or return wording", () => {
    const page = readPage("paiement/success/page.tsx");
    expect(page).toMatch(/Accéder|Configurer|CloneStore|retour/i);
  });

  it("success page mentions Pierre", () => {
    expect(readPage("paiement/success/page.tsx")).toMatch(/pierre/i);
  });

  it("cancel page has return wording", () => {
    const page = readPage("paiement/cancel/page.tsx");
    expect(page).toMatch(/Reprendre|boutique|retour/i);
  });

  it("cancel page is calm — no panic copy", () => {
    const page = readPage("paiement/cancel/page.tsx");
    expect(page).not.toMatch(/urgent|attention.*payez|délai expiré/i);
  });

  it("cancel page says nothing was charged", () => {
    const page = readPage("paiement/cancel/page.tsx");
    expect(page).toMatch(/aucune action facturée|Aucune activation|non finalisé/i);
  });
});

// ── Forbidden commercial claims — all 8 public pages ─────────────────────────

const ALL_PAGES = [
  "page.tsx",
  "agents/page.tsx",
  "agents/pierre/page.tsx",
  "demo/pierre/page.tsx",
  "questions/page.tsx",
  "checkout/page.tsx",
  "paiement/success/page.tsx",
  "paiement/cancel/page.tsx",
];

describe("public-visual-qa — no forbidden commercial claims", () => {
  for (const path of ALL_PAGES) {
    it(`${path} — no 'zéro erreur'`, () => {
      expect(readPage(path)).not.toMatch(/zéro erreur/i);
    });

    it(`${path} — no 'conformité garantie'`, () => {
      expect(readPage(path)).not.toMatch(/conformité garantie/i);
    });

    it(`${path} — no 'remplace avocat'`, () => {
      expect(readPage(path)).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
    });

    it(`${path} — no 'DSN autonome'`, () => {
      expect(readPage(path)).not.toMatch(/DSN autonome/i);
    });

    it(`${path} — no 'paie officielle'`, () => {
      expect(readPage(path)).not.toMatch(/paie officielle/i);
    });

    it(`${path} — no 'licenciement automatique'`, () => {
      expect(readPage(path)).not.toMatch(/licenciement automatique/i);
    });

    it(`${path} — no '7 jours gratuits open-bar'`, () => {
      expect(readPage(path)).not.toMatch(/7 jours gratuits|open.bar/i);
    });
  }
});

// ── No external API calls introduced ─────────────────────────────────────────

describe("public-visual-qa — no external API calls introduced", () => {
  for (const path of ALL_PAGES) {
    it(`${path} — no sk_live_ Stripe key`, () => {
      expect(readPage(path)).not.toMatch(/sk_live_/i);
    });

    it(`${path} — no OpenAI API URL`, () => {
      expect(readPage(path)).not.toMatch(/https:\/\/api\.openai\.com/i);
    });

    it(`${path} — no Anthropic API URL`, () => {
      expect(readPage(path)).not.toMatch(/https:\/\/api\.anthropic\.com/i);
    });

    it(`${path} — no Supabase write`, () => {
      expect(readPage(path)).not.toMatch(/\.from\(.*\)\.insert|\.from\(.*\)\.upsert/);
    });
  }
});

// ── No proof or launch flag modification ──────────────────────────────────────

describe("public-visual-qa — no proof or launch flag modification", () => {
  for (const path of ALL_PAGES) {
    it(`${path} — no public launch flag set to true`, () => {
      expect(readPage(path)).not.toMatch(/B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
    });

    it(`${path} — no proof auto-verified`, () => {
      expect(readPage(path)).not.toMatch(/markProofVerified/);
    });
  }
});

// ── Responsive design ─────────────────────────────────────────────────────────

describe("public-visual-qa — responsive design", () => {
  it("homepage uses responsive layout (clone-* CSS classes)", () => {
    expect(readPage("page.tsx")).toMatch(/clone-home|flex-wrap|clone-section/);
  });

  it("/agents uses responsive grid classes", () => {
    expect(readPage("agents/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });

  it("/agents/pierre uses responsive classes", () => {
    expect(readPage("agents/pierre/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });

  it("/demo/pierre uses responsive classes", () => {
    expect(readPage("demo/pierre/page.tsx")).toMatch(/\bsm:|md:|lg:/);
  });

  it("/questions uses responsive classes", () => {
    expect(readPage("questions/page.tsx")).toMatch(/\bsm:|md:/);
  });

  it("/checkout uses responsive classes", () => {
    expect(readPage("checkout/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });

  it("/paiement/success uses responsive classes", () => {
    expect(readPage("paiement/success/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });

  it("/paiement/cancel uses responsive classes", () => {
    expect(readPage("paiement/cancel/page.tsx")).toMatch(/\bsm:|md:|xl:/);
  });
});

// ── Docs exist ────────────────────────────────────────────────────────────────

describe("public-visual-qa — required docs exist", () => {
  it("docs/GO_LIVE_07_PUBLIC_VISUAL_QA.md exists and has checklist content", () => {
    const doc = readDoc("docs/GO_LIVE_07_PUBLIC_VISUAL_QA.md");
    expect(doc).toContain("GO-LIVE 07");
    expect(doc).toContain("Mobile");
    expect(doc).toContain("Desktop");
  });

  it("docs/GO_LIVE_07_PUBLIC_FUNNEL_LINK_MAP.md exists and has funnel content", () => {
    const doc = readDoc("docs/GO_LIVE_07_PUBLIC_FUNNEL_LINK_MAP.md");
    expect(doc).toContain("GO-LIVE 07");
    expect(doc).toContain("/demo/pierre");
    expect(doc).toContain("/agents/pierre");
  });
});

// ── 449 pricing consistent ────────────────────────────────────────────────────

describe("public-visual-qa — 449€/mois pricing consistent", () => {
  it("/agents/pierre mentions 449", () => {
    expect(readPage("agents/pierre/page.tsx")).toMatch(/449/);
  });

  it("/agents mentions 449", () => {
    expect(readPage("agents/page.tsx")).toMatch(/449/);
  });

  it("/demo/pierre mentions 449", () => {
    expect(readPage("demo/pierre/page.tsx")).toMatch(/449/);
  });

  it("/checkout mentions 449", () => {
    expect(readPage("checkout/page.tsx")).toMatch(/449/);
  });
});
