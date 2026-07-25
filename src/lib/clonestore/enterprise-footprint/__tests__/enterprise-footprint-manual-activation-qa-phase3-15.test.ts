// src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-manual-activation-qa-phase3-15.test.ts
// PHASE 3.15 — Enterprise Footprint Manual Activation QA — Tests
//
// Vérifie :
//   - module manual activation QA (structure, invariants, checklist)
//   - script de guidance read-only
//   - evidence template
//   - documentation
//   - intégration /profile/onboarding préservée
//   - aucun write depuis pages agents/Pierre
//   - régression cascade PHASE 3.1 → 3.14

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

function readTemplate(filename: string): string {
  const full = resolve(ROOT, "docs/templates", filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

function readScript(filename: string): string {
  const full = resolve(ROOT, "scripts", filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Module manual activation QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.15 — Module Manual Activation QA", () => {
  const modulePath = "lib/clonestore/enterprise-footprint/enterprise-footprint-manual-activation-qa.ts";
  const mod = readSrc(modulePath);

  it("1. enterprise-footprint-manual-activation-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", modulePath))).toBe(true);
  });

  it("2. module contient buildEnterpriseFootprintManualActivationChecklist", () => {
    expect(mod).toContain("buildEnterpriseFootprintManualActivationChecklist");
  });

  it("3. module contient buildEnterpriseFootprintManualActivationVerdict", () => {
    expect(mod).toContain("buildEnterpriseFootprintManualActivationVerdict");
  });

  it("4. module contient buildEnterpriseFootprintManualActivationEvidenceTemplate", () => {
    expect(mod).toContain("buildEnterpriseFootprintManualActivationEvidenceTemplate");
  });

  it("5. module contient validateEnterpriseFootprintManualActivationEvidencePack", () => {
    expect(mod).toContain("validateEnterpriseFootprintManualActivationEvidencePack");
  });

  it("6. checklist contient sql_file_reviewed", () => {
    expect(mod).toContain("sql_file_reviewed");
  });

  it("7. checklist contient sql_applied_manually", () => {
    expect(mod).toContain("sql_applied_manually");
  });

  it("8. checklist contient table_exists", () => {
    expect(mod).toContain("table_exists");
  });

  it("9. checklist contient rls_enabled", () => {
    expect(mod).toContain("rls_enabled");
  });

  it("10. checklist contient select_policy_exists", () => {
    expect(mod).toContain("select_policy_exists");
  });

  it("11. checklist contient insert_policy_exists", () => {
    expect(mod).toContain("insert_policy_exists");
  });

  it("12. checklist contient update_policy_exists", () => {
    expect(mod).toContain("update_policy_exists");
  });

  it("13. checklist contient no_delete_policy", () => {
    expect(mod).toContain("no_delete_policy");
  });

  it("14. checklist contient constraints_verified", () => {
    expect(mod).toContain("constraints_verified");
  });

  it("15. checklist contient flag_disabled_before_test", () => {
    expect(mod).toContain("flag_disabled_before_test");
  });

  it("16. checklist contient flag_enabled_for_local_test", () => {
    expect(mod).toContain("flag_enabled_for_local_test");
  });

  it("17. checklist contient onboarding_server_sync_works", () => {
    expect(mod).toContain("onboarding_server_sync_works");
  });

  it("18. checklist contient api_get_returns_server_snapshot", () => {
    expect(mod).toContain("api_get_returns_server_snapshot");
  });

  it("19. checklist contient refresh_restores_latest_snapshot", () => {
    expect(mod).toContain("refresh_restores_latest_snapshot");
  });

  it("20. checklist contient rollback_flag_disabled", () => {
    expect(mod).toContain("rollback_flag_disabled");
  });

  it("21. checklist contient localstorage_still_works_after_rollback", () => {
    expect(mod).toContain("localstorage_still_works_after_rollback");
  });

  it("22. checklist contient public_launch_external_not_validated", () => {
    expect(mod).toContain("public_launch_external_not_validated");
  });

  it("23. module ne contient pas Supabase createClient (réel)", () => {
    expect(mod).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(mod).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("24. module ne contient pas insert/update/delete/upsert", () => {
    expect(mod).not.toMatch(/\.insert\s*\(/);
    expect(mod).not.toMatch(/\.update\s*\(/);
    expect(mod).not.toMatch(/\.delete\s*\(/);
    expect(mod).not.toMatch(/\.upsert\s*\(/);
  });

  it("25. module ne contient pas import src/lib/pierre (réel)", () => {
    expect(mod).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Script manual activation QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.15 — Script manual activation QA", () => {
  const script = readScript("check-enterprise-footprint-manual-activation-qa.mjs");

  it("26. script check-enterprise-footprint-manual-activation-qa.mjs existe", () => {
    expect(existsSync(resolve(ROOT, "scripts", "check-enterprise-footprint-manual-activation-qa.mjs"))).toBe(true);
  });

  it("27. script contient information_schema.tables", () => {
    expect(script).toContain("information_schema.tables");
  });

  it("28. script contient pg_policies", () => {
    expect(script).toContain("pg_policies");
  });

  it("29. script contient pg_constraint", () => {
    expect(script).toContain("pg_constraint");
  });

  it("30. script contient check:enterprise-footprint-safe-apply", () => {
    expect(script).toContain("check:enterprise-footprint-safe-apply");
  });

  it("31. script contient test:phase3-15", () => {
    expect(script).toContain("test:phase3-15");
  });

  it("32. script ne contient pas .insert(", () => {
    expect(script).not.toContain(".insert(");
  });

  it("33. script ne contient pas .update(", () => {
    expect(script).not.toContain(".update(");
  });

  it("34. script ne contient pas .delete(", () => {
    expect(script).not.toContain(".delete(");
  });

  it("35. script ne contient pas .upsert(", () => {
    expect(script).not.toContain(".upsert(");
  });

  it("36. script ne contient pas fetch POST automatique", () => {
    expect(script).not.toMatch(/fetch\s*\(.*method.*POST/);
    expect(script).not.toMatch(/fetch\s*\(.*POST/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Evidence template
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.15 — Evidence template", () => {
  const templateName = "PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_EVIDENCE.md";
  const template = readTemplate(templateName);

  it("37. evidence template existe", () => {
    expect(existsSync(resolve(ROOT, "docs/templates", templateName))).toBe(true);
  });

  it("38. evidence template mentionne SQL appliqué manuellement", () => {
    const hasSqlManual =
      template.toLowerCase().includes("sql appliqué manuellement") ||
      template.toLowerCase().includes("sql applied manually");
    expect(hasSqlManual).toBe(true);
  });

  it("39. evidence template mentionne RLS", () => {
    expect(template).toContain("RLS");
  });

  it("40. evidence template mentionne rollback", () => {
    expect(template.toLowerCase()).toContain("rollback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation PHASE 3.15
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.15 — Documentation", () => {
  const docName = "PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_QA.md";
  const doc = readDocs(docName);

  it("41. doc PHASE_3_15 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("42. doc mentionne Manual Activation QA", () => {
    const hasQA =
      doc.toLowerCase().includes("manual activation") ||
      doc.includes("Manual Activation");
    expect(hasQA).toBe(true);
  });

  it("43. doc mentionne SQL Editor", () => {
    expect(doc).toContain("SQL Editor");
  });

  it("44. doc mentionne NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED", () => {
    expect(doc).toContain("NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED");
  });

  it("45. doc mentionne /profile/onboarding", () => {
    expect(doc).toContain("/profile/onboarding");
  });

  it("46. doc mentionne rollback", () => {
    expect(doc.toLowerCase()).toContain("rollback");
  });

  it("47. doc mentionne evidence template", () => {
    const hasEvidence =
      doc.toLowerCase().includes("evidence template") ||
      doc.includes("PHASE_3_15_ENTERPRISE_FOOTPRINT_MANUAL_ACTIVATION_EVIDENCE");
    expect(hasEvidence).toBe(true);
  });

  it("48. doc mentionne PHASE 3.16", () => {
    expect(doc).toContain("3.16");
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
// BLOC 5 — Pages UI : intégration préservée
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.15 — Pages UI safe apply préservé", () => {
  it("52. /profile/onboarding conserve persistEnterpriseFootprintWithFallback", () => {
    const onboarding = readSrc("app/profile/onboarding/page.tsx");
    expect(onboarding).toContain("persistEnterpriseFootprintWithFallback");
  });

  it("53. /profile/agents ne fait pas d'appel route enterprise-footprint", () => {
    const agents = readSrc("app/profile/agents/page.tsx");
    expect(agents).not.toContain("/api/profile/enterprise-footprint");
    expect(agents).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("54. /agents/pierre/setup ne fait pas d'appel route enterprise-footprint", () => {
    const setup = readSrc("app/agents/pierre/setup/page.tsx");
    expect(setup).not.toContain("/api/profile/enterprise-footprint");
    expect(setup).not.toContain("persistEnterpriseFootprintWithFallback");
  });

  it("55. /agents/pierre/use ne fait pas d'appel route enterprise-footprint", () => {
    const use = readSrc("app/agents/pierre/use/page.tsx");
    expect(use).not.toContain("/api/profile/enterprise-footprint");
    expect(use).not.toContain("persistEnterpriseFootprintWithFallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — package.json scripts
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.15 — Scripts package.json", () => {
  const pkg = readSrc("../package.json");

  it("56. package.json contient test:phase3-15", () => {
    expect(pkg).toContain("test:phase3-15");
  });

  it("57. package.json contient check:enterprise-footprint-manual-activation-qa", () => {
    expect(pkg).toContain("check:enterprise-footprint-manual-activation-qa");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildEnterpriseFootprintManualActivationChecklist,
  buildEnterpriseFootprintManualActivationVerdict,
  buildEnterpriseFootprintManualActivationEvidenceTemplate,
  validateEnterpriseFootprintManualActivationEvidencePack,
  getEnterpriseFootprintManualActivationBlockingSteps,
  summarizeEnterpriseFootprintManualActivationQaVerdict,
} from "@/lib/clonestore/enterprise-footprint";

describe("PHASE 3.15 — Tests fonctionnels module manual QA", () => {
  it("checklist retourne 24 étapes", () => {
    const checklist = buildEnterpriseFootprintManualActivationChecklist();
    expect(checklist.total).toBe(24);
    expect(checklist.phase).toBe("3.15");
  });

  it("toutes les étapes sont initialement 'pending'", () => {
    const checklist = buildEnterpriseFootprintManualActivationChecklist();
    expect(checklist.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("verdict avec toutes étapes pending → ready_for_manual_activation", () => {
    const checklist = buildEnterpriseFootprintManualActivationChecklist();
    const summary = buildEnterpriseFootprintManualActivationVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready_for_manual_activation");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("verdict avec blocking failed → blocked", () => {
    const checklist = buildEnterpriseFootprintManualActivationChecklist();
    const stepsWithFail = checklist.steps.map((s) =>
      s.id === "table_exists" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildEnterpriseFootprintManualActivationVerdict(stepsWithFail);
    expect(summary.verdict).toBe("blocked");
  });

  it("evidence template → verdict PENDING initialement", () => {
    const pack = buildEnterpriseFootprintManualActivationEvidenceTemplate();
    expect(pack.verdict).toBe("PENDING");
    expect(pack.environment).toBe("local");
  });

  it("validateEvidencePack → invalid si tested_by vide", () => {
    const pack = buildEnterpriseFootprintManualActivationEvidenceTemplate();
    const result = validateEnterpriseFootprintManualActivationEvidencePack(pack);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("getBlockingSteps → retourne les étapes bloquantes", () => {
    const blockingSteps = getEnterpriseFootprintManualActivationBlockingSteps();
    expect(blockingSteps.length).toBeGreaterThan(0);
    expect(blockingSteps.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("summarize → retourne un message lisible", () => {
    const checklist = buildEnterpriseFootprintManualActivationChecklist();
    const summary = buildEnterpriseFootprintManualActivationVerdict(checklist.steps);
    const msg = summarizeEnterpriseFootprintManualActivationQaVerdict(summary);
    expect(msg).toContain("PHASE 3.15");
    expect(msg).toContain("READY_FOR_MANUAL_ACTIVATION");
  });
});
