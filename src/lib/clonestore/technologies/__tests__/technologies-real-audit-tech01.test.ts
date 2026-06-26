// TECH-01 — CloneStore Technologies Real Audit Tests
// Static tests only. No Stripe live. No Supabase writes. No real API calls.
// Only readFileSync (NOT existsSync — causes TypeError in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, "docs", relPath), "utf-8");
}

function readLib(relPath: string): string {
  return readFileSync(join(ROOT, "src/lib", relPath), "utf-8");
}

// ── Doc existence ─────────────────────────────────────────────────────────────

describe("tech-01 — doc existence", () => {
  it("TECH_01 audit doc exists and is non-empty", () => {
    const content = readDoc("TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md");
    expect(content.length).toBeGreaterThan(500);
  });
});

// ── Technology mentions ───────────────────────────────────────────────────────

describe("tech-01 — all 13 technologies mentioned in doc", () => {
  let content: string;
  try {
    content = readDoc("TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md");
  } catch {
    content = "";
  }

  it("doc mentions CloneOS", () => {
    expect(content).toContain("CloneOS");
  });

  it("doc mentions CloneADN", () => {
    expect(content).toContain("CloneADN");
  });

  it("doc mentions CloneGuard", () => {
    expect(content).toContain("CloneGuard");
  });

  it("doc mentions CloneTrace", () => {
    expect(content).toContain("CloneTrace");
  });

  it("doc mentions CloneVoice", () => {
    expect(content).toContain("CloneVoice");
  });

  it("doc mentions CloneChat", () => {
    expect(content).toContain("CloneChat");
  });

  it("doc mentions ClonePolicy", () => {
    expect(content).toContain("ClonePolicy");
  });

  it("doc mentions CloneContinuum", () => {
    expect(content).toContain("CloneContinuum");
  });

  it("doc mentions CloneTrust", () => {
    expect(content).toContain("CloneTrust");
  });

  it("doc mentions CloneReview", () => {
    expect(content).toContain("CloneReview");
  });

  it("doc mentions CloneSignals", () => {
    expect(content).toContain("CloneSignals");
  });

  it("doc mentions CloneLearn", () => {
    expect(content).toContain("CloneLearn");
  });

  it("doc mentions CloneBrief", () => {
    expect(content).toContain("CloneBrief");
  });
});

// ── Global vs Pierre-only & Employee Runtime Contract ────────────────────────

describe("tech-01 — global vs Pierre-only and Employee Runtime Contract", () => {
  let content: string;
  try {
    content = readDoc("TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md");
  } catch {
    content = "";
  }

  it("doc distinguishes global vs Pierre-only", () => {
    const hasGlobalVsPierre =
      (content.includes("global") || content.includes("Global")) &&
      (content.includes("Pierre-only") || content.includes("Pierre only"));
    expect(hasGlobalVsPierre).toBe(true);
  });

  it("doc mentions Employee Runtime Contract", () => {
    expect(content).toContain("Employee Runtime Contract");
  });

  it("doc mentions Employee Registry", () => {
    expect(content).toContain("Employee Registry");
  });
});

// ── Launch vs later classification ───────────────────────────────────────────

describe("tech-01 — launch vs later classification", () => {
  let content: string;
  try {
    content = readDoc("TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md");
  } catch {
    content = "";
  }

  it("doc distinguishes launch vs later", () => {
    const hasLaunchVsLater =
      content.includes("launch") &&
      (content.includes("later") || content.includes("apres") || content.includes("après"));
    expect(hasLaunchVsLater).toBe(true);
  });

  it("doc contains construction order TECH-02", () => {
    expect(content).toContain("TECH-02");
  });

  it("doc contains construction order TECH-03", () => {
    expect(content).toContain("TECH-03");
  });

  it("doc contains construction order TECH-04", () => {
    expect(content).toContain("TECH-04");
  });

  it("doc contains construction order TECH-05", () => {
    expect(content).toContain("TECH-05");
  });

  it("doc contains construction order TECH-06", () => {
    expect(content).toContain("TECH-06");
  });

  it("doc contains construction order TECH-07", () => {
    expect(content).toContain("TECH-07");
  });

  it("doc contains construction order TECH-08", () => {
    expect(content).toContain("TECH-08");
  });

  it("doc contains construction order TECH-09", () => {
    expect(content).toContain("TECH-09");
  });

  it("doc contains construction order TECH-10", () => {
    expect(content).toContain("TECH-10");
  });

  it("doc contains construction order TECH-11", () => {
    expect(content).toContain("TECH-11");
  });
});

// ── Safety — no forbidden launch claims ──────────────────────────────────────

describe("tech-01 — no forbidden launch claims in doc", () => {
  let content: string;
  try {
    content = readDoc("TECH_01_CLONESTORE_TECHNOLOGIES_REAL_AUDIT.md");
  } catch {
    content = "";
  }

  it("doc does not claim public launch is GO", () => {
    expect(content).not.toMatch(/public.launch.*=.*GO/i);
    expect(content).not.toMatch(/lancement.*public.*GO/i);
  });

  it("doc does not contain forbidden phrase 'zero erreur'", () => {
    expect(content).not.toMatch(/z.ro erreur/i);
  });

  it("doc does not contain forbidden phrase 'conformite garantie'", () => {
    expect(content).not.toMatch(/conformit. garantie/i);
  });

  it("doc does not claim Pierre remplace un avocat", () => {
    expect(content).not.toMatch(/remplace un avocat/i);
  });

  it("doc does not claim Pierre fait la paie officielle autonome", () => {
    expect(content).not.toMatch(/paie officielle autonome/i);
  });
});

// ── Safety — no forbidden code modifications ─────────────────────────────────

describe("tech-01 — no forbidden code modifications", () => {
  it("no public launch flag set to true programmatically", () => {
    const content = readLib("clonestore/technologies/contracts.ts");
    expect(content).not.toMatch(/process\.env\.B48_PUBLIC_LAUNCH_ENABLED\s*=\s*['"]?true/);
    expect(content).not.toMatch(/const B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("no proof auto-validated in technology registry", () => {
    const content = readLib("clonestore/technologies/registry.ts");
    expect(content).not.toMatch(/verified\s*[:=]\s*true/);
    expect(content).not.toMatch(/auto.validate/i);
  });

  it("no OpenAI or Anthropic direct calls in technology contracts", () => {
    const content = readLib("clonestore/technologies/contracts.ts");
    expect(content).not.toMatch(/openai\.com\/v1/i);
    expect(content).not.toMatch(/anthropic\.com\/v1/i);
    expect(content).not.toMatch(/sk-live-/i);
  });

  it("no Stripe live key references in technology registry", () => {
    const content = readLib("clonestore/technologies/registry.ts");
    expect(content).not.toMatch(/sk_live_/i);
    expect(content).not.toMatch(/pk_live_/i);
  });
});
