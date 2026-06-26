// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-persistence-transition-plan-phase5-8.test.ts
// PHASE 5.8 — Controlled Mission Persistence Transition Plan — Tests

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
  // P5.4 → P5.7 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P5.8
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionPersistenceTransitionPhases,
  computeControlledMissionPersistenceTransitionScore,
  buildControlledMissionPersistenceRollbackPlan,
  buildControlledMissionPersistenceDataConsistencyPolicy,
  buildControlledMissionPersistenceNoExecutionPolicy,
  buildControlledMissionPersistenceTransitionPlanQaChecklist,
  buildControlledMissionPersistenceTransitionPlanQaVerdict,
  CONTROLLED_MISSION_TRANSITION_MICROCOPY,
  CONTROLLED_MISSION_TRANSITION_NO_GET_POST,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-transition-plan-types.ts`);
const planSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-transition-plan.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-persistence-transition-plan-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-transition-plan-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_8_CONTROLLED_MISSION_PERSISTENCE_TRANSITION_PLAN.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_8_CONTROLLED_MISSION_PERSISTENCE_TRANSITION_PLAN_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-persistence-transition-plan-phase5-8.mjs");
const packageJson = readRootFile("package.json");

// purity blob (la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, planSrc, uiCopySrc].join("\n");

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

describe("PHASE 5.8 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. plan existe", () => expect(planSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("32. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("33. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("34. modules ne contiennent pas import lib/pierre", () => expect([typesSrc, planSrc, uiCopySrc, qaSrc].join("\n")).not.toContain("lib/pierre"));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Transition Plan
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.8 — Transition Plan", () => {
  const plan = buildControlledMissionPersistenceTransitionPlan();

  it("1. plan phase = 5.8", () => expect(plan.phase).toBe("5.8"));
  it("2. transition_active false", () => expect(plan.transition_active).toBe(false));
  it("3. sql_applied false", () => expect(plan.sql_applied).toBe(false));
  it("4. env_modified false", () => expect(plan.env_modified).toBe(false));
  it("5. route_created false", () => expect(plan.route_created).toBe(false));
  it("6. server_get_performed false", () => expect(plan.server_get_performed).toBe(false));
  it("7. server_post_performed false", () => expect(plan.server_post_performed).toBe(false));
  it("8. server_write_performed false", () => expect(plan.server_write_performed).toBe(false));
  it("9. server_restore_performed false", () => expect(plan.server_restore_performed).toBe(false));
  it("10. runtime_execution_performed false", () => expect(plan.runtime_execution_performed).toBe(false));
  it("11. real_mission_created false", () => expect(plan.real_mission_created).toBe(false));
  it("12. pierre_engine_called false", () => expect(plan.pierre_engine_called).toBe(false));
  it("13. ai_call_performed false", () => expect(plan.ai_call_performed).toBe(false));
  it("14. email_sent false", () => expect(plan.email_sent).toBe(false));
  it("15. document_generated false", () => expect(plan.document_generated).toBe(false));
  it("16. clonevoice_active false", () => expect(plan.clonevoice_active).toBe(false));
  it("17. current_source = localStorage", () => expect(plan.current_source).toBe("localStorage"));
  it("18. future_source = server_persistence", () => expect(plan.future_source).toBe("server_persistence"));

  it("19. phases T1→T8 présentes", () => {
    const ids = plan.phases.map((p) => p.id);
    for (const id of ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]) expect(ids).toContain(id);
    expect(plan.phases.length).toBe(8);
  });
  it("20. chaque phase activation_performed false", () => expect(plan.phases.every((p) => p.activation_performed === false)).toBe(true));
  it("21. chaque phase no_execution_confirmed true", () => expect(plan.phases.every((p) => p.no_execution_confirmed === true)).toBe(true));
  it("22. forbidden_actions non vides", () => expect(plan.phases.every((p) => p.forbidden_actions.length > 0)).toBe(true));

  it("23. rollback plan contient disable flag", () => {
    const rb = buildControlledMissionPersistenceRollbackPlan();
    expect(rb.steps.join(" ")).toContain("disable flag");
    expect(rb.runtime_never_triggered).toBe(true);
  });
  it("24. rollback plan contient localStorage-only", () => expect(buildControlledMissionPersistenceRollbackPlan().steps.join(" ")).toContain("localStorage-only"));

  it("25. data consistency policy contient idempotency", () => expect(buildControlledMissionPersistenceDataConsistencyPolicy().items.join(" ")).toContain("idempotency"));
  it("26. data consistency policy contient no silent overwrite", () => {
    const dc = buildControlledMissionPersistenceDataConsistencyPolicy();
    expect(dc.items.join(" ")).toContain("no silent overwrite");
    expect(dc.no_silent_overwrite).toBe(true);
    expect(dc.local_source_wins_until_server_activated).toBe(true);
  });

  it("27. no-execution policy : persistence ≠ execution", () => {
    const ne = buildControlledMissionPersistenceNoExecutionPolicy();
    expect(ne.items.join(" ")).toContain("persistence ≠ execution");
    expect(ne.persistence_is_not_execution).toBe(true);
  });
  it("28. no-execution policy : restore ≠ execution", () => expect(buildControlledMissionPersistenceNoExecutionPolicy().items.join(" ")).toContain("restore ≠ execution"));
  it("29. no-execution policy : sync ≠ execution", () => expect(buildControlledMissionPersistenceNoExecutionPolicy().items.join(" ")).toContain("sync ≠ execution"));

  it("30. score déterministe", () => {
    const a = computeControlledMissionPersistenceTransitionScore({ phases: buildControlledMissionPersistenceTransitionPhases() });
    const b = computeControlledMissionPersistenceTransitionScore({ phases: buildControlledMissionPersistenceTransitionPhases() });
    expect(a).toBe(b);
    expect(plan.readiness_score).toBe(a);
  });
  it("31. score entre 0 et 100", () => {
    expect(plan.readiness_score).toBeGreaterThanOrEqual(0);
    expect(plan.readiness_score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.8 — Routes, SQL, flag, UI, QA", () => {
  it("35. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("36. aucune route restore GET", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/restore/route.ts")).toBe(false));
  it("37. aucune route POST active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("38. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("39. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("40. flag default false", () => {
    expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false);
    expect(buildControlledMissionPersistenceTransitionPlan().flag_default).toBe(false);
  });
  it("41. UI : « Plan de transition design-only »", () => expect(CONTROLLED_MISSION_TRANSITION_MICROCOPY).toContain("Plan de transition design-only"));
  it("42. UI : « Aucune activation »", () => expect(CONTROLLED_MISSION_TRANSITION_MICROCOPY).toContain("Aucune activation"));
  it("43. UI : « Aucun GET/POST serveur »", () => expect(CONTROLLED_MISSION_TRANSITION_NO_GET_POST).toContain("Aucun GET/POST serveur"));
  it("44. page ne contient pas « Appliquer SQL »", () => expect(pageSrc).not.toContain("Appliquer SQL"));
  it("45. page ne contient pas « Activer flag »", () => expect(pageSrc).not.toContain("Activer flag"));
  it("46. page ne contient pas action « Exécuter la mission »", () => expect(pageSrc).not.toContain("Exécuter la mission"));
  it("46b. page câble le plan de transition (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_TRANSITION_MICROCOPY"));
  it("47. QA checklist ready", () => {
    const checklist = buildControlledMissionPersistenceTransitionPlanQaChecklist();
    expect(checklist.phase).toBe("5.8");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildControlledMissionPersistenceTransitionPlanQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.transition_plan_design_only).toBe(true);
  });
  it("E1. package test:phase5-8", () => expect(packageJson).toContain("test:phase5-8"));
  it("E2. package check transition plan", () => expect(packageJson).toContain("check:controlled-mission-persistence-transition-plan"));
  it("E3. doc mentionne PHASE 5.9", () => expect(docSrc).toContain("PHASE 5.9"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P5.7)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.8 — Cascade intacte", () => {
  it("54. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("53. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("52. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("51. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("50. P5.5 : manual activation QA ready", () => {
    expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready");
  });
  it("49. P5.6 : restore state design-only", () => {
    readyMissionId();
    const state = buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions());
    expect(state.server_get_performed).toBe(false);
    expect(state.eligible_local_rows).toBeGreaterThan(0);
  });
  it("48. P5.7 : final gate go_for_next_design_phase", () => {
    expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase");
  });
  const scripts = ["test:phase5-7", "test:phase5-6", "test:phase5-5", "test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
