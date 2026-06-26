// src/lib/clonestore/runtime-integration/__tests__/pierre-sellable-completion-master-audit-phase6-1.test.ts
// PHASE 6.1 — Pierre Sellable Completion Master Audit — Tests

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
  // P5.4 → P5.10 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionPersistenceOperatorHandbook,
  buildControlledMissionPersistencePhase5ClosureReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P6.1
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreSellableAuditSections,
  buildPierreSellableAuditGapMatrix,
  buildPierreSellableAuditBlockerMatrix,
  buildPierreSellableAuditTechnologyDependencyMap,
  buildPierreSellableAuditCustomerJourneyMap,
  buildPierreSellableAuditRiskMatrix,
  buildPierreSellableAuditP6Sequence,
  buildPierreSellableCompletionMasterAuditQaChecklist,
  buildPierreSellableCompletionMasterAuditQaVerdict,
  summarizePierreSellableCompletionMasterAuditReport,
  PIERRE_SELLABLE_AUDIT_MICROCOPY,
  PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE,
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

const typesSrc = readSrc(`${RI_DIR}/pierre-sellable-completion-master-audit-types.ts`);
const auditSrc = readSrc(`${RI_DIR}/pierre-sellable-completion-master-audit.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/pierre-sellable-completion-master-audit-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/pierre-sellable-completion-master-audit-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_6_1_PIERRE_SELLABLE_COMPLETION_MASTER_AUDIT.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_6_1_PIERRE_SELLABLE_COMPLETION_MASTER_AUDIT_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-pierre-sellable-completion-master-audit-phase6-1.mjs");
const packageJson = readRootFile("package.json");

// purity blob (la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, auditSrc, uiCopySrc].join("\n");

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

describe("PHASE 6.1 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. audit existe", () => expect(auditSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("43. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("44. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("45. modules ne contiennent pas import du moteur Pierre", () => expect([typesSrc, auditSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre'));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Master Audit
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.1 — Master Audit", () => {
  const report = buildPierreSellableCompletionMasterAuditReport();
  const sections = buildPierreSellableAuditSections();
  const titleHas = (kw: string) => sections.some((s) => s.title.toLowerCase().includes(kw.toLowerCase()));

  it("1. phase = 6.1", () => expect(report.phase).toBe("6.1"));
  it("2. ready_for_p6_2 true", () => expect(report.ready_for_p6_2).toBe(true));
  it("3. pierre_sellable_declared false", () => expect(report.pierre_sellable_declared).toBe(false));
  it("4. public_launch_validated false", () => expect(report.public_launch_validated).toBe(false));
  it("5. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));
  it("6. sellable_level n'est pas fully_sellable", () => expect(report.sellable_level).not.toBe("fully_sellable"));
  it("7. sections A→J présentes (10)", () => expect(sections.length).toBe(10));
  it("8. section Pierre Product Surface", () => expect(titleHas("Product Surface")).toBe(true));
  it("9. section Pierre Core HR Workflows", () => expect(titleHas("Core HR Workflows")).toBe(true));
  it("10. section Runtime / Mission Chain", () => expect(titleHas("Runtime")).toBe(true));
  it("11. section Enterprise Footprint", () => expect(titleHas("Enterprise Footprint")).toBe(true));
  it("12. section CloneGuard / CloneTrace", () => expect(titleHas("CloneGuard")).toBe(true));
  it("13. section Technologies Dependency", () => expect(titleHas("Technologies Dependency")).toBe(true));
  it("14. section Customer Activation Flow", () => expect(titleHas("Customer Activation")).toBe(true));
  it("15. section Commercial Readiness", () => expect(titleHas("Commercial Readiness")).toBe(true));
  it("16. section External Production Readiness", () => expect(titleHas("External Production")).toBe(true));
  it("17. section Launch / Scale Reality", () => expect(titleHas("Launch / Scale")).toBe(true));

  it("18. sellable definition : 5 scénarios", () => expect(report.sellable_definition.is_sellable_when.join(" ")).toContain("5 scénarios"));
  it("19. sellable definition : human validation", () => expect(report.sellable_definition.is_sellable_when.join(" ")).toContain("human validation"));
  it("20. sellable definition : trace", () => expect(report.sellable_definition.is_sellable_when.join(" ")).toContain("trace"));
  it("21. not_sellable_yet_reasons : Stripe/Supabase/public launch", () => {
    const r = report.not_sellable_yet_reasons.join(" ");
    expect(r).toContain("Stripe");
    expect(r).toContain("Supabase");
    expect(r.toLowerCase()).toContain("public launch");
  });
  it("22. first_sale_minimum_requirements non-empty", () => expect(report.first_sale_minimum_requirements.length).toBeGreaterThan(0));
  it("23. public_launch_minimum_requirements non-empty", () => expect(report.public_launch_minimum_requirements.length).toBeGreaterThan(0));

  it("24. gap matrix : runtime execution inactive", () => expect(JSON.stringify(buildPierreSellableAuditGapMatrix())).toContain("runtime execution inactive"));
  it("25. gap matrix : server persistence inactive", () => expect(JSON.stringify(buildPierreSellableAuditGapMatrix())).toContain("server persistence inactive"));
  it("26. gap matrix : public launch external not validated", () => expect(JSON.stringify(buildPierreSellableAuditGapMatrix())).toContain("public launch external not validated"));
  it("27. blocker matrix : paid customer E2E not proven", () => expect(JSON.stringify(buildPierreSellableAuditBlockerMatrix()).toLowerCase()).toContain("paid customer e2e not proven"));

  const techs = buildPierreSellableAuditTechnologyDependencyMap().map((t) => t.technology);
  it("28. tech map : CloneOS", () => expect(techs).toContain("CloneOS"));
  it("29. tech map : CloneGuard", () => expect(techs).toContain("CloneGuard"));
  it("30. tech map : CloneTrace", () => expect(techs).toContain("CloneTrace"));
  it("31. tech map : CloneADN", () => expect(techs).toContain("CloneADN"));
  it("32. tech map : CloneVoice", () => expect(techs).toContain("CloneVoice"));

  const journey = buildPierreSellableAuditCustomerJourneyMap();
  it("33. journey : checkout", () => expect(journey.some((j) => j.step.toLowerCase().includes("checkout"))).toBe(true));
  it("34. journey : onboarding", () => expect(journey.some((j) => j.step.toLowerCase().includes("onboarding"))).toBe(true));
  it("35. journey : first useful output", () => expect(journey.some((j) => j.step.toLowerCase().includes("first useful output"))).toBe(true));

  it("36. risk matrix : false sellable claim", () => expect(JSON.stringify(buildPierreSellableAuditRiskMatrix())).toContain("false sellable claim"));
  it("37. risk matrix : public launch before proof", () => expect(JSON.stringify(buildPierreSellableAuditRiskMatrix())).toContain("public launch before proof"));

  const p6 = buildPierreSellableAuditP6Sequence().map((x) => x.id);
  it("38. P6 sequence : P6.2", () => expect(p6).toContain("P6.2"));
  it("39. P6 sequence : P6.3", () => expect(p6).toContain("P6.3"));
  it("40. P6 sequence : P6.4", () => expect(p6).toContain("P6.4"));
  it("41. P6 sequence : P6.5", () => expect(p6).toContain("P6.5"));
  it("42. P6 sequence : P6.6", () => expect(p6).toContain("P6.6"));
  it("66. summary dit prochaine phase P6.2", () => expect(summarizePierreSellableCompletionMasterAuditReport(report)).toContain("P6.2"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.1 — Routes, SQL, flag, UI, QA", () => {
  it("46. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("47. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("48. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("49. UI : « Audit Pierre vendable »", () => expect(PIERRE_SELLABLE_AUDIT_MICROCOPY).toContain("Audit Pierre vendable"));
  it("50. UI : « Aucune activation »", () => expect(PIERRE_SELLABLE_AUDIT_MICROCOPY).toContain("Aucune activation"));
  it("51. UI : « Pierre n'est pas encore public-launch complete »", () => expect(PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE).toContain("public-launch complete"));
  it("52. page ne contient pas « Déclarer vendable »", () => expect(pageSrc).not.toContain("Déclarer vendable"));
  it("53. page ne contient pas « Activer serveur »", () => expect(pageSrc).not.toContain("Activer serveur"));
  it("54. page ne contient pas « Exécuter runtime »", () => expect(pageSrc).not.toContain("Exécuter runtime"));
  it("54b. page câble l'audit (constante)", () => expect(pageSrc).toContain("PIERRE_SELLABLE_AUDIT_MICROCOPY"));
  it("55. QA checklist ready", () => {
    const checklist = buildPierreSellableCompletionMasterAuditQaChecklist();
    expect(checklist.phase).toBe("6.1");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildPierreSellableCompletionMasterAuditQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.audit_only).toBe(true);
  });
  it("E1. package test:phase6-1", () => expect(packageJson).toContain("test:phase6-1"));
  it("E2. package check audit", () => expect(packageJson).toContain("check:pierre-sellable-completion-master-audit"));
  it("E3. doc mentionne PHASE 6.2", () => expect(docSrc).toContain("PHASE 6.2"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P5.10)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 6.1 — Cascade intacte", () => {
  it("65. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("64. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("63. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("62. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("61. P5.5 : manual activation QA ready", () => {
    expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready");
  });
  it("60. P5.6 : restore state design-only", () => {
    readyMissionId();
    expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false);
  });
  it("59. P5.7 : final gate go_for_next_design_phase", () => {
    expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase");
  });
  it("58. P5.8 : transition plan ready_for_future_manual_sql_apply", () => {
    expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply");
  });
  it("57. P5.9 : operator handbook documentation_ready", () => {
    expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready");
  });
  it("56. P5.10 : closure ready_for_pierre_sellable_sprint", () => {
    expect(buildControlledMissionPersistencePhase5ClosureReport().closure_status).toBe("ready_for_pierre_sellable_sprint");
  });
  const scripts = ["test:phase5-10", "test:phase5-9", "test:phase5-8", "test:phase5-7", "test:phase5-6", "test:phase5-5", "test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
