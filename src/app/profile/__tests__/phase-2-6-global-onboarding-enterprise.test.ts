// PHASE 2.6 — Global Onboarding Enterprise Foundation — Tests
// Tests statiques vérifiant /profile/onboarding est l'onboarding global CloneStore.
// Local state. Pas de DB. Aucune exécution. Aucun appel externe.

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), relativePath));
}

function readFile(relativePath: string): string {
  const fullPath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(fullPath)) return "";
  return fs.readFileSync(fullPath, "utf-8");
}

const PAGE_PATH = "src/app/profile/onboarding/page.tsx";
const DOC_PATH = "docs/PHASE_2_6_GLOBAL_ONBOARDING_ENTERPRISE_FOUNDATION.md";

const page = readFile(PAGE_PATH);
const pageLower = page.toLowerCase();
const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — Page existe ─────────────────────────────────────────────────────────

describe("T01 — Page /profile/onboarding existe", () => {
  it("T01.1 — page.tsx existe", () => {
    expect(fileExists(PAGE_PATH)).toBe(true);
  });

  it("T01.2 — page mentionne onboarding global ou configurer votre entreprise", () => {
    const hasOnboarding =
      pageLower.includes("onboarding global") ||
      pageLower.includes("configurer votre entreprise") ||
      pageLower.includes("configuration guidée");
    expect(hasOnboarding).toBe(true);
  });
});

// ── T02 — Contenu des 6 étapes ────────────────────────────────────────────────

describe("T02 — Contenu des 6 étapes onboarding", () => {
  it("T02.1 — page mentionne entreprise ou identité entreprise", () => {
    expect(pageLower).toContain("entreprise");
  });

  it("T02.2 — page mentionne CloneADN", () => {
    expect(pageLower).toContain("cloneadn");
  });

  it("T02.3 — page mentionne humains ou équipe", () => {
    const hasHumains = pageLower.includes("humains") || pageLower.includes("équipe");
    expect(hasHumains).toBe(true);
  });

  it("T02.4 — page mentionne documents", () => {
    expect(pageLower).toContain("documents");
  });

  it("T02.5 — page mentionne règles", () => {
    expect(pageLower).toContain("règles");
  });

  it("T02.6 — page mentionne validations", () => {
    expect(pageLower).toContain("validations");
  });

  it("T02.7 — page mentionne technologies", () => {
    expect(pageLower).toContain("technologies");
  });

  it("T02.8 — page mentionne première mission", () => {
    expect(pageLower).toContain("première mission");
  });

  it("T02.9 — page mentionne Pierre", () => {
    expect(pageLower).toContain("pierre");
  });
});

// ── T03 — Imports TECH ────────────────────────────────────────────────────────

describe("T03 — Imports TECH connectés", () => {
  it("T03.1 — page importe depuis clonestore/adn (CloneADN TECH-05)", () => {
    expect(page).toContain("clonestore/adn");
  });

  it("T03.2 — page utilise buildEmptyGlobalEnterpriseMemory", () => {
    expect(page).toContain("buildEmptyGlobalEnterpriseMemory");
  });

  it("T03.3 — page utilise computeCoverageScore", () => {
    expect(page).toContain("computeCoverageScore");
  });

  it("T03.4 — page utilise validateGlobalEnterpriseMemory", () => {
    expect(page).toContain("validateGlobalEnterpriseMemory");
  });

  it("T03.5 — page importe PIERRE_EMPLOYEE_RUNTIME_CONTRACT", () => {
    expect(page).toContain("PIERRE_EMPLOYEE_RUNTIME_CONTRACT");
  });

  it("T03.6 — page importe DEFAULT_GLOBAL_TECH_CONFIGS ou GlobalTechnologyConfig", () => {
    const hasTech =
      page.includes("DEFAULT_GLOBAL_TECH_CONFIGS") ||
      page.includes("DEFAULT_GLOBAL_TECH_CONFIG_LIST");
    expect(hasTech).toBe(true);
  });
});

// ── T04 — Liens de navigation ─────────────────────────────────────────────────

describe("T04 — Liens de navigation présents", () => {
  it("T04.1 — page contient lien /profile/agents", () => {
    expect(page).toContain("/profile/agents");
  });

  it("T04.2 — page contient lien /profile/messages", () => {
    expect(page).toContain("/profile/messages");
  });

  it("T04.3 — page contient lien /profile/technologies", () => {
    expect(page).toContain("/profile/technologies");
  });

  it("T04.4 — page contient lien /agents/pierre/use", () => {
    expect(page).toContain("/agents/pierre/use");
  });

  it("T04.5 — page contient lien /agents/pierre/setup", () => {
    expect(page).toContain("/agents/pierre/setup");
  });
});

// ── T05 — Pierre seul actif + plan-only ──────────────────────────────────────

describe("T05 — Pierre seul actif V1 + plan-only", () => {
  it("T05.1 — page mentionne Pierre seul employé actif V1", () => {
    const hasPierreOnly =
      pageLower.includes("pierre est le seul employé ia actif en v1") ||
      pageLower.includes("seul employé ia actif en v1");
    expect(hasPierreOnly).toBe(true);
  });

  it("T05.2 — page mentionne plan-only ou aucune action exécutée", () => {
    const hasPlanOnly =
      pageLower.includes("plan-only") ||
      pageLower.includes("plan_only") ||
      pageLower.includes("aucune action exécutée");
    expect(hasPlanOnly).toBe(true);
  });

  it("T05.3 — page mentionne validation humaine", () => {
    expect(pageLower).toContain("validation humaine");
  });

  it("T05.4 — page ne présente pas Emma active", () => {
    expect(page).not.toContain("Emma active");
    expect(page).not.toContain("Emma actif");
  });

  it("T05.5 — page ne présente pas Lucas actif", () => {
    expect(page).not.toContain("Lucas actif");
  });

  it("T05.6 — page ne présente pas Sophie active", () => {
    expect(page).not.toContain("Sophie active");
    expect(page).not.toContain("Sophie actif");
  });
});

// ── T06 — Garde-fous texte ────────────────────────────────────────────────────

describe("T06 — Garde-fous texte respectés", () => {
  it("T06.1 — page ne dit pas configuration enregistrée de manière trompeuse", () => {
    // 'enregistrée' peut figurer mais pas dans un sens DB trompeur
    expect(pageLower).not.toContain("données enregistrées en base");
    expect(pageLower).not.toContain("sauvegardé en base de données");
  });

  it("T06.2 — page ne dit pas email envoyé", () => {
    expect(pageLower).not.toContain("email envoyé avec succès");
  });

  it("T06.3 — page ne dit pas document généré avec succès", () => {
    expect(pageLower).not.toContain("document généré avec succès");
    expect(pageLower).not.toContain("document généré par pierre de manière autonome");
  });

  it("T06.4 — page ne dit pas mission exécutée avec succès", () => {
    expect(pageLower).not.toContain("mission exécutée avec succès");
    expect(pageLower).not.toContain("action exécutée avec succès");
  });

  it("T06.5 — page ne dit pas conformité garantie", () => {
    expect(pageLower).not.toContain("conformité garantie");
  });

  it("T06.6 — page ne dit pas zéro erreur", () => {
    expect(pageLower).not.toContain("zéro erreur");
  });

  it("T06.7 — page ne dit pas public launch GO", () => {
    expect(pageLower).not.toContain("public launch go");
  });
});

// ── T07 — Conformité absolue ──────────────────────────────────────────────────

describe("T07 — Conformité absolue", () => {
  it("T07.1 — page ne contient pas Supabase write direct", () => {
    expect(page).not.toContain('.from("orders").insert');
    expect(page).not.toContain('.from("onboarding").insert');
  });

  it("T07.2 — page ne contient pas appel OpenAI", () => {
    expect(pageLower).not.toContain("openai.chat");
    expect(pageLower).not.toContain("openai.completions");
  });

  it("T07.3 — page ne contient pas appel Anthropic", () => {
    expect(pageLower).not.toContain("anthropic.messages");
  });

  it("T07.4 — page ne contient pas Stripe live", () => {
    expect(pageLower).not.toContain("stripe.charges.create");
  });
});

// ── T08 — Documentation PHASE 2.6 ────────────────────────────────────────────

describe("T08 — Documentation PHASE 2.6", () => {
  it("T08.1 — doc PHASE_2_6 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T08.2 — doc mentionne onboarding global vs setup Pierre", () => {
    expect(docLower).toContain("setup pierre");
  });

  it("T08.3 — doc mentionne CloneADN Global", () => {
    expect(docLower).toContain("cloneadn global");
  });

  it("T08.4 — doc mentionne première mission guidée Pierre", () => {
    expect(docLower).toContain("première mission guidée");
  });

  it("T08.5 — doc mentionne pas de persistance DB", () => {
    expect(docLower).toContain("pas de persistance db") ||
      expect(docLower).toContain("local state");
  });

  it("T08.6 — doc mentionne PHASE 2.7", () => {
    expect(doc).toContain("PHASE 2.7");
  });

  it("T08.7 — doc mentionne NO-GO", () => {
    expect(docLower).toContain("no-go");
  });
});

// ── T09 — Intégrité fichiers existants ───────────────────────────────────────

describe("T09 — Intégrité fichiers PHASE 2.1 → 2.5", () => {
  it("T09.1 — PHASE 2.5 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-5-messages-center-4-tabs.test.ts")).toBe(true);
  });

  it("T09.2 — PHASE 2.4 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-4-last-request-panel.test.ts")).toBe(true);
  });

  it("T09.3 — PHASE 2.3 test intact", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-3-cloneos-command-bar.test.ts")).toBe(true);
  });

  it("T09.4 — /agents/pierre/setup intact", () => {
    expect(fileExists("src/app/agents/pierre/setup/page.tsx")).toBe(true);
  });

  it("T09.5 — Pierre moteur intact", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });

  it("T09.6 — Pierre cockpit intact", () => {
    expect(fileExists("src/app/agents/pierre/use/page.tsx")).toBe(true);
  });

  it("T09.7 — TECH-11 test intact", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });
});
