// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-server-persistence-phase5-4.test.ts
// PHASE 5.4 — Controlled Mission Governed Server Persistence Draft — Tests

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
  getLocalControlledMissionById,
  approveLocalControlledMission,
  requestChangesForLocalControlledMission,
  runLocalControlledMissionPreflight,
  // P5.4
  buildGovernedControlledMissionServerDraft,
  validateGovernedControlledMissionServerDraftEligibility,
  buildControlledMissionServerPersistenceReadiness,
  buildControlledMissionServerPersistencePolicySnapshot,
  buildControlledMissionServerPersistenceTraceSnapshot,
  buildControlledMissionServerPersistenceSqlDraft,
  buildControlledMissionServerPersistenceRlsPolicyDraft,
  buildControlledMissionServerPersistenceFeatureFlagContract,
  buildControlledMissionServerPersistenceFlagSnapshot,
  isControlledMissionServerPersistenceEnabledFromEnv,
  getControlledMissionServerPersistenceFlagDefault,
  buildControlledMissionServerPersistenceApiContract,
  summarizeControlledMissionServerPersistenceDraft,
  buildControlledMissionServerPersistenceQaChecklist,
  buildControlledMissionServerPersistenceQaVerdict,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-types.ts`);
const contractSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-contract.ts`);
const sqlDraftSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-sql-draft.ts`);
const policySrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-policy.ts`);
const apiContractSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-api-contract.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-server-persistence-qa.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const sqlFileSrc = readRootFile("supabase/sql/PHASE_5_4_CONTROLLED_MISSIONS_SERVER_PERSISTENCE_DRAFT.sql");
const docSrc = readRootFile("docs/PHASE_5_4_CONTROLLED_MISSION_GOVERNED_SERVER_PERSISTENCE_DRAFT.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_4_CONTROLLED_MISSION_SERVER_PERSISTENCE_EVIDENCE.md");
const scriptSrc = readRootFile("scripts/check-controlled-mission-server-persistence-phase5-4.mjs");
const packageJson = readRootFile("package.json");

// purity blobs — la QA module énumère légitimement les noms de checks
// (« no_fetch_in_modules », « no_supabase_import »…) → exclue du scan mot-à-mot.
const pureBlob = [typesSrc, contractSrc, sqlDraftSrc, policySrc, uiCopySrc].join("\n");
const allCodeBlob = [pureBlob, apiContractSrc].join("\n");

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
function blockedDraft(): RuntimeMissionDraft {
  return { ...eligibleDraft(), kind: "blocked_draft", status: "blocked", blocked_reasons: ["Action finale juridique."] };
}
const eligibleContract = () => buildRuntimeMissionPromotionContract(eligibleDraft());
const blockedContract = () => buildRuntimeMissionPromotionContract(blockedDraft());

function createMission(): string {
  return createLocalControlledMission(eligibleContract()).mission!.id;
}
function approvedMissionId(): string {
  const id = createMission();
  approveLocalControlledMission(id);
  return id;
}
function approvedReadyMissionId(): string {
  const id = approvedMissionId();
  runLocalControlledMissionPreflight(id);
  return id;
}
function missionById(id: string) {
  return getLocalControlledMissionById(id)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.4 — Présence & pureté", () => {
  it("1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. contract existe", () => expect(contractSrc.length).toBeGreaterThan(0));
  it("3. sql draft existe", () => expect(sqlDraftSrc.length).toBeGreaterThan(0));
  it("4. policy existe", () => expect(policySrc.length).toBeGreaterThan(0));
  it("5. api contract existe", () => expect(apiContractSrc.length).toBeGreaterThan(0));
  it("6. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("7. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("8. SQL file existe", () => expect(sqlFileSrc.length).toBeGreaterThan(0));
  it("9. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("10. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("11. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("12. modules ne contiennent pas fetch", () => expect(allCodeBlob).not.toContain("fetch"));
  it("13. modules ne contiennent pas createClient", () => expect(allCodeBlob).not.toContain("createClient"));
  it("14. modules ne contiennent pas @supabase", () => expect(allCodeBlob).not.toContain("@supabase"));
  it("15. modules ne contiennent pas import lib/pierre", () => expect(allCodeBlob).not.toContain("lib/pierre"));
  it("16. modules purs (hors api contract) ne référencent pas /api/", () => expect(pureBlob).not.toContain("/api/"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Routes, SQL, package, UI, API contract
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.4 — Routes, SQL, package, UI", () => {
  it("17. aucune route controlled-missions active", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("18. aucune route controlled-missions/execute", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/execute/route.ts")).toBe(false));
  it("19. aucune route execute", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("20. SQL file contient DESIGN DRAFT ONLY", () => expect(sqlFileSrc).toContain("DESIGN DRAFT ONLY"));
  it("21. SQL file contient DO NOT APPLY", () => expect(sqlFileSrc).toContain("DO NOT APPLY"));
  it("22. SQL file active RLS", () => expect(sqlFileSrc.toLowerCase()).toContain("enable row level security"));
  it("23. SQL file contient CHECK execution_enabled = false", () => expect(sqlFileSrc).toMatch(/execution_enabled\s*=\s*false/));
  it("24. package test:phase5-4", () => expect(packageJson).toContain("test:phase5-4"));
  it("25. package check:controlled-mission-server-persistence", () => expect(packageJson).toContain("check:controlled-mission-server-persistence"));
  it("26. ui copy : « Design serveur uniquement »", () => expect(CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY).toContain("Design serveur uniquement"));
  it("27. ui copy : « Aucune persistance »", () => expect(CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY).toContain("Aucune persistance"));
  it("28. page câble la readiness serveur", () => expect(pageSrc).toContain("buildControlledMissionServerPersistenceReadiness"));
  it("29. page n'a pas d'action « Sauvegarder serveur »", () => expect(pageSrc).not.toContain("Sauvegarder serveur"));
  it("30. page n'a pas d'action « Créer mission serveur »", () => expect(pageSrc).not.toContain("Créer mission serveur"));
  it("31. doc mentionne PHASE 5.5", () => expect(docSrc).toContain("PHASE 5.5"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.4 — Fonctionnels", () => {
  it("32. draft depuis approved + preflight ready → ready_for_future_server_persistence", () => {
    const id = approvedReadyMissionId();
    const draft = buildGovernedControlledMissionServerDraft(missionById(id));
    expect(draft.id.startsWith("srvdraft_")).toBe(true);
    expect(draft.server_persistence_status).toBe("ready_for_future_server_persistence");
    expect(draft.local_controlled_mission_id).toBe(id);
  });

  it("33. mission non reviewée → blocked_missing_review", () => {
    const id = createMission();
    expect(validateGovernedControlledMissionServerDraftEligibility(missionById(id)).blocked_status).toBe("blocked_missing_review");
    expect(buildControlledMissionServerPersistenceReadiness(missionById(id)).status).toBe("blocked_missing_review");
  });

  it("34. mission approuvée sans preflight → blocked_missing_preflight", () => {
    const id = approvedMissionId();
    expect(buildControlledMissionServerPersistenceReadiness(missionById(id)).status).toBe("blocked_missing_preflight");
  });

  it("35. changes_requested → blocked_by_manual_decision (cohérent)", () => {
    const id = createMission();
    requestChangesForLocalControlledMission(id, ["x"]);
    expect(buildControlledMissionServerPersistenceReadiness(missionById(id)).status).toBe("blocked_by_manual_decision");
  });

  it("36. approved + preflight ready → eligible true", () => {
    const id = approvedReadyMissionId();
    const el = validateGovernedControlledMissionServerDraftEligibility(missionById(id));
    expect(el.eligible).toBe(true);
    expect(el.blocked_status).toBeNull();
    expect(buildControlledMissionServerPersistenceReadiness(missionById(id)).status).toBe("ready_for_future_server_persistence");
  });

  it("37. draft : execution_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).execution_enabled).toBe(false));
  it("38. draft : runtime_execution_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).runtime_execution_enabled).toBe(false));
  it("39. draft : pierre_engine_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).pierre_engine_enabled).toBe(false));
  it("40. draft : ai_execution_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).ai_execution_enabled).toBe(false));
  it("41. draft : email_sending_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).email_sending_enabled).toBe(false));
  it("42. draft : document_generation_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).document_generation_enabled).toBe(false));
  it("43. draft : clonevoice_enabled false", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).clonevoice_enabled).toBe(false));
  it("44. draft : runtime_status disabled", () => expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).runtime_status).toBe("disabled"));

  it("45. draft : execution_status sûr", () => {
    const draft = buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId()));
    expect(["not_executable", "server_draft_only", "waiting_future_governed_execution_phase"]).toContain(draft.execution_status);
  });

  it("46. flag default false", () => {
    expect(getControlledMissionServerPersistenceFlagDefault()).toBe(false);
    expect(buildControlledMissionServerPersistenceFeatureFlagContract({}).default_enabled).toBe(false);
  });

  it("47. env true ne crée ni route ni exécution dans P5.4", () => {
    const snap = buildControlledMissionServerPersistenceFlagSnapshot({ [CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG]: "true" });
    expect(snap.enabled).toBe(true);
    expect(snap.default_enabled).toBe(false);
    expect(snap.phase_status).toBe("design_only");
    expect(isControlledMissionServerPersistenceEnabledFromEnv({ [CONTROLLED_MISSION_SERVER_PERSISTENCE_FLAG]: "true" })).toBe(true);
    // Aucune route active malgré le flag.
    expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false);
    // Aucune exécution dans le draft.
    expect(buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId())).execution_enabled).toBe(false);
    // API contract toujours design-only.
    expect(buildControlledMissionServerPersistenceApiContract().current_phase_status).toBe("disabled_design_only");
  });

  it("48. SQL draft (fonction) contient DESIGN DRAFT ONLY", () => expect(buildControlledMissionServerPersistenceSqlDraft().sql).toContain("DESIGN DRAFT ONLY"));
  it("49. SQL draft (fonction) contient DO NOT APPLY", () => expect(buildControlledMissionServerPersistenceSqlDraft().sql).toContain("DO NOT APPLY"));
  it("50. SQL draft (fonction) active RLS", () => expect(buildControlledMissionServerPersistenceSqlDraft().sql.toLowerCase()).toContain("enable row level security"));
  it("51. SQL draft (fonction) contient CHECK execution_enabled = false", () => expect(buildControlledMissionServerPersistenceSqlDraft().sql).toMatch(/execution_enabled\s*=\s*false/));
  it("52. SQL draft : applied false, do_not_apply true, table clonestore_controlled_missions", () => {
    const d = buildControlledMissionServerPersistenceSqlDraft();
    expect(d.applied).toBe(false);
    expect(d.do_not_apply).toBe(true);
    expect(d.table_name).toBe(CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME);
    expect(CONTROLLED_MISSION_SERVER_PERSISTENCE_TABLE_NAME).toBe("clonestore_controlled_missions");
  });

  it("53. api contract : disabled_design_only + route_file_created false", () => {
    const c = buildControlledMissionServerPersistenceApiContract();
    expect(c.current_phase_status).toBe("disabled_design_only");
    expect(c.route_file_created).toBe(false);
    expect(c.future_method).toBe("POST");
    expect(c.safety_flags.execution_enabled).toBe(false);
  });

  it("54. policy snapshot : RLS enabled, delete none_by_design, service role non requis", () => {
    const p = buildControlledMissionServerPersistencePolicySnapshot(missionById(approvedReadyMissionId()));
    expect(p.rls_enabled).toBe(true);
    expect(p.delete_policy).toBe("none_by_design");
    expect(p.service_role_required).toBe(false);
    const rls = buildControlledMissionServerPersistenceRlsPolicyDraft();
    expect(rls.rls_enabled).toBe(true);
    expect(rls.service_role_required).toBe(false);
  });

  it("55. trace snapshot : aucun write serveur, final_event server_persistence_not_started", () => {
    const t = buildControlledMissionServerPersistenceTraceSnapshot(missionById(approvedReadyMissionId()));
    expect(t.server_write_performed).toBe(false);
    expect(t.final_event).toBe("server_persistence_not_started");
  });

  it("56. summarize : design serveur uniquement", () => {
    const draft = buildGovernedControlledMissionServerDraft(missionById(approvedReadyMissionId()));
    expect(summarizeControlledMissionServerPersistenceDraft(draft)).toContain("Design serveur uniquement");
  });

  it("57. QA checklist phase 5.4 + verdict ready", () => {
    const checklist = buildControlledMissionServerPersistenceQaChecklist();
    expect(checklist.phase).toBe("5.4");
    expect(checklist.total).toBeGreaterThanOrEqual(30);
    const verdict = buildControlledMissionServerPersistenceQaVerdict(checklist.steps);
    expect(verdict.verdict).toBe("ready");
    expect(verdict.server_persistence_design_only).toBe(true);
  });

  it("58. blocked_by_guard mission : statut bloqué cohérent (pas ready)", () => {
    const m = buildControlledMissionFromPromotionPreview(blockedContract());
    upsertLocalControlledMission(m);
    const status = buildControlledMissionServerPersistenceReadiness(missionById(m.id)).status;
    expect(status.startsWith("blocked")).toBe(true);
    expect(status).not.toBe("ready_for_future_server_persistence");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte (P5.1 / P5.2 / P5.3)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.4 — Cascade intacte", () => {
  it("59. P5.1 : create local controlled mission", () => {
    const r = createLocalControlledMission(eligibleContract());
    expect(r.ok).toBe(true);
    expect(r.mission).not.toBeNull();
  });
  it("60. P5.2 : approbation locale", () => {
    const id = createMission();
    const r = approveLocalControlledMission(id);
    expect(r.review_state?.review_status).toBe("approved_local");
  });
  it("61. P5.3 : preflight ready", () => {
    const id = approvedMissionId();
    expect(runLocalControlledMissionPreflight(id).status).toBe("ready_for_future_governed_execution");
  });
  const scripts = ["test:phase5-3", "test:phase5-2", "test:phase5-1", "test:phase4-12", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
