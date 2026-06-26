// PHASE 2.7 — Pierre Cockpit Global Integration — Tests
// Tests statiques vérifiant l'intégration de Pierre dans l'espace global CloneStore.
// Lecture seule. Aucune exécution. Moteur Pierre intact.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function readFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf-8");
}

const PIERRE_PAGE = "src/app/agents/pierre/use/page.tsx";
const AGENTS_PAGE = "src/app/profile/agents/page.tsx";
const DOC_PATH = "docs/PHASE_2_7_PIERRE_COCKPIT_GLOBAL_INTEGRATION.md";

const pierrePage = readFile(PIERRE_PAGE);
const pierrePageLower = pierrePage.toLowerCase();
const agentsPage = readFile(AGENTS_PAGE);
const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — Pages existent ──────────────────────────────────────────────────────

describe("T01 — Pages existent", () => {
  it("T01.1 — /agents/pierre/use/page.tsx existe", () => {
    expect(fileExists(PIERRE_PAGE)).toBe(true);
  });

  it("T01.2 — /profile/agents/page.tsx existe", () => {
    expect(fileExists(AGENTS_PAGE)).toBe(true);
  });
});

// ── T02 — Pierre page : contexte global ──────────────────────────────────────

describe("T02 — Pierre page mentionne le contexte global CloneStore", () => {
  it("T02.1 — Pierre page mentionne CloneStore ou espace CloneStore", () => {
    const hasCloneStore =
      pierrePageLower.includes("clonestore") ||
      pierrePageLower.includes("espace clonestore");
    expect(hasCloneStore).toBe(true);
  });

  it("T02.2 — Pierre page mentionne CloneOS", () => {
    expect(pierrePageLower).toContain("cloneos");
  });

  it("T02.3 — Pierre page mentionne CloneADN", () => {
    expect(pierrePageLower).toContain("cloneadn");
  });

  it("T02.4 — Pierre page mentionne CloneGuard", () => {
    expect(pierrePageLower).toContain("cloneguard");
  });

  it("T02.5 — Pierre page mentionne CloneTrace", () => {
    expect(pierrePageLower).toContain("clonetrace");
  });

  it("T02.6 — Pierre page mentionne CloneBrief", () => {
    expect(pierrePageLower).toContain("clonebrief");
  });

  it("T02.7 — Pierre page mentionne validation humaine", () => {
    expect(pierrePageLower).toContain("validation humaine");
  });
});

// ── T03 — Pierre page : liens globaux ─────────────────────────────────────────

describe("T03 — Pierre page contient liens globaux", () => {
  it("T03.1 — Pierre page contient lien /profile/agents", () => {
    expect(pierrePage).toContain("/profile/agents");
  });

  it("T03.2 — Pierre page contient lien /profile/messages", () => {
    expect(pierrePage).toContain("/profile/messages");
  });

  it("T03.3 — Pierre page contient lien /profile/onboarding", () => {
    expect(pierrePage).toContain("/profile/onboarding");
  });

  it("T03.4 — Pierre page contient lien /profile/technologies", () => {
    expect(pierrePage).toContain("/profile/technologies");
  });

  it("T03.5 — Pierre page contient lien /agents/pierre/setup", () => {
    expect(pierrePage).toContain("/agents/pierre/setup");
  });
});

// ── T04 — Pierre page : garde-fous ───────────────────────────────────────────

describe("T04 — Pierre page garde-fous plan-only", () => {
  it("T04.1 — Pierre page mentionne plan préparé ou lecture seule si CloneOS history", () => {
    const hasPlanOnly =
      pierrePageLower.includes("plan préparé") ||
      pierrePageLower.includes("lecture seule");
    expect(hasPlanOnly).toBe(true);
  });

  it("T04.2 — Pierre page ne dit pas mission exécutée", () => {
    expect(pierrePageLower).not.toContain("mission exécutée avec succès");
    expect(pierrePageLower).not.toContain("action exécutée avec succès");
  });

  it("T04.3 — Pierre page ne dit pas document généré", () => {
    expect(pierrePageLower).not.toContain("document généré avec succès");
    expect(pierrePageLower).not.toContain("document généré par pierre de manière autonome");
  });

  it("T04.4 — Pierre page ne dit pas email envoyé", () => {
    expect(pierrePageLower).not.toContain("email envoyé avec succès");
  });

  it("T04.5 — Pierre page ne dit pas conformité garantie", () => {
    expect(pierrePageLower).not.toContain("conformité garantie");
  });

  it("T04.6 — Pierre page ne dit pas zéro erreur", () => {
    expect(pierrePageLower).not.toContain("zéro erreur");
  });
});

// ── T05 — Pierre page : conformité absolue ────────────────────────────────────

describe("T05 — Conformité absolue Pierre page", () => {
  it("T05.1 — Pierre page ne contient pas Supabase write direct ajouté", () => {
    // Vérifier qu'aucun write Supabase n'a été ajouté en PHASE 2.7
    // Les writes existants dans les hooks métier sont dans d'autres fichiers
    expect(pierrePage).not.toContain('.from("orders").insert');
    expect(pierrePage).not.toContain('.from("missions").insert');
  });

  it("T05.2 — Pierre page ne contient pas appel OpenAI", () => {
    expect(pierrePageLower).not.toContain("openai.chat");
    expect(pierrePageLower).not.toContain("openai.completions");
  });

  it("T05.3 — Pierre page ne contient pas appel Anthropic", () => {
    expect(pierrePageLower).not.toContain("anthropic.messages");
  });

  it("T05.4 — Pierre page ne contient pas Stripe live", () => {
    expect(pierrePageLower).not.toContain("stripe.charges.create");
  });
});

// ── T06 — /profile/agents : lien onboarding ──────────────────────────────────

describe("T06 — /profile/agents contient les liens PHASE 2.7", () => {
  it("T06.1 — agents page contient lien /agents/pierre/use", () => {
    expect(agentsPage).toContain("/agents/pierre/use");
  });

  it("T06.2 — agents page contient lien /agents/pierre/setup", () => {
    expect(agentsPage).toContain("/agents/pierre/setup");
  });

  it("T06.3 — agents page contient lien /profile/onboarding", () => {
    expect(agentsPage).toContain("/profile/onboarding");
  });

  it("T06.4 — agents page mentionne Pierre seul employé actif V1 ou équivalent", () => {
    const hasPierre =
      agentsPage.toLowerCase().includes("pierre") &&
      (agentsPage.toLowerCase().includes("seul") ||
        agentsPage.toLowerCase().includes("premier employé"));
    expect(hasPierre).toBe(true);
  });
});

// ── T07 — Documentation PHASE 2.7 ────────────────────────────────────────────

describe("T07 — Documentation PHASE 2.7", () => {
  it("T07.1 — doc PHASE_2_7 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T07.2 — doc mentionne intégration globale Pierre", () => {
    expect(docLower).toContain("intégration");
    expect(docLower).toContain("pierre");
  });

  it("T07.3 — doc mentionne CloneOS", () => {
    expect(docLower).toContain("cloneos");
  });

  it("T07.4 — doc mentionne CloneADN", () => {
    expect(docLower).toContain("cloneadn");
  });

  it("T07.5 — doc mentionne CloneGuard", () => {
    expect(docLower).toContain("cloneguard");
  });

  it("T07.6 — doc mentionne CloneTrace", () => {
    expect(docLower).toContain("clonetrace");
  });

  it("T07.7 — doc mentionne PHASE 2.8", () => {
    expect(doc).toContain("PHASE 2.8");
  });

  it("T07.8 — doc mentionne NO-GO", () => {
    expect(docLower).toContain("no-go");
  });
});

// ── T08 — Intégrité fichiers existants ───────────────────────────────────────

describe("T08 — Intégrité PHASE 2.1 → 2.6", () => {
  it("T08.1 — PHASE 2.6 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-6-global-onboarding-enterprise.test.ts")).toBe(true);
  });

  it("T08.2 — PHASE 2.5 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-5-messages-center-4-tabs.test.ts")).toBe(true);
  });

  it("T08.3 — Pierre moteur intact", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });

  it("T08.4 — Pierre cockpit composants intacts", () => {
    expect(fileExists("src/app/agents/pierre/use/components/PierreCockpitShell.tsx")).toBe(true);
    expect(fileExists("src/app/agents/pierre/use/components/PierreCommandCenter.tsx")).toBe(true);
  });

  it("T08.5 — Pierre API intacte", () => {
    expect(fileExists("src/app/api/pierre")).toBe(true);
  });

  it("T08.6 — TECH-11 test intact", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });
});
