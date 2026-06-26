// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-server-persistence-final-gate-phase5-7.test.ts
// PHASE 5.7 — Controlled Mission Server Persistence Readiness Final Gate — Tests

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
  // P5.4 / P5.5 / P5.6 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P5.7
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionServerPersistenceFinalGateSections,
  computeControlledMissionServerPersistenceFinalGateScore,
  evaluateControlledMissionServerPersistenceFinalGateVerdict,
  buildControlledMissionServerPersistenceFinalGateCommandMatrix,
  buildControlledMissionServerPersistenceFinalGateInvariants,
  buildControlledMissionServerPersistenceFinalGateQaChecklist,
  buildControlledMissionServerPersistenceFinalGateQaVerdict,
  CONTROLLED_MISSION_FINAL_GATE_MICROCOPY,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-final-gate-types.ts`);
const finalGateSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-final-gate.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-final-gate-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-final-gate-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_7_CONTROLLED_MISSION_SERVER_PERSISTENCE_READINESS_FINAL_GATE.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_7_CONTROLLED_MISSION_SERVER_PERSISTENCE_FINAL_GATE_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-server-persistence-final-gate-phase5-7.mjs");
const packageJson = readRootFile("package.json");

// purity blob (la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, finalGateSrc, uiCopySrc].join("\n");

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

describe("PHASE 5.7 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. final gate existe", () => expect(finalGateSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("30. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("31. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("32. modules ne contiennent pas import lib/pierre", () => expect([typesSrc, finalGateSrc, uiCopySrc, qaSrc].join("\n")).not.toContain("lib/pierre"));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Final Gate report
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.7 — Final Gate report", () => {
  const report = buildControlledMissionServerPersistenceFinalGateReport();
  const sections = buildControlledMissionServerPersistenceFinalGateSections();
  const sectionById = (id: string) => sections.find((x) => x.id === id);

  it("1. report phase = 5.7", () => expect(report.phase).toBe("5.7"));
  it("2. sections A→H présentes", () => {
    const ids = sections.map((x) => x.id);
    for (const id of ["p51_foundation", "p52_review", "p53_preflight", "p54_server_design", "p55_manual_qa", "p56_restore_ui", "global_no_execution", "launch_scale_warnings"]) {
      expect(ids).toContain(id);
    }
    expect(sections.length).toBe(8);
  });
  it("3. score déterministe", () => {
    const a = computeControlledMissionServerPersistenceFinalGateScore(sections);
    const b = computeControlledMissionServerPersistenceFinalGateScore(buildControlledMissionServerPersistenceFinalGateSections());
    expect(a).toBe(b);
    expect(report.readiness_score).toBe(a);
  });
  it("4. score entre 0 et 100", () => {
    expect(report.readiness_score).toBeGreaterThanOrEqual(0);
    expect(report.readiness_score).toBeLessThanOrEqual(100);
  });
  it("5. verdict jamais production ready", () => {
    expect(["go_for_next_design_phase", "blocked", "needs_review"]).toContain(report.overall_verdict);
    expect(JSON.stringify(report).toLowerCase()).not.toContain("production ready");
  });
  it("6. verdict jamais execution ready", () => {
    expect(JSON.stringify(report).toLowerCase()).not.toContain("execution ready");
    expect(report.overall_verdict).toBe("go_for_next_design_phase");
  });
  it("7. completed_blocks contient P5.1→P5.6", () => {
    for (const b of ["P5.1", "P5.2", "P5.3", "P5.4", "P5.5", "P5.6"]) expect(report.completed_blocks).toContain(b);
  });
  it("8. P5.1 section passed", () => expect(sectionById("p51_foundation")!.status).toBe("passed"));
  it("9. P5.2 section passed", () => expect(sectionById("p52_review")!.status).toBe("passed"));
  it("10. P5.3 section passed", () => expect(sectionById("p53_preflight")!.status).toBe("passed"));
  it("11. P5.4 section passed", () => expect(sectionById("p54_server_design")!.status).toBe("passed"));
  it("12. P5.5 section passed", () => expect(sectionById("p55_manual_qa")!.status).toBe("passed"));
  it("13. P5.6 section passed", () => expect(sectionById("p56_restore_ui")!.status).toBe("passed"));
  it("14. global no-execution section passed", () => expect(sectionById("global_no_execution")!.status).toBe("passed"));
  it("15. launch/scale section warning", () => expect(sectionById("launch_scale_warnings")!.status).toBe("warning"));

  it("16. sql_applied false", () => expect(report.sql_applied).toBe(false));
  it("17. env_modified false", () => expect(report.env_modified).toBe(false));
  it("18. route_created false", () => expect(report.route_created).toBe(false));
  it("19. server_get_performed false", () => expect(report.server_get_performed).toBe(false));
  it("20. server_write_performed false", () => expect(report.server_write_performed).toBe(false));
  it("21. runtime_execution_active false", () => expect(report.runtime_execution_active).toBe(false));
  it("22. pierre_runtime_active false", () => expect(report.pierre_runtime_active).toBe(false));
  it("23. real_mission_created false", () => expect(report.real_mission_created).toBe(false));
  it("24. ai_call_performed false", () => expect(report.ai_call_performed).toBe(false));
  it("25. email_sent false", () => expect(report.email_sent).toBe(false));
  it("26. document_generated false", () => expect(report.document_generated).toBe(false));
  it("27. clonevoice_active false", () => expect(report.clonevoice_active).toBe(false));
  it("27b. phase_closure true + verdict never production", () => {
    expect(report.phase_closure).toBe(true);
    expect(report.server_persistence_active).toBe(false);
    expect(report.server_restore_active).toBe(false);
  });

  it("28. command matrix contient test:phase5-7", () => {
    const matrix = buildControlledMissionServerPersistenceFinalGateCommandMatrix();
    expect(matrix.some((c) => c.command === "npm run test:phase5-7")).toBe(true);
  });
  it("29. command matrix contient check final gate", () => {
    const matrix = buildControlledMissionServerPersistenceFinalGateCommandMatrix();
    expect(matrix.some((c) => c.command.includes("check:controlled-mission-server-persistence-final-gate"))).toBe(true);
  });
  it("V. evaluate verdict cohérent + invariants holds", () => {
    expect(evaluateControlledMissionServerPersistenceFinalGateVerdict(sections)).toBe("go_for_next_design_phase");
    expect(buildControlledMissionServerPersistenceFinalGateInvariants().every((i) => i.holds === true)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.7 — Routes, SQL, flag, UI, QA", () => {
  it("33. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("34. aucune route restore GET", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/restore/route.ts")).toBe(false));
  it("35. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("36. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("37. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("38. UI : « Final Gate design-only »", () => expect(CONTROLLED_MISSION_FINAL_GATE_MICROCOPY).toContain("Final Gate design-only"));
  it("39. UI : « Aucune activation »", () => expect(CONTROLLED_MISSION_FINAL_GATE_MICROCOPY).toContain("Aucune activation"));
  it("40. page ne contient pas « Appliquer SQL »", () => expect(pageSrc).not.toContain("Appliquer SQL"));
  it("41. page ne contient pas action « Exécuter la mission »", () => expect(pageSrc).not.toContain("Exécuter la mission"));
  it("41b. page câble le final gate (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_FINAL_GATE_MICROCOPY"));
  it("42. QA checklist ready", () => {
    const checklist = buildControlledMissionServerPersistenceFinalGateQaChecklist();
    expect(checklist.phase).toBe("5.7");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildControlledMissionServerPersistenceFinalGateQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.final_gate_design_only).toBe(true);
  });
  it("E1. package test:phase5-7", () => expect(packageJson).toContain("test:phase5-7"));
  it("E2. package check final gate", () => expect(packageJson).toContain("check:controlled-mission-server-persistence-final-gate"));
  it("E3. doc mentionne PHASE 5.8", () => expect(docSrc).toContain("PHASE 5.8"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P5.6)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.7 — Cascade intacte", () => {
  it("48. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("47. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("46. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("45. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("44. P5.5 : manual activation QA ready", () => {
    expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready");
  });
  it("43. P5.6 : restore state design-only", () => {
    const id = readyMissionId();
    const state = buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions());
    expect(state.server_get_performed).toBe(false);
    expect(state.eligible_local_rows).toBeGreaterThan(0);
    expect(getLocalControlledMissionById(id)).not.toBeNull();
  });
  const scripts = ["test:phase5-6", "test:phase5-5", "test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
