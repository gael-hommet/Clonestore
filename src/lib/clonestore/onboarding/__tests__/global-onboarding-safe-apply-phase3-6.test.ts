// src/lib/clonestore/onboarding/__tests__/global-onboarding-safe-apply-phase3-6.test.ts
// PHASE 3.6 — Global Onboarding Safe Apply — Tests de validation
//
// 46 tests couvrant :
//   - Documentation PHASE 3.6
//   - Health check table/RLS
//   - Runtime safe bridge
//   - Storage feature flag
//   - Intégration /profile/onboarding
//   - Sécurité (pas de service role, pas de wording interdit)
//   - Régression PHASE 3.5 → 3.1

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
const docFile = "docs/PHASE_3_6_GLOBAL_ONBOARDING_SAFE_APPLY.md";
const healthFile = `${onboardingDir}/global-onboarding-health.ts`;
const runtimeFile = `${onboardingDir}/global-onboarding-runtime.ts`;
const storageFile = `${onboardingDir}/global-onboarding-storage.ts`;
const flagsFile = `${onboardingDir}/global-onboarding-flags.ts`;
const readonlyClientFile = `${onboardingDir}/global-onboarding-readonly-client.ts`;
const onboardingPage = "src/app/profile/onboarding/page.tsx";
const sqlFile = "supabase/sql/PHASE_3_5_GLOBAL_ONBOARDING_DRAFTS.sql";
const checkScript = "scripts/check-global-onboarding-readiness.mjs";

// ── GROUPE 1 — Documentation ──────────────────────────────────────────────────

describe("PHASE 3.6 — Documentation (T01–T07)", () => {
  it("T01 — doc PHASE_3_6 existe", () => {
    expect(fileExists(docFile)).toBe(true);
  });
  it("T02 — doc mentionne Safe Apply", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("safe apply");
  });
  it("T03 — doc mentionne SQL appliqué manuellement ou vérification requise", () => {
    const content = readSrc(docFile);
    const hasMention =
      content.toLowerCase().includes("manuellement") ||
      content.toLowerCase().includes("vérification requise") ||
      content.toLowerCase().includes("gael");
    expect(hasMention).toBe(true);
  });
  it("T04 — doc mentionne NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED", () => {
    const content = readSrc(docFile);
    expect(content).toContain("NEXT_PUBLIC_GLOBAL_ONBOARDING_SERVER_PERSISTENCE_ENABLED");
  });
  it("T05 — doc mentionne localStorage first", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("localstorage");
    const hasPriority =
      content.toLowerCase().includes("first") ||
      content.toLowerCase().includes("en premier") ||
      content.toLowerCase().includes("priorit");
    expect(hasPriority).toBe(true);
  });
  it("T06 — doc mentionne health check", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("health check");
  });
  it("T07 — doc mentionne fallback localStorage", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).toContain("fallback");
    expect(content.toLowerCase()).toContain("localstorage");
  });
});

// ── GROUPE 2 — Health check ───────────────────────────────────────────────────

describe("PHASE 3.6 — Health check (T08–T13)", () => {
  it("T08 — health file existe", () => {
    expect(fileExists(healthFile)).toBe(true);
  });
  it("T09 — health check utilise select", () => {
    const content = readSrc(healthFile);
    expect(content).toContain(".select(");
  });
  it("T10 — health check ne contient pas insert(", () => {
    const content = readSrc(healthFile);
    expect(content).not.toContain(".insert(");
  });
  it("T11 — health check ne contient pas update(", () => {
    const content = readSrc(healthFile);
    expect(content).not.toContain(".update(");
  });
  it("T12 — health check ne contient pas delete(", () => {
    const content = readSrc(healthFile);
    expect(content).not.toContain(".delete(");
  });
  it("T13 — health check ne contient pas upsert(", () => {
    const content = readSrc(healthFile);
    expect(content).not.toContain(".upsert(");
  });
});

// ── GROUPE 3 — Runtime safe bridge ────────────────────────────────────────────

describe("PHASE 3.6 — Runtime bridge (T14–T20)", () => {
  it("T14 — runtime file existe", () => {
    expect(fileExists(runtimeFile)).toBe(true);
  });
  it("T15 — runtime sauvegarde localStorage en premier", () => {
    const content = readSrc(runtimeFile);
    // localStorage doit être écrit avant le flag check
    const lsIndex = content.indexOf("saveGlobalOnboardingDraftToLocalStorage");
    const flagIndex = content.indexOf("isGlobalOnboardingServerPersistenceEnabled");
    expect(lsIndex).toBeGreaterThan(-1);
    expect(flagIndex).toBeGreaterThan(-1);
    expect(lsIndex).toBeLessThan(flagIndex);
  });
  it("T16 — runtime vérifie feature flag avant write serveur", () => {
    const content = readSrc(runtimeFile);
    expect(content).toContain("isGlobalOnboardingServerPersistenceEnabled");
  });
  it("T17 — runtime gère userId manquant", () => {
    const content = readSrc(runtimeFile);
    expect(content).toContain("local_persisted_auth_required");
  });
  it("T18 — runtime gère validation échouée", () => {
    const content = readSrc(runtimeFile);
    expect(content).toContain("local_persisted_validation_failed");
  });
  it("T19 — runtime gère serveur indisponible", () => {
    const content = readSrc(runtimeFile);
    expect(content).toContain("local_persisted_server_unavailable");
  });
  it("T20 — runtime expose persistGlobalOnboardingWithFallback", () => {
    const content = readSrc(runtimeFile);
    expect(content).toContain("persistGlobalOnboardingWithFallback");
  });
});

// ── GROUPE 4 — Storage et flags ───────────────────────────────────────────────

describe("PHASE 3.6 — Storage et flags (T21–T22)", () => {
  it("T21 — storage est toujours feature-flagged", () => {
    const content = readSrc(storageFile);
    expect(content).toContain("canPersistGlobalOnboarding");
    expect(content).toContain("isGlobalOnboardingServerPersistenceEnabled");
  });
  it("T22 — flags défaut false (pas de hardcode true)", () => {
    const content = readSrc(flagsFile);
    expect(content).not.toContain("return true");
    expect(content).toContain("=== \"true\"");
  });
});

// ── GROUPE 5 — Intégration /profile/onboarding ───────────────────────────────

describe("PHASE 3.6 — Intégration /profile/onboarding (T23–T27)", () => {
  it("T23 — page importe/utilise runtime ou localStorage safe", () => {
    const content = readSrc(onboardingPage);
    const hasRuntime =
      content.includes("persistGlobalOnboardingWithFallback") ||
      content.includes("saveGlobalOnboardingDraftToLocalStorage");
    expect(hasRuntime).toBe(true);
  });
  it("T24 — page ne contient pas d'insert/upsert direct Supabase", () => {
    const content = readSrc(onboardingPage);
    expect(content).not.toMatch(/\.insert\s*\(/);
    expect(content).not.toMatch(/\.upsert\s*\(/);
  });
  it("T25 — page ne dit pas 'configuration enregistrée serveur'", () => {
    const content = readSrc(onboardingPage);
    expect(content.toLowerCase()).not.toContain("configuration enregistrée serveur");
  });
  it("T26 — page mentionne encore brouillon local ou fallback localStorage", () => {
    const content = readSrc(onboardingPage);
    const hasMention =
      content.toLowerCase().includes("brouillon local") ||
      content.toLowerCase().includes("localstorage") ||
      content.toLowerCase().includes("fallback");
    expect(hasMention).toBe(true);
  });
  it("T27 — page contient les liens attendus (agents/messages/pierre)", () => {
    const content = readSrc(onboardingPage);
    expect(content).toContain("/profile/agents");
    expect(content).toContain("/profile/messages");
    expect(content).toContain("/agents/pierre");
  });
});

// ── GROUPE 6 — Check script et SQL ───────────────────────────────────────────

describe("PHASE 3.6 — Check script et SQL (T28–T35)", () => {
  it("T28 — check script existe ou doc explique vérification manuelle", () => {
    const scriptExists = fileExists(checkScript);
    if (!scriptExists) {
      const doc = readSrc(docFile);
      expect(doc.toLowerCase()).toContain("manuel");
    } else {
      expect(scriptExists).toBe(true);
    }
  });
  it("T29 — readonly client ne contient pas insert(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".insert(");
  });
  it("T30 — readonly client ne contient pas update(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".update(");
  });
  it("T31 — readonly client ne contient pas delete(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".delete(");
  });
  it("T32 — readonly client ne contient pas upsert(", () => {
    const content = readSrc(readonlyClientFile);
    expect(content).not.toContain(".upsert(");
  });
  it("T33 — SQL draft existe encore", () => {
    expect(fileExists(sqlFile)).toBe(true);
  });
  it("T34 — SQL draft a RLS activée", () => {
    const content = readSrc(sqlFile);
    expect(content.toLowerCase()).toContain("enable row level security");
  });
  it("T35 — SQL draft a select own policy", () => {
    const content = readSrc(sqlFile);
    expect(content).toContain("select_own_global_onboarding");
  });
});

// ── GROUPE 7 — SQL policies complètes ────────────────────────────────────────

describe("PHASE 3.6 — SQL policies (T36–T39)", () => {
  it("T36 — SQL draft a insert own policy", () => {
    const content = readSrc(sqlFile);
    expect(content).toContain("insert_own_global_onboarding");
  });
  it("T37 — SQL draft a update own policy", () => {
    const content = readSrc(sqlFile);
    expect(content).toContain("update_own_global_onboarding");
  });
  it("T38 — SQL draft n'a pas de delete policy", () => {
    const content = readSrc(sqlFile);
    expect(content).not.toMatch(/create\s+policy\s+"[^"]*"\s+on\s+\S+\s+for\s+delete/i);
  });
  it("T39 — aucun fichier onboarding n'utilise service-role", () => {
    const files = [
      `${onboardingDir}/global-onboarding-health.ts`,
      `${onboardingDir}/global-onboarding-runtime.ts`,
      `${onboardingDir}/global-onboarding-storage.ts`,
      `${onboardingDir}/global-onboarding-readonly-client.ts`,
    ];
    for (const file of files) {
      if (fileExists(file)) {
        const content = readSrc(file);
        expect(content).not.toContain("service_role");
        expect(content).not.toContain("SERVICE_ROLE");
      }
    }
  });
});

// ── GROUPE 8 — Wording interdit ───────────────────────────────────────────────

describe("PHASE 3.6 — Wording interdit (T40–T43)", () => {
  it("T40 — doc PHASE 3.6 ne dit pas 'public launch go'", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).not.toContain("public launch go");
  });
  it("T41 — doc PHASE 3.6 ne dit pas 'zéro erreur'", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).not.toMatch(/zéro\s+erreur/);
    expect(content.toLowerCase()).not.toMatch(/zero\s+erreur/);
  });
  it("T42 — doc PHASE 3.6 ne dit pas 'conformité garantie'", () => {
    const content = readSrc(docFile);
    expect(content.toLowerCase()).not.toContain("conformité garantie");
    expect(content.toLowerCase()).not.toContain("conformite garantie");
  });
  it("T43 — runtime ne dit pas 'clonevoice actif production'", () => {
    const content = readSrc(runtimeFile);
    expect(content.toLowerCase()).not.toContain("clonevoice actif production");
  });
});

// ── GROUPE 9 — Régression ─────────────────────────────────────────────────────

describe("PHASE 3.6 — Régression PHASE 3.5 (T44–T46)", () => {
  it("T44 — PHASE 3.5 : index.ts exporte GLOBAL_ONBOARDING_LOCALSTORAGE_KEY", () => {
    const content = readSrc(`${onboardingDir}/index.ts`);
    expect(content).toContain("GLOBAL_ONBOARDING_LOCALSTORAGE_KEY");
  });
  it("T45 — PHASE 3.5 : types.ts contient GlobalOnboardingDraft", () => {
    const content = readSrc(`${onboardingDir}/global-onboarding-types.ts`);
    expect(content).toContain("GlobalOnboardingDraft");
  });
  it("T46 — PHASE 3.5 : SQL draft contient unique(user_id, company_id)", () => {
    const content = readSrc(sqlFile);
    expect(content.toLowerCase()).toContain("unique");
    expect(content).toContain("user_id");
    expect(content).toContain("company_id");
  });
});
