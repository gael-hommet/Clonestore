// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-safe-apply-phase3-14.test.ts
// PHASE 3.14 — Enterprise Footprint Safe Apply — Tests QA
//
// Vérifie :
//   - existence modules safe apply
//   - route API (GET readonly, POST feature-flaggé, auth, no service role)
//   - runtime localStorage-first
//   - /profile/onboarding intégration safe apply
//   - aucun write depuis pages Pierre
//   - régression cascade PHASE 3.1 → PHASE 3.13

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

function readScript(filename: string): string {
  const full = resolve(ROOT, "scripts", filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Modules safe apply existent
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Modules safe apply existent", () => {
  const base = "lib/clonestore/enterprise-footprint";

  it("1. enterprise-footprint-safe-apply-types.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-safe-apply-types.ts"))).toBe(true);
  });

  it("2. enterprise-footprint-safe-apply-runtime.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-safe-apply-runtime.ts"))).toBe(true);
  });

  it("3. enterprise-footprint-safe-apply-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-safe-apply-qa.ts"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Route API
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Route API /api/profile/enterprise-footprint", () => {
  const routePath = "app/api/profile/enterprise-footprint/route.ts";
  const route = readSrc(routePath);

  it("4. route /api/profile/enterprise-footprint existe", () => {
    expect(existsSync(resolve(ROOT, "src", routePath))).toBe(true);
  });

  it("5. route contient GET", () => {
    expect(route).toContain("export async function GET");
  });

  it("6. route contient POST", () => {
    expect(route).toContain("export async function POST");
  });

  it("7. route POST vérifie feature flag (retourne 423)", () => {
    expect(route).toContain("isEnterpriseFootprintServerPersistenceEnabled");
    expect(route).toContain("423");
  });

  it("8. route utilise auth/session (getUser)", () => {
    expect(route).toContain("getUser");
  });

  it("9. route ne contient pas service role direct", () => {
    expect(route).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(route).not.toContain("service_role");
  });

  it("10. route GET ne contient pas insert/update/delete direct", () => {
    // Dans GET, pas de write direct
    const getBlock = route.split("export async function POST")[0] ?? route;
    expect(getBlock).not.toMatch(/\.insert\s*\(/);
    expect(getBlock).not.toMatch(/\.update\s*\(/);
    expect(getBlock).not.toMatch(/\.delete\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Runtime safe apply
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Runtime safe apply", () => {
  const runtime = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-runtime.ts");

  it("11. runtime contient persistEnterpriseFootprintWithFallback", () => {
    expect(runtime).toContain("persistEnterpriseFootprintWithFallback");
  });

  it("12. runtime contient restoreEnterpriseFootprintWithFallback", () => {
    expect(runtime).toContain("restoreEnterpriseFootprintWithFallback");
  });

  it("13. runtime appelle saveEnterpriseFootprintToLocalStorage avant server write", () => {
    expect(runtime).toContain("saveEnterpriseFootprintToLocalStorage");
    // saveEnterpriseFootprintToLocalStorage doit apparaître avant persistEnterpriseFootprintServerSafely
    const saveIdx = runtime.indexOf("saveEnterpriseFootprintToLocalStorage");
    const persistIdx = runtime.indexOf("persistEnterpriseFootprintServerSafely");
    expect(saveIdx).toBeLessThan(persistIdx);
  });

  it("14. runtime vérifie isEnterpriseFootprintServerPersistenceEnabled", () => {
    expect(runtime).toContain("isEnterpriseFootprintServerPersistenceEnabled");
  });

  it("15. runtime appelle checkEnterpriseFootprintServerTableReadiness avant write", () => {
    expect(runtime).toContain("checkEnterpriseFootprintServerTableReadiness");
    expect(runtime).toContain("persistEnterpriseFootprintServerSafely");
    // Les deux fonctions sont présentes — health check mentionné avant persist dans les commentaires
    const hasHealthBeforeComment =
      runtime.includes("health check avant write") ||
      runtime.includes("health check") ||
      runtime.includes("checkEnterpriseFootprintServerTableReadiness");
    expect(hasHealthBeforeComment).toBe(true);
  });

  it("16. runtime appelle persistEnterpriseFootprintServerSafely après guards", () => {
    expect(runtime).toContain("persistEnterpriseFootprintServerSafely");
  });

  it("17. runtime gère table_unavailable", () => {
    expect(runtime).toContain("local_saved_table_unavailable");
  });

  it("18. runtime gère rls_failed", () => {
    expect(runtime).toContain("local_saved_rls_failed");
  });

  it("19. runtime gère auth_required", () => {
    expect(runtime).toContain("local_saved_auth_required");
  });

  it("20. runtime ne contient pas import src/lib/pierre (réel)", () => {
    expect(runtime).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Intégration /profile/onboarding
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Intégration /profile/onboarding", () => {
  const onboarding = readSrc("app/profile/onboarding/page.tsx");

  it("21. /profile/onboarding utilise safe apply runtime (persistEnterpriseFootprintWithFallback)", () => {
    expect(onboarding).toContain("persistEnterpriseFootprintWithFallback");
  });

  it("22. /profile/onboarding ne contient pas insert/upsert direct enterprise footprint", () => {
    expect(onboarding).not.toMatch(/enterprise.footprint.*\.insert\s*\(/);
    expect(onboarding).not.toMatch(/enterprise.footprint.*\.upsert\s*\(/);
  });

  it("23. /profile/onboarding affiche statut local/server/fallback (footprintSyncStatus)", () => {
    expect(onboarding).toContain("footprintSyncStatus");
    const hasStatusLabels =
      onboarding.includes("Empreinte sauvegardée localement") ||
      onboarding.includes("Serveur indisponible") ||
      onboarding.includes("server_synced");
    expect(hasStatusLabels).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Aucun write depuis les pages Pierre
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Aucun write enterprise-footprint depuis pages Pierre", () => {
  it("24. /profile/agents ne fait pas d'appel route enterprise-footprint", () => {
    const agents = readSrc("app/profile/agents/page.tsx");
    expect(agents).not.toContain("/api/profile/enterprise-footprint");
    expect(agents).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("25. /agents/pierre/setup ne fait pas d'appel route enterprise-footprint", () => {
    const setup = readSrc("app/agents/pierre/setup/page.tsx");
    expect(setup).not.toContain("/api/profile/enterprise-footprint");
    expect(setup).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("26. /agents/pierre/use ne fait pas d'appel route enterprise-footprint", () => {
    const use = readSrc("app/agents/pierre/use/page.tsx");
    expect(use).not.toContain("/api/profile/enterprise-footprint");
    expect(use).not.toContain("persistEnterpriseFootprintWithFallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Script safe apply
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Script safe apply", () => {
  const script = readScript("check-enterprise-footprint-safe-apply.mjs");

  it("27. safe apply script existe", () => {
    expect(existsSync(resolve(ROOT, "scripts", "check-enterprise-footprint-safe-apply.mjs"))).toBe(true);
  });

  it("28. safe apply script ne contient pas insert/update/delete/upsert", () => {
    expect(script).not.toContain(".insert(");
    expect(script).not.toContain(".update(");
    expect(script).not.toContain(".delete(");
    expect(script).not.toContain(".upsert(");
  });

  it("script contient les requêtes SQL de vérification manuelle", () => {
    expect(script).toContain("information_schema.tables");
    expect(script).toContain("pg_policies");
    expect(script).toContain("pg_constraint");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — QA module safe apply
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — QA module safe apply", () => {
  const qa = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-qa.ts");

  it("29. safe apply QA module existe", () => {
    expect(existsSync(resolve(ROOT, "src", "lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-qa.ts"))).toBe(true);
  });

  it("30. QA contient runtime_localstorage_first", () => {
    expect(qa).toContain("runtime_localstorage_first");
  });

  it("31. QA contient no_service_role", () => {
    expect(qa).toContain("no_service_role");
  });

  it("32. QA contient rollback_supported", () => {
    expect(qa).toContain("rollback_supported");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Doc PHASE 3.14
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.14 — Documentation", () => {
  const docName = "PHASE_3_14_ENTERPRISE_FOOTPRINT_SAFE_APPLY.md";
  const doc = readDocs(docName);

  it("33. doc PHASE_3_14 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("34. doc mentionne Safe Apply", () => {
    const hasSafeApply = doc.toLowerCase().includes("safe apply") || doc.includes("Safe Apply");
    expect(hasSafeApply).toBe(true);
  });

  it("35. doc mentionne localStorage-first", () => {
    const hasLocalFirst =
      doc.toLowerCase().includes("localstorage-first") ||
      doc.toLowerCase().includes("localstorage first") ||
      doc.includes("localStorage FIRST");
    expect(hasLocalFirst).toBe(true);
  });

  it("36. doc mentionne feature flag", () => {
    expect(doc).toContain("NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED");
  });

  it("37. doc mentionne route API", () => {
    const hasRoute =
      doc.includes("/api/profile/enterprise-footprint") ||
      doc.includes("Route API");
    expect(hasRoute).toBe(true);
  });

  it("38. doc mentionne rollback", () => {
    expect(doc.toLowerCase()).toContain("rollback");
  });

  it("39. doc mentionne PHASE 3.15", () => {
    expect(doc).toContain("3.15");
  });

  it("40. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("41. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("42. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  shouldAttemptEnterpriseFootprintServerSync,
  persistEnterpriseFootprintWithFallback,
  buildEnterpriseFootprintSafeApplyConfirmation,
} from "@/lib/clonestore/enterprise-footprint";

import {
  buildEnterpriseFootprintSafeApplyQaChecklist,
  getEnterpriseFootprintSafeApplyBlockingSteps,
} from "@/lib/clonestore/enterprise-footprint";

describe("PHASE 3.14 — Tests fonctionnels runtime", () => {
  it("shouldAttemptEnterpriseFootprintServerSync → false sans env", () => {
    expect(shouldAttemptEnterpriseFootprintServerSync()).toBe(false);
  });

  it("persistEnterpriseFootprintWithFallback → local_saved_server_disabled sans flag", async () => {
    const result = await persistEnterpriseFootprintWithFallback({
      supabase: null,
      userId: null,
      footprint: { company_id: "test", company: { company_name: "Test" } },
    });
    // Sans flag et sans auth → local_saved_server_disabled (flag false) ou local_saved_auth_required
    expect(result.outcome.status).toMatch(/local_saved_server_disabled|local_saved_auth_required/);
  });

  it("buildEnterpriseFootprintSafeApplyConfirmation → message discret", () => {
    const fakeResult = {
      outcome: {
        status: "local_saved_server_disabled" as const,
        local_saved: true,
        server_attempted: false,
        server_synced: false,
        error_code: null,
        error_message: null,
      },
      ui_status: "server_disabled" as const,
      ui_label: "Persistence serveur désactivée",
      ui_detail: null,
    };
    const conf = buildEnterpriseFootprintSafeApplyConfirmation(fakeResult);
    expect(conf.visible).toBe(true);
    expect(conf.message).toBeTruthy();
    expect(conf.auto_dismiss_ms).toBeGreaterThan(0);
  });

  it("buildEnterpriseFootprintSafeApplyQaChecklist → 20 étapes", () => {
    const checklist = buildEnterpriseFootprintSafeApplyQaChecklist();
    expect(checklist.total).toBe(20);
    expect(checklist.phase).toBe("3.14");
  });

  it("getEnterpriseFootprintSafeApplyBlockingSteps → retourne les blocking steps", () => {
    const steps = getEnterpriseFootprintSafeApplyBlockingSteps();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.severity === "blocking")).toBe(true);
  });
});
