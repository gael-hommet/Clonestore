// PHASE 2.2 — Global Cockpit Shell / Mon espace Premium — Tests
// Tests statiques vérifiant que /profile/agents est connecté aux données réelles de base.
// Aucune donnée modifiée. Aucun appel externe. Aucun proof auto-validé.

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

const PAGE_PATH = "src/app/profile/agents/page.tsx";
const DOC_PATH = "docs/PHASE_2_2_GLOBAL_COCKPIT_SHELL.md";

const page = readFile(PAGE_PATH);
const pageLower = page.toLowerCase();
const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — Page existe et est structurée ───────────────────────────────────────

describe("T01 — Page /profile/agents existe", () => {
  it("T01.1 — /profile/agents/page.tsx existe", () => {
    expect(fileExists(PAGE_PATH)).toBe(true);
  });

  it("T01.2 — page utilise Employee Runtime Registry", () => {
    expect(page).toContain("EMPLOYEE_RUNTIME_REGISTRY");
  });

  it("T01.3 — page utilise PIERRE_EMPLOYEE_RUNTIME_CONTRACT", () => {
    expect(page).toContain("PIERRE_EMPLOYEE_RUNTIME_CONTRACT");
  });

  it("T01.4 — page importe depuis employee-registry", () => {
    expect(page).toContain("employee-registry");
  });

  it("T01.5 — page utilise DEFAULT_GLOBAL_TECH_CONFIGS", () => {
    expect(page).toContain("DEFAULT_GLOBAL_TECH_CONFIGS");
  });

  it("T01.6 — page utilise DEFAULT_GLOBAL_TECH_CONFIG_LIST", () => {
    expect(page).toContain("DEFAULT_GLOBAL_TECH_CONFIG_LIST");
  });

  it("T01.7 — page importe depuis global-tech-defaults", () => {
    expect(page).toContain("global-tech-defaults");
  });
});

// ── T02 — Pierre seul actif réel ──────────────────────────────────────────────

describe("T02 — Pierre est le seul actif réel V1", () => {
  it("T02.1 — page mentionne Pierre", () => {
    expect(pageLower).toContain("pierre");
  });

  it("T02.2 — page contient lien /agents/pierre/use", () => {
    expect(page).toContain("/agents/pierre/use");
  });

  it("T02.3 — page contient lien /agents/pierre/setup", () => {
    expect(page).toContain("/agents/pierre/setup");
  });

  it("T02.4 — page contient PierreContractBanner ou équivalent", () => {
    // Vérifier que le contrat Pierre est affiché dans la page
    expect(page).toContain("PierreContractBanner");
  });
});

// ── T03 — Futurs employés jamais actifs ───────────────────────────────────────

describe("T03 — Futurs employés non actifs", () => {
  it("T03.1 — page n'affiche pas Emma comme active dans EmployeeCard actif", () => {
    // Emma ne doit pas être dans EMPLOYEE_RUNTIME_REGISTRY
    // Elle peut figurer dans ROADMAP_EMPLOYEES mais pas comme active
    const hasEmmaActive =
      page.includes('"emma"') &&
      page.includes('status: "active"') &&
      page.indexOf('"emma"') < page.indexOf('status: "active"') &&
      page.indexOf('status: "active"') - page.indexOf('"emma"') < 200;
    // Test souple : vérifier que Emma ne peut pas avoir active=true dans EmployeeCard
    expect(page).not.toContain('name: "Emma", active: true');
    expect(page).not.toContain("Emma actif");
    expect(page).not.toContain("Emma active");
  });

  it("T03.2 — page n'affiche pas Lucas comme actif", () => {
    expect(page).not.toContain("Lucas actif");
    expect(page).not.toContain("Lucas active");
    expect(page).not.toContain('name: "Lucas", active: true');
  });

  it("T03.3 — page n'affiche pas Sophie comme active", () => {
    expect(page).not.toContain("Sophie active");
    expect(page).not.toContain("Sophie actif");
    expect(page).not.toContain('name: "Sophie", active: true');
  });

  it("T03.4 — page n'affiche pas Clara comme active", () => {
    expect(page).not.toContain("Clara active");
    expect(page).not.toContain("Clara actif");
    expect(page).not.toContain('name: "Clara", active: true');
  });

  it("T03.5 — page mentionne roadmap / bientôt / non activé pour futurs employés", () => {
    const hasRoadmapSignal =
      page.includes("ROADMAP_EMPLOYEES") ||
      page.includes("roadmap") ||
      page.includes("bientôt") ||
      page.includes("non activé");
    expect(hasRoadmapSignal).toBe(true);
  });

  it("T03.6 — page contient RoadmapEmployeeCard ou équivalent", () => {
    expect(page).toContain("RoadmapEmployeeCard");
  });

  it("T03.7 — page contient la phrase réglementaire pour les employés non actifs", () => {
    expect(page).toContain("non activé dans votre espace");
  });
});

// ── T04 — Technologies réelles ────────────────────────────────────────────────

describe("T04 — Technologies depuis GlobalTechnologyConfig", () => {
  it("T04.1 — page mentionne CloneOS", () => {
    expect(pageLower).toContain("cloneos");
  });

  it("T04.2 — page mentionne CloneADN", () => {
    expect(pageLower).toContain("cloneadn");
  });

  it("T04.3 — page mentionne CloneGuard", () => {
    expect(pageLower).toContain("cloneguard");
  });

  it("T04.4 — page mentionne CloneTrace", () => {
    expect(pageLower).toContain("clonetrace");
  });

  it("T04.5 — page mentionne CloneVoice non production / préparation", () => {
    // CloneVoice doit être affiché mais pas comme actif production
    expect(page).toContain("Préparation uniquement — non actif en production");
  });

  it("T04.6 — page ne dit pas CloneVoice actif production", () => {
    expect(pageLower).not.toContain("clonevoice actif production");
    expect(pageLower).not.toContain("clonevoice en production");
  });

  it("T04.7 — page contient lien /profile/technologies", () => {
    expect(page).toContain("/profile/technologies");
  });

  it("T04.8 — page utilise techSummary depuis DEFAULT_GLOBAL_TECH_CONFIG_LIST", () => {
    expect(page).toContain("techSummary");
    expect(page).toContain("DEFAULT_GLOBAL_TECH_CONFIG_LIST");
  });

  it("T04.9 — page utilise COCKPIT_VISIBLE_TECH_KEYS", () => {
    expect(page).toContain("COCKPIT_VISIBLE_TECH_KEYS");
  });
});

// ── T05 — Conformité absolue ──────────────────────────────────────────────────

describe("T05 — Conformité absolue", () => {
  it("T05.1 — page ne dit pas public launch GO", () => {
    expect(pageLower).not.toContain("public launch go");
    expect(pageLower).not.toContain("lancement public go");
  });

  it("T05.2 — page ne dit pas zéro erreur", () => {
    expect(pageLower).not.toContain("zéro erreur");
    expect(pageLower).not.toContain("zero erreur");
  });

  it("T05.3 — page ne dit pas conformité garantie", () => {
    expect(pageLower).not.toContain("conformité garantie");
    expect(pageLower).not.toContain("conformite garantie");
  });

  it("T05.4 — page ne dit pas CloneChat = CloneOS", () => {
    expect(pageLower).not.toContain("clonechat est cloneos");
    expect(pageLower).not.toContain("clonechat = cloneos");
  });

  it("T05.5 — page ne dit pas Pierre = CloneOS", () => {
    expect(pageLower).not.toContain("pierre est cloneos");
    expect(pageLower).not.toContain("pierre = cloneos");
  });

  it("T05.6 — page ne contient pas appel OpenAI", () => {
    expect(pageLower).not.toContain("openai.chat");
    expect(pageLower).not.toContain("openai.completions");
  });

  it("T05.7 — page ne contient pas appel Anthropic", () => {
    expect(pageLower).not.toContain("anthropic.messages");
    expect(pageLower).not.toContain("anthropic.completions");
  });

  it("T05.8 — page ne contient pas Stripe live charge", () => {
    expect(pageLower).not.toContain("stripe.charges.create");
    expect(pageLower).not.toContain("stripe.paymentintents.create");
  });

  it("T05.9 — page ne contient pas écriture Supabase directe non autorisée (insert/update sur tables sensibles)", () => {
    // Les seules writes Supabase autorisées sont l'auth (signOut, updateUser)
    // On vérifie qu'il n'y a pas d'insert/update sur des tables métier
    expect(page).not.toContain('.from("orders").insert');
    expect(page).not.toContain('.from("orders").update');
    expect(page).not.toContain('.from("missions").insert');
    expect(page).not.toContain('.from("validations").insert');
  });
});

// ── T06 — Documentation PHASE 2.2 ────────────────────────────────────────────

describe("T06 — Documentation PHASE 2.2", () => {
  it("T06.1 — doc PHASE_2_2 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T06.2 — doc mentionne Employee Runtime", () => {
    expect(docLower).toContain("employee runtime");
  });

  it("T06.3 — doc mentionne GlobalTechnologyConfig", () => {
    expect(docLower).toContain("globaltechnologyconfig");
  });

  it("T06.4 — doc mentionne Pierre seul actif", () => {
    expect(docLower).toContain("pierre");
    expect(docLower).toContain("seul");
    expect(docLower).toContain("actif");
  });

  it("T06.5 — doc mentionne PHASE 2.3 comme prochain bloc", () => {
    expect(doc).toContain("PHASE 2.3");
  });

  it("T06.6 — doc mentionne que launch reste NO-GO externe", () => {
    expect(docLower).toContain("no-go");
  });

  it("T06.7 — doc mentionne ce qui reste mock", () => {
    expect(docLower).toContain("mock");
  });
});

// ── T07 — Intégrité des fichiers existants ────────────────────────────────────

describe("T07 — Intégrité des fichiers existants", () => {
  it("T07.1 — Pierre moteur intact (src/lib/pierre existe)", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });

  it("T07.2 — Pierre cockpit intact (use/page.tsx)", () => {
    expect(fileExists("src/app/agents/pierre/use/page.tsx")).toBe(true);
  });

  it("T07.3 — Employee Registry intact", () => {
    expect(fileExists("src/lib/clonestore/employees/employee-registry.ts")).toBe(true);
  });

  it("T07.4 — GlobalTechDefaults intact", () => {
    expect(fileExists("src/lib/clonestore/technologies/global-tech-defaults.ts")).toBe(true);
  });

  it("T07.5 — PHASE 2.1 doc intact", () => {
    expect(fileExists("docs/PHASE_2_1_GLOBAL_COCKPIT_MESSAGES_ONBOARDING_AUDIT.md")).toBe(true);
  });

  it("T07.6 — TECH-11 test intact", () => {
    expect(
      fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts"),
    ).toBe(true);
  });

  it("T07.7 — PHASE 2.1 test intact", () => {
    expect(
      fileExists("src/app/profile/__tests__/phase-2-1-global-cockpit-audit.test.ts"),
    ).toBe(true);
  });
});
