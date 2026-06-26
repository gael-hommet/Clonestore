// src/lib/clonestore/runtime-integration/__tests__/runtime-controlled-mission-human-validation-workflow-phase4-11.test.ts
// PHASE 4.11 — Controlled Mission Human Validation Workflow Design — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  requiresRuntimeControlledMissionSecondValidator,
  requiresRuntimeControlledMissionLegalReviewer,
  buildRuntimeControlledMissionHumanValidationWorkflow,
  buildRuntimeControlledMissionHumanValidationDecisionRecord,
  applyRuntimeControlledMissionHumanValidationDecisionPreview,
  validateRuntimeControlledMissionHumanValidationWorkflow,
  buildRuntimeControlledMissionHumanValidationSnapshot,
  buildRuntimeControlledMissionHumanValidationBadges,
  buildRuntimeControlledMissionHumanValidationQaChecklist,
  buildRuntimeControlledMissionHumanValidationQaVerdict,
  type RuntimeMissionDraft,
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

const typesSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-human-validation-types.ts`);
const policySrc = readSrc(`${RI_DIR}/runtime-controlled-mission-human-validation-policy.ts`);
const gatesSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-human-validation-gates.ts`);
const workflowSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-human-validation-workflow.ts`);
const snapshotSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-human-validation-snapshot.ts`);
const qaSrc = readSrc(`${RI_DIR}/runtime-controlled-mission-human-validation-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const scriptSrc = readRootFile("scripts/check-runtime-controlled-mission-human-validation-workflow.mjs");
const docSrc = readRootFile("docs/PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_DESIGN.md");
const docLower = docSrc.toLowerCase();
const evidenceSrc = readRootFile("docs/templates/PHASE_4_11_CONTROLLED_MISSION_HUMAN_VALIDATION_WORKFLOW_EVIDENCE.md");
const packageJson = readRootFile("package.json");

const libPierreScan = [typesSrc, policySrc, gatesSrc, workflowSrc, snapshotSrc, qaSrc].join("\n");
const providerScan = [typesSrc, policySrc, gatesSrc, workflowSrc, snapshotSrc].join("\n").toLowerCase();

// ── Factories ─────────────────────────────────────────────────────────────────

const baseResult = buildRuntimeIntegrationReadResult({
  raw_text: "Rédige une fiche de poste pour un développeur back-end",
});
const baseDraft = buildRuntimeMissionDraftFromIntegrationResult(baseResult);

function eligibleDraft(objective?: string): RuntimeMissionDraft {
  return {
    ...baseDraft,
    kind: "pierre_mission_draft",
    status: "ready_for_review",
    employee_key: "pierre",
    risk_level: "low",
    validation_mode: "human_review_recommended",
    guard_snapshot: { ...baseDraft.guard_snapshot, decision: "allow_plan_only", human_validation_required: false },
    validation_requirements: [],
    blocked_reasons: [],
    objective: objective ?? baseDraft.objective,
  };
}

const benignContract = buildRuntimeMissionPromotionContract(eligibleDraft());
const sensitiveHrContract = buildRuntimeMissionPromotionContract(
  eligibleDraft("Objectif (plan-only) : gérer un cas de harcèlement et de discrimination au travail.")
);
const legalContract = buildRuntimeMissionPromotionContract(
  eligibleDraft("Objectif (plan-only) : préparer un avenant au contrat et gérer un contentieux prud'hommes.")
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Modules + types
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Modules & types", () => {
  it("1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. policy existe", () => expect(policySrc.length).toBeGreaterThan(0));
  it("3. gates existe", () => expect(gatesSrc.length).toBeGreaterThan(0));
  it("4. workflow existe", () => expect(workflowSrc.length).toBeGreaterThan(0));
  it("5. snapshot existe", () => expect(snapshotSrc.length).toBeGreaterThan(0));
  it("6. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("7. check script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("8. types contient not_started", () => expect(typesSrc).toContain("not_started"));
  it("9. types contient awaiting_validator", () => expect(typesSrc).toContain("awaiting_validator"));
  it("10. types contient awaiting_second_validator", () => expect(typesSrc).toContain("awaiting_second_validator"));
  it("11. types contient approved_preview", () => expect(typesSrc).toContain("approved_preview"));
  it("12. types contient rejected", () => expect(typesSrc).toContain("rejected"));
  it("13. types contient blocked", () => expect(typesSrc).toContain("blocked"));
  it("14. types contient approve_preview", () => expect(typesSrc).toContain("approve_preview"));
  it("15. types contient request_changes", () => expect(typesSrc).toContain("request_changes"));
  it("16. types contient reject", () => expect(typesSrc).toContain("reject"));
  it("17. types contient block", () => expect(typesSrc).toContain("block"));
  it("18. types contient escalate", () => expect(typesSrc).toContain("escalate"));
  it("19. types contient validator", () => expect(typesSrc).toContain("validator"));
  it("20. types contient second_validator", () => expect(typesSrc).toContain("second_validator"));
  it("21. types contient hr_manager", () => expect(typesSrc).toContain("hr_manager"));
  it("22. types contient legal_reviewer", () => expect(typesSrc).toContain("legal_reviewer"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Policy
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Policy", () => {
  it("23. policy contient classify...Sensitivity", () => expect(policySrc).toContain("classifyRuntimeControlledMissionHumanValidationSensitivity"));
  it("24. policy contient requires...SecondValidator", () => expect(policySrc).toContain("requiresRuntimeControlledMissionSecondValidator"));
  it("25. policy contient requires...LegalReviewer", () => expect(policySrc).toContain("requiresRuntimeControlledMissionLegalReviewer"));
  it("26. policy contient requires...HrManager", () => expect(policySrc).toContain("requiresRuntimeControlledMissionHrManager"));
  it("27. policy mentionne licenciement", () => expect(policySrc).toContain("licenciement"));
  it("28. policy mentionne sanction", () => expect(policySrc).toContain("sanction"));
  it("29. policy mentionne harcèlement", () => expect(policySrc).toContain("harcèlement"));
  it("30. policy mentionne discrimination", () => expect(policySrc).toContain("discrimination"));
  it("31. policy mentionne paie", () => expect(policySrc).toContain("paie"));
  it("32. policy mentionne contrat", () => expect(policySrc).toContain("contrat"));
  it("33. policy mentionne RGPD", () => expect(policySrc).toContain("RGPD"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Gates
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Gates", () => {
  it("34. gates contient buildRuntimeControlledMissionHumanValidationGates", () => expect(gatesSrc).toContain("buildRuntimeControlledMissionHumanValidationGates"));
  it("35. gates contient no_execution_required", () => expect(gatesSrc).toContain("no_execution_required"));
  it("36. gates contient no_real_mission_required", () => expect(gatesSrc).toContain("no_real_mission_required"));
  it("37. gates contient promotion_not_applied_required", () => expect(gatesSrc).toContain("promotion_not_applied_required"));
  it("38. gates contient cloneguard_required", () => expect(gatesSrc).toContain("cloneguard_required"));
  it("39. gates contient clonetrace_required", () => expect(gatesSrc).toContain("clonetrace_required"));
  it("40. gates contient second_validator_required", () => expect(gatesSrc).toContain("second_validator_required"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Workflow
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Workflow", () => {
  it("41. workflow contient buildRuntimeControlledMissionHumanValidationWorkflow", () => expect(workflowSrc).toContain("buildRuntimeControlledMissionHumanValidationWorkflow"));
  it("42. workflow contient applyRuntimeControlledMissionHumanValidationDecisionPreview", () => expect(workflowSrc).toContain("applyRuntimeControlledMissionHumanValidationDecisionPreview"));
  it("43. workflow contient approval_applied false", () => expect(workflowSrc).toContain("approval_applied false"));
  it("44. workflow contient promotion_applied false", () => expect(workflowSrc).toContain("promotion_applied false"));
  it("45. workflow contient controlled_mission_created false", () => expect(workflowSrc).toContain("controlled_mission_created false"));
  it("46. workflow contient mission_created false", () => expect(workflowSrc).toContain("mission_created false"));
  it("47. workflow contient execution_enabled false", () => expect(workflowSrc).toContain("execution_enabled false"));
  it("48. workflow contient execution_started false", () => expect(workflowSrc).toContain("execution_started false"));
  it("49. workflow contient db_write_performed false", () => expect(workflowSrc).toContain("db_write_performed false"));
  it("50. workflow contient pierre_engine_called false", () => expect(workflowSrc).toContain("pierre_engine_called false"));
  it("51. workflow contient ai_call_performed false", () => expect(workflowSrc).toContain("ai_call_performed false"));
  it("52. workflow ne contient pas fetch", () => expect(workflowSrc).not.toContain("fetch"));
  it("53. workflow ne contient pas createClient", () => expect(workflowSrc).not.toContain("createClient"));
  it("54. workflow ne contient pas .insert(", () => expect(workflowSrc).not.toContain(".insert("));
  it("55. workflow ne contient pas .update(", () => expect(workflowSrc).not.toContain(".update("));
  it("56. workflow ne contient pas .delete(", () => expect(workflowSrc).not.toContain(".delete("));
  it("57. workflow ne contient pas .upsert(", () => expect(workflowSrc).not.toContain(".upsert("));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Snapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Snapshot", () => {
  it("58. snapshot contient buildRuntimeControlledMissionHumanValidationSnapshot", () => expect(snapshotSrc).toContain("buildRuntimeControlledMissionHumanValidationSnapshot"));
  it("59. snapshot contient Human validation required", () => expect(snapshotSrc).toContain("Human validation required"));
  it("60. snapshot contient Double validation si sensible", () => expect(snapshotSrc).toContain("Double validation si sensible"));
  it("61. snapshot contient Aucune mission réelle", () => expect(snapshotSrc).toContain("Aucune mission réelle"));
  it("62. snapshot contient No-execution", () => expect(snapshotSrc).toContain("No-execution"));
  it("63. snapshot contient Promotion non appliquée", () => expect(snapshotSrc).toContain("Promotion non appliquée"));
  it("64. snapshot contient Aucun appel Pierre", () => expect(snapshotSrc).toContain("Aucun appel Pierre"));
  it("65. snapshot contient Aucun appel IA", () => expect(snapshotSrc).toContain("Aucun appel IA"));
  it("66. snapshot contient CloneVoice non actif", () => expect(snapshotSrc).toContain("CloneVoice non actif"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — QA", () => {
  it("67. QA contient buildRuntimeControlledMissionHumanValidationQaChecklist", () => expect(qaSrc).toContain("buildRuntimeControlledMissionHumanValidationQaChecklist"));
  it("68. QA contient approval_preview_not_execution", () => expect(qaSrc).toContain("approval_preview_not_execution"));
  it("69. QA contient approved_preview_does_not_create_mission", () => expect(qaSrc).toContain("approved_preview_does_not_create_mission"));
  it("70. QA contient no_db_write", () => expect(qaSrc).toContain("no_db_write"));
  it("71. QA contient no_api_post", () => expect(qaSrc).toContain("no_api_post"));
  it("72. QA contient no_pierre_engine_import", () => expect(qaSrc).toContain("no_pierre_engine_import"));
  it("73. QA contient no_cloneos_execution", () => expect(qaSrc).toContain("no_cloneos_execution"));
  it("74. QA contient public_launch_external_not_validated", () => expect(qaSrc).toContain("public_launch_external_not_validated"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Script read-only
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Script read-only", () => {
  it("75. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("76. script contient check:runtime-controlled-mission-human-validation-workflow", () => expect(scriptSrc).toContain("check:runtime-controlled-mission-human-validation-workflow"));
  it("77. script contient test:phase4-11", () => expect(scriptSrc).toContain("test:phase4-11"));
  it("78. script ne contient pas .insert(", () => expect(scriptSrc).not.toContain(".insert("));
  it("79. script ne contient pas .update(", () => expect(scriptSrc).not.toContain(".update("));
  it("80. script ne contient pas .delete(", () => expect(scriptSrc).not.toContain(".delete("));
  it("81. script ne contient pas .upsert(", () => expect(scriptSrc).not.toContain(".upsert("));
  it("82. script ne contient pas fetch POST", () => expect(scriptSrc).not.toContain("fetch"));
  it("83. script ne contient pas writeFile", () => expect(scriptSrc).not.toContain("writeFile"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Documentation", () => {
  it("84. doc P4.11 existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("85. doc mentionne P4.11", () => expect(docSrc).toContain("4.11"));
  it("86. doc mentionne validation humaine", () => expect(docLower).toContain("validation humaine"));
  it("87. doc mentionne approval_preview", () => expect(docSrc).toContain("approval_preview"));
  it("88. doc mentionne vraie mission", () => expect(docLower).toContain("vraie mission"));
  it("89. doc mentionne aucun write DB", () => expect(docLower).toContain("aucun write db"));
  it("90. doc mentionne aucune route POST approve/reject", () => expect(docLower).toContain("aucune route post approve/reject"));
  it("91. doc mentionne aucun appel Pierre", () => expect(docLower).toContain("aucun appel pierre"));
  it("92. doc mentionne scale 80k non prouvé", () => expect(docLower).toContain("scale 80k non prouvé"));
  it("93. doc mentionne PHASE 4.12", () => expect(docSrc).toContain("PHASE 4.12"));
  it("94. doc sans phrase anglaise de lancement public", () => expect(docLower).not.toContain("public launch"));
  it("95. doc sans zéro erreur", () => expect(docLower).not.toContain("zéro erreur"));
  it("96. doc sans conformité garantie", () => expect(docLower).not.toContain("conformité garantie"));
  it("97. doc sans 80k scale proven", () => expect(docLower).not.toContain("80k scale proven"));
  it("98. doc sans 80k clients guaranteed", () => expect(docLower).not.toContain("80k clients guaranteed"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — Evidence
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Evidence", () => {
  it("99. evidence template existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("100. evidence mentionne approval_preview appliqué ? non", () => expect(evidenceSrc).toContain("approval_preview appliqué ? non"));
  it("101. evidence mentionne Mission réelle créée ? non", () => expect(evidenceSrc).toContain("Mission réelle créée ? non"));
  it("102. evidence mentionne Route POST approve/reject créée ? non", () => expect(evidenceSrc).toContain("Route POST approve/reject créée ? non"));
  it("103. evidence mentionne DB write effectué ? non", () => expect(evidenceSrc).toContain("DB write effectué ? non"));
  it("104. evidence mentionne Scale 80k non prouvé", () => expect(evidenceSrc.toLowerCase()).toContain("scale 80k non prouvé"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Index, package & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Index, package & pureté", () => {
  it("105. index exports types", () => expect(indexSrc).toContain("RuntimeControlledMissionHumanValidationWorkflow"));
  it("106. index exports policy", () => expect(indexSrc).toContain("buildRuntimeControlledMissionHumanValidationPolicy"));
  it("107. index exports gates", () => expect(indexSrc).toContain("buildRuntimeControlledMissionHumanValidationGates"));
  it("108. index exports workflow", () => expect(indexSrc).toContain("applyRuntimeControlledMissionHumanValidationDecisionPreview"));
  it("109. index exports snapshot", () => expect(indexSrc).toContain("buildRuntimeControlledMissionHumanValidationSnapshot"));
  it("110. index exports QA", () => expect(indexSrc).toContain("buildRuntimeControlledMissionHumanValidationQaChecklist"));
  it("111. package.json contient test:phase4-11", () => expect(packageJson).toContain("test:phase4-11"));
  it("112. package.json contient check script", () => expect(packageJson).toContain("check:runtime-controlled-mission-human-validation-workflow"));
  it("113. aucun module P4.11 n'importe src/lib/pierre", () => expect(libPierreScan).not.toContain("lib/pierre"));
  it("114. aucun module P4.11 (hors QA) n'appelle openai", () => expect(providerScan).not.toContain("openai"));
  it("115. aucun module P4.11 (hors QA) n'appelle anthropic", () => expect(providerScan).not.toContain("anthropic"));
  it("116. aucun module P4.11 (hors QA) n'appelle stripe", () => expect(providerScan).not.toContain("stripe"));
  it("117. aucune route POST approve/reject créée", () =>
    expect(existsSync(resolve(ROOT, "src/app/api/clonestore/runtime/controlled-mission-validation/route.ts"))).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 11 — Cascade intacte
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-10", "test:phase4-9", "test:phase4-8", "test:phase4-7", "test:phase4-6",
    "test:phase4-5", "test:phase4-4", "test:phase4-3", "test:phase4-2", "test:phase4-1",
    "test:phase3-22", "test:phase3-21", "test:phase3-20", "test:phase3-19", "test:phase3-18",
    "test:phase3-17", "test:phase3-16", "test:phase3-15", "test:phase3-14", "test:phase3-13",
    "test:phase3-12", "test:phase3-11", "test:phase3-10", "test:phase3-9", "test:phase3-8",
    "test:phase3-7", "test:phase3-6", "test:phase3-5", "test:phase3-4", "test:phase3-3",
    "test:phase3-2", "test:phase3-1", "test:phase2-9", "test:tech11", "test:pfinal02",
  ];
  scripts.forEach((script, idx) => {
    it(`${118 + idx}. ${script} encore présent`, () => {
      expect(packageJson).toContain(`"${script}"`);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 12 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.11 — Fonctionnels", () => {
  it("153. contrat sûr → workflow awaiting_validator", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    expect(wf.status).toBe("awaiting_validator");
    expect(wf.human_validation_required).toBe(true);
    expect(wf.approval_applied).toBe(false);
  });

  it("154. texte RH sensible → second validateur requis", () => {
    expect(requiresRuntimeControlledMissionSecondValidator(sensitiveHrContract)).toBe(true);
  });

  it("155. texte juridique → revue légale requise", () => {
    expect(requiresRuntimeControlledMissionLegalReviewer(legalContract)).toBe(true);
  });

  it("156. risque faible → validateur humain + CloneGuard/CloneTrace gates", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    const ids = wf.gates.map((g) => g.id);
    expect(ids).toContain("human_validator_required");
    expect(ids).toContain("cloneguard_required");
    expect(ids).toContain("clonetrace_required");
  });

  it("157. approve_preview avec second validateur requis → awaiting_second_validator", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(sensitiveHrContract);
    expect(wf.second_validation_required).toBe(true);
    const decision = buildRuntimeControlledMissionHumanValidationDecisionRecord(wf, "approve_preview");
    const next = applyRuntimeControlledMissionHumanValidationDecisionPreview(wf, decision);
    expect(next.status).toBe("awaiting_second_validator");
    expect(next.approval_applied).toBe(false);
  });

  it("158. approve_preview avec tous les validateurs → approved_preview mais approval_applied false", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    expect(wf.second_validation_required).toBe(false);
    const decision = buildRuntimeControlledMissionHumanValidationDecisionRecord(wf, "approve_preview");
    const next = applyRuntimeControlledMissionHumanValidationDecisionPreview(wf, decision);
    expect(next.status).toBe("approved_preview");
    expect(next.approved_preview).toBe(true);
    expect(next.approval_applied).toBe(false);
    expect(next.mission_created).toBe(false);
    expect(next.execution_enabled).toBe(false);
  });

  it("159. request_changes → changes_requested", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    const decision = buildRuntimeControlledMissionHumanValidationDecisionRecord(wf, "request_changes");
    expect(applyRuntimeControlledMissionHumanValidationDecisionPreview(wf, decision).status).toBe("changes_requested");
  });

  it("160. reject → rejected", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    const decision = buildRuntimeControlledMissionHumanValidationDecisionRecord(wf, "reject");
    expect(applyRuntimeControlledMissionHumanValidationDecisionPreview(wf, decision).status).toBe("rejected");
  });

  it("161. block → blocked", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    const decision = buildRuntimeControlledMissionHumanValidationDecisionRecord(wf, "block");
    expect(applyRuntimeControlledMissionHumanValidationDecisionPreview(wf, decision).status).toBe("blocked");
  });

  it("162. validation échoue si execution_enabled true", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    const tampered = { ...wf, execution_enabled: true as unknown as false };
    expect(validateRuntimeControlledMissionHumanValidationWorkflow(tampered).valid).toBe(false);
  });

  it("163. snapshot badges incluent no-execution", () => {
    const wf = buildRuntimeControlledMissionHumanValidationWorkflow(benignContract);
    const snap = buildRuntimeControlledMissionHumanValidationSnapshot(wf);
    const labels = buildRuntimeControlledMissionHumanValidationBadges(snap).map((b) => b.label);
    expect(labels).toContain("No-execution");
    expect(labels).toContain("Aucune mission réelle");
  });

  it("164. QA checklist total cohérent + verdict ready", () => {
    const checklist = buildRuntimeControlledMissionHumanValidationQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(36);
    expect(checklist.phase).toBe("4.11");
    const summary = buildRuntimeControlledMissionHumanValidationQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.design_only).toBe(true);
  });

  it("165. script check s'exécute en lecture seule (PASS)", () => {
    const out = execSync("node scripts/check-runtime-controlled-mission-human-validation-workflow.mjs", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    expect(out).toContain("RÉSULTAT : PASS");
  });
});
