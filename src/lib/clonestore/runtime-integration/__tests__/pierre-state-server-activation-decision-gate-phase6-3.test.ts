// src/lib/clonestore/runtime-integration/__tests__/pierre-state-server-activation-decision-gate-phase6-3.test.ts
// PHASE 6.3 — Pierre State/Server Activation Decision Gate — Tests

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
  // P5.4 → P6.2 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionPersistenceOperatorHandbook,
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreRealWorkflowCompletionPack,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P6.3
  buildPierreStateServerActivationDecisionGate,
  buildPierreDecisionGateStrategyItems,
  buildPierreDecisionGateActivationConditions,
  buildPierreDecisionGateNoGoConditions,
  buildPierreDecisionGateApprovals,
  buildPierreDecisionGateRiskMatrix,
  buildPierreDecisionGateRollbackStrategy,
  buildPierreDecisionGateAuditTraceRequirements,
  buildPierreDecisionGateDependencyMap,
  buildPierreStateServerActivationDecisionGateQaChecklist,
  buildPierreStateServerActivationDecisionGateQaVerdict,
  summarizePierreStateServerActivationDecisionGate,
  PIERRE_DECISION_GATE_MICROCOPY,
  PIERRE_DECISION_GATE_SALE_VS_LAUNCH,
  PIERRE_DECISION_GATE_RUNTIME_INACTIVE,
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

const typesSrc = readSrc(`${RI_DIR}/pierre-state-server-activation-decision-gate-types.ts`);
const gateSrc = readSrc(`${RI_DIR}/pierre-state-server-activation-decision-gate.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/pierre-state-server-activation-decision-gate-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/pierre-state-server-activation-decision-gate-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_6_3_PIERRE_STATE_SERVER_ACTIVATION_DECISION_GATE.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_6_3_PIERRE_STATE_SERVER_ACTIVATION_DECISION_GATE_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-pierre-state-server-activation-decision-gate-phase6-3.mjs");
const packageJson = readRootFile("package.json");

const scanBlob = [typesSrc, gateSrc, uiCopySrc].join("\n");

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

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.3 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. gate existe", () => expect(gateSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("64. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("65. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("66. modules ne contiennent pas import du moteur Pierre", () => expect([typesSrc, gateSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre'));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Decision gate
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.3 — Decision gate", () => {
  const gate = buildPierreStateServerActivationDecisionGate();

  it("1. phase = 6.3", () => expect(gate.phase).toBe("6.3"));
  it("2. ready_for_p6_4 true", () => expect(gate.ready_for_p6_4).toBe(true));
  it("3. recommended_strategy local_first_controlled_sale", () => expect(gate.recommended_strategy).toBe("local_first_controlled_sale"));
  it("4. server_persistence_activated false", () => expect(gate.server_persistence_activated).toBe(false));
  it("5. runtime_execution_activated false", () => expect(gate.runtime_execution_activated).toBe(false));
  it("6. sql_applied false", () => expect(gate.sql_applied).toBe(false));
  it("7. server_flag_enabled false", () => expect(gate.server_flag_enabled).toBe(false));
  it("8. route_created false", () => expect(gate.route_created).toBe(false));
  it("9. server_get_created false", () => expect(gate.server_get_created).toBe(false));
  it("10. server_post_created false", () => expect(gate.server_post_created).toBe(false));
  it("11. email_sent false", () => expect(gate.email_sent).toBe(false));
  it("12. official_document_generated false", () => expect(gate.official_document_generated).toBe(false));
  it("13. ai_call_performed false", () => expect(gate.ai_call_performed).toBe(false));
  it("14. pierre_fully_sellable_declared false", () => expect(gate.pierre_fully_sellable_declared).toBe(false));
  it("15. public_launch_validated false", () => expect(gate.public_launch_validated).toBe(false));
  it("16. scale_80k_proven false", () => expect(gate.scale_80k_proven).toBe(false));

  it("17. première vente allow_with_limits", () => expect(gate.first_sale_state_strategy.decision).toBe("allow_with_limits"));
  it("18. public launch block/future", () => expect(["block", "future"]).toContain(gate.public_launch_state_strategy.decision));
  it("19. runtime future/block", () => expect(["future", "block"]).toContain(gate.runtime_strategy.decision));
  it("20. server persistence future", () => expect(["future"]).toContain(gate.server_persistence_strategy.decision));

  const items = buildPierreDecisionGateStrategyItems().map((x) => x.id);
  it("21. strategy : local-first controlled sale", () => expect(items).toContain("st_local_first"));
  it("22. strategy : server persistence", () => expect(items).toContain("st_server_persistence"));
  it("23. strategy : runtime execution", () => expect(items).toContain("st_runtime"));
  it("24. strategy : email sending", () => expect(items).toContain("st_email"));
  it("25. strategy : official document generation", () => expect(items).toContain("st_document"));
  it("26. strategy : public launch", () => expect(items).toContain("st_public_launch"));
  it("27. strategy : scale 80k", () => expect(items).toContain("st_scale"));

  const cond = buildPierreDecisionGateActivationConditions().join(" ");
  it("28. activation : SQL manual evidence", () => expect(cond).toContain("SQL manual evidence"));
  it("29. activation : RLS verified", () => expect(cond).toContain("RLS verified"));
  it("30. activation : feature flag", () => expect(cond.toLowerCase()).toContain("feature flag"));
  it("31. activation : routes reviewed", () => expect(cond).toContain("routes reviewed"));
  it("32. activation : idempotency", () => expect(cond).toContain("idempotency"));
  it("33. activation : audit events", () => expect(cond).toContain("Audit events"));
  it("34. activation : rollback", () => expect(cond).toContain("Rollback"));

  const nogo = buildPierreDecisionGateNoGoConditions().join(" ");
  it("35. no-go : SQL not applied", () => expect(nogo).toContain("SQL not applied"));
  it("36. no-go : RLS not verified", () => expect(nogo).toContain("RLS not verified"));
  it("37. no-go : flag false", () => expect(nogo).toContain("flag false"));
  it("38. no-go : no rollback", () => expect(nogo).toContain("no rollback"));
  it("39. no-go : public launch external not validated", () => expect(nogo).toContain("Public launch external not validated"));
  it("40. no-go : scale 80k not proven", () => expect(nogo).toContain("Scale 80k not proven"));

  const approvals = buildPierreDecisionGateApprovals();
  const cats = approvals.map((a) => a.category);
  it("41. approval : server persistence activation", () => expect(cats).toContain("server_persistence_activation"));
  it("42. approval : runtime execution", () => expect(cats).toContain("runtime_execution"));
  it("43. approval : email sending", () => expect(cats).toContain("email_sending"));
  it("44. approval : official document generation", () => expect(cats).toContain("official_document_generation"));
  it("45. approval : payroll actions", () => expect(cats).toContain("payroll_actions"));
  it("46. approval : legal/disciplinary actions", () => expect(cats).toContain("legal_disciplinary_actions"));
  it("47. approval : public launch", () => expect(cats).toContain("public_launch"));
  it("48. catégories sensibles : can_be_self_approved false", () => expect(approvals.every((a) => a.can_be_self_approved === false)).toBe(true));

  const risks = JSON.stringify(buildPierreDecisionGateRiskMatrix()).toLowerCase();
  it("49. risk : activating server too early", () => expect(risks).toContain("activating server too early"));
  it("50. risk : confusing controlled sale with public launch", () => expect(risks).toContain("confusing controlled sale with public launch"));
  it("51. risk : runtime without guardrails", () => expect(risks).toContain("runtime execution without guardrails"));
  it("52. risk : payroll/legal side effects", () => expect(risks).toContain("payroll/legal side effects"));

  const rollback = buildPierreDecisionGateRollbackStrategy().join(" ");
  it("53. rollback : disable flag", () => expect(rollback).toContain("disable flag"));
  it("54. rollback : revert to local-first", () => expect(rollback).toContain("revert to local-first"));
  it("55. rollback : freeze runtime", () => expect(rollback).toContain("freeze runtime"));
  it("56. rollback : block email/document execution", () => expect(rollback).toContain("block email/document execution"));

  const trace = buildPierreDecisionGateAuditTraceRequirements();
  it("57. trace : decision_gate_created", () => expect(trace).toContain("decision_gate_created"));
  it("58. trace : activation_not_performed", () => expect(trace).toContain("activation_not_performed"));
  it("59. trace : no_public_launch_confirmed", () => expect(trace).toContain("no_public_launch_confirmed"));
  it("60. trace : no_runtime_execution_confirmed", () => expect(trace).toContain("no_runtime_execution_confirmed"));

  const deps = buildPierreDecisionGateDependencyMap().map((x) => x.id);
  it("61. dependency : P6.4", () => expect(deps).toContain("P6.4"));
  it("62. dependency : P6.5", () => expect(deps).toContain("P6.5"));
  it("63. dependency : P6.6", () => expect(deps).toContain("P6.6"));
  it("90. summary dit prochaine phase P6.4", () => expect(summarizePierreStateServerActivationDecisionGate(gate)).toContain("P6.4"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.3 — Routes, SQL, flag, UI, QA", () => {
  it("67. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("68. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("69. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("70. UI : « Decision Gate Pierre »", () => expect(PIERRE_DECISION_GATE_MICROCOPY).toContain("Decision Gate Pierre"));
  it("71. UI : « Aucune activation »", () => expect(PIERRE_DECISION_GATE_MICROCOPY).toContain("Aucune activation"));
  it("72. UI : « Première vente contrôlée ≠ lancement public »", () => expect(PIERRE_DECISION_GATE_SALE_VS_LAUNCH).toContain("Première vente contrôlée ≠ lancement public"));
  it("73. UI : « runtime autonome reste inactif »", () => expect(PIERRE_DECISION_GATE_RUNTIME_INACTIVE).toContain("runtime autonome reste inactif"));
  it("74. page ne contient pas « Appliquer SQL »", () => expect(pageSrc).not.toContain("Appliquer SQL"));
  it("75. page ne contient pas « Activer serveur »", () => expect(pageSrc).not.toContain("Activer serveur"));
  it("76. page ne contient pas « Exécuter runtime »", () => expect(pageSrc).not.toContain("Exécuter runtime"));
  it("76b. page câble le decision gate (constante)", () => expect(pageSrc).toContain("PIERRE_DECISION_GATE_MICROCOPY"));
  it("77. QA checklist ready", () => {
    const checklist = buildPierreStateServerActivationDecisionGateQaChecklist();
    expect(checklist.phase).toBe("6.3");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildPierreStateServerActivationDecisionGateQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.decision_gate_only).toBe(true);
  });
  it("E1. package test:phase6-3", () => expect(packageJson).toContain("test:phase6-3"));
  it("E2. package check gate", () => expect(packageJson).toContain("check:pierre-state-server-activation-decision-gate"));
  it("E3. doc mentionne PHASE 6.4", () => expect(docSrc).toContain("PHASE 6.4"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P6.2)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.3 — Cascade intacte", () => {
  it("78. P6.2 : 5 scénarios prêts", () => expect(buildPierreRealWorkflowCompletionPack().pack_status).toBe("scenarios_ready_for_demo"));
  it("79. P6.1 : audit ready_for_p6_2", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("80. P5.10 : closure ready_for_pierre_sellable_sprint", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("81. P5.9 : handbook documentation_ready", () => expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready"));
  it("82. P5.8 : transition ready_for_future_manual_sql_apply", () => expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply"));
  it("83. P5.7 : final gate go_for_next_design_phase", () => expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase"));
  it("84. P5.6 : restore no GET", () => {
    readyMissionId();
    expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false);
  });
  it("85. P5.5 : manual activation QA ready", () => expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready"));
  it("86. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("87. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("88. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("89. P5.1 : create local controlled mission", () => expect(createLocalControlledMission(eligibleContract()).ok).toBe(true));
  const scriptsPkg = ["test:phase6-2", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
