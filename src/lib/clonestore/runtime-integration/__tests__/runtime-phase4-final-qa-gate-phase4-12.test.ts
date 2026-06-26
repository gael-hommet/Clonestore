// src/lib/clonestore/runtime-integration/__tests__/runtime-phase4-final-qa-gate-phase4-12.test.ts
// PHASE 4.12 — Phase 4 Final QA Gate / Runtime Closure — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimePhase4FinalQaGate,
  evaluateRuntimePhase4FinalQaGate,
  getRuntimePhase4FinalQaVerdict,
  assertRuntimePhase4FinalQaNoExecution,
  assertRuntimePhase4FinalQaClosureSafe,
  summarizeRuntimePhase4FinalQaGate,
  buildRuntimePhase4FinalQaSnapshot,
  buildRuntimePhase4FinalQaBadges,
  buildRuntimePhase4FinalQaTimeline,
  buildRuntimePhase4NextPhasePlan,
  buildRuntimePhase4FinalQaChecklist,
  buildRuntimePhase4FinalQaInvariants,
  buildRuntimePhase4FinalQaBlockRegistry,
  getRuntimePhase4FinalQaExpectedDocs,
  getRuntimePhase4FinalQaExpectedScripts,
  getRuntimePhase4FinalQaForbiddenRoutes,
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
function hasFile(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

const typesSrc = readSrc(`${RI_DIR}/runtime-phase4-final-qa-types.ts`);
const registrySrc = readSrc(`${RI_DIR}/runtime-phase4-final-qa-registry.ts`);
const invariantsSrc = readSrc(`${RI_DIR}/runtime-phase4-final-qa-invariants.ts`);
const gateSrc = readSrc(`${RI_DIR}/runtime-phase4-final-qa-gate.ts`);
const snapshotSrc = readSrc(`${RI_DIR}/runtime-phase4-final-qa-snapshot.ts`);
const nextPlanSrc = readSrc(`${RI_DIR}/runtime-phase4-next-phase-plan.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-phase4-final-qa-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const scriptSrc = readRootFile("scripts/check-runtime-phase4-final-qa-gate.mjs");
const docSrc = readRootFile("docs/PHASE_4_12_PHASE_4_FINAL_QA_GATE_RUNTIME_CLOSURE.md");
const docLower = docSrc.toLowerCase();
const evidenceSrc = readRootFile("docs/templates/PHASE_4_12_PHASE_4_FINAL_QA_GATE_RUNTIME_CLOSURE_EVIDENCE.md");
const packageJson = readRootFile("package.json");

const allP412 = [typesSrc, registrySrc, invariantsSrc, gateSrc, snapshotSrc, nextPlanSrc, qaSrc].join("\n");
const allP412Lower = allP412.toLowerCase();

const gate = buildRuntimePhase4FinalQaGate();

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence des modules / docs / scripts (1-12)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Présence", () => {
  it("1. final QA types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. final QA registry existe", () => expect(registrySrc.length).toBeGreaterThan(0));
  it("3. final QA invariants existe", () => expect(invariantsSrc.length).toBeGreaterThan(0));
  it("4. final QA gate existe", () => expect(gateSrc.length).toBeGreaterThan(0));
  it("5. final QA snapshot existe", () => expect(snapshotSrc.length).toBeGreaterThan(0));
  it("6. next phase plan existe", () => expect(nextPlanSrc.length).toBeGreaterThan(0));
  it("7. final QA QA module existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("8. final check script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("9. docs P4.12 existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("10. evidence P4.12 existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("11. package has test:phase4-12", () => expect(packageJson).toContain("test:phase4-12"));
  it("12. package has check:runtime-phase4-final-qa", () => expect(packageJson).toContain("check:runtime-phase4-final-qa"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Registry (13-23)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Registry", () => {
  const ids = buildRuntimePhase4FinalQaBlockRegistry().map((b) => b.id);
  const docs = getRuntimePhase4FinalQaExpectedDocs();
  const scripts = getRuntimePhase4FinalQaExpectedScripts();
  const forbidden = getRuntimePhase4FinalQaForbiddenRoutes();

  it("13. registry contient phase4_1_runtime_foundation", () => expect(ids).toContain("phase4_1_runtime_foundation"));
  it("14. registry contient phase4_11_human_validation_workflow", () => expect(ids).toContain("phase4_11_human_validation_workflow"));
  it("15. registry contient phase4_12_final_qa_gate", () => expect(ids).toContain("phase4_12_final_qa_gate"));
  it("16. expected docs include P4.1", () => expect(docs.some((d) => d.includes("PHASE_4_1_"))).toBe(true));
  it("17. expected docs include P4.11", () => expect(docs.some((d) => d.includes("PHASE_4_11_"))).toBe(true));
  it("18. expected docs include P4.12", () => expect(docs.some((d) => d.includes("PHASE_4_12_"))).toBe(true));
  it("19. expected scripts include P4.6 check", () => expect(scripts.some((s) => s.includes("manual-activation-qa"))).toBe(true));
  it("20. expected scripts include P4.10 check", () => expect(scripts.some((s) => s.includes("controlled-mission-persistence-design"))).toBe(true));
  it("21. expected scripts include P4.11 check", () => expect(scripts.some((s) => s.includes("human-validation-workflow"))).toBe(true));
  it("22. forbidden routes include controlled-mission-validation route", () => expect(forbidden.some((r) => r.includes("controlled-mission-validation"))).toBe(true));
  it("23. forbidden routes include runtime execute route", () => expect(forbidden.some((r) => r.includes("execute/route.ts"))).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Invariants (24-34)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Invariants", () => {
  const ids = buildRuntimePhase4FinalQaInvariants().map((i) => i.id);
  it("24. invariants include no_real_mission_created", () => expect(ids).toContain("no_real_mission_created"));
  it("25. invariants include no_runtime_execution", () => expect(ids).toContain("no_runtime_execution"));
  it("26. invariants include no_cloneos_execution", () => expect(ids).toContain("no_cloneos_execution"));
  it("27. invariants include no_pierre_engine_call", () => expect(ids).toContain("no_pierre_engine_call"));
  it("28. invariants include no_ai_call", () => expect(ids).toContain("no_ai_call"));
  it("29. invariants include no_clonevoice_activation", () => expect(ids).toContain("no_clonevoice_activation"));
  it("30. invariants include no_sql_auto_apply", () => expect(ids).toContain("no_sql_auto_apply"));
  it("31. invariants include no_env_auto_change", () => expect(ids).toContain("no_env_auto_change"));
  it("32. invariants include no_flag_auto_activation", () => expect(ids).toContain("no_flag_auto_activation"));
  it("33. invariants include no_public_external_launch_validation", () => expect(ids).toContain("no_public_external_launch_validation"));
  it("34. invariants include scale_80k_not_proven", () => expect(ids).toContain("scale_80k_not_proven"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Gate / closure (35-40)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Gate / closure", () => {
  it("35. gate builds phase4_closed verdict", () => expect(gate.verdict).toBe("phase4_closed"));
  it("36. closure ready_for_phase5 true when safe", () => expect(gate.closure.ready_for_phase5).toBe(true));
  it("37. closure public_launch_external_validated false", () => expect(gate.closure.public_launch_external_validated).toBe(false));
  it("38. closure scale_80k_not_proven true", () => expect(gate.closure.scale_80k_not_proven).toBe(true));
  it("39. closure runtime_execution_enabled false", () => expect(gate.closure.runtime_execution_enabled).toBe(false));
  it("40. closure real_mission_created false", () => expect(gate.closure.real_mission_created).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Snapshot / next plan (41-51)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Snapshot & plan", () => {
  const snap = buildRuntimePhase4FinalQaSnapshot(gate);
  const badges = buildRuntimePhase4FinalQaBadges(snap).map((b) => b.label);
  const plan = buildRuntimePhase4NextPhasePlan();
  const planTitles = plan.steps.map((s) => s.title).join(" ");

  it("41. snapshot badges include Phase 4 Final QA", () => expect(badges).toContain("Phase 4 Final QA"));
  it("42. snapshot badges include Runtime Closure", () => expect(badges).toContain("Runtime Closure"));
  it("43. snapshot badges include No real mission", () => expect(badges).toContain("No real mission"));
  it("44. snapshot badges include No-execution", () => expect(badges).toContain("No-execution"));
  it("45. snapshot badges include CloneVoice non actif", () => expect(badges).toContain("CloneVoice non actif"));
  it("46. snapshot badges include Scale 80k non prouvé", () => expect(badges).toContain("Scale 80k non prouvé"));
  it("47. next phase plan includes PHASE 5.1", () => expect(planTitles).toContain("PHASE 5.1"));
  it("48. next phase plan includes Controlled Mission Safe Apply", () => expect(planTitles).toContain("Controlled Mission Safe Apply"));
  it("49. next phase plan includes Human Validation Safe Apply", () => expect(planTitles).toContain("Human Validation Safe Apply"));
  it("50. next phase plan includes Runtime Queue", () => expect(planTitles).toContain("Runtime Queue"));
  it("51. next phase plan is design-only and no execution", () => {
    expect(plan.design_only).toBe(true);
    expect(plan.no_execution).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — QA checklist (52-57)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — QA checklist", () => {
  const stepIds = buildRuntimePhase4FinalQaChecklist().steps.map((s) => s.id);
  it("52. QA checklist includes phase4_1_validated", () => expect(stepIds).toContain("phase4_1_validated"));
  it("53. QA checklist includes phase4_12_gate_exists", () => expect(stepIds).toContain("phase4_12_gate_exists"));
  it("54. QA checklist includes no_real_mission_created", () => expect(stepIds).toContain("no_real_mission_created"));
  it("55. QA checklist includes no_runtime_execution", () => expect(stepIds).toContain("no_runtime_execution"));
  it("56. QA checklist includes no_public_external_launch_validation", () => expect(stepIds).toContain("no_public_external_launch_validation"));
  it("57. QA checklist includes scale_80k_not_proven", () => expect(stepIds).toContain("scale_80k_not_proven"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Script read-only (58-68)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Script read-only", () => {
  it("58. script exists", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("59. script contains PASS", () => expect(scriptSrc).toContain("PASS"));
  it("60. script contains forbidden routes", () => expect(scriptSrc).toContain("controlled-mission-validation"));
  it("61. script contains no write wording", () => expect(scriptSrc.toLowerCase()).toContain("aucune écriture"));
  it("62. script does not contain writeFile", () => expect(scriptSrc).not.toContain("writeFile"));
  it("63. script does not contain appendFile", () => expect(scriptSrc).not.toContain("appendFile"));
  it("64. script does not contain fetch", () => expect(scriptSrc).not.toContain("fetch"));
  it("65. script does not contain .insert(", () => expect(scriptSrc).not.toContain(".insert("));
  it("66. script does not contain .update(", () => expect(scriptSrc).not.toContain(".update("));
  it("67. script does not contain .delete(", () => expect(scriptSrc).not.toContain(".delete("));
  it("68. script does not contain .upsert(", () => expect(scriptSrc).not.toContain(".upsert("));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Routes (69-77)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Routes", () => {
  it("69. forbidden controlled-mission-validation absent", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-mission-validation/route.ts")).toBe(false));
  it("70. forbidden controlled-mission-candidates absent", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-mission-candidates/route.ts")).toBe(false));
  it("71. forbidden controlled-missions absent", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("72. forbidden runtime execute absent", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("73. forbidden promote absent", () => expect(hasFile("src/app/api/clonestore/runtime/promote/route.ts")).toBe(false));
  it("74. allowed simulate exists", () => expect(hasFile("src/app/api/clonestore/runtime/simulate/route.ts")).toBe(true));
  it("75. allowed mission-drafts exists", () => expect(hasFile("src/app/api/clonestore/runtime/mission-drafts/route.ts")).toBe(true));
  it("76. SQL draft P4.4 exists", () => expect(hasFile("supabase/sql/PHASE_4_4_RUNTIME_MISSION_DRAFTS.sql")).toBe(true));
  it("77. SQL draft P4.10 exists", () => expect(hasFile("supabase/sql/PHASE_4_10_CONTROLLED_MISSION_CANDIDATES.sql")).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — Documentation & evidence (78-96)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Documentation & evidence", () => {
  it("78. docs mention Phase 4 closed", () => expect(docLower).toContain("phase 4 closed"));
  it("79. docs mention ready for Phase 5", () => expect(docLower).toContain("ready for phase 5"));
  it("80. docs mention lancement public externe non validé", () => expect(docLower).toContain("lancement public externe non validé"));
  it("81. docs mention scale 80k non prouvé", () => expect(docLower).toContain("scale 80k non prouvé"));
  it("82. docs mention SQL drafts non appliqués automatiquement", () => expect(docLower).toContain("appliqués automatiquement"));
  it("83. docs mention feature flags default false", () => expect(docLower).toContain("default false"));
  it("84. docs sans phrase anglaise de lancement public", () => expect(docLower).not.toContain("public launch"));
  it("85. docs sans zéro erreur", () => expect(docLower).not.toContain("zéro erreur"));
  it("86. docs sans conformité garantie", () => expect(docLower).not.toContain("conformité garantie"));
  it("87. docs sans 80k scale proven", () => expect(docLower).not.toContain("80k scale proven"));
  it("88. docs sans 80k clients guaranteed", () => expect(docLower).not.toContain("80k clients guaranteed"));
  it("89. evidence mentions no real mission created", () => expect(evidenceSrc).toContain("No real mission created"));
  it("90. evidence mentions no execution", () => expect(evidenceSrc).toContain("No execution"));
  it("91. evidence mentions no DB write", () => expect(evidenceSrc).toContain("No DB write"));
  it("92. evidence mentions no SQL auto apply", () => expect(evidenceSrc).toContain("No SQL auto apply"));
  it("93. evidence mentions no env auto change", () => expect(evidenceSrc).toContain("No env auto change"));
  it("94. evidence mentions no flag auto activation", () => expect(evidenceSrc).toContain("No flag auto activation"));
  it("95. evidence mentions lancement public externe non validé", () => expect(evidenceSrc.toLowerCase()).toContain("lancement public externe non validé"));
  it("96. evidence mentions scale 80k non prouvé", () => expect(evidenceSrc.toLowerCase()).toContain("scale 80k non prouvé"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Index exports & pureté (97-103, 142-150)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Index exports & pureté", () => {
  it("97. index exports final QA types", () => expect(indexSrc).toContain("RuntimePhase4FinalQaGate"));
  it("98. index exports final QA registry", () => expect(indexSrc).toContain("buildRuntimePhase4FinalQaBlockRegistry"));
  it("99. index exports final QA invariants", () => expect(indexSrc).toContain("buildRuntimePhase4FinalQaInvariants"));
  it("100. index exports final QA gate", () => expect(indexSrc).toContain("buildRuntimePhase4FinalQaGate"));
  it("101. index exports final QA snapshot", () => expect(indexSrc).toContain("buildRuntimePhase4FinalQaSnapshot"));
  it("102. index exports next phase plan", () => expect(indexSrc).toContain("buildRuntimePhase4NextPhasePlan"));
  it("103. index exports final QA QA", () => expect(indexSrc).toContain("buildRuntimePhase4FinalQaChecklist"));

  it("142. no P4.12 module imports src/lib/pierre", () => expect(allP412).not.toContain("lib/pierre"));
  it("143. no P4.12 module imports Supabase", () => {
    expect(allP412).not.toContain("@supabase");
    expect(allP412).not.toContain("createClient");
  });
  it("144. no P4.12 module references OpenAI", () => expect(allP412Lower).not.toContain("openai"));
  it("145. no P4.12 module references Anthropic", () => expect(allP412Lower).not.toContain("anthropic"));
  it("146. no P4.12 module references Stripe", () => expect(allP412Lower).not.toContain("stripe"));
  it("147. no P4.12 module references /api/pierre", () => expect(allP412).not.toContain("/api/pierre"));
  it("148. final closure summary says phase4_closed true", () => expect(summarizeRuntimePhase4FinalQaGate(gate)).toContain("phase4_closed : true"));
  it("149. final closure summary says ready_for_phase5 true", () => expect(summarizeRuntimePhase4FinalQaGate(gate)).toContain("ready_for_phase5 : true"));
  it("150. final closure summary says public_launch_external_validated false", () => expect(summarizeRuntimePhase4FinalQaGate(gate)).toContain("public_launch_external_validated : false"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 11 — Cascade intacte (104-141)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-11", "test:phase4-10", "test:phase4-9", "test:phase4-8", "test:phase4-7",
    "test:phase4-6", "test:phase4-5", "test:phase4-4", "test:phase4-3", "test:phase4-2", "test:phase4-1",
    "test:phase3-22", "test:phase3-21", "test:phase3-20", "test:phase3-19", "test:phase3-18",
    "test:phase3-17", "test:phase3-16", "test:phase3-15", "test:phase3-14", "test:phase3-13",
    "test:phase3-12", "test:phase3-11", "test:phase3-10", "test:phase3-9", "test:phase3-8",
    "test:phase3-7", "test:phase3-6", "test:phase3-5", "test:phase3-4", "test:phase3-3",
    "test:phase3-2", "test:phase3-1", "test:phase2-9", "test:tech11", "test:pfinal02",
  ];
  scripts.forEach((script, idx) => {
    it(`${104 + idx}. ${script} encore présent`, () => {
      expect(packageJson).toContain(`"${script}"`);
    });
  });
  it("140. npm test toujours requis", () => expect(packageJson).toContain('"test":'));
  it("141. build toujours requis", () => expect(packageJson).toContain('"build":'));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 12 — Fonctionnels (151-160)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.12 — Fonctionnels", () => {
  it("151. buildRuntimePhase4FinalQaGate returns all blocks", () => {
    expect(gate.blocks.length).toBe(12);
  });
  it("152. evaluateRuntimePhase4FinalQaGate returns phase4_closed", () => {
    expect(evaluateRuntimePhase4FinalQaGate(gate).phase4_closed).toBe(true);
  });
  it("153. assertNoExecution does not throw on safe gate", () => {
    expect(() => assertRuntimePhase4FinalQaNoExecution(gate)).not.toThrow();
  });
  it("154. assertClosureSafe does not throw on safe closure", () => {
    expect(() => assertRuntimePhase4FinalQaClosureSafe(gate.closure)).not.toThrow();
  });
  it("155. getVerdict returns phase4_closed", () => {
    expect(getRuntimePhase4FinalQaVerdict(gate)).toBe("phase4_closed");
  });
  it("156. corrupting no_runtime_execution blocks closure", () => {
    const corrupted = buildRuntimePhase4FinalQaGate({ invariant_overrides: { no_runtime_execution: "failed" } });
    expect(corrupted.closure.phase4_closed).toBe(false);
    expect(corrupted.verdict).toBe("blocked");
  });
  it("157. corrupting no_public_external_launch_validation blocks closure", () => {
    const corrupted = buildRuntimePhase4FinalQaGate({ invariant_overrides: { no_public_external_launch_validation: "failed" } });
    expect(corrupted.closure.phase4_closed).toBe(false);
  });
  it("158. corrupting scale_80k_not_proven blocks closure", () => {
    const corrupted = buildRuntimePhase4FinalQaGate({ invariant_overrides: { scale_80k_not_proven: "failed" } });
    expect(corrupted.closure.phase4_closed).toBe(false);
  });
  it("159. snapshot timeline has 12 events", () => {
    const snap = buildRuntimePhase4FinalQaSnapshot(gate);
    expect(buildRuntimePhase4FinalQaTimeline(snap).length).toBe(12);
  });
  it("160. next phase plan is design-only and no execution", () => {
    const plan = buildRuntimePhase4NextPhasePlan();
    expect(plan.no_runtime_activation).toBe(true);
    expect(plan.public_launch_external_validated).toBe(false);
  });
});
