// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-draft-persistence-design-phase4-4.test.ts
// PHASE 4.4 — Runtime Mission Draft Safe Persistence Design — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");
const RI_DIR = "lib/clonestore/runtime-integration";

function readSrc(rel: string): string {
  const full = resolve(ROOT, "src", rel);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readRootFile(rel: string): string {
  const full = resolve(ROOT, rel);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readDocs(name: string): string {
  return readRootFile(`docs/${name}`);
}

const sqlSrc = readRootFile("supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql");
const typesSrc = readSrc(`${RI_DIR}/runtime-mission-draft-persistence-types.ts`);
const flagsSrc = readSrc(`${RI_DIR}/runtime-mission-draft-persistence-flags.ts`);
const designSrc = readSrc(`${RI_DIR}/runtime-mission-draft-persistence-design.ts`);
const healthSrc = readSrc(`${RI_DIR}/runtime-mission-draft-persistence-health.ts`);
const lsSrc = readSrc(`${RI_DIR}/runtime-mission-draft-localstorage-design.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-mission-draft-persistence-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const scriptSrc = readRootFile("scripts/check-runtime-mission-draft-persistence-design.mjs");
const messagesSrc = readSrc("app/profile/messages/page.tsx");
const ALL_P44 = [typesSrc, flagsSrc, designSrc, healthSrc, lsSrc, qaSrc];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — SQL draft
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.4 — SQL draft", () => {
  it("1. SQL draft existe", () => {
    expect(existsSync(resolve(ROOT, "supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql"))).toBe(true);
  });
  it("2. SQL contient clonestore_runtime_mission_drafts", () => {
    expect(sqlSrc).toContain("clonestore_runtime_mission_drafts");
  });
  it("3. SQL contient enable row level security", () => {
    expect(sqlSrc.toLowerCase()).toContain("enable row level security");
  });
  it("4. SQL contient select policy", () => {
    expect(sqlSrc.toLowerCase()).toContain("for select");
  });
  it("5. SQL contient insert policy", () => {
    expect(sqlSrc.toLowerCase()).toContain("for insert");
  });
  it("6. SQL contient update policy", () => {
    expect(sqlSrc.toLowerCase()).toContain("for update");
  });
  it("7. SQL ne contient pas delete policy", () => {
    expect(sqlSrc.toLowerCase()).not.toContain("for delete");
  });
  const flags = [
    ["8", "execution_enabled"], ["9", "db_write_enabled"], ["10", "pierre_engine_called"],
    ["11", "ai_call_performed"], ["12", "clonevoice_active"], ["13", "public_launch_external_validated"],
  ];
  flags.forEach(([n, f]) => {
    it(`${n}. SQL contient ${f}`, () => {
      expect(sqlSrc).toContain(f);
    });
  });
  it("14. SQL contient index user_id", () => {
    expect(sqlSrc).toContain("idx_runtime_mission_draft_user_id");
  });
  it("15. SQL contient index company_id", () => {
    expect(sqlSrc).toContain("idx_runtime_mission_draft_company_id");
  });
  it("16. SQL contient index draft_id", () => {
    expect(sqlSrc).toContain("idx_runtime_mission_draft_draft_id");
  });
  it("17. SQL contient index updated_at", () => {
    expect(sqlSrc).toContain("idx_runtime_mission_draft_updated_at");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Fichiers + flags + design + health + localstorage
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.4 — Modules présents", () => {
  it("18. persistence types existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-mission-draft-persistence-types.ts`))).toBe(true);
  });
  it("19. persistence flags existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-mission-draft-persistence-flags.ts`))).toBe(true);
  });
  it("20. persistence design existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-mission-draft-persistence-design.ts`))).toBe(true);
  });
  it("21. persistence health existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-mission-draft-persistence-health.ts`))).toBe(true);
  });
  it("22. localstorage design existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-mission-draft-localstorage-design.ts`))).toBe(true);
  });
  it("23. persistence QA existe", () => {
    expect(existsSync(resolve(ROOT, "src", `${RI_DIR}/runtime-mission-draft-persistence-qa.ts`))).toBe(true);
  });
  it("24. flags contient le flag NEXT_PUBLIC_...", () => {
    expect(flagsSrc).toContain("NEXT_PUBLIC_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED");
  });
  it("25. flags default false", () => {
    expect(flagsSrc).toContain("DEFAULT_RUNTIME_MISSION_DRAFT_SERVER_PERSISTENCE_ENABLED = false");
  });
  it("26. design contient buildRuntimeMissionDraftPersistenceRecord", () => {
    expect(designSrc).toContain("buildRuntimeMissionDraftPersistenceRecord");
  });
  it("27. design contient buildRuntimeMissionDraftPersistenceWritePlan", () => {
    expect(designSrc).toContain("buildRuntimeMissionDraftPersistenceWritePlan");
  });
  it("28. design contient db_write_performed false", () => {
    expect(designSrc).toContain("db_write_performed: false");
  });
  it("29. design ne contient pas Supabase createClient", () => {
    expect(designSrc).not.toMatch(/createClient\s*\(/);
    expect(designSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("30. design ne contient pas fetch", () => {
    expect(designSrc).not.toMatch(/\bfetch\s*\(/);
  });
  it("31. design ne contient pas .insert(", () => {
    expect(designSrc).not.toContain(".insert(");
  });
  it("32. design ne contient pas .upsert(", () => {
    expect(designSrc).not.toContain(".upsert(");
  });
  it("33. health contient information_schema.tables", () => {
    expect(healthSrc).toContain("information_schema.tables");
  });
  it("34. health contient pg_policies", () => {
    expect(healthSrc).toContain("pg_policies");
  });
  it("35. health contient pg_constraint", () => {
    expect(healthSrc).toContain("pg_constraint");
  });
  it("36. localstorage design contient la clé v1", () => {
    expect(lsSrc).toContain("clonestore.runtimeMissionDrafts.local.v1");
  });
  it("37. localstorage design ne contient pas localStorage.setItem", () => {
    expect(lsSrc).not.toContain("localStorage.setItem");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Script
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.4 — Script read-only", () => {
  it("38. script existe", () => {
    expect(existsSync(resolve(ROOT, "scripts/check-runtime-mission-draft-persistence-design.mjs"))).toBe(true);
  });
  it("39. script contient check:runtime-mission-draft-persistence-design", () => {
    expect(scriptSrc).toContain("check:runtime-mission-draft-persistence-design");
  });
  it("40. script contient test:phase4-4", () => {
    expect(scriptSrc).toContain("test:phase4-4");
  });
  it("41. script ne contient pas .insert(", () => {
    expect(scriptSrc).not.toContain(".insert(");
  });
  it("42. script ne contient pas .update(", () => {
    expect(scriptSrc).not.toContain(".update(");
  });
  it("43. script ne contient pas .delete(", () => {
    expect(scriptSrc).not.toContain(".delete(");
  });
  it("44. script ne contient pas .upsert(", () => {
    expect(scriptSrc).not.toContain(".upsert(");
  });
  it("45. script ne contient pas fetch POST", () => {
    expect(scriptSrc).not.toMatch(/fetch\s*\([^)]*method:\s*["']POST["']/s);
  });
  it("46. script ne contient pas writeFile", () => {
    expect(scriptSrc).not.toContain("writeFile");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.4 — QA module", () => {
  it("47. QA contient buildRuntimeMissionDraftPersistenceQaChecklist", () => {
    expect(qaSrc).toContain("buildRuntimeMissionDraftPersistenceQaChecklist");
  });
  it("48. QA contient no_sql_auto_apply", () => {
    expect(qaSrc).toContain("no_sql_auto_apply");
  });
  it("49. QA contient no_env_auto_change", () => {
    expect(qaSrc).toContain("no_env_auto_change");
  });
  it("50. QA contient no_db_write", () => {
    expect(qaSrc).toContain("no_db_write");
  });
  it("51. QA contient no_api_post", () => {
    expect(qaSrc).toContain("no_api_post");
  });
  it("52. QA contient no_mission_created", () => {
    expect(qaSrc).toContain("no_mission_created");
  });
  it("53. QA contient public_launch_external_not_validated", () => {
    expect(qaSrc).toContain("public_launch_external_not_validated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Documentation + evidence
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.4 — Documentation + evidence", () => {
  const doc = readDocs("PHASE_4_4_RUNTIME_MISSION_DRAFT_SAFE_PERSISTENCE_DESIGN.md");
  const tpl = readRootFile("docs/templates/PHASE_4_4_RUNTIME_MISSION_DRAFT_PERSISTENCE_DESIGN_EVIDENCE.md");

  it("54. doc P4.4 existe", () => { expect(doc.length).toBeGreaterThan(0); });
  it("55. doc mentionne P4.4", () => { expect(doc).toContain("4.4"); });
  it("56. doc mentionne SQL draft", () => { expect(doc).toContain("SQL draft"); });
  it("57. doc mentionne clonestore_runtime_mission_drafts", () => { expect(doc).toContain("clonestore_runtime_mission_drafts"); });
  it("58. doc mentionne feature flag", () => { expect(doc.toLowerCase()).toContain("feature flag"); });
  it("59. doc mentionne localStorage-first", () => { expect(doc).toContain("localStorage-first"); });
  it("60. doc mentionne aucun POST de persistance", () => {
    const has = doc.toLowerCase().includes("aucune route post") || doc.toLowerCase().includes("aucun post") || doc.toLowerCase().includes("route post");
    expect(has).toBe(true);
  });
  it("61. doc mentionne aucune mission créée en base", () => { expect(doc.toLowerCase()).toContain("aucune mission créée en base"); });
  it("62. doc mentionne scale 80k non prouvé", () => {
    const has = doc.toLowerCase().includes("scale 80k non prouvé") || (doc.includes("80k") && doc.toLowerCase().includes("non prouvé"));
    expect(has).toBe(true);
  });
  it("63. doc mentionne PHASE 4.5", () => { expect(doc).toContain("4.5"); });
  it("64. doc ne contient pas phrase de lancement public interdite", () => { expect(doc.toLowerCase()).not.toContain("public launch go"); });
  it("65. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("66. doc ne contient pas 'conformité garantie'", () => { expect(doc.toLowerCase()).not.toContain("conformité garantie"); });
  it("67. doc ne contient pas '80k scale proven'", () => { expect(doc.toLowerCase()).not.toContain("80k scale proven"); });
  it("68. doc ne contient pas '80k clients guaranteed'", () => { expect(doc.toLowerCase()).not.toContain("80k clients guaranteed"); });
  it("69. evidence template existe", () => { expect(tpl.length).toBeGreaterThan(0); });
  it("70. evidence mentionne SQL appliqué automatiquement ? non", () => {
    const has = tpl.includes("SQL appliqué automatiquement") && tpl.toLowerCase().includes("non");
    expect(has).toBe(true);
  });
  it("71. evidence mentionne Route POST persistence créée ? non", () => {
    expect(tpl).toContain("Route POST persistence créée");
  });
  it("72. evidence mentionne DB write effectué ? non", () => {
    expect(tpl).toContain("DB write effectué");
  });
  it("73. evidence mentionne Mission créée en base ? non", () => {
    expect(tpl).toContain("Mission créée en base");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Exports + package + invariants
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.4 — Exports + package + invariants", () => {
  it("74. index exports persistence types", () => { expect(indexSrc).toContain("RUNTIME_MISSION_DRAFT_TABLE_NAME"); });
  it("75. index exports persistence flags", () => { expect(indexSrc).toContain("isRuntimeMissionDraftServerPersistenceEnabled"); });
  it("76. index exports persistence design", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftPersistenceRecord"); });
  it("77. index exports persistence health", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftPersistenceReadiness"); });
  it("78. index exports localstorage design", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftLocalStorageStrategy"); });
  it("79. index exports persistence QA", () => { expect(indexSrc).toContain("buildRuntimeMissionDraftPersistenceQaChecklist"); });
  it("80. package.json contient test:phase4-4", () => { expect(readRootFile("package.json")).toContain("test:phase4-4"); });
  it("81. package.json contient check:runtime-mission-draft-persistence-design", () => {
    expect(readRootFile("package.json")).toContain("check:runtime-mission-draft-persistence-design");
  });
  it("82. aucun fichier P4.4 ne contient import src/lib/pierre", () => {
    ALL_P44.forEach((src) => expect(src).not.toMatch(/from\s+["']@\/lib\/pierre/));
  });
  it("83. aucun fichier P4.4 ne contient openai", () => {
    ALL_P44.forEach((src) => expect(src.toLowerCase()).not.toContain("openai"));
  });
  it("84. aucun fichier P4.4 ne contient anthropic", () => {
    ALL_P44.forEach((src) => expect(src.toLowerCase()).not.toContain("anthropic"));
  });
  it("85. aucun fichier P4.4 ne contient stripe", () => {
    ALL_P44.forEach((src) => expect(src.toLowerCase()).not.toContain("stripe"));
  });
  it("86. /profile/messages ne fait pas de POST direct mission-draft persistence", () => {
    // PHASE 4.4 : aucune persistance.
    // PHASE 4.5 : la page utilise persistRuntimeMissionDraftWithFallback (safe apply
    //             localStorage-first via l'API client), JAMAIS un fetch POST direct
    //             vers la route mission-drafts. L'invariant — aucun POST direct depuis
    //             la page — reste vrai.
    expect(messagesSrc).not.toMatch(/fetch\s*\([^)]*mission-drafts/s);
  });
  it("87. /profile/messages ne contient pas localStorage.setItem pour mission draft", () => {
    expect(messagesSrc).not.toContain("runtimeMissionDrafts.local.v1");
  });
  it("88. /profile/messages ne contient pas Supabase createClient", () => {
    expect(messagesSrc).not.toMatch(/createClient\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  simulateCloneOSToPierreRuntimePlan,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionDraftPersistenceRecord,
  buildRuntimeMissionDraftPersistenceSafetyFlags,
  buildRuntimeMissionDraftPersistenceWritePlan,
  buildRuntimeMissionDraftPersistenceReadPlan,
  validateRuntimeMissionDraftPersistenceRecord,
  buildRuntimeMissionDraftPersistenceHealthChecklist,
  buildRuntimeMissionDraftPersistenceExpectedSqlChecks,
  buildRuntimeMissionDraftLocalStorageStrategy,
  isRuntimeMissionDraftServerPersistenceEnabled,
  buildRuntimeMissionDraftPersistenceQaChecklist,
  buildRuntimeMissionDraftPersistenceQaVerdict,
} from "@/lib/clonestore/runtime-integration";

function draftFrom(text: string) {
  const result = simulateCloneOSToPierreRuntimePlan({ raw_text: text, company_id: "co_1" });
  return buildRuntimeMissionDraftFromIntegrationResult(result);
}

describe("PHASE 4.4 — Tests fonctionnels", () => {
  it("117. record mappe un draft safe", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const record = buildRuntimeMissionDraftPersistenceRecord(draft, { user_id: "u1" });
    expect(record.table_name).toBe("clonestore_runtime_mission_drafts");
    expect(record.payload.draft_id).toBe(draft.draft_id);
    expect(record.db_write_performed).toBe(false);
    expect(validateRuntimeMissionDraftPersistenceRecord(record).valid).toBe(true);
  });

  it("118. safety flags tous false", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const flags = buildRuntimeMissionDraftPersistenceSafetyFlags(draft);
    expect(Object.values(flags).every((v) => v === false)).toBe(true);
  });

  it("119. write plan sans user_id → blocked", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const plan = buildRuntimeMissionDraftPersistenceWritePlan({ ...draft, user_id: undefined });
    expect(plan.status).toBe("blocked");
    expect(plan.blocking).toBe(true);
    expect(plan.db_write_performed).toBe(false);
  });

  it("120. write plan avec flag false → awaiting_flag", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const plan = buildRuntimeMissionDraftPersistenceWritePlan(draft, { user_id: "u1" });
    // Flag default false → awaiting_flag (sauf si env var active, improbable en test)
    if (!isRuntimeMissionDraftServerPersistenceEnabled()) {
      expect(plan.status).toBe("awaiting_flag");
    }
    expect(plan.db_write_performed).toBe(false);
  });

  it("121. write plan dit db_write_performed false", () => {
    const draft = draftFrom("Préparer onboarding salarié");
    const plan = buildRuntimeMissionDraftPersistenceWritePlan(draft, { user_id: "u1" });
    expect(plan.db_write_performed).toBe(false);
    expect(plan.api_execution_enabled).toBe(false);
  });

  it("122. health checklist inclut table/RLS/policies/constraints/indexes", () => {
    const checklist = buildRuntimeMissionDraftPersistenceHealthChecklist();
    const ids = checklist.map((c) => c.id);
    expect(ids).toContain("table_exists");
    expect(ids).toContain("rls_enabled");
    expect(ids).toContain("policies");
    expect(ids).toContain("safety_constraints");
    expect(ids).toContain("indexes");
    const sqlChecks = buildRuntimeMissionDraftPersistenceExpectedSqlChecks();
    expect(sqlChecks.length).toBe(5);
  });

  it("123. localStorage strategy = localStorage-first future flow", () => {
    const strategy = buildRuntimeMissionDraftLocalStorageStrategy();
    expect(strategy.localstorage_first).toBe(true);
    expect(strategy.writes_in_p4_4).toBe(false);
    expect(strategy.future_flow.length).toBeGreaterThan(0);
  });

  it("124. QA checklist 25 étapes, verdict pending safe", () => {
    const checklist = buildRuntimeMissionDraftPersistenceQaChecklist();
    expect(checklist.total).toBe(25);
    expect(checklist.phase).toBe("4.4");
    const summary = buildRuntimeMissionDraftPersistenceQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("read plan : localStorage-first, db_read_performed false", () => {
    const plan = buildRuntimeMissionDraftPersistenceReadPlan({ user_id: "u1" });
    expect(plan.localstorage_first).toBe(true);
    expect(plan.db_read_performed).toBe(false);
  });

  it("flag default false (env non défini en test)", () => {
    expect(isRuntimeMissionDraftServerPersistenceEnabled()).toBe(false);
  });
});
