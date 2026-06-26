// src/lib/clonestore/runtime-integration/__tests__/first-live-customer-controlled-run-phase7-2.test.ts
// PHASE 7.2 — First Live Customer Controlled Run — Tests

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
  // P5.1 → P7.1 (intact)
  buildControlledMissionPersistencePhase5ClosureReport,
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreRealWorkflowCompletionPack,
  buildPierreStateServerActivationDecisionGate,
  buildPierreChannelsIdentityFinalReport,
  buildPierreCustomerActivationE2EFinalReport,
  buildPierreSellableGateFinalReport,
  buildExternalGoLiveProofsReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P7.2
  buildFirstLiveCustomerControlledRunReport,
  buildCustomerQualificationMatrix,
  buildPreSaleConditions,
  buildLegalAndCommercialLimits,
  buildActivationRunbook,
  buildSetupRunbook,
  buildFirstMissionRunbook,
  buildEvidenceCollectionPlan,
  buildCustomerFeedbackPlan,
  buildNoGoConditions,
  buildFirstCustomerRollbackPlan,
  buildFirstLiveCustomerControlledRunQaChecklist,
  buildFirstLiveCustomerControlledRunQaVerdict,
  summarizeFirstLiveCustomerControlledRunReport,
  FLC_TITLE,
  FLC_MICROCOPY,
  FLC_NOT_PUBLIC,
  FLC_NO_INVENTED,
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

const typesSrc = readSrc(`${RI_DIR}/first-live-customer-controlled-run-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/first-live-customer-controlled-run.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/first-live-customer-controlled-run-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/first-live-customer-controlled-run-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_7_2_FIRST_LIVE_CUSTOMER_CONTROLLED_RUN.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_7_2_FIRST_LIVE_CUSTOMER_CONTROLLED_RUN_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-first-live-customer-controlled-run-phase7-2.mjs");
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

// ── Données P7.2 ────────────────────────────────────────────────────────────────

const report = buildFirstLiveCustomerControlledRunReport();
const qualif = buildCustomerQualificationMatrix();
const qualifLabels = qualif.map((q) => q.label).join(" ");
const preSale = buildPreSaleConditions().join(" ");
const legal = buildLegalAndCommercialLimits().join(" ");
const activation = buildActivationRunbook();
const activationLabels = activation.map((a) => a.label).join(" ");
const setup = buildSetupRunbook();
const setupLabels = setup.map((s) => s.label).join(" ");
const scenarios = buildFirstMissionRunbook();
const scenarioIds = scenarios.map((s) => s.scenario_id);
const evidence = buildEvidenceCollectionPlan();
const evidenceLabels = evidence.map((e) => e.label).join(" ");
const noGo = buildNoGoConditions().join(" ");
const rollback = buildFirstCustomerRollbackPlan();
const rollbackText = rollback.map((r) => `${r.step} ${r.description}`).join(" ");

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.2 — Présence & pureté", () => {
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
// BLOC 1 — Statut & invariants (tests 1 → 20)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.2 — Statut & invariants", () => {
  it("1. phase = 7.2", () => expect(report.phase).toBe("7.2"));
  it("2. ready_to_prepare_first_live_customer true", () => expect(report.ready_to_prepare_first_live_customer).toBe(true));
  it("3. first_live_customer_completed false", () => expect(report.first_live_customer_completed).toBe(false));
  it("4. real_customer_selected false", () => expect(report.real_customer_selected).toBe(false));
  it("5. real_payment_verified false", () => expect(report.real_payment_verified).toBe(false));
  it("6. contract_signed_verified false", () => expect(report.contract_signed_verified).toBe(false));
  it("7. setup_completed_verified false", () => expect(report.setup_completed_verified).toBe(false));
  it("8. first_value_delivered_verified false", () => expect(report.first_value_delivered_verified).toBe(false));
  it("9. feedback_collected_verified false", () => expect(report.feedback_collected_verified).toBe(false));
  it("10. stripe_live_verified false", () => expect(report.stripe_live_verified).toBe(false));
  it("11. supabase_prod_rls_verified false", () => expect(report.supabase_prod_rls_verified).toBe(false));
  it("12. domain_email_verified false", () => expect(report.domain_email_verified).toBe(false));
  it("13. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("14. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("15. official_document_generated false", () => expect(report.official_document_generated).toBe(false));
  it("16. public_launch_ready false", () => expect(report.public_launch_ready).toBe(false));
  it("17. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("18. go_live_proofs_modified false", () => expect(report.go_live_proofs_modified).toBe(false));
  it("19. env_modified false", () => expect(report.env_modified).toBe(false));
  it("20. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("20b. run_status ready_to_prepare_first_customer", () => expect(report.run_status).toBe("ready_to_prepare_first_customer"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Qualification, pré-vente, legal, runbook (tests 21 → 36)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.2 — Qualification, pré-vente, legal, runbook", () => {
  it("21. qualification matrix non-empty", () => expect(qualif.length).toBeGreaterThan(0));
  it("22. qualification includes PME simple", () => expect(qualifLabels).toContain("PME simple"));
  it("23. qualification includes accepts controlled activation", () => expect(qualifLabels).toContain("Accepte une activation contrôlée"));
  it("24. qualification includes no official payroll", () => expect(qualifLabels).toContain("Pas besoin de paie officielle"));
  it("24b. every qualification item verified false", () => expect(qualif.every((q) => q.verified === false)).toBe(true));
  it("25. pre-sale conditions include limits explanation", () => expect(preSale).toContain("Expliquer les limites"));
  it("26. pre-sale conditions include no public launch promise", () => expect(preSale).toContain("Aucune promesse de lancement public"));
  it("27. legal limits include human validation", () => expect(legal).toContain("validées humainement"));
  it("28. legal limits include payroll excluded", () => expect(legal).toContain("Paie officielle exclue"));
  it("29. activation runbook has ordered steps", () => {
    expect(activation.length).toBeGreaterThan(0);
    expect(activation.map((a) => a.order)).toEqual([...activation.map((a) => a.order)].sort((x, y) => x - y));
  });
  it("30. activation runbook includes contract/CGV", () => expect(activationLabels).toContain("contrat / CGV"));
  it("31. activation runbook includes setup", () => expect(activationLabels.toLowerCase()).toContain("setup"));
  it("32. activation runbook includes first mission", () => expect(activationLabels).toContain("mission contrôlée"));
  it("33. activation runbook includes evidence", () => expect(activationLabels).toContain("evidence"));
  it("34. every activation step verified false + not markable now", () => {
    expect(activation.every((a) => a.verified === false)).toBe(true);
    expect(activation.every((a) => a.can_be_marked_done_now === false)).toBe(true);
  });
  it("35. setup runbook includes company", () => expect(setupLabels).toContain("Entreprise"));
  it("36. setup runbook includes approvers", () => expect(setupLabels).toContain("Approbateurs"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Scénarios, evidence, feedback, no-go (tests 37 → 60)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.2 — Scénarios, evidence, feedback, no-go", () => {
  it("37. first mission runbook includes S1", () => expect(scenarioIds).toContain("S1"));
  it("38. first mission runbook includes S2", () => expect(scenarioIds).toContain("S2"));
  it("39. first mission runbook includes S3", () => expect(scenarioIds).toContain("S3"));
  it("40. first mission runbook includes S4", () => expect(scenarioIds).toContain("S4"));
  it("41. first mission runbook includes S5", () => expect(scenarioIds).toContain("S5"));
  it("42. S1 or S2 recommended for first customer", () => {
    const recommended = scenarios.filter((s) => s.recommended_for_first_customer).map((s) => s.scenario_id);
    expect(recommended.includes("S1") || recommended.includes("S2")).toBe(true);
  });
  it("43. every scenario human_validation_required true", () => expect(scenarios.every((s) => s.human_validation_required === true)).toBe(true));
  it("44. every scenario runtime_execution_allowed false", () => expect(scenarios.every((s) => s.runtime_execution_allowed === false)).toBe(true));
  it("45. every scenario real_email_allowed false", () => {
    expect(scenarios.every((s) => s.real_email_allowed === false)).toBe(true);
    expect(scenarios.every((s) => s.official_document_allowed === false)).toBe(true);
  });
  it("46. evidence plan includes contract", () => expect(evidenceLabels).toContain("Contrat / CGV"));
  it("47. evidence plan includes setup completed", () => expect(evidenceLabels).toContain("setup complété"));
  it("48. evidence plan includes first output", () => expect(evidenceLabels).toContain("Livrable produit"));
  it("49. evidence plan includes feedback", () => expect(evidenceLabels).toContain("Feedback client"));
  it("50. evidence collected false", () => expect(evidence.every((e) => e.collected === false)).toBe(true));
  it("51. feedback questions non-empty", () => expect(buildCustomerFeedbackPlan().length).toBeGreaterThan(0));
  it("52. no-go includes autonomy total", () => expect(noGo).toContain("autonomie totale"));
  it("53. no-go includes official payroll", () => expect(noGo).toContain("paie officielle"));
  it("54. no-go includes email live", () => expect(noGo).toContain("email live"));
  it("55. no-go includes no contract", () => expect(noGo).toContain("Contrat / CGV non signé"));
  it("56. rollback includes suspend access", () => expect(rollbackText).toContain("Suspendre l'accès"));
  it("57. rollback includes demo-only", () => expect(rollbackText).toContain("demo-only"));
  it("58. rollback includes do not update go-live proof", () => expect(rollbackText).toContain("Ne pas update go-live proof"));
  it("59. public launch impact remains false", () => {
    expect(report.public_launch_impact.public_launch_ready_after_run).toBe(false);
    expect(report.public_launch_impact.one_customer_is_not_scale_proof).toBe(true);
  });
  it("60. go-live proof policy says manual only", () => {
    expect(report.go_live_proof_updates_policy.manual_only).toBe(true);
    expect(report.go_live_proof_updates_policy.never_via_this_module).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Routes, SQL, flag, UI, QA, summary (tests 65 → 85)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.2 — Routes, SQL, flag, UI, QA", () => {
  it("65. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("66. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("67. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("68. UI contains « Pierre — First Live Customer Run »", () => {
    expect(FLC_TITLE).toContain("Pierre — First Live Customer Run");
    expect(pageSrc).toContain("Pierre — First Live Customer Run");
  });
  it("69. UI : « run contrôlé »", () => expect(FLC_MICROCOPY).toContain("run contrôlé"));
  it("70. UI : « ne déclare pas le lancement public »", () => expect(FLC_NOT_PUBLIC).toContain("ne déclare pas le lancement public"));
  it("71. UI : « Aucune preuve client n'est inventée »", () => expect(FLC_NO_INVENTED).toContain("Aucune preuve client n'est inventée"));
  it("72. UI does not contain active « Marquer client réel validé »", () => expect(pageSrc).not.toContain("Marquer client réel validé"));
  it("73. UI does not contain active « Déclarer paiement vérifié »", () => expect(pageSrc).not.toContain("Déclarer paiement vérifié"));
  it("74. UI does not contain active « Modifier go-live proofs »", () => expect(pageSrc).not.toContain("Modifier go-live proofs"));
  it("74b. page câble le runbook (report)", () => expect(pageSrc).toContain("buildFirstLiveCustomerControlledRunReport"));
  it("75. QA checklist ready", () => {
    const cl = buildFirstLiveCustomerControlledRunQaChecklist();
    expect(cl.phase).toBe("7.2");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const verdict = buildFirstLiveCustomerControlledRunQaVerdict(cl.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.first_live_customer_runbook_only).toBe(true);
  });
  it("85. summary says next phase First Customer Evidence Review", () => {
    expect(summarizeFirstLiveCustomerControlledRunReport(report)).toContain("First Customer Evidence Review");
    expect(report.recommended_next_phase).toContain("FIRST CUSTOMER EVIDENCE REVIEW");
  });
  it("E1. package test:phase7-2", () => expect(packageJson).toContain("test:phase7-2"));
  it("E2. package check + doc next phase", () => {
    expect(packageJson).toContain("check:first-live-customer-controlled-run");
    expect(docSrc).toContain("FIRST CUSTOMER EVIDENCE REVIEW");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte (P5.1 → P7.1) (tests 76 → 84)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.2 — Cascade intacte", () => {
  it("76. P7.1 remains intact", () => expect(buildExternalGoLiveProofsReport().public_launch_verdict).toBe("BLOCKED"));
  it("77. P6.6 remains intact", () => expect(buildPierreSellableGateFinalReport().final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("78. P6.5 remains intact", () => expect(buildPierreCustomerActivationE2EFinalReport().activation_status).toBe("first_paid_customer_path_ready"));
  it("79. P6.4 remains intact", () => expect(buildPierreChannelsIdentityFinalReport().identity_status).toBe("channels_ready_for_first_sale"));
  it("80. P6.3 remains intact", () => expect(buildPierreStateServerActivationDecisionGate().recommended_strategy).toBe("local_first_controlled_sale"));
  it("81. P6.2 remains intact", () => expect(buildPierreRealWorkflowCompletionPack().pack_status).toBe("scenarios_ready_for_demo"));
  it("82. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("83. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("84. P5.1 remains intact", () => {
    const id = createLocalControlledMission(eligibleContract()).mission!.id;
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  const scriptsPkg = ["test:phase7-1", "test:phase6-6", "test:phase6-5", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
