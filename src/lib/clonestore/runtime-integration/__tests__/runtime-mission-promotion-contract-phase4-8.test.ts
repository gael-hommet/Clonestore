// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-promotion-contract-phase4-8.test.ts
// PHASE 4.8 — Runtime Mission Promotion Contract / Draft → Controlled Mission — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  buildRuntimeMissionPromotionGates,
  buildControlledMissionFromDraft,
  validateRuntimeMissionPromotionContract,
  assertRuntimeMissionPromotionNoExecution,
  buildRuntimeMissionPromotionSnapshot,
  buildRuntimeMissionPromotionBadges,
  buildRuntimeMissionPromotionCards,
  buildRuntimeMissionPromotionSections,
  buildRuntimeMissionPromotionTimeline,
  buildRuntimeMissionPromotionQaChecklist,
  buildRuntimeMissionPromotionQaVerdict,
  getRuntimeMissionPromotionBlockingSteps,
  summarizeRuntimeMissionPromotionContract,
  type RuntimeMissionDraft,
} from "@/lib/clonestore/runtime-integration";

const ROOT = resolve(__dirname, "../../../../..");
const RI_DIR = "lib/clonestore/runtime-integration";

function readSrc(rel: string): string {
  const full = resolve(ROOT, "src", rel);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readDocs(name: string): string {
  const full = resolve(ROOT, "docs", name);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readTemplate(name: string): string {
  const full = resolve(ROOT, "docs/templates", name);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readRoot(name: string): string {
  const full = resolve(ROOT, name);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}

const typesPath = `${RI_DIR}/runtime-mission-promotion-types.ts`;
const contractPath = `${RI_DIR}/runtime-mission-promotion-contract.ts`;
const snapshotPath = `${RI_DIR}/runtime-mission-promotion-snapshot.ts`;
const qaPath = `${RI_DIR}/runtime-mission-promotion-qa.ts`;

const typesSrc = readSrc(typesPath);
const contractSrc = readSrc(contractPath);
const snapshotSrc = readSrc(snapshotPath);
const qaSrc = readSrc(qaPath);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const docSrc = readDocs("PHASE_4_8_RUNTIME_MISSION_PROMOTION_CONTRACT.md");
const evidenceSrc = readTemplate("PHASE_4_8_RUNTIME_MISSION_PROMOTION_CONTRACT_EVIDENCE.md");
const packageJson = readRoot("package.json");

// ── Factories ─────────────────────────────────────────────────────────────────

const baseResult = buildRuntimeIntegrationReadResult({
  raw_text: "Rédige une fiche de poste pour un développeur back-end",
});
const baseDraft = buildRuntimeMissionDraftFromIntegrationResult(baseResult);

function eligibleDraft(): RuntimeMissionDraft {
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
  };
}

function humanDraft(): RuntimeMissionDraft {
  const e = eligibleDraft();
  return {
    ...e,
    status: "awaiting_validation",
    validation_mode: "human_validation_required",
    guard_snapshot: { ...e.guard_snapshot, human_validation_required: true },
    validation_requirements: [
      {
        requirement_id: "req_human_validation",
        label: "Validation humaine requise",
        reason: "Sujet sensible — validation humaine requise.",
        risk_level: "high",
        required_approver_role: "hr_manager",
        blocks_execution: false,
      },
    ],
  };
}

function blockedDraft(): RuntimeMissionDraft {
  return {
    ...eligibleDraft(),
    kind: "blocked_draft",
    status: "blocked",
    blocked_reasons: ["Action finale juridique — décision humaine exclusive."],
  };
}

function unsupportedDraft(): RuntimeMissionDraft {
  return {
    ...eligibleDraft(),
    kind: "unsupported_domain_draft",
    employee_key: null,
    status: "simulated_only",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Modules présents + pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — Modules", () => {
  it("1. runtime-mission-promotion-types.ts existe", () => expect(existsSync(resolve(ROOT, "src", typesPath))).toBe(true));
  it("2. runtime-mission-promotion-contract.ts existe", () => expect(existsSync(resolve(ROOT, "src", contractPath))).toBe(true));
  it("3. runtime-mission-promotion-snapshot.ts existe", () => expect(existsSync(resolve(ROOT, "src", snapshotPath))).toBe(true));
  it("4. runtime-mission-promotion-qa.ts existe", () => expect(existsSync(resolve(ROOT, "src", qaPath))).toBe(true));
  it("5. types contient ControlledMission", () => expect(typesSrc).toContain("ControlledMission"));
  it("6. types contient RuntimeMissionPromotionContract", () => expect(typesSrc).toContain("RuntimeMissionPromotionContract"));
  it("7. contrat contient buildRuntimeMissionPromotionContract", () => expect(contractSrc).toContain("buildRuntimeMissionPromotionContract"));
  it("8. contrat contient buildControlledMissionFromDraft", () => expect(contractSrc).toContain("buildControlledMissionFromDraft"));
  it("9. contrat contient evaluateRuntimeMissionPromotionEligibility", () => expect(contractSrc).toContain("evaluateRuntimeMissionPromotionEligibility"));
  it("10. contrat contient validateRuntimeMissionPromotionContract", () => expect(contractSrc).toContain("validateRuntimeMissionPromotionContract"));
  it("11. snapshot contient buildRuntimeMissionPromotionSnapshot", () => expect(snapshotSrc).toContain("buildRuntimeMissionPromotionSnapshot"));
  it("12. qa contient buildRuntimeMissionPromotionQaChecklist", () => expect(qaSrc).toContain("buildRuntimeMissionPromotionQaChecklist"));

  const purity: Array<[string, string]> = [
    ["types", typesSrc], ["contract", contractSrc], ["snapshot", snapshotSrc], ["qa", qaSrc],
  ];
  purity.forEach(([name, src]) => {
    it(`13.${name} ne contient pas createClient`, () => expect(src).not.toContain("createClient"));
    it(`14.${name} ne contient pas fetch`, () => expect(src).not.toContain("fetch"));
    it(`15.${name} ne contient pas .insert(`, () => expect(src).not.toContain(".insert("));
    it(`16.${name} ne contient pas .update(`, () => expect(src).not.toContain(".update("));
    it(`17.${name} ne contient pas .delete(`, () => expect(src).not.toContain(".delete("));
    it(`18.${name} ne contient pas .upsert(`, () => expect(src).not.toContain(".upsert("));
    it(`19.${name} ne contient pas import lib/pierre`, () => expect(src).not.toContain("lib/pierre"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Index exports + package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — Index & package", () => {
  it("20. index exporte buildRuntimeMissionPromotionContract", () => expect(indexSrc).toContain("buildRuntimeMissionPromotionContract"));
  it("21. index exporte ControlledMission", () => expect(indexSrc).toContain("ControlledMission"));
  it("22. index exporte buildRuntimeMissionPromotionQaChecklist", () => expect(indexSrc).toContain("buildRuntimeMissionPromotionQaChecklist"));
  it("23. index exporte buildRuntimeMissionPromotionSnapshot", () => expect(indexSrc).toContain("buildRuntimeMissionPromotionSnapshot"));
  it("24. package.json contient test:phase4-8", () => expect(packageJson).toContain("test:phase4-8"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Documentation & evidence
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — Documentation & evidence", () => {
  const docLower = docSrc.toLowerCase();
  it("25. doc P4.8 existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("26. doc mentionne 4.8", () => expect(docSrc).toContain("4.8"));
  it("27. doc mentionne Controlled Mission", () => expect(docSrc).toContain("Controlled Mission"));
  it("28. doc mentionne promotion_applied", () => expect(docSrc).toContain("promotion_applied"));
  it("29. doc mentionne validation humaine", () => expect(docLower).toContain("validation humaine"));
  it("30. doc mentionne CloneGuard", () => expect(docSrc).toContain("CloneGuard"));
  it("31. doc mentionne CloneTrace", () => expect(docSrc).toContain("CloneTrace"));
  it("32. doc mentionne aucune mission réelle", () => expect(docLower).toContain("aucune mission réelle"));
  it("33. doc mentionne aucun appel Pierre", () => expect(docLower).toContain("aucun appel pierre"));
  it("34. doc mentionne aucun appel IA", () => expect(docLower).toContain("aucun appel ia"));
  it("35. doc mentionne CloneVoice non actif", () => expect(docLower).toContain("clonevoice non actif"));
  it("36. doc mentionne scale 80k non prouvé", () => expect(docLower).toContain("scale 80k non prouvé"));
  it("37. doc mentionne PHASE 4.9", () => expect(docSrc).toContain("PHASE 4.9"));
  it("38. doc sans phrase anglaise de lancement public", () => expect(docLower).not.toContain("public launch"));
  it("39. doc sans zéro erreur", () => expect(docLower).not.toContain("zéro erreur"));
  it("40. doc sans conformité garantie", () => expect(docLower).not.toContain("conformité garantie"));
  it("41. doc sans 80k scale proven", () => expect(docLower).not.toContain("80k scale proven"));
  it("42. doc sans 80k clients guaranteed", () => expect(docLower).not.toContain("80k clients guaranteed"));
  it("43. evidence template existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("44. evidence mentionne promotion_applied", () => expect(evidenceSrc).toContain("promotion_applied"));
  it("45. evidence mentionne Mission contrôlée", () => expect(evidenceSrc).toContain("Mission contrôlée"));
  it("46. evidence mentionne scale 80k non prouvé", () => expect(evidenceSrc.toLowerCase()).toContain("scale 80k non prouvé"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Contrat fonctionnel
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — Contrat fonctionnel", () => {
  it("47. contrat eligible → verdict eligible + mission contrôlée", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(c.decision.verdict).toBe("eligible");
    expect(c.controlled_mission).not.toBeNull();
    expect(c.controlled_mission?.status).toBe("controlled_ready");
    expect(c.status).toBe("promotion_contract_ready");
  });

  it("48. contrat human → requires_human_validation + awaiting_validation", () => {
    const c = buildRuntimeMissionPromotionContract(humanDraft());
    expect(c.decision.verdict).toBe("requires_human_validation");
    expect(c.controlled_mission?.status).toBe("awaiting_validation");
  });

  it("49. contrat blocked → verdict blocked + pas de mission contrôlée", () => {
    const c = buildRuntimeMissionPromotionContract(blockedDraft());
    expect(c.decision.verdict).toBe("blocked");
    expect(c.controlled_mission).toBeNull();
  });

  it("50. contrat unsupported → verdict not_eligible + pas de mission contrôlée", () => {
    const c = buildRuntimeMissionPromotionContract(unsupportedDraft());
    expect(c.decision.verdict).toBe("not_eligible");
    expect(c.controlled_mission).toBeNull();
  });

  it("51. promotion_applied false (safety + decision)", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(c.safety_flags.promotion_applied).toBe(false);
    expect(c.decision.promotion_applied).toBe(false);
  });

  it("52. requires_human_validation true + controlled true", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(c.safety_flags.requires_human_validation).toBe(true);
    expect(c.safety_flags.controlled).toBe(true);
  });

  it("53. tous les flags d'exécution false", () => {
    const sf = buildRuntimeMissionPromotionContract(eligibleDraft()).safety_flags;
    expect(sf.execution_enabled).toBe(false);
    expect(sf.mission_executed).toBe(false);
    expect(sf.autonomous_execution).toBe(false);
    expect(sf.pierre_engine_called).toBe(false);
    expect(sf.ai_call_performed).toBe(false);
    expect(sf.db_write_performed).toBe(false);
    expect(sf.clonevoice_active).toBe(false);
    expect(sf.public_launch_external_validated).toBe(false);
  });

  it("54. gates couvrent l'éligibilité", () => {
    const ids = buildRuntimeMissionPromotionGates(eligibleDraft()).map((g) => g.id);
    expect(ids).toContain("draft_valid");
    expect(ids).toContain("draft_no_execution_flags");
    expect(ids).toContain("draft_not_blocked");
    expect(ids).toContain("employee_route_present");
    expect(ids).toContain("guard_decision_present");
    expect(ids).toContain("trace_contract_present");
    expect(ids).toContain("idempotency_present");
  });

  it("55. gates eligible : tous les bloquants passent", () => {
    const blocking = buildRuntimeMissionPromotionGates(eligibleDraft()).filter((g) => g.severity === "blocking");
    expect(blocking.every((g) => g.passed)).toBe(true);
  });

  it("56. controlled mission préserve CloneGuard/CloneTrace/idempotency", () => {
    const cm = buildControlledMissionFromDraft(eligibleDraft());
    expect(cm.guard_snapshot.cloneguard_required).toBe(true);
    expect(cm.trace_snapshot.clonetrace_required).toBe(true);
    expect(cm.idempotency.required).toBe(true);
    expect(cm.execution_enabled).toBe(false);
    expect(cm.controlled).toBe(true);
  });

  it("57. controlled mission steps : plan-only, execution_enabled false", () => {
    const cm = buildControlledMissionFromDraft(eligibleDraft());
    expect(cm.steps.length).toBeGreaterThan(0);
    expect(cm.steps.every((s) => s.execution_enabled === false && s.plan_only === true)).toBe(true);
  });

  it("58. controlled mission : au moins une validation humaine", () => {
    const cm = buildControlledMissionFromDraft(eligibleDraft());
    expect(cm.required_validations.length).toBeGreaterThanOrEqual(1);
  });

  it("59. validate contrat eligible → valide", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(validateRuntimeMissionPromotionContract(c).valid).toBe(true);
  });

  it("60. assertNoExecution → safe", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(assertRuntimeMissionPromotionNoExecution(c).safe).toBe(true);
  });

  it("61. assertNoExecution détecte une violation", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    const tampered = { ...c, safety_flags: { ...c.safety_flags, execution_enabled: true as unknown as false } };
    expect(assertRuntimeMissionPromotionNoExecution(tampered).safe).toBe(false);
  });

  it("62. summarize contient PHASE 4.8", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(summarizeRuntimeMissionPromotionContract(c)).toContain("PHASE 4.8");
  });

  it("63. mode design_only + read_only true", () => {
    const c = buildRuntimeMissionPromotionContract(eligibleDraft());
    expect(c.mode).toBe("design_only");
    expect(c.read_only).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Snapshot preview
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — Snapshot preview", () => {
  const snap = buildRuntimeMissionPromotionSnapshot(buildRuntimeMissionPromotionContract(eligibleDraft()));

  it("64. badges incluent No-execution", () => {
    expect(buildRuntimeMissionPromotionBadges(snap).map((b) => b.label)).toContain("No-execution");
  });
  it("65. badges incluent Aucune mission réelle", () => {
    expect(buildRuntimeMissionPromotionBadges(snap).map((b) => b.label)).toContain("Aucune mission réelle");
  });
  it("66. badges incluent CloneGuard obligatoire", () => {
    expect(buildRuntimeMissionPromotionBadges(snap).map((b) => b.label)).toContain("CloneGuard obligatoire");
  });
  it("67. badges incluent Scale 80k non prouvé", () => {
    expect(buildRuntimeMissionPromotionBadges(snap).map((b) => b.label)).toContain("Scale 80k non prouvé");
  });
  it("68. cards incluent un verdict", () => {
    expect(buildRuntimeMissionPromotionCards(snap).some((c) => c.id === "card-verdict")).toBe(true);
  });
  it("69. sections incluent les gates", () => {
    expect(buildRuntimeMissionPromotionSections(snap).some((s) => s.kind === "gates")).toBe(true);
  });
  it("70. timeline inclut execution_not_started", () => {
    expect(buildRuntimeMissionPromotionTimeline(snap).map((t) => t.event)).toContain("execution_not_started");
  });
  it("71. snapshot read_only true", () => expect(snap.read_only).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — QA", () => {
  it("72. checklist a au moins 20 étapes", () => {
    const checklist = buildRuntimeMissionPromotionQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(20);
    expect(checklist.phase).toBe("4.8");
  });
  it("73. checklist contient promotion_applied_false", () => {
    expect(buildRuntimeMissionPromotionQaChecklist().steps.map((s) => s.id)).toContain("promotion_applied_false");
  });
  it("74. checklist contient blocked_draft_not_promotable", () => {
    expect(buildRuntimeMissionPromotionQaChecklist().steps.map((s) => s.id)).toContain("blocked_draft_not_promotable");
  });
  it("75. checklist contient public_launch_external_not_validated", () => {
    expect(buildRuntimeMissionPromotionQaChecklist().steps.map((s) => s.id)).toContain("public_launch_external_not_validated");
  });
  it("76. blocking steps sont tous blocking", () => {
    expect(getRuntimeMissionPromotionBlockingSteps().every((s) => s.severity === "blocking")).toBe(true);
  });
  it("77. verdict ready quand tout pending", () => {
    const checklist = buildRuntimeMissionPromotionQaChecklist();
    const summary = buildRuntimeMissionPromotionQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.design_only).toBe(true);
  });
  it("78. verdict blocked si une étape bloquante échoue", () => {
    const checklist = buildRuntimeMissionPromotionQaChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "promotion_applied_false" ? { ...s, status: "failed" as const } : s
    );
    expect(buildRuntimeMissionPromotionQaVerdict(withFail).verdict).toBe("blocked");
  });
  it("79. verdict passed si toutes les étapes passées", () => {
    const checklist = buildRuntimeMissionPromotionQaChecklist();
    const allPassed = checklist.steps.map((s) => ({ ...s, status: "passed" as const }));
    expect(buildRuntimeMissionPromotionQaVerdict(allPassed).verdict).toBe("passed");
  });
  it("80. summarize QA contient PHASE 4.8", () => {
    const checklist = buildRuntimeMissionPromotionQaChecklist();
    const summary = buildRuntimeMissionPromotionQaVerdict(checklist.steps);
    expect(summary.message).toContain("PHASE 4.8");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Cascade intacte
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.8 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-7", "test:phase4-6", "test:phase4-5", "test:phase4-4", "test:phase4-3",
    "test:phase4-2", "test:phase4-1", "test:phase3-22", "test:phase2-9", "test:tech11", "test:pfinal02",
  ];
  scripts.forEach((script, idx) => {
    it(`${81 + idx}. ${script} encore présent`, () => {
      expect(packageJson).toContain(`"${script}"`);
    });
  });
});
