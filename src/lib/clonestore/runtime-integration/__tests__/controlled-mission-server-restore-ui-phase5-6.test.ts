// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-server-restore-ui-phase5-6.test.ts
// PHASE 5.6 — Controlled Mission Server Restore UI Polish — Tests

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
  // P5.4 / P5.5 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceApiContract,
  buildControlledMissionServerPersistenceManualActivationQa,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P5.6
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerRestoreDisplayCards,
  buildControlledMissionServerRestoreTimelinePreview,
  buildControlledMissionServerRestoreWarnings,
  buildControlledMissionServerRestoreRequiredNextSteps,
  summarizeControlledMissionServerRestoreDesignState,
  buildControlledMissionServerRestoreQaChecklist,
  buildControlledMissionServerRestoreQaVerdict,
  CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY,
  CONTROLLED_MISSION_SERVER_RESTORE_NO_GET,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-server-restore-types.ts`);
const designSrc = readSrc(`${RI_DIR}/controlled-mission-server-restore-design.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-server-restore-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-server-restore-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_6_CONTROLLED_MISSION_SERVER_RESTORE_UI_POLISH.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_6_CONTROLLED_MISSION_SERVER_RESTORE_UI_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-server-restore-ui-phase5-6.mjs");
const packageJson = readRootFile("package.json");

// purity blob (la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, designSrc, uiCopySrc].join("\n");

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

describe("PHASE 5.6 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. design existe", () => expect(designSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P7. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("23. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("24. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  it("25. modules ne contiennent pas import lib/pierre", () => expect([typesSrc, designSrc, uiCopySrc, qaSrc].join("\n")).not.toContain("lib/pierre"));
  it("P8. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — État restore
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.6 — État restore", () => {
  const emptyState = buildControlledMissionServerRestoreDesignState([]);

  it("1. state construit depuis localMissions vide", () => {
    expect(emptyState.phase).toBe("5.6");
    expect(emptyState.local_rows_available).toBe(0);
    expect(emptyState.eligible_local_rows).toBe(0);
  });
  it("2. restored_count 0", () => expect(emptyState.restored_count).toBe(0));
  it("3. server_rows_loaded 0", () => expect(emptyState.server_rows_loaded).toBe(0));
  it("4. server_restore_available false", () => expect(emptyState.server_restore_available).toBe(false));
  it("5. server_get_performed false", () => expect(emptyState.server_get_performed).toBe(false));
  it("6. db_read_performed false", () => expect(emptyState.db_read_performed).toBe(false));
  it("7. server_write_performed false", () => expect(emptyState.server_write_performed).toBe(false));
  it("8. runtime_execution_performed false", () => expect(emptyState.runtime_execution_performed).toBe(false));
  it("9. real_mission_created false", () => expect(emptyState.real_mission_created).toBe(false));
  it("10. pierre_engine_called false", () => expect(emptyState.pierre_engine_called).toBe(false));
  it("11. ai_call_performed false", () => expect(emptyState.ai_call_performed).toBe(false));
  it("12. email_sent false", () => expect(emptyState.email_sent).toBe(false));
  it("13. document_generated false", () => expect(emptyState.document_generated).toBe(false));
  it("14. clonevoice_active false", () => expect(emptyState.clonevoice_active).toBe(false));

  it("15. localMissions ready → eligible_local_rows > 0", () => {
    const id = readyMissionId();
    const missions = loadLocalControlledMissions();
    const state = buildControlledMissionServerRestoreDesignState(missions);
    expect(getLocalControlledMissionById(id)).not.toBeNull();
    expect(state.local_rows_available).toBe(1);
    expect(state.eligible_local_rows).toBeGreaterThan(0);
  });

  it("16. action_enabled false sur toutes les cards", () => {
    const cards = buildControlledMissionServerRestoreDisplayCards(emptyState);
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.action_enabled === false && c.local_only === true)).toBe(true);
  });
  it("17. display cards contiennent « Serveur désactivé »", () => {
    const cards = buildControlledMissionServerRestoreDisplayCards(emptyState);
    expect(JSON.stringify(cards)).toContain("Serveur désactivé");
  });

  it("18. timeline contient « SQL manual review »", () => {
    const tl = buildControlledMissionServerRestoreTimelinePreview(emptyState);
    expect(tl.some((t) => t.label === "SQL manual review")).toBe(true);
    expect(tl.every((t) => t.server_action_performed === false && t.local_only === true)).toBe(true);
  });
  it("19. timeline contient « Route GET future »", () => {
    expect(buildControlledMissionServerRestoreTimelinePreview(emptyState).some((t) => t.label === "Route GET future")).toBe(true);
  });
  it("20. timeline contient « Still no execution »", () => {
    expect(buildControlledMissionServerRestoreTimelinePreview(emptyState).some((t) => t.label === "Still no execution")).toBe(true);
  });

  it("21. warnings contiennent la source localStorage", () => {
    expect(buildControlledMissionServerRestoreWarnings(emptyState).some((w) => w.includes("localStorage"))).toBe(true);
  });
  it("22. required next steps contiennent « phase future »", () => {
    expect(buildControlledMissionServerRestoreRequiredNextSteps(emptyState).join(" ")).toContain("phase future");
  });
  it("36b. summarize : restauration serveur non active", () => {
    expect(summarizeControlledMissionServerRestoreDesignState(emptyState)).toContain("Restauration serveur non active");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.6 — Routes, SQL, flag, UI, QA", () => {
  it("26. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("27. aucune route restore GET", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/restore/route.ts")).toBe(false));
  it("28. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("29. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("30. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("31. UI : « Restauration serveur non active »", () => expect(CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY).toContain("Restauration serveur non active"));
  it("32. UI : « Aucun GET serveur »", () => expect(CONTROLLED_MISSION_SERVER_RESTORE_NO_GET).toContain("Aucun GET serveur"));
  it("33. UI : « Local uniquement »", () => expect(CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY).toContain("Local uniquement"));
  it("34. page ne contient pas « Restaurer depuis serveur »", () => expect(pageSrc).not.toContain("Restaurer depuis serveur"));
  it("34b. page câble l'état restore (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY"));
  it("35. QA checklist ready", () => {
    const checklist = buildControlledMissionServerRestoreQaChecklist();
    expect(checklist.phase).toBe("5.6");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildControlledMissionServerRestoreQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.server_restore_design_only).toBe(true);
  });
  it("E1. package test:phase5-6", () => expect(packageJson).toContain("test:phase5-6"));
  it("E2. package check:controlled-mission-server-restore-ui", () => expect(packageJson).toContain("check:controlled-mission-server-restore-ui"));
  it("E3. doc mentionne PHASE 5.7", () => expect(docSrc).toContain("PHASE 5.7"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P5.5)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.6 — Cascade intacte", () => {
  it("40. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("39. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("38. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("37. P5.4 : server draft ready + API contract design-only", () => {
    const id = readyMissionId();
    const draft = buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!);
    expect(draft.server_persistence_status).toBe("ready_for_future_server_persistence");
    expect(buildControlledMissionServerPersistenceApiContract().current_phase_status).toBe("disabled_design_only");
  });
  it("36. P5.5 : manual activation QA ready", () => {
    expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready");
  });
  const scripts = ["test:phase5-5", "test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
