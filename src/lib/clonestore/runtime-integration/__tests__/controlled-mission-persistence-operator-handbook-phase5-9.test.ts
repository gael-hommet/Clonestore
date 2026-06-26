// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-persistence-operator-handbook-phase5-9.test.ts
// PHASE 5.9 — Controlled Mission Persistence Documentation & Operator Handbook — Tests

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
  // P5.4 → P5.8 (intact)
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionPersistenceTransitionPlan,
  DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED,
  // P5.9
  buildControlledMissionPersistenceOperatorHandbook,
  buildControlledMissionPersistenceOperatorWorkflows,
  buildControlledMissionPersistenceVerificationPlaybooks,
  buildControlledMissionPersistenceIncidentPlaybooks,
  buildControlledMissionPersistenceRollbackPlaybook,
  buildControlledMissionPersistenceEvidenceChecklist,
  buildControlledMissionPersistenceCommandReference,
  buildControlledMissionPersistenceDecisionMatrix,
  buildControlledMissionPersistenceOperatorGlossary,
  buildControlledMissionPersistenceOperatorHandbookQaChecklist,
  buildControlledMissionPersistenceOperatorHandbookQaVerdict,
  CONTROLLED_MISSION_HANDBOOK_MICROCOPY,
  CONTROLLED_MISSION_HANDBOOK_NO_GET_POST,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-operator-handbook-types.ts`);
const handbookSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-operator-handbook.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-persistence-operator-handbook-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-persistence-operator-handbook-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_9_CONTROLLED_MISSION_PERSISTENCE_OPERATOR_HANDBOOK.md");
const operatorDocSrc = readRootFile("docs/operator/CONTROLLED_MISSION_PERSISTENCE_OPERATOR_HANDBOOK.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_9_CONTROLLED_MISSION_PERSISTENCE_OPERATOR_HANDBOOK_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-persistence-operator-handbook-phase5-9.mjs");
const packageJson = readRootFile("package.json");

// purity blob (la QA énumère les noms de checks → exclue du scan mot-à-mot)
const scanBlob = [typesSrc, handbookSrc, uiCopySrc].join("\n");

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

describe("PHASE 5.9 — Présence & pureté", () => {
  it("P1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("P2. handbook existe", () => expect(handbookSrc.length).toBeGreaterThan(0));
  it("P3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("P4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("P5. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("P6. operator handbook doc existe", () => expect(operatorDocSrc.length).toBeGreaterThan(0));
  it("P7. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("P8. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("43. modules ne contiennent pas fetch", () => expect(scanBlob).not.toContain("fetch"));
  it("44. modules ne contiennent pas createClient/@supabase", () => {
    expect(scanBlob).not.toContain("createClient");
    expect(scanBlob).not.toContain("@supabase");
  });
  // Le handbook documente « src/lib/pierre intact » (mention, pas import) → on vérifie l'absence d'IMPORT.
  it("45. modules ne contiennent pas import du moteur Pierre", () => expect([typesSrc, handbookSrc, uiCopySrc, qaSrc].join("\n")).not.toContain('from "@/lib/pierre'));
  it("P9. modules ne contiennent pas /api/ littéral", () => expect(scanBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Handbook content
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.9 — Handbook", () => {
  const hb = buildControlledMissionPersistenceOperatorHandbook();

  it("1. handbook phase = 5.9", () => expect(hb.phase).toBe("5.9"));
  it("2. documentation_ready true", () => expect(hb.documentation_ready).toBe(true));
  it("3. activation_performed false", () => expect(hb.activation_performed).toBe(false));
  it("4. server_persistence_active false", () => expect(hb.server_persistence_active).toBe(false));
  it("5. server_restore_active false", () => expect(hb.server_restore_active).toBe(false));
  it("6. runtime_execution_active false", () => expect(hb.runtime_execution_active).toBe(false));
  it("7. pierre_runtime_active false", () => expect(hb.pierre_runtime_active).toBe(false));
  it("8. sql_applied false", () => expect(hb.sql_applied).toBe(false));
  it("9. env_modified false", () => expect(hb.env_modified).toBe(false));
  it("10. route_created false", () => expect(hb.route_created).toBe(false));
  it("11. server_get_performed false", () => expect(hb.server_get_performed).toBe(false));
  it("12. server_post_performed false", () => expect(hb.server_post_performed).toBe(false));
  it("13. server_write_performed false", () => expect(hb.server_write_performed).toBe(false));
  it("14. server_restore_performed false", () => expect(hb.server_restore_performed).toBe(false));
  it("15. real_mission_created false", () => expect(hb.real_mission_created).toBe(false));
  it("16. ai_call_performed false", () => expect(hb.ai_call_performed).toBe(false));
  it("17. email_sent false", () => expect(hb.email_sent).toBe(false));
  it("18. document_generated false", () => expect(hb.document_generated).toBe(false));
  it("19. clonevoice_active false", () => expect(hb.clonevoice_active).toBe(false));

  it("20. current state summary : localStorage source active", () => expect(hb.current_state_summary.join(" ")).toContain("localStorage source active"));
  it("21. active capabilities : créer Controlled Mission locale", () => expect(hb.active_capabilities.some((c) => c.includes("Controlled Mission locale"))).toBe(true));
  it("22. inactive capabilities : server persistence", () => expect(hb.inactive_capabilities.join(" ")).toContain("server persistence"));

  it("23. glossary : persistence ≠ execution", () => expect(buildControlledMissionPersistenceOperatorGlossary().some((g) => g.term === "persistence ≠ execution")).toBe(true));
  it("24. glossary : restore ≠ execution", () => expect(buildControlledMissionPersistenceOperatorGlossary().some((g) => g.term === "restore ≠ execution")).toBe(true));
  it("25. glossary : sync ≠ execution", () => expect(buildControlledMissionPersistenceOperatorGlossary().some((g) => g.term === "sync ≠ execution")).toBe(true));
  it("26. glossary : RLS", () => expect(buildControlledMissionPersistenceOperatorGlossary().some((g) => g.term === "RLS")).toBe(true));

  it("27. workflows W1 → W10 présents", () => {
    const ids = buildControlledMissionPersistenceOperatorWorkflows().map((w) => w.id);
    for (const id of ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10"]) expect(ids).toContain(id);
    expect(buildControlledMissionPersistenceOperatorWorkflows().length).toBe(10);
  });
  it("28. chaque workflow no_execution_confirmed true", () => expect(buildControlledMissionPersistenceOperatorWorkflows().every((w) => w.no_execution_confirmed === true)).toBe(true));
  it("29. chaque workflow forbidden_actions non vide", () => expect(buildControlledMissionPersistenceOperatorWorkflows().every((w) => w.forbidden_actions.length > 0)).toBe(true));

  it("30. verification playbooks : no route", () => expect(JSON.stringify(buildControlledMissionPersistenceVerificationPlaybooks())).toContain("route serveur"));
  it("31. verification playbooks : no GET/POST", () => expect(JSON.stringify(buildControlledMissionPersistenceVerificationPlaybooks())).toContain("GET/POST"));
  it("32. verification playbooks : no execution", () => expect(JSON.stringify(buildControlledMissionPersistenceVerificationPlaybooks())).toContain("exécution"));

  it("33. incident playbooks : SQL appliqué", () => expect(JSON.stringify(buildControlledMissionPersistenceIncidentPlaybooks())).toContain("SQL appliqué"));
  it("34. incident playbooks : flag serveur activé", () => expect(JSON.stringify(buildControlledMissionPersistenceIncidentPlaybooks())).toContain("flag serveur activé"));

  it("35. rollback playbook : disable flag", () => {
    const rb = buildControlledMissionPersistenceRollbackPlaybook();
    expect(rb.rollback_steps.join(" ")).toContain("disable flag");
    expect(rb.no_execution_confirmed).toBe(true);
  });
  it("36. rollback playbook : localStorage-only", () => expect(buildControlledMissionPersistenceRollbackPlaybook().rollback_steps.join(" ")).toContain("localStorage-only"));

  it("37. evidence checklist : SQL DO NOT APPLY", () => expect(JSON.stringify(buildControlledMissionPersistenceEvidenceChecklist())).toContain("DO NOT APPLY"));
  it("38. evidence checklist : flag false", () => expect(JSON.stringify(buildControlledMissionPersistenceEvidenceChecklist())).toContain("flag false"));

  it("39. command reference : test:phase5-9", () => expect(buildControlledMissionPersistenceCommandReference().some((c) => c.command === "npm run test:phase5-9")).toBe(true));
  it("40. command reference : check handbook", () => expect(buildControlledMissionPersistenceCommandReference().some((c) => c.command.includes("check:controlled-mission-persistence-operator-handbook"))).toBe(true));

  it("41. decision matrix : preflight ready → forbidden execute", () => expect(buildControlledMissionPersistenceDecisionMatrix().some((d) => d.situation.includes("Preflight ready") && d.forbidden_decision === "execute")).toBe(true));
  it("42. decision matrix : final gate go → forbidden production launch", () => expect(buildControlledMissionPersistenceDecisionMatrix().some((d) => d.situation.includes("Final gate") && d.forbidden_decision.includes("production launch"))).toBe(true));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Routes, SQL, flag, UI, QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.9 — Routes, SQL, flag, UI, QA", () => {
  it("46. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("47. aucune route restore GET", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/restore/route.ts")).toBe(false));
  it("48. aucune route POST active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("49. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("50. SQL P5.4 contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("51. flag default false", () => expect(DEFAULT_CONTROLLED_MISSION_SERVER_PERSISTENCE_ENABLED).toBe(false));
  it("52. UI : « Handbook opérateur design-only »", () => expect(CONTROLLED_MISSION_HANDBOOK_MICROCOPY).toContain("Handbook opérateur design-only"));
  it("53. UI : « Aucune activation »", () => expect(CONTROLLED_MISSION_HANDBOOK_MICROCOPY).toContain("Aucune activation"));
  it("54. UI : « Aucun GET/POST serveur »", () => expect(CONTROLLED_MISSION_HANDBOOK_NO_GET_POST).toContain("Aucun GET/POST serveur"));
  it("55. page ne contient pas « Appliquer SQL »", () => expect(pageSrc).not.toContain("Appliquer SQL"));
  it("56. page ne contient pas « Activer flag »", () => expect(pageSrc).not.toContain("Activer flag"));
  it("57. page ne contient pas action « Exécuter la mission »", () => expect(pageSrc).not.toContain("Exécuter la mission"));
  it("57b. page câble le handbook (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_HANDBOOK_MICROCOPY"));
  it("58. QA checklist ready", () => {
    const checklist = buildControlledMissionPersistenceOperatorHandbookQaChecklist();
    expect(checklist.phase).toBe("5.9");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildControlledMissionPersistenceOperatorHandbookQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.operator_handbook_design_only).toBe(true);
  });
  it("E1. package test:phase5-9", () => expect(packageJson).toContain("test:phase5-9"));
  it("E2. package check handbook", () => expect(packageJson).toContain("check:controlled-mission-persistence-operator-handbook"));
  it("E3. doc mentionne PHASE 5.10", () => expect(docSrc).toContain("PHASE 5.10"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 → P5.8)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.9 — Cascade intacte", () => {
  it("66. P5.1 : create local controlled mission", () => {
    expect(createLocalControlledMission(eligibleContract()).ok).toBe(true);
  });
  it("65. P5.2 : approbation locale", () => {
    const id = createMission();
    expect(approveLocalControlledMission(id).review_state?.review_status).toBe("approved_local");
  });
  it("64. P5.3 : preflight ready", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  it("63. P5.4 : server draft ready", () => {
    const id = readyMissionId();
    expect(buildGovernedControlledMissionServerDraft(getLocalControlledMissionById(id)!).server_persistence_status).toBe("ready_for_future_server_persistence");
  });
  it("62. P5.5 : manual activation QA ready", () => {
    expect(buildControlledMissionServerPersistenceManualActivationQa().overall_verdict).toBe("ready");
  });
  it("61. P5.6 : restore state design-only", () => {
    readyMissionId();
    expect(buildControlledMissionServerRestoreDesignState(loadLocalControlledMissions()).server_get_performed).toBe(false);
  });
  it("60. P5.7 : final gate go_for_next_design_phase", () => {
    expect(buildControlledMissionServerPersistenceFinalGateReport().overall_verdict).toBe("go_for_next_design_phase");
  });
  it("59. P5.8 : transition plan ready_for_future_manual_sql_apply", () => {
    expect(buildControlledMissionPersistenceTransitionPlan().transition_status).toBe("ready_for_future_manual_sql_apply");
  });
  const scripts = ["test:phase5-8", "test:phase5-7", "test:phase5-6", "test:phase5-5", "test:phase5-4", "test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
