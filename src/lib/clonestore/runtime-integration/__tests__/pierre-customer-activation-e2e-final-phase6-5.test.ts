// src/lib/clonestore/runtime-integration/__tests__/pierre-customer-activation-e2e-final-phase6-5.test.ts
// PHASE 6.5 — Pierre Customer Activation E2E Final — Tests

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
  // P5.4 → P6.4 (intact)
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
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P6.5
  buildPierreCustomerActivationE2EFinalReport,
  buildPierreCustomerJourneySteps,
  buildPierreActivationPathMatrix,
  buildPierreFirstValuePath,
  buildPierreAccessControlMatrix,
  buildPierreOnboardingHandoff,
  buildPierreScenarioEntryPoints,
  buildPierreFirstMissionControlledFlow,
  buildPierreActivationTraceabilityRequirements,
  buildPierreActivationHumanValidationRequirements,
  buildPierreActivationCustomerVisibleLimits,
  buildPierreCustomerActivationE2EFinalQaChecklist,
  buildPierreCustomerActivationE2EFinalQaVerdict,
  summarizePierreCustomerActivationE2EFinalReport,
  PIERRE_ACTIVATION_TITLE,
  PIERRE_ACTIVATION_MICROCOPY,
  PIERRE_ACTIVATION_FIRST_VALUE,
  PIERRE_ACTIVATION_NO_AUTONOMOUS,
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

const typesSrc = readSrc(`${RI_DIR}/pierre-customer-activation-e2e-final-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/pierre-customer-activation-e2e-final.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/pierre-customer-activation-e2e-final-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/pierre-customer-activation-e2e-final-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_6_5_PIERRE_CUSTOMER_ACTIVATION_E2E_FINAL.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_6_5_PIERRE_CUSTOMER_ACTIVATION_E2E_FINAL_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-pierre-customer-activation-e2e-final-phase6-5.mjs");
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

const journey = buildPierreCustomerJourneySteps();
const jHas = (kw: string) => journey.some((j) => j.label.toLowerCase().includes(kw.toLowerCase()));
const access = buildPierreAccessControlMatrix();
const accBy = (state: string) => access.find((a) => a.customer_state === state)!;
const entries = buildPierreScenarioEntryPoints().map((e) => e.id);
const flow = buildPierreFirstMissionControlledFlow();
const flowHas = (st: string) => flow.some((f) => f.step === st);

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.5 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("67. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("68. modules ne contiennent pas import Stripe", () => {
    expect(scanBlob).not.toContain('from "stripe');
    expect(scanBlob).not.toContain("@stripe");
  });
  it("69. modules ne contiennent pas import base de données", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("70. modules ne contiennent pas import OpenAI/Anthropic", () => {
    expect(scanBlob.toLowerCase()).not.toContain("openai");
    expect(scanBlob.toLowerCase()).not.toContain("anthropic");
  });
  it("P8. modules ne contiennent pas import Pierre / /api/", () => {
    expect([typesSrc, moduleSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre');
    expect(scanBlob).not.toContain("/api/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Activation E2E
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.5 — Activation E2E", () => {
  const report = buildPierreCustomerActivationE2EFinalReport();

  it("1. phase = 6.5", () => expect(report.phase).toBe("6.5"));
  it("2. ready_for_p6_6 true", () => expect(report.ready_for_p6_6).toBe(true));
  it("3. first_paid_customer_path_ready true", () => expect(report.first_paid_customer_path_ready).toBe(true));
  it("4. first_paid_customer_e2e_proven_live false", () => expect(report.first_paid_customer_e2e_proven_live).toBe(false));
  it("5. stripe_live_payment_performed false", () => expect(report.stripe_live_payment_performed).toBe(false));
  it("6. supabase_prod_verified false", () => expect(report.supabase_prod_verified).toBe(false));
  it("7. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("8. server_persistence_active false", () => expect(report.server_persistence_active).toBe(false));
  it("9. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("10. official_document_generated false", () => expect(report.official_document_generated).toBe(false));
  it("11. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("12. env_modified false", () => expect(report.env_modified).toBe(false));
  it("13. sql_applied false", () => expect(report.sql_applied).toBe(false));
  it("14. pierre_fully_sellable_declared false", () => expect(report.pierre_fully_sellable_declared).toBe(false));
  it("15. public_launch_validated false", () => expect(report.public_launch_validated).toBe(false));
  it("16. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));

  it("17. journey discover", () => expect(jHas("Discover")).toBe(true));
  it("18. journey demo", () => expect(jHas("Demo")).toBe(true));
  it("19. journey checkout", () => expect(jHas("Checkout")).toBe(true));
  it("20. journey payment success", () => expect(jHas("Payment success")).toBe(true));
  it("21. journey signup", () => expect(jHas("Signup")).toBe(true));
  it("22. journey profile agents", () => expect(jHas("Profile agents")).toBe(true));
  it("23. journey setup", () => expect(jHas("Setup")).toBe(true));
  it("24. journey use", () => expect(jHas("Use Pierre")).toBe(true));
  it("25. journey first controlled mission", () => expect(jHas("First controlled mission")).toBe(true));
  it("26. journey first useful output", () => expect(jHas("First useful output")).toBe(true));

  it("27. activation matrix : 10 routes", () => expect(buildPierreActivationPathMatrix().length).toBe(10));
  it("28. checkout step mentions 449€/mois", () => expect(JSON.stringify(report)).toContain("449€/mois"));
  it("29. success step → configurer Pierre", () => expect(JSON.stringify(report)).toContain("Configurer Pierre"));

  it("30. first value path exists", () => expect(buildPierreFirstValuePath().steps.length).toBeGreaterThan(0));
  it("31. first value path no autonomous execution", () => {
    const fv = buildPierreFirstValuePath();
    expect(fv.no_autonomous_execution).toBe(true);
    expect(fv.steps.join(" ")).toContain("Aucune exécution autonome");
  });
  it("32. first value proof artifacts non-empty", () => expect(buildPierreFirstValuePath().proof_artifacts.length).toBeGreaterThan(0));

  it("33. access : unpaid", () => expect(accBy("unpaid")).toBeDefined());
  it("34. access : paid_active", () => expect(accBy("paid_active")).toBeDefined());
  it("35. access : trialing", () => expect(accBy("trialing")).toBeDefined());
  it("36. access : cancelled", () => expect(accBy("cancelled")).toBeDefined());
  it("37. access : internal_demo", () => expect(accBy("internal_demo")).toBeDefined());
  it("38. access : first_controlled_sale_customer", () => expect(accBy("first_controlled_sale_customer")).toBeDefined());
  it("39. access : execute_runtime false partout", () => expect(access.every((a) => a.can_execute_runtime === false)).toBe(true));
  it("40. unpaid cannot access use", () => expect(accBy("unpaid").can_access_use).toBe(false));
  it("41. paid_active can access setup/use", () => { expect(accBy("paid_active").can_access_setup).toBe(true); expect(accBy("paid_active").can_access_use).toBe(true); });
  it("42. trialing can access setup/use", () => { expect(accBy("trialing").can_access_setup).toBe(true); expect(accBy("trialing").can_access_use).toBe(true); });
  it("43. cancelled cannot access use", () => expect(accBy("cancelled").can_access_use).toBe(false));

  it("44. onboarding handoff : company/RH/approvers/rules", () => {
    const h = buildPierreOnboardingHandoff();
    expect(h.enterprise_name_field.length).toBeGreaterThan(0);
    expect(h.rh_context.length).toBeGreaterThan(0);
    expect(h.approvers.length).toBeGreaterThan(0);
    expect(h.rules.length).toBeGreaterThan(0);
  });
  it("45. onboarding handoff : no_server_persistence_confirmed true", () => expect(buildPierreOnboardingHandoff().no_server_persistence_confirmed).toBe(true));

  it("46. scenario entry S1", () => expect(entries).toContain("S1"));
  it("47. scenario entry S2", () => expect(entries).toContain("S2"));
  it("48. scenario entry S3", () => expect(entries).toContain("S3"));
  it("49. scenario entry S4", () => expect(entries).toContain("S4"));
  it("50. scenario entry S5", () => expect(entries).toContain("S5"));
  it("51. every scenario entry no_autonomous_execution_confirmed", () => expect(buildPierreScenarioEntryPoints().every((e) => e.no_autonomous_execution_confirmed === true)).toBe(true));

  it("52. flow : select scenario", () => expect(flowHas("select scenario")).toBe(true));
  it("53. flow : create local controlled mission draft", () => expect(flowHas("create local controlled mission draft")).toBe(true));
  it("54. flow : review", () => expect(flowHas("review")).toBe(true));
  it("55. flow : approve local", () => expect(flowHas("approve local")).toBe(true));
  it("56. flow : preflight", () => expect(flowHas("preflight")).toBe(true));
  it("57. flow : stop before execution", () => {
    expect(flowHas("stop before execution")).toBe(true);
    expect(flow.every((f) => f.can_execute_runtime === false && f.real_action === false)).toBe(true);
  });

  const trace = buildPierreActivationTraceabilityRequirements();
  it("58. trace : no_runtime_execution_confirmed", () => expect(trace).toContain("no_runtime_execution_confirmed"));
  it("59. trace : first_value_reached", () => expect(trace).toContain("first_value_reached"));

  const hv = buildPierreActivationHumanValidationRequirements().join(" ");
  it("60. human validation : recruitment contract", () => expect(hv).toContain("Recruitment contract"));
  it("61. human validation : absence sanction/payroll", () => expect(hv).toContain("Absence sanction"));
  it("62. human validation : pre-payroll DSN/payslip", () => { expect(hv).toContain("DSN"); expect(hv).toContain("payslip"); });
  it("63. human validation : email send", () => expect(hv).toContain("Email send"));

  const limits = buildPierreActivationCustomerVisibleLimits().join(" ");
  it("64. limite : Pierre prépare, l'humain valide", () => expect(limits).toContain("Pierre prépare, l'humain valide"));
  it("65. limite : aucun email sans validation", () => expect(limits).toContain("Aucun email n'est envoyé sans validation"));
  it("66. limite : pas lancement public", () => expect(limits).toContain("ne vaut pas lancement public"));
  it("96. summary dit prochaine phase P6.6", () => expect(summarizePierreCustomerActivationE2EFinalReport(report)).toContain("P6.6"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.5 — Routes, SQL, flag, UI, QA", () => {
  it("71. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("72. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("73. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("74. UI : « Pierre — Activation client E2E »", () => expect(PIERRE_ACTIVATION_TITLE).toContain("Pierre — Activation client E2E"));
  it("75. UI : « parcours client contrôlé »", () => expect(PIERRE_ACTIVATION_MICROCOPY).toContain("parcours client contrôlé"));
  it("76. UI : « pas le lancement public »", () => expect(PIERRE_ACTIVATION_FIRST_VALUE).toContain("pas le lancement public"));
  it("77. UI : « Aucune exécution autonome »", () => expect(PIERRE_ACTIVATION_NO_AUTONOMOUS).toContain("Aucune exécution autonome"));
  it("78. page ne contient pas « Déclarer paiement live »", () => expect(pageSrc).not.toContain("Déclarer paiement live"));
  it("79. page ne contient pas « Activer Stripe live »", () => expect(pageSrc).not.toContain("Activer Stripe live"));
  it("80. page ne contient pas « Exécuter runtime »", () => expect(pageSrc).not.toContain("Exécuter runtime"));
  it("80b. page câble l'activation (titre)", () => expect(pageSrc).toContain("Pierre — Activation client E2E"));
  it("81. QA checklist ready", () => {
    const checklist = buildPierreCustomerActivationE2EFinalQaChecklist();
    expect(checklist.phase).toBe("6.5");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildPierreCustomerActivationE2EFinalQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.activation_proof_path_only).toBe(true);
  });
  it("E1. package test:phase6-5", () => expect(packageJson).toContain("test:phase6-5"));
  it("E2. package check activation", () => expect(packageJson).toContain("check:pierre-customer-activation-e2e-final"));
  it("E3. doc mentionne PHASE 6.6", () => expect(docSrc).toContain("PHASE 6.6"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P6.4)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.5 — Cascade intacte", () => {
  it("82. P6.4 : channels identity ready", () => expect(buildPierreChannelsIdentityFinalReport().identity_status).toBe("channels_ready_for_first_sale"));
  it("83. P6.3 : decision gate local_first_controlled_sale", () => expect(buildPierreStateServerActivationDecisionGate().recommended_strategy).toBe("local_first_controlled_sale"));
  it("84. P6.2 : 5 scénarios prêts", () => expect(buildPierreRealWorkflowCompletionPack().pack_status).toBe("scenarios_ready_for_demo"));
  it("85. P6.1 : audit ready_for_p6_2", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("86. P5.10 : closure ready", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("87. P5.9 : handbook documentation_ready", () => expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready"));
  it("88. P5.8 : transition ready", () => expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply"));
  it("89. P5.7 : final gate go", () => expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase"));
  it("90. P5.6 : restore no GET", () => { readyMissionId(); expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false); });
  it("91. P5.5 : manual activation QA ready", () => expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready"));
  it("92. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("93. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("94. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("95. P5.1 : create local controlled mission", () => expect(createLocalControlledMission(eligibleContract()).ok).toBe(true));
  const scriptsPkg = ["test:phase6-4", "test:phase6-3", "test:phase6-2", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
