// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-server-persistence-design-phase3-13.test.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Tests QA
//
// Vérifie :
//   - existence et contenu de tous les modules serveur
//   - SQL draft et RLS
//   - feature flag default false
//   - pas de write depuis UI
//   - cascade régression complète
//
// Aucune migration appliquée. Aucun appel réseau. Aucun DB write. Aucun runtime Pierre.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");

function readSrc(relativePath: string): string {
  const full = resolve(ROOT, "src", relativePath);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

function readSql(filename: string): string {
  const full = resolve(ROOT, "supabase/sql", filename);
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
// BLOC 1 — Existence des modules serveur
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Modules serveur existent", () => {
  const base = "lib/clonestore/enterprise-footprint";

  it("1. enterprise-footprint-server-types.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-types.ts"))).toBe(true);
  });

  it("2. enterprise-footprint-server-schema.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-schema.ts"))).toBe(true);
  });

  it("3. enterprise-footprint-server-flags.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-flags.ts"))).toBe(true);
  });

  it("4. enterprise-footprint-server-mappers.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-mappers.ts"))).toBe(true);
  });

  it("5. enterprise-footprint-server-validation.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-validation.ts"))).toBe(true);
  });

  it("6. enterprise-footprint-server-readonly-client.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-readonly-client.ts"))).toBe(true);
  });

  it("7. enterprise-footprint-server-storage.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-storage.ts"))).toBe(true);
  });

  it("8. enterprise-footprint-server-health.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", base, "enterprise-footprint-server-health.ts"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — SQL draft
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — SQL Draft", () => {
  const sqlFile = "PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql";
  const sql = readSql(sqlFile);

  it("9. SQL draft existe", () => {
    expect(existsSync(resolve(ROOT, "supabase/sql", sqlFile))).toBe(true);
  });

  it("10. SQL draft contient clonestore_enterprise_footprints", () => {
    expect(sql).toContain("clonestore_enterprise_footprints");
  });

  it("11. SQL draft enable row level security", () => {
    expect(sql.toLowerCase()).toContain("enable row level security");
  });

  it("12. SQL draft contient select own policy", () => {
    expect(sql).toContain("select_own_enterprise_footprint");
  });

  it("13. SQL draft contient insert own policy", () => {
    expect(sql).toContain("insert_own_enterprise_footprint");
  });

  it("14. SQL draft contient update own policy", () => {
    expect(sql).toContain("update_own_enterprise_footprint");
  });

  it("15. SQL draft ne contient pas de delete policy", () => {
    expect(sql.toLowerCase()).not.toContain("delete_own_enterprise_footprint");
    expect(sql.toLowerCase()).not.toMatch(/create policy.*for delete/);
  });

  it("16. SQL draft n'utilise pas ADD CONSTRAINT IF NOT EXISTS", () => {
    expect(sql.toLowerCase()).not.toContain("add constraint if not exists");
  });

  it("17. SQL draft utilise DO $$", () => {
    expect(sql).toContain("DO $$");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Schema et flags
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Schema et flags", () => {
  const schema = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-schema.ts");
  const flags = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-flags.ts");

  it("18. schema contient ENTERPRISE_FOOTPRINT_SERVER_TABLE", () => {
    expect(schema).toContain("ENTERPRISE_FOOTPRINT_SERVER_TABLE");
  });

  it("19. flags contiennent NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED", () => {
    expect(flags).toContain("NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED");
  });

  it("20. flags default false / env-gated (pas de hardcode true)", () => {
    expect(flags).not.toContain('return true');
    expect(flags).toContain('=== "true"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Mappers
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Mappers serveur", () => {
  const mappers = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-mappers.ts");

  it("21. mappers contiennent mapEnterpriseFootprintToServerPayload", () => {
    expect(mappers).toContain("mapEnterpriseFootprintToServerPayload");
  });

  it("22. mappers contiennent mapEnterpriseFootprintServerRowToFootprint", () => {
    expect(mappers).toContain("mapEnterpriseFootprintServerRowToFootprint");
  });

  it("23. mappers contiennent mergeEnterpriseFootprintLocalAndServer", () => {
    expect(mappers).toContain("mergeEnterpriseFootprintLocalAndServer");
  });

  it("mappers ne contiennent pas d'import src/lib/pierre", () => {
    expect(mappers).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Validation serveur", () => {
  const validation = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-validation.ts");

  it("24. validation interdit sk_live_", () => {
    expect(validation).toContain("sk_live_");
  });

  it("25. validation interdit whsec_", () => {
    expect(validation).toContain("whsec_");
  });

  it("26. validation interdit OPENAI_API_KEY", () => {
    expect(validation).toContain("OPENAI_API_KEY");
  });

  it("27. validation interdit ANTHROPIC_API_KEY", () => {
    expect(validation).toContain("ANTHROPIC_API_KEY");
  });

  it("28. validation interdit phrase de lancement public", () => {
    expect(validation).toContain("public launch go");
  });

  it("29. validation interdit 'zéro erreur'", () => {
    expect(validation).toContain("zéro erreur");
  });

  it("30. validation interdit 'conformité garantie'", () => {
    expect(validation).toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Read-only client
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Read-only client", () => {
  const client = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-readonly-client.ts");

  it("31. readonly client ne contient pas insert/update/delete/upsert", () => {
    expect(client).not.toMatch(/\.insert\s*\(/);
    expect(client).not.toMatch(/\.update\s*\(/);
    expect(client).not.toMatch(/\.delete\s*\(/);
    expect(client).not.toMatch(/\.upsert\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Storage design
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Storage design", () => {
  const storage = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-storage.ts");

  it("32. storage est feature-flaggé (isEnterpriseFootprintServerPersistenceEnabled)", () => {
    expect(storage).toContain("isEnterpriseFootprintServerPersistenceEnabled");
  });

  it("33. storage ne contient pas service role", () => {
    expect(storage.toLowerCase()).not.toContain("service_role");
    expect(storage.toLowerCase()).not.toContain("serviceroleclient");
    expect(storage).not.toContain("SERVICE_ROLE");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — Health check
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Health check", () => {
  const health = readSrc("lib/clonestore/enterprise-footprint/enterprise-footprint-server-health.ts");

  it("34. health check utilise select", () => {
    expect(health).toContain(".select(");
  });

  it("35. health check ne contient pas insert/update/delete/upsert", () => {
    expect(health).not.toMatch(/\.insert\s*\(/);
    expect(health).not.toMatch(/\.update\s*\(/);
    expect(health).not.toMatch(/\.delete\s*\(/);
    expect(health).not.toMatch(/\.upsert\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — Script readiness
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Script readiness", () => {
  const script = readScript("check-enterprise-footprint-server-readiness.mjs");

  it("36. script readiness existe", () => {
    expect(existsSync(resolve(ROOT, "scripts", "check-enterprise-footprint-server-readiness.mjs"))).toBe(true);
  });

  it("37. script readiness ne contient pas insert/update/delete/upsert", () => {
    expect(script).not.toContain(".insert(");
    expect(script).not.toContain(".update(");
    expect(script).not.toContain(".delete(");
    expect(script).not.toContain(".upsert(");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Index exports
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Index exports modules serveur", () => {
  const index = readSrc("lib/clonestore/enterprise-footprint/index.ts");

  it("38. index exports server modules", () => {
    expect(index).toContain("enterprise-footprint-server-types");
    expect(index).toContain("enterprise-footprint-server-schema");
    expect(index).toContain("enterprise-footprint-server-flags");
    expect(index).toContain("enterprise-footprint-server-mappers");
    expect(index).toContain("enterprise-footprint-server-validation");
    expect(index).toContain("enterprise-footprint-server-readonly-client");
    expect(index).toContain("enterprise-footprint-server-storage");
    expect(index).toContain("enterprise-footprint-server-health");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 11 — Aucune page UI ne fait de write serveur
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Aucun write serveur depuis UI", () => {
  const onboarding = readSrc("app/profile/onboarding/page.tsx");
  const agents = readSrc("app/profile/agents/page.tsx");
  const setup = readSrc("app/agents/pierre/setup/page.tsx");
  const use = readSrc("app/agents/pierre/use/page.tsx");

  it("39. aucune page UI n'importe persistEnterpriseFootprintServerSafely", () => {
    expect(onboarding).not.toContain("persistEnterpriseFootprintServerSafely");
    expect(agents).not.toContain("persistEnterpriseFootprintServerSafely");
    expect(setup).not.toContain("persistEnterpriseFootprintServerSafely");
    expect(use).not.toContain("persistEnterpriseFootprintServerSafely");
  });

  it("40. /profile/onboarding ne fait pas d'appel route enterprise-footprint", () => {
    expect(onboarding).not.toContain("/api/profile/enterprise-footprint");
  });

  it("41. /profile/agents ne fait pas d'appel route enterprise-footprint", () => {
    expect(agents).not.toContain("/api/profile/enterprise-footprint");
  });

  it("42. /agents/pierre/setup ne fait pas d'appel route enterprise-footprint", () => {
    expect(setup).not.toContain("/api/profile/enterprise-footprint");
  });

  it("43. /agents/pierre/use ne fait pas d'appel route enterprise-footprint", () => {
    expect(use).not.toContain("/api/profile/enterprise-footprint");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 12 — Doc PHASE 3.13
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.13 — Documentation", () => {
  const docName = "PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_DESIGN.md";
  const doc = readDocs(docName);

  it("44. doc PHASE_3_13 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("45. doc mentionne SQL draft", () => {
    const hasSqlDraft = doc.toLowerCase().includes("sql draft") || doc.includes("PHASE_3_13");
    expect(hasSqlDraft).toBe(true);
  });

  it("46. doc mentionne RLS", () => {
    expect(doc).toContain("RLS");
  });

  it("47. doc mentionne feature flag", () => {
    const hasFlag =
      doc.toLowerCase().includes("feature flag") ||
      doc.includes("NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED");
    expect(hasFlag).toBe(true);
  });

  it("48. doc mentionne health check", () => {
    const hasHealth =
      doc.toLowerCase().includes("health check") ||
      doc.includes("checkEnterpriseFootprintServerTableReadiness");
    expect(hasHealth).toBe(true);
  });

  it("49. doc mentionne PHASE 3.14", () => {
    expect(doc).toContain("3.14");
  });

  it("50. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("51. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("52. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 13 — Tests fonctionnels des modules (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  ENTERPRISE_FOOTPRINT_SERVER_TABLE,
  buildEnterpriseFootprintServerExpectedColumns,
  buildEnterpriseFootprintServerRlsPolicyNames,
} from "@/lib/clonestore/enterprise-footprint";

import {
  isEnterpriseFootprintServerPersistenceEnabled,
  getEnterpriseFootprintServerPersistenceMode,
} from "@/lib/clonestore/enterprise-footprint";

import {
  detectUnsafeEnterpriseFootprintServerText,
  validateEnterpriseFootprintServerPayload,
  sanitizeEnterpriseFootprintServerPayload,
} from "@/lib/clonestore/enterprise-footprint";

import {
  mapEnterpriseFootprintServerReadResult,
  sortEnterpriseFootprintServerRows,
} from "@/lib/clonestore/enterprise-footprint";

import {
  canPersistEnterpriseFootprintServer,
} from "@/lib/clonestore/enterprise-footprint";

import type { EnterpriseFootprintServerPayload } from "@/lib/clonestore/enterprise-footprint";

describe("PHASE 3.13 — Tests fonctionnels modules serveur", () => {
  it("ENTERPRISE_FOOTPRINT_SERVER_TABLE = 'clonestore_enterprise_footprints'", () => {
    expect(ENTERPRISE_FOOTPRINT_SERVER_TABLE).toBe("clonestore_enterprise_footprints");
  });

  it("buildEnterpriseFootprintServerExpectedColumns retourne les colonnes attendues", () => {
    const cols = buildEnterpriseFootprintServerExpectedColumns();
    expect(cols).toContain("id");
    expect(cols).toContain("user_id");
    expect(cols).toContain("company_id");
    expect(cols).toContain("coverage_score");
    expect(cols).toContain("readiness_score");
  });

  it("buildEnterpriseFootprintServerRlsPolicyNames retourne les policies attendues", () => {
    const policies = buildEnterpriseFootprintServerRlsPolicyNames();
    expect(policies).toContain("select_own_enterprise_footprint");
    expect(policies).toContain("insert_own_enterprise_footprint");
    expect(policies).toContain("update_own_enterprise_footprint");
    expect(policies).not.toContain("delete");
  });

  it("isEnterpriseFootprintServerPersistenceEnabled → false sans env", () => {
    // Sans variable d'env, doit retourner false
    expect(isEnterpriseFootprintServerPersistenceEnabled()).toBe(false);
  });

  it("getEnterpriseFootprintServerPersistenceMode → 'server_draft' sans env", () => {
    expect(getEnterpriseFootprintServerPersistenceMode()).toBe("server_draft");
  });

  it("canPersistEnterpriseFootprintServer → false sans env", () => {
    expect(canPersistEnterpriseFootprintServer()).toBe(false);
  });

  it("detectUnsafeEnterpriseFootprintServerText → safe: true pour texte normal", () => {
    const result = detectUnsafeEnterpriseFootprintServerText("Bienvenue chez CloneStore.");
    expect(result.safe).toBe(true);
  });

  it("detectUnsafeEnterpriseFootprintServerText → safe: false pour sk_live_", () => {
    const result = detectUnsafeEnterpriseFootprintServerText("ma clé sk_live_xxx");
    expect(result.safe).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("validateEnterpriseFootprintServerPayload → refuse payload null", () => {
    const result = validateEnterpriseFootprintServerPayload(null);
    expect(result.valid).toBe(false);
  });

  it("validateEnterpriseFootprintServerPayload → refuse user_id vide", () => {
    const payload: EnterpriseFootprintServerPayload = {
      user_id: "",
      company_id: "acme",
      footprint: {} as never,
      source: "local_snapshot",
      local_updated_at: null,
    };
    const result = validateEnterpriseFootprintServerPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("user_id"))).toBe(true);
  });

  it("sanitizeEnterpriseFootprintServerPayload → trim user_id et company_id", () => {
    const payload: EnterpriseFootprintServerPayload = {
      user_id: "  uuid-123  ",
      company_id: "  acme  ",
      footprint: {} as never,
      source: "local_snapshot",
      local_updated_at: null,
    };
    const result = sanitizeEnterpriseFootprintServerPayload(payload);
    expect(result.user_id).toBe("uuid-123");
    expect(result.company_id).toBe("acme");
  });

  it("mapEnterpriseFootprintServerReadResult → ok: true avec rows vides", () => {
    const result = mapEnterpriseFootprintServerReadResult([]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.latest).toBeNull();
  });

  it("sortEnterpriseFootprintServerRows → tri par updated_at desc", () => {
    const rows = [
      { id: "a", updated_at: "2024-01-01T00:00:00Z" } as never,
      { id: "b", updated_at: "2024-06-01T00:00:00Z" } as never,
      { id: "c", updated_at: "2024-03-01T00:00:00Z" } as never,
    ];
    const sorted = sortEnterpriseFootprintServerRows(rows);
    expect(sorted[0].id).toBe("b"); // plus récent en premier
    expect(sorted[2].id).toBe("a");
  });
});
