// src/lib/clonestore/onboarding/__tests__/global-onboarding-manual-activation-qa-phase3-7.test.ts
// PHASE 3.7 — Global Onboarding Manual Activation QA — Tests de validation
//
// 44 tests couvrant :
//   - Documentation PHASE 3.7
//   - Module QA checklist
//   - Runtime restore safe
//   - Intégration /profile/onboarding
//   - Check script
//   - Sécurité (wording interdit)
//   - Régression PHASE 3.1 → 3.6

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// __dirname = .../clonestore/src/lib/clonestore/onboarding/__tests__
// 5 niveaux → .../clonestore (racine du projet)
const root = resolve(__dirname, "../../../../../");

function readSrc(rel: string): string {
  return readFileSync(resolve(root, rel), "utf-8");
}
function fileExists(rel: string): boolean {
  return existsSync(resolve(root, rel));
}

const onboardingDir = "src/lib/clonestore/onboarding";
const docFile = "docs/PHASE_3_7_GLOBAL_ONBOARDING_MANUAL_ACTIVATION_QA.md";
const qaModuleFile = `${onboardingDir}/global-onboarding-activation-qa.ts`;
const runtimeFile = `${onboardingDir}/global-onboarding-runtime.ts`;
const onboardingPage = "src/app/profile/onboarding/page.tsx";
const checkScript = "scripts/check-global-onboarding-activation-qa.mjs";
const pkgFile = "package.json";
const sqlFile = "supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql";

// ── GROUPE 1 — Documentation (T01–T14) ────────────────────────────────────────

describe("PHASE 3.7 — Documentation (T01–T14)", () => {
  it("T01 — doc PHASE_3_7 existe", () => {
    expect(fileExists(docFile)).toBe(true);
  });
  it("T02 — doc mentionne Manual Activation QA", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("manual activation qa");
  });
  it("T03 — doc mentionne SQL PHASE_3_5", () => {
    const content = readSrc(docFile);
    const hasMention =
      content.includes("PHASE_3_5") ||
      content.includes("PHASE 3.5") ||
      content.includes("phase_3_5");
    expect(hasMention).toBe(true);
  });
  it("T04 — doc mentionne RLS enabled", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("rls");
    const hasEnabled =
      content.toLowerCase().includes("enabled") ||
      content.toLowerCase().includes("activée") ||
      content.toLowerCase().includes("rowsecurity");
    expect(hasEnabled).toBe(true);
  });
  it("T05 — doc mentionne select_own_global_onboarding", () => {
    const content = readSrc(docFile);
    expect(content).toContain("select_own_global_onboarding");
  });
  it("T06 — doc mentionne insert_own_global_onboarding", () => {
    const content = readSrc(docFile);
    expect(content).toContain("insert_own_global_onboarding");
  });
  it("T07 — doc mentionne update_own_global_onboarding", () => {
    const content = readSrc(docFile);
    expect(content).toContain("update_own_global_onboarding");
  });
  it("T08 — doc mentionne no delete policy", () => {
    const content = readSrc(docFile);
    const hasNoDelete =
      content.toLowerCase().includes("no delete") ||
      content.toLowerCase().includes("pas de policy delete") ||
      content.toLowerCase().includes("aucune policy delete") ||
      content.toLowerCase().includes("delete désactivé");
    expect(hasNoDelete).toBe(true);
  });
  it("T09 — doc mentionne NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED", () => {
    const content = readSrc(docFile);
    expect(content).toContain("NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED");
  });
  it("T10 — doc mentionne check:global-onboarding-readiness", () => {
    const content = readSrc(docFile);
    expect(content).toContain("check:global-onboarding-readiness");
  });
  it("T11 — doc mentionne check:global-onboarding-activation-qa", () => {
    const content = readSrc(docFile);
    expect(content).toContain("check:global-onboarding-activation-qa");
  });
  it("T12 — doc mentionne rollback", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("rollback");
  });
  it("T13 — doc mentionne localStorage fallback", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("localstorage");
    const hasFallback =
      content.toLowerCase().includes("fallback") ||
      content.toLowerCase().includes("localStorage uniquement");
    expect(hasFallback).toBe(true);
  });
  it("T14 — doc mentionne refresh / restore", () => {
    const content = readSrc(docFile);
    const hasRefresh =
      content.toLowerCase().includes("refresh") ||
      content.toLowerCase().includes("f5") ||
      content.toLowerCase().includes("restore");
    expect(hasRefresh).toBe(true);
  });
});

// ── GROUPE 2 — Module QA Checklist (T15–T22) ──────────────────────────────────

describe("PHASE 3.7 — Module QA Checklist (T15–T22)", () => {
  it("T15 — activation QA module existe", () => {
    expect(fileExists(qaModuleFile)).toBe(true);
  });
  it("T16 — module contient buildGlobalOnboardingManualQaChecklist", () => {
    const content = readSrc(qaModuleFile);
    expect(content).toContain("buildGlobalOnboardingManualQaChecklist");
  });
  it("T17 — module contient buildGlobalOnboardingManualQaVerdict", () => {
    const content = readSrc(qaModuleFile);
    expect(content).toContain("buildGlobalOnboardingManualQaVerdict");
  });
  it("T18 — module contient sql_table_exists", () => {
    const content = readSrc(qaModuleFile);
    expect(content).toContain("sql_table_exists");
  });
  it("T19 — module contient rls_enabled", () => {
    const content = readSrc(qaModuleFile);
    expect(content).toContain("rls_enabled");
  });
  it("T20 — module contient no_delete_policy", () => {
    const content = readSrc(qaModuleFile);
    expect(content).toContain("no_delete_policy");
  });
  it("T21 — module n'importe pas supabase createClient", () => {
    const content = readSrc(qaModuleFile);
    // Le module ne doit pas importer depuis supabase-js (les mentions dans les commentaires sont OK)
    expect(content).not.toContain("import { createClient");
    expect(content).not.toContain("from \"@supabase/supabase-js\"");
    expect(content).not.toContain("from '@supabase/supabase-js'");
  });
  it("T22 — module ne contient pas insert/update/delete/upsert", () => {
    const content = readSrc(qaModuleFile);
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
    expect(content).not.toContain(".delete(");
    expect(content).not.toContain(".upsert(");
  });
});

// ── GROUPE 3 — Runtime restore (T23–T25) ──────────────────────────────────────

describe("PHASE 3.7 — Runtime restore (T23–T25)", () => {
  it("T23 — runtime contient restoreGlobalOnboardingWithFallback", () => {
    const content = readSrc(runtimeFile);
    expect(content).toContain("restoreGlobalOnboardingWithFallback");
  });
  it("T24 — runtime restore section ne contient pas insert/update/delete/upsert", () => {
    const content = readSrc(runtimeFile);
    // La section restore ne doit contenir que des reads
    // Vérifier que .insert/.update/.delete/.upsert n'apparaissent pas après "restoreGlobal"
    const restoreIdx = content.indexOf("restoreGlobalOnboardingWithFallback");
    const afterRestore = content.slice(restoreIdx);
    expect(afterRestore).not.toContain(".insert(");
    expect(afterRestore).not.toContain(".update(");
    expect(afterRestore).not.toContain(".delete(");
    // upsert est dans persistGlobalOnboardingDraftSafely (write section), pas dans restore
    const restoreFnIdx = afterRestore.indexOf("export async function restoreGlobalOnboardingWithFallback");
    if (restoreFnIdx > -1) {
      const restoreFnBody = afterRestore.slice(restoreFnIdx);
      expect(restoreFnBody).not.toContain(".upsert(");
    }
  });
  it("T25 — /profile/onboarding utilise restoreGlobalOnboardingWithFallback", () => {
    const content = readSrc(onboardingPage);
    const hasRestore =
      content.includes("restoreGlobalOnboardingWithFallback") ||
      content.includes("restoreGlobal");
    expect(hasRestore).toBe(true);
  });
});

// ── GROUPE 4 — Page onboarding (T26–T29) ──────────────────────────────────────

describe("PHASE 3.7 — Page onboarding (T26–T29)", () => {
  it("T26 — page ne contient pas insert/upsert direct", () => {
    const content = readSrc(onboardingPage);
    expect(content).not.toMatch(/\.insert\s*\(/);
    expect(content).not.toMatch(/\.upsert\s*\(/);
  });
  it("T27 — check script activation QA existe", () => {
    expect(fileExists(checkScript)).toBe(true);
  });
  it("T28 — check script ne contient pas insert/update/delete/upsert", () => {
    const content = readSrc(checkScript);
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".update(");
    expect(content).not.toContain(".delete(");
    expect(content).not.toContain(".upsert(");
  });
  it("T29 — check script n'utilise pas service role comme clé Supabase", () => {
    const content = readSrc(checkScript);
    // Le script ne doit pas créer de client avec service_role key
    // Les mentions dans les commentaires (ex: "JAMAIS service-role") sont OK
    expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(content).not.toContain("service_role_key");
    expect(content).not.toContain("createClient(supabaseUrl, serviceRole");
  });
});

// ── GROUPE 5 — Package.json (T30–T31) ─────────────────────────────────────────

describe("PHASE 3.7 — Package.json (T30–T31)", () => {
  it("T30 — package.json contient test:phase3-7", () => {
    const content = readSrc(pkgFile);
    expect(content).toContain("test:phase3-7");
  });
  it("T31 — package.json contient check:global-onboarding-activation-qa", () => {
    const content = readSrc(pkgFile);
    expect(content).toContain("check:global-onboarding-activation-qa");
  });
});

// ── GROUPE 6 — Wording interdit (T32–T35) ─────────────────────────────────────

describe("PHASE 3.7 — Wording interdit (T32–T35)", () => {
  it("T32 — doc ne contient pas la phrase 'public launch go'", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).not.toContain("public launch go");
  });
  it("T33 — doc ne contient pas 'zéro erreur'", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).not.toMatch(/zéro\s+erreur/);
    expect(content.toLowerCase()).not.toMatch(/zero\s+erreur/);
  });
  it("T34 — doc ne contient pas 'conformité garantie'", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).not.toContain("conformité garantie");
    expect(content.toLowerCase()).not.toContain("conformite garantie");
  });
  it("T35 — doc mentionne 'lancement public externe non validé'", () => {
    const content = readSrc(docFile);
    const hasMention =
      content.toLowerCase().includes("lancement public externe non validé") ||
      content.toLowerCase().includes("lancement public externe non valide") ||
      content.toLowerCase().includes("non validé") ||
      content.toLowerCase().includes("non activé");
    expect(hasMention).toBe(true);
  });
});

// ── GROUPE 7 — SQL Draft (T36) ────────────────────────────────────────────────

describe("PHASE 3.7 — SQL Draft régression (T36)", () => {
  it("T36 — SQL draft PHASE 3.5 existe encore", () => {
    expect(fileExists(sqlFile)).toBe(true);
  });
});

// ── GROUPE 8 — Régression (T37–T44) ──────────────────────────────────────────

describe("PHASE 3.7 — Régression PHASE 3.6 → 3.1 (T37–T44)", () => {
  it("T37 — PHASE 3.6 : health file existe", () => {
    expect(fileExists(`${onboardingDir}/global-onboarding-health.ts`)).toBe(true);
  });
  it("T38 — PHASE 3.6 : runtime file existe", () => {
    expect(fileExists(`${onboardingDir}/global-onboarding-runtime.ts`)).toBe(true);
  });
  it("T39 — PHASE 3.5 : types.ts contient GlobalOnboardingDraft", () => {
    const content = readSrc(`${onboardingDir}/global-onboarding-types.ts`);
    expect(content).toContain("GlobalOnboardingDraft");
  });
  it("T40 — PHASE 3.5 : defaults.ts contient GLOBAL_ONBOARDING_LOCALSTORAGE_KEY", () => {
    const content = readSrc(`${onboardingDir}/global-onboarding-defaults.ts`);
    expect(content).toContain("GLOBAL_ONBOARDING_LOCALSTORAGE_KEY");
  });
  it("T41 — PHASE 3.5 : index.ts exporte persistGlobalOnboardingWithFallback", () => {
    const content = readSrc(`${onboardingDir}/index.ts`);
    expect(content).toContain("persistGlobalOnboardingWithFallback");
  });
  it("T42 — PHASE 3.5 : index.ts exporte restoreGlobalOnboardingWithFallback", () => {
    const content = readSrc(`${onboardingDir}/index.ts`);
    expect(content).toContain("restoreGlobalOnboardingWithFallback");
  });
  it("T43 — PHASE 3.5 : SQL draft a RLS enabled", () => {
    const content = readSrc(sqlFile);
    expect(content.toLowerCase()).toContain("enable row level security");
  });
  it("T44 — PHASE 3.5 : readonly client ne contient pas insert/upsert", () => {
    const content = readSrc(`${onboardingDir}/global-onboarding-readonly-client.ts`);
    expect(content).not.toContain(".insert(");
    expect(content).not.toContain(".upsert(");
  });
});
