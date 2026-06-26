// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-safe-apply-phase5-1.test.ts
// PHASE 5.1 — Controlled Mission Safe Apply / LocalStorage First — Tests

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  createLocalControlledMission,
  buildControlledMissionFromPromotionPreview,
  validateControlledMissionSafeApplyInput,
  sanitizeControlledMissionText,
  sanitizeControlledMissionPayload,
  loadLocalControlledMissions,
  getLocalControlledMissionById,
  archiveLocalControlledMission,
  clearLocalControlledMissionsForQA,
  buildControlledMissionSafeApplyQaChecklist,
  buildControlledMissionSafeApplyQaVerdict,
  CONTROLLED_MISSION_SAFE_APPLY_SUCCESS,
  CONTROLLED_MISSION_SAFE_APPLY_MICROCOPY,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-safe-apply-types.ts`);
const safeApplySrc = readSrc(`${RI_DIR}/controlled-mission-safe-apply.ts`);
const localStorageSrc = readSrc(`${RI_DIR}/controlled-mission-local-storage.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-safe-apply-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-safe-apply-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const scriptSrc = readRootFile("scripts/check-controlled-mission-safe-apply-phase5-1.mjs");
const docSrc = readRootFile("docs/PHASE_5_1_CONTROLLED_MISSION_SAFE_APPLY_LOCALSTORAGE_FIRST.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_1_CONTROLLED_MISSION_SAFE_APPLY_EVIDENCE.md");
const packageJson = readRootFile("package.json");

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

beforeEach(() => {
  setWindow(new LocalStorageMock());
});
afterAll(() => {
  if (ORIGINAL_WINDOW === undefined) delete (globalThis as unknown as { window?: unknown }).window;
  else (globalThis as unknown as { window?: unknown }).window = ORIGINAL_WINDOW;
});

// ── Factories ─────────────────────────────────────────────────────────────────

const baseResult = buildRuntimeIntegrationReadResult({
  raw_text: "Rédige une fiche de poste pour un développeur back-end",
});
const baseDraft = buildRuntimeMissionDraftFromIntegrationResult(baseResult);

function eligibleDraft(overrides?: Partial<RuntimeMissionDraft>): RuntimeMissionDraft {
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
    ...overrides,
  };
}

function blockedDraft(): RuntimeMissionDraft {
  return { ...eligibleDraft(), kind: "blocked_draft", status: "blocked", blocked_reasons: ["Action finale juridique."] };
}

const eligibleContract = () => buildRuntimeMissionPromotionContract(eligibleDraft());
const blockedContract = () => buildRuntimeMissionPromotionContract(blockedDraft());

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.1 — Présence & pureté", () => {
  it("1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. safe apply existe", () => expect(safeApplySrc.length).toBeGreaterThan(0));
  it("3. localStorage existe", () => expect(localStorageSrc.length).toBeGreaterThan(0));
  it("4. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("5. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("6. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("7. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("8. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("9. safe apply ne contient pas fetch", () => expect(safeApplySrc).not.toContain("fetch"));
  it("10. safe apply ne contient pas createClient", () => expect(safeApplySrc).not.toContain("createClient"));
  it("11. safe apply ne contient pas import lib/pierre", () => expect(safeApplySrc).not.toContain("lib/pierre"));
  it("12. localStorage ne contient pas @supabase", () => expect(localStorageSrc).not.toContain("@supabase"));
  it("13. localStorage ne contient pas fetch", () => expect(localStorageSrc).not.toContain("fetch"));
  it("14. localStorage ne contient pas import lib/pierre", () => expect(localStorageSrc).not.toContain("lib/pierre"));
  it("15. modules ne référencent pas /api/pierre", () => {
    expect([typesSrc, safeApplySrc, localStorageSrc, uiCopySrc, qaSrc].join("\n")).not.toContain("/api/pierre");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Page & routes
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.1 — Page & routes", () => {
  it("16. ui copy : libellé « Créer une mission contrôlée locale »", () => expect(uiCopySrc).toContain("Créer une mission contrôlée locale"));
  it("17. page : section Missions contrôlées locales", () => expect(pageSrc).toContain("Missions contrôlées locales"));
  it("18. ui copy : microcopy « Local uniquement »", () => expect(uiCopySrc).toContain("Local uniquement"));
  it("19. ui copy : message « Elle n'a pas été exécutée »", () => expect(uiCopySrc).toContain("Elle n'a pas été exécutée"));
  it("20. page : action Archiver localement", () => expect(pageSrc).toContain("Archiver localement"));
  it("21. page : utilise createLocalControlledMission", () => expect(pageSrc).toContain("createLocalControlledMission"));
  it("22. page : aucune action « mission lancée »", () => expect(pageSrc).not.toContain("mission lancée"));
  it("23. aucune route execute (clonestore/runtime)", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("24. aucune route execute (runtime)", () => expect(hasFile("src/app/api/runtime/execute/route.ts")).toBe(false));
  it("25. aucune route controlled-missions/execute", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/execute/route.ts")).toBe(false));
  it("26. aucune route pierre/runtime/execute", () => expect(hasFile("src/app/api/pierre/runtime/execute/route.ts")).toBe(false));
  it("27. aucune route cloneos/execute", () => expect(hasFile("src/app/api/cloneos/execute/route.ts")).toBe(false));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Index, package, doc
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.1 — Index, package & doc", () => {
  it("28. index exporte createLocalControlledMission", () => expect(indexSrc).toContain("createLocalControlledMission"));
  it("29. index exporte loadLocalControlledMissions", () => expect(indexSrc).toContain("loadLocalControlledMissions"));
  it("30. index exporte buildControlledMissionSafeApplyQaChecklist", () => expect(indexSrc).toContain("buildControlledMissionSafeApplyQaChecklist"));
  it("31. package test:phase5-1", () => expect(packageJson).toContain("test:phase5-1"));
  it("32. package check:controlled-mission-safe-apply", () => expect(packageJson).toContain("check:controlled-mission-safe-apply"));
  it("33. script contient PASS", () => expect(scriptSrc).toContain("PASS"));
  it("34. script ne contient pas writeFile", () => expect(scriptSrc).not.toContain("writeFile"));
  it("35. script ne contient pas fetch", () => expect(scriptSrc).not.toContain("fetch"));
  it("36. doc mentionne localStorage-first", () => expect(docSrc).toContain("LocalStorage First"));
  it("37. doc mentionne lancement public externe non validé", () => expect(docSrc.toLowerCase()).toContain("lancement public externe non validé"));
  it("38. doc mentionne PHASE 5.2", () => expect(docSrc).toContain("PHASE 5.2"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.1 — Fonctionnels", () => {
  it("39. build depuis preview valide", () => {
    const m = buildControlledMissionFromPromotionPreview(eligibleContract());
    expect(m.id).toContain("localcm_");
    expect(m.source).toBe("local_safe_apply");
    expect(m.read_only).toBe(true);
  });

  it("40. refuse / bloque preview invalide (blocked)", () => {
    const check = validateControlledMissionSafeApplyInput(blockedContract());
    expect(check.can_safe_apply).toBe(false);
    const result = createLocalControlledMission(blockedContract());
    expect(result.status).toBe("blocked");
    expect(result.mission).toBeNull();
    expect(loadLocalControlledMissions().length).toBe(0);
  });

  it("41. idempotence : pas de doublon sur double clic", () => {
    const c = eligibleContract();
    const r1 = createLocalControlledMission(c);
    const r2 = createLocalControlledMission(c);
    expect(r1.status).toBe("created");
    expect(r2.status).toBe("already_exists");
    expect(loadLocalControlledMissions().length).toBe(1);
  });

  it("42. localStorage vide → liste vide", () => {
    expect(loadLocalControlledMissions()).toEqual([]);
  });

  it("43. localStorage corrompu → fallback vide", () => {
    (globalThis as unknown as { window: { localStorage: LocalStorageMock } }).window.localStorage.setItem(
      "clonestore.runtimeControlledMissions.local.v1",
      "{{ not json"
    );
    expect(loadLocalControlledMissions()).toEqual([]);
  });

  it("44. localStorage indisponible → échec propre (aucune exécution)", () => {
    setWindow({
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => {},
    });
    const result = createLocalControlledMission(eligibleContract());
    expect(result.status).toBe("local_save_failed");
    expect(result.ok).toBe(false);
    expect(result.runtime_execution_performed).toBe(false);
  });

  it("45. sanitization XSS / HTML / script", () => {
    const dirty = sanitizeControlledMissionText('<script>alert(1)</script> Bonjour <b>RH</b>');
    expect(dirty).not.toContain("<script>");
    expect(dirty).not.toContain("<b>");
    expect(dirty).toContain("Bonjour");
  });

  it("46. données sensibles redacted", () => {
    const redacted = sanitizeControlledMissionText("clé sk_live_ABCDEF12345 secrète");
    expect(redacted).toContain("[redacted]");
    expect(redacted).not.toContain("sk_live_ABCDEF12345");
  });

  it("47. statut non-exécutable obligatoire", () => {
    const m = buildControlledMissionFromPromotionPreview(eligibleContract());
    expect(["not_executable", "local_only", "pending_manual_review"]).toContain(m.execution_status);
  });

  it("48. server_persistence disabled obligatoire", () => {
    const m = buildControlledMissionFromPromotionPreview(eligibleContract());
    expect(m.server_persistence).toBe("disabled");
  });

  it("49. runtime_execution disabled obligatoire", () => {
    const m = buildControlledMissionFromPromotionPreview(eligibleContract());
    expect(m.runtime_execution).toBe("disabled");
    expect(m.real_mission_created).toBe(false);
    expect(m.pierre_engine_called).toBe(false);
    expect(m.ai_call_performed).toBe(false);
  });

  it("50. wording sûr : succès dit « n'a pas été exécutée », jamais « lancée »", () => {
    expect(CONTROLLED_MISSION_SAFE_APPLY_SUCCESS).toContain("n'a pas été exécutée");
    expect(CONTROLLED_MISSION_SAFE_APPLY_SUCCESS).not.toContain("lancée");
    expect(CONTROLLED_MISSION_SAFE_APPLY_MICROCOPY).toContain("Aucune exécution");
  });

  it("51. archive locale fonctionne", () => {
    const r = createLocalControlledMission(eligibleContract());
    const id = r.mission!.id;
    expect(archiveLocalControlledMission(id)).toBe(true);
    expect(getLocalControlledMissionById(id)?.status).toBe("archived_local");
    expect(getLocalControlledMissionById(id)?.execution_status).toBe("not_executable");
  });

  it("52. list / restore local fonctionne", () => {
    createLocalControlledMission(eligibleContract());
    const list = loadLocalControlledMissions();
    expect(list.length).toBe(1);
    expect(list[0].read_only).toBe(true);
  });

  it("53. sanitizePayload re-force les invariants", () => {
    const m = buildControlledMissionFromPromotionPreview(eligibleContract());
    const tampered = { ...m, runtime_execution: "enabled" as unknown as "disabled" };
    const safe = sanitizeControlledMissionPayload(tampered);
    expect(safe.runtime_execution).toBe("disabled");
    expect(safe.read_only).toBe(true);
  });

  it("54. clearLocalControlledMissionsForQA vide la liste", () => {
    createLocalControlledMission(eligibleContract());
    expect(loadLocalControlledMissions().length).toBe(1);
    clearLocalControlledMissionsForQA();
    expect(loadLocalControlledMissions().length).toBe(0);
  });

  it("55. QA snapshot PASS (ready quand tout pending)", () => {
    const checklist = buildControlledMissionSafeApplyQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(20);
    expect(checklist.phase).toBe("5.1");
    const summary = buildControlledMissionSafeApplyQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.localstorage_first_only).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Cascade intacte
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.1 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-12", "test:phase4-11", "test:phase4-1", "test:phase3-22",
    "test:phase2-9", "test:tech11", "test:pfinal02",
  ];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
