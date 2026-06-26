// src/lib/clonestore/employee-context-registry/__tests__/employee-context-registry-design-phase3-20.test.ts
// PHASE 3.20 — Global Employee Context Registry Design — Tests
//
// Vérifie : types, defaults Pierre V1 + placeholders, validation/sanitization,
// snapshot, enterprise bridge, CloneVoice contract, QA, doc, exports, no-secrets.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../../../..");
const REG_DIR = "lib/clonestore/employee-context-registry";

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

function readRoot(filename: string): string {
  const full = resolve(ROOT, filename);
  if (!existsSync(full)) return "";
  return readFileSync(full, "utf-8");
}

const typesSrc = readSrc(`${REG_DIR}/employee-context-registry-types.ts`);
const defaultsSrc = readSrc(`${REG_DIR}/employee-context-registry-defaults.ts`);
const validationSrc = readSrc(`${REG_DIR}/employee-context-registry-validation.ts`);
const snapshotSrc = readSrc(`${REG_DIR}/employee-context-registry-snapshot.ts`);
const bridgeSrc = readSrc(`${REG_DIR}/employee-context-registry-enterprise-bridge.ts`);
const clonevoiceSrc = readSrc(`${REG_DIR}/employee-context-registry-clonevoice-contract.ts`);
const qaSrc = readSrc(`${REG_DIR}/employee-context-registry-qa.ts`);
const indexSrc = readSrc(`${REG_DIR}/index.ts`);

const ALL_REGISTRY_SRC = [
  typesSrc, defaultsSrc, validationSrc, snapshotSrc, bridgeSrc, clonevoiceSrc, qaSrc, indexSrc,
];

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 1 — Fichiers présents
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Fichiers registry", () => {
  const files = [
    "employee-context-registry-types.ts",
    "employee-context-registry-defaults.ts",
    "employee-context-registry-validation.ts",
    "employee-context-registry-snapshot.ts",
    "employee-context-registry-enterprise-bridge.ts",
    "employee-context-registry-clonevoice-contract.ts",
    "employee-context-registry-qa.ts",
    "index.ts",
  ];
  files.forEach((f, i) => {
    it(`${i + 1}. ${f} existe`, () => {
      expect(existsSync(resolve(ROOT, "src", `${REG_DIR}/${f}`))).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 2 — Types
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Types", () => {
  it("9. types contiennent EmployeeContextRegistry", () => {
    expect(typesSrc).toContain("EmployeeContextRegistry");
  });
  it("10. types contiennent employee_key", () => {
    expect(typesSrc).toContain("employee_key");
  });
  it("11. types contiennent function_key", () => {
    expect(typesSrc).toContain("function_key");
  });
  it("12. types contiennent capability_key", () => {
    expect(typesSrc).toContain("capability_key");
  });
  it("13. types contiennent technology_key", () => {
    expect(typesSrc).toContain("technology_key");
  });
  it("14. types contiennent policy_key", () => {
    expect(typesSrc).toContain("policy_key");
  });
  it("15. types ne contiennent pas secret_key", () => {
    expect(typesSrc).not.toContain("secret_key");
  });
  it("16. types ne contiennent pas private_key", () => {
    expect(typesSrc).not.toContain("private_key");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 3 — Defaults
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Defaults", () => {
  it("17. defaults contiennent PIERRE_EMPLOYEE_CONTEXT", () => {
    expect(defaultsSrc).toContain("PIERRE_EMPLOYEE_CONTEXT");
  });
  it('18. defaults contiennent employee_key: "pierre"', () => {
    expect(defaultsSrc).toContain('employee_key: "pierre"');
  });
  it("19. defaults contiennent Employé RH opérationnel automatisé", () => {
    expect(defaultsSrc).toContain("Employé RH opérationnel automatisé");
  });

  const caps = [
    "hr_mission_planning", "hr_document_preparation", "absence_followup",
    "onboarding_coordination", "pre_payroll_preparation",
    "internal_hr_communication_draft", "hr_risk_review", "employee_file_context_review",
  ];
  caps.forEach((c, i) => {
    it(`${20 + i}. defaults contiennent ${c}`, () => {
      expect(defaultsSrc).toContain(c);
    });
  });

  it("28. defaults contiennent future placeholders", () => {
    expect(defaultsSrc).toContain("future_placeholder");
  });

  const placeholders = ["clara", "emma", "alex", "noah", "lucas", "sophie", "adrien"];
  placeholders.forEach((p, i) => {
    it(`${29 + i}. defaults contiennent ${p}`, () => {
      expect(defaultsSrc).toContain(`"${p}"`);
    });
  });

  it("36. defaults marque placeholders design-only / inactive", () => {
    expect(defaultsSrc).toContain("future_placeholder");
    expect(defaultsSrc).toContain("active_for_company: false");
  });

  it("37. defaults ne contient pas execution_enabled: true pour Pierre", () => {
    expect(defaultsSrc).not.toContain("execution_enabled: true");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 4 — Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Validation", () => {
  it("38. validation interdit sk_live_", () => {
    expect(validationSrc).toContain("sk_live_");
  });
  it("39. validation interdit whsec_", () => {
    expect(validationSrc).toContain("whsec_");
  });
  it("40. validation interdit OPENAI_API_KEY (insensible casse)", () => {
    expect(validationSrc.toLowerCase()).toContain("openai_api_key");
  });
  it("41. validation interdit ANTHROPIC_API_KEY (insensible casse)", () => {
    expect(validationSrc.toLowerCase()).toContain("anthropic_api_key");
  });
  it("42. validation interdit SUPABASE_SERVICE_ROLE_KEY (insensible casse)", () => {
    expect(validationSrc.toLowerCase()).toContain("supabase_service_role_key");
  });
  it("43. validation interdit secret_key", () => {
    expect(validationSrc).toContain("secret_key");
  });
  it("44. validation interdit api_key", () => {
    expect(validationSrc).toContain("api_key");
  });
  it("45. validation interdit CloneVoice actif production", () => {
    expect(validationSrc.toLowerCase()).toContain("clonevoice actif production");
  });
  it("46. validation bloque execution_enabled true en design phase", () => {
    expect(validationSrc).toContain("execution_enabled_in_design_phase");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 5 — Snapshot
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Snapshot", () => {
  it("47. snapshot contient buildEmployeeContextRegistrySnapshot", () => {
    expect(snapshotSrc).toContain("buildEmployeeContextRegistrySnapshot");
  });
  it("48. snapshot contient filterCloneOSVisibleEmployeeContexts", () => {
    expect(snapshotSrc).toContain("filterCloneOSVisibleEmployeeContexts");
  });
  it("49. snapshot contient filterCloneVoiceVisibleEmployeeContexts", () => {
    expect(snapshotSrc).toContain("filterCloneVoiceVisibleEmployeeContexts");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 6 — Enterprise bridge
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Enterprise bridge", () => {
  it("50. bridge contient buildEmployeeContextRegistryFromEnterpriseFootprint", () => {
    expect(bridgeSrc).toContain("buildEmployeeContextRegistryFromEnterpriseFootprint");
  });
  it("51. bridge ne contient pas save/upsert/insert", () => {
    expect(bridgeSrc).not.toMatch(/\.save\s*\(/);
    expect(bridgeSrc).not.toMatch(/\.upsert\s*\(/);
    expect(bridgeSrc).not.toMatch(/\.insert\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 7 — CloneVoice contract
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — CloneVoice contract", () => {
  it("52. contract contient governed_context_only", () => {
    expect(clonevoiceSrc).toContain("governed_context_only");
  });
  it("53. contract contient must_route_through_cloneos", () => {
    expect(clonevoiceSrc).toContain("must_route_through_cloneos");
  });
  it("54. contract contient must_pass_cloneguard", () => {
    expect(clonevoiceSrc).toContain("must_pass_cloneguard");
  });
  it("55. contract contient must_trace_with_clonetrace", () => {
    expect(clonevoiceSrc).toContain("must_trace_with_clonetrace");
  });
  it("56. contract contient can_execute_actions: false", () => {
    expect(clonevoiceSrc).toContain("can_execute_actions: false");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 8 — QA module
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — QA module", () => {
  it("57. QA module contient buildEmployeeContextRegistryQaChecklist", () => {
    expect(qaSrc).toContain("buildEmployeeContextRegistryQaChecklist");
  });
  it("58. QA module contient no_secret_keys", () => {
    expect(qaSrc).toContain("no_secret_keys");
  });
  it("59. QA module contient execution_disabled_by_default", () => {
    expect(qaSrc).toContain("execution_disabled_by_default");
  });
  it("60. QA module contient clonevoice_contract_design_only", () => {
    expect(qaSrc).toContain("clonevoice_contract_design_only");
  });
  it("61. QA module contient public_launch_external_not_validated", () => {
    expect(qaSrc).toContain("public_launch_external_not_validated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 9 — No-secret / no-write invariants (tous fichiers)
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Invariants no-secret / no-write", () => {
  it("62. aucun fichier registry ne contient Supabase createClient", () => {
    ALL_REGISTRY_SRC.forEach((src) => {
      expect(src).not.toMatch(/createClient\s*\(/);
      expect(src).not.toMatch(/from\s+["']@supabase\/supabase-js["']/);
    });
  });
  it("63. aucun fichier registry ne contient .insert(", () => {
    ALL_REGISTRY_SRC.forEach((src) => expect(src).not.toMatch(/\.insert\s*\(/));
  });
  it("64. aucun fichier registry ne contient .update(", () => {
    ALL_REGISTRY_SRC.forEach((src) => expect(src).not.toMatch(/\.update\s*\(/));
  });
  it("65. aucun fichier registry ne contient .delete(", () => {
    ALL_REGISTRY_SRC.forEach((src) => expect(src).not.toMatch(/\.delete\s*\(/));
  });
  it("66. aucun fichier registry ne contient .upsert(", () => {
    ALL_REGISTRY_SRC.forEach((src) => expect(src).not.toMatch(/\.upsert\s*\(/));
  });
  it("67. aucun fichier registry ne contient import src/lib/pierre", () => {
    ALL_REGISTRY_SRC.forEach((src) => expect(src).not.toMatch(/from\s+["']@\/lib\/pierre/));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 10 — Documentation
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — Documentation", () => {
  const docName = "PHASE_3_20_GLOBAL_EMPLOYEE_CONTEXT_REGISTRY_DESIGN.md";
  const doc = readDocs(docName);

  it("68. doc P3.20 existe", () => {
    expect(existsSync(resolve(ROOT, "docs", docName))).toBe(true);
  });
  it("69. doc mentionne Global Employee Context Registry", () => {
    expect(doc).toContain("Global Employee Context Registry");
  });
  it("70. doc mentionne employee_key", () => {
    expect(doc).toContain("employee_key");
  });
  it("71. doc mentionne function_key", () => {
    expect(doc).toContain("function_key");
  });
  it("72. doc mentionne capability_key", () => {
    expect(doc).toContain("capability_key");
  });
  it("73. doc mentionne que les keys ne sont pas des secrets", () => {
    expect(doc.toLowerCase()).toContain("ne sont pas des secrets");
  });
  it("74. doc mentionne Pierre V1", () => {
    expect(doc).toContain("Pierre V1");
  });
  it("75. doc mentionne CloneVoice governed context", () => {
    const hasGoverned =
      doc.includes("governed context") || doc.includes("governed_context_only") ||
      doc.toLowerCase().includes("contexte gouverné");
    expect(hasGoverned).toBe(true);
  });
  it("76. doc mentionne CloneOS/CloneGuard/CloneTrace", () => {
    expect(doc).toContain("CloneOS");
    expect(doc).toContain("CloneGuard");
    expect(doc).toContain("CloneTrace");
  });
  it("77. doc mentionne PHASE 3.21", () => {
    expect(doc).toContain("3.21");
  });
  it("78. doc mentionne PHASE 3.22", () => {
    expect(doc).toContain("3.22");
  });
  it("79. doc ne contient pas phrase de lancement public interdite", () => {
    expect(doc.toLowerCase()).not.toContain("public launch go");
  });
  it("80. doc ne contient pas 'zéro erreur'", () => {
    expect(doc.toLowerCase()).not.toContain("zéro erreur");
    expect(doc.toLowerCase()).not.toContain("zero erreur");
  });
  it("81. doc ne contient pas 'conformité garantie'", () => {
    expect(doc.toLowerCase()).not.toContain("conformité garantie");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 11 — package.json
// ─────────────────────────────────────────────────────────────────────────────

describe("PHASE 3.20 — package.json", () => {
  it("82. package.json contient test:phase3-20", () => {
    expect(readRoot("package.json")).toContain("test:phase3-20");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOC 12 — Tests fonctionnels (imports purs)
// ─────────────────────────────────────────────────────────────────────────────

import {
  buildDefaultEmployeeContextRegistry,
  buildPierreEmployeeContext,
  buildFutureEmployeeContextPlaceholders,
  buildEmptyEmployeeContextRegistry,
  PIERRE_EMPLOYEE_CONTEXT,
  detectUnsafeEmployeeContextRegistryText,
  isSafeEmployeeContextRegistryKey,
  validateEmployeeContextRegistry,
  validateEmployeeContextRegistryEmployee,
  sanitizeEmployeeContextRegistry,
  assertEmployeeContextRegistryNoSecrets,
  buildEmployeeContextRegistrySnapshot,
  buildEmployeeContextRegistrySummary,
  filterActiveEmployeeContexts,
  filterCloneVoiceVisibleEmployeeContexts,
  findEmployeeContextByKey,
  findCapabilityContextByKey,
  buildEmployeeContextRegistryFromEnterpriseFootprint,
  buildEnterpriseEmployeeContextReadResult,
  buildEnterpriseEmployeeContextIssues,
  buildCloneVoiceEmployeeContextContract,
  validateCloneVoiceEmployeeContextContract,
  buildEmployeeContextRegistryQaChecklist,
  buildEmployeeContextRegistryQaVerdict,
} from "@/lib/clonestore/employee-context-registry";

describe("PHASE 3.20 — Tests fonctionnels registry", () => {
  it("registry par défaut contient Pierre actif", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    expect(reg.read_only).toBe(true);
    expect(reg.execution_enabled).toBe(false);
    const pierre = findEmployeeContextByKey(reg, "pierre");
    expect(pierre).not.toBeNull();
    expect(pierre?.status).toBe("active");
  });

  it("Pierre a 8 capacités et 8 fonctions", () => {
    const pierre = buildPierreEmployeeContext();
    expect(pierre.capabilities.length).toBe(8);
    expect(pierre.functions.length).toBe(8);
    expect(pierre.capabilities.every((c) => c.execution_enabled === false)).toBe(true);
    expect(pierre.functions.every((f) => f.execution_enabled === false)).toBe(true);
  });

  it("PIERRE_EMPLOYEE_CONTEXT exporté avec key pierre", () => {
    expect(PIERRE_EMPLOYEE_CONTEXT.employee_key).toBe("pierre");
  });

  it("placeholders futurs sont design-only inactifs", () => {
    const placeholders = buildFutureEmployeeContextPlaceholders();
    expect(placeholders.length).toBe(7);
    expect(placeholders.every((p) => p.status === "future_placeholder")).toBe(true);
    expect(placeholders.every((p) => p.active_for_company === false)).toBe(true);
  });

  it("registry vide n'a aucun employé", () => {
    const reg = buildEmptyEmployeeContextRegistry();
    expect(reg.employees.length).toBe(0);
  });

  it("detectUnsafe détecte sk_live_ et secret_key", () => {
    expect(detectUnsafeEmployeeContextRegistryText("sk_live_abc").length).toBeGreaterThan(0);
    expect(detectUnsafeEmployeeContextRegistryText("my secret_key here").length).toBeGreaterThan(0);
  });

  it("isSafeKey accepte snake_case et rejette espaces/secrets", () => {
    expect(isSafeEmployeeContextRegistryKey("hr_mission_planning")).toBe(true);
    expect(isSafeEmployeeContextRegistryKey("bad key")).toBe(false);
    expect(isSafeEmployeeContextRegistryKey("api_key")).toBe(false);
  });

  it("validation registry par défaut → valid", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const result = validateEmployeeContextRegistry(reg);
    expect(result.valid).toBe(true);
  });

  it("validation bloque un employé avec execution_enabled true", () => {
    const pierre = buildPierreEmployeeContext();
    const tampered = {
      ...pierre,
      capabilities: pierre.capabilities.map((c) => ({ ...c, execution_enabled: true })),
    };
    const result = validateEmployeeContextRegistryEmployee(tampered);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "execution_enabled_in_design_phase")).toBe(true);
  });

  it("validation bloque clonevoice_visible sans cloneos_visible", () => {
    const pierre = buildPierreEmployeeContext();
    const tampered = { ...pierre, cloneos_visible: false, clonevoice_visible: true };
    const result = validateEmployeeContextRegistryEmployee(tampered);
    expect(result.issues.some((i) => i.code === "clonevoice_visibility_without_cloneos")).toBe(true);
  });

  it("assertNoSecrets → safe sur registry par défaut", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    expect(assertEmployeeContextRegistryNoSecrets(reg).safe).toBe(true);
  });

  it("sanitize force execution_enabled false", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const sanitized = sanitizeEmployeeContextRegistry(reg);
    expect(sanitized.execution_enabled).toBe(false);
    expect(sanitized.read_only).toBe(true);
  });

  it("snapshot summary cohérent", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const snap = buildEmployeeContextRegistrySnapshot(reg);
    expect(snap.read_only).toBe(true);
    expect(snap.summary.active_employees_count).toBe(1);
    expect(snap.summary.execution_enabled_count).toBe(0);
    expect(snap.cards.length).toBeGreaterThan(0);
  });

  it("summary direct compte les placeholders", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const summary = buildEmployeeContextRegistrySummary(reg);
    expect(summary.future_placeholders_count).toBe(7);
  });

  it("filterActive ne retourne que Pierre", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const active = filterActiveEmployeeContexts(reg);
    expect(active.length).toBe(1);
    expect(active[0]?.employee_key).toBe("pierre");
  });

  it("filterCloneVoiceVisible requiert cloneos_visible", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const visible = filterCloneVoiceVisibleEmployeeContexts(reg);
    expect(visible.every((e) => e.cloneos_visible)).toBe(true);
  });

  it("findCapability retrouve une capacité Pierre", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const cap = findCapabilityContextByKey(reg, "pierre", "hr_mission_planning");
    expect(cap).not.toBeNull();
  });

  it("bridge sans footprint → registry par défaut", () => {
    const reg = buildEmployeeContextRegistryFromEnterpriseFootprint(null);
    expect(reg.source).toBe("default_registry");
    expect(findEmployeeContextByKey(reg, "pierre")).not.toBeNull();
  });

  it("bridge avec company_id → source enterprise_footprint", () => {
    const reg = buildEmployeeContextRegistryFromEnterpriseFootprint({ company_id: "co_123" });
    expect(reg.source).toBe("enterprise_footprint");
    expect(reg.company_id).toBe("co_123");
  });

  it("read result combiné → has_active_employee true", () => {
    const result = buildEnterpriseEmployeeContextReadResult(null);
    expect(result.has_active_employee).toBe(true);
  });

  it("issues par défaut n'ont pas de blocking", () => {
    const issues = buildEnterpriseEmployeeContextIssues(null);
    expect(issues.some((i) => i.code === "pierre_missing")).toBe(false);
  });

  it("CloneVoice contract design-only valide", () => {
    const reg = buildDefaultEmployeeContextRegistry();
    const contract = buildCloneVoiceEmployeeContextContract(reg);
    expect(contract.can_execute_actions).toBe(false);
    expect(contract.must_route_through_cloneos).toBe(true);
    expect(contract.must_pass_cloneguard).toBe(true);
    expect(contract.must_trace_with_clonetrace).toBe(true);
    expect(contract.public_launch_validated).toBe(false);
    expect(validateCloneVoiceEmployeeContextContract(contract).valid).toBe(true);
  });

  it("QA checklist retourne 18 étapes", () => {
    const checklist = buildEmployeeContextRegistryQaChecklist();
    expect(checklist.total).toBe(18);
    expect(checklist.phase).toBe("3.20");
  });

  it("QA verdict pending initialement", () => {
    const checklist = buildEmployeeContextRegistryQaChecklist();
    const summary = buildEmployeeContextRegistryQaVerdict(checklist.steps);
    expect(summary.verdict).toBe("pending");
    expect(summary.safe_to_activate).toBe(true);
  });
});
