// src/lib/clonestore/runtime-integration/__tests__/pierre-channels-identity-final-phase6-4.test.ts
// PHASE 6.4 — Pierre Channels & Identity Final — Tests

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
  // P5.4 → P6.3 (intact)
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
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P6.4
  buildPierreChannelsIdentityFinalReport,
  buildPierreDisplayIdentity,
  buildPierreChannelMatrix,
  buildPierreEmailIdentityStrategy,
  buildPierreDomainReadinessStrategy,
  buildPierrePermissionsMatrix,
  buildPierreDraftTemplateMatrix,
  buildPierreCloneGuardIdentityRules,
  buildPierreCloneTraceIdentityEvents,
  buildPierreChannelsIdentityFinalQaChecklist,
  buildPierreChannelsIdentityFinalQaVerdict,
  summarizePierreChannelsIdentityFinalReport,
  PIERRE_IDENTITY_TITLE,
  PIERRE_IDENTITY_MICROCOPY,
  PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED,
  PIERRE_IDENTITY_SALE_VS_EMAIL,
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

const typesSrc = readSrc(`${RI_DIR}/pierre-channels-identity-final-types.ts`);
const moduleSrc = readSrc(`${RI_DIR}/pierre-channels-identity-final.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/pierre-channels-identity-final-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/pierre-channels-identity-final-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_6_4_PIERRE_CHANNELS_IDENTITY_FINAL.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_6_4_PIERRE_CHANNELS_IDENTITY_FINAL_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-pierre-channels-identity-final-phase6-4.mjs");
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

const channels = buildPierreChannelMatrix();
const chById = (id: string) => channels.find((c) => c.id === id)!;
const perms = buildPierrePermissionsMatrix();
const permByChannel = (name: string) => perms.find((p) => p.channel === name)!;

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.4 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. module existe", () => expect(moduleSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("55. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("56. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("57. modules ne contiennent pas provider email", () => {
    for (const p of ["resend", "sendgrid", "postmark", "nodemailer"]) expect(scanBlob.toLowerCase()).not.toContain(p);
  });
  it("58. modules ne contiennent pas import OpenAI/Anthropic", () => {
    expect(scanBlob.toLowerCase()).not.toContain("openai");
    expect(scanBlob.toLowerCase()).not.toContain("anthropic");
  });
  it("P8. modules ne contiennent pas import Pierre / /api/", () => {
    expect([typesSrc, moduleSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre');
    expect(scanBlob).not.toContain("/api/");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Identité & canaux
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.4 — Identité & canaux", () => {
  const report = buildPierreChannelsIdentityFinalReport();
  const identity = buildPierreDisplayIdentity();

  it("1. phase = 6.4", () => expect(report.phase).toBe("6.4"));
  it("2. ready_for_p6_5 true", () => expect(report.ready_for_p6_5).toBe(true));
  it("3. email_live_enabled false", () => expect(report.email_live_enabled).toBe(false));
  it("4. domain_connected false", () => expect(report.domain_connected).toBe(false));
  it("5. dns_modified false", () => expect(report.dns_modified).toBe(false));
  it("6. spf_verified false", () => expect(report.spf_verified).toBe(false));
  it("7. dkim_verified false", () => expect(report.dkim_verified).toBe(false));
  it("8. dmarc_verified false", () => expect(report.dmarc_verified).toBe(false));
  it("9. send_route_created false", () => expect(report.send_route_created).toBe(false));
  it("10. real_email_sent false", () => expect(report.real_email_sent).toBe(false));
  it("11. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("12. server_persistence_active false", () => expect(report.server_persistence_active).toBe(false));
  it("13. sql_applied false", () => expect(report.sql_applied).toBe(false));
  it("14. env_modified false", () => expect(report.env_modified).toBe(false));
  it("15. pierre_fully_sellable_declared false", () => expect(report.pierre_fully_sellable_declared).toBe(false));
  it("16. public_launch_validated false", () => expect(report.public_launch_validated).toBe(false));
  it("17. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));

  it("18. display identity Pierre", () => expect(identity.employee_name).toBe("Pierre"));
  it("19. display identity role", () => expect(identity.employee_role).toBe("Employé IA RH CloneStore"));
  it("20. allowed claims non-empty", () => expect(identity.allowed_claims.length).toBeGreaterThan(0));
  it("21. forbidden claims : no sanction / no payroll / no legal replacement", () => {
    const f = identity.forbidden_claims.join(" ");
    expect(f).toContain("no sanction");
    expect(f).toContain("no payroll");
    expect(f).toContain("no legal replacement");
  });

  it("22. channel : dashboard/cockpit", () => expect(channels.some((c) => c.channel.toLowerCase().includes("dashboard"))).toBe(true));
  it("23. channel : demo", () => expect(channels.some((c) => c.channel.toLowerCase().includes("demo"))).toBe(true));
  it("24. channel : email outbound", () => expect(chById("ch_email_outbound")).toBeDefined());
  it("25. channel : email outbound draft_only", () => expect(chById("ch_email_outbound").status).toBe("draft_only"));
  it("26. channel : email inbound future", () => expect(chById("ch_email_inbound").status).toBe("future"));
  it("27. channel : customer domain future_public_launch", () => expect(chById("ch_customer_domain").status).toBe("future_public_launch"));
  it("28. channel : voice future", () => expect(chById("ch_voice").status).toBe("future"));
  it("29. channel : file/document upload", () => expect(chById("ch_file_upload")).toBeDefined());
  it("30. channel : integrations future", () => expect(chById("ch_integrations").status).toBe("future"));

  it("31. email strategy first sale draft only", () => expect(buildPierreEmailIdentityStrategy().first_sale_mode.join(" ")).toContain("draft only"));
  it("32. email strategy future SPF/DKIM/DMARC", () => expect(buildPierreEmailIdentityStrategy().future_customer_domain_mode.join(" ")).toContain("SPF/DKIM/DMARC"));
  it("33. domain readiness : all verified false", () => expect(buildPierreDomainReadinessStrategy().every((d) => d.verified === false)).toBe(true));

  it("34. permissions dashboard : prepare true, real send false", () => {
    const p = permByChannel("dashboard");
    expect(p.can_prepare_draft).toBe(true);
    expect(p.can_send_real_message).toBe(false);
  });
  it("35. permissions outbound email : real send false", () => expect(permByChannel("outbound_email").can_send_real_message).toBe(false));
  it("36. permissions inbound email future", () => expect(permByChannel("inbound_email").cloneguard_decision).toBe("future"));
  it("37. permissions voice future", () => expect(permByChannel("voice").cloneguard_decision).toBe("future"));
  it("38. permissions integrations future", () => expect(permByChannel("integrations").cloneguard_decision).toBe("future"));

  const tpls = buildPierreDraftTemplateMatrix();
  it("39. draft templates >= 6", () => expect(tpls.length).toBeGreaterThanOrEqual(6));
  it("40. every template requires_human_validation true", () => expect(tpls.every((t) => t.requires_human_validation === true)).toBe(true));
  it("41. every template can_be_sent_now false", () => expect(tpls.every((t) => t.can_be_sent_now === false)).toBe(true));
  const tplNames = tpls.map((t) => t.name.toLowerCase()).join(" | ");
  it("42. template absence manager update", () => expect(tplNames).toContain("absence"));
  it("43. template recruitment intro", () => expect(tplNames).toContain("recruitment"));
  it("44. template onboarding checklist", () => expect(tplNames).toContain("onboarding"));
  it("45. template payroll variables reminder", () => expect(tplNames).toContain("payroll"));
  it("46. template sensitive HR meeting", () => expect(tplNames).toContain("sensitive"));
  it("47. template multi-site coordination", () => expect(tplNames).toContain("multi-site"));

  const guard = buildPierreCloneGuardIdentityRules().join(" ");
  it("48. CloneGuard : no spoofing", () => expect(guard).toContain("No spoofing"));
  it("49. CloneGuard : no unauthorized sender", () => expect(guard).toContain("No unauthorized sender"));
  it("50. CloneGuard : no external email before identity verified", () => expect(guard).toContain("No external email before identity verified"));
  it("51. CloneGuard : no CloneVoice live claim", () => expect(guard).toContain("No CloneVoice live claim"));

  const trace = buildPierreCloneTraceIdentityEvents();
  it("52. CloneTrace : identity_plan_created", () => expect(trace).toContain("identity_plan_created"));
  it("53. CloneTrace : no_real_send_confirmed", () => expect(trace).toContain("no_real_send_confirmed"));
  it("54. CloneTrace : no_domain_connection_confirmed", () => expect(trace).toContain("no_domain_connection_confirmed"));
  it("83. summary dit prochaine phase P6.5", () => expect(summarizePierreChannelsIdentityFinalReport(report)).toContain("P6.5"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.4 — Routes, SQL, flag, UI, QA", () => {
  it("59. P6.4 ne crée aucune route send (route moteur Pierre préexistante intacte, hors scope)", () => {
    // src/app/api/pierre/email/send/route.ts est une route MOTEUR Pierre préexistante,
    // hors scope P6.4 (non modifiée). P6.4 ne crée aucune NOUVELLE route d'envoi.
    expect(hasFile("src/app/api/email/send/route.ts")).toBe(false);
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/email/route.ts")).toBe(false);
    expect(buildPierreChannelsIdentityFinalReport().send_route_created).toBe(false);
  });
  it("60. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("61. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("62. UI : « Pierre — Identité & canaux »", () => expect(PIERRE_IDENTITY_TITLE).toContain("Pierre — Identité & canaux"));
  it("63. UI : « Aucun email réel »", () => expect(PIERRE_IDENTITY_MICROCOPY).toContain("Aucun email réel"));
  it("64. UI : « Le domaine client n'est pas connecté »", () => expect(PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED).toContain("domaine client n'est pas connecté"));
  it("65. UI : « Première vente contrôlée ≠ email production »", () => expect(PIERRE_IDENTITY_SALE_VS_EMAIL).toContain("Première vente contrôlée ≠ email production"));
  it("66. page ne contient pas « Envoyer email réel »", () => expect(pageSrc).not.toContain("Envoyer email réel"));
  it("67. page ne contient pas « Connecter domaine »", () => expect(pageSrc).not.toContain("Connecter domaine"));
  it("68. page ne contient pas « Vérifier DNS »", () => expect(pageSrc).not.toContain("Vérifier DNS"));
  it("68b. page câble l'identité (constante)", () => expect(pageSrc).toContain("PIERRE_IDENTITY_TITLE"));
  it("69. QA checklist ready", () => {
    const checklist = buildPierreChannelsIdentityFinalQaChecklist();
    expect(checklist.phase).toBe("6.4");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildPierreChannelsIdentityFinalQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.identity_readiness_only).toBe(true);
  });
  it("E1. package test:phase6-4", () => expect(packageJson).toContain("test:phase6-4"));
  it("E2. package check identity", () => expect(packageJson).toContain("check:pierre-channels-identity-final"));
  it("E3. doc mentionne PHASE 6.5", () => expect(docSrc).toContain("PHASE 6.5"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P6.3)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.4 — Cascade intacte", () => {
  it("70. P6.3 : decision gate local_first_controlled_sale", () => expect(buildPierreStateServerActivationDecisionGate().recommended_strategy).toBe("local_first_controlled_sale"));
  it("71. P6.2 : 5 scénarios prêts", () => expect(buildPierreRealWorkflowCompletionPack().pack_status).toBe("scenarios_ready_for_demo"));
  it("72. P6.1 : audit ready_for_p6_2", () => expect(buildPierreSellableCompletionMasterAuditReport().audit_status).toBe("ready_for_p6_2"));
  it("73. P5.10 : closure ready_for_pierre_sellable_sprint", () => expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint"));
  it("74. P5.9 : handbook documentation_ready", () => expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready"));
  it("75. P5.8 : transition ready_for_future_manual_sql_apply", () => expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply"));
  it("76. P5.7 : final gate go_for_next_design_phase", () => expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase"));
  it("77. P5.6 : restore no GET", () => {
    readyMissionId();
    expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false);
  });
  it("78. P5.5 : manual activation QA ready", () => expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready"));
  it("79. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("80. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("81. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("82. P5.1 : create local controlled mission", () => expect(createLocalControlledMission(eligibleContract()).ok).toBe(true));
  const scriptsPkg = ["test:phase6-3", "test:phase6-2", "test:phase6-1", "test:phase5-10", "test:phase5-1", "test:pfinal02"];
  scriptsPkg.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
