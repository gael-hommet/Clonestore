// src/lib/clonestore/runtime-integration/__tests__/first-customer-evidence-review-phase7-3.test.ts
// PHASE 7.3 — First Customer Evidence Review — Tests

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
  // P5.1 → P7.2 (intact)
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreCustomerActivationE2EFinalReport,
  buildPierreSellableGateFinalReport,
  buildExternalGoLiveProofsReport,
  buildFirstLiveCustomerControlledRunReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P7.3
  buildFirstCustomerEvidenceReviewReport,
  buildEvidenceReviewMatrix,
  buildRequiredEvidenceCategories,
  buildVerificationRules,
  buildSuccessCriteria,
  buildFailureCriteria,
  buildPartialSuccessCriteria,
  buildEvidenceQualityScores,
  buildPublicLaunchDecisionGate,
  buildGoLiveProofUpdateRecommendation,
  buildCustomerContinuationRecommendation,
  buildOperatorReviewChecklist,
  buildLegalCommercialReviewChecklist,
  buildTechnicalReviewChecklist,
  buildPostRunDecisionMatrix,
  buildFirstCustomerEvidenceReviewQaChecklist,
  buildFirstCustomerEvidenceReviewQaVerdict,
  summarizeFirstCustomerEvidenceReviewReport,
  FCER_TITLE,
  FCER_MICROCOPY,
  FCER_NO_AUTO_VALIDATION,
  FCER_NOT_PUBLIC,
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

const typesSrc = readSrc(`${RI_DIR}/first-customer-evidence-review-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/first-customer-evidence-review.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/first-customer-evidence-review-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/first-customer-evidence-review-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_7_3_FIRST_CUSTOMER_EVIDENCE_REVIEW.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_7_3_FIRST_CUSTOMER_EVIDENCE_REVIEW_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-first-customer-evidence-review-phase7-3.mjs");
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

// ── Données P7.3 ────────────────────────────────────────────────────────────────

const report = buildFirstCustomerEvidenceReviewReport();
const matrix = buildEvidenceReviewMatrix();
const categories = matrix.map((m) => m.category);
const required = buildRequiredEvidenceCategories().join(" ");
const rules = buildVerificationRules().join(" ");
const success = buildSuccessCriteria().join(" ");
const failure = buildFailureCriteria().join(" ");
const scores = buildEvidenceQualityScores();
const gate = buildPublicLaunchDecisionGate();
const goLive = buildGoLiveProofUpdateRecommendation();
const continuation = buildCustomerContinuationRecommendation();
const decisionMatrix = buildPostRunDecisionMatrix();
const decisionConditions = decisionMatrix.map((d) => d.condition);

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.3 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
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
  it("P8. modules ne contiennent pas import Pierre / /api/", () => {
    expect([typesSrc, moduleSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre');
    expect(scanBlob).not.toContain("/api/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Statut & invariants (tests 1 → 19)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.3 — Statut & invariants", () => {
  it("1. phase = 7.3", () => expect(report.phase).toBe("7.3"));
  it("2. ready_to_review_first_customer_evidence true", () => expect(report.ready_to_review_first_customer_evidence).toBe(true));
  it("3. first_customer_evidence_review_completed false", () => expect(report.first_customer_evidence_review_completed).toBe(false));
  it("4. real_customer_verified false", () => expect(report.real_customer_verified).toBe(false));
  it("5. real_payment_verified false", () => expect(report.real_payment_verified).toBe(false));
  it("6. contract_signed_verified false", () => expect(report.contract_signed_verified).toBe(false));
  it("7. setup_completed_verified false", () => expect(report.setup_completed_verified).toBe(false));
  it("8. first_value_delivered_verified false", () => expect(report.first_value_delivered_verified).toBe(false));
  it("9. feedback_collected_verified false", () => expect(report.feedback_collected_verified).toBe(false));
  it("10. evidence_complete_verified false", () => expect(report.evidence_complete_verified).toBe(false));
  it("11. go_live_proof_update_allowed false", () => expect(report.go_live_proof_update_allowed).toBe(false));
  it("12. public_launch_ready false", () => expect(report.public_launch_ready).toBe(false));
  it("13. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("14. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("15. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("16. official_document_generated false", () => expect(report.official_document_generated).toBe(false));
  it("17. go_live_proofs_modified false", () => expect(report.go_live_proofs_modified).toBe(false));
  it("18. env_modified false", () => expect(report.env_modified).toBe(false));
  it("19. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("19b. review_status ready_to_review_when_evidence_exists", () => expect(report.review_status).toBe("ready_to_review_when_evidence_exists"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Evidence matrix & catégories (tests 20 → 37)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.3 — Evidence matrix & catégories", () => {
  it("20. evidence matrix non-empty", () => expect(matrix.length).toBeGreaterThan(0));
  it("21. matrix includes customer_identity", () => expect(categories).toContain("customer_identity"));
  it("22. matrix includes contract_cgv", () => expect(categories).toContain("contract_cgv"));
  it("23. matrix includes payment_or_controlled_activation", () => expect(categories).toContain("payment_or_controlled_activation"));
  it("24. matrix includes access_activation", () => expect(categories).toContain("access_activation"));
  it("25. matrix includes setup_completion", () => expect(categories).toContain("setup_completion"));
  it("26. matrix includes scenario_selection", () => expect(categories).toContain("scenario_selection"));
  it("27. matrix includes controlled_mission_creation", () => expect(categories).toContain("controlled_mission_creation"));
  it("28. matrix includes first_output_delivery", () => expect(categories).toContain("first_output_delivery"));
  it("29. matrix includes human_validation", () => expect(categories).toContain("human_validation"));
  it("30. matrix includes customer_feedback", () => expect(categories).toContain("customer_feedback"));
  it("31. matrix includes incident_log", () => expect(categories).toContain("incident_log"));
  it("32. matrix includes post_run_decision", () => expect(categories).toContain("post_run_decision"));
  it("33. every matrix status missing", () => expect(matrix.every((m) => m.status === "missing")).toBe(true));
  it("34. every matrix verified false", () => expect(matrix.every((m) => m.verified === false)).toBe(true));
  it("35. required categories include real customer", () => expect(required).toContain("Client réel"));
  it("36. required categories include contract", () => expect(required).toContain("Contrat / CGV"));
  it("37. required categories include first output", () => expect(required).toContain("Premier livrable"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Règles, critères, scores, gate, recommandations (tests 38 → 60)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.3 — Règles, critères, scores, gate", () => {
  it("38. verification rules include dated proof", () => expect(rules).toContain("Preuve datée"));
  it("39. verification rules include verifiable proof", () => expect(rules).toContain("Preuve vérifiable"));
  it("40. verification rules include no auto-validation", () => expect(rules).toContain("auto-validée"));
  it("41. success criteria include real customer", () => expect(success).toContain("Client réel vérifié"));
  it("42. success criteria include human validation", () => expect(success).toContain("Validation humaine"));
  it("43. failure criteria include absent contract", () => expect(failure).toContain("Contrat / CGV absent"));
  it("44. failure criteria include unverifiable evidence", () => expect(failure).toContain("non vérifiable"));
  it("45. partial criteria non-empty", () => expect(buildPartialSuccessCriteria().length).toBeGreaterThan(0));
  it("46. quality scores all current_score 0", () => expect(scores.every((s) => s.current_score === 0)).toBe(true));
  it("46b. quality scores 6 dimensions", () => expect(scores.length).toBe(6));
  it("47. public launch gate ready false", () => expect(gate.public_launch_ready).toBe(false));
  it("47b. public launch gate final decision blocked", () => expect(gate.final_public_launch_decision).toBe("blocked"));
  it("48. public launch gate one customer not enough", () => expect(gate.one_customer_success_is_not_public_launch).toBe(true));
  it("49. public launch gate requires Stripe/Supabase/domain/legal", () => {
    expect(gate.requires_stripe_live_proof).toBe(true);
    expect(gate.requires_supabase_prod_rls_proof).toBe(true);
    expect(gate.requires_domain_email_proof).toBe(true);
    expect(gate.requires_legal_review).toBe(true);
  });
  it("50. go-live recommendation update false", () => expect(goLive.update_recommended).toBe(false));
  it("51. go-live recommendation manual review only", () => {
    expect(goLive.update_allowed_only_after_manual_review).toBe(true);
    expect(goLive.never_auto_update).toBe(true);
  });
  it("52. customer continuation default request_more_evidence", () => expect(continuation.recommended).toBe("request_more_evidence"));
  it("53. operator checklist non-empty", () => expect(buildOperatorReviewChecklist().length).toBeGreaterThan(0));
  it("54. legal checklist non-empty", () => expect(buildLegalCommercialReviewChecklist().length).toBeGreaterThan(0));
  it("55. technical checklist non-empty", () => expect(buildTechnicalReviewChecklist().length).toBeGreaterThan(0));
  it("56. post-run matrix includes evidence missing", () => expect(decisionConditions).toContain("Evidence missing"));
  it("57. post-run matrix includes failure", () => expect(decisionConditions).toContain("Failure"));
  it("58. post-run matrix includes partial success", () => expect(decisionConditions).toContain("Partial success"));
  it("59. post-run matrix includes strong controlled success", () => expect(decisionConditions).toContain("Strong controlled success"));
  it("60. post-run matrix keeps public_launch false", () => expect(decisionMatrix.every((d) => d.public_launch_ready === false)).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Routes, SQL, flag, UI, QA, summary (tests 65 → 85)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.3 — Routes, SQL, flag, UI, QA", () => {
  it("65. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("66. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("67. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("68. UI contains « Pierre — First Customer Evidence Review »", () => {
    expect(FCER_TITLE).toContain("Pierre — First Customer Evidence Review");
    expect(pageSrc).toContain("Pierre — First Customer Evidence Review");
  });
  it("69. UI : « preuves réelles uniquement »", () => expect(FCER_MICROCOPY).toContain("preuves réelles uniquement"));
  it("70. UI : « ne valide aucune preuve sans élément réel »", () => expect(FCER_NO_AUTO_VALIDATION).toContain("ne valide aucune preuve sans élément réel"));
  it("71. UI : « ne suffit pas à déclarer le lancement public »", () => expect(FCER_NOT_PUBLIC).toContain("ne suffit pas à déclarer le lancement public"));
  it("72. UI does not contain active « Marquer evidence complete »", () => expect(pageSrc).not.toContain("Marquer evidence complete"));
  it("73. UI does not contain active « Déclarer public launch »", () => expect(pageSrc).not.toContain("Déclarer public launch"));
  it("74. UI does not contain active « Modifier go-live proofs »", () => expect(pageSrc).not.toContain("Modifier go-live proofs"));
  it("74b. page câble l'evidence review (report)", () => expect(pageSrc).toContain("buildFirstCustomerEvidenceReviewReport"));
  it("75. QA checklist ready", () => {
    const cl = buildFirstCustomerEvidenceReviewQaChecklist();
    expect(cl.phase).toBe("7.3");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const verdict = buildFirstCustomerEvidenceReviewQaVerdict(cl.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.evidence_review_gate_only).toBe(true);
  });
  it("83. summary says next phase Customer Evidence Applied / Second Controlled Customer", () => {
    expect(summarizeFirstCustomerEvidenceReviewReport(report)).toContain("Customer Evidence Applied / Second Controlled Customer");
    expect(report.recommended_next_phase).toContain("CUSTOMER EVIDENCE APPLIED / SECOND CONTROLLED CUSTOMER");
  });
  it("E1. package test:phase7-3", () => expect(packageJson).toContain("test:phase7-3"));
  it("E2. package check + doc next phase", () => {
    expect(packageJson).toContain("check:first-customer-evidence-review");
    expect(docSrc).toContain("CUSTOMER EVIDENCE APPLIED / SECOND CONTROLLED CUSTOMER");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte (P5.1 → P7.2) (tests 76 → 82)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.3 — Cascade intacte", () => {
  it("76. P7.2 remains intact", () => expect(buildFirstLiveCustomerControlledRunReport().run_status).toBe("ready_to_prepare_first_customer"));
  it("77. P7.1 remains intact", () => expect(buildExternalGoLiveProofsReport().public_launch_verdict).toBe("BLOCKED"));
  it("78. P6.6 remains intact", () => expect(buildPierreSellableGateFinalReport().final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("79. P6.5 remains intact", () => expect(buildPierreCustomerActivationE2EFinalReport().activation_status).toBe("first_paid_customer_path_ready"));
  it("80. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("81. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("82. P5.1 remains intact", () => {
    const id = createLocalControlledMission(eligibleContract()).mission!.id;
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  const scriptsPkg = ["test:phase7-2", "test:phase7-1", "test:phase6-6", "test:phase6-5", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
