// src/lib/clonestore/runtime-integration/__tests__/runtime-mission-draft-restore-ui-phase4-7.test.ts
// PHASE 4.7 — Runtime Mission Draft Server Restore UI Polish — Tests

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

import {
  buildRuntimeMissionDraftRestoreUiSnapshot,
  buildRuntimeMissionDraftRestoreUiBadges,
  buildRuntimeMissionDraftRestoreUiTimeline,
  buildRuntimeMissionDraftRestoreUiWarnings,
  buildRuntimeMissionDraftRestoreUiQaChecklist,
  buildRuntimeMissionDraftRestoreUiQaVerdict,
  type RuntimeMissionDraftSafeApplyResult,
  type RuntimeMissionDraftSafeApplyRestoreResult,
  type RuntimeMissionDraftSafeApplyStatus,
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

const modulePath = `${RI_DIR}/runtime-mission-draft-restore-ui.ts`;
const qaPath = `${RI_DIR}/runtime-mission-draft-restore-ui-qa.ts`;
const moduleSrc = readSrc(modulePath);
const qaSrc = readSrc(qaPath);
const indexSrc = readSrc(`${RI_DIR}/index.ts`);
const pageSrc = readSrc("app/profile/messages/page.tsx");
const docSrc = readDocs("PHASE_4_7_RUNTIME_MISSION_DRAFT_SERVER_RESTORE_UI_POLISH.md");
const evidenceSrc = readTemplate("PHASE_4_7_RUNTIME_MISSION_DRAFT_RESTORE_UI_POLISH_EVIDENCE.md");
const packageJson = readRoot("package.json");

// ── Factories (résultats P4.5 typés) ──────────────────────────────────────────

function makePersistResult(
  status: RuntimeMissionDraftSafeApplyStatus,
  patch: Partial<RuntimeMissionDraftSafeApplyResult> = {}
): RuntimeMissionDraftSafeApplyResult {
  return {
    ok: true,
    status,
    local_saved: false,
    server_attempted: false,
    server_synced: false,
    db_write_performed: false,
    mission_created: false,
    execution_started: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    issues: [],
    recommendations: [],
    actions: [],
    attempted_at: "2026-06-09T10:00:00.000Z",
    ...patch,
  };
}

function makeRestoreResult(
  status: RuntimeMissionDraftSafeApplyStatus,
  patch: Partial<RuntimeMissionDraftSafeApplyRestoreResult> = {}
): RuntimeMissionDraftSafeApplyRestoreResult {
  return {
    ok: false,
    status,
    source: "none",
    draft: null,
    envelope: null,
    execution_started: false,
    attempted_at: "2026-06-09T10:00:00.000Z",
    ...patch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Restore UI model (statique)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Restore UI model", () => {
  it("1. runtime-mission-draft-restore-ui.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", modulePath))).toBe(true);
  });
  it("2. runtime-mission-draft-restore-ui-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", qaPath))).toBe(true);
  });
  it("3. contient buildRuntimeMissionDraftRestoreUiSnapshot", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftRestoreUiSnapshot");
  });
  it("4. contient buildRuntimeMissionDraftRestoreUiBadges", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftRestoreUiBadges");
  });
  it("5. contient buildRuntimeMissionDraftRestoreUiCards", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftRestoreUiCards");
  });
  it("6. contient buildRuntimeMissionDraftRestoreUiTimeline", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftRestoreUiTimeline");
  });
  it("7. contient buildRuntimeMissionDraftRestoreUiWarnings", () => {
    expect(moduleSrc).toContain("buildRuntimeMissionDraftRestoreUiWarnings");
  });
  it("8. contient getRuntimeMissionDraftRestoreUiStatusLabel", () => {
    expect(moduleSrc).toContain("getRuntimeMissionDraftRestoreUiStatusLabel");
  });
  it("9. contient getRuntimeMissionDraftRestoreUiSourceLabel", () => {
    expect(moduleSrc).toContain("getRuntimeMissionDraftRestoreUiSourceLabel");
  });
  it("10. mentionne local_only", () => expect(moduleSrc).toContain("local_only"));
  it("11. mentionne local_saved", () => expect(moduleSrc).toContain("local_saved"));
  it("12. mentionne local_restored", () => expect(moduleSrc).toContain("local_restored"));
  it("13. mentionne server_disabled", () => expect(moduleSrc).toContain("server_disabled"));
  it("14. mentionne server_synced", () => expect(moduleSrc).toContain("server_synced"));
  it("15. mentionne server_restored", () => expect(moduleSrc).toContain("server_restored"));
  it("16. mentionne auth_required", () => expect(moduleSrc).toContain("auth_required"));
  it("17. mentionne table_unavailable", () => expect(moduleSrc).toContain("table_unavailable"));
  it("18. mentionne rls_blocked", () => expect(moduleSrc).toContain("rls_blocked"));
  it("19. mentionne localStorage-first", () => expect(moduleSrc).toContain("localStorage-first"));
  it("20. mentionne Aucune mission réelle", () => expect(moduleSrc).toContain("Aucune mission réelle"));
  it("21. mentionne Aucun appel Pierre", () => expect(moduleSrc).toContain("Aucun appel Pierre"));
  it("22. mentionne Aucun appel IA", () => expect(moduleSrc).toContain("Aucun appel IA"));
  it("23. mentionne CloneVoice non actif", () => expect(moduleSrc).toContain("CloneVoice non actif"));
  it("24. mentionne Scale 80k non prouvé", () => expect(moduleSrc).toContain("Scale 80k non prouvé"));
  it("25. ne contient pas createClient", () => expect(moduleSrc).not.toContain("createClient"));
  it("26. ne contient pas .insert(", () => expect(moduleSrc).not.toContain(".insert("));
  it("27. ne contient pas .update(", () => expect(moduleSrc).not.toContain(".update("));
  it("28. ne contient pas .delete(", () => expect(moduleSrc).not.toContain(".delete("));
  it("29. ne contient pas .upsert(", () => expect(moduleSrc).not.toContain(".upsert("));
  it("30. ne contient pas fetch", () => expect(moduleSrc).not.toContain("fetch"));
  it("31. ne contient pas import src/lib/pierre", () => expect(moduleSrc).not.toContain("lib/pierre"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Restore UI QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Restore UI QA", () => {
  it("32. contient buildRuntimeMissionDraftRestoreUiQaChecklist", () => {
    expect(qaSrc).toContain("buildRuntimeMissionDraftRestoreUiQaChecklist");
  });
  it("33. contient restore_ui_model_exists", () => expect(qaSrc).toContain("restore_ui_model_exists"));
  it("34. contient profile_messages_restore_panel_visible", () =>
    expect(qaSrc).toContain("profile_messages_restore_panel_visible"));
  it("35. contient profile_messages_no_auto_restore_on_mount", () =>
    expect(qaSrc).toContain("profile_messages_no_auto_restore_on_mount"));
  it("36. contient no_db_write_added", () => expect(qaSrc).toContain("no_db_write_added"));
  it("37. contient no_api_post_added", () => expect(qaSrc).toContain("no_api_post_added"));
  it("38. contient no_pierre_engine_import", () => expect(qaSrc).toContain("no_pierre_engine_import"));
  it("39. contient no_cloneos_execution", () => expect(qaSrc).toContain("no_cloneos_execution"));
  it("40. contient no_clonevoice_activation", () => expect(qaSrc).toContain("no_clonevoice_activation"));
  it("41. contient public_launch_external_not_validated", () =>
    expect(qaSrc).toContain("public_launch_external_not_validated"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — /profile/messages
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — /profile/messages", () => {
  it("42. mentionne Statut brouillon runtime", () => expect(pageSrc).toContain("Statut brouillon runtime"));
  it("43. mentionne source effective", () => expect(pageSrc).toContain("source effective"));
  it("44. mentionne dernière sauvegarde locale", () =>
    expect(pageSrc.replace(/\s+/g, " ")).toContain("dernière sauvegarde locale"));
  it("45. mentionne dernière tentative serveur", () => expect(pageSrc.replace(/\s+/g, " ")).toContain("dernière tentative serveur"));
  it("46. mentionne fallback local", () => expect(pageSrc).toContain("fallback local"));
  it("47. mentionne activation P4.6", () => expect(pageSrc).toContain("activation P4.6"));
  it("48. mentionne La restauration ne crée pas de mission réelle", () =>
    expect(pageSrc.replace(/\s+/g, " ")).toContain("La restauration ne crée pas de mission réelle"));
  it("49. mentionne La sauvegarde serveur reste feature-flaggée", () =>
    expect(pageSrc.replace(/\s+/g, " ")).toContain("La sauvegarde serveur reste feature-flaggée"));
  it("50. mentionne Aucune exécution", () => expect(pageSrc).toContain("Aucune exécution"));
  it("51. mentionne Aucun appel Pierre", () => expect(pageSrc).toContain("Aucun appel Pierre"));
  it("52. utilise buildRuntimeMissionDraftRestoreUiSnapshot", () =>
    expect(pageSrc).toContain("buildRuntimeMissionDraftRestoreUiSnapshot"));
  it("53. ne contient pas createClient", () => expect(pageSrc).not.toContain("createClient"));
  it("54. ne contient pas import src/lib/pierre", () => expect(pageSrc).not.toContain("lib/pierre"));
  it("55. ne contient pas /api/pierre", () => expect(pageSrc).not.toContain("/api/pierre"));
  it("56. ne contient pas fetch direct vers mission-drafts", () => expect(pageSrc).not.toContain("mission-drafts"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Documentation", () => {
  const docLower = docSrc.toLowerCase();
  it("57. doc P4.7 existe", () => expect(docSrc.length).toBeGreaterThan(0));
  it("58. doc mentionne P4.7", () => expect(docSrc).toContain("4.7"));
  it("59. doc mentionne restore UI model", () => expect(docLower).toContain("restore ui model"));
  it("60. doc mentionne /profile/messages", () => expect(docSrc).toContain("/profile/messages"));
  it("61. doc mentionne serveur feature-flaggé", () => expect(docLower).toContain("serveur feature-flaggé"));
  it("62. doc mentionne P4.6", () => expect(docSrc).toContain("P4.6"));
  it("63. doc mentionne aucune mission réelle", () => expect(docLower).toContain("aucune mission réelle"));
  it("64. doc mentionne aucun appel Pierre", () => expect(docLower).toContain("aucun appel pierre"));
  it("65. doc mentionne aucun appel IA", () => expect(docLower).toContain("aucun appel ia"));
  it("66. doc mentionne CloneVoice non actif", () => expect(docLower).toContain("clonevoice non actif"));
  it("67. doc mentionne scale 80k non prouvé", () => expect(docLower).toContain("scale 80k non prouvé"));
  it("68. doc mentionne PHASE 4.8", () => expect(docSrc).toContain("PHASE 4.8"));
  it("69. doc ne contient pas la phrase anglaise de lancement public", () =>
    expect(docLower).not.toContain("public launch"));
  it("70. doc ne contient pas zéro erreur", () => expect(docLower).not.toContain("zéro erreur"));
  it("71. doc ne contient pas conformité garantie", () => expect(docLower).not.toContain("conformité garantie"));
  it("72. doc ne contient pas 80k scale proven", () => expect(docLower).not.toContain("80k scale proven"));
  it("73. doc ne contient pas 80k clients guaranteed", () => expect(docLower).not.toContain("80k clients guaranteed"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Evidence template
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Evidence template", () => {
  it("74. evidence template existe", () => expect(evidenceSrc.length).toBeGreaterThan(0));
  it("75. evidence mentionne Statut local visible", () => expect(evidenceSrc).toContain("Statut local visible"));
  it("76. evidence mentionne Statut serveur visible", () => expect(evidenceSrc).toContain("Statut serveur visible"));
  it("77. evidence mentionne Aucune mission réelle créée", () =>
    expect(evidenceSrc).toContain("Aucune mission réelle créée"));
  it("78. evidence mentionne Scale 80k non prouvé", () => expect(evidenceSrc).toContain("Scale 80k non prouvé"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Index exports + package script
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Index exports & package", () => {
  it("79. index exporte restore UI", () => expect(indexSrc).toContain("buildRuntimeMissionDraftRestoreUiSnapshot"));
  it("80. index exporte restore UI QA", () => expect(indexSrc).toContain("buildRuntimeMissionDraftRestoreUiQaChecklist"));
  it("81. package.json contient test:phase4-7", () => expect(packageJson).toContain("test:phase4-7"));
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Cascade encore câblée (still pass / not broken)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Cascade intacte", () => {
  const scripts = [
    "test:phase4-6", "test:phase4-5", "test:phase4-4", "test:phase4-3", "test:phase4-2", "test:phase4-1",
    "test:phase3-22", "test:phase3-21", "test:phase3-20", "test:phase3-19", "test:phase3-18", "test:phase3-17",
    "test:phase3-16", "test:phase3-15", "test:phase3-14", "test:phase3-13", "test:phase3-12", "test:phase3-11",
    "test:phase3-10", "test:phase3-9", "test:phase3-8", "test:phase3-7", "test:phase3-6", "test:phase3-5",
    "test:phase3-4", "test:phase3-3", "test:phase3-2", "test:phase3-1", "test:phase2-9", "test:tech11",
    "test:pfinal02",
  ];
  scripts.forEach((script, idx) => {
    it(`${82 + idx}. ${script} encore présent`, () => {
      expect(packageJson).toContain(`"${script}"`);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Tests fonctionnels
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 4.7 — Tests fonctionnels", () => {
  it("113. snapshot sans résultat → statut local sûr (local_only/pending)", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot();
    expect(["local_only", "pending"]).toContain(snap.status);
    expect(snap.execution_started).toBe(false);
    expect(snap.read_only).toBe(true);
  });

  it("114. snapshot avec persist local saved → local_saved", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot({
      lastPersistResult: makePersistResult("local_saved", { local_saved: true }),
    });
    expect(snap.status).toBe("local_saved");
  });

  it("115. snapshot avec restore local → local_restored", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot({
      lastRestoreResult: makeRestoreResult("restored_local", { source: "localstorage" }),
    });
    expect(snap.status).toBe("local_restored");
  });

  it("116. snapshot avec serveur désactivé → server_disabled", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot({
      lastPersistResult: makePersistResult("local_saved_server_disabled", { local_saved: true }),
      featureFlagEnabled: false,
    });
    expect(snap.status).toBe("server_disabled");
    expect(snap.manual_activation_required).toBe(true);
  });

  it("117. snapshot avec serveur synchronisé → server_synced", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot({
      lastPersistResult: makePersistResult("local_saved_server_synced", {
        local_saved: true,
        server_attempted: true,
        server_synced: true,
        db_write_performed: true,
      }),
      featureFlagEnabled: true,
    });
    expect(snap.status).toBe("server_synced");
    expect(snap.source).toBe("server");
  });

  it("118. badges incluent No-execution et Aucune mission réelle", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot();
    const labels = buildRuntimeMissionDraftRestoreUiBadges(snap).map((b) => b.label);
    expect(labels).toContain("No-execution");
    expect(labels).toContain("Aucune mission réelle");
  });

  it("119. timeline inclut local_saved et execution_not_started", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot({
      lastPersistResult: makePersistResult("local_saved", { local_saved: true }),
      localSavedAt: "2026-06-09T10:00:00.000Z",
    });
    const events = buildRuntimeMissionDraftRestoreUiTimeline(snap).map((t) => t.event);
    expect(events).toContain("local_saved");
    expect(events).toContain("execution_not_started");
  });

  it("120. warnings incluent l'activation manuelle quand serveur désactivé", () => {
    const snap = buildRuntimeMissionDraftRestoreUiSnapshot({
      lastPersistResult: makePersistResult("local_saved_server_disabled", { local_saved: true }),
      featureFlagEnabled: false,
    });
    const warnings = buildRuntimeMissionDraftRestoreUiWarnings(snap);
    expect(warnings.some((w) => /P4\.6/.test(w.detail) || /activation/i.test(w.detail))).toBe(true);
  });

  it("QA verdict ready quand tout pending", () => {
    const checklist = buildRuntimeMissionDraftRestoreUiQaChecklist();
    const summary = buildRuntimeMissionDraftRestoreUiQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready");
    expect(summary.ui_polish_only).toBe(true);
  });
});
