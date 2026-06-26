// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-restore-ui-phase3-18.test.ts
// PHASE 3.18 — Enterprise Footprint Server Restore UI Polish — Tests
//
// Vérifie :
//   - restore UI model (structure, invariants, labels)
//   - QA module
//   - intégration /profile/onboarding
//   - pages agents/messages/Pierre no-write
//   - documentation
//   - exports index.ts
//   - régression cascade PHASE 3.1 → 3.17

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");

function readSrc(relativePath: string): string {
  const full = resolve(ROOT, "src", relativePath);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

function readDocs(filename: string): string {
  const full = resolve(ROOT, "docs", filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Restore UI model
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.18 — Restore UI model", () => {
  const uiPath = "lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui.ts";
  const ui = readSrc(uiPath);

  it("1. enterprise-footprint-restore-ui.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", uiPath))).toBe(true);
  });

  it("2. enterprise-footprint-restore-ui-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui-qa.ts"))).toBe(true);
  });

  it("3. restore UI module contient buildEnterpriseFootprintRestoreUiSnapshot", () => {
    expect(ui).toContain("buildEnterpriseFootprintRestoreUiSnapshot");
  });

  it("4. restore UI module contient buildEnterpriseFootprintRestoreUiBadges", () => {
    expect(ui).toContain("buildEnterpriseFootprintRestoreUiBadges");
  });

  it("5. restore UI module contient buildEnterpriseFootprintRestoreUiCards", () => {
    expect(ui).toContain("buildEnterpriseFootprintRestoreUiCards");
  });

  it("6. restore UI module contient buildEnterpriseFootprintRestoreUiTimeline", () => {
    expect(ui).toContain("buildEnterpriseFootprintRestoreUiTimeline");
  });

  it("7. restore UI module contient getEnterpriseFootprintRestoreUiStatusLabel", () => {
    expect(ui).toContain("getEnterpriseFootprintRestoreUiStatusLabel");
  });

  it("8. restore UI module contient getEnterpriseFootprintRestoreUiSourceLabel", () => {
    expect(ui).toContain("getEnterpriseFootprintRestoreUiSourceLabel");
  });

  it("9. restore UI module mentionne localstorage", () => {
    expect(ui).toContain("localstorage");
  });

  it("10. restore UI module mentionne server", () => {
    expect(ui).toContain("server");
  });

  it("11. restore UI module mentionne server_disabled", () => {
    expect(ui).toContain("server_disabled");
  });

  it("12. restore UI module mentionne table_unavailable", () => {
    expect(ui).toContain("table_unavailable");
  });

  it("13. restore UI module mentionne rls_failed", () => {
    expect(ui).toContain("rls_failed");
  });

  it("14. restore UI module mentionne auth_required", () => {
    expect(ui).toContain("auth_required");
  });

  it("15. restore UI module mentionne validation_failed", () => {
    expect(ui).toContain("validation_failed");
  });

  it("16. restore UI module ne contient pas Supabase import", () => {
    expect(ui).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
    expect(ui).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
  });

  it("17. restore UI module ne contient pas insert/update/delete/upsert", () => {
    expect(ui).not.toMatch(/\.insert\s*\(/);
    expect(ui).not.toMatch(/\.update\s*\(/);
    expect(ui).not.toMatch(/\.delete\s*\(/);
    expect(ui).not.toMatch(/\.upsert\s*\(/);
  });

  it("18. restore UI module ne contient pas import src/lib/pierre", () => {
    expect(ui).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.18 — QA module", () => {
  const qa = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui-qa.ts");

  it("19. QA module contient buildEnterpriseFootprintRestoreUiQaChecklist", () => {
    expect(qa).toContain("buildEnterpriseFootprintRestoreUiQaChecklist");
  });

  it("20. QA module contient localstorage_fallback_visible", () => {
    expect(qa).toContain("localstorage_fallback_visible");
  });

  it("21. QA module contient server_disabled_visible", () => {
    expect(qa).toContain("server_disabled_visible");
  });

  it("22. QA module contient table_unavailable_visible", () => {
    expect(qa).toContain("table_unavailable_visible");
  });

  it("23. QA module contient rls_failed_visible", () => {
    expect(qa).toContain("rls_failed_visible");
  });

  it("24. QA module contient no_db_write_added", () => {
    expect(qa).toContain("no_db_write_added");
  });

  it("25. QA module contient no_api_post_added", () => {
    expect(qa).toContain("no_api_post_added");
  });

  it("26. QA module contient public_launch_external_not_validated", () => {
    expect(qa).toContain("public_launch_external_not_validated");
  });

  it("27. QA module ne contient pas Supabase createClient", () => {
    expect(qa).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("28. QA module ne contient pas insert/update/delete/upsert", () => {
    expect(qa).not.toMatch(/\.insert\s*\(/);
    expect(qa).not.toMatch(/\.update\s*\(/);
    expect(qa).not.toMatch(/\.delete\s*\(/);
    expect(qa).not.toMatch(/\.upsert\s*\(/);
  });

  it("29. QA module ne contient pas import src/lib/pierre", () => {
    expect(qa).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Intégration /profile/onboarding + pages no-write
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.18 — Intégration /profile/onboarding", () => {
  const onboarding = readSrc("app/profile/onboarding/page.tsx");

  it("30. /profile/onboarding mentionne Statut Empreinte", () => {
    expect(onboarding).toContain("Statut Empreinte");
  });

  it("31. /profile/onboarding mentionne localStorage reste le fallback actif", () => {
    expect(onboarding).toContain("localStorage reste le fallback actif");
  });

  it("32. /profile/onboarding mentionne Synchronisation serveur uniquement si activée", () => {
    expect(onboarding).toContain("Synchronisation serveur uniquement si activée");
  });

  it("33. /profile/onboarding mentionne Aucune action exécutée", () => {
    expect(onboarding).toContain("Aucune action exécutée");
  });

  it("34. /profile/onboarding mentionne SQL/RLS", () => {
    expect(onboarding).toContain("SQL/RLS");
  });

  it("35. /profile/onboarding utilise buildEnterpriseFootprintRestoreUiSnapshot", () => {
    expect(onboarding).toContain("buildEnterpriseFootprintRestoreUiSnapshot");
  });

  it("36. /profile/onboarding conserve persistEnterpriseFootprintWithFallback", () => {
    expect(onboarding).toContain("persistEnterpriseFootprintWithFallback");
  });

  it("37. /profile/onboarding ne contient pas insert/upsert direct enterprise footprint", () => {
    expect(onboarding).not.toMatch(/\.insert\s*\(/);
    expect(onboarding).not.toMatch(/\.upsert\s*\(/);
  });
});

describe("PHASE 3.18 — Pages no-write enterprise-footprint", () => {
  it("38. /profile/agents ne fait pas d'appel route enterprise-footprint", () => {
    const agents = readSrc("app/profile/agents/page.tsx");
    expect(agents).not.toContain("/api/profile/enterprise-footprint");
    expect(agents).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("39. /profile/messages ne fait pas d'appel route enterprise-footprint", () => {
    const messages = readSrc("app/profile/messages/page.tsx");
    expect(messages).not.toContain("/api/profile/enterprise-footprint");
    expect(messages).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("40. /agents/pierre/setup ne fait pas d'appel route enterprise-footprint", () => {
    const setup = readSrc("app/agents/pierre/setup/page.tsx");
    expect(setup).not.toContain("/api/profile/enterprise-footprint");
    expect(setup).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("41. /agents/pierre/use ne fait pas d'appel route enterprise-footprint", () => {
    const use = readSrc("app/agents/pierre/use/page.tsx");
    expect(use).not.toContain("/api/profile/enterprise-footprint");
    expect(use).not.toContain("persistEnterpriseFootprintWithFallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.18 — Documentation", () => {
  const docName = "PHASE_3_18_ENTERPRISE_FOOTPRINT_SERVER_RESTORE_UI_POLISH.md";
  const doc = readDocs(docName);

  it("42. doc PHASE_3_18 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("43. doc mentionne /profile/onboarding", () => {
    expect(doc).toContain("/profile/onboarding");
  });

  it("44. doc mentionne restore UI", () => {
    const hasRestoreUi =
      doc.toLowerCase().includes("restore ui") ||
      doc.toLowerCase().includes("restore/sync");
    expect(hasRestoreUi).toBe(true);
  });

  it("45. doc mentionne localStorage", () => {
    expect(doc).toContain("localStorage");
  });

  it("46. doc mentionne feature flag", () => {
    expect(doc.toLowerCase()).toContain("feature flag");
  });

  it("47. doc mentionne SQL/RLS", () => {
    expect(doc).toContain("SQL/RLS");
  });

  it("48. doc mentionne PHASE 3.19", () => {
    expect(doc).toContain("3.19");
  });

  it("49. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("50. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("51. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Exports index.ts
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.18 — Exports index.ts", () => {
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("52. index exporte restore UI (buildEnterpriseFootprintRestoreUiSnapshot)", () => {
    expect(index).toContain("buildEnterpriseFootprintRestoreUiSnapshot");
  });

  it("53. index exporte restore UI QA (buildEnterpriseFootprintRestoreUiQaChecklist)", () => {
    expect(index).toContain("buildEnterpriseFootprintRestoreUiQaChecklist");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildEnterpriseFootprintRestoreUiSnapshot,
  buildEnterpriseFootprintRestoreUiBadges,
  buildEnterpriseFootprintRestoreUiCards,
  buildEnterpriseFootprintRestoreUiTimeline,
  buildEnterpriseFootprintRestoreUiActions,
  getEnterpriseFootprintRestoreUiStatusLabel,
  getEnterpriseFootprintRestoreUiSourceLabel,
  getEnterpriseFootprintRestoreUiTone,
  explainEnterpriseFootprintRestoreUiStatus,
} from "@/lib/clonestore/enterprise-footprint";

import type {
  EnterpriseFootprintRestoreUiStatus,
} from "@/lib/clonestore/enterprise-footprint";

import {
  buildEnterpriseFootprintRestoreUiQaChecklist,
  buildEnterpriseFootprintRestoreUiQaVerdict,
  getEnterpriseFootprintRestoreUiBlockingSteps,
  summarizeEnterpriseFootprintRestoreUiQaVerdict,
} from "@/lib/clonestore/enterprise-footprint";

describe("PHASE 3.18 — Tests fonctionnels restore UI model", () => {
  it("snapshot empty quand aucun footprint et flag false", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: false,
      currentFootprint: null,
    });
    expect(snap.status).toBe("empty");
    expect(snap.read_only).toBe(true);
    expect(snap.fallback_local_active).toBe(true);
  });

  it("snapshot server_disabled quand footprint présent et flag false sans résultat", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: false,
      currentFootprint: { company_id: "c1", updated_at: new Date().toISOString() },
    });
    expect(snap.status).toBe("server_disabled");
  });

  it("snapshot server_synced depuis persist result synced", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: true,
      currentFootprint: { company_id: "c1" },
      lastPersistResult: {
        outcome: {
          status: "local_saved_server_synced",
          local_saved: true,
          server_attempted: true,
          server_synced: true,
          error_code: null,
          error_message: null,
        },
        ui_status: "server_synced",
        ui_label: "Empreinte synchronisée serveur",
        ui_detail: null,
      },
    });
    expect(snap.status).toBe("server_synced");
    expect(snap.source).toBe("server");
    expect(snap.server_synced).toBe(true);
  });

  it("snapshot server_unavailable + warning depuis table_unavailable", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: true,
      currentFootprint: { company_id: "c1" },
      lastPersistResult: {
        outcome: {
          status: "local_saved_table_unavailable",
          local_saved: true,
          server_attempted: true,
          server_synced: false,
          error_code: "TABLE_UNAVAILABLE",
          error_message: "Table absente.",
        },
        ui_status: "server_unavailable",
        ui_label: "Serveur indisponible — fallback local",
        ui_detail: "Table SQL absente.",
      },
    });
    expect(snap.status).toBe("server_unavailable");
    expect(snap.source).toBe("table_unavailable");
    expect(snap.warning).toBeTruthy();
  });

  it("snapshot rls_failed → warning RLS", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: true,
      currentFootprint: { company_id: "c1" },
      lastPersistResult: {
        outcome: {
          status: "local_saved_rls_failed",
          local_saved: true,
          server_attempted: true,
          server_synced: false,
          error_code: "RLS_FAILED",
          error_message: "RLS KO.",
        },
        ui_status: "server_unavailable",
        ui_label: "Serveur indisponible — fallback local",
        ui_detail: "RLS à vérifier.",
      },
    });
    expect(snap.source).toBe("rls_failed");
    expect(snap.warning?.toLowerCase()).toContain("rls");
  });

  it("tous les status labels sont non vides", () => {
    const statuses: EnterpriseFootprintRestoreUiStatus[] = [
      "local_only", "server_synced", "server_restored", "local_newer",
      "server_disabled", "server_unavailable", "auth_required",
      "validation_failed", "empty", "pending",
    ];
    statuses.forEach((s) => {
      expect(getEnterpriseFootprintRestoreUiStatusLabel(s).length).toBeGreaterThan(0);
    });
  });

  it("source labels distinguent local et serveur", () => {
    expect(getEnterpriseFootprintRestoreUiSourceLabel("localstorage")).toContain("localStorage");
    expect(getEnterpriseFootprintRestoreUiSourceLabel("server")).toBe("Serveur");
  });

  it("tone success pour server_synced, warning pour server_unavailable", () => {
    expect(getEnterpriseFootprintRestoreUiTone("server_synced")).toBe("success");
    expect(getEnterpriseFootprintRestoreUiTone("server_unavailable")).toBe("warning");
  });

  it("badges incluent fallback localStorage et aucune action", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: false,
      currentFootprint: { company_id: "c1" },
    });
    const badges = buildEnterpriseFootprintRestoreUiBadges(snap);
    const labels = badges.map((b) => b.label).join(" | ");
    expect(labels).toContain("localStorage reste le fallback actif");
    expect(labels).toContain("Aucune action exécutée");
  });

  it("cards retourne 4 cards", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: false,
      currentFootprint: { company_id: "c1" },
    });
    const cards = buildEnterpriseFootprintRestoreUiCards(snap);
    expect(cards.length).toBe(4);
  });

  it("timeline démarre toujours par la sauvegarde locale", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: true,
      currentFootprint: { company_id: "c1" },
    });
    const timeline = buildEnterpriseFootprintRestoreUiTimeline(snap);
    expect(timeline[0]?.id).toBe("tl-local");
  });

  it("actions incluent /profile/onboarding", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: false,
      currentFootprint: null,
    });
    const actions = buildEnterpriseFootprintRestoreUiActions(snap);
    const hasOnboarding = actions.some((a) => a.href === "/profile/onboarding");
    expect(hasOnboarding).toBe(true);
  });

  it("explain retourne un texte avec PHASE 3.18", () => {
    const snap = buildEnterpriseFootprintRestoreUiSnapshot({
      featureFlagEnabled: false,
      currentFootprint: { company_id: "c1" },
    });
    expect(explainEnterpriseFootprintRestoreUiStatus(snap)).toContain("PHASE 3.18");
  });
});

describe("PHASE 3.18 — Tests fonctionnels QA module", () => {
  it("QA checklist retourne 17 étapes", () => {
    const checklist = buildEnterpriseFootprintRestoreUiQaChecklist();
    expect(checklist.total).toBe(17);
    expect(checklist.phase).toBe("3.18");
  });

  it("toutes les étapes QA sont initialement pending", () => {
    const checklist = buildEnterpriseFootprintRestoreUiQaChecklist();
    expect(checklist.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("verdict toutes pending → pending", () => {
    const checklist = buildEnterpriseFootprintRestoreUiQaChecklist();
    const summary = buildEnterpriseFootprintRestoreUiQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("verdict blocking failed → blocked", () => {
    const checklist = buildEnterpriseFootprintRestoreUiQaChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "no_db_write_added" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildEnterpriseFootprintRestoreUiQaVerdict(withFail);
    expect(summary.verdict).toBe("blocked");
    expect(summary.safe_to_activate).toBe(false);
  });

  it("getBlockingSteps retourne uniquement les bloquantes", () => {
    const blocking = getEnterpriseFootprintRestoreUiBlockingSteps();
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("summarize contient PHASE 3.18", () => {
    const checklist = buildEnterpriseFootprintRestoreUiQaChecklist();
    const summary = buildEnterpriseFootprintRestoreUiQaVerdict(checklist.steps);
    expect(summarizeEnterpriseFootprintRestoreUiQaVerdict(summary)).toContain("PHASE 3.18");
  });
});
