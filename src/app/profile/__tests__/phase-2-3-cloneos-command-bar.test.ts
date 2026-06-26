// PHASE 2.3 — CloneOS Global Command Bar — Tests
// Tests statiques vérifiant que /profile/agents est branché sur CloneOS TECH-08.
// Mode plan-only. Aucune exécution, aucune DB, aucun appel Pierre runtime.
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
const DOC_PATH = "docs/PHASE_2_3_CLONEOS_GLOBAL_COMMAND_BAR.md";

const page = readFile(PAGE_PATH);
const pageLower = page.toLowerCase();
const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();

// ── T01 — CloneOS TECH-08 branché ────────────────────────────────────────────

describe("T01 — CloneOS TECH-08 branché dans la page", () => {
  it("T01.1 — page importe processCloneOSCommand", () => {
    expect(page).toContain("processCloneOSCommand");
  });

  it("T01.2 — page importe depuis @/lib/clonestore/cloneos", () => {
    expect(page).toContain("clonestore/cloneos");
  });

  it("T01.3 — page utilise CloneOSCommandInput", () => {
    expect(page).toContain("CloneOSCommandInput");
  });

  it("T01.4 — page utilise CloneOSCommandCenterResult", () => {
    expect(page).toContain("CloneOSCommandCenterResult");
  });

  it("T01.5 — page ne se contente pas uniquement de buildPlan mock local", () => {
    // processCloneOSCommand doit être présent et appelé
    expect(page).toContain("processCloneOSCommand");
    // Depuis PHASE 2.4, l'appel est dans runCloneOSCommand(text) qui appelle
    // processCloneOSCommand(input) — le nom de variable a changé de cloneOSInput à input
    // On vérifie que processCloneOSCommand est bien appelé quelque part
    const hasCall =
      page.includes("processCloneOSCommand(input)") ||
      page.includes("processCloneOSCommand(cloneOSInput)");
    expect(hasCall).toBe(true);
  });

  it("T01.6 — page utilise source: profile_command_center", () => {
    expect(page).toContain("profile_command_center");
  });
});

// ── T02 — Affichage plan-only ─────────────────────────────────────────────────

describe("T02 — Affichage plan-only honnête", () => {
  it("T02.1 — page mentionne 'Plan préparé' (label plan-only PHASE 2.4)", () => {
    // CLONEOS_PLAN_ONLY_LABEL a été mis à jour en PHASE 2.4 :
    // "Plan préparé — non exécuté." (plus précis qu'avant)
    expect(pageLower).toContain("plan préparé");
  });

  it("T02.2 — page mentionne 'non exécuté' (formulation PHASE 2.4)", () => {
    // CLONEOS_PLAN_ONLY_LABEL = "Plan préparé — non exécuté."
    expect(pageLower).toContain("non exécuté");
  });

  it("T02.3 — page utilise CLONEOS_PLAN_ONLY_LABEL", () => {
    expect(page).toContain("CLONEOS_PLAN_ONLY_LABEL");
  });

  it("T02.4 — page n'affiche pas 'mission exécutée' comme succès dans le plan CloneOS", () => {
    // "exécutée" peut apparaître en négatif (ex: "Non exécutée.", "aucune action exécutée")
    // mais ne doit pas être présenté comme un résultat positif du plan
    // Vérifie que la page ne dit pas "Mission exécutée par CloneOS" ni "Exécution réussie"
    expect(pageLower).not.toContain("exécution réussie");
    expect(pageLower).not.toContain("mission exécutée par cloneos");
    expect(pageLower).not.toContain("action exécutée avec succès");
  });

  it("T02.5 — page n'affiche pas 'document généré' comme livrable du plan CloneOS", () => {
    // "généré" peut apparaître dans d'autres contextes légitimes (briefings, etc.)
    // Vérifie seulement qu'on ne présente pas de document comme généré par le plan
    expect(pageLower).not.toContain("document généré avec succès");
    expect(pageLower).not.toContain("document livré par cloneos");
  });
});

// ── T03 — Classification CloneOS ──────────────────────────────────────────────

describe("T03 — Classification CloneOS affichée", () => {
  it("T03.1 — page mentionne classification", () => {
    expect(pageLower).toContain("classification");
  });

  it("T03.2 — page utilise cloneOSDomainLabel ou équivalent", () => {
    expect(page).toContain("cloneOSDomainLabel");
  });

  it("T03.3 — page affiche le domaine RH", () => {
    expect(page).toContain('"hr"');
    expect(pageLower).toContain('"rh"');
  });

  it("T03.4 — page affiche l'intention détectée", () => {
    // L'intention est affichée depuis classified.intent
    expect(page).toContain("classified.intent");
  });

  it("T03.5 — page affiche le risque", () => {
    expect(page).toContain("classified.risk_level");
  });

  it("T03.6 — page affiche la confiance", () => {
    expect(page).toContain("classified.confidence");
  });
});

// ── T04 — Routage ─────────────────────────────────────────────────────────────

describe("T04 — Routage CloneOS", () => {
  it("T04.1 — page mentionne routage", () => {
    expect(pageLower).toContain("routage");
  });

  it("T04.2 — page affiche Pierre pour les demandes RH", () => {
    expect(page).toContain("Pierre (RH)");
  });

  it("T04.3 — page gère route.is_available", () => {
    expect(page).toContain("route?.is_available");
  });

  it("T04.4 — page affiche le message 'aucun employé actif disponible' pour domaines non RH", () => {
    expect(page).toContain("CLONEOS_NO_EMPLOYEE_LABEL");
  });

  it("T04.5 — page ne route pas finance vers Lucas actif", () => {
    // Lucas peut apparaître dans ROUTING_KEYWORDS (pour détecter la demande) ou ROADMAP_EMPLOYEES
    // mais ne doit jamais être présenté comme un employé actif ou routé activement
    expect(page).not.toContain('slug: "lucas", active: true');
    expect(page).not.toContain('route.employee_slug === "lucas"');
    expect(page).not.toContain("Lucas actif");
    expect(page).not.toContain("Lucas active");
  });

  it("T04.6 — page ne route pas support vers Emma active", () => {
    expect(page).not.toContain('route.employee_slug === "emma"');
    expect(page).not.toContain('"emma", active: true');
  });
});

// ── T05 — CloneGuard affiché ──────────────────────────────────────────────────

describe("T05 — CloneGuard affiché dans le résultat", () => {
  it("T05.1 — page mentionne Guard", () => {
    expect(pageLower).toContain("cloneguard");
  });

  it("T05.2 — page utilise guard.overall_decision", () => {
    expect(page).toContain("guard.overall_decision");
  });

  it("T05.3 — page utilise cloneOSGuardDecisionLabel", () => {
    expect(page).toContain("cloneOSGuardDecisionLabel");
  });

  it("T05.4 — page protège contre paie officielle / payroll", () => {
    expect(pageLower).toContain("paie officielle");
  });

  it("T05.5 — page protège contre licenciement / termination", () => {
    expect(pageLower).toContain("licenciement");
    expect(pageLower).toContain("termination");
  });

  it("T05.6 — page protège contre décision légale / legal", () => {
    expect(pageLower).toContain("décision légale");
  });

  it("T05.7 — page protège contre signature de contrat", () => {
    expect(pageLower).toContain("signature de contrat");
  });

  it("T05.8 — page mentionne validation humaine obligatoire pour les actions sensibles", () => {
    expect(pageLower).toContain("validation humaine");
  });
});

// ── T06 — Aperçu de trace ────────────────────────────────────────────────────

describe("T06 — Aperçu de trace CloneOS", () => {
  it("T06.1 — page mentionne aperçu de trace", () => {
    expect(pageLower).toContain("aperçu de trace");
  });

  it("T06.2 — page utilise CLONEOS_TRACE_PREVIEW_LABEL", () => {
    expect(page).toContain("CLONEOS_TRACE_PREVIEW_LABEL");
  });

  it("T06.3 — page utilise trace_result", () => {
    expect(page).toContain("trace_result");
  });

  it("T06.4 — page mentionne que la trace n'est pas persistée en base", () => {
    expect(pageLower).toContain("non persisté");
  });

  it("T06.5 — page utilise trace.event_count", () => {
    expect(page).toContain("trace.event_count");
  });
});

// ── T07 — Employés non actifs ─────────────────────────────────────────────────

describe("T07 — Futurs employés jamais actifs", () => {
  it("T07.1 — page n'affiche pas Emma comme active", () => {
    expect(page).not.toContain("Emma active");
    expect(page).not.toContain("Emma actif");
    expect(page).not.toContain('name: "Emma", active: true');
  });

  it("T07.2 — page n'affiche pas Lucas comme actif", () => {
    expect(page).not.toContain("Lucas actif");
    expect(page).not.toContain("Lucas active");
    expect(page).not.toContain('name: "Lucas", active: true');
  });

  it("T07.3 — page n'affiche pas Sophie comme active", () => {
    expect(page).not.toContain("Sophie active");
    expect(page).not.toContain("Sophie actif");
    expect(page).not.toContain('name: "Sophie", active: true');
  });

  it("T07.4 — page n'affiche pas Clara comme active", () => {
    expect(page).not.toContain("Clara active");
    expect(page).not.toContain("Clara actif");
  });
});

// ── T08 — Conformité absolue ──────────────────────────────────────────────────

describe("T08 — Conformité absolue", () => {
  it("T08.1 — page ne dit pas public launch GO", () => {
    expect(pageLower).not.toContain("public launch go");
    expect(pageLower).not.toContain("lancement public go");
  });

  it("T08.2 — page ne dit pas zéro erreur", () => {
    expect(pageLower).not.toContain("zéro erreur");
  });

  it("T08.3 — page ne dit pas conformité garantie", () => {
    expect(pageLower).not.toContain("conformité garantie");
  });

  it("T08.4 — page ne contient pas appel OpenAI", () => {
    expect(pageLower).not.toContain("openai.chat");
    expect(pageLower).not.toContain("openai.completions");
  });

  it("T08.5 — page ne contient pas appel Anthropic", () => {
    expect(pageLower).not.toContain("anthropic.messages");
  });

  it("T08.6 — page ne contient pas Stripe live charge", () => {
    expect(pageLower).not.toContain("stripe.charges.create");
    expect(pageLower).not.toContain("stripe.paymentintents.create");
  });

  it("T08.7 — page ne contient pas écriture Supabase directe sur tables sensibles", () => {
    expect(page).not.toContain('.from("orders").insert');
    expect(page).not.toContain('.from("missions").insert');
    expect(page).not.toContain('.from("validations").insert');
  });

  it("T08.8 — page ne dit pas CloneChat = CloneOS", () => {
    expect(pageLower).not.toContain("clonechat = cloneos");
    expect(pageLower).not.toContain("clonechat est cloneos");
  });

  it("T08.9 — page ne dit pas Pierre = CloneOS", () => {
    expect(pageLower).not.toContain("pierre = cloneos");
    expect(pageLower).not.toContain("pierre est cloneos");
  });
});

// ── T09 — Documentation PHASE 2.3 ────────────────────────────────────────────

describe("T09 — Documentation PHASE 2.3", () => {
  it("T09.1 — doc PHASE_2_3 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T09.2 — doc mentionne CloneOS", () => {
    expect(docLower).toContain("cloneos");
  });

  it("T09.3 — doc mentionne classification", () => {
    expect(docLower).toContain("classification");
  });

  it("T09.4 — doc mentionne routing / routage", () => {
    expect(docLower).toContain("routage");
  });

  it("T09.5 — doc mentionne Guard", () => {
    expect(docLower).toContain("guard");
  });

  it("T09.6 — doc mentionne trace preview / aperçu de trace", () => {
    expect(docLower).toContain("trace preview");
  });

  it("T09.7 — doc mentionne plan-only / aucune exécution", () => {
    expect(docLower).toContain("plan-only");
    expect(docLower).toContain("aucune action");
  });

  it("T09.8 — doc mentionne PHASE 2.4 comme prochain", () => {
    expect(doc).toContain("PHASE 2.4");
  });

  it("T09.9 — doc mentionne NO-GO externe", () => {
    expect(docLower).toContain("no-go");
  });
});

// ── T10 — Intégrité des fichiers existants ────────────────────────────────────

describe("T10 — Intégrité des fichiers existants", () => {
  it("T10.1 — PHASE 2.2 test intact", () => {
    expect(
      fileExists("src/app/profile/__tests__/phase-2-2-global-cockpit-shell.test.ts"),
    ).toBe(true);
  });

  it("T10.2 — PHASE 2.1 test intact", () => {
    expect(
      fileExists("src/app/profile/__tests__/phase-2-1-global-cockpit-audit.test.ts"),
    ).toBe(true);
  });

  it("T10.3 — TECH-11 test intact", () => {
    expect(
      fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts"),
    ).toBe(true);
  });

  it("T10.4 — Pierre moteur intact", () => {
    expect(fileExists("src/lib/pierre")).toBe(true);
  });

  it("T10.5 — Pierre cockpit intact", () => {
    expect(fileExists("src/app/agents/pierre/use/page.tsx")).toBe(true);
  });

  it("T10.6 — CloneOS TECH-08 module intact", () => {
    expect(fileExists("src/lib/clonestore/cloneos/cloneos-command-center.ts")).toBe(true);
    expect(fileExists("src/lib/clonestore/cloneos/index.ts")).toBe(true);
  });

  it("T10.7 — Employee Registry intact", () => {
    expect(fileExists("src/lib/clonestore/employees/employee-registry.ts")).toBe(true);
  });

  it("T10.8 — PHASE 2.3 doc intact", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });
});
