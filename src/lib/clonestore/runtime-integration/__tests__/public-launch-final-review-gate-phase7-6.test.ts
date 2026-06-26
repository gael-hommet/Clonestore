// src/lib/clonestore/runtime-integration/__tests__/public-launch-final-review-gate-phase7-6.test.ts
// PHASE 7.6 — Public Launch Final Review Gate — Tests

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  createLocalControlledMission,
  approveLocalControlledMission,
  runLocalControlledMissionPreflight,
  // P5.1 → P7.5 (intact)
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreSellableGateFinalReport,
  buildExternalGoLiveProofsReport,
  buildFirstLiveCustomerControlledRunReport,
  buildFirstCustomerEvidenceReviewReport,
  buildCustomerEvidenceAppliedSecondCustomerReport,
  buildSecondCustomerControlledRunPublicLaunchPrepReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P7.6
  buildPublicLaunchFinalReviewGateReport,
  buildPhase7CompletionMatrix,
  buildFinalProductSellabilityVerdict,
  buildExternalProofFinalMatrix,
  buildCustomerEvidenceFinalMatrix,
  buildLegalCommercialFinalMatrix,
  buildTechnicalOperationsFinalMatrix,
  buildPublicLaunchScorecard,
  buildBlockingConditions,
  buildConditionalGoRequirements,
  buildAllowedProductClaims,
  buildForbiddenProductClaims,
  buildImmediateOperationalActions,
  buildRollbackRequirements,
  buildFinalPublicLaunchDecision,
  buildPhase7ClosureVerdict,
  buildPublicLaunchFinalReviewGateQaChecklist,
  buildPublicLaunchFinalReviewGateQaVerdict,
  summarizePublicLaunchFinalReviewGateReport,
  PLF_TITLE,
  PLF_MICROCOPY,
  PLF_INTERNAL_VS_EXTERNAL,
  PLF_NOT_PUBLIC,
  PLF_NEXT_REAL,
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

const typesSrc = readSrc(`${RI_DIR}/public-launch-final-review-gate-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/public-launch-final-review-gate.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/public-launch-final-review-gate-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/public-launch-final-review-gate-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_7_6_PUBLIC_LAUNCH_FINAL_REVIEW_GATE.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_7_6_PUBLIC_LAUNCH_FINAL_REVIEW_GATE_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-public-launch-final-review-gate-phase7-6.mjs");
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

// ── Factory (cascade intacte P5.1) ─────────────────────────────────────────────

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

// ── Données P7.6 ────────────────────────────────────────────────────────────────

const report = buildPublicLaunchFinalReviewGateReport();
const phase7 = buildPhase7CompletionMatrix();
const phaseIds = phase7.map((p) => p.phase_id);
const verdict = buildFinalProductSellabilityVerdict();
const external = buildExternalProofFinalMatrix();
const customerEv = buildCustomerEvidenceFinalMatrix();
const legal = buildLegalCommercialFinalMatrix();
const technical = buildTechnicalOperationsFinalMatrix();
const scorecard = buildPublicLaunchScorecard();
const blockers = buildBlockingConditions().join(" ");
const allowed = buildAllowedProductClaims().join(" ");
const forbidden = buildForbiddenProductClaims().join(" ");
const actions = buildImmediateOperationalActions().map((a) => a.action).join(" ");
const rollback = buildRollbackRequirements().join(" ");
const decision = buildFinalPublicLaunchDecision();
const closure = buildPhase7ClosureVerdict();

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("78. no fetch in modules", () => expect(scanBlob).not.toContain("fetch"));
  it("79. no Stripe import", () => {
    expect(scanBlob).not.toContain('from "stripe');
    expect(scanBlob).not.toContain("@stripe");
  });
  it("80. no Supabase client", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("81. no OpenAI/Anthropic import", () => {
    expect(scanBlob.toLowerCase()).not.toContain("openai");
    expect(scanBlob.toLowerCase()).not.toContain("anthropic");
  });
  it("P8. modules ne contiennent pas import Pierre / /api/", () => {
    expect([typesSrc, moduleSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre');
    expect(scanBlob).not.toContain("/api/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Invariants (tests 1 → 27)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Invariants", () => {
  it("1. phase = 7.6", () => expect(report.phase).toBe("7.6"));
  it("2. phase_7_internal_gate_complete true", () => expect(report.phase_7_internal_gate_complete).toBe(true));
  it("3. ready_for_external_proof_execution true", () => expect(report.ready_for_external_proof_execution).toBe(true));
  it("4. controlled_first_customer_sellable true", () => expect(report.controlled_first_customer_sellable).toBe(true));
  it("5. controlled_second_customer_preparation_ready true", () => expect(report.controlled_second_customer_preparation_ready).toBe(true));
  it("6. public_launch_review_completed true", () => expect(report.public_launch_review_completed).toBe(true));
  it("7. public_launch_ready false", () => expect(report.public_launch_ready).toBe(false));
  it("8. external_proofs_complete false", () => expect(report.external_proofs_complete).toBe(false));
  it("9. customer_evidence_complete false", () => expect(report.customer_evidence_complete).toBe(false));
  it("10. multi_customer_evidence_ready false", () => expect(report.multi_customer_evidence_ready).toBe(false));
  it("11. reproducibility_verified false", () => expect(report.reproducibility_verified).toBe(false));
  it("12. stripe_live_verified false", () => expect(report.stripe_live_verified).toBe(false));
  it("13. supabase_prod_rls_verified false", () => expect(report.supabase_prod_rls_verified).toBe(false));
  it("14. domain_email_verified false", () => expect(report.domain_email_verified).toBe(false));
  it("15. legal_final_review_verified false", () => expect(report.legal_final_review_verified).toBe(false));
  it("16. support_readiness_verified false", () => expect(report.support_readiness_verified).toBe(false));
  it("17. production_monitoring_verified false", () => expect(report.production_monitoring_verified).toBe(false));
  it("18. real_payment_verified false", () => expect(report.real_payment_verified).toBe(false));
  it("19. first_customer_completed_verified false", () => expect(report.first_customer_completed_verified).toBe(false));
  it("20. second_customer_completed_verified false", () => expect(report.second_customer_completed_verified).toBe(false));
  it("21. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("22. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("23. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("24. official_document_generated false", () => expect(report.official_document_generated).toBe(false));
  it("25. go_live_proofs_modified false", () => expect(report.go_live_proofs_modified).toBe(false));
  it("26. env_modified false", () => expect(report.env_modified).toBe(false));
  it("27. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Phase 7 matrix & verdict (tests 28 → 38)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Phase 7 matrix & verdict", () => {
  it("28. Phase 7 matrix includes P7.1", () => expect(phaseIds).toContain("P7.1"));
  it("29. Phase 7 matrix includes P7.2", () => expect(phaseIds).toContain("P7.2"));
  it("30. Phase 7 matrix includes P7.3", () => expect(phaseIds).toContain("P7.3"));
  it("31. Phase 7 matrix includes P7.4", () => expect(phaseIds).toContain("P7.4"));
  it("32. Phase 7 matrix includes P7.5", () => expect(phaseIds).toContain("P7.5"));
  it("33. Internal gates ready true", () => expect(phase7.every((p) => p.internal_gate_ready === true)).toBe(true));
  it("34. Real-world proofs false", () => expect(phase7.every((p) => p.real_world_proof_complete === false)).toBe(true));
  it("35. Controlled first customer READY_WITH_LIMITS", () => expect(verdict.controlled_first_customer.verdict).toBe("READY_WITH_LIMITS"));
  it("36. Controlled second customer PREPARATION_READY", () => expect(verdict.controlled_second_customer.verdict).toBe("PREPARATION_READY"));
  it("37. Public launch BLOCKED", () => expect(verdict.public_launch.verdict).toBe("BLOCKED"));
  it("38. Scale NOT_PROVEN", () => expect(verdict.scale_80k.verdict).toBe("NOT_PROVEN"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Matrices finales & scorecard (tests 39 → 50)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Matrices finales & scorecard", () => {
  it("39. External matrix non-empty", () => expect(external.length).toBeGreaterThan(0));
  it("40. All external items verified false", () => expect(external.every((e) => e.verified === false)).toBe(true));
  it("41. All external links null", () => expect(external.every((e) => e.evidence_link === null && e.blocking_public_launch === true)).toBe(true));
  it("42. Customer evidence matrix non-empty", () => expect(customerEv.length).toBeGreaterThan(0));
  it("43. All customer evidence false", () => expect(customerEv.every((c) => c.verified === false && c.evidence_available === false)).toBe(true));
  it("44. Legal matrix non-empty", () => expect(legal.length).toBeGreaterThan(0));
  it("45. Legal review manual required", () => expect(legal.every((l) => l.manual_review_required === true && l.verified === false)).toBe(true));
  it("46. Technical matrix non-empty", () => expect(technical.length).toBeGreaterThan(0));
  it("47. Technical evidence links null", () => expect(technical.every((t) => t.evidence_link === null && t.verified === false)).toBe(true));
  it("48. Scorecard non-empty", () => expect(scorecard.length).toBeGreaterThan(0));
  it("49. All scorecard current score 0", () => expect(scorecard.every((sc) => sc.current_score === 0)).toBe(true));
  it("50. All scorecard verified false", () => expect(scorecard.every((sc) => sc.verified === false)).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Blockers, claims, actions, décision, clôture (tests 51 → 77)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Blockers, claims, actions, décision, clôture", () => {
  it("51. Blockers include Stripe", () => expect(blockers).toContain("Stripe"));
  it("52. Blockers include Supabase", () => expect(blockers).toContain("Supabase"));
  it("53. Blockers include domain/email", () => expect(blockers).toContain("Domaine"));
  it("54. Blockers include legal", () => expect(blockers).toContain("juridique"));
  it("55. Blockers include support", () => expect(blockers).toContain("Support"));
  it("56. Blockers include monitoring", () => expect(blockers).toContain("Monitoring"));
  it("57. Blockers include first customer", () => expect(blockers).toContain("premier client"));
  it("58. Blockers include second customer", () => expect(blockers).toContain("deuxième client"));
  it("59. Blockers include multi-customer", () => expect(blockers).toContain("multi-client"));
  it("60. Blockers include scale", () => expect(blockers).toContain("Scale 80k"));
  it("61. Conditional requirements non-empty", () => expect(buildConditionalGoRequirements().length).toBeGreaterThan(0));
  it("62. Allowed claims include controlled first customer", () => expect(allowed).toContain("premier client contrôlé"));
  it("63. Forbidden claims include public launch ready", () => expect(forbidden).toContain("Public launch ready"));
  it("64. Forbidden claims include autonomous payroll", () => expect(forbidden).toContain("Paie officielle automatisée"));
  it("65. Immediate actions include Stripe live", () => expect(actions).toContain("Stripe live"));
  it("66. Immediate actions include Supabase prod/RLS", () => expect(actions).toContain("Supabase production"));
  it("67. Immediate actions include domain/email", () => expect(actions).toContain("domaine"));
  it("68. Immediate actions include first real customer", () => expect(actions).toContain("premier client réel"));
  it("69. Rollback includes demo-only", () => expect(rollback).toContain("demo-only"));
  it("70. Final decision BLOCKED", () => expect(decision.decision).toBe("BLOCKED"));
  it("71. controlled_first_customer_allowed true", () => expect(decision.controlled_first_customer_allowed).toBe(true));
  it("72. public_marketing_launch_allowed false", () => expect(decision.public_marketing_launch_allowed).toBe(false));
  it("73. manual_controlled_sales_allowed true", () => expect(decision.manual_controlled_sales_allowed).toBe(true));
  it("74. Phase 7 internal work complete true", () => expect(closure.phase_7_internal_work_complete).toBe(true));
  it("75. Phase 7 external execution complete false", () => expect(closure.phase_7_external_execution_complete).toBe(false));
  it("76. no_more_read_only_gate_required true", () => expect(closure.no_more_read_only_gate_required_before_real_execution).toBe(true));
  it("77. next_step_must_be_real_external_proof_execution true", () => expect(closure.next_step_must_be_real_external_proof_execution).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Routes, SQL, flag, UI, QA, summary (tests 82 → 103)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Routes, SQL, flag, UI, QA", () => {
  it("82. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("83. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("84. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("85. UI contains « Pierre — Public Launch Final Review »", () => {
    expect(PLF_TITLE).toContain("Pierre — Public Launch Final Review");
    expect(pageSrc).toContain("Pierre — Public Launch Final Review");
  });
  it("86. UI : « preuves réelles obligatoires »", () => expect(PLF_MICROCOPY).toContain("preuves réelles obligatoires"));
  it("87. UI : « preuves externes ne le sont pas »", () => expect(PLF_INTERNAL_VS_EXTERNAL).toContain("preuves externes ne le sont pas"));
  it("88. UI : « lancement public reste bloqué »", () => expect(PLF_NOT_PUBLIC).toContain("lancement public reste bloqué"));
  it("89. UI : « pas un nouveau gate »", () => expect(PLF_NEXT_REAL).toContain("pas un nouveau gate"));
  it("90. UI does not contain active « Déclarer public launch »", () => expect(pageSrc).not.toContain("Déclarer public launch"));
  it("91. UI does not contain active « Marquer preuve vérifiée »", () => expect(pageSrc).not.toContain("Marquer preuve vérifiée"));
  it("92. UI does not contain active « Activer Stripe live »", () => expect(pageSrc).not.toContain("Activer Stripe live"));
  it("92b. page câble le final review (report)", () => expect(pageSrc).toContain("buildPublicLaunchFinalReviewGateReport"));
  it("93. QA checklist ready", () => {
    const cl = buildPublicLaunchFinalReviewGateQaChecklist();
    expect(cl.phase).toBe("7.6");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const v = buildPublicLaunchFinalReviewGateQaVerdict(cl.steps);
    expect(v.verdict).toBe("ready");
    expect(v.final_review_gate_only).toBe(true);
  });
  it("103. summary says next step Real External Proof Execution", () => {
    expect(summarizePublicLaunchFinalReviewGateReport(report)).toContain("Real External Proof Execution");
    expect(report.recommended_next_phase).toContain("REAL EXTERNAL PROOF EXECUTION");
  });
  it("E1. package test:phase7-6", () => expect(packageJson).toContain("test:phase7-6"));
  it("E2. package check + doc closure", () => {
    expect(packageJson).toContain("check:public-launch-final-review-gate");
    expect(docSrc).toContain("REAL EXTERNAL PROOF EXECUTION");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Cascade intacte (P5.1 → P7.5) (tests 94 → 102)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.6 — Cascade intacte", () => {
  it("94. P7.5 remains intact", () => expect(buildSecondCustomerControlledRunPublicLaunchPrepReport().run_status).toBe("ready_to_prepare_second_customer"));
  it("95. P7.4 remains intact", () => expect(buildCustomerEvidenceAppliedSecondCustomerReport().application_status).toBe("ready_to_apply_when_verified"));
  it("96. P7.3 remains intact", () => expect(buildFirstCustomerEvidenceReviewReport().review_status).toBe("ready_to_review_when_evidence_exists"));
  it("97. P7.2 remains intact", () => expect(buildFirstLiveCustomerControlledRunReport().run_status).toBe("ready_to_prepare_first_customer"));
  it("98. P7.1 remains intact", () => expect(buildExternalGoLiveProofsReport().public_launch_verdict).toBe("BLOCKED"));
  it("99. P6.6 remains intact", () => expect(buildPierreSellableGateFinalReport().final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("100. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("101. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("102. P5.1 remains intact", () => {
    const id = createLocalControlledMission(eligibleContract()).mission!.id;
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  const scriptsPkg = ["test:phase7-5", "test:phase7-4", "test:phase7-3", "test:phase7-2", "test:phase7-1", "test:phase6-6", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
