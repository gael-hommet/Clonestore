// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-cockpit-integration-phase3-9.test.ts
// PHASE 3.9 — Empreinte Entreprise Cockpit Integration — Tests de validation
//
// 51 tests couvrant :
//   - Existence des fichiers cockpit
//   - Cockpit bridge comportement
//   - Intégration /profile/agents
//   - Pierre handoff design
//   - QA module cockpit
//   - Documentation
//   - Régression

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// __dirname = .../clonestore/src/lib/clonestore/enterprise-footprint/__tests__
// 5 niveaux → .../clonestore (racine du projet)
const root = resolve(__dirname, "../../../../../");

function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), "utf-8");
}
function fileExists(rel: string): boolean {
  return existsSync(resolve(root, rel));
}

const efDir = "src/lib/clonestore/enterprise-footprint";
const cockpitFile = `${efDir}/enterprise-footprint-cockpit.ts`;
const handoffFile = `${efDir}/enterprise-footprint-pierre-handoff.ts`;
const cockpitQaFile = `${efDir}/enterprise-footprint-cockpit-qa.ts`;
const indexFile = `${efDir}/index.ts`;
const agentsPage = "src/app/profile/agents/page.tsx";
const docFile = "docs/PHASE_3_9_EMPREINTE_ENTREPRISE_COCKPIT_INTEGRATION.md";
const pkgFile = "package.json";

// ── GROUPE 1 — Existence fichiers (T01–T03) ────────────────────────────────────

describe("PHASE 3.9 — Fichiers cockpit (T01–T03)", () => {
  it("T01 — enterprise-footprint-cockpit.ts existe", () => {
    expect(fileExists(cockpitFile)).toBe(true);
  });
  it("T02 — enterprise-footprint-pierre-handoff.ts existe", () => {
    expect(fileExists(handoffFile)).toBe(true);
  });
  it("T03 — enterprise-footprint-cockpit-qa.ts existe", () => {
    expect(fileExists(cockpitQaFile)).toBe(true);
  });
});

// ── GROUPE 2 — Cockpit bridge comportement (T04–T12) ──────────────────────────

describe("PHASE 3.9 — Cockpit bridge (T04–T12)", () => {
  it("T04 — cockpit bridge contient loadEnterpriseFootprintForCockpit", () => {
    expect(readSrc(cockpitFile)).toContain("loadEnterpriseFootprintForCockpit");
  });
  it("T05 — cockpit bridge contient buildEnterpriseFootprintCockpitSummary", () => {
    expect(readSrc(cockpitFile)).toContain("buildEnterpriseFootprintCockpitSummary");
  });
  it("T06 — cockpit bridge contient buildEnterpriseFootprintCockpitCards", () => {
    expect(readSrc(cockpitFile)).toContain("buildEnterpriseFootprintCockpitCards");
  });
  it("T07 — cockpit bridge contient buildEnterpriseFootprintCockpitActions", () => {
    expect(readSrc(cockpitFile)).toContain("buildEnterpriseFootprintCockpitActions");
  });
  it("T08 — cockpit bridge utilise loadEnterpriseFootprintFromLocalStorage", () => {
    expect(readSrc(cockpitFile)).toContain("loadEnterpriseFootprintFromLocalStorage");
  });
  it("T09 — cockpit bridge utilise loadGlobalOnboardingDraftFromLocalStorage", () => {
    expect(readSrc(cockpitFile)).toContain("loadGlobalOnboardingDraftFromLocalStorage");
  });
  it("T10 — cockpit bridge utilise mapGlobalOnboardingDraftToEnterpriseFootprint", () => {
    expect(readSrc(cockpitFile)).toContain("mapGlobalOnboardingDraftToEnterpriseFootprint");
  });
  it("T11 — cockpit bridge ne contient pas import Supabase", () => {
    const content = readSrc(cockpitFile);
    expect(content).not.toContain("import { createClient");
    expect(content).not.toContain("from \"@supabase/supabase-js\"");
    expect(content).not.toContain("from '@supabase/supabase-js'");
  });
  it("T12 — cockpit bridge ne contient pas insert/update/delete/upsert", () => {
    const content = readSrc(cockpitFile);
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
    expect(content).not.toContain(".delete(");
    expect(content).not.toContain(".upsert(");
  });
});

// ── GROUPE 3 — Intégration /profile/agents (T13–T22) ─────────────────────────

describe("PHASE 3.9 — Intégration /profile/agents (T13–T22)", () => {
  it("T13 — /profile/agents mentionne Empreinte Entreprise", () => {
    expect(readSrc(agentsPage)).toContain("Empreinte Entreprise");
  });
  it("T14 — /profile/agents mentionne Lecture seule", () => {
    const content = readSrc(agentsPage);
    expect(content).toContain("Lecture seule");
  });
  it("T15 — /profile/agents mentionne Aucune action exécutée", () => {
    const content = readSrc(agentsPage);
    expect(content).toContain("Aucune action exécutée");
  });
  it("T16 — /profile/agents contient /profile/onboarding", () => {
    expect(readSrc(agentsPage)).toContain("/profile/onboarding");
  });
  it("T17 — /profile/agents contient /profile/technologies", () => {
    expect(readSrc(agentsPage)).toContain("/profile/technologies");
  });
  it("T18 — /profile/agents contient /profile/messages", () => {
    expect(readSrc(agentsPage)).toContain("/profile/messages");
  });
  it("T19 — /profile/agents contient /agents/pierre/setup", () => {
    expect(readSrc(agentsPage)).toContain("/agents/pierre/setup");
  });
  it("T20 — /profile/agents utilise enterprise footprint cockpit", () => {
    const content = readSrc(agentsPage);
    const hasFootprint =
      content.includes("loadEnterpriseFootprintForCockpit") ||
      content.includes("enterprise-footprint") ||
      content.includes("footprintSummary");
    expect(hasFootprint).toBe(true);
  });
  it("T21 — /profile/agents ne contient pas insert/upsert direct", () => {
    // Vérification que l'empreinte ne déclenche pas de write direct
    // (le supabase existant pour les orders est OK)
    const content = readSrc(agentsPage);
    // La page peut avoir .from().insert() pour orders, mais pas pour enterprise footprint
    // On vérifie qu'elle n'appelle pas persistEnterpriseFootprintSafely
    expect(content).not.toContain("persistEnterpriseFootprintSafely");
  });
  it("T22 — /profile/agents n'importe pas Supabase dédié pour footprint", () => {
    const content = readSrc(agentsPage);
    // Le cockpit bridge est localStorage-only — pas de nouveau import Supabase pour footprint
    expect(content).not.toContain("loadEnterpriseFootprintSafely");
    expect(content).not.toContain("clonestore_enterprise_footprints");
  });
});

// ── GROUPE 4 — Pierre handoff design (T23–T26) ────────────────────────────────

describe("PHASE 3.9 — Pierre handoff (T23–T26)", () => {
  it("T23 — handoff contient buildPierreEnterpriseFootprintContext", () => {
    expect(readSrc(handoffFile)).toContain("buildPierreEnterpriseFootprintContext");
  });
  it("T24 — handoff contient validatePierreEnterpriseFootprintContext", () => {
    expect(readSrc(handoffFile)).toContain("validatePierreEnterpriseFootprintContext");
  });
  it("T25 — handoff n'importe pas src/lib/pierre (les mentions en commentaires sont OK)", () => {
    const content = readSrc(handoffFile);
    // Vérifier qu'aucun import réel vers pierre n'existe
    // (les commentaires mentionnant "Ne pas importer src/lib/pierre" sont OK)
    expect(content).not.toContain("from \"@/lib/pierre");
    expect(content).not.toContain("from '@/lib/pierre");
    expect(content).not.toMatch(/^import.*from.*pierre/m);
  });
  it("T26 — handoff ne modifie pas Pierre moteur (pas d'import pierre API)", () => {
    const content = readSrc(handoffFile);
    expect(content).not.toContain("src/app/api/pierre");
    expect(content).not.toContain("processCloneOSCommand");
    expect(content).not.toContain("executeTask");
  });
});

// ── GROUPE 5 — QA module cockpit (T27–T31) ────────────────────────────────────

describe("PHASE 3.9 — QA module cockpit (T27–T31)", () => {
  it("T27 — cockpit QA module contient buildEnterpriseFootprintCockpitQaChecklist", () => {
    expect(readSrc(cockpitQaFile)).toContain("buildEnterpriseFootprintCockpitQaChecklist");
  });
  it("T28 — cockpit QA module contient no_db_write", () => {
    expect(readSrc(cockpitQaFile)).toContain("no_db_write");
  });
  it("T29 — cockpit QA module contient no_pierre_engine_change", () => {
    expect(readSrc(cockpitQaFile)).toContain("no_pierre_engine_change");
  });
  it("T30 — cockpit QA module ne contient pas Supabase createClient", () => {
    const content = readSrc(cockpitQaFile);
    expect(content).not.toContain("import { createClient");
    expect(content).not.toContain("from \"@supabase/supabase-js\"");
  });
  it("T31 — cockpit QA module ne contient pas insert/update/delete/upsert", () => {
    const content = readSrc(cockpitQaFile);
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
    expect(content).not.toContain(".delete(");
    expect(content).not.toContain(".upsert(");
  });
});

// ── GROUPE 6 — Documentation (T32–T40) ───────────────────────────────────────

describe("PHASE 3.9 — Documentation (T32–T40)", () => {
  it("T32 — doc PHASE_3_9 existe", () => {
    expect(fileExists(docFile)).toBe(true);
  });
  it("T33 — doc mentionne /profile/agents", () => {
    expect(readSrc(docFile)).toContain("/profile/agents");
  });
  it("T34 — doc mentionne Empreinte Entreprise", () => {
    expect(readSrc(docFile).toLowerCase()).toContain("empreinte entreprise");
  });
  it("T35 — doc mentionne read-only ou lecture seule", () => {
    const content = readSrc(docFile).toLowerCase();
    expect(content.includes("read-only") || content.includes("lecture seule")).toBe(true);
  });
  it("T36 — doc mentionne Pierre handoff", () => {
    const content = readSrc(docFile).toLowerCase();
    expect(content.includes("pierre handoff") || content.includes("handoff")).toBe(true);
  });
  it("T37 — doc mentionne PHASE 3.10", () => {
    expect(readSrc(docFile)).toContain("PHASE 3.10");
  });
  it("T38 — doc ne contient pas la phrase exacte 'public launch go'", () => {
    expect(readSrc(docFile).toLowerCase()).not.toContain("public launch go");
  });
  it("T39 — doc ne contient pas 'zéro erreur'", () => {
    expect(readSrc(docFile).toLowerCase()).not.toMatch(/zéro\s+erreur/);
    expect(readSrc(docFile).toLowerCase()).not.toMatch(/zero\s+erreur/);
  });
  it("T40 — doc ne contient pas 'conformité garantie'", () => {
    expect(readSrc(docFile).toLowerCase()).not.toContain("conformité garantie");
  });
});

// ── GROUPE 7 — Package.json (T41) ─────────────────────────────────────────────

describe("PHASE 3.9 — Package.json (T41)", () => {
  it("T41 — package.json contient test:phase3-9", () => {
    expect(readSrc(pkgFile)).toContain("test:phase3-9");
  });
});

// ── GROUPE 8 — Régression (T42–T51) ──────────────────────────────────────────

describe("PHASE 3.9 — Régression PHASE 3.8 → 3.1 (T42–T51)", () => {
  it("T42 — PHASE 3.8 : enterprise-footprint-types.ts existe", () => {
    expect(fileExists(`${efDir}/enterprise-footprint-types.ts`)).toBe(true);
  });
  it("T43 — PHASE 3.8 : mappers contiennent mapGlobalOnboardingDraftToEnterpriseFootprint", () => {
    expect(readSrc(`${efDir}/enterprise-footprint-mappers.ts`)).toContain("mapGlobalOnboardingDraftToEnterpriseFootprint");
  });
  it("T44 — PHASE 3.8 : ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY existe", () => {
    expect(readSrc(`${efDir}/enterprise-footprint-defaults.ts`)).toContain("ENTERPRISE_FOOTPRINT_LOCALSTORAGE_KEY");
  });
  it("T45 — PHASE 3.7 : global-onboarding-activation-qa.ts existe", () => {
    expect(fileExists("src/lib/clonestore/onboarding/global-onboarding-activation-qa.ts")).toBe(true);
  });
  it("T46 — PHASE 3.6 : global-onboarding-health.ts existe", () => {
    expect(fileExists("src/lib/clonestore/onboarding/global-onboarding-health.ts")).toBe(true);
  });
  it("T47 — PHASE 3.5 : SQL draft existe encore", () => {
    expect(fileExists("supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql")).toBe(true);
  });
  it("T48 — /profile/agents ne modifie pas le moteur Pierre (pas import src/lib/pierre)", () => {
    // La page existante importe déjà pierre depuis @/lib/clonestore (pas @/lib/pierre)
    const content = readSrc(agentsPage);
    expect(content).not.toContain("src/lib/pierre");
  });
  it("T49 — index.ts exporte loadEnterpriseFootprintForCockpit", () => {
    expect(readSrc(indexFile)).toContain("loadEnterpriseFootprintForCockpit");
  });
  it("T50 — index.ts exporte buildPierreEnterpriseFootprintContext", () => {
    expect(readSrc(indexFile)).toContain("buildPierreEnterpriseFootprintContext");
  });
  it("T51 — index.ts exporte buildEnterpriseFootprintCockpitQaChecklist", () => {
    expect(readSrc(indexFile)).toContain("buildEnterpriseFootprintCockpitQaChecklist");
  });
});
