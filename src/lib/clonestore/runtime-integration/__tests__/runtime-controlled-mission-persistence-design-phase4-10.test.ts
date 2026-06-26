// src/lib/clonestore/runtime-integration/__tests__/runtime-controlled-mission-persistence-design-phase4-10.test.ts
// PHASE 4.10 — Controlled Mission Governed Persistence Design — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  buildRuntimeControlledMissionPersistenceRecord,
  buildRuntimeControlledMissionPersistenceWritePlan,
  buildRuntimeControlledMissionPersistenceHealthChecklist,
  buildRuntimeControlledMissionLocalStorageStrategy,
  buildRuntimeControlledMissionPersistenceQaChecklist,
  buildRuntimeControlledMissionPersistenceQaVerdict,
  validateRuntimeControlledMissionPersistenceRecord,
  DEFAULT_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
} from "@/lib/clonestore/runtime-integration";

const ROOT = resolve(__dirname, "../../../../..");
const RI_DIR = "lib/clonestore/runtime-integration";

function readSrc(rel: string): string {
  const full = resolve(ROOT, "src", rel);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readRootFile(rel: string): string {
  const full = resolve(ROOT, rel);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readDocs(name: string): string {
  return readRootFile(`docs/${name}`);
}
function readTemplate(name: string): string {
  return readRootFile(`docs/templates/${name}`);
}

const sqlSrc = readRootFile("supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql");
const sqlLower = sqlSrc.toLowerCase();
const typesSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-persistence-types.ts`);
const flagsSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-persistence-flags.ts`);
const designSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-persistence-design.ts`);
const healthSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-persistence-health.ts`);
const lsSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-localstorage-design.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-persistence-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const scriptSrc = readRootFile("scripts/check-runtime-controlled-mission-persistence-design.mjs");
const docSrc = readDocs("PHASE_4_10_CONTROLLED_MISSION_GOVERNED_PERSISTENCE_DESIGN.md");
const docLower = docSrc.toLowerCase();
const evidenceSrc = readTemplate("PHASE_4_10_CONTROLLED_MISSION_PERSISTENCE_DESIGN_EVIDENCE.md");
const packageJson = readRootFile("package.json");
const pageSrc = readSrc("app/profile/messages/page.tsx");

const allP410Modules = [typesSrc, flagsSrc, designSrc, healthSrc, lsSrc, qaSrc].join("\n");
// Le module QA nomme volontairement les fournisseurs interdits (étapes no_openai_call, etc.).
// Le scan "aucun appel fournisseur" porte donc sur les modules hors QA.
const providerScanModules = [typesSrc, flagsSrc, designSrc, healthSrc, lsSrc].join("\n").toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — SQL draft
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — SQL draft", () => {
  it("1. SQL draft existe", () => expect(sqlSrc.length).toBeGreaterThan(0));
  it("2. SQL contient clonestore_controlled_mission_candidates", () => expect(sqlSrc).toContain("clonestore_controlled_mission_candidates"));
  it("3. SQL contient enable row level security", () => expect(sqlLower).toContain("enable row level security"));
  it("4. SQL contient select policy", () => expect(sqlLower).toContain("for select"));
  it("5. SQL contient insert policy", () => expect(sqlLower).toContain("for insert"));
  it("6. SQL contient update policy", () => expect(sqlLower).toContain("for update"));
  it("7. SQL ne contient pas delete policy", () => expect(sqlLower).not.toContain("for delete"));
  it("8. SQL contient promotion_applied", () => expect(sqlSrc).toContain("promotion_applied"));
  it("9. SQL contient controlled_mission_created", () => expect(sqlSrc).toContain("controlled_mission_created"));
  it("10. SQL contient mission_created", () => expect(sqlSrc).toContain("mission_created"));
  it("11. SQL contient execution_enabled", () => expect(sqlSrc).toContain("execution_enabled"));
  it("12. SQL contient execution_started", () => expect(sqlSrc).toContain("execution_started"));
  it("13. SQL contient human_validation_required", () => expect(sqlSrc).toContain("human_validation_required"));
  it("14. SQL contient preview_only", () => expect(sqlSrc).toContain("preview_only"));
  it("15. SQL contient read_only", () => expect(sqlSrc).toContain("read_only"));
  it("16. SQL contient pierre_engine_called", () => expect(sqlSrc).toContain("pierre_engine_called"));
  it("17. SQL contient ai_call_performed", () => expect(sqlSrc).toContain("ai_call_performed"));
  it("18. SQL contient clonevoice_active", () => expect(sqlSrc).toContain("clonevoice_active"));
  it("19. SQL contient public_launch_external_validated", () => expect(sqlSrc).toContain("public_launch_external_validated"));
  it("20. SQL contient index user_id", () => expect(sqlSrc).toContain("idx_controlled_mission_candidate_user_id"));
  it("21. SQL contient index company_id", () => expect(sqlSrc).toContain("idx_controlled_mission_candidate_company_id"));
  it("22. SQL contient index candidate_id", () => expect(sqlSrc).toContain("idx_controlled_mission_candidate_candidate_id"));
  it("23. SQL contient index promotion_id", () => expect(sqlSrc).toContain("idx_controlled_mission_candidate_promotion_id"));
  it("24. SQL contient index updated_at", () => expect(sqlSrc).toContain("idx_controlled_mission_candidate_updated_at"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Modules présents + flags + design + health + localstorage + QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — Modules", () => {
  it("25. persistence types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("26. persistence flags existe", () => expect(flagsSrc.length).toBeGreaterThan(0));
  it("27. persistence design existe", () => expect(designSrc.length).toBeGreaterThan(0));
  it("28. persistence health existe", () => expect(healthSrc.length).toBeGreaterThan(0));
  it("29. localstorage design existe", () => expect(lsSrc.length).toBeGreaterThan(0));
  it("30. persistence QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("31. flags contient le flag key", () => expect(flagsSrc).toContain("NEXT_PUBLIC_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED"));
  it("32. flags default false", () => expect(DEFAULT_RUNTIME_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("33. design contient buildRuntimeControlledMissionPersistenceRecord", () => expect(designSrc).toContain("buildRuntimeControlledMissionPersistenceRecord"));
  it("34. design contient buildRuntimeControlledMissionPersistenceWritePlan", () => expect(designSrc).toContain("buildRuntimeControlledMissionPersistenceWritePlan"));
  it("35. design contient db_write_performed false", () => expect(designSrc).toContain("db_write_performed: false"));
  it("36. design contient promotion_applied false", () => expect(designSrc).toContain("promotion_applied: false"));
  it("37. design contient mission_created false", () => expect(designSrc).toContain("mission_created: false"));
  it("38. design contient execution_enabled false", () => expect(designSrc).toContain("execution_enabled: false"));
  it("39. design ne contient pas createClient", () => expect(designSrc).not.toContain("createClient"));
  it("40. design ne contient pas fetch", () => expect(designSrc).not.toContain("fetch"));
  it("41. design ne contient pas .insert(", () => expect(designSrc).not.toContain(".insert("));
  it("42. design ne contient pas .upsert(", () => expect(designSrc).not.toContain(".upsert("));
  it("43. health contient information_schema.tables", () => expect(healthSrc).toContain("information_schema.tables"));
  it("44. health contient pg_policies", () => expect(healthSrc).toContain("pg_policies"));
  it("45. health contient pg_constraint", () => expect(healthSrc).toContain("pg_constraint"));
  it("46. health contient pg_indexes", () => expect(healthSrc).toContain("pg_indexes"));
  it("47. localstorage design contient la clé", () => expect(lsSrc).toContain("clonestore.runtimeControlledMissions.local.v1"));
  it("48. localstorage design ne contient pas localStorage.setItem", () => expect(lsSrc).not.toContain("localStorage.setItem"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Script read-only
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — Script read-only", () => {
  it("49. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("50. script contient check:runtime-controlled-mission-persistence-design", () => expect(scriptSrc).toContain("check:runtime-controlled-mission-persistence-design"));
  it("51. script contient test:phase4-10", () => expect(scriptSrc).toContain("test:phase4-10"));
  it("52. script ne contient pas .insert(", () => expect(scriptSrc).not.toContain(".insert("));
  it("53. script ne contient pas .update(", () => expect(scriptSrc).not.toContain(".update("));
  it("54. script ne contient pas .delete(", () => expect(scriptSrc).not.toContain(".delete("));
  it("55. script ne contient pas .upsert(", () => expect(scriptSrc).not.toContain(".upsert("));
  it("56. script ne contient pas fetch POST", () => expect(scriptSrc).not.toContain("fetch"));
  it("57. script ne contient pas writeFile", () => expect(scriptSrc).not.toContain("writeFile"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — QA module", () => {
  it("58. QA contient buildRuntimeControlledMissionPersistenceQaChecklist", () => expect(qaSrc).toContain("buildRuntimeControlledMissionPersistenceQaChecklist"));
  it("59. QA contient no_sql_auto_apply", () => expect(qaSrc).toContain("no_sql_auto_apply"));
  it("60. QA contient no_env_auto_change", () => expect(qaSrc).toContain("no_env_auto_change"));
  it("61. QA contient no_db_write", () => expect(qaSrc).toContain("no_db_write"));
  it("62. QA contient no_api_post", () => expect(qaSrc).toContain("no_api_post"));
  it("63. QA contient no_real_mission_created", () => expect(qaSrc).toContain("no_real_mission_created"));
  it("64. QA contient promotion_not_applied", () => expect(qaSrc).toContain("promotion_not_applied"));
  it("65. QA contient human_validation_required", () => expect(qaSrc).toContain("human_validation_required"));
  it("66. QA contient cloneguard_preserved", () => expect(qaSrc).toContain("cloneguard_preserved"));
  it("67. QA contient clonetrace_preserved", () => expect(qaSrc).toContain("clonetrace_preserved"));
  it("68. QA contient public_launch_external_not_validated", () => expect(qaSrc).toContain("public_launch_external_not_validated"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Documentation & evidence
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — Documentation & evidence", () => {
  it("69. doc P4.10 existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("70. doc mentionne P4.10", () => expect(docSrc).toContain("4.10"));
  it("71. doc mentionne SQL draft", () => expect(docLower).toContain("sql draft"));
  it("72. doc mentionne clonestore_controlled_mission_candidates", () => expect(docSrc).toContain("clonestore_controlled_mission_candidates"));
  it("73. doc mentionne feature flag", () => expect(docLower).toContain("feature flag"));
  it("74. doc mentionne localStorage-first", () => expect(docSrc).toContain("localStorage-first"));
  it("75. doc mentionne aucun POST de persistance", () => expect(docLower).toContain("aucun post de persistance"));
  it("76. doc mentionne aucune mission réelle créée", () => expect(docLower).toContain("aucune mission réelle créée"));
  it("77. doc mentionne promotion_applied false", () => expect(docSrc).toContain("promotion_applied false"));
  it("78. doc mentionne human_validation_required true", () => expect(docSrc).toContain("human_validation_required true"));
  it("79. doc mentionne scale 80k non prouvé", () => expect(docLower).toContain("scale 80k non prouvé"));
  it("80. doc mentionne PHASE 4.11", () => expect(docSrc).toContain("PHASE 4.11"));
  it("81. doc sans phrase anglaise de lancement public", () => expect(docLower).not.toContain("public launch"));
  it("82. doc sans zéro erreur", () => expect(docLower).not.toContain("zéro erreur"));
  it("83. doc sans conformité garantie", () => expect(docLower).not.toContain("conformité garantie"));
  it("84. doc sans 80k scale proven", () => expect(docLower).not.toContain("80k scale proven"));
  it("85. doc sans 80k clients guaranteed", () => expect(docLower).not.toContain("80k clients guaranteed"));
  it("86. evidence template existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("87. evidence mentionne SQL appliqué automatiquement ? non", () => expect(evidenceSrc).toContain("SQL appliqué automatiquement ? non"));
  it("88. evidence mentionne Route POST persistence créée ? non", () => expect(evidenceSrc).toContain("Route POST persistence créée ? non"));
  it("89. evidence mentionne DB write effectué ? non", () => expect(evidenceSrc).toContain("DB write effectué ? non"));
  it("90. evidence mentionne Mission réelle créée en base ? non", () => expect(evidenceSrc).toContain("Mission réelle créée en base ? non"));
  it("91. evidence mentionne Promotion appliquée ? non", () => expect(evidenceSrc).toContain("Promotion appliquée ? non"));
  it("92. evidence mentionne Human validation required ? oui", () => expect(evidenceSrc).toContain("Human validation required ? oui"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Index exports + package + pureté inter-fichiers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — Index, package & pureté", () => {
  it("93. index exports persistence types", () => expect(indexSrc).toContain("RUNTIME_CONTROLLED_MISSION_TABLE_NAME"));
  it("94. index exports persistence flags", () => expect(indexSrc).toContain("isRuntimeControlledMissionServerPersistenceEnabled"));
  it("95. index exports persistence design", () => expect(indexSrc).toContain("buildRuntimeControlledMissionPersistenceRecord"));
  it("96. index exports persistence health", () => expect(indexSrc).toContain("buildRuntimeControlledMissionPersistenceReadiness"));
  it("97. index exports localstorage design", () => expect(indexSrc).toContain("buildRuntimeControlledMissionLocalStorageStrategy"));
  it("98. index exports persistence QA", () => expect(indexSrc).toContain("buildRuntimeControlledMissionPersistenceQaChecklist"));
  it("99. package.json contient test:phase4-10", () => expect(packageJson).toContain("test:phase4-10"));
  it("100. package.json contient check script", () => expect(packageJson).toContain("check:runtime-controlled-mission-persistence-design"));
  it("101. aucun module P4.10 n'importe src/lib/pierre", () => expect(allP410Modules).not.toContain("lib/pierre"));
  it("102. aucun module P4.10 (hors QA) n'appelle openai", () => expect(providerScanModules).not.toContain("openai"));
  it("103. aucun module P4.10 (hors QA) n'appelle anthropic", () => expect(providerScanModules).not.toContain("anthropic"));
  it("104. aucun module P4.10 (hors QA) n'appelle stripe", () => expect(providerScanModules).not.toContain("stripe"));
  it("105. /profile/messages ne contient pas de persistance candidate (POST)", () => expect(pageSrc).not.toContain("clonestore_controlled_mission_candidates"));
  it("106. /profile/messages ne contient pas localStorage candidate", () => expect(pageSrc).not.toContain("runtimeControlledMissions"));
  it("107. /profile/messages ne contient pas createClient", () => expect(pageSrc).not.toContain("createClient"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Cascade intacte (still pass / not broken)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-9", "test:phase4-8", "test:phase4-7", "test:phase4-6", "test:phase4-5",
    "test:phase4-4", "test:phase4-3", "test:phase4-2", "test:phase4-1",
    "test:phase3-22", "test:phase3-21", "test:phase3-20", "test:phase3-19", "test:phase3-18",
    "test:phase3-17", "test:phase3-16", "test:phase3-15", "test:phase3-14", "test:phase3-13",
    "test:phase3-12", "test:phase3-11", "test:phase3-10", "test:phase3-9", "test:phase3-8",
    "test:phase3-7", "test:phase3-6", "test:phase3-5", "test:phase3-4", "test:phase3-3",
    "test:phase3-2", "test:phase3-1", "test:phase2-9", "test:tech11", "test:pfinal02",
  ];
  scripts.forEach((script, idx) => {
    it(`${108 + idx}. ${script} encore présent`, () => {
      expect(packageJson).toContain(`"${script}"`);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.10 — Fonctionnels", () => {
  const result = buildRuntimeIntegrationReadResult({
    raw_text: "Rédige une fiche de poste pour un développeur back-end",
  });
  const draft = buildRuntimeMissionDraftFromIntegrationResult(result);
  const contract = buildRuntimeMissionPromotionContract(draft);

  it("142. buildRecord mappe un contrat sûr", () => {
    const record = buildRuntimeControlledMissionPersistenceRecord(contract, { user_id: "user-1" });
    expect(record.payload.candidate_id).toContain("cand_");
    expect(record.db_write_performed).toBe(false);
    expect(record.table_name).toBe("clonestore_controlled_mission_candidates");
    expect(validateRuntimeControlledMissionPersistenceRecord(record).valid).toBe(true);
  });

  it("143. safety flags : promotion_applied false", () => {
    const record = buildRuntimeControlledMissionPersistenceRecord(contract, { user_id: "user-1" });
    expect(record.safety_flags.promotion_applied).toBe(false);
    expect(record.promotion_applied).toBe(false);
  });

  it("144. safety flags : human_validation_required true", () => {
    const record = buildRuntimeControlledMissionPersistenceRecord(contract, { user_id: "user-1" });
    expect(record.safety_flags.requires_human_validation).toBe(true);
    expect(record.human_validation_required).toBe(true);
  });

  it("145. write plan sans user_id → blocked", () => {
    const plan = buildRuntimeControlledMissionPersistenceWritePlan(contract, {});
    expect(plan.status).toBe("blocked");
    expect(plan.blocking).toBe(true);
  });

  it("146. write plan avec flag false → awaiting_flag", () => {
    const plan = buildRuntimeControlledMissionPersistenceWritePlan(contract, { user_id: "user-1" });
    expect(plan.status).toBe("awaiting_flag");
  });

  it("147. write plan db_write_performed false", () => {
    const plan = buildRuntimeControlledMissionPersistenceWritePlan(contract, { user_id: "user-1" });
    expect(plan.db_write_performed).toBe(false);
  });

  it("148. health checklist couvre table/RLS/policies/constraints/indexes", () => {
    const ids = buildRuntimeControlledMissionPersistenceHealthChecklist().map((c) => c.id);
    expect(ids).toContain("table_exists");
    expect(ids).toContain("rls_enabled");
    expect(ids).toContain("policies");
    expect(ids).toContain("governed_constraints");
    expect(ids).toContain("indexes");
  });

  it("149. stratégie localStorage = localStorage-first future flow", () => {
    const strategy = buildRuntimeControlledMissionLocalStorageStrategy();
    expect(strategy.localstorage_first).toBe(true);
    expect(strategy.writes_in_p4_10).toBe(false);
    expect(strategy.future_flow.length).toBeGreaterThan(0);
  });

  it("150. QA checklist total cohérent + verdict pending safe", () => {
    const checklist = buildRuntimeControlledMissionPersistenceQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(34);
    expect(checklist.phase).toBe("4.10");
    const summary = buildRuntimeControlledMissionPersistenceQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.design_only).toBe(true);
  });

  it("151. script check s'exécute en lecture seule (PASS)", () => {
    const out = execSync("node scripts/check-runtime-controlled-mission-persistence-design.mjs", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(out).toContain("RÉSULTAT : PASS");
  });
});
