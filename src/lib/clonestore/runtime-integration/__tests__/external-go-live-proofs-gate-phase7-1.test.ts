// src/lib/clonestore/runtime-integration/__tests__/external-go-live-proofs-gate-phase7-1.test.ts
// PHASE 7.1 — External Go-Live Proofs Gate — Tests

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
  // P5.1 → P6.6 (intact)
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
  buildPierreSellableGateFinalReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P7.1
  buildExternalGoLiveProofsReport,
  buildStripeLiveMatrix,
  buildSupabaseProdRlsMatrix,
  buildDomainEmailMatrix,
  buildFirstLiveCustomerMatrix,
  buildExternalEvidenceRequired,
  buildExternalEvidenceCollected,
  buildExternalBlockers,
  buildExternalManualSteps,
  buildExternalRollbackPlan,
  buildExternalGoLiveProofsQaChecklist,
  buildExternalGoLiveProofsQaVerdict,
  summarizeExternalGoLiveProofsReport,
  EXTERNAL_GOLIVE_TITLE,
  EXTERNAL_GOLIVE_MICROCOPY,
  EXTERNAL_GOLIVE_NOT_PUBLIC,
  EXTERNAL_GOLIVE_NO_INVENTED,
  type RuntimeMissionDraft,
  type ExternalProofMatrixRow,
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

const typesSrc = readSrc(`${RI_DIR}/external-go-live-proofs-gate-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/external-go-live-proofs-gate.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/external-go-live-proofs-gate-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/external-go-live-proofs-gate-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_7_1_EXTERNAL_GO_LIVE_PROOFS.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_7_1_EXTERNAL_GO_LIVE_PROOFS_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-external-go-live-proofs-phase7-1.mjs");
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

// ── Données P7.1 ────────────────────────────────────────────────────────────────

const report = buildExternalGoLiveProofsReport();
const stripe = buildStripeLiveMatrix();
const supa = buildSupabaseProdRlsMatrix();
const domain = buildDomainEmailMatrix();
const customer = buildFirstLiveCustomerMatrix();
const allRows: ExternalProofMatrixRow[] = [...stripe, ...supa, ...domain, ...customer];
const manual = buildExternalManualSteps();
const rollback = buildExternalRollbackPlan();
const blockers = buildExternalBlockers().join(" ");
const evidenceReq = buildExternalEvidenceRequired().join(" ");

const hasClass = (rows: ExternalProofMatrixRow[], c: string) => rows.some((r) => r.classification === c);
const rowById = (id: string) => allRows.find((r) => r.id === id)!;

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 0 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.1 — Présence & pureté", () => {
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
// BLOC 1 — Verdict par défaut & invariants (tests 1 → 21)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.1 — Verdict par défaut & invariants", () => {
  it("1. phase = 7.1", () => expect(report.phase).toBe("7.1"));
  it("2. proof_status manual_proof_required", () => expect(report.proof_status).toBe("manual_proof_required"));
  it("3. public_launch_verdict BLOCKED", () => expect(report.public_launch_verdict).toBe("BLOCKED"));
  it("4. first_live_customer_ready conditional", () => expect(report.first_live_customer_ready).toBe("conditional"));
  it("5. ready_for_first_live_customer_controlled_run true", () => expect(report.ready_for_first_live_customer_controlled_run).toBe(true));
  it("6. external_go_live_proofs_ready false", () => expect(report.external_go_live_proofs_ready).toBe(false));
  it("7. public_launch_ready false", () => expect(report.public_launch_ready).toBe(false));
  it("8. stripe_live_verified false", () => expect(report.stripe_live_verified).toBe(false));
  it("9. supabase_prod_rls_verified false", () => expect(report.supabase_prod_rls_verified).toBe(false));
  it("10. domain_email_verified false", () => expect(report.domain_email_verified).toBe(false));
  it("11. first_live_customer_verified false", () => expect(report.first_live_customer_verified).toBe(false));
  it("12. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("13. real_payment_performed false", () => expect(report.real_payment_performed).toBe(false));
  it("14. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("15. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("16. env_modified false", () => expect(report.env_modified).toBe(false));
  it("17. go_live_proofs_modified false", () => expect(report.go_live_proofs_modified).toBe(false));
  it("18. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("19. go_live_proofs_reference mentions lecture seule / jamais modifié", () => {
    expect(report.go_live_proofs_reference).toContain("go-live-proofs.local.json");
    expect(report.go_live_proofs_reference).toContain("jamais modifié");
  });
  it("20. next_phase = First Live Customer Controlled Run", () => expect(report.next_phase_recommendation).toContain("FIRST LIVE CUSTOMER CONTROLLED RUN"));
  it("21. final_note : public launch reste BLOCKED", () => expect(report.final_note).toContain("public launch reste BLOCKED"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Matrices & classifications (tests 22 → 45)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.1 — Matrices & classifications", () => {
  it("22. stripe matrix non-empty", () => expect(stripe.length).toBeGreaterThan(0));
  it("23. supabase matrix non-empty", () => expect(supa.length).toBeGreaterThan(0));
  it("24. domain/email matrix non-empty", () => expect(domain.length).toBeGreaterThan(0));
  it("25. first live customer matrix non-empty", () => expect(customer.length).toBeGreaterThan(0));
  it("26. report wires the 4 matrices", () => {
    expect(report.stripe_live_matrix.length).toBe(stripe.length);
    expect(report.supabase_prod_rls_matrix.length).toBe(supa.length);
    expect(report.domain_email_matrix.length).toBe(domain.length);
    expect(report.first_live_customer_matrix.length).toBe(customer.length);
  });
  it("27. every matrix row verified false (aucune preuve inventée)", () => expect(allRows.every((r) => r.verified === false)).toBe(true));
  it("28. classification A readiness_documented présente", () => expect(hasClass(allRows, "readiness_documented")).toBe(true));
  it("29. classification B manual_proof_required présente", () => expect(hasClass(allRows, "manual_proof_required")).toBe(true));
  it("30. classification D blocking_public_launch présente", () => expect(hasClass(allRows, "blocking_public_launch")).toBe(true));
  it("31. stripe : transaction live réelle est D + bloquante", () => {
    const r = rowById("stripe_live_transaction");
    expect(r.classification).toBe("blocking_public_launch");
    expect(r.blocking_before_public_launch).toBe(true);
  });
  it("32. stripe : webhook live présent", () => expect(rowById("stripe_live_webhook")).toBeDefined());
  it("33. stripe : clés live présentes", () => expect(rowById("stripe_live_keys")).toBeDefined());
  it("34. supabase : RLS activé toutes tables = D + bloquant", () => {
    const r = rowById("supa_rls_enabled");
    expect(r.classification).toBe("blocking_public_launch");
    expect(r.blocking_before_public_launch).toBe(true);
  });
  it("35. supabase : policies RLS testées avec auth réelle = D", () => expect(rowById("supa_rls_tested").classification).toBe("blocking_public_launch"));
  it("36. supabase : projet prod présent", () => expect(rowById("supa_prod_project")).toBeDefined());
  it("37. domaine : SPF/DKIM/DMARC = D + bloquant", () => {
    const r = rowById("dom_spf_dkim_dmarc");
    expect(r.classification).toBe("blocking_public_launch");
    expect(r.blocking_before_public_launch).toBe(true);
  });
  it("38. domaine : domaine + DNS présent", () => expect(rowById("dom_purchased")).toBeDefined());
  it("39. domaine : domaine expéditeur vérifié présent", () => expect(rowById("email_sender_verified")).toBeDefined());
  it("40. premier client : contrat/CGV présent", () => expect(rowById("flc_contract")).toBeDefined());
  it("41. premier client : activation réelle présente", () => expect(rowById("flc_activation")).toBeDefined());
  it("42. premier client : première valeur validée humainement présente", () => expect(rowById("flc_first_value")).toBeDefined());
  it("43. premier client : aucune exécution autonome (A)", () => expect(rowById("flc_no_autonomous").classification).toBe("readiness_documented"));
  it("44. au moins une preuve bloquante par domaine sensible", () => {
    expect(stripe.some((r) => r.blocking_before_public_launch)).toBe(true);
    expect(supa.some((r) => r.blocking_before_public_launch)).toBe(true);
    expect(domain.some((r) => r.blocking_before_public_launch)).toBe(true);
  });
  it("45. evidence_location ne référence aucune route /api/", () => expect(allRows.every((r) => !r.evidence_location.includes("/api/"))).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Evidence, blockers, manual steps, rollback (tests 46 → 60)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.1 — Evidence, blockers, manual steps, rollback", () => {
  it("46. evidence_required non-empty", () => expect(buildExternalEvidenceRequired().length).toBeGreaterThan(0));
  it("47. evidence_collected vide (aucune preuve inventée)", () => expect(buildExternalEvidenceCollected().length).toBe(0));
  it("48. report.evidence_collected vide", () => expect(report.evidence_collected.length).toBe(0));
  it("49. evidence_required mentionne Stripe live + RLS + DNS", () => {
    expect(evidenceReq).toContain("Stripe");
    expect(evidenceReq).toContain("RLS");
    expect(evidenceReq).toContain("DNS");
  });
  it("50. blockers include Stripe live transaction", () => expect(blockers).toContain("Transaction Stripe live"));
  it("51. blockers include RLS prod", () => expect(blockers).toContain("RLS prod"));
  it("52. blockers include SPF/DKIM/DMARC", () => expect(blockers).toContain("SPF / DKIM / DMARC"));
  it("53. blockers include paid customer E2E live", () => expect(blockers).toContain("paiement client E2E live"));
  it("54. blockers include scale 80k", () => expect(blockers).toContain("Scale 80k"));
  it("55. manual steps non-empty", () => expect(manual.length).toBeGreaterThan(0));
  it("56. manual steps require human action, no auto apply", () => {
    expect(manual.every((m) => m.requires_human_action === true)).toBe(true);
    expect(manual.every((m) => m.auto_applied === false)).toBe(true);
  });
  it("57. manual steps ordonnées", () => expect(manual.map((m) => m.order)).toEqual([...manual.map((m) => m.order)].sort((a, b) => a - b)));
  it("58. manual step : mise à jour go-live proofs manuelle", () => expect(manual.some((m) => m.step.includes("go-live proofs"))).toBe(true));
  it("59. rollback plan non-empty + retour test mode Stripe", () => {
    expect(rollback.length).toBeGreaterThan(0);
    expect(rollback.some((r) => r.step.includes("test mode Stripe"))).toBe(true);
  });
  it("60. rollback inclut restauration backup", () => expect(rollback.some((r) => r.step.includes("backup"))).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Routes, SQL, flag, UI, QA, summary (tests 65 → 80)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.1 — Routes, SQL, flag, UI, QA", () => {
  it("65. no route created", () => {
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false);
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
  });
  it("66. SQL P5.4 contains DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("67. P5 flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("68. UI contains « Go-Live — Preuves externes »", () => {
    expect(EXTERNAL_GOLIVE_TITLE).toContain("Go-Live — Preuves externes");
    expect(pageSrc).toContain("Go-Live — Preuves externes");
  });
  it("69. UI : « readiness vs preuve réelle »", () => expect(EXTERNAL_GOLIVE_MICROCOPY).toContain("readiness vs preuve réelle"));
  it("70. UI : « public launch reste bloqué »", () => expect(EXTERNAL_GOLIVE_NOT_PUBLIC).toContain("Public launch reste bloqué"));
  it("71. UI : « aucune preuve inventée »", () => expect(EXTERNAL_GOLIVE_NO_INVENTED).toContain("Aucune preuve live n'est inventée"));
  it("72. UI does not contain active « Déclarer public launch »", () => expect(pageSrc).not.toContain("Déclarer public launch"));
  it("73. UI does not contain active « Activer Stripe live »", () => expect(pageSrc).not.toContain("Activer Stripe live"));
  it("74. UI does not contain active « Envoyer email réel »", () => expect(pageSrc).not.toContain("Envoyer email réel"));
  it("75. UI does not contain active « Modifier go-live proofs »", () => expect(pageSrc).not.toContain("Modifier go-live proofs"));
  it("76. page câble le gate (report)", () => expect(pageSrc).toContain("buildExternalGoLiveProofsReport"));
  it("77. QA checklist ready", () => {
    const cl = buildExternalGoLiveProofsQaChecklist();
    expect(cl.phase).toBe("7.1");
    expect(cl.total).toBeGreaterThanOrEqual(30);
    const verdict = buildExternalGoLiveProofsQaVerdict(cl.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.external_proof_gate_only).toBe(true);
  });
  it("78. summary : public launch BLOCKED + First Live Customer", () => {
    const sum = summarizeExternalGoLiveProofsReport(report);
    expect(sum).toContain("BLOCKED");
    expect(sum).toContain("First Live Customer Controlled Run");
  });
  it("79. package test:phase7-1", () => expect(packageJson).toContain("test:phase7-1"));
  it("80. package check + doc next phase", () => {
    expect(packageJson).toContain("check:external-go-live-proofs");
    expect(docSrc).toContain("FIRST LIVE CUSTOMER CONTROLLED RUN");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte (P5.1 → P6.6) (tests 81 → 96)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 7.1 — Cascade intacte", () => {
  it("81. P6.6 remains intact", () => expect(buildPierreSellableGateFinalReport().final_sellability_level).toBe("controlled_first_customer_sellable"));
  it("82. P6.5 remains intact", () => expect(buildPierreCustomerActivationE2EFinalReport().activation_status).toBe("first_paid_customer_path_ready"));
  it("83. P6.4 remains intact", () => expect(buildPierreChannelsIdentityFinalReport().identity_status).toBe("channels_ready_for_first_sale"));
  it("84. P6.3 remains intact", () => expect(buildPierreStateServerActivationDecisionGate().recommended_strategy).toBe("local_first_controlled_sale"));
  it("85. P6.2 remains intact", () => expect(buildPierreRealWorkflowCompletionPack().pack_status).toBe("scenarios_ready_for_demo"));
  it("86. P6.1 remains intact", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("87. P5.10 remains intact", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("88. P5.9 remains intact", () => expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready"));
  it("89. P5.8 remains intact", () => expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply"));
  it("90. P5.7 remains intact", () => expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase"));
  it("91. P5.6 remains intact", () => { readyMissionId(); expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false); });
  it("92. P5.5 remains intact", () => expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready"));
  it("93. P5.4 remains intact", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("94. P5.3 remains intact", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("95. P5.2 remains intact", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("96. P5.1 remains intact", () => expect(createLocalControlledMission(eligibleContract()).ok).toBe(true));
  const scriptsPkg = ["test:phase6-6", "test:phase6-5", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
