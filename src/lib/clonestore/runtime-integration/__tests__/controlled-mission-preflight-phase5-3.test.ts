// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-preflight-phase5-3.test.ts
// PHASE 5.3 — Controlled Mission Local Execution Readiness Gate / Preflight — Tests

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  createLocalControlledMission,
  buildControlledMissionFromPromotionPreview,
  upsertLocalControlledMission,
  loadLocalControlledMissions,
  getLocalControlledMissionById,
  approveLocalControlledMission,
  startLocalControlledMissionReview,
  requestChangesForLocalControlledMission,
  blockLocalControlledMission,
  archiveReviewedLocalControlledMission,
  // P5.3
  runLocalControlledMissionPreflight,
  getControlledMissionPreflightState,
  buildControlledMissionPreflightChecks,
  computeControlledMissionReadinessScore,
  validateControlledMissionPreflightEligibility,
  buildControlledMissionPreflightQaChecklist,
  buildControlledMissionPreflightQaVerdict,
  CONTROLLED_MISSION_PREFLIGHT_MICROCOPY,
  CONTROLLED_MISSION_PREFLIGHT_WHAT_IT_DOES,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-preflight-types.ts`);
const preflightSrc = readSrc(`${RI_DIR}/controlled-mission-preflight.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-preflight-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-preflight-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const scriptSrc = readRootFile("scripts/check-controlled-mission-preflight-phase5-3.mjs");
const docSrc = readRootFile("docs/PHASE_5_3_CONTROLLED_MISSION_LOCAL_EXECUTION_READINESS_GATE.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_3_CONTROLLED_MISSION_PREFLIGHT_EVIDENCE.md");
const packageJson = readRootFile("package.json");

const KEY = "clonestore.runtimeControlledMissions.local.v1";

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
function currentLocalStorage(): LocalStorageMock {
  return (globalThis as unknown as { window: { localStorage: LocalStorageMock } }).window.localStorage;
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
function blockedDraft(): RuntimeMissionDraft {
  return { ...eligibleDraft(), kind: "blocked_draft", status: "blocked", blocked_reasons: ["Action finale juridique."] };
}
function unsupportedDraft(): RuntimeMissionDraft {
  return { ...eligibleDraft(), kind: "unsupported_domain_draft", employee_key: null, status: "simulated_only" };
}
const eligibleContract = () => buildRuntimeMissionPromotionContract(eligibleDraft());
const blockedContract = () => buildRuntimeMissionPromotionContract(blockedDraft());
const unsupportedContract = () => buildRuntimeMissionPromotionContract(unsupportedDraft());

function createMission(): string {
  return createLocalControlledMission(eligibleContract()).mission!.id;
}
function approvedMissionId(): string {
  const id = createMission();
  approveLocalControlledMission(id);
  return id;
}
function upsertBuilt(contract: ReturnType<typeof eligibleContract>): string {
  const m = buildControlledMissionFromPromotionPreview(contract);
  upsertLocalControlledMission(m);
  return m.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.3 — Présence & pureté", () => {
  it("1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. preflight existe", () => expect(preflightSrc.length).toBeGreaterThan(0));
  it("3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("5. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("6. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("7. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("8. preflight ne contient pas fetch", () => expect(preflightSrc).not.toContain("fetch"));
  it("9. preflight ne contient pas createClient", () => expect(preflightSrc).not.toContain("createClient"));
  it("10. preflight ne contient pas @supabase", () => expect(preflightSrc).not.toContain("@supabase"));
  it("11. preflight ne contient pas import lib/pierre", () => expect(preflightSrc).not.toContain("lib/pierre"));
  it("12. ui copy ne contient pas fetch", () => expect(uiCopySrc).not.toContain("fetch"));
  it("13. modules ne référencent pas /api/pierre", () => expect([typesSrc, preflightSrc, uiCopySrc].join("\n")).not.toContain("/api/pierre"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — UI, routes, index, package, doc
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.3 — UI, routes, index, package, doc", () => {
  it("14. ui copy : « Preflight local »", () => expect(uiCopySrc).toContain("Preflight local"));
  it("15. ui copy : « Aucune exécution »", () => expect(CONTROLLED_MISSION_PREFLIGHT_MICROCOPY).toContain("Aucune exécution"));
  it("16. ui copy : « future exécution gouvernée »", () => expect(CONTROLLED_MISSION_PREFLIGHT_WHAT_IT_DOES).toContain("future exécution gouvernée"));
  it("17. page câble runLocalControlledMissionPreflight", () => expect(pageSrc).toContain("runLocalControlledMissionPreflight"));
  it("18. page : action preflight (constante)", () => expect(pageSrc).toContain("CONTROLLED_MISSION_PREFLIGHT_RUN_LABEL"));
  it("19. page : pas d'action « Exécuter la mission »", () => expect(pageSrc).not.toContain("Exécuter la mission"));
  it("20. page : pas d'action « Lancer la mission »", () => expect(pageSrc).not.toContain("Lancer la mission"));
  it("21. aucune route preflight serveur", () => expect(hasFile("src/app/api/clonestore/runtime/preflight/route.ts")).toBe(false));
  it("22. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("23. index exporte runLocalControlledMissionPreflight", () => expect(indexSrc).toContain("runLocalControlledMissionPreflight"));
  it("24. index exporte buildControlledMissionPreflightQaChecklist", () => expect(indexSrc).toContain("buildControlledMissionPreflightQaChecklist"));
  it("25. package test:phase5-3", () => expect(packageJson).toContain("test:phase5-3"));
  it("26. package check:controlled-mission-preflight", () => expect(packageJson).toContain("check:controlled-mission-preflight"));
  it("27. script contient PASS", () => expect(scriptSrc).toContain("PASS"));
  it("28. doc mentionne future exécution gouvernée", () => expect(docSrc.toLowerCase()).toContain("future exécution gouvernée"));
  it("29. doc mentionne PHASE 5.4", () => expect(docSrc).toContain("PHASE 5.4"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.3 — Fonctionnels", () => {
  it("30. checks générés depuis mission approved_local", () => {
    const id = approvedMissionId();
    const checks = buildControlledMissionPreflightChecks(getLocalControlledMissionById(id)!);
    expect(checks.length).toBe(20);
    expect(checks.some((c) => c.id === "local_review_approved" && c.status === "pass")).toBe(true);
  });

  it("31. mission introuvable → erreur propre", () => {
    const r = runLocalControlledMissionPreflight("localcm_inexistante");
    expect(r.ok).toBe(false);
    expect(r.status).toBe("not_found");
  });

  it("32. mission archivée → preflight impossible", () => {
    const id = approvedMissionId();
    archiveReviewedLocalControlledMission(id);
    const r = runLocalControlledMissionPreflight(id);
    expect(r.ok).toBe(false);
    expect(r.status).toBe("not_allowed");
  });

  it("33. mission non reviewée → blocked_by_missing_review", () => {
    const id = createMission();
    const r = runLocalControlledMissionPreflight(id);
    expect(r.status).toBe("blocked_by_missing_review");
  });

  it("34. mission in_review → blocked_by_missing_review", () => {
    const id = createMission();
    startLocalControlledMissionReview(id);
    const r = runLocalControlledMissionPreflight(id);
    expect(r.status).toBe("blocked_by_missing_review");
  });

  it("35. changes_requested → blocked_by_manual_decision", () => {
    const id = createMission();
    requestChangesForLocalControlledMission(id, ["x"]);
    expect(runLocalControlledMissionPreflight(id).status).toBe("blocked_by_manual_decision");
  });

  it("36. blocked_local → blocked_by_manual_decision", () => {
    const id = createMission();
    blockLocalControlledMission(id, "raison");
    expect(runLocalControlledMissionPreflight(id).status).toBe("blocked_by_manual_decision");
  });

  it("37. approved_local → preflight possible (ready)", () => {
    const id = approvedMissionId();
    const r = runLocalControlledMissionPreflight(id);
    expect(r.ok).toBe(true);
    expect(r.status).toBe("ready_for_future_governed_execution");
  });

  it("38. blocked_by_guard → blocked_by_guard", () => {
    const id = upsertBuilt(blockedContract());
    expect(runLocalControlledMissionPreflight(id).status).toBe("blocked_by_guard");
  });

  it("39. missing information → blocked_by_missing_information", () => {
    const id = upsertBuilt(unsupportedContract());
    expect(runLocalControlledMissionPreflight(id).status).toBe("blocked_by_missing_information");
  });

  it("40. score déterministe", () => {
    const id = approvedMissionId();
    const s1 = runLocalControlledMissionPreflight(id).preflight_state!.readiness_score;
    const s2 = runLocalControlledMissionPreflight(id).preflight_state!.readiness_score;
    expect(s1).toBe(s2);
    const direct = computeControlledMissionReadinessScore(buildControlledMissionPreflightChecks(getLocalControlledMissionById(id)!));
    expect(s1).toBe(direct);
  });

  it("41. ready_for_future_governed_execution si checks bloquants OK", () => {
    const id = approvedMissionId();
    const r = runLocalControlledMissionPreflight(id);
    expect(r.preflight_state!.preflight_status).toBe("ready_for_future_governed_execution");
    expect(r.preflight_state!.readiness_level).toBe("future_execution_candidate");
  });

  it("42. ready ne déclenche jamais runtime_execution / server_persistence", () => {
    const id = approvedMissionId();
    runLocalControlledMissionPreflight(id);
    const m = getLocalControlledMissionById(id)!;
    expect(m.runtime_execution).toBe("disabled");
    expect(m.server_persistence).toBe("disabled");
    expect(m.preflight_state!.runtime_execution_after_preflight).toBe("disabled");
    expect(m.preflight_state!.server_persistence_after_preflight).toBe("disabled");
  });

  it("43. ready ne crée aucune mission réelle / Pierre / IA / email / document", () => {
    const id = approvedMissionId();
    const r = runLocalControlledMissionPreflight(id);
    expect(r.real_mission_created).toBe(false);
    expect(r.pierre_engine_called).toBe(false);
    expect(r.ai_call_performed).toBe(false);
    expect(r.email_sent).toBe(false);
    expect(r.document_generated).toBe(false);
    expect(r.runtime_execution_performed).toBe(false);
    expect(getLocalControlledMissionById(id)!.real_mission_created).toBe(false);
  });

  it("44. double preflight idempotent (pas de duplication)", () => {
    const id = approvedMissionId();
    runLocalControlledMissionPreflight(id);
    runLocalControlledMissionPreflight(id);
    expect(loadLocalControlledMissions().length).toBe(1);
  });

  it("45. localStorage vide", () => {
    expect(loadLocalControlledMissions()).toEqual([]);
  });

  it("46. localStorage corrompu → fallback sûr", () => {
    currentLocalStorage().setItem(KEY, "{{ not json");
    expect(loadLocalControlledMissions()).toEqual([]);
  });

  it("47. localStorage indisponible → échec propre", () => {
    const id = approvedMissionId();
    const raw = currentLocalStorage().getItem(KEY);
    setWindow({ getItem: (k: string) => (k === KEY ? raw : null), setItem: () => { throw new Error("quota"); }, removeItem: () => {} });
    const r = runLocalControlledMissionPreflight(id);
    expect(r.status).toBe("local_save_failed");
    expect(r.runtime_execution_performed).toBe(false);
  });

  it("48. preflight_state stocké dans la mission", () => {
    const id = approvedMissionId();
    runLocalControlledMissionPreflight(id);
    expect(getLocalControlledMissionById(id)!.preflight_state).toBeDefined();
  });

  it("49. checks ont local_only true / execution_enabled false", () => {
    const id = approvedMissionId();
    const checks = getControlledMissionPreflightState(getLocalControlledMissionById(id)!).checks;
    expect(checks.every((c) => c.local_only === true && c.execution_enabled === false)).toBe(true);
  });

  it("50. eligibility : not_reviewed bloquée puis approved éligible", () => {
    // Même id déterministe (localcm_${promotion_id}) → on transite la même mission.
    const id = createMission();
    expect(validateControlledMissionPreflightEligibility(getLocalControlledMissionById(id)!).blocked_status).toBe("blocked_by_missing_review");
    approveLocalControlledMission(id);
    expect(validateControlledMissionPreflightEligibility(getLocalControlledMissionById(id)!).eligible).toBe(true);
  });

  it("51. QA snapshot PASS (ready quand tout pending)", () => {
    const checklist = buildControlledMissionPreflightQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(20);
    expect(checklist.phase).toBe("5.3");
    const summary = buildControlledMissionPreflightQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.preflight_local_only).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.3 — Cascade intacte", () => {
  const scripts = ["test:phase5-2", "test:phase5-1", "test:phase4-12", "test:phase4-1", "test:phase2-9", "test:tech11", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
