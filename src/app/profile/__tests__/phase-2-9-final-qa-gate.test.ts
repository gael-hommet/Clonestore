// PHASE 2.9 — Phase 2 Final QA Gate — Tests
// Gate final de toute la PHASE 2 (2.1 → 2.8).
// Vérifie : doc, routes, docs PHASE 2, contenu clé, invariants, phases précédentes.
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

// ── Chemins ───────────────────────────────────────────────────────────────────

const DOC_2_9  = "docs/PHASE_2_9_FINAL_QA_GATE.md";
const DOC_2_1  = "docs/PHASE_2_1_GLOBAL_COCKPIT_MESSAGES_ONBOARDING_AUDIT.md";
const DOC_2_2  = "docs/PHASE_2_2_GLOBAL_COCKPIT_SHELL.md";
const DOC_2_3  = "docs/PHASE_2_3_CLONEOS_GLOBAL_COMMAND_BAR.md";
const DOC_2_4  = "docs/PHASE_2_4_LAST_REQUEST_PANEL_CLONEOS_TIMELINE.md";
const DOC_2_5  = "docs/PHASE_2_5_MESSAGES_CENTER_4_TABS.md";
const DOC_2_6  = "docs/PHASE_2_6_GLOBAL_ONBOARDING_ENTERPRISE_FOUNDATION.md";
const DOC_2_7  = "docs/PHASE_2_7_PIERRE_COCKPIT_GLOBAL_INTEGRATION.md";
const DOC_2_8  = "docs/PHASE_2_8_RESPONSIVE_PREMIUM_POLISH.md";

const AGENTS_PAGE        = "src/app/profile/agents/page.tsx";
const MESSAGES_PAGE      = "src/app/profile/messages/page.tsx";
const ONBOARDING_PAGE    = "src/app/profile/onboarding/page.tsx";
const TECHNOLOGIES_PAGE  = "src/app/profile/technologies/page.tsx";
const PIERRE_PAGE        = "src/app/agents/pierre/use/page.tsx";
const PIERRE_SETUP_PAGE  = "src/app/agents/pierre/setup/page.tsx";
const COCKPIT_SHELL      = "src/app/agents/pierre/use/components/PierreCockpitShell.tsx";

const doc29      = readFile(DOC_2_9);
const doc29Lower = doc29.toLowerCase();
const agentsPage       = readFile(AGENTS_PAGE);
const messagesPage     = readFile(MESSAGES_PAGE);
const onboardingPage   = readFile(ONBOARDING_PAGE);
const pierrePage       = readFile(PIERRE_PAGE);

// ── T01-T19 : Documentation PHASE 2.9 ────────────────────────────────────────

describe("T01 — Documentation PHASE 2.9 existe et est complète", () => {
  it("T01 — doc PHASE_2_9 existe", () => {
    expect(fileExists(DOC_2_9)).toBe(true);
  });

  it("T02 — doc mentionne PHASE 2.1", () => {
    expect(doc29).toContain("PHASE 2.1");
  });

  it("T03 — doc mentionne PHASE 2.2", () => {
    expect(doc29).toContain("PHASE 2.2");
  });

  it("T04 — doc mentionne PHASE 2.3", () => {
    expect(doc29).toContain("PHASE 2.3");
  });

  it("T05 — doc mentionne PHASE 2.4", () => {
    expect(doc29).toContain("PHASE 2.4");
  });

  it("T06 — doc mentionne PHASE 2.5", () => {
    expect(doc29).toContain("PHASE 2.5");
  });

  it("T07 — doc mentionne PHASE 2.6", () => {
    expect(doc29).toContain("PHASE 2.6");
  });

  it("T08 — doc mentionne PHASE 2.7", () => {
    expect(doc29).toContain("PHASE 2.7");
  });

  it("T09 — doc mentionne PHASE 2.8", () => {
    expect(doc29).toContain("PHASE 2.8");
  });

  it("T10 — doc mentionne public launch NO-GO externe", () => {
    const hasNoGo =
      doc29Lower.includes("no-go externe") ||
      doc29Lower.includes("no-go external") ||
      (doc29Lower.includes("public launch") && doc29Lower.includes("no-go"));
    expect(hasNoGo).toBe(true);
  });

  it("T11 — doc mentionne Pierre seul employé IA actif V1", () => {
    const hasConstraint =
      doc29Lower.includes("pierre est le seul") ||
      doc29Lower.includes("seul employé ia actif") ||
      doc29Lower.includes("pierre seul actif");
    expect(hasConstraint).toBe(true);
  });

  it("T12 — doc mentionne CloneOS plan-only", () => {
    const hasPlanOnly =
      doc29Lower.includes("plan-only") ||
      doc29Lower.includes("cloneos plan");
    expect(hasPlanOnly).toBe(true);
  });

  it("T13 — doc mentionne Messages read-only", () => {
    const hasReadOnly =
      doc29Lower.includes("messages read-only") ||
      doc29Lower.includes("lecture seule") ||
      doc29Lower.includes("read-only");
    expect(hasReadOnly).toBe(true);
  });

  it("T14 — doc mentionne Onboarding local/non persisté", () => {
    const hasLocal =
      doc29Lower.includes("non persisté") ||
      doc29Lower.includes("onboarding local") ||
      doc29Lower.includes("local state");
    expect(hasLocal).toBe(true);
  });

  it("T15 — doc mentionne moteur Pierre intact", () => {
    const hasMoteur =
      doc29Lower.includes("moteur pierre intact") ||
      doc29Lower.includes("moteur pierre non modifié") ||
      (doc29Lower.includes("moteur") && doc29Lower.includes("intact"));
    expect(hasMoteur).toBe(true);
  });

  it("T16 — doc mentionne CloneVoice non-production", () => {
    const hasVoice =
      doc29Lower.includes("clonevoice non-production") ||
      doc29Lower.includes("clonevoice") && doc29Lower.includes("non actif") ||
      doc29Lower.includes("clonevoice") && doc29Lower.includes("préparation");
    expect(hasVoice).toBe(true);
  });

  it("T17 — doc mentionne 360px", () => {
    expect(doc29).toContain("360px");
  });

  it("T18 — doc mentionne 768px", () => {
    expect(doc29).toContain("768px");
  });

  it("T19 — doc mentionne 1440px", () => {
    expect(doc29).toContain("1440px");
  });
});

// ── T20-T26 : Routes et composants existent ───────────────────────────────────

describe("T20 — Pages et composants existent", () => {
  it("T20 — /profile/agents existe", () => {
    expect(fileExists(AGENTS_PAGE)).toBe(true);
  });

  it("T21 — /profile/messages existe", () => {
    expect(fileExists(MESSAGES_PAGE)).toBe(true);
  });

  it("T22 — /profile/onboarding existe", () => {
    expect(fileExists(ONBOARDING_PAGE)).toBe(true);
  });

  it("T23 — /profile/technologies existe", () => {
    expect(fileExists(TECHNOLOGIES_PAGE)).toBe(true);
  });

  it("T24 — /agents/pierre/use existe", () => {
    expect(fileExists(PIERRE_PAGE)).toBe(true);
  });

  it("T25 — /agents/pierre/setup existe", () => {
    expect(fileExists(PIERRE_SETUP_PAGE)).toBe(true);
  });

  it("T26 — PierreCockpitShell existe", () => {
    expect(fileExists(COCKPIT_SHELL)).toBe(true);
  });
});

// ── T27-T34 : Docs PHASE 2 existent ──────────────────────────────────────────

describe("T27 — Docs PHASE 2 existent", () => {
  it("T27 — PHASE_2_1 doc existe", () => {
    expect(fileExists(DOC_2_1)).toBe(true);
  });

  it("T28 — PHASE_2_2 doc existe", () => {
    expect(fileExists(DOC_2_2)).toBe(true);
  });

  it("T29 — PHASE_2_3 doc existe", () => {
    expect(fileExists(DOC_2_3)).toBe(true);
  });

  it("T30 — PHASE_2_4 doc existe", () => {
    expect(fileExists(DOC_2_4)).toBe(true);
  });

  it("T31 — PHASE_2_5 doc existe", () => {
    expect(fileExists(DOC_2_5)).toBe(true);
  });

  it("T32 — PHASE_2_6 doc existe", () => {
    expect(fileExists(DOC_2_6)).toBe(true);
  });

  it("T33 — PHASE_2_7 doc existe", () => {
    expect(fileExists(DOC_2_7)).toBe(true);
  });

  it("T34 — PHASE_2_8 doc existe", () => {
    expect(fileExists(DOC_2_8)).toBe(true);
  });
});

// ── T35-T44 : Contenu clé des pages ──────────────────────────────────────────

describe("T35 — Contenu clé des pages PHASE 2", () => {
  it("T35 — /profile/agents mentionne Pierre", () => {
    expect(agentsPage.toLowerCase()).toContain("pierre");
  });

  it("T36 — /profile/agents contient lien /agents/pierre/use", () => {
    expect(agentsPage).toContain("/agents/pierre/use");
  });

  it("T37 — /profile/agents contient lien /profile/onboarding", () => {
    expect(agentsPage).toContain("/profile/onboarding");
  });

  it("T38 — /profile/messages contient Suivis", () => {
    expect(messagesPage).toContain("suivis");
  });

  it("T39 — /profile/messages contient Briefings", () => {
    expect(messagesPage.toLowerCase()).toContain("briefings");
  });

  it("T40 — /profile/messages contient Livraisons", () => {
    expect(messagesPage.toLowerCase()).toContain("livraisons");
  });

  it("T41 — /profile/messages contient Alertes", () => {
    expect(messagesPage.toLowerCase()).toContain("alertes");
  });

  it("T42 — /profile/onboarding contient CloneADN", () => {
    expect(onboardingPage.toLowerCase()).toContain("cloneadn");
  });

  it("T43 — /agents/pierre/use contient CloneStore", () => {
    expect(pierrePage.toLowerCase()).toContain("clonestore");
  });

  it("T44 — /agents/pierre/use contient lien /profile/agents", () => {
    expect(pierrePage).toContain("/profile/agents");
  });
});

// ── T45-T55 : Invariants — contenus interdits absents ────────────────────────

describe("T45 — Invariants : contenus interdits absents dans les pages PHASE 2", () => {
  const allSources = [
    agentsPage, messagesPage, onboardingPage, pierrePage,
    readFile(TECHNOLOGIES_PAGE), readFile(COCKPIT_SHELL),
  ].join("\n");
  const allLower = allSources.toLowerCase();

  it("T45 — aucun fichier PHASE 2 ne dit 'public launch GO'", () => {
    expect(allLower.includes("public launch go")).toBe(false);
  });

  it("T46 — aucun fichier PHASE 2 ne dit 'zéro erreur'", () => {
    const noZero = !allLower.includes("zéro erreur") && !allLower.includes("zero erreur");
    expect(noZero).toBe(true);
  });

  it("T47 — aucun fichier PHASE 2 ne dit 'conformité garantie'", () => {
    expect(allLower.includes("conformité garantie")).toBe(false);
  });

  it("T48 — aucun fichier PHASE 2 ne présente CloneVoice comme actif production", () => {
    const noVoiceActive =
      !allSources.includes("CloneVoice actif production") &&
      !allSources.includes("clonevoice actif production");
    expect(noVoiceActive).toBe(true);
  });

  it("T49 — aucun fichier PHASE 2 ne présente Emma active (active: true)", () => {
    // ROADMAP_EMPLOYEES contient emma mais ne l'active jamais — stage: "soon"
    const noEmmaActive =
      !agentsPage.includes('"emma"') || // si présent, ne doit pas être active: true
      !agentsPage.includes("emma.*active.*true");
    // La page agents contient emma comme roadmap — jamais active: true
    const emmaSection = agentsPage.toLowerCase();
    const emmaIdx = emmaSection.indexOf('"emma"');
    if (emmaIdx >= 0) {
      // Vérifier qu'il n'y a pas "active: true" proche de "emma"
      const nearContext = emmaSection.slice(emmaIdx, emmaIdx + 200);
      expect(nearContext.includes("active: true")).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  it("T50 — aucun fichier PHASE 2 ne présente Lucas actif (active: true)", () => {
    const lucasSection = agentsPage.toLowerCase();
    const lucasIdx = lucasSection.indexOf('"lucas"');
    if (lucasIdx >= 0) {
      const nearContext = lucasSection.slice(lucasIdx, lucasIdx + 200);
      expect(nearContext.includes("active: true")).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  it("T51 — aucun fichier PHASE 2 ne présente Sophie active (active: true)", () => {
    const sophieSection = agentsPage.toLowerCase();
    const sophieIdx = sophieSection.indexOf('"sophie"');
    if (sophieIdx >= 0) {
      const nearContext = sophieSection.slice(sophieIdx, sophieIdx + 200);
      expect(nearContext.includes("active: true")).toBe(false);
    } else {
      expect(true).toBe(true);
    }
  });

  it("T52 — aucun fichier PHASE 2 ne contient Supabase insert() direct", () => {
    const noInsert =
      !agentsPage.includes(".insert(") &&
      !messagesPage.includes(".insert(") &&
      !onboardingPage.includes(".insert(");
    expect(noInsert).toBe(true);
  });

  it("T53 — aucun fichier PHASE 2 ne contient appel OpenAI direct", () => {
    const noOpenAI =
      !allSources.includes("openai") &&
      !allSources.includes("gpt-4") &&
      !allSources.includes("gpt-3.5");
    expect(noOpenAI).toBe(true);
  });

  it("T54 — aucun fichier PHASE 2 ne contient appel Anthropic direct", () => {
    const noAnthropic =
      !allSources.includes("anthropic") &&
      !allSources.includes("claude-3") &&
      !allSources.includes("claude-opus");
    expect(noAnthropic).toBe(true);
  });

  it("T55 — aucun fichier PHASE 2 ne contient clé Stripe live", () => {
    const noStripeLive =
      !allSources.includes("sk_live_") &&
      !allSources.includes("stripe.charges.create") &&
      !allSources.includes("stripe.subscriptions.create");
    expect(noStripeLive).toBe(true);
  });
});

// ── T56-T65 : Phases précédentes intactes ─────────────────────────────────────

describe("T56 — Phases précédentes intactes", () => {
  it("T56 — PHASE 2.8 test file existe et pages modifiées intactes", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-8-responsive-premium-polish.test.ts");
    // Vérifie que la correction xl:grid-cols-2 est bien en place
    const messagesGridFixed = messagesPage.includes("xl:grid-cols-2") &&
      !messagesPage.includes("minmax(420px,1.05fr)");
    // Vérifie que le kanban a les breakpoints sm: et lg:
    const agentsKanbanFixed = agentsPage.includes("sm:grid-cols-2") && agentsPage.includes("lg:grid-cols-3");
    expect(testExists && messagesGridFixed && agentsKanbanFixed).toBe(true);
  });

  it("T57 — PHASE 2.7 test file existe et page Pierre intacte", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-7-pierre-global-integration.test.ts");
    const pierreOk = pierrePage.includes("PIERRE_GLOBAL_LINKS") && pierrePage.includes("/profile/agents");
    expect(testExists && pierreOk).toBe(true);
  });

  it("T58 — PHASE 2.6 test file existe et onboarding intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-6-global-onboarding-enterprise.test.ts");
    const onboardingOk = onboardingPage.includes("GlobalOnboardingState") &&
      onboardingPage.includes("PIERRE_EMPLOYEE_RUNTIME_CONTRACT");
    expect(testExists && onboardingOk).toBe(true);
  });

  it("T59 — PHASE 2.5 test file existe et messages 4 onglets intacts", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-5-messages-center-4-tabs.test.ts");
    const messagesOk = messagesPage.includes("MessageCenterTab") && messagesPage.includes("CATEGORIES");
    expect(testExists && messagesOk).toBe(true);
  });

  it("T60 — PHASE 2.4 test file existe et LastRequestPanel intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-4-last-request-panel.test.ts");
    const lastRequestOk = agentsPage.includes("LastRequestPanel") &&
      agentsPage.includes("CloneOSCommandTimeline");
    expect(testExists && lastRequestOk).toBe(true);
  });

  it("T61 — PHASE 2.3 test file existe et command bar intacte", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-3-cloneos-command-bar.test.ts");
    const commandBarOk = agentsPage.includes("processCloneOSCommand") &&
      agentsPage.includes("submitCommand");
    expect(testExists && commandBarOk).toBe(true);
  });

  it("T62 — PHASE 2.2 test file existe et cockpit shell intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-2-global-cockpit-shell.test.ts");
    const shellOk = agentsPage.includes("EMPLOYEE_RUNTIME_REGISTRY") &&
      agentsPage.includes("RailButton");
    expect(testExists && shellOk).toBe(true);
  });

  it("T63 — PHASE 2.1 test file existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-1-global-cockpit-audit.test.ts")).toBe(true);
  });

  it("T64 — TECH-11 test file existe", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });

  it("T65 — pfinal02 test files clés existent", () => {
    const goLiveProofs = fileExists("src/lib/go-live/proofs/__tests__/go-live-proofs.test.ts");
    const phase28 = fileExists("src/app/profile/__tests__/phase-2-8-responsive-premium-polish.test.ts");
    expect(goLiveProofs && phase28).toBe(true);
  });
});
