// src/lib/clonestore/runtime-integration/__tests__/second-customer-controlled-run-public-launch-prep-phase7-5.test.ts
// PHASE 7.5 — Second Customer Controlled Run / Public Launch Review Prep — Tests

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
  // P5.1 → P7.4 (intact)
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreSellableGateFinalReport,
  buildExternalGoLiveProofsReport,
  buildFirstLiveCustomerControlledRunReport,
  buildFirstCustomerEvidenceReviewReport,
  buildCustomerEvidenceAppliedSecondCustomerReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P7.5
  buildSecondCustomerControlledRunPublicLaunchPrepReport,
  buildSecondCustomerQualificationMatrix,
  buildSecondCustomerPreSaleConditions,
  buildSecondCustomerActivationRunbook,
  buildSecondCustomerSetupRunbook,
  buildSecondCustomerScenarioMatrix,
  buildSecondCustomerEvidencePlan,
  buildCustomer1VsCustomer2ComparisonMatrix,
  buildReproducibilityAssessment,
  buildMultiCustomerEvidenceReadiness,
  buildPublicLaunchReviewPrep,
  buildPublicLaunchBlockerMatrix,
  buildPublicLaunchReviewInputs,
  buildSecondCustomerControlledRunPublicLaunchPrepQaChecklist,
  buildSecondCustomerControlledRunPublicLaunchPrepQaVerdict,
  summarizeSecondCustomerControlledRunPublicLaunchPrepReport,
  SC2_TITLE,
  SC2_MICROCOPY,
  SC2_NOT_STARTED,
  SC2_NOT_PUBLIC,
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

const typesSrc = readSrc(`${RI_DIR}/second-customer-controlled-run-public-launch-prep-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/second-customer-controlled-run-public-launch-prep.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/second-customer-controlled-run-public-launch-prep-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/second-customer-controlled-run-public-launch-prep-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_7_5_SECOND_CUSTOMER_CONTROLLED_RUN_PUBLIC_LAUNCH_PREP.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_7_5_SECOND_CUSTOMER_CONTROLLED_RUN_PUBLIC_LAUNCH_PREP_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-second-customer-controlled-run-public-launch-prep-phase7-5.mjs");
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

// ── Données P7.5 ────────────────────────────────────────────────────────────────

const report = buildSecondCustomerControlledRunPublicLaunchPrepReport();
const qualif = buildSecondCustomerQualificationMatrix().map((q) => q.label).join(" ");
const preSale = buildSecondCustomerPreSaleConditions().join(" ");
const activation = buildSecondCustomerActivationRunbook();
const activationLabels = activation.map((a) => a.label).join(" ");
const setup = buildSecondCustomerSetupRunbook().map((s) => s.label).join(" ");
const scenarios = buildSecondCustomerScenarioMatrix();
const scenarioIds = scenarios.map((s) => s.scenario_id);
const evidence = buildSecondCustomerEvidencePlan();
const comparison = buildCustomer1VsCustomer2ComparisonMatrix();
const repro = buildReproducibilityAssessment();
const base = buildMultiCustomerEvidenceReadiness();
const reviewPrep = buildPublicLaunchReviewPrep();
const blockers = buildPublicLaunchBlockerMatrix().join(" ");
const inputs = buildPublicLaunchReviewInputs();

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.5 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("58. no fetch in modules", () => expect(scanBlob).not.toContain("fetch"));
  it("59. no Stripe import", () => {
    expect(scanBlob).not.toContain('from "stripe');
    expect(scanBlob).not.toContain("@stripe");
  });
  it("60. no Supabase client", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("61. no OpenAI/Anthropic import", () => {
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

describe("PHASE 7.5 — Statut & invariants", () => {
  it("1. phase = 7.5", () => expect(report.phase).toBe("7.5"));
  it("2. ready_to_prepare_second_customer true", () => expect(report.ready_to_prepare_second_customer).toBe(true));
  it("3. second_customer_selected false", () => expect(report.second_customer_selected).toBe(false));
  it("4. second_customer_started false", () => expect(report.second_customer_started).toBe(false));
  it("5. second_customer_completed false", () => expect(report.second_customer_completed).toBe(false));
  it("6. second_customer_evidence_collected false", () => expect(report.second_customer_evidence_collected).toBe(false));
  it("7. customer_comparison_completed false", () => expect(report.customer_comparison_completed).toBe(false));
  it("8. reproducibility_verified false", () => expect(report.reproducibility_verified).toBe(false));
  it("9. multi_customer_evidence_ready false", () => expect(report.multi_customer_evidence_ready).toBe(false));
  it("10. public_launch_review_ready false", () => expect(report.public_launch_review_ready).toBe(false));
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
  it("21b. run_status ready_to_prepare_second_customer", () => expect(report.run_status).toBe("ready_to_prepare_second_customer"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Qualification, runbook, setup, scénarios (tests 22 → 44)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.5 — Qualification, runbook, scénarios", () => {
  it("22. qualification matrix non-empty", () => expect(buildSecondCustomerQualificationMatrix().length).toBeGreaterThan(0));
  it("23. qualification includes simple client", () => expect(qualif).toContain("Client simple"));
  it("24. qualification includes controlled run", () => expect(qualif).toContain("run contrôlé"));
  it("25. qualification includes no official payroll", () => expect(qualif).toContain("paie officielle"));
  it("26. pre-sale conditions include no public launch", () => expect(preSale).toContain("lancement public"));
  it("27. activation runbook ordered", () => expect(activation.map((a) => a.order)).toEqual([...activation.map((a) => a.order)].sort((x, y) => x - y)));
  it("28. activation runbook includes contract", () => expect(activationLabels.toLowerCase()).toContain("contrat"));
  it("29. activation runbook includes setup", () => expect(activationLabels.toLowerCase()).toContain("setup"));
  it("30. activation runbook includes mission", () => expect(activationLabels).toContain("mission"));
  it("31. activation runbook includes comparison", () => expect(activationLabels).toContain("Comparer"));
  it("32. all activation steps verified false", () => expect(activation.every((a) => a.verified === false)).toBe(true));
  it("33. all activation steps can_start_now false", () => expect(activation.every((a) => a.can_start_now === false)).toBe(true));
  it("34. setup includes company", () => expect(setup).toContain("Entreprise"));
  it("35. setup includes differences with customer 1", () => expect(setup).toContain("Différences avec le client 1"));
  it("36. scenarios include S1", () => expect(scenarioIds).toContain("S1"));
  it("37. scenarios include S2", () => expect(scenarioIds).toContain("S2"));
  it("38. scenarios include S3", () => expect(scenarioIds).toContain("S3"));
  it("39. scenarios include S4", () => expect(scenarioIds).toContain("S4"));
  it("40. scenarios include S5", () => expect(scenarioIds).toContain("S5"));
  it("41. S1/S2 recommended", () => {
    expect(scenarios.find((s) => s.scenario_id === "S1")!.recommended_for_second_customer).toBe(true);
    expect(scenarios.find((s) => s.scenario_id === "S2")!.recommended_for_second_customer).toBe(true);
  });
  it("42. S5 not recommended", () => expect(scenarios.find((s) => s.scenario_id === "S5")!.recommended_for_second_customer).toBe(false));
  it("43. every scenario human validation true", () => expect(scenarios.every((s) => s.human_validation_required === true)).toBe(true));
  it("44. every scenario runtime false", () => {
    expect(scenarios.every((s) => s.runtime_execution_allowed === false)).toBe(true);
    expect(scenarios.every((s) => s.real_email_allowed === false)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Evidence, comparaison, reproductibilité, public launch (tests 45 → 57)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.5 — Evidence, comparaison, reproductibilité, public launch", () => {
  it("45. evidence plan non-empty", () => expect(evidence.length).toBeGreaterThan(0));
  it("46. every evidence collected false", () => expect(evidence.every((e) => e.collected === false)).toBe(true));
  it("47. comparison matrix non-empty", () => expect(comparison.length).toBeGreaterThan(0));
  it("48. customer values null", () => expect(comparison.every((c) => c.customer_1_value === null && c.customer_2_value === null)).toBe(true));
  it("49. comparison status not_compared", () => expect(comparison.every((c) => c.comparison_status === "not_compared")).toBe(true));
  it("50. reproducibility scores 0", () => expect(repro.every((r) => r.current_score === 0)).toBe(true));
  it("51. reproducibility verified false", () => expect(repro.every((r) => r.verified === false)).toBe(true));
  it("52. multi-customer count 0", () => expect(base.verified_customer_count).toBe(0));
  it("53. multi-customer evidence ready false", () => expect(base.evidence_ready).toBe(false));
  it("54. public launch review ready false", () => {
    expect(reviewPrep.review_ready).toBe(false);
    expect(reviewPrep.all_inputs_verified).toBe(false);
  });
  it("55. public launch decision blocked", () => expect(reviewPrep.final_public_launch_decision).toBe("blocked"));
  it("56. blocker matrix includes Stripe/Supabase/domain/legal/support/multi-customer/scale", () => {
    expect(blockers).toContain("Stripe");
    expect(blockers).toContain("Supabase");
    expect(blockers).toContain("Domaine");
    expect(blockers).toContain("légale");
    expect(blockers).toContain("Support");
    expect(blockers).toContain("multi-client");
    expect(blockers).toContain("Scale 80k");
  });
  it("57. review inputs verified false", () => {
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((i) => i.verified === false)).toBe(true);
    expect(inputs.every((i) => i.evidence_link === null)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Routes, SQL, flag, UI, QA, summary (tests 62 → 81)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.5 — Routes, SQL, flag, UI, QA", () => {
  it("62. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("63. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("64. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("65. UI contains « Pierre — Second Customer Controlled Run »", () => {
    expect(SC2_TITLE).toContain("Pierre — Second Customer Controlled Run");
    expect(pageSrc).toContain("Pierre — Second Customer Controlled Run");
  });
  it("66. UI : « run contrôlé »", () => expect(SC2_MICROCOPY).toContain("run contrôlé"));
  it("67. UI : « il ne le démarre pas »", () => expect(SC2_NOT_STARTED).toContain("il ne le démarre pas"));
  it("68. UI : « lancement public reste bloqué »", () => expect(SC2_NOT_PUBLIC).toContain("lancement public reste bloqué"));
  it("69. UI does not contain active « Démarrer client 2 »", () => expect(pageSrc).not.toContain("Démarrer client 2"));
  it("70. UI does not contain active « Déclarer reproductibilité »", () => expect(pageSrc).not.toContain("Déclarer reproductibilité"));
  it("71. UI does not contain active « Déclarer public launch »", () => expect(pageSrc).not.toContain("Déclarer public launch"));
  it("71b. page câble le runbook (report)", () => expect(pageSrc).toContain("buildSecondCustomerControlledRunPublicLaunchPrepReport"));
  it("72. QA checklist ready", () => {
    const cl = buildSecondCustomerControlledRunPublicLaunchPrepQaChecklist();
    expect(cl.phase).toBe("7.5");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const verdict = buildSecondCustomerControlledRunPublicLaunchPrepQaVerdict(cl.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.second_customer_runbook_only).toBe(true);
  });
  it("81. summary says next phase Public Launch Final Review Gate", () => {
    expect(summarizeSecondCustomerControlledRunPublicLaunchPrepReport(report)).toContain("Public Launch Final Review Gate");
    expect(report.recommended_next_phase).toContain("PUBLIC LAUNCH FINAL REVIEW GATE");
  });
  it("E1. package test:phase7-5", () => expect(packageJson).toContain("test:phase7-5"));
  it("E2. package check + doc next phase", () => {
    expect(packageJson).toContain("check:second-customer-controlled-run-public-launch-prep");
    expect(docSrc).toContain("PUBLIC LAUNCH FINAL REVIEW GATE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte (P5.1 → P7.4) (tests 73 → 80)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.5 — Cascade intacte", () => {
  it("73. P7.4 remains intact", () => expect(buildCustomerEvidenceAppliedSecondCustomerReport().application_status).toBe("ready_to_apply_when_verified"));
  it("74. P7.3 remains intact", () => expect(buildFirstCustomerEvidenceReviewReport().review_status).toBe("ready_to_review_when_evidence_exists"));
  it("75. P7.2 remains intact", () => expect(buildFirstLiveCustomerControlledRunReport().run_status).toBe("ready_to_prepare_first_customer"));
  it("76. P7.1 remains intact", () => expect(buildExternalGoLiveProofsReport().public_launch_verdict).toBe("BLOCKED"));
  it("77. P6.6 remains intact", () => expect(buildPierreSellableGateFinalReport().final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("78. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("79. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("80. P5.1 remains intact", () => {
    const id = createLocalControlledMission(eligibleContract()).mission!.id;
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  const scriptsPkg = ["test:phase7-4", "test:phase7-3", "test:phase7-2", "test:phase7-1", "test:phase6-6", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
