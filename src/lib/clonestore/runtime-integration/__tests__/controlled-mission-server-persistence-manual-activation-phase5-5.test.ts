// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-server-persistence-manual-activation-phase5-5.test.ts
// PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA — Tests

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  createLocalControlledMission,
  getLocalControlledMissionById,
  approveLocalControlledMission,
  runLocalControlledMissionPreflight,
  // P5.4 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceApiContract,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P5.5
  buildControlledMissionServerPersistenceManualActivationChecklist,
  buildControlledMissionServerPersistenceManualActivationQa,
  evaluateControlledMissionServerPersistenceManualActivationQa,
  summarizeControlledMissionServerPersistenceManualActivationQa,
  getControlledMissionServerPersistenceManualActivationBlockingSteps,
  buildControlledMissionServerPersistenceManualActivationRunbook,
  buildControlledMissionServerPersistenceManualActivationEvidenceTemplate,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-manual-activation-types.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-manual-activation-qa.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-manual-activation-ui-copy.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_QA.md");
const runbookSrc = readRootFile("docs/runbooks/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_RUNBOOK.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_5_CONTROLLED_MISSION_SERVER_PERSISTENCE_MANUAL_ACTIVATION_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-server-persistence-manual-activation-phase5-5.mjs");
const packageJson = readRootFile("package.json");

// purity blob (types + ui-copy ; la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, uiCopySrc].join("\n");

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
function approvedReadyMissionId(): string {
  const id = createMission();
  approveLocalControlledMission(id);
  runLocalControlledMissionPreflight(id);
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.5 — Présence & pureté", () => {
  it("1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("4. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("5. runbook existe", () => expect(runbookSrc.length).toBeGreaterThan(0));
  it("6. evidence template existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("8. SQL P5.4 existe", () => expect(sqlFileSrc.length).toBeGreaterThan(0));
  it("9. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("10. modules ne contiennent pas createClient", () => expect(scanBlob).not.toContain("createClient"));
  it("11. modules ne contiennent pas @supabase", () => expect(scanBlob).not.toContain("@supabase"));
  it("12. modules ne contiennent pas import lib/pierre", () => expect([typesSrc, qaSrc, uiCopySrc].join("\n")).not.toContain("lib/pierre"));
  it("13. modules ne contiennent pas /api/ littéral", () => expect([typesSrc, qaSrc, uiCopySrc].join("\n")).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Checklist & QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.5 — Checklist & QA", () => {
  const checklist = buildControlledMissionServerPersistenceManualActivationChecklist();
  const qa = buildControlledMissionServerPersistenceManualActivationQa();

  it("14. checklist ≥ 30 étapes", () => expect(checklist.length).toBeGreaterThanOrEqual(30));
  it("15. catégories A/B/C/D/E/F présentes", () => {
    const cats = new Set(checklist.map((c) => c.category));
    for (const cat of ["design_p54", "sql_manual_review", "feature_flag", "routes", "no_execution_invariants", "manual_evidence"]) {
      expect(cats.has(cat as never)).toBe(true);
    }
  });
  it("16. steps manual_only true", () => expect(checklist.every((c) => c.manual_only === true)).toBe(true));
  it("17. steps execution_enabled false", () => expect(checklist.every((c) => c.execution_enabled === false)).toBe(true));

  it("18. activation_not_performed true", () => expect(qa.activation_not_performed).toBe(true));
  it("19. sql_applied false", () => expect(qa.sql_applied).toBe(false));
  it("20. env_modified false", () => expect(qa.env_modified).toBe(false));
  it("21. route_created false", () => expect(qa.route_created).toBe(false));
  it("22. server_write_performed false", () => expect(qa.server_write_performed).toBe(false));
  it("23. runtime_execution_performed false", () => expect(qa.runtime_execution_performed).toBe(false));
  it("24. real_mission_created false", () => expect(qa.real_mission_created).toBe(false));
  it("25. pierre_engine_called false", () => expect(qa.pierre_engine_called).toBe(false));
  it("26. ai_call_performed false", () => expect(qa.ai_call_performed).toBe(false));
  it("27. email_sent false", () => expect(qa.email_sent).toBe(false));
  it("28. document_generated false", () => expect(qa.document_generated).toBe(false));
  it("29. clonevoice_active false", () => expect(qa.clonevoice_active).toBe(false));
  it("30. feature_flag_default false", () => {
    expect(qa.feature_flag_default).toBe(false);
    expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false);
  });

  it("31. verdict ready (toutes les étapes pending)", () => {
    const ev = evaluateControlledMissionServerPersistenceManualActivationQa(checklist);
    expect(ev.verdict).toBe("ready");
    expect(ev.activation_not_performed).toBe(true);
    expect(qa.overall_verdict).toBe("ready");
  });
  it("32. summarize : QA manuelle uniquement", () => {
    const ev = evaluateControlledMissionServerPersistenceManualActivationQa(checklist);
    expect(summarizeControlledMissionServerPersistenceManualActivationQa(ev)).toContain("QA manuelle uniquement");
  });
  it("33. blocking steps disponibles", () => expect(getControlledMissionServerPersistenceManualActivationBlockingSteps().length).toBeGreaterThan(0));
  it("34. runbook : sections + rappels do-not-apply", () => {
    const rb = buildControlledMissionServerPersistenceManualActivationRunbook();
    expect(rb.sections.length).toBeGreaterThanOrEqual(3);
    expect(rb.do_not_apply_reminders.join(" ")).toContain("Ne pas appliquer le SQL");
    expect(rb.activation_not_performed).toBe(true);
  });
  it("35. evidence template : sections présentes", () => {
    const ev = buildControlledMissionServerPersistenceManualActivationEvidenceTemplate();
    expect(ev.sections.length).toBeGreaterThanOrEqual(3);
    expect(ev.phase).toBe("5.5");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — SQL, routes, flag, UI, package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.5 — SQL, routes, flag, UI", () => {
  it("36. SQL contient DESIGN DRAFT ONLY", () => expect(sqlFileSrc).toContain("DESIGN DRAFT ONLY"));
  it("37. SQL contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("38. SQL contient STILL NO EXECUTION", () => expect(sqlFileSrc).toContain("STILL NO EXECUTION"));
  it("39. SQL contient SERVER PERSISTENCE FLAG MUST REMAIN OFF", () => expect(sqlFileSrc).toContain("SERVER PERSISTENCE FLAG MUST REMAIN OFF"));
  it("40. API contract disabled_design_only", () => expect(buildControlledMissionServerPersistenceApiContract().current_phase_status).toBe("disabled_design_only"));
  it("41. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("42. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("43. UI : « QA manuelle uniquement »", () => expect(CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY).toContain("QA manuelle uniquement"));
  it("44. UI : « Aucune activation »", () => expect(CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY).toContain("Aucune activation"));
  it("45. page câble la QA manuelle (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY"));
  it("46. page ne contient pas « Appliquer SQL »", () => expect(pageSrc).not.toContain("Appliquer SQL"));
  it("47. page ne contient pas « Activer flag »", () => expect(pageSrc).not.toContain("Activer flag"));
  it("48. package test:phase5-5", () => expect(packageJson).toContain("test:phase5-5"));
  it("49. package check:controlled-mission-server-persistence-manual-activation", () => expect(packageJson).toContain("check:controlled-mission-server-persistence-manual-activation"));
  it("50. doc mentionne PHASE 5.6", () => expect(docSrc).toContain("PHASE 5.6"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 / P5.2 / P5.3 / P5.4)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.5 — Cascade intacte", () => {
  it("51. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("52. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("53. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("54. P5.4 : server draft ready", () => {
    const id = approvedReadyMissionId();
    const draft = buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!);
    expect(draft.server_persistence_status).toBe("ready_for_future_server_persistence");
    expect(draft.execution_enabled).toBe(false);
  });
  const scripts = ["test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
