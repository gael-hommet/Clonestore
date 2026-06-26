// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-draft-manual-activation-qa-phase4-6.test.ts
// PHASE 4.6 — Runtime Mission Draft Manual Activation QA — Tests

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
function readDocs(name: string): string {
  const full = resolve(ROOT, "docs", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readTemplate(name: string): string {
  const full = resolve(ROOT, "docs/templates", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readScript(name: string): string {
  const full = resolve(ROOT, "scripts", name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}
function readRoot(name: string): string {
  const full = resolve(ROOT, name);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

const modulePath = `${RI_DIR}/runtime-mission-draft-manual-activation-qa.ts`;
const moduleSrc = readSrc(modulePath);
const scriptSrc = readScript("check-runtime-mission-draft-manual-activation-qa.mjs");
const indexSrc = readSrc(`${RI_DIR}/index.ts`);

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.6 — Module Manual Activation QA", () => {
  it("1. runtime-mission-draft-manual-activation-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", modulePath))).toBe(true);
  });
  it("2. module contient buildRuntimeMissionDraftManualActivationChecklist", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftManualActivationChecklist");
  });
  it("3. module contient buildRuntimeMissionDraftManualActivationVerdict", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftManualActivationVerdict");
  });
  it("4. module contient buildRuntimeMissionDraftManualActivationEvidenceTemplate", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftManualActivationEvidenceTemplate");
  });
  it("5. module contient validateRuntimeMissionDraftManualActivationEvidencePack", () => {
    expect(moduleSrc).toContain("validateRuntimeMissionDraftManualActivationEvidencePack");
  });

  const stepIds = [
    "runtime_mission_draft_sql_file_reviewed",
    "runtime_mission_draft_sql_applied_manually",
    "runtime_mission_draft_table_exists",
    "runtime_mission_draft_rls_enabled",
    "runtime_mission_draft_select_policy_exists",
    "runtime_mission_draft_insert_policy_exists",
    "runtime_mission_draft_update_policy_exists",
    "runtime_mission_draft_no_delete_policy",
    "runtime_mission_draft_constraints_verified",
    "runtime_mission_draft_indexes_verified",
    "runtime_mission_draft_flag_disabled_before_test",
    "runtime_mission_draft_post_returns_423_when_disabled",
    "runtime_mission_draft_localstorage_save_works",
    "runtime_mission_draft_localstorage_restore_works",
    "runtime_mission_draft_flag_enabled_for_local_test",
    "runtime_mission_draft_server_post_returns_200",
    "runtime_mission_draft_server_row_created",
    "runtime_mission_draft_safety_flags_false",
    "runtime_mission_draft_no_real_mission_created",
    "runtime_mission_draft_no_execution_started",
    "runtime_mission_draft_no_pierre_engine_called",
    "runtime_mission_draft_no_ai_call",
    "runtime_mission_draft_no_email_or_document",
    "runtime_mission_draft_rollback_flag_disabled",
    "runtime_mission_draft_post_returns_423_after_rollback",
    "runtime_mission_draft_localstorage_still_works_after_rollback",
    "runtime_mission_draft_no_service_role_detected",
    "runtime_mission_draft_scale_80k_not_proven",
    "public_launch_external_not_validated",
  ];
  stepIds.forEach((id, idx) => {
    it(`${6 + idx}. checklist contient ${id}`, () => {
      expect(moduleSrc).toContain(id);
    });
  });

  it("35. module ne contient pas Supabase createClient", () => {
    expect(moduleSrc).not.toMatch(/createClient\s*\(/);
    expect(moduleSrc).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
  });
  it("36. module ne contient pas .insert(", () => { expect(moduleSrc).not.toContain(".insert("); });
  it("37. module ne contient pas .update(", () => { expect(moduleSrc).not.toContain(".update("); });
  it("38. module ne contient pas .delete(", () => { expect(moduleSrc).not.toContain(".delete("); });
  it("39. module ne contient pas .upsert(", () => { expect(moduleSrc).not.toContain(".upsert("); });
  it("40. module ne contient pas import src/lib/pierre", () => {
    expect(moduleSrc).not.toMatch(/from\s+["']@\/lib\/pierre/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Script
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.6 — Script guidance", () => {
  it("41. script existe", () => {
    expect(existsSync(resolve(ROOT, "scripts", "check-runtime-mission-draft-manual-activation-qa.mjs"))).toBe(true);
  });
  it("42. script contient check:runtime-mission-draft-manual-activation-qa", () => {
    expect(scriptSrc).toContain("check:runtime-mission-draft-manual-activation-qa");
  });
  it("43. script contient clonestore_runtime_mission_drafts", () => {
    expect(scriptSrc).toContain("clonestore_runtime_mission_drafts");
  });
  it("44. script contient information_schema.tables", () => {
    expect(scriptSrc).toContain("information_schema.tables");
  });
  it("45. script contient pg_policies", () => { expect(scriptSrc).toContain("pg_policies"); });
  it("46. script contient pg_constraint", () => { expect(scriptSrc).toContain("pg_constraint"); });
  it("47. script contient pg_indexes", () => { expect(scriptSrc).toContain("pg_indexes"); });
  it("48. script contient POST 423", () => { expect(scriptSrc).toContain("POST 423"); });
  it("49. script contient safety_flags", () => { expect(scriptSrc).toContain("safety_flags"); });
  it("50. script contient test:phase4-6", () => { expect(scriptSrc).toContain("test:phase4-6"); });
  it("51. script ne contient pas .insert(", () => { expect(scriptSrc).not.toContain(".insert("); });
  it("52. script ne contient pas .update(", () => { expect(scriptSrc).not.toContain(".update("); });
  it("53. script ne contient pas .delete(", () => { expect(scriptSrc).not.toContain(".delete("); });
  it("54. script ne contient pas .upsert(", () => { expect(scriptSrc).not.toContain(".upsert("); });
  it("55. script ne contient pas fetch POST", () => {
    expect(scriptSrc).not.toMatch(/fetch\s*\([^)]*method:\s*["']POST["']/s);
  });
  it("56. script ne contient pas writeFile", () => { expect(scriptSrc).not.toContain("writeFile"); });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Evidence template
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.6 — Evidence template", () => {
  const tpl = readTemplate("PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_EVIDENCE.md");
  it("57. evidence template existe", () => { expect(tpl.length).toBeGreaterThan(0); });
  it("58. evidence mentionne SQL P4.4 appliqué manuellement", () => {
    expect(tpl).toContain("SQL P4.4 appliqué manuellement");
  });
  it("59. evidence mentionne POST avant activation : 423", () => {
    const has = tpl.includes("POST avant activation") && tpl.includes("423");
    expect(has).toBe(true);
  });
  it("60. evidence mentionne POST après activation", () => {
    expect(tpl).toContain("POST après activation");
  });
  it("61. evidence mentionne safety_flags tous false", () => {
    expect(tpl).toContain("safety_flags tous false");
  });
  it("62. evidence mentionne Mission réelle créée ? non", () => {
    expect(tpl).toContain("Mission réelle créée");
  });
  it("63. evidence mentionne Rollback flag false", () => {
    expect(tpl).toContain("Rollback flag false");
  });
  it("64. evidence mentionne localStorage restore après rollback", () => {
    expect(tpl).toContain("localStorage restore après rollback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.6 — Documentation", () => {
  const doc = readDocs("PHASE_4_6_RUNTIME_MISSION_DRAFT_MANUAL_ACTIVATION_QA.md");
  it("65. doc P4.6 existe", () => { expect(doc.length).toBeGreaterThan(0); });
  it("66. doc mentionne P4.6", () => { expect(doc).toContain("4.6"); });
  it("67. doc mentionne Manual Activation QA", () => { expect(doc).toContain("Manual Activation QA"); });
  it("68. doc mentionne clonestore_runtime_mission_drafts", () => { expect(doc).toContain("clonestore_runtime_mission_drafts"); });
  it("69. doc mentionne POST 423", () => { expect(doc).toContain("POST 423"); });
  it("70. doc mentionne POST 200", () => { expect(doc).toContain("POST 200"); });
  it("71. doc mentionne CAS A", () => { expect(doc).toContain("CAS A"); });
  it("72. doc mentionne CAS B", () => { expect(doc).toContain("CAS B"); });
  it("73. doc mentionne CAS C", () => { expect(doc).toContain("CAS C"); });
  it("74. doc mentionne CAS D", () => { expect(doc).toContain("CAS D"); });
  it("75. doc mentionne rollback", () => { expect(doc.toLowerCase()).toContain("rollback"); });
  it("76. doc mentionne PHASE 4.7", () => { expect(doc).toContain("4.7"); });
  it("77. doc ne contient pas phrase de lancement public interdite", () => { expect(doc.toLowerCase()).not.toContain("public launch go"); });
  it("78. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("79. doc ne contient pas 'conformité garantie'", () => { expect(doc.toLowerCase()).not.toContain("conformité garantie"); });
  it("80. doc ne contient pas '80k scale proven'", () => { expect(doc.toLowerCase()).not.toContain("80k scale proven"); });
  it("81. doc ne contient pas '80k clients guaranteed'", () => { expect(doc.toLowerCase()).not.toContain("80k clients guaranteed"); });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Exports + package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.6 — Exports + package", () => {
  it("82. index exports manual activation QA", () => {
    expect(indexSrc).toContain("buildRuntimeMissionDraftManualActivationChecklist");
  });
  it("83. package.json contient test:phase4-6", () => {
    expect(readRoot("package.json")).toContain("test:phase4-6");
  });
  it("84. package.json contient check:runtime-mission-draft-manual-activation-qa", () => {
    expect(readRoot("package.json")).toContain("check:runtime-mission-draft-manual-activation-qa");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildRuntimeMissionDraftManualActivationChecklist,
  buildRuntimeMissionDraftManualActivationVerdict,
  buildRuntimeMissionDraftManualActivationEvidenceTemplate,
  validateRuntimeMissionDraftManualActivationEvidencePack,
  getRuntimeMissionDraftManualActivationBlockingSteps,
  summarizeRuntimeMissionDraftManualActivationVerdict,
} from "@/lib/clonestore/runtime-integration";

describe("PHASE 4.6 — Tests fonctionnels", () => {
  it("115. checklist a au moins 32 étapes", () => {
    const checklist = buildRuntimeMissionDraftManualActivationChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(32);
    expect(checklist.phase).toBe("4.6");
    expect(checklist.table_name).toBe("clonestore_runtime_mission_drafts");
  });

  it("116. blocking steps incluent SQL/table/RLS/policies/constraints", () => {
    const blocking = getRuntimeMissionDraftManualActivationBlockingSteps();
    const ids = blocking.map((s) => s.id);
    expect(ids).toContain("runtime_mission_draft_sql_applied_manually");
    expect(ids).toContain("runtime_mission_draft_table_exists");
    expect(ids).toContain("runtime_mission_draft_rls_enabled");
    expect(ids).toContain("runtime_mission_draft_select_policy_exists");
    expect(ids).toContain("runtime_mission_draft_constraints_verified");
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("117. evidence template valide avec pack minimal pending", () => {
    const pack = buildRuntimeMissionDraftManualActivationEvidenceTemplate();
    expect(pack.verdict).toBe("PENDING");
    expect(pack.environment).toBe("local");
    const result = validateRuntimeMissionDraftManualActivationEvidencePack(pack);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("118. verdict blocked si blocking failed", () => {
    const checklist = buildRuntimeMissionDraftManualActivationChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "runtime_mission_draft_table_exists" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildRuntimeMissionDraftManualActivationVerdict(withFail);
    expect(summary.verdict).toBe("blocked");
    expect(summary.safe_to_activate).toBe(false);
  });

  it("119. verdict passed si toutes les étapes passées", () => {
    const checklist = buildRuntimeMissionDraftManualActivationChecklist();
    const allPassed = checklist.steps.map((s) => ({ ...s, status: "passed" as const }));
    const summary = buildRuntimeMissionDraftManualActivationVerdict(allPassed);
    expect(summary.verdict).toBe("passed");
  });

  it("verdict ready_for_manual_activation si tout pending", () => {
    const checklist = buildRuntimeMissionDraftManualActivationChecklist();
    const summary = buildRuntimeMissionDraftManualActivationVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready_for_manual_activation");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("summarize contient PHASE 4.6", () => {
    const checklist = buildRuntimeMissionDraftManualActivationChecklist();
    const summary = buildRuntimeMissionDraftManualActivationVerdict(checklist.steps);
    expect(summarizeRuntimeMissionDraftManualActivationVerdict(summary)).toContain("PHASE 4.6");
  });
});
