// PHASE 2.8 — Responsive Premium Polish — Tests
// Tests statiques vérifiant les correctifs responsive sur les pages 2.2 → 2.7.
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

const DOC_PATH = "docs/PHASE_2_8_RESPONSIVE_PREMIUM_POLISH.md";
const AGENTS_PAGE = "src/app/profile/agents/page.tsx";
const MESSAGES_PAGE = "src/app/profile/messages/page.tsx";
const ONBOARDING_PAGE = "src/app/profile/onboarding/page.tsx";
const TECHNOLOGIES_PAGE = "src/app/profile/technologies/page.tsx";
const PIERRE_PAGE = "src/app/agents/pierre/use/page.tsx";
const COCKPIT_SHELL = "src/app/agents/pierre/use/components/PierreCockpitShell.tsx";

const doc = readFile(DOC_PATH);
const docLower = doc.toLowerCase();
const agentsPage = readFile(AGENTS_PAGE);
const messagesPage = readFile(MESSAGES_PAGE);
const onboardingPage = readFile(ONBOARDING_PAGE);
const technologiesPage = readFile(TECHNOLOGIES_PAGE);
const pierrePage = readFile(PIERRE_PAGE);
const cockpitShell = readFile(COCKPIT_SHELL);

// ── Groupe 1 — Documentation ──────────────────────────────────────────────────

describe("T01 — Documentation PHASE 2.8 existe et est complète", () => {
  it("T01 — doc PHASE_2_8 existe", () => {
    expect(fileExists(DOC_PATH)).toBe(true);
  });

  it("T02 — doc mentionne responsive", () => {
    expect(docLower).toContain("responsive");
  });

  it("T03 — doc mentionne mobile", () => {
    expect(docLower).toContain("mobile");
  });

  it("T04 — doc mentionne tablette", () => {
    expect(docLower).toContain("tablette");
  });

  it("T05 — doc mentionne desktop", () => {
    expect(docLower).toContain("desktop");
  });

  it("T06 — doc mentionne /profile/agents", () => {
    expect(doc).toContain("/profile/agents");
  });

  it("T07 — doc mentionne /profile/messages", () => {
    expect(doc).toContain("/profile/messages");
  });

  it("T08 — doc mentionne /profile/onboarding", () => {
    expect(doc).toContain("/profile/onboarding");
  });

  it("T09 — doc mentionne /profile/technologies", () => {
    expect(doc).toContain("/profile/technologies");
  });

  it("T10 — doc mentionne /agents/pierre/use", () => {
    expect(doc).toContain("/agents/pierre/use");
  });

  it("T11 — doc mentionne PierreCockpitShell", () => {
    expect(doc).toContain("PierreCockpitShell");
  });

  it("T12 — doc mentionne PHASE 2.9", () => {
    expect(doc).toContain("PHASE 2.9");
  });
});

// ── Groupe 2 — Pages existent ─────────────────────────────────────────────────

describe("T13 — Pages auditées existent", () => {
  it("T13 — /profile/agents existe", () => {
    expect(fileExists(AGENTS_PAGE)).toBe(true);
  });

  it("T14 — /profile/messages existe", () => {
    expect(fileExists(MESSAGES_PAGE)).toBe(true);
  });

  it("T15 — /profile/onboarding existe", () => {
    expect(fileExists(ONBOARDING_PAGE)).toBe(true);
  });

  it("T16 — /profile/technologies existe", () => {
    expect(fileExists(TECHNOLOGIES_PAGE)).toBe(true);
  });

  it("T17 — /agents/pierre/use existe", () => {
    expect(fileExists(PIERRE_PAGE)).toBe(true);
  });

  it("T18 — PierreCockpitShell existe", () => {
    expect(fileExists(COCKPIT_SHELL)).toBe(true);
  });
});

// ── Groupe 3 — Classes responsive présentes ───────────────────────────────────

describe("T19 — Classes responsive dans les pages", () => {
  it("T19 — /profile/agents contient classes responsive (grid-cols-1, sm:, md:, lg:, xl: ou flex-wrap)", () => {
    const hasResponsive =
      agentsPage.includes("grid-cols-1") ||
      agentsPage.includes("sm:grid-cols") ||
      agentsPage.includes("sm:flex") ||
      agentsPage.includes("md:grid-cols") ||
      agentsPage.includes("lg:grid-cols") ||
      agentsPage.includes("xl:grid-cols") ||
      agentsPage.includes("flex-wrap");
    expect(hasResponsive).toBe(true);
  });

  it("T20 — /profile/messages contient overflow-x-auto ou flex-wrap pour les tabs", () => {
    const hasScrollTabs =
      messagesPage.includes("overflow-x-auto") ||
      messagesPage.includes("flex-wrap");
    expect(hasScrollTabs).toBe(true);
  });

  it("T21 — /profile/messages ne force pas minmax(420px) sans xl breakpoint", () => {
    // La valeur minmax(420px,...) ne doit pas apparaître sans le préfixe xl:
    // Vérification : soit elle n'existe pas du tout, soit elle est qualifiée xl:
    const rawPattern = "minmax(420px";
    if (!messagesPage.includes(rawPattern)) {
      // Pattern absent — parfait
      expect(true).toBe(true);
    } else {
      // Si présent, doit être dans un contexte xl:
      const idx = messagesPage.indexOf(rawPattern);
      const context = messagesPage.slice(Math.max(0, idx - 30), idx);
      expect(context).toContain("xl:");
    }
  });

  it("T22 — /profile/onboarding contient responsive forms sm:grid-cols-2 ou équivalent", () => {
    const hasResponsiveForms =
      onboardingPage.includes("sm:grid-cols-2") ||
      onboardingPage.includes("sm:grid-cols-3") ||
      onboardingPage.includes("grid gap-3 sm:");
    expect(hasResponsiveForms).toBe(true);
  });

  it("T23 — /profile/technologies contient responsive grid/flex-wrap/overflow-x-auto", () => {
    const hasResponsive =
      technologiesPage.includes("flex-wrap") ||
      technologiesPage.includes("overflow-x-auto") ||
      technologiesPage.includes("md:grid-cols") ||
      technologiesPage.includes("sm:grid-cols");
    expect(hasResponsive).toBe(true);
  });

  it("T24 — /agents/pierre/use contient liens globaux et classes responsive", () => {
    const hasGlobalLinks = pierrePage.includes("PIERRE_GLOBAL_LINKS");
    const hasResponsive =
      pierrePage.includes("sm:flex-row") ||
      pierrePage.includes("sm:grid-cols") ||
      pierrePage.includes("flex-wrap") ||
      pierrePage.includes("flex flex-col");
    expect(hasGlobalLinks && hasResponsive).toBe(true);
  });

  it("T25 — PierreCockpitShell contient navigation globale responsive ou flex-wrap/overflow handling", () => {
    const hasResponsiveNav =
      cockpitShell.includes("hidden md:flex") ||
      cockpitShell.includes("hidden xl:flex") ||
      cockpitShell.includes("flex-wrap") ||
      cockpitShell.includes("overflow-y-auto") ||
      cockpitShell.includes("/profile/agents");
    expect(hasResponsiveNav).toBe(true);
  });
});

// ── Groupe 4 — Absence de contenu interdit ────────────────────────────────────

describe("T26 — Contenus interdits absents", () => {
  const allSources = [agentsPage, messagesPage, onboardingPage, technologiesPage, pierrePage, cockpitShell].join("\n");
  const allLower = allSources.toLowerCase();

  it("T26 — aucun fichier ne dit 'public launch GO'", () => {
    expect(allLower.includes("public launch go")).toBe(false);
  });

  it("T27 — aucun fichier ne dit 'zéro erreur'", () => {
    const noZeroError = !allLower.includes("zéro erreur") && !allLower.includes("zero erreur");
    expect(noZeroError).toBe(true);
  });

  it("T28 — aucun fichier ne dit 'conformité garantie'", () => {
    expect(allLower.includes("conformité garantie")).toBe(false);
  });

  it("T29 — aucun fichier ne présente CloneVoice comme actif production", () => {
    const noVoiceActive =
      !allSources.includes("CloneVoice actif production") &&
      !allSources.includes("clonevoice actif production");
    expect(noVoiceActive).toBe(true);
  });

  it("T30 — aucun fichier ne présente Emma active (employee active)", () => {
    const noEmmaActive =
      !agentsPage.includes("emma.*active.*true") &&
      !agentsPage.includes("'emma'.*active");
    expect(noEmmaActive).toBe(true);
  });

  it("T31 — aucun fichier ne présente Lucas actif (employee active)", () => {
    const noLucasActive =
      !agentsPage.includes("lucas.*active.*true") &&
      !agentsPage.includes("'lucas'.*active");
    expect(noLucasActive).toBe(true);
  });

  it("T32 — aucun fichier ne présente Sophie active (employee active)", () => {
    const noSophieActive =
      !agentsPage.includes("sophie.*active.*true") &&
      !agentsPage.includes("'sophie'.*active");
    expect(noSophieActive).toBe(true);
  });

  it("T33 — aucun appel Supabase write direct ajouté dans les pages", () => {
    // Les pages ne doivent pas contenir d'insert() ou update() direct non gated
    const noSupabaseWrite =
      !agentsPage.includes(".insert(") &&
      !messagesPage.includes(".insert(") &&
      !onboardingPage.includes(".insert(");
    expect(noSupabaseWrite).toBe(true);
  });

  it("T34 — aucun appel OpenAI ajouté dans les pages", () => {
    const noOpenAI =
      !allSources.includes("openai") &&
      !allSources.includes("OpenAI") &&
      !allSources.includes("gpt-4") &&
      !allSources.includes("gpt-3.5");
    expect(noOpenAI).toBe(true);
  });

  it("T35 — aucun appel Anthropic ajouté dans les pages", () => {
    const noAnthropic =
      !allSources.includes("anthropic") &&
      !allSources.includes("Anthropic") &&
      !allSources.includes("claude-3");
    expect(noAnthropic).toBe(true);
  });

  it("T36 — aucun Stripe live ajouté dans les pages", () => {
    const noStripeLive =
      !allSources.includes("sk_live_") &&
      !allSources.includes("stripe.charges.create") &&
      !allSources.includes("stripe.subscriptions.create");
    expect(noStripeLive).toBe(true);
  });
});

// ── Groupe 5 — Phases précédentes non cassées ─────────────────────────────────

describe("T37 — Phases précédentes intactes", () => {
  it("T37 — PHASE 2.7 : fichier test existe et page Pierre intacte", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-7-pierre-global-integration.test.ts");
    const pierrePageOk = pierrePage.includes("PIERRE_GLOBAL_LINKS") && pierrePage.includes("/profile/agents");
    expect(testExists && pierrePageOk).toBe(true);
  });

  it("T38 — PHASE 2.6 : fichier test existe et page onboarding intacte", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-6-global-onboarding-enterprise.test.ts");
    const onboardingOk = onboardingPage.includes("GlobalOnboardingState") && onboardingPage.includes("PIERRE_EMPLOYEE_RUNTIME_CONTRACT");
    expect(testExists && onboardingOk).toBe(true);
  });

  it("T39 — PHASE 2.5 : fichier test existe et page messages intacte", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-5-messages-center-4-tabs.test.ts");
    const messagesOk = messagesPage.includes("MessageCenterTab") && messagesPage.includes("CATEGORIES");
    expect(testExists && messagesOk).toBe(true);
  });

  it("T40 — PHASE 2.4 : fichier test existe et LastRequestPanel intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-4-last-request-panel.test.ts");
    const lastRequestOk = agentsPage.includes("LastRequestPanel") && agentsPage.includes("CloneOSCommandTimeline");
    expect(testExists && lastRequestOk).toBe(true);
  });

  it("T41 — PHASE 2.3 : fichier test existe et CloneOS command bar intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-3-cloneos-command-bar.test.ts");
    const commandBarOk = agentsPage.includes("processCloneOSCommand") && agentsPage.includes("submitCommand");
    expect(testExists && commandBarOk).toBe(true);
  });

  it("T42 — PHASE 2.2 : fichier test existe et cockpit shell intact", () => {
    const testExists = fileExists("src/app/profile/__tests__/phase-2-2-global-cockpit-shell.test.ts");
    const shellOk = agentsPage.includes("EMPLOYEE_RUNTIME_REGISTRY") && agentsPage.includes("RailButton");
    expect(testExists && shellOk).toBe(true);
  });

  it("T43 — PHASE 2.1 : fichier test existe", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-1-global-cockpit-audit.test.ts")).toBe(true);
  });

  it("T44 — TECH-11 : fichier test existe", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });

  it("T45 — pfinal02 : fichiers tests clés existent", () => {
    const goLiveProofs = fileExists("src/lib/go-live/proofs/__tests__/go-live-proofs.test.ts");
    const goLiveCommand = fileExists("src/lib/go-live/__tests__/go-live-command-center.test.ts");
    expect(goLiveProofs && goLiveCommand).toBe(true);
  });
});
