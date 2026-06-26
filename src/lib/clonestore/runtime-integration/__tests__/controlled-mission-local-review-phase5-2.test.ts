// src/lib/clonestore/runtime-integration/__tests__/controlled-mission-local-review-phase5-2.test.ts
// PHASE 5.2 — Controlled Mission Local Review & Manual Validation — Tests

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
  // P5.2
  buildControlledMissionReviewChecklist,
  startLocalControlledMissionReview,
  approveLocalControlledMission,
  requestChangesForLocalControlledMission,
  blockLocalControlledMission,
  archiveReviewedLocalControlledMission,
  getControlledMissionReviewState,
  sanitizeControlledMissionReviewText,
  buildControlledMissionReviewQaChecklist,
  buildControlledMissionReviewQaVerdict,
  CONTROLLED_MISSION_REVIEW_MICROCOPY,
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

const typesSrc = readSrc(`${RI_DIR}/controlled-mission-local-review-types.ts`);
const reviewSrc = readSrc(`${RI_DIR}/controlled-mission-local-review.ts`);
const uiCopySrc = readSrc(`${RI_DIR}/controlled-mission-local-review-ui-copy.ts`);
const qaSrc = readSrc(`${RI_DIR}/controlled-mission-local-review-qa.ts`);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const scriptSrc = readRootFile("scripts/check-controlled-mission-local-review-phase5-2.mjs");
const docSrc = readRootFile("docs/PHASE_5_2_CONTROLLED_MISSION_LOCAL_REVIEW_MANUAL_VALIDATION.md");
const evidenceSrc = readRootFile("docs/templates/PHASE_5_2_CONTROLLED_MISSION_LOCAL_REVIEW_EVIDENCE.md");
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
const eligibleContract = () => buildRuntimeMissionPromotionContract(eligibleDraft());
const blockedContract = () => buildRuntimeMissionPromotionContract(blockedDraft());

function createMission(): string {
  const r = createLocalControlledMission(eligibleContract());
  return r.mission!.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Présence & pureté
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.2 — Présence & pureté", () => {
  it("1. types existe", () => expect(typesSrc.length).toBeGreaterThan(0));
  it("2. review existe", () => expect(reviewSrc.length).toBeGreaterThan(0));
  it("3. ui copy existe", () => expect(uiCopySrc.length).toBeGreaterThan(0));
  it("4. QA existe", () => expect(qaSrc.length).toBeGreaterThan(0));
  it("5. script existe", () => expect(scriptSrc.length).toBeGreaterThan(0));
  it("6. doc existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("7. evidence existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("8. review ne contient pas fetch", () => expect(reviewSrc).not.toContain("fetch"));
  it("9. review ne contient pas createClient", () => expect(reviewSrc).not.toContain("createClient"));
  it("10. review ne contient pas @supabase", () => expect(reviewSrc).not.toContain("@supabase"));
  it("11. review ne contient pas import lib/pierre", () => expect(reviewSrc).not.toContain("lib/pierre"));
  it("12. ui copy ne contient pas fetch", () => expect(uiCopySrc).not.toContain("fetch"));
  it("13. modules ne référencent pas /api/pierre", () => expect([typesSrc, reviewSrc, uiCopySrc].join("\n")).not.toContain("/api/pierre"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Page, routes, index, package, doc
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.2 — Page, routes, index, package, doc", () => {
  it("14. ui copy : libellé « Approuver localement »", () => expect(uiCopySrc).toContain("Approuver localement"));
  it("15. review microcopy : « Aucune exécution »", () => expect(CONTROLLED_MISSION_REVIEW_MICROCOPY).toContain("Aucune exécution"));
  it("16. page câble approveLocalControlledMission", () => expect(pageSrc).toContain("approveLocalControlledMission"));
  it("17. page : pas d'action « Exécuter la mission »", () => expect(pageSrc).not.toContain("Exécuter la mission"));
  it("18. page : pas d'action « Lancer la mission »", () => expect(pageSrc).not.toContain("Lancer la mission"));
  it("19. page : pas de « mission lancée »", () => expect(pageSrc).not.toContain("mission lancée"));
  it("20. aucune route execute (clonestore/runtime)", () => expect(hasFile("src/app/api/clonestore/runtime/execute/route.ts")).toBe(false));
  it("21. aucune route controlled-missions", () => expect(hasFile("src/app/api/clonestore/runtime/controlled-missions/route.ts")).toBe(false));
  it("22. aucune route pierre/runtime/execute", () => expect(hasFile("src/app/api/pierre/runtime/execute/route.ts")).toBe(false));
  it("23. index exporte approveLocalControlledMission", () => expect(indexSrc).toContain("approveLocalControlledMission"));
  it("24. index exporte buildControlledMissionReviewChecklist", () => expect(indexSrc).toContain("buildControlledMissionReviewChecklist"));
  it("25. index exporte buildControlledMissionReviewQaChecklist", () => expect(indexSrc).toContain("buildControlledMissionReviewQaChecklist"));
  it("26. package test:phase5-2", () => expect(packageJson).toContain("test:phase5-2"));
  it("27. package check:controlled-mission-local-review", () => expect(packageJson).toContain("check:controlled-mission-local-review"));
  it("28. script contient PASS", () => expect(scriptSrc).toContain("PASS"));
  it("29. doc mentionne approbation locale", () => expect(docSrc.toLowerCase()).toContain("approbation locale"));
  it("30. doc mentionne PHASE 5.3", () => expect(docSrc).toContain("PHASE 5.3"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.2 — Fonctionnels", () => {
  it("31. checklist générée depuis mission valide", () => {
    const id = createMission();
    const checklist = buildControlledMissionReviewChecklist(getLocalControlledMissionById(id)!);
    expect(checklist.length).toBe(9);
    expect(checklist.some((c) => c.id === "no_auto_execution_expected")).toBe(true);
  });

  it("32. start review → in_review", () => {
    const id = createMission();
    const r = startLocalControlledMissionReview(id);
    expect(r.status).toBe("review_started");
    expect(getControlledMissionReviewState(getLocalControlledMissionById(id)!).review_status).toBe("in_review");
  });

  it("33. approve local → approved_local", () => {
    const id = createMission();
    const r = approveLocalControlledMission(id, "OK local.");
    expect(r.status).toBe("approved_local");
    expect(getControlledMissionReviewState(getLocalControlledMissionById(id)!).review_status).toBe("approved_local");
  });

  it("34. approve ne change jamais runtime_execution", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    expect(getLocalControlledMissionById(id)!.runtime_execution).toBe("disabled");
  });

  it("35. approve ne change jamais server_persistence", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    const m = getLocalControlledMissionById(id)!;
    expect(m.server_persistence).toBe("disabled");
    expect(["not_executable", "local_only", "pending_manual_review"]).toContain(m.execution_status);
  });

  it("36. approve ne crée aucune mission réelle", () => {
    const id = createMission();
    const r = approveLocalControlledMission(id);
    expect(r.real_mission_created).toBe(false);
    expect(r.runtime_execution_performed).toBe(false);
    expect(getLocalControlledMissionById(id)!.real_mission_created).toBe(false);
  });

  it("37. double approve idempotent", () => {
    const id = createMission();
    approveLocalControlledMission(id);
    const r2 = approveLocalControlledMission(id);
    expect(r2.status).toBe("already_approved");
    expect(loadLocalControlledMissions().length).toBe(1);
    const approvals = getControlledMissionReviewState(getLocalControlledMissionById(id)!).timeline.filter((t) => t.event === "local_approved");
    expect(approvals.length).toBe(1);
  });

  it("38. request changes fonctionne", () => {
    const id = createMission();
    const r = requestChangesForLocalControlledMission(id, ["Préciser le périmètre."], "Note.");
    expect(r.status).toBe("changes_requested");
    expect(getControlledMissionReviewState(getLocalControlledMissionById(id)!).review_status).toBe("changes_requested");
  });

  it("39. block local fonctionne", () => {
    const id = createMission();
    const r = blockLocalControlledMission(id, "Risque résiduel.", "Note.");
    expect(r.status).toBe("blocked_local");
    expect(getControlledMissionReviewState(getLocalControlledMissionById(id)!).review_status).toBe("blocked_local");
  });

  it("40. archive reviewed fonctionne", () => {
    const id = createMission();
    const r = archiveReviewedLocalControlledMission(id);
    expect(r.status).toBe("archived_local");
    expect(getLocalControlledMissionById(id)!.status).toBe("archived_local");
    expect(getControlledMissionReviewState(getLocalControlledMissionById(id)!).review_status).toBe("archived_local");
  });

  it("41. mission introuvable → erreur propre", () => {
    const r = approveLocalControlledMission("localcm_inexistante");
    expect(r.ok).toBe(false);
    expect(r.status).toBe("not_found");
  });

  it("42. mission archivée → approbation impossible", () => {
    const id = createMission();
    archiveReviewedLocalControlledMission(id);
    const r = approveLocalControlledMission(id);
    expect(r.ok).toBe(false);
    expect(r.status).toBe("not_allowed");
  });

  it("43. mission blocked_by_guard → approbation impossible / blocked_local forcé", () => {
    const blockedMission = buildControlledMissionFromPromotionPreview(blockedContract());
    upsertLocalControlledMission(blockedMission);
    const r = approveLocalControlledMission(blockedMission.id);
    expect(r.ok).toBe(false);
    expect(r.review_state?.review_status).toBe("blocked_local");
  });

  it("44. localStorage vide", () => {
    expect(loadLocalControlledMissions()).toEqual([]);
  });

  it("45. localStorage corrompu → fallback sûr", () => {
    currentLocalStorage().setItem(KEY, "{{ not json");
    expect(loadLocalControlledMissions()).toEqual([]);
  });

  it("46. localStorage indisponible → échec propre", () => {
    const id = createMission();
    const raw = currentLocalStorage().getItem(KEY);
    setWindow({ getItem: (k: string) => (k === KEY ? raw : null), setItem: () => { throw new Error("quota"); }, removeItem: () => {} });
    const r = startLocalControlledMissionReview(id);
    expect(r.status).toBe("local_save_failed");
    expect(r.runtime_execution_performed).toBe(false);
  });

  it("47. sanitization notes / required_changes", () => {
    const cleaned = sanitizeControlledMissionReviewText("<script>x</script> note <b>RH</b>");
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("<b>");
    expect(cleaned).toContain("note");
  });

  it("48. timeline ajoute review_started", () => {
    const id = createMission();
    startLocalControlledMissionReview(id);
    expect(getControlledMissionReviewState(getLocalControlledMissionById(id)!).timeline.some((t) => t.event === "review_started")).toBe(true);
  });

  it("49. timeline ajoute local_approved / changes_requested / local_blocked", () => {
    const a = createMission();
    approveLocalControlledMission(a);
    expect(getControlledMissionReviewState(getLocalControlledMissionById(a)!).timeline.some((t) => t.event === "local_approved")).toBe(true);

    const b = createMission();
    requestChangesForLocalControlledMission(b, ["x"]);
    expect(getControlledMissionReviewState(getLocalControlledMissionById(b)!).timeline.some((t) => t.event === "changes_requested")).toBe(true);
    blockLocalControlledMission(b, "raison");
    expect(getControlledMissionReviewState(getLocalControlledMissionById(b)!).timeline.some((t) => t.event === "local_blocked")).toBe(true);
  });

  it("50. timeline items sont local_only / non-exécution", () => {
    const id = createMission();
    startLocalControlledMissionReview(id);
    const tl = getControlledMissionReviewState(getLocalControlledMissionById(id)!).timeline;
    expect(tl.every((t) => t.local_only === true && t.execution_enabled === false)).toBe(true);
  });

  it("51. QA snapshot PASS (ready quand tout pending)", () => {
    const checklist = buildControlledMissionReviewQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(20);
    expect(checklist.phase).toBe("5.2");
    const summary = buildControlledMissionReviewQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.local_review_only).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Cascade intacte
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 5.2 — Cascade intacte", () => {
  const scripts = ["test:phase5-1", "test:phase4-12", "test:phase4-1", "test:phase2-9", "test:tech11", "test:pfinal02"];
  scripts.forEach((script) => {
    it(`${script} encore présent`, () => expect(packageJson).toContain(`"${script}"`));
  });
});
