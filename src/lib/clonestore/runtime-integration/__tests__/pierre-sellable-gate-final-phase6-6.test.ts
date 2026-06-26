// src/lib/clonestore/runtime-integration/__tests__/pierre-sellable-gate-final-phase6-6.test.ts
// PHASE 6.6 — Pierre Sellable Gate Final — Tests

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
  // P5.1 → P6.5 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionPersistenceOperatorHandbook,
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreRealWorkflowCompletionPack,
  buildPierreStateServerActivationDecisionGate,
  buildPierreChannelsIdentityFinalReport,
  buildPierreCustomerActivationE2EFinalReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P6.6
  buildPierreSellableGateFinalReport,
  buildPierreP6PhaseMatrix,
  buildPierreSellabilityVerdictMatrix,
  buildPierreSellableEvidenceSummary,
  buildPierreControlledSaleConditions,
  buildPierrePublicLaunchBlockers,
  buildPierreScaleBlockers,
  buildPierreCustomerPromiseAllowed,
  buildPierreCustomerPromiseForbidden,
  buildPierreOperationalPlaybook,
  buildPierreInternalOperatorChecklist,
  buildPierreSellableRiskMatrix,
  buildPierreSellableGateFinalQaChecklist,
  buildPierreSellableGateFinalQaVerdict,
  summarizePierreSellableGateFinalReport,
  PIERRE_GATE_TITLE,
  PIERRE_GATE_MICROCOPY,
  PIERRE_GATE_CONTROLLED_SELLABLE,
  PIERRE_GATE_NOT_PUBLIC,
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

const typesSrc = readSrc(`${RI_DIR}/pierre-sellable-gate-final-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/pierre-sellable-gate-final.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/pierre-sellable-gate-final-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/pierre-sellable-gate-final-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_6_6_PIERRE_SELLABLE_GATE_FINAL.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_6_6_PIERRE_SELLABLE_GATE_FINAL_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-pierre-sellable-gate-final-phase6-6.mjs");
const packageJson = readRootFile("package.json");

const scanBlob = [typesSrc, moduleSrc, uiCopySrc].join("\n");

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

// ── Factories (cascade intacte P5) ─────────────────────────────────────────────

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

// ── Données P6.6 ────────────────────────────────────────────────────────────────

const report = buildPierreSellableGateFinalReport();
const phaseMatrix = buildPierreP6PhaseMatrix();
const phaseIds = phaseMatrix.map((p) => p.phase);
const verdictMatrix = buildPierreSellabilityVerdictMatrix();
const verdictBy = (tier: string) => verdictMatrix.find((v) => v.tier === tier)!;
const publicBlockers = buildPierrePublicLaunchBlockers().join(" ");
const scaleBlockers = buildPierreScaleBlockers().join(" ");
const allowed = buildPierreCustomerPromiseAllowed().join(" ");
const forbidden = buildPierreCustomerPromiseForbidden().join(" ");
const conditions = buildPierreControlledSaleConditions().join(" ");
const playbook = buildPierreOperationalPlaybook();
const checklist = buildPierreInternalOperatorChecklist();
const riskMatrix = buildPierreSellableRiskMatrix().map((r) => r.risk).join(" ");
const evidence = buildPierreSellableEvidenceSummary().map((e) => `${e.phase} ${e.label}`).join(" ");

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.6 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("P8. modules ne contiennent pas import Pierre / /api/", () => {
    expect([typesSrc, moduleSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre');
    expect(scanBlob).not.toContain("/api/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Verdict final & invariants (tests 1 → 30)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.6 — Verdict final & invariants", () => {
  it("1. phase = 6.6", () => expect(report.phase).toBe("6.6"));
  it("2. ready_for_external_go_live_proofs true", () => expect(report.ready_for_external_go_live_proofs).toBe(true));
  it("3. ready_for_first_controlled_customer true", () => expect(report.ready_for_first_controlled_customer).toBe(true));
  it("4. final_sellability_level controlled_first_customer_sellable", () => expect(report.final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("5. controlled_first_sale_ready true", () => expect(report.controlled_first_sale_ready).toBe(true));
  it("6. first_customer_sellable_with_limits true", () => expect(report.first_customer_sellable_with_limits).toBe(true));
  it("7. public_launch_ready false", () => expect(report.public_launch_ready).toBe(false));
  it("8. scale_ready false", () => expect(report.scale_ready).toBe(false));
  it("9. pierre_fully_sellable_public_launch false", () => expect(report.pierre_fully_sellable_public_launch).toBe(false));
  it("10. stripe_live_payment_proven false", () => expect(report.stripe_live_payment_proven).toBe(false));
  it("11. supabase_prod_verified false", () => expect(report.supabase_prod_verified).toBe(false));
  it("12. domain_email_prod_verified false", () => expect(report.domain_email_prod_verified).toBe(false));
  it("13. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("14. server_persistence_active false", () => expect(report.server_persistence_active).toBe(false));
  it("15. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("16. official_document_generated false", () => expect(report.official_document_generated).toBe(false));
  it("17. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("18. sql_applied false", () => expect(report.sql_applied).toBe(false));
  it("19. env_modified false", () => expect(report.env_modified).toBe(false));
  it("20. public_launch_validated false", () => expect(report.public_launch_validated).toBe(false));
  it("21. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("22. P6 matrix includes P6.1", () => expect(phaseIds).toContain("P6.1"));
  it("23. P6 matrix includes P6.2", () => expect(phaseIds).toContain("P6.2"));
  it("24. P6 matrix includes P6.3", () => expect(phaseIds).toContain("P6.3"));
  it("25. P6 matrix includes P6.4", () => expect(phaseIds).toContain("P6.4"));
  it("26. P6 matrix includes P6.5", () => expect(phaseIds).toContain("P6.5"));
  it("27. verdict matrix includes controlled first customer", () => expect(verdictBy("controlled_first_customer")).toBeDefined());
  it("28. verdict controlled first customer READY_WITH_LIMITS", () => expect(verdictBy("controlled_first_customer").verdict).toBe("READY_WITH_LIMITS"));
  it("29. verdict matrix includes public launch BLOCKED", () => expect(verdictBy("public_launch").verdict).toBe("BLOCKED"));
  it("30. verdict matrix includes scale NOT_PROVEN", () => expect(verdictBy("scale_80k").verdict).toBe("NOT_PROVEN"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Evidence, conditions, blockers, promesses (tests 31 → 54)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.6 — Evidence, conditions, blockers, promesses", () => {
  it("31. evidence summary includes audit/scenarios/decision/identity/journey", () => {
    expect(evidence).toContain("P6.1");
    expect(evidence).toContain("P6.2");
    expect(evidence).toContain("P6.3");
    expect(evidence).toContain("P6.4");
    expect(evidence).toContain("P6.5");
  });
  it("32. controlled sale conditions non-empty", () => expect(buildPierreControlledSaleConditions().length).toBeGreaterThan(0));
  it("33. controlled sale conditions include no runtime autonomous", () => expect(conditions).toContain("runtime autonome"));
  it("34. controlled sale conditions include no email live promise", () => expect(conditions).toContain("email live"));
  it("35. controlled sale conditions include human validation", () => expect(conditions).toContain("Validations humaines"));
  it("36. public launch blockers include Stripe live", () => expect(publicBlockers).toContain("Stripe live"));
  it("37. public launch blockers include Supabase prod/RLS", () => expect(publicBlockers).toContain("Supabase prod / RLS"));
  it("38. public launch blockers include domain/email", () => expect(publicBlockers).toContain("Domaine / email prod"));
  it("39. public launch blockers include paid customer E2E live", () => expect(publicBlockers).toContain("Paid customer E2E live"));
  it("40. public launch blockers include legal review", () => expect(publicBlockers).toContain("Revue légale"));
  it("41. scale blockers include load tests", () => expect(scaleBlockers).toContain("Load tests"));
  it("42. scale blockers include DB scaling", () => expect(scaleBlockers).toContain("DB scaling"));
  it("43. scale blockers include cost scaling", () => expect(scaleBlockers).toContain("Cost scaling"));
  it("44. allowed promises include employee AI HR", () => expect(allowed).toContain("employé IA RH"));
  it("45. allowed promises include 5 HR scenarios", () => expect(allowed).toContain("5 scénarios RH"));
  it("46. allowed promises include drafts/checklists/plans", () => {
    expect(allowed).toContain("brouillons");
    expect(allowed).toContain("checklists");
    expect(allowed).toContain("plans");
  });
  it("47. allowed promises include human validation", () => expect(allowed).toContain("validation humaine"));
  it("48. forbidden promises include replaces HR completely", () => expect(forbidden).toContain("remplace totalement votre RH"));
  it("49. forbidden promises include automatic emails", () => expect(forbidden).toContain("emails automatiquement"));
  it("50. forbidden promises include official payroll", () => expect(forbidden).toContain("paie officielle"));
  it("51. forbidden promises include signs documents", () => expect(forbidden).toContain("signe des documents"));
  it("52. forbidden promises include sanctions/dismissal", () => expect(forbidden).toContain("sanctionne ou licencie"));
  it("53. forbidden promises include public launch ready", () => expect(forbidden).toContain("lancement public massif"));
  it("54. forbidden promises include 80k clients", () => expect(forbidden).toContain("80k clients"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Playbook, checklist, risques, décision (tests 55 → 60, 91 → 96)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.6 — Playbook, checklist, risques, décision", () => {
  it("55. operational playbook has first client steps", () => {
    expect(playbook.length).toBeGreaterThan(0);
    expect(playbook.some((p) => p.step === "select customer")).toBe(true);
    expect(playbook.some((p) => p.step === "produce first output")).toBe(true);
  });
  it("56. internal checklist has no runtime/no email/no public claim", () => {
    const labels = checklist.map((c) => c.label).join(" ");
    expect(labels).toContain("Aucun runtime");
    expect(labels).toContain("Aucun email");
    expect(labels).toContain("Aucune revendication publique");
  });
  it("56b. playbook steps all no_runtime/no_email/no_public_claim", () => {
    expect(playbook.every((p) => p.no_runtime === true && p.no_email === true && p.no_public_claim === true)).toBe(true);
  });
  it("57. risk matrix includes overclaiming public launch", () => expect(riskMatrix).toContain("Overclaiming public launch"));
  it("58. risk matrix includes legal/payroll misunderstanding", () => expect(riskMatrix).toContain("Legal / payroll misunderstanding"));
  it("59. risk matrix includes email/domain confusion", () => expect(riskMatrix).toContain("Email / domain confusion"));
  it("60. risk matrix includes scale claim", () => expect(riskMatrix).toContain("Scale claim"));

  it("91. summary says next phase External Go-Live Proofs", () => {
    expect(summarizePierreSellableGateFinalReport(report)).toContain("External Go-Live Proofs");
    expect(report.recommended_next_phase.toLowerCase()).toContain("external go-live proofs");
  });
  it("92. final decision does not declare public launch", () => {
    expect(report.final_decision).toContain("n'est PAS public-launch sellable");
    expect(report.public_launch_ready).toBe(false);
  });
  it("93. final decision does not declare scale ready", () => {
    expect(report.final_decision).toContain("n'est PAS scale-ready");
    expect(report.scale_ready).toBe(false);
  });
  it("94. final decision allows first controlled customer", () => {
    expect(report.final_decision).toContain("controlled-sellable");
    expect(report.controlled_first_sale_ready).toBe(true);
  });
  it("95. phase 6 closure statement present", () => {
    expect(report.phase_6_closure_statement.length).toBeGreaterThan(0);
    expect(report.phase_6_closure_statement).toContain("PREMIER CLIENT CONTRÔLÉ");
  });
  it("96. report says Pierre is controlled-sellable, not public-launch sellable", () => {
    expect(report.final_sellability_level).toBe("controlled_first_customer_sellable");
    expect(report.gate_status).toBe("controlled_sellability_ready");
    expect(summarizePierreSellableGateFinalReport(report)).toContain("PAS public-launch sellable");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Pureté modules, routes, SQL, flag, UI (tests 61 → 74)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.6 — Pureté modules, routes, SQL, flag, UI", () => {
  it("61. no fetch in modules", () => expect(scanBlob).not.toContain("fetch"));
  it("62. no Stripe import", () => {
    expect(scanBlob).not.toContain('from "stripe');
    expect(scanBlob).not.toContain("@stripe");
  });
  it("63. no Supabase client", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("64. no OpenAI/Anthropic import", () => {
    expect(scanBlob.toLowerCase()).not.toContain("openai");
    expect(scanBlob.toLowerCase()).not.toContain("anthropic");
  });
  it("65. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("66. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("67. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("68. UI contains « Pierre — Sellable Gate Final »", () => {
    expect(PIERRE_GATE_TITLE).toContain("Pierre — Sellable Gate Final");
    expect(pageSrc).toContain("Pierre — Sellable Gate Final");
  });
  it("69. UI contains « verdict contrôlé »", () => expect(PIERRE_GATE_MICROCOPY).toContain("verdict contrôlé"));
  it("70. UI contains « première vente contrôlée avec limites »", () => expect(PIERRE_GATE_CONTROLLED_SELLABLE).toContain("première vente contrôlée avec limites"));
  it("71. UI contains « n'est pas encore prêt pour un lancement public »", () => expect(PIERRE_GATE_NOT_PUBLIC).toContain("n'est pas encore prêt pour un lancement public"));
  it("72. UI does not contain active « Déclarer public launch »", () => expect(pageSrc).not.toContain("Déclarer public launch"));
  it("73. UI does not contain active « Déclarer scale ready »", () => expect(pageSrc).not.toContain("Déclarer scale ready"));
  it("74. UI does not contain active « Activer Stripe live »", () => expect(pageSrc).not.toContain("Activer Stripe live"));
  it("75. QA checklist ready", () => {
    const cl = buildPierreSellableGateFinalQaChecklist();
    expect(cl.phase).toBe("6.6");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const verdict = buildPierreSellableGateFinalQaVerdict(cl.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.controlled_sellability_verdict_only).toBe(true);
  });
  it("E1. package test:phase6-6", () => expect(packageJson).toContain("test:phase6-6"));
  it("E2. package check sellable gate", () => expect(packageJson).toContain("check:pierre-sellable-gate-final"));
  it("E3. doc mentionne External Go-Live Proofs", () => expect(docSrc.toLowerCase()).toContain("external go-live proofs"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte (P5.1 → P6.5) (tests 76 → 90)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.6 — Cascade intacte", () => {
  it("76. P6.5 remains intact", () => expect(buildPierreCustomerActivationE2EFinalReport().activation_status).toBe("first_paid_customer_path_ready"));
  it("77. P6.4 remains intact", () => expect(buildPierreChannelsIdentityFinalReport().identity_status).toBe("channels_ready_for_first_sale"));
  it("78. P6.3 remains intact", () => expect(buildPierreStateServerActivationDecisionGate().recommended_strategy).toBe("local_first_controlled_sale"));
  it("79. P6.2 remains intact", () => expect(buildPierreRealWorkflowCompletionPack().pack_status).toBe("scenarios_ready_for_demo"));
  it("80. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("81. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("82. P5.9 remains intact", () => expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready"));
  it("83. P5.8 remains intact", () => expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply"));
  it("84. P5.7 remains intact", () => expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase"));
  it("85. P5.6 remains intact", () => { readyMissionId(); expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false); });
  it("86. P5.5 remains intact", () => expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready"));
  it("87. P5.4 remains intact", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("88. P5.3 remains intact", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("89. P5.2 remains intact", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("90. P5.1 remains intact", () => expect(createLocalControlledMission(eligibleContract()).ok).toBe(true));
  const scriptsPkg = ["test:phase6-5", "test:phase6-4", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
