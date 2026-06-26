// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-promotion-preview-ui-phase4-9.test.ts
// PHASE 4.9 — Runtime Controlled Mission Preview UI / Read-Only Promotion Panel — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeIntegrationReadResult,
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionPromotionContract,
  buildRuntimeMissionPromotionSnapshot,
  buildRuntimeMissionPromotionBadges,
  buildRuntimeMissionPromotionPreviewUiQaChecklist,
  buildRuntimeMissionPromotionPreviewUiQaVerdict,
  getRuntimeMissionPromotionPreviewUiBlockingSteps,
} from "@/lib/clonestore/runtime-integration";

const ROOT = resolve(__dirname, "../../../../..");
const RI_DIR = "lib/clonestore/runtime-integration";

function readSrc(rel: string): string {
  const full = resolve(ROOT, "src", rel);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readDocs(name: string): string {
  const full = resolve(ROOT, "docs", name);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readTemplate(name: string): string {
  const full = resolve(ROOT, "docs/templates", name);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}
function readRoot(name: string): string {
  const full = resolve(ROOT, name);
  return existsSync(full) ? readFileSync(full, "utf-8") : "";
}

const qaPath = `${RI_DIR}/runtime-mission-promotion-preview-ui-qa.ts`;
const qaSrc = readSrc(qaPath);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const pageFlat = pageSrc.replace(/\s+/g, " ");
const docSrc = readDocs("PHASE_4_9_RUNTIME_CONTROLLED_MISSION_PREVIEW_UI.md");
const docLower = docSrc.toLowerCase();
const evidenceSrc = readTemplate("PHASE_4_9_RUNTIME_CONTROLLED_MISSION_PREVIEW_UI_EVIDENCE.md");
const packageJson = readRoot("package.json");

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — /profile/messages (panneau d'aperçu)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.9 — /profile/messages", () => {
  it("1. mentionne Promotion en mission contrôlée", () => expect(pageSrc).toContain("Promotion en mission contrôlée"));
  it("2. mentionne Prévisualiser la promotion", () => expect(pageSrc).toContain("Prévisualiser la promotion"));
  it("3. mentionne contrat de promotion", () => expect(pageSrc).toContain("contrat de promotion"));
  it("4. mentionne Validation humaine requise", () => expect(pageFlat).toContain("Validation humaine requise"));
  it("5. mentionne Aucune mission réelle", () => expect(pageSrc).toContain("Aucune mission réelle"));
  it("6. mentionne Aucune exécution", () => expect(pageSrc).toContain("Aucune exécution"));
  it("7. mentionne Aucun appel Pierre", () => expect(pageSrc).toContain("Aucun appel Pierre"));
  it("8. utilise buildRuntimeMissionPromotionContract", () => expect(pageSrc).toContain("buildRuntimeMissionPromotionContract"));
  it("9. utilise buildRuntimeMissionPromotionSnapshot", () => expect(pageSrc).toContain("buildRuntimeMissionPromotionSnapshot"));
  it("10. utilise buildRuntimeMissionPromotionBadges", () => expect(pageSrc).toContain("buildRuntimeMissionPromotionBadges"));
  it("11. ne contient pas createClient", () => expect(pageSrc).not.toContain("createClient"));
  it("12. ne contient pas import src/lib/pierre", () => expect(pageSrc).not.toContain("lib/pierre"));
  it("13. ne contient pas /api/pierre", () => expect(pageSrc).not.toContain("/api/pierre"));
  it("14. ne contient pas fetch direct vers mission-drafts", () => expect(pageSrc).not.toContain("mission-drafts"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.9 — QA module", () => {
  it("15. runtime-mission-promotion-preview-ui-qa.ts existe", () => expect(existsSync(resolve(ROOT, "src", qaPath))).toBe(true));
  it("16. contient buildRuntimeMissionPromotionPreviewUiQaChecklist", () => expect(qaSrc).toContain("buildRuntimeMissionPromotionPreviewUiQaChecklist"));
  it("17. contient promotion_preview_panel_visible", () => expect(qaSrc).toContain("promotion_preview_panel_visible"));
  it("18. contient promotion_preview_no_auto_run_on_mount", () => expect(qaSrc).toContain("promotion_preview_no_auto_run_on_mount"));
  it("19. contient promotion_preview_mentions_promotion_not_applied", () => expect(qaSrc).toContain("promotion_preview_mentions_promotion_not_applied"));
  it("20. contient no_db_write_added", () => expect(qaSrc).toContain("no_db_write_added"));
  it("21. contient no_api_post_added", () => expect(qaSrc).toContain("no_api_post_added"));
  it("22. contient no_pierre_engine_import", () => expect(qaSrc).toContain("no_pierre_engine_import"));
  it("23. contient no_cloneos_execution", () => expect(qaSrc).toContain("no_cloneos_execution"));
  it("24. contient no_clonevoice_activation", () => expect(qaSrc).toContain("no_clonevoice_activation"));
  it("25. contient public_launch_external_not_validated", () => expect(qaSrc).toContain("public_launch_external_not_validated"));
  it("26. qa ne contient pas createClient", () => expect(qaSrc).not.toContain("createClient"));
  it("27. qa ne contient pas fetch", () => expect(qaSrc).not.toContain("fetch"));
  it("28. qa ne contient pas .insert(", () => expect(qaSrc).not.toContain(".insert("));
  it("29. qa ne contient pas import lib/pierre", () => expect(qaSrc).not.toContain("lib/pierre"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Documentation & evidence
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.9 — Documentation & evidence", () => {
  it("30. doc P4.9 existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("31. doc mentionne 4.9", () => expect(docSrc).toContain("4.9"));
  it("32. doc mentionne mission contrôlée", () => expect(docLower).toContain("mission contrôlée"));
  it("33. doc mentionne /profile/messages", () => expect(docSrc).toContain("/profile/messages"));
  it("34. doc mentionne promotion_applied", () => expect(docSrc).toContain("promotion_applied"));
  it("35. doc mentionne validation humaine", () => expect(docLower).toContain("validation humaine"));
  it("36. doc mentionne CloneGuard", () => expect(docSrc).toContain("CloneGuard"));
  it("37. doc mentionne aucune mission réelle", () => expect(docLower).toContain("aucune mission réelle"));
  it("38. doc mentionne aucun appel Pierre", () => expect(docLower).toContain("aucun appel pierre"));
  it("39. doc mentionne aucun appel IA", () => expect(docLower).toContain("aucun appel ia"));
  it("40. doc mentionne CloneVoice non actif", () => expect(docLower).toContain("clonevoice non actif"));
  it("41. doc mentionne scale 80k non prouvé", () => expect(docLower).toContain("scale 80k non prouvé"));
  it("42. doc mentionne PHASE 4.10", () => expect(docSrc).toContain("PHASE 4.10"));
  it("43. doc sans phrase anglaise de lancement public", () => expect(docLower).not.toContain("public launch"));
  it("44. doc sans zéro erreur", () => expect(docLower).not.toContain("zéro erreur"));
  it("45. doc sans conformité garantie", () => expect(docLower).not.toContain("conformité garantie"));
  it("46. doc sans 80k scale proven", () => expect(docLower).not.toContain("80k scale proven"));
  it("47. doc sans 80k clients guaranteed", () => expect(docLower).not.toContain("80k clients guaranteed"));
  it("48. evidence template existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("49. evidence mentionne promotion_applied", () => expect(evidenceSrc).toContain("promotion_applied"));
  it("50. evidence mentionne Mission contrôlée", () => expect(evidenceSrc).toContain("Mission contrôlée"));
  it("51. evidence mentionne scale 80k non prouvé", () => expect(evidenceSrc.toLowerCase()).toContain("scale 80k non prouvé"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Index & package
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.9 — Index & package", () => {
  it("52. index exporte buildRuntimeMissionPromotionPreviewUiQaChecklist", () => expect(indexSrc).toContain("buildRuntimeMissionPromotionPreviewUiQaChecklist"));
  it("53. package.json contient test:phase4-9", () => expect(packageJson).toContain("test:phase4-9"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.9 — Fonctionnels", () => {
  const result = buildRuntimeIntegrationReadResult({
    raw_text: "Rédige une fiche de poste pour un développeur back-end",
  });
  const draft = buildRuntimeMissionDraftFromIntegrationResult(result);
  const contract = buildRuntimeMissionPromotionContract(draft);
  const snap = buildRuntimeMissionPromotionSnapshot(contract);

  it("54. snapshot read_only true + promotion_applied false", () => {
    expect(snap.read_only).toBe(true);
    expect(snap.contract.safety_flags.promotion_applied).toBe(false);
    expect(snap.contract.decision.promotion_applied).toBe(false);
  });

  it("55. badges incluent No-execution + Aucune mission réelle", () => {
    const labels = buildRuntimeMissionPromotionBadges(snap).map((b) => b.label);
    expect(labels).toContain("No-execution");
    expect(labels).toContain("Aucune mission réelle");
  });

  it("56. badges incluent Validation humaine requise", () => {
    const labels = buildRuntimeMissionPromotionBadges(snap).map((b) => b.label);
    expect(labels).toContain("Validation humaine requise");
  });

  it("57. status_label défini + verdict cohérent", () => {
    expect(snap.status_label.length).toBeGreaterThan(0);
    expect(["eligible", "requires_human_validation", "not_eligible", "blocked"]).toContain(snap.verdict);
  });

  it("58. QA checklist a au moins 19 étapes + phase 4.9", () => {
    const checklist = buildRuntimeMissionPromotionPreviewUiQaChecklist();
    expect(checklist.total).toBeGreaterThanOrEqual(19);
    expect(checklist.phase).toBe("4.9");
  });

  it("59. QA blocking steps sont tous blocking", () => {
    expect(getRuntimeMissionPromotionPreviewUiBlockingSteps().every((s) => s.severity === "blocking")).toBe(true);
  });

  it("60. QA verdict ready quand tout pending", () => {
    const checklist = buildRuntimeMissionPromotionPreviewUiQaChecklist();
    const summary = buildRuntimeMissionPromotionPreviewUiQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.ui_preview_only).toBe(true);
  });

  it("61. QA verdict blocked si une étape bloquante échoue", () => {
    const checklist = buildRuntimeMissionPromotionPreviewUiQaChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "promotion_preview_panel_visible" ? { ...s, status: "failed" as const } : s
    );
    expect(buildRuntimeMissionPromotionPreviewUiQaVerdict(withFail).verdict).toBe("blocked");
  });

  it("62. QA verdict passed si toutes passées", () => {
    const checklist = buildRuntimeMissionPromotionPreviewUiQaChecklist();
    const allPassed = checklist.steps.map((s) => ({ ...s, status: "passed" as const }));
    expect(buildRuntimeMissionPromotionPreviewUiQaVerdict(allPassed).verdict).toBe("passed");
  });

  it("63. QA summarize contient PHASE 4.9", () => {
    const checklist = buildRuntimeMissionPromotionPreviewUiQaChecklist();
    const summary = buildRuntimeMissionPromotionPreviewUiQaVerdict(checklist.steps);
    expect(summary.message).toContain("PHASE 4.9");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Cascade intacte
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.9 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-8", "test:phase4-7", "test:phase4-6", "test:phase4-5", "test:phase4-4",
    "test:phase4-3", "test:phase4-2", "test:phase4-1", "test:phase3-22", "test:phase2-9",
    "test:tech11", "test:pfinal02",
  ];
  scripts.forEach((script, idx) => {
    it(`${64 + idx}. ${script} encore présent`, () => {
      expect(packageJson).toContain(`"${script}"`);
    });
  });
});
