// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-persistence-phase5-closure-phase5-10.test.ts
// PHASE 5.10 — Controlled Mission Persistence Phase 5 Closure Report — Tests

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
  // P5.4 → P5.9 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionPersistenceOperatorHandbook,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P5.10
  buildControlledMissionPersistencePhase5ClosureReport,
  buildControlledMissionPersistencePhase5ClosedBlocks,
  buildControlledMissionPersistencePhase5EvidenceSummary,
  buildControlledMissionPersistencePhase5RiskMatrix,
  buildControlledMissionPersistencePhase5LaunchImpact,
  buildControlledMissionPersistenceP6ReadinessMap,
  buildControlledMissionPersistencePhase5ClosureQaChecklist,
  buildControlledMissionPersistencePhase5ClosureQaVerdict,
  CONTROLLED_MISSION_CLOSURE_MICROCOPY,
  CONTROLLED_MISSION_CLOSURE_NO_GET_POST,
  CONTROLLED_MISSION_CLOSURE_NEXT_P6,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-phase5-closure-types.ts`);
const reportSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-phase5-closure-report.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-persistence-phase5-closure-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-phase5-closure-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_10_CONTROLLED_MISSION_PERSISTENCE_PHASE5_CLOSURE_REPORT.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_10_CONTROLLED_MISSION_PERSISTENCE_PHASE5_CLOSURE_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-persistence-phase5-closure-phase5-10.mjs");
const packageJson = readRootFile("package.json");

// purity blob (la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, reportSrc, uiCopySrc].join("\n");

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

describe("PHASE 5.10 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. report existe", () => expect(reportSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("53. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("54. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("55. modules ne contiennent pas import du moteur Pierre", () => expect([typesSrc, reportSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre'));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Closure report
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.10 — Closure report", () => {
  const report = buildControlledMissionPersistencePhase5ClosureReport();

  it("1. closure phase = 5.10", () => expect(report.phase).toBe("5.10"));
  it("2. phase5_closed true", () => expect(report.phase5_closed).toBe(true));
  it("3. ready_for_p6 true", () => expect(report.ready_for_p6).toBe(true));
  it("4. documentation_ready true", () => expect(report.documentation_ready).toBe(true));
  it("5. server_persistence_active false", () => expect(report.server_persistence_active).toBe(false));
  it("6. server_restore_active false", () => expect(report.server_restore_active).toBe(false));
  it("7. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("8. pierre_runtime_active false", () => expect(report.pierre_runtime_active).toBe(false));
  it("9. sql_applied false", () => expect(report.sql_applied).toBe(false));
  it("10. env_modified false", () => expect(report.env_modified).toBe(false));
  it("11. route_created false", () => expect(report.route_created).toBe(false));
  it("12. server_get_performed false", () => expect(report.server_get_performed).toBe(false));
  it("13. server_post_performed false", () => expect(report.server_post_performed).toBe(false));
  it("14. server_write_performed false", () => expect(report.server_write_performed).toBe(false));
  it("15. server_restore_performed false", () => expect(report.server_restore_performed).toBe(false));
  it("16. real_mission_created false", () => expect(report.real_mission_created).toBe(false));
  it("17. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("18. email_sent false", () => expect(report.email_sent).toBe(false));
  it("19. document_generated false", () => expect(report.document_generated).toBe(false));
  it("20. clonevoice_active false", () => expect(report.clonevoice_active).toBe(false));
  it("21. public_launch_validated false", () => expect(report.public_launch_validated).toBe(false));
  it("22. scale_80k_proven false", () => expect(report.scale_80k_proven).toBe(false));

  const blockPhases = buildControlledMissionPersistencePhase5ClosedBlocks().map((b) => b.phase);
  it("23. closed blocks include P5.1", () => expect(blockPhases).toContain("P5.1"));
  it("24. closed blocks include P5.2", () => expect(blockPhases).toContain("P5.2"));
  it("25. closed blocks include P5.3", () => expect(blockPhases).toContain("P5.3"));
  it("26. closed blocks include P5.4", () => expect(blockPhases).toContain("P5.4"));
  it("27. closed blocks include P5.5", () => expect(blockPhases).toContain("P5.5"));
  it("28. closed blocks include P5.6", () => expect(blockPhases).toContain("P5.6"));
  it("29. closed blocks include P5.7", () => expect(blockPhases).toContain("P5.7"));
  it("30. closed blocks include P5.8", () => expect(blockPhases).toContain("P5.8"));
  it("31. closed blocks include P5.9", () => expect(blockPhases).toContain("P5.9"));
  it("32. every closed block no_execution_confirmed true", () => expect(buildControlledMissionPersistencePhase5ClosedBlocks().every((b) => b.no_execution_confirmed === true)).toBe(true));

  it("33. active capabilities : local safe apply", () => expect(report.active_capabilities.some((c) => c.toLowerCase().includes("local safe apply"))).toBe(true));
  it("34. active capabilities : local review", () => expect(report.active_capabilities.some((c) => c.toLowerCase().includes("local review"))).toBe(true));
  it("35. inactive capabilities : server persistence", () => expect(report.inactive_capabilities.some((c) => c.toLowerCase().includes("server persistence"))).toBe(true));
  it("36. inactive capabilities : runtime execution", () => expect(report.inactive_capabilities.some((c) => c.toLowerCase().includes("runtime execution"))).toBe(true));
  it("37. future capabilities : manual SQL apply", () => expect(report.future_capabilities.some((c) => c.toLowerCase().includes("manual sql apply"))).toBe(true));
  it("38. future capabilities : server GET route", () => expect(report.future_capabilities.some((c) => c.toLowerCase().includes("server get route"))).toBe(true));

  it("39. evidence summary : test:phase5-9 89/89", () => {
    const ev = JSON.stringify(buildControlledMissionPersistencePhase5EvidenceSummary());
    expect(ev).toContain("test:phase5-9");
    expect(ev).toContain("89/89");
  });
  it("40. evidence summary : test:phase5-8 75/75", () => {
    const ev = JSON.stringify(buildControlledMissionPersistencePhase5EvidenceSummary());
    expect(ev).toContain("test:phase5-8");
    expect(ev).toContain("75/75");
  });
  it("41. evidence summary : npm test 8887/8887", () => expect(JSON.stringify(buildControlledMissionPersistencePhase5EvidenceSummary())).toContain("8887/8887"));
  it("42. evidence summary : build clean 145 pages", () => expect(JSON.stringify(buildControlledMissionPersistencePhase5EvidenceSummary())).toContain("145 pages"));

  it("43. risk matrix : false sense of production readiness", () => expect(JSON.stringify(buildControlledMissionPersistencePhase5RiskMatrix())).toContain("production readiness"));
  it("44. risk matrix : SQL too early", () => expect(JSON.stringify(buildControlledMissionPersistencePhase5RiskMatrix())).toContain("SQL too early"));
  it("45. risk matrix : persistence with execution", () => expect(JSON.stringify(buildControlledMissionPersistencePhase5RiskMatrix())).toContain("persistence avec execution"));

  it("46. launch impact : P5 does not make Pierre public-launch complete", () => expect(buildControlledMissionPersistencePhase5LaunchImpact().join(" ")).toContain("ne rend PAS Pierre public-launch complete"));

  const p6Ids = buildControlledMissionPersistenceP6ReadinessMap().map((p) => p.id);
  it("47. P6 readiness map : P6.1", () => expect(p6Ids).toContain("P6.1"));
  it("48. P6 readiness map : P6.2", () => expect(p6Ids).toContain("P6.2"));
  it("49. P6 readiness map : P6.3", () => expect(p6Ids).toContain("P6.3"));
  it("50. P6 readiness map : P6.4", () => expect(p6Ids).toContain("P6.4"));
  it("51. P6 readiness map : P6.5", () => expect(p6Ids).toContain("P6.5"));
  it("52. P6 readiness map : P6.6", () => expect(p6Ids).toContain("P6.6"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.10 — Routes, SQL, flag, UI, QA", () => {
  it("56. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("57. aucune route restore GET", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/restore/route.ts")).toBe(false));
  it("58. aucune route POST active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("59. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("60. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("61. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("62. UI : « Clôture Phase 5 design-only »", () => expect(CONTROLLED_MISSION_CLOSURE_MICROCOPY).toContain("Clôture Phase 5 design-only"));
  it("63. UI : « Aucune activation »", () => expect(CONTROLLED_MISSION_CLOSURE_MICROCOPY).toContain("Aucune activation"));
  it("64. UI : « Aucun GET/POST serveur »", () => expect(CONTROLLED_MISSION_CLOSURE_NO_GET_POST).toContain("Aucun GET/POST serveur"));
  it("65. UI : « P6 — Pierre Sellable Completion Sprint »", () => expect(CONTROLLED_MISSION_CLOSURE_NEXT_P6).toContain("P6 — Pierre Sellable Completion Sprint"));
  it("66. page ne contient pas « Appliquer SQL »", () => expect(pageSrc).not.toContain("Appliquer SQL"));
  it("67. page ne contient pas « Activer flag »", () => expect(pageSrc).not.toContain("Activer flag"));
  it("68. page ne contient pas action « Exécuter la mission »", () => expect(pageSrc).not.toContain("Exécuter la mission"));
  it("68b. page câble la clôture (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_CLOSURE_MICROCOPY"));
  it("69. QA checklist ready", () => {
    const checklist = buildControlledMissionPersistencePhase5ClosureQaChecklist();
    expect(checklist.phase).toBe("5.10");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildControlledMissionPersistencePhase5ClosureQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.phase5_closure_design_only).toBe(true);
  });
  it("E1. package test:phase5-10", () => expect(packageJson).toContain("test:phase5-10"));
  it("E2. package check closure", () => expect(packageJson).toContain("check:controlled-mission-persistence-phase5-closure"));
  it("E3. doc mentionne PHASE 6.1", () => expect(docSrc).toContain("PHASE 6.1"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P5.9)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.10 — Cascade intacte", () => {
  it("78. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("77. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("76. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("75. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("74. P5.5 : manual activation QA ready", () => {
    expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready");
  });
  it("73. P5.6 : restore state design-only", () => {
    readyMissionId();
    expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false);
  });
  it("72. P5.7 : final gate go_for_next_design_phase", () => {
    expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase");
  });
  it("71. P5.8 : transition plan ready_for_future_manual_sql_apply", () => {
    expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply");
  });
  it("70. P5.9 : operator handbook documentation_ready", () => {
    expect(buildControlledMissionPersistenceOperatorHandbook().handbook_status).toBe("documentation_ready");
  });
  const scripts = ["test:phase5-9", "test:phase5-8", "test:phase5-7", "test:phase5-6", "test:phase5-5", "test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
