// src/lib/clonestore/runtime-integration/__tests__/pierre-real-workflow-completion-pack-phase6-2.test.ts
// PHASE 6.2 — Pierre Real Workflow Completion Pack / 5 Sellable HR Scenarios — Tests

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  createLocalControlledMission,
  getLocalControlledMissionById,
  loadLocalControlledMissions,
  approveLocalControlledMission,
  runLocalControlledMissionPreflight,
  // P5.4 → P6.1 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionPersistenceOperatorHandbook,
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P6.2
  buildPierreRealWorkflowCompletionPack,
  buildPierreWorkflowScenarios,
  buildPierreWorkflowSellableProofSummary,
  buildPierreWorkflowHumanValidationMatrix,
  buildPierreWorkflowLegalRiskMatrix,
  buildPierreWorkflowTraceabilityMatrix,
  buildPierreRealWorkflowCompletionPackQaChecklist,
  buildPierreRealWorkflowCompletionPackQaVerdict,
  summarizePierreRealWorkflowCompletionPack,
  PIERRE_WORKFLOW_PACK_TITLE,
  PIERRE_WORKFLOW_PACK_MICROCOPY,
  PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE,
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
function hasFile(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

const typesSrc = readSrc(`${RI_DIR}/pierre-real-workflow-completion-pack-types.ts`);
const packSrc = readSrc(`${RI_DIR}/pierre-real-workflow-completion-pack.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/pierre-real-workflow-completion-pack-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/pierre-real-workflow-completion-pack-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_6_2_PIERRE_REAL_WORKFLOW_COMPLETION_PACK.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_6_2_PIERRE_REAL_WORKFLOW_COMPLETION_PACK_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-pierre-real-workflow-completion-pack-phase6-2.mjs");
const packageJson = readRootFile("package.json");

const scanBlob = [typesSrc, packSrc, uiCopySrc].join("\n");

// ── localStorage mock ─────────────────────────────────────────────────────────

class LocalStorageMock {
  store = new Map<string, string>();
  getItem(k: string): string | null { return this.store.has(k) ? (this.store.get(k) as string) : null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  clear(): void { this.store.clear(); }
}

const ORIGINAL_WINDOW = (globalThis as unknown as { window?: unknown }).window;
function setWindow(localStorage: unknown): void {
  (globalThis as unknown as { window?: unknown }).window = { localStorage };
}

beforeEach(() => { setWindow(new LocalStorageMock()); });
afterAll(() => {
  if (ORIGINAL_WINDOW === undefined) delete (globalThis as unknown as { window?: unknown }).window;
  else (globalThis as unknown as { window?: unknown }).window = ORIGINAL_WINDOW;
});

// ── Factories ─────────────────────────────────────────────────────────────────

const baseResult = buildRuntimeIntegrationReadResult({ raw_text: "Rédige une fiche de poste pour un développeur back-end" });
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
const eligibleContract = () => buildRuntimeMissionPromotionContract(eligibleDraft());
function createMission(): string {
  return createLocalControlledMission(eligibleContract()).mission!.id;
}
function readyMissionId(): string {
  const id = createMission();
  approveLocalControlledMission(id);
  runLocalControlledMissionPreflight(id);
  return id;
}

const scenarios = buildPierreWorkflowScenarios();
const byId = (id: string) => scenarios.find((s) => s.id === id)!;

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.2 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. pack existe", () => expect(packSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("51. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("52. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("53. modules ne contiennent pas import du moteur Pierre", () => expect([typesSrc, packSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre'));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Pack & scénarios
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.2 — Pack & scénarios", () => {
  const pack = buildPierreRealWorkflowCompletionPack();

  it("1. phase = 6.2", () => expect(pack.phase).toBe("6.2"));
  it("2. scenario_count = 5", () => { expect(pack.scenario_count).toBe(5); expect(pack.scenarios.length).toBe(5); });
  it("3. ready_for_p6_3 true", () => expect(pack.ready_for_p6_3).toBe(true));
  it("4. pierre_fully_sellable_declared false", () => expect(pack.pierre_fully_sellable_declared).toBe(false));
  it("5. public_launch_validated false", () => expect(pack.public_launch_validated).toBe(false));
  it("6. scale_80k_proven false", () => expect(pack.scale_80k_proven).toBe(false));
  it("7. server_persistence_active false", () => expect(pack.server_persistence_active).toBe(false));
  it("8. runtime_execution_active false", () => expect(pack.runtime_execution_active).toBe(false));
  it("9. ai_call_performed false", () => expect(pack.ai_call_performed).toBe(false));
  it("10. email_sent false", () => expect(pack.email_sent).toBe(false));
  it("11. official_document_generated false", () => expect(pack.official_document_generated).toBe(false));

  it("12. scénario 1 embauche", () => expect(byId("S1").title).toContain("Embauche"));
  it("13. scénario 2 absence", () => expect(byId("S2").title).toContain("Absence"));
  it("14. scénario 3 pré-paie", () => expect(byId("S3").title).toContain("Pré-paie"));
  it("15. scénario 4 multi-site", () => expect(byId("S4").title).toContain("Multi-site"));
  it("16. scénario 5 cas sensible", () => expect(byId("S5").title).toContain("sensible"));

  it("17. chaque scénario customer_request", () => expect(scenarios.every((s) => s.customer_request.length > 0)).toBe(true));
  it("18. chaque scénario pierre_understanding", () => expect(scenarios.every((s) => s.pierre_understanding.length > 0)).toBe(true));
  it("19. chaque scénario mission_title", () => expect(scenarios.every((s) => s.mission_title.length > 0)).toBe(true));
  it("20. chaque scénario tasks", () => expect(scenarios.every((s) => s.tasks.length > 0)).toBe(true));
  it("21. chaque scénario required_inputs", () => expect(scenarios.every((s) => s.required_inputs.length > 0)).toBe(true));
  it("22. chaque scénario human_validations", () => expect(scenarios.every((s) => s.human_validations.length > 0)).toBe(true));
  it("23. chaque scénario sensitive_actions", () => expect(scenarios.every((s) => s.sensitive_actions.length > 0)).toBe(true));
  it("24. chaque scénario blocked_actions", () => expect(scenarios.every((s) => s.blocked_actions.length > 0)).toBe(true));
  it("25. chaque scénario allowed_outputs", () => expect(scenarios.every((s) => s.allowed_outputs.length > 0)).toBe(true));
  it("26. chaque scénario forbidden_outputs", () => expect(scenarios.every((s) => s.forbidden_outputs.length > 0)).toBe(true));
  it("27. chaque scénario expected_deliverables", () => expect(scenarios.every((s) => s.expected_deliverables.length > 0)).toBe(true));
  it("28. chaque scénario trace_events", () => expect(scenarios.every((s) => s.trace_events.length > 0)).toBe(true));
  it("29. chaque scénario legal_guardrails", () => expect(scenarios.every((s) => s.legal_guardrails.length > 0)).toBe(true));
  it("30. chaque scénario cloneguard_decision", () => expect(scenarios.every((s) => s.cloneguard_decision.length > 0)).toBe(true));
  it("31. chaque scénario sellable_value", () => expect(scenarios.every((s) => s.sellable_value.length > 0)).toBe(true));
  it("32. chaque scénario demo_script", () => expect(scenarios.every((s) => s.demo_script.length > 0)).toBe(true));
  it("33. chaque scénario success_criteria", () => expect(scenarios.every((s) => s.success_criteria.length > 0)).toBe(true));
  it("34. chaque scénario no_autonomous_execution_confirmed true", () => expect(scenarios.every((s) => s.no_autonomous_execution_confirmed === true)).toBe(true));

  const allTasks = scenarios.flatMap((s) => s.tasks);
  it("35. chaque task approval_required boolean", () => expect(allTasks.every((t) => typeof t.approval_required === "boolean")).toBe(true));
  it("36. chaque task can_be_demoed boolean", () => expect(allTasks.every((t) => typeof t.can_be_demoed === "boolean")).toBe(true));
  it("37. chaque task can_be_executed_now false", () => expect(allTasks.every((t) => t.can_be_executed_now === false)).toBe(true));

  it("38. S1 bloque contrat / promesse sans validation", () => {
    const f = byId("S1").forbidden_outputs.join(" ");
    expect(f).toContain("Contrat officiel");
    expect(f).toContain("Promesse");
  });
  it("39. S2 bloque sanction auto / paie", () => {
    const f = byId("S2").forbidden_outputs.join(" ");
    expect(f).toContain("Sanction automatique");
    expect(f).toContain("Paie");
  });
  it("40. S3 bloque DSN / bulletin officiel", () => {
    const f = byId("S3").forbidden_outputs.join(" ");
    expect(f).toContain("DSN");
    expect(f).toContain("Bulletin officiel");
  });
  it("41. S4 bloque affectation imposée / planning officiel", () => {
    const f = byId("S4").forbidden_outputs.join(" ");
    expect(f).toContain("Affectation imposée");
    expect(f).toContain("Planning officiel");
  });
  it("42. S5 bloque sanction officielle / licenciement", () => {
    const f = byId("S5").forbidden_outputs.join(" ");
    expect(f).toContain("Sanction officielle");
    expect(f).toContain("Licenciement");
  });

  it("43. sellable proof scenarios_ready_for_demo true", () => expect(buildPierreWorkflowSellableProofSummary().scenarios_ready_for_demo).toBe(true));
  it("44. sellable proof first_sale_candidate true", () => expect(buildPierreWorkflowSellableProofSummary().first_sale_candidate).toBe(true));
  it("45. sellable proof public_launch_ready false", () => expect(buildPierreWorkflowSellableProofSummary().public_launch_ready).toBe(false));

  it("46. human validation matrix : 5 scénarios", () => expect(buildPierreWorkflowHumanValidationMatrix().length).toBe(5));
  it("47. legal risk : discrimination recrutement", () => expect(JSON.stringify(buildPierreWorkflowLegalRiskMatrix())).toContain("Discrimination recrutement"));
  it("48. legal risk : paie officielle", () => expect(JSON.stringify(buildPierreWorkflowLegalRiskMatrix())).toContain("Paie officielle"));
  it("49. legal risk : sanction disciplinaire", () => expect(JSON.stringify(buildPierreWorkflowLegalRiskMatrix())).toContain("Sanction disciplinaire"));

  it("50. traceability matrix : trace events requis", () => {
    const row = buildPierreWorkflowTraceabilityMatrix()[0];
    for (const ev of ["mission_created", "understanding_generated", "tasks_created", "guardrails_applied", "human_validation_required", "deliverables_prepared", "no_autonomous_execution_confirmed"]) {
      expect(row.events).toContain(ev);
    }
  });
  it("75. summary dit prochaine phase P6.3", () => expect(summarizePierreRealWorkflowCompletionPack(pack)).toContain("P6.3"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.2 — Routes, SQL, flag, UI, QA", () => {
  it("54. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("55. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("56. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("57. UI : « Pierre — 5 scénarios RH vendables »", () => expect(PIERRE_WORKFLOW_PACK_TITLE).toContain("Pierre — 5 scénarios RH vendables"));
  it("58. UI : « Aucune exécution autonome »", () => expect(PIERRE_WORKFLOW_PACK_MICROCOPY).toContain("Aucune exécution autonome"));
  it("59. UI : « Pierre n'est pas encore public-launch complete »", () => expect(PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE).toContain("public-launch complete"));
  it("60. page ne contient pas « Exécuter runtime »", () => expect(pageSrc).not.toContain("Exécuter runtime"));
  it("61. page ne contient pas « Envoyer email réel »", () => expect(pageSrc).not.toContain("Envoyer email réel"));
  it("62. page ne contient pas « Générer document officiel »", () => expect(pageSrc).not.toContain("Générer document officiel"));
  it("62b. page contient le titre 5 scénarios", () => expect(pageSrc).toContain("Pierre — 5 scénarios RH vendables"));
  it("63. QA checklist ready", () => {
    const checklist = buildPierreRealWorkflowCompletionPackQaChecklist();
    expect(checklist.phase).toBe("6.2");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildPierreRealWorkflowCompletionPackQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.workflow_pack_proof_only).toBe(true);
  });
  it("E1. package test:phase6-2", () => expect(packageJson).toContain("test:phase6-2"));
  it("E2. package check pack", () => expect(packageJson).toContain("check:pierre-real-workflow-completion-pack"));
  it("E3. doc mentionne PHASE 6.3", () => expect(docSrc).toContain("PHASE 6.3"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P6.1)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.2 — Cascade intacte", () => {
  it("64. P6.1 : audit ready_for_p6_2", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("65. P5.10 : closure ready_for_pierre_sellable_sprint", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("66. P5.9 : handbook documentation_ready", () => expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready"));
  it("67. P5.8 : transition ready_for_future_manual_sql_apply", () => expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply"));
  it("68. P5.7 : final gate go_for_next_design_phase", () => expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase"));
  it("69. P5.6 : restore state no GET", () => {
    readyMissionId();
    expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false);
  });
  it("70. P5.5 : manual activation QA ready", () => expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready"));
  it("71. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("72. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("73. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("74. P5.1 : create local controlled mission", () => expect(createLocalControlledMission(eligibleContract()).ok).toBe(true));
  const scriptsPkg = ["test:phase6-1", "test:phase5-10", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
