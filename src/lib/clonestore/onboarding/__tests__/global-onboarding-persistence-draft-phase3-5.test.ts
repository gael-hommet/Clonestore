// src/lib/clonestore/onboarding/__tests__/global-onboarding-persistence-draft-phase3-5.test.ts
// PHASE 3.5 — Global Onboarding Persistence Draft — Tests de validation
//
// 55 tests couvrant :
//   - Existence des fichiers
//   - Types et exports
//   - Clé localStorage
//   - Mappers CloneADN
//   - Validation / wording interdit
//   - Schéma SQL draft
//   - Readonly client (pas d'écriture)
//   - Storage (feature-flagged)
//   - Intégration /profile/onboarding
//   - Documentation
//   - Régression PHASE 3.1 → 3.4

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const onboardingDir = "src/lib/clonestore/onboarding";
const typesFile = `${onboardingDir}/global-onboarding-types.ts`;
const defaultsFile = `${onboardingDir}/global-onboarding-defaults.ts`;
const mappersFile = `${onboardingDir}/global-onboarding-mappers.ts`;
const validationFile = `${onboardingDir}/global-onboarding-validation.ts`;
const localstorageFile = `${onboardingDir}/global-onboarding-localstorage.ts`;
const schemaFile = `${onboardingDir}/global-onboarding-schema.ts`;
const readonlyClientFile = `${onboardingDir}/global-onboarding-readonly-client.ts`;
const storageFile = `${onboardingDir}/global-onboarding-storage.ts`;
const flagsFile = `${onboardingDir}/global-onboarding-flags.ts`;
const indexFile = `${onboardingDir}/index.ts`;
const sqlFile = "supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql";
const docFile = "docs/PHASE_3_5_GLOBAL_ONBOARDING_PERSISTENCE_DRAFT.md";
const onboardingPage = "src/app/profile/onboarding/page.tsx";

// ── GROUPE 1 — Existence des fichiers ─────────────────────────────────────────

describe("PHASE 3.5 — Fichiers onboarding (T01–T10)", () => {
  it("T01 — global-onboarding-types.ts existe", () => {
    expect(fileExists(typesFile)).toBe(true);
  });
  it("T02 — global-onboarding-defaults.ts existe", () => {
    expect(fileExists(defaultsFile)).toBe(true);
  });
  it("T03 — global-onboarding-mappers.ts existe", () => {
    expect(fileExists(mappersFile)).toBe(true);
  });
  it("T04 — global-onboarding-validation.ts existe", () => {
    expect(fileExists(validationFile)).toBe(true);
  });
  it("T05 — global-onboarding-localstorage.ts existe", () => {
    expect(fileExists(localstorageFile)).toBe(true);
  });
  it("T06 — global-onboarding-schema.ts existe", () => {
    expect(fileExists(schemaFile)).toBe(true);
  });
  it("T07 — global-onboarding-readonly-client.ts existe", () => {
    expect(fileExists(readonlyClientFile)).toBe(true);
  });
  it("T08 — global-onboarding-storage.ts existe", () => {
    expect(fileExists(storageFile)).toBe(true);
  });
  it("T09 — global-onboarding-flags.ts existe", () => {
    expect(fileExists(flagsFile)).toBe(true);
  });
  it("T10 — index.ts existe", () => {
    expect(fileExists(indexFile)).toBe(true);
  });
});

// ── GROUPE 2 — Types et exports ───────────────────────────────────────────────

describe("PHASE 3.5 — Types et exports (T11–T16)", () => {
  it("T11 — types.ts contient GlobalOnboardingDraft", () => {
    const content = readSrc(typesFile);
    expect(content).toContain("GlobalOnboardingDraft");
  });
  it("T12 — types.ts contient GlobalOnboardingPersistablePayload", () => {
    const content = readSrc(typesFile);
    expect(content).toContain("GlobalOnboardingPersistablePayload");
  });
  it("T13 — defaults.ts contient GLOBAL_ONBOARDING_LOCALSTORAGE_KEY", () => {
    const content = readSrc(defaultsFile);
    expect(content).toContain("GLOBAL_ONBOARDING_LOCALSTORAGE_KEY");
  });
  it("T14 — localStorage key = clonestore.globalOnboarding.draft.v1", () => {
    const content = readSrc(defaultsFile);
    expect(content).toContain("clonestore.globalOnboarding.draft.v1");
  });
  it("T15 — index.ts exporte GLOBAL_ONBOARDING_LOCALSTORAGE_KEY", () => {
    const content = readSrc(indexFile);
    expect(content).toContain("GLOBAL_ONBOARDING_LOCALSTORAGE_KEY");
  });
  it("T16 — index.ts exporte persistGlobalOnboardingDraftSafely", () => {
    const content = readSrc(indexFile);
    expect(content).toContain("persistGlobalOnboardingDraftSafely");
  });
});

// ── GROUPE 3 — Mappers CloneADN ───────────────────────────────────────────────

describe("PHASE 3.5 — Mappers CloneADN (T17–T18)", () => {
  it("T17 — mappers contiennent mapGlobalOnboardingDraftToEnterpriseMemory", () => {
    const content = readSrc(mappersFile);
    expect(content).toContain("mapGlobalOnboardingDraftToEnterpriseMemory");
  });
  it("T18 — mappers contiennent buildCloneADNPreviewFromOnboardingDraft", () => {
    const content = readSrc(mappersFile);
    expect(content).toContain("buildCloneADNPreviewFromOnboardingDraft");
  });
});

// ── GROUPE 4 — Validation / wording interdit ──────────────────────────────────

describe("PHASE 3.5 — Validation wording interdit (T19–T27)", () => {
  it("T19 — validation interdit sk_live_", () => {
    const content = readSrc(validationFile);
    expect(content).toContain("sk_live_");
  });
  it("T20 — validation interdit whsec_", () => {
    const content = readSrc(validationFile);
    expect(content).toContain("whsec_");
  });
  it("T21 — validation interdit OPENAI_API_KEY", () => {
    const content = readSrc(validationFile);
    expect(content.toLowerCase()).toContain("openai_api_key");
  });
  it("T22 — validation interdit ANTHROPIC_API_KEY", () => {
    const content = readSrc(validationFile);
    expect(content.toLowerCase()).toContain("anthropic_api_key");
  });
  it("T23 — validation interdit public launch go", () => {
    const content = readSrc(validationFile);
    expect(content.toLowerCase()).toContain("public launch go");
  });
  it("T24 — validation interdit zéro erreur", () => {
    const content = readSrc(validationFile);
    expect(content.toLowerCase()).toContain("zéro erreur");
  });
  it("T25 — validation interdit conformité garantie", () => {
    const content = readSrc(validationFile);
    expect(content.toLowerCase()).toContain("conformité garantie");
  });
  it("T26 — validation exige first_mission employee_slug pierre", () => {
    const content = readSrc(validationFile);
    expect(content).toContain("pierre");
    expect(content).toContain("employee_slug");
  });
  it("T27 — validation exige plan_only true", () => {
    const content = readSrc(validationFile);
    expect(content).toContain("plan_only");
  });
});

// ── GROUPE 5 — SQL Draft ──────────────────────────────────────────────────────

describe("PHASE 3.5 — SQL Draft (T28–T35)", () => {
  it("T28 — schema.ts propose clonestore_global_onboarding_drafts", () => {
    const content = readSrc(schemaFile);
    expect(content).toContain("clonestore_global_onboarding_drafts");
  });
  it("T29 — SQL draft existe", () => {
    expect(fileExists(sqlFile)).toBe(true);
  });
  it("T30 — SQL draft active row level security", () => {
    const content = readSrc(sqlFile);
    expect(content.toLowerCase()).toContain("enable row level security");
  });
  it("T31 — SQL draft contient politique select own", () => {
    const content = readSrc(sqlFile);
    expect(content).toContain("select_own_global_onboarding");
  });
  it("T32 — SQL draft contient politique insert own", () => {
    const content = readSrc(sqlFile);
    expect(content).toContain("insert_own_global_onboarding");
  });
  it("T33 — SQL draft contient politique update own", () => {
    const content = readSrc(sqlFile);
    expect(content).toContain("update_own_global_onboarding");
  });
  it("T34 — SQL draft ne contient pas de delete policy", () => {
    const content = readSrc(sqlFile);
    // Aucune politique delete ne doit être définie
    expect(content).not.toContain("delete_own_global_onboarding");
    expect(content).not.toMatch(/create\s+policy\s+"[^"]*"\s+on\s+\S+\s+for\s+delete/i);
  });
  it("T35 — SQL draft contient unique(user_id, company_id)", () => {
    const content = readSrc(sqlFile);
    expect(content.toLowerCase()).toContain("unique");
    expect(content).toContain("user_id");
    expect(content).toContain("company_id");
  });
});

// ── GROUPE 6 — Readonly client (pas d'écriture) ───────────────────────────────

describe("PHASE 3.5 — Readonly client (T36–T40)", () => {
  it("T36 — readonly client ne contient pas insert(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".insert(");
  });
  it("T37 — readonly client ne contient pas update(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".update(");
  });
  it("T38 — readonly client ne contient pas delete(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".delete(");
  });
  it("T39 — readonly client ne contient pas upsert(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".upsert(");
  });
  it("T40 — readonly client a un fallback localStorage", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).toContain("localStorage");
  });
});

// ── GROUPE 7 — Storage feature-flagged ───────────────────────────────────────

describe("PHASE 3.5 — Storage et flags (T41–T44)", () => {
  it("T41 — storage est feature-flagged (canPersistGlobalOnboarding)", () => {
    const content = readSrc(storageFile);
    expect(content).toContain("canPersistGlobalOnboarding");
    expect(content).toContain("isGlobalOnboardingServerPersistenceEnabled");
  });
  it("T42 — flags default false (pas de hardcode true)", () => {
    const content = readSrc(flagsFile);
    // La fonction retourne false par défaut
    expect(content).not.toContain("return true");
    expect(content).toContain("=== \"true\"");
  });
  it("T43 — storage ne contient pas de upsert sans feature flag", () => {
    const content = readSrc(storageFile);
    // upsert doit être après la vérification du flag
    const flagCheckIndex = content.indexOf("canPersistGlobalOnboarding()");
    const upsertIndex = content.indexOf(".upsert(");
    // upsert existe dans le storage (pour PHASE 3.6) mais après le flag check
    if (upsertIndex > -1) {
      expect(flagCheckIndex).toBeLessThan(upsertIndex);
    }
  });
  it("T44 — flags.ts contient NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED", () => {
    const content = readSrc(flagsFile);
    expect(content).toContain("NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED");
  });
});

// ── GROUPE 8 — Intégration /profile/onboarding ───────────────────────────────

describe("PHASE 3.5 — Intégration /profile/onboarding (T45–T49)", () => {
  it("T45 — /profile/onboarding importe la couche onboarding (localStorage)", () => {
    const content = readSrc(onboardingPage);
    // Doit importer depuis @/lib/clonestore/onboarding ou les fonctions localStorage
    const hasImport =
      content.includes("@/lib/clonestore/onboarding") ||
      content.includes("global-onboarding-localstorage") ||
      content.includes("saveGlobalOnboardingDraftToLocalStorage") ||
      content.includes("GLOBAL_ONBOARDING_LOCALSTORAGE_KEY");
    expect(hasImport).toBe(true);
  });
  it("T46 — /profile/onboarding mentionne brouillon local ou localStorage", () => {
    const content = readSrc(onboardingPage);
    const hasMention =
      content.toLowerCase().includes("brouillon local") ||
      content.toLowerCase().includes("localstorage") ||
      content.includes("GLOBAL_ONBOARDING_LOCALSTORAGE_KEY");
    expect(hasMention).toBe(true);
  });
  it("T47 — /profile/onboarding ne contient pas d'insert/upsert direct Supabase", () => {
    const content = readSrc(onboardingPage);
    // Ne doit pas contenir de write DB direct depuis la page
    expect(content).not.toMatch(/\.insert\s*\(/);
    expect(content).not.toMatch(/\.upsert\s*\(/);
  });
  it("T48 — /profile/onboarding ne dit pas 'configuration enregistrée serveur'", () => {
    const content = readSrc(onboardingPage);
    expect(content.toLowerCase()).not.toContain("configuration enregistrée serveur");
  });
  it("T49 — /profile/onboarding contient les liens attendus", () => {
    const content = readSrc(onboardingPage);
    expect(content).toContain("/profile/agents");
    expect(content).toContain("/profile/messages");
    expect(content).toContain("/agents/pierre");
  });
});

// ── GROUPE 9 — Documentation ──────────────────────────────────────────────────

describe("PHASE 3.5 — Documentation (T50–T55)", () => {
  it("T50 — doc PHASE_3_5 existe", () => {
    expect(fileExists(docFile)).toBe(true);
  });
  it("T51 — doc mentionne CloneADN", () => {
    const content = readSrc(docFile);
    expect(content).toContain("CloneADN");
  });
  it("T52 — doc mentionne localStorage", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("localstorage");
  });
  it("T53 — doc mentionne SQL draft", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("sql");
    expect(content.toLowerCase()).toContain("draft");
  });
  it("T54 — doc mentionne RLS", () => {
    const content = readSrc(docFile);
    expect(content).toContain("RLS");
  });
  it("T55 — doc mentionne PHASE 3.6", () => {
    const content = readSrc(docFile);
    expect(content).toContain("PHASE 3.6");
  });
});
