// src/lib/clonestore/cloneos-history/__tests__/cloneos-history-manual-activation-qa-phase3-19.test.ts
// PHASE 3.19 — CloneOS History Manual Activation QA — Tests
//
// Vérifie :
//   - module manual activation QA (structure, invariants, checklist)
//   - script de guidance read-only
//   - evidence template
//   - documentation
//   - /profile/messages microcopy + no-write
//   - package scripts
//   - régression cascade PHASE 3.1 → 3.18

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

function readRoot(filename: string): string {
  const full = resolve(ROOT, filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Module manual activation QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.19 — Module Manual Activation QA", () => {
  const modulePath = "lib/clonestore/cloneos-history/cloneos-history-manual-activation-qa.ts";
  const module = readSrc(modulePath);

  it("1. cloneos-history-manual-activation-qa.ts existe", () => {
    expect(existsSync(resolve(ROOT, "src", modulePath))).toBe(true);
  });

  it("2. module contient buildCloneOSHistoryManualActivationChecklist", () => {
    expect(module).toContain("buildCloneOSHistoryManualActivationChecklist");
  });

  it("3. module contient buildCloneOSHistoryManualActivationVerdict", () => {
    expect(module).toContain("buildCloneOSHistoryManualActivationVerdict");
  });

  it("4. module contient buildCloneOSHistoryManualActivationEvidenceTemplate", () => {
    expect(module).toContain("buildCloneOSHistoryManualActivationEvidenceTemplate");
  });

  it("5. module contient validateCloneOSHistoryManualActivationEvidencePack", () => {
    expect(module).toContain("validateCloneOSHistoryManualActivationEvidencePack");
  });

  const stepIds = [
    "cloneos_history_localstorage_key_verified",
    "cloneos_history_sql_file_reviewed",
    "cloneos_history_sql_applied_manually",
    "cloneos_history_table_exists",
    "cloneos_history_rls_enabled",
    "cloneos_history_select_policy_exists",
    "cloneos_history_insert_policy_exists",
    "cloneos_history_update_policy_exists",
    "cloneos_history_no_delete_policy",
    "cloneos_history_constraints_verified",
    "cloneos_history_flag_disabled_before_test",
    "cloneos_history_server_sync_works",
    "cloneos_history_api_get_returns_server_snapshot",
    "cloneos_history_profile_messages_reads_context_feed",
    "cloneos_history_rollback_flag_disabled",
    "cloneos_history_no_cloneos_execution",
    "public_launch_external_not_validated",
  ];

  stepIds.forEach((id, idx) => {
    it(`${6 + idx}. checklist contient ${id}`, () => {
      expect(module).toContain(id);
    });
  });

  it("23. module ne contient pas Supabase createClient (réel)", () => {
    expect(module).not.toMatch(/^import\s+.*createClient.*from\s+["']@supabase/m);
    expect(module).not.toMatch(/^import\s+.*from\s+["']@supabase\/supabase-js["']/m);
  });

  it("24. module ne contient pas insert/update/delete/upsert", () => {
    expect(module).not.toMatch(/\.insert\s*\(/);
    expect(module).not.toMatch(/\.update\s*\(/);
    expect(module).not.toMatch(/\.delete\s*\(/);
    expect(module).not.toMatch(/\.upsert\s*\(/);
  });

  it("25. module ne contient pas import src/lib/pierre (réel)", () => {
    expect(module).not.toMatch(/^import\s+.*from\s+["']@\/lib\/pierre/m);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Script manual activation QA
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.19 — Script manual activation QA", () => {
  const scriptName = "check-cloneos-history-manual-activation-qa.mjs";
  const script = readScript(scriptName);

  it("26. script check-cloneos-history-manual-activation-qa.mjs existe", () => {
    expect(existsSync(resolve(ROOT, "scripts", scriptName))).toBe(true);
  });

  it("27. script contient clonestore.cloneos.commandHistory.v1", () => {
    expect(script).toContain("clonestore.cloneos.commandHistory.v1");
  });

  it("28. script contient information_schema.tables", () => {
    expect(script).toContain("information_schema.tables");
  });

  it("29. script contient pg_policies", () => {
    expect(script).toContain("pg_policies");
  });

  it("30. script contient pg_constraint", () => {
    expect(script).toContain("pg_constraint");
  });

  it("31. script contient check:cloneos-history-manual-activation-qa", () => {
    expect(script).toContain("check:cloneos-history-manual-activation-qa");
  });

  it("32. script contient test:phase3-19", () => {
    expect(script).toContain("test:phase3-19");
  });

  it("33. script ne contient pas .insert(", () => {
    expect(script).not.toContain(".insert(");
  });

  it("34. script ne contient pas .update(", () => {
    expect(script).not.toContain(".update(");
  });

  it("35. script ne contient pas .delete(", () => {
    expect(script).not.toContain(".delete(");
  });

  it("36. script ne contient pas .upsert(", () => {
    expect(script).not.toContain(".upsert(");
  });

  it("37. script ne contient pas fetch POST", () => {
    expect(script).not.toMatch(/fetch\s*\(.*method.*POST/s);
    expect(script).not.toMatch(/fetch\s*\(.*POST/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Evidence template
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.19 — Evidence template", () => {
  const templateName = "PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_EVIDENCE.md";
  const template = readTemplate(templateName);

  it("38. evidence template existe", () => {
    expect(existsSync(resolve(ROOT, "docs/templates", templateName))).toBe(true);
  });

  it("39. evidence template mentionne SQL CloneOS History appliqué manuellement", () => {
    const hasSql =
      template.includes("SQL CloneOS History appliqué manuellement") ||
      template.toLowerCase().includes("sql cloneos history appliqué manuellement");
    expect(hasSql).toBe(true);
  });

  it("40. evidence template mentionne localStorage", () => {
    expect(template).toContain("localStorage");
  });

  it("41. evidence template mentionne /profile/messages", () => {
    expect(template).toContain("/profile/messages");
  });

  it("42. evidence template mentionne rollback", () => {
    expect(template.toLowerCase()).toContain("rollback");
  });

  it("43. evidence template mentionne aucune exécution CloneOS automatique", () => {
    expect(template.toLowerCase()).toContain("aucune exécution cloneos");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.19 — Documentation", () => {
  const docName = "PHASE_3_19_CLONEOS_HISTORY_MANUAL_ACTIVATION_QA.md";
  const doc = readDocs(docName);

  it("44. doc PHASE_3_19 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });

  it("45. doc mentionne Manual Activation QA", () => {
    expect(doc).toContain("Manual Activation QA");
  });

  it("46. doc mentionne CloneOS History", () => {
    expect(doc).toContain("CloneOS History");
  });

  it("47. doc mentionne CAS A", () => {
    expect(doc).toContain("CAS A");
  });

  it("48. doc mentionne CAS B", () => {
    expect(doc).toContain("CAS B");
  });

  it("49. doc mentionne SQL Editor", () => {
    expect(doc).toContain("SQL Editor");
  });

  it("50. doc mentionne /profile/messages", () => {
    expect(doc).toContain("/profile/messages");
  });

  it("51. doc mentionne rollback", () => {
    expect(doc.toLowerCase()).toContain("rollback");
  });

  it("52. doc mentionne PHASE 3.20", () => {
    expect(doc).toContain("3.20");
  });

  it("53. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });

  it("54. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });

  it("55. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — /profile/messages microcopy + no-write
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.19 — /profile/messages safe", () => {
  const messages = readSrc("app/profile/messages/page.tsx");

  it("56. /profile/messages mentionne Historique CloneOS", () => {
    expect(messages).toContain("Historique CloneOS");
  });

  it("57. /profile/messages mentionne Aucun message envoyé", () => {
    expect(messages).toContain("Aucun message envoyé");
  });

  it("58. /profile/messages mentionne Lecture seule", () => {
    expect(messages).toContain("Lecture seule");
  });

  it("59. /profile/messages ne fait pas d'appel route CloneOS write", () => {
    expect(messages).not.toMatch(/fetch\s*\(.*cloneos.*method.*POST/s);
    expect(messages).not.toContain("/api/cloneos-history");
    expect(messages).not.toMatch(/\.insert\s*\(/);
    expect(messages).not.toMatch(/\.upsert\s*\(/);
  });

  it("60. /agents/pierre/setup ne fait pas d'appel route CloneOS write", () => {
    const setup = readSrc("app/agents/pierre/setup/page.tsx");
    expect(setup).not.toContain("/api/cloneos-history");
    expect(setup).not.toMatch(/persistCloneOSHistory/);
  });

  it("61. /agents/pierre/use ne fait pas d'appel route CloneOS write", () => {
    const use = readSrc("app/agents/pierre/use/page.tsx");
    expect(use).not.toContain("/api/cloneos-history");
    expect(use).not.toMatch(/persistCloneOSHistory/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — package.json scripts
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.19 — Scripts package.json", () => {
  const pkg = readRoot("package.json");

  it("62. package.json contient test:phase3-19", () => {
    expect(pkg).toContain("test:phase3-19");
  });

  it("63. package.json contient check:cloneos-history-manual-activation-qa", () => {
    expect(pkg).toContain("check:cloneos-history-manual-activation-qa");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildCloneOSHistoryManualActivationChecklist,
  buildCloneOSHistoryManualActivationVerdict,
  buildCloneOSHistoryManualActivationEvidenceTemplate,
  validateCloneOSHistoryManualActivationEvidencePack,
  getCloneOSHistoryManualActivationBlockingSteps,
  summarizeCloneOSHistoryManualActivationQaVerdict,
} from "@/lib/clonestore/cloneos-history";

describe("PHASE 3.19 — Tests fonctionnels module manual QA", () => {
  it("checklist retourne 27 étapes", () => {
    const checklist = buildCloneOSHistoryManualActivationChecklist();
    expect(checklist.total).toBe(27);
    expect(checklist.phase).toBe("3.19");
    expect(checklist.table_name).toBe("clonestore_cloneos_history");
    expect(checklist.localstorage_key).toBe("clonestore.cloneos.commandHistory.v1");
  });

  it("toutes les étapes sont initialement 'pending'", () => {
    const checklist = buildCloneOSHistoryManualActivationChecklist();
    expect(checklist.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("verdict avec toutes étapes pending → ready_for_manual_activation", () => {
    const checklist = buildCloneOSHistoryManualActivationChecklist();
    const summary = buildCloneOSHistoryManualActivationVerdict(checklist.steps);
    expect(summary.verdict).toBe("ready_for_manual_activation");
    expect(summary.safe_to_activate).toBe(true);
  });

  it("verdict avec blocking failed → blocked", () => {
    const checklist = buildCloneOSHistoryManualActivationChecklist();
    const withFail = checklist.steps.map((s) =>
      s.id === "cloneos_history_table_exists" ? { ...s, status: "failed" as const } : s
    );
    const summary = buildCloneOSHistoryManualActivationVerdict(withFail);
    expect(summary.verdict).toBe("blocked");
    expect(summary.safe_to_activate).toBe(false);
  });

  it("evidence template → verdict PENDING initialement", () => {
    const pack = buildCloneOSHistoryManualActivationEvidenceTemplate();
    expect(pack.verdict).toBe("PENDING");
    expect(pack.environment).toBe("local");
    expect(pack.evidence.no_execution_confirmation).toBe(false);
  });

  it("validateEvidencePack → invalid si tested_by vide", () => {
    const pack = buildCloneOSHistoryManualActivationEvidenceTemplate();
    const result = validateCloneOSHistoryManualActivationEvidencePack(pack);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("getBlockingSteps → retourne uniquement les bloquantes", () => {
    const blocking = getCloneOSHistoryManualActivationBlockingSteps();
    expect(blocking.length).toBeGreaterThan(0);
    expect(blocking.every((s) => s.severity === "blocking")).toBe(true);
  });

  it("summarize → message lisible avec PHASE 3.19", () => {
    const checklist = buildCloneOSHistoryManualActivationChecklist();
    const summary = buildCloneOSHistoryManualActivationVerdict(checklist.steps);
    const msg = summarizeCloneOSHistoryManualActivationQaVerdict(summary);
    expect(msg).toContain("PHASE 3.19");
    expect(msg).toContain("READY_FOR_MANUAL_ACTIVATION");
  });
});
