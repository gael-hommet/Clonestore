// PHASE 3.3 — Apply CloneOS History Persistence Safely — Tests
// Tests statiques vérifiant l'activation contrôlée de la persistence.
// Lecture seule. Aucune migration appliquée. Moteur Pierre intact.

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

const LIB_BASE    = "src/lib/clonestore/cloneos-history";
const FLAGS_FILE  = `${LIB_BASE}/cloneos-history-flags.ts`;
const HEALTH_FILE = `${LIB_BASE}/cloneos-history-health.ts`;
const RUNTIME_FILE = `${LIB_BASE}/cloneos-history-runtime.ts`;
const STORAGE_FILE = `${LIB_BASE}/cloneos-history-storage.ts`;
const READONLY_FILE = `${LIB_BASE}/cloneos-history-readonly-client.ts`;

const MSG_BRIDGE  = "src/lib/clonestore/messages/message-center-cloneos-history-bridge.ts";
const AGENTS_PAGE = "src/app/profile/agents/page.tsx";
const MSG_PAGE    = "src/app/profile/messages/page.tsx";
const SQL_DRAFT   = "supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql";
const DOC_FILE    = "docs/PHASE_3_3_CLONEOS_HISTORY_SAFE_APPLY.md";

const flagsContent   = readFile(FLAGS_FILE);
const healthContent  = readFile(HEALTH_FILE);
const runtimeContent = readFile(RUNTIME_FILE);
const storageContent = readFile(STORAGE_FILE);
const readonlyContent = readFile(READONLY_FILE);
const agentsContent  = readFile(AGENTS_PAGE);
const msgContent     = readFile(MSG_PAGE);
const sqlContent     = readFile(SQL_DRAFT);
const docContent     = readFile(DOC_FILE);
const docLower       = docContent.toLowerCase();

// ── T01-T08 : Documentation PHASE 3.3 ────────────────────────────────────────

describe("T01 — Documentation PHASE 3.3 existe et est complète", () => {
  it("T01 — doc PHASE_3_3 exists", () => {
    expect(fileExists(DOC_FILE)).toBe(true);
  });

  it("T02 — doc mentions manual SQL application", () => {
    const hasMention =
      docLower.includes("manuellement") ||
      docLower.includes("manual") ||
      docLower.includes("instructions manuelles");
    expect(hasMention).toBe(true);
  });

  it("T03 — doc mentions Supabase SQL Editor", () => {
    const hasEditor =
      docLower.includes("sql editor") ||
      docLower.includes("éditeur sql");
    expect(hasEditor).toBe(true);
  });

  it("T04 — doc mentions table clonestore_cloneos_history", () => {
    expect(docContent).toContain("clonestore_cloneos_history");
  });

  it("T05 — doc mentions RLS enabled", () => {
    const hasRls = docLower.includes("rls") || docLower.includes("row level security");
    expect(hasRls).toBe(true);
  });

  it("T06 — doc mentions NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED", () => {
    expect(docContent).toContain("NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED");
  });

  it("T07 — doc says migration not automatic", () => {
    const hasNote =
      docLower.includes("migration automatique") ||
      docLower.includes("non automatique") ||
      docLower.includes("manuellement") ||
      docLower.includes("manuelle");
    expect(hasNote).toBe(true);
  });

  it("T08 — doc says fallback localStorage", () => {
    const hasFallback =
      docLower.includes("fallback localstorage") ||
      docLower.includes("fallback localStorage") ||
      (docLower.includes("localstorage") && docLower.includes("fallback"));
    expect(hasFallback).toBe(true);
  });
});

// ── T09-T11 : Feature flags ───────────────────────────────────────────────────

describe("T09 — Feature flags : activation env-gated", () => {
  it("T09 — flags file exists or storage exposes safe flag functions", () => {
    const flagsExists = fileExists(FLAGS_FILE);
    const storageHasFlags = storageContent.includes("isCloneOSHistoryServerPersistenceEnabled");
    expect(flagsExists || storageHasFlags).toBe(true);
  });

  it("T10 — isCloneOSHistoryServerPersistenceEnabled default false or env-gated", () => {
    const flagContent = fileExists(FLAGS_FILE) ? flagsContent : storageContent;
    const isEnvGated =
      flagContent.includes("NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED") ||
      flagContent.includes("process.env");
    const noHardcodedTrue =
      !flagContent.includes("= true as const") ||
      flagContent.includes("process.env");
    expect(isEnvGated && noHardcodedTrue).toBe(true);
  });

  it("T11 — no hardcoded true activation in flags/storage", () => {
    const combined = flagsContent + storageContent;
    // Must not have hardcoded `= true` for the persistence enabled flag
    // Check: the value comes from env, not a literal
    const hasHardcodedTrue = combined.includes(
      "CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = true"
    );
    expect(hasHardcodedTrue).toBe(false);
  });
});

// ── T12-T17 : Health check ────────────────────────────────────────────────────

describe("T12 — Health check : table readiness", () => {
  it("T12 — health file exists", () => {
    expect(fileExists(HEALTH_FILE)).toBe(true);
  });

  it("T13 — health check uses select (.select()", () => {
    expect(healthContent).toContain(".select(");
  });

  it("T14 — health check does not use insert", () => {
    expect(healthContent).not.toContain(".insert(");
  });

  it("T15 — health check does not use update", () => {
    expect(healthContent).not.toContain(".update(");
  });

  it("T16 — health check does not use delete", () => {
    expect(healthContent).not.toContain(".delete(");
  });

  it("T17 — health check does not use upsert", () => {
    expect(healthContent).not.toContain(".upsert(");
  });
});

// ── T18-T23 : Runtime bridge ──────────────────────────────────────────────────

describe("T18 — Runtime bridge : safe persistence flow", () => {
  it("T18 — runtime safe bridge exists", () => {
    expect(fileExists(RUNTIME_FILE)).toBe(true);
  });

  it("T19 — runtime persists localStorage first (appendCloneOSHistoryToLocalStorage before DB)", () => {
    const hasLs = runtimeContent.includes("appendCloneOSHistoryToLocalStorage");
    const hasDb = runtimeContent.includes("persistCloneOSHistoryItemSafely");
    // localStorage call must appear before DB call
    const lsIdx = runtimeContent.indexOf("appendCloneOSHistoryToLocalStorage");
    const dbIdx = runtimeContent.indexOf("persistCloneOSHistoryItemSafely");
    expect(hasLs && hasDb && lsIdx < dbIdx).toBe(true);
  });

  it("T20 — runtime checks feature flag before DB write", () => {
    const hasFlagCheck = runtimeContent.includes("isCloneOSHistoryServerPersistenceEnabled");
    expect(hasFlagCheck).toBe(true);
  });

  it("T21 — runtime handles no userId", () => {
    const handlesNoUser =
      runtimeContent.includes("!userId") ||
      runtimeContent.includes("userId === null") ||
      runtimeContent.includes("auth_required");
    expect(handlesNoUser).toBe(true);
  });

  it("T22 — runtime handles validation failure", () => {
    const handlesValidation =
      runtimeContent.includes("validateCloneOSHistoryItem") ||
      runtimeContent.includes("validation_failed");
    expect(handlesValidation).toBe(true);
  });

  it("T23 — runtime handles server unavailable", () => {
    const handlesUnavailable =
      runtimeContent.includes("server_unavailable") ||
      runtimeContent.includes("can_attempt_write");
    expect(handlesUnavailable).toBe(true);
  });
});

// ── T24-T26 : /profile/agents ─────────────────────────────────────────────────

describe("T24 — /profile/agents : localStorage + no forced server persistence", () => {
  it("T24 — /profile/agents still contains localStorage fallback key", () => {
    expect(agentsContent).toContain("CLONEOS_HISTORY_KEY");
  });

  it("T25 — /profile/agents does not force server persistence (no hardcoded write)", () => {
    // The page should not force DB write — it uses persistCloneOSHistoryWithFallback
    // which respects the feature flag
    const noForcedWrite =
      !agentsContent.includes('CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = true') &&
      !agentsContent.includes("forceServerPersistence");
    expect(noForcedWrite).toBe(true);
  });

  it("T26 — /profile/agents does not contain direct insert to clonestore_cloneos_history", () => {
    const noDirectInsert =
      !agentsContent.includes('.from("clonestore_cloneos_history").insert') &&
      !agentsContent.includes(".from('clonestore_cloneos_history').insert");
    expect(noDirectInsert).toBe(true);
  });
});

// ── T27-T29 : /profile/messages ───────────────────────────────────────────────

describe("T27 — /profile/messages : bridge ou import cloneOS history read-only", () => {
  it("T27 — messages bridge exists or message center imports cloneOS history read-only", () => {
    const bridgeExists = fileExists(MSG_BRIDGE);
    const clientImports =
      readFile("src/lib/clonestore/messages/message-center-readonly-client.ts")
        .includes("cloneos-history");
    expect(bridgeExists || clientImports).toBe(true);
  });

  it("T28 — /profile/messages remains 4 tabs", () => {
    const has4Tabs =
      msgContent.toLowerCase().includes("suivis") &&
      msgContent.toLowerCase().includes("briefings") &&
      msgContent.toLowerCase().includes("livraisons") &&
      msgContent.toLowerCase().includes("alertes");
    expect(has4Tabs).toBe(true);
  });

  it("T29 — /profile/messages does not direct insert/upsert to cloneos history", () => {
    const noInsert =
      !msgContent.includes('.from("clonestore_cloneos_history").insert') &&
      !msgContent.includes('.from("clonestore_cloneos_history").upsert');
    expect(noInsert).toBe(true);
  });
});

// ── T30-T35 : Readonly client + SQL ──────────────────────────────────────────

describe("T30 — Readonly client + SQL checks", () => {
  it("T30 — readonly client still no insert/update/delete/upsert", () => {
    const noWrite =
      !readonlyContent.includes(".insert(") &&
      !readonlyContent.includes(".update(") &&
      !readonlyContent.includes(".delete(") &&
      !readonlyContent.includes(".upsert(");
    expect(noWrite).toBe(true);
  });

  it("T31 — SQL draft still exists", () => {
    expect(fileExists(SQL_DRAFT)).toBe(true);
  });

  it("T32 — SQL draft has select own policy", () => {
    const hasSelect =
      sqlContent.includes("cloneos_history_select_own") ||
      (sqlContent.includes("for select") && sqlContent.includes("auth.uid()"));
    expect(hasSelect).toBe(true);
  });

  it("T33 — SQL draft has insert own policy", () => {
    const hasInsert =
      sqlContent.includes("cloneos_history_insert_own") ||
      (sqlContent.includes("for insert") && sqlContent.includes("auth.uid()"));
    expect(hasInsert).toBe(true);
  });

  it("T34 — SQL draft has no delete policy", () => {
    // Delete should not be in the policies section
    const hasDeletePolicy =
      sqlContent.includes("cloneos_history_delete") ||
      (sqlContent.includes("for delete") && !sqlContent.includes("-- DELETE"));
    expect(hasDeletePolicy).toBe(false);
  });

  it("T35 — script check optional exists or doc explains manual check", () => {
    const scriptExists = fileExists("scripts/check-cloneos-history-readiness.mjs");
    const docHasCheck = docLower.includes("vérifier") || docLower.includes("check");
    expect(scriptExists || docHasCheck).toBe(true);
  });
});

// ── T36-T40 : Sécurité ────────────────────────────────────────────────────────

describe("T36 — Sécurité : pas de service-role ni wording interdit", () => {
  it("T36 — no service-role in client/readonly/runtime files", () => {
    const combined = readonlyContent + runtimeContent + healthContent;
    expect(combined).not.toContain("service_role");
  });

  it("T37 — no public launch GO", () => {
    const combined = [flagsContent, healthContent, runtimeContent, docContent].join(" ");
    expect(combined.toLowerCase()).not.toContain("public launch go");
  });

  it("T38 — no zéro erreur", () => {
    const combined = [flagsContent, healthContent, runtimeContent].join(" ");
    const noZeroErr =
      !combined.toLowerCase().includes("zéro erreur") &&
      !combined.toLowerCase().includes("zero erreur");
    expect(noZeroErr).toBe(true);
  });

  it("T39 — no conformité garantie", () => {
    const combined = [flagsContent, healthContent, runtimeContent].join(" ");
    expect(combined.toLowerCase()).not.toContain("conformité garantie");
  });

  it("T40 — no CloneVoice actif production", () => {
    const combined = [flagsContent, healthContent, runtimeContent, docContent].join(" ");
    expect(combined.toLowerCase()).not.toContain("clonevoice actif production");
  });
});

// ── T41-T45 : Phases précédentes intactes ─────────────────────────────────────

describe("T41 — Phases précédentes intactes", () => {
  it("T41 — PHASE 3.2 test file exists", () => {
    expect(fileExists("src/lib/clonestore/cloneos-history/__tests__/cloneos-history-server-persistence-design-phase3-2.test.ts")).toBe(true);
  });

  it("T42 — PHASE 3.1 test file exists", () => {
    expect(fileExists("src/app/profile/__tests__/phase-3-1-messages-real-data-readonly.test.ts")).toBe(true);
  });

  it("T43 — PHASE 2.9 test file exists", () => {
    expect(fileExists("src/app/profile/__tests__/phase-2-9-final-qa-gate.test.ts")).toBe(true);
  });

  it("T44 — TECH-11 test file exists", () => {
    expect(fileExists("src/lib/clonestore/readiness/__tests__/technology-readiness-final-gate-tech11.test.ts")).toBe(true);
  });

  it("T45 — pfinal02 key files exist", () => {
    const goLiveProofs = fileExists("src/lib/go-live/proofs/__tests__/go-live-proofs.test.ts");
    const phase32 = fileExists("src/lib/clonestore/cloneos-history/__tests__/cloneos-history-server-persistence-design-phase3-2.test.ts");
    expect(goLiveProofs && phase32).toBe(true);
  });
});
