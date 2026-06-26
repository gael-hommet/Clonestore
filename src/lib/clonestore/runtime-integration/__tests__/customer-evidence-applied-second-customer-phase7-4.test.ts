// src/lib/clonestore/runtime-integration/__tests__/customer-evidence-applied-second-customer-phase7-4.test.ts
// PHASE 7.4 — Customer Evidence Applied / Second Controlled Customer — Tests

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
  // P5.1 → P7.3 (intact)
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreSellableGateFinalReport,
  buildExternalGoLiveProofsReport,
  buildFirstLiveCustomerControlledRunReport,
  buildFirstCustomerEvidenceReviewReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P7.4
  buildCustomerEvidenceAppliedSecondCustomerReport,
  buildReviewedEvidenceApplicationMatrix,
  buildAppliedEvidenceCategories,
  buildUnappliedEvidenceCategories,
  buildGoLiveContributionMatrix,
  buildFirstCustomerContinuationPlan,
  buildSecondCustomerPreparationMatrix,
  buildSecondCustomerSelectionCriteria,
  buildMultiCustomerEvidenceBase,
  buildCustomer1VsCustomer2ComparisonPlan,
  buildPublicLaunchSafetyGate,
  buildEvidenceApplicationRules,
  buildOperatorApplyChecklist,
  buildSecondCustomerRunbook,
  buildCustomerEvidenceAppliedSecondCustomerQaChecklist,
  buildCustomerEvidenceAppliedSecondCustomerQaVerdict,
  summarizeCustomerEvidenceAppliedSecondCustomerReport,
  CEA_TITLE,
  CEA_MICROCOPY,
  CEA_NO_APPLY_WITHOUT_REAL,
  CEA_NOT_PUBLIC,
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

const typesSrc = readSrc(`${RI_DIR}/customer-evidence-applied-second-customer-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/customer-evidence-applied-second-customer.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/customer-evidence-applied-second-customer-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/customer-evidence-applied-second-customer-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_7_4_CUSTOMER_EVIDENCE_APPLIED_SECOND_CUSTOMER.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_7_4_CUSTOMER_EVIDENCE_APPLIED_SECOND_CUSTOMER_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-customer-evidence-applied-second-customer-phase7-4.mjs");
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

// ── Données P7.4 ────────────────────────────────────────────────────────────────

const report = buildCustomerEvidenceAppliedSecondCustomerReport();
const matrix = buildReviewedEvidenceApplicationMatrix();
const categories = matrix.map((m) => m.category);
const contributions = buildGoLiveContributionMatrix();
const prep = buildSecondCustomerPreparationMatrix();
const selection = buildSecondCustomerSelectionCriteria().join(" ");
const base = buildMultiCustomerEvidenceBase();
const gate = buildPublicLaunchSafetyGate();
const rules = buildEvidenceApplicationRules().join(" ");
const operator = buildOperatorApplyChecklist().join(" ");
const runbook = buildSecondCustomerRunbook();

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.4 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("55. no fetch in modules", () => expect(scanBlob).not.toContain("fetch"));
  it("56. no Stripe import", () => {
    expect(scanBlob).not.toContain('from "stripe');
    expect(scanBlob).not.toContain("@stripe");
  });
  it("57. no Supabase client", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("58. no OpenAI/Anthropic import", () => {
    expect(scanBlob.toLowerCase()).not.toContain("openai");
    expect(scanBlob.toLowerCase()).not.toContain("anthropic");
  });
  it("P8. modules ne contiennent pas import Pierre / /api/", () => {
    expect([typesSrc, moduleSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre');
    expect(scanBlob).not.toContain("/api/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Statut & invariants (tests 1 → 21)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.4 — Statut & invariants", () => {
  it("1. phase = 7.4", () => expect(report.phase).toBe("7.4"));
  it("2. ready_to_apply_customer_evidence_when_verified true", () => expect(report.ready_to_apply_customer_evidence_when_verified).toBe(true));
  it("3. evidence_applied false", () => expect(report.evidence_applied).toBe(false));
  it("4. real_evidence_available false", () => expect(report.real_evidence_available).toBe(false));
  it("5. go_live_contribution_applied false", () => expect(report.go_live_contribution_applied).toBe(false));
  it("6. first_customer_success_declared false", () => expect(report.first_customer_success_declared).toBe(false));
  it("7. second_customer_selected false", () => expect(report.second_customer_selected).toBe(false));
  it("8. second_customer_started false", () => expect(report.second_customer_started).toBe(false));
  it("9. second_customer_completed false", () => expect(report.second_customer_completed).toBe(false));
  it("10. multi_customer_evidence_ready false", () => expect(report.multi_customer_evidence_ready).toBe(false));
  it("11. public_launch_ready false", () => expect(report.public_launch_ready).toBe(false));
  it("12. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("13. stripe_live_verified false", () => expect(report.stripe_live_verified).toBe(false));
  it("14. supabase_prod_rls_verified false", () => expect(report.supabase_prod_rls_verified).toBe(false));
  it("15. domain_email_verified false", () => expect(report.domain_email_verified).toBe(false));
  it("16. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("17. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("18. official_document_generated false", () => expect(report.official_document_generated).toBe(false));
  it("19. go_live_proofs_modified false", () => expect(report.go_live_proofs_modified).toBe(false));
  it("20. env_modified false", () => expect(report.env_modified).toBe(false));
  it("21. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("21b. application_status ready_to_apply_when_verified", () => expect(report.application_status).toBe("ready_to_apply_when_verified"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Application matrix, contribution (tests 22 → 37)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.4 — Application matrix & contribution", () => {
  it("22. reviewed evidence matrix non-empty", () => expect(matrix.length).toBeGreaterThan(0));
  it("23. matrix includes customer_identity", () => expect(categories).toContain("customer_identity"));
  it("24. matrix includes contract_cgv", () => expect(categories).toContain("contract_cgv"));
  it("25. matrix includes payment_or_activation", () => expect(categories).toContain("payment_or_activation"));
  it("26. matrix includes setup", () => expect(categories).toContain("setup"));
  it("27. matrix includes first_output", () => expect(categories).toContain("first_output"));
  it("28. matrix includes human_validation", () => expect(categories).toContain("human_validation"));
  it("29. matrix includes feedback", () => expect(categories).toContain("feedback"));
  it("30. all matrix application_decision not_applied", () => expect(matrix.every((m) => m.application_decision === "not_applied")).toBe(true));
  it("31. all matrix applied false", () => {
    expect(matrix.every((m) => m.applied === false)).toBe(true);
    expect(matrix.every((m) => m.verified === false)).toBe(true);
  });
  it("32. applied_evidence_categories empty", () => expect(buildAppliedEvidenceCategories().length).toBe(0));
  it("32b. report.applied_evidence_categories empty", () => expect(report.applied_evidence_categories.length).toBe(0));
  it("33. unapplied_evidence_categories non-empty", () => {
    const ua = buildUnappliedEvidenceCategories();
    expect(ua.length).toBeGreaterThan(0);
    expect(ua.every((u) => u.reasons.includes("no_verified_real_evidence_yet"))).toBe(true);
    expect(ua.every((u) => u.reasons.includes("cannot_auto_apply"))).toBe(true);
  });
  it("34. go-live contribution matrix non-empty", () => expect(contributions.length).toBeGreaterThan(0));
  it("35. contribution currently_eligible false", () => expect(contributions.every((c) => c.currently_eligible === false)).toBe(true));
  it("36. contribution applied_to_go_live_proofs false", () => expect(contributions.every((c) => c.applied_to_go_live_proofs === false)).toBe(true));
  it("37. contribution auto_update_allowed false", () => expect(contributions.every((c) => c.auto_update_allowed === false)).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Client 2, multi-client, safety gate, rules, runbook (tests 38 → 54)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.4 — Client 2, multi-client, safety gate", () => {
  it("38. first customer continuation default request_more_evidence", () => expect(buildFirstCustomerContinuationPlan().recommended_decision).toBe("request_more_evidence"));
  it("39. second customer prep matrix non-empty", () => expect(prep.length).toBeGreaterThan(0));
  it("40. second customer prep ready false", () => expect(prep.every((p) => p.ready === false)).toBe(true));
  it("41. second customer criteria include simple client", () => expect(selection).toContain("Client simple"));
  it("42. second customer criteria include S1/S2", () => expect(selection).toContain("S1 ou S2"));
  it("43. multi customer evidence base current count 0", () => expect(base.current_verified_customer_count).toBe(0));
  it("44. multi customer evidence base ready false", () => expect(base.evidence_base_ready).toBe(false));
  it("44b. multi customer base requires 2 before public launch", () => expect(base.customer_count_required_before_public_launch).toBeGreaterThanOrEqual(2));
  it("45. comparison plan non-empty", () => expect(buildCustomer1VsCustomer2ComparisonPlan().length).toBeGreaterThan(0));
  it("46. public launch safety gate false", () => {
    expect(gate.public_launch_ready).toBe(false);
    expect(gate.final_decision).toBe("blocked");
  });
  it("47. safety gate first_customer_success_not_enough true", () => expect(gate.first_customer_success_not_enough).toBe(true));
  it("48. safety gate second_customer_success_not_enough_alone true", () => expect(gate.second_customer_success_not_enough_alone).toBe(true));
  it("49. safety gate requires external/legal/support/multiple evidence", () => {
    expect(gate.requires_external_proofs).toBe(true);
    expect(gate.requires_legal_review).toBe(true);
    expect(gate.requires_support_readiness).toBe(true);
    expect(gate.requires_multiple_customer_evidence).toBe(true);
  });
  it("50. evidence application rules include no auto-application", () => expect(rules).toContain("Aucune auto-application"));
  it("51. operator checklist includes do not public launch", () => expect(operator).toContain("Ne pas déclarer public launch"));
  it("52. second customer runbook non-empty", () => expect(runbook.length).toBeGreaterThan(0));
  it("53. every second customer step verified false", () => expect(runbook.every((r) => r.verified === false)).toBe(true));
  it("54. every second customer step can_start_now false", () => expect(runbook.every((r) => r.can_start_now === false)).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Routes, SQL, flag, UI, QA, summary (tests 59 → 77)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.4 — Routes, SQL, flag, UI, QA", () => {
  it("59. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("60. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("61. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("62. UI contains « Pierre — Customer Evidence Applied »", () => {
    expect(CEA_TITLE).toContain("Pierre — Customer Evidence Applied");
    expect(pageSrc).toContain("Pierre — Customer Evidence Applied");
  });
  it("63. UI : « application contrôlée »", () => expect(CEA_MICROCOPY).toContain("application contrôlée"));
  it("64. UI : « Aucune preuve n'est appliquée sans vérification réelle »", () => expect(CEA_NO_APPLY_WITHOUT_REAL).toContain("Aucune preuve n'est appliquée sans vérification réelle"));
  it("65. UI : « ne suffisent pas à déclarer le lancement public »", () => expect(CEA_NOT_PUBLIC).toContain("ne suffisent pas à déclarer le lancement public"));
  it("66. UI does not contain active « Appliquer preuve »", () => expect(pageSrc).not.toContain("Appliquer preuve"));
  it("67. UI does not contain active « Modifier go-live proofs »", () => expect(pageSrc).not.toContain("Modifier go-live proofs"));
  it("68. UI does not contain active « Démarrer client 2 »", () => expect(pageSrc).not.toContain("Démarrer client 2"));
  it("68b. page câble l'evidence applied (report)", () => expect(pageSrc).toContain("buildCustomerEvidenceAppliedSecondCustomerReport"));
  it("69. QA checklist ready", () => {
    const cl = buildCustomerEvidenceAppliedSecondCustomerQaChecklist();
    expect(cl.phase).toBe("7.4");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const verdict = buildCustomerEvidenceAppliedSecondCustomerQaVerdict(cl.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.evidence_application_gate_only).toBe(true);
  });
  it("77. summary says next phase Second Customer Controlled Run / Public Launch Review Prep", () => {
    expect(summarizeCustomerEvidenceAppliedSecondCustomerReport(report)).toContain("Second Customer Controlled Run / Public Launch Review Prep");
    expect(report.recommended_next_phase).toContain("SECOND CUSTOMER CONTROLLED RUN / PUBLIC LAUNCH REVIEW PREP");
  });
  it("E1. package test:phase7-4", () => expect(packageJson).toContain("test:phase7-4"));
  it("E2. package check + doc next phase", () => {
    expect(packageJson).toContain("check:customer-evidence-applied-second-customer");
    expect(docSrc).toContain("SECOND CUSTOMER CONTROLLED RUN / PUBLIC LAUNCH REVIEW PREP");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte (P5.1 → P7.3) (tests 70 → 76)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.4 — Cascade intacte", () => {
  it("70. P7.3 remains intact", () => expect(buildFirstCustomerEvidenceReviewReport().review_status).toBe("ready_to_review_when_evidence_exists"));
  it("71. P7.2 remains intact", () => expect(buildFirstLiveCustomerControlledRunReport().run_status).toBe("ready_to_prepare_first_customer"));
  it("72. P7.1 remains intact", () => expect(buildExternalGoLiveProofsReport().public_launch_verdict).toBe("BLOCKED"));
  it("73. P6.6 remains intact", () => expect(buildPierreSellableGateFinalReport().final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("74. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("75. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("76. P5.1 remains intact", () => {
    const id = createLocalControlledMission(eligibleContract()).mission!.id;
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  const scriptsPkg = ["test:phase7-3", "test:phase7-2", "test:phase7-1", "test:phase6-6", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
