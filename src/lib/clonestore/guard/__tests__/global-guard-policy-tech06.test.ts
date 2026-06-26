// TECH-06 — CloneGuard + ClonePolicy Global Rules — Tests
// 50 tests couvrant : types, defaults, evaluators, validation, snapshot, accès, bridge.
//
// Tests purs : aucun appel Supabase, OpenAI, Anthropic, Stripe.
// Aucune preuve modifiée. Aucune écriture go-live-proofs.local.json.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return readFileSync(join(ROOT, "src/lib/clonestore/guard", relPath), "utf-8");
}
function readDoc(name: string): string {
  return readFileSync(join(ROOT, "docs", name), "utf-8");
}

// ── Imports modules ────────────────────────────────────────────────────────────
import {
  DEFAULT_GLOBAL_POLICY_RULES,
  areAbsoluteInvariantsPresent,
} from "../global-policy-defaults";
import {
  evaluateGlobalPolicyRules,
  policyRuleMatchesInput,
  isActionAbsolutelyBlocked,
} from "../global-policy-evaluator";
import {
  evaluateGlobalGuard,
  canExecuteGuardedAction,
  canPrepareGuardedAction,
  requiresHumanValidation,
  buildDefaultGlobalGuardInput,
} from "../global-guard-evaluator";
import {
  validateGlobalPolicyRule,
  validateGlobalPolicyRules,
  getGlobalGuardValidationReport,
} from "../global-guard-validation";
import {
  buildGlobalGuardSnapshot,
} from "../global-guard-snapshot";
import {
  canEmployeeRequestAction,
  getEmployeeGuardProfile,
  buildEmployeeGuardContext,
} from "../employee-guard-access";
import {
  mapPierreActionToGlobalActionType,
  evaluatePierreActionWithGlobalGuard,
  mapPierreRiskToGlobalRisk,
} from "../pierre-guard-bridge";
import type { GlobalGuardEvaluationInput } from "../global-guard-types";

// ── Helper ────────────────────────────────────────────────────────────────────
function makeInput(
  action_type: GlobalGuardEvaluationInput["action_type"],
  risk_level: GlobalGuardEvaluationInput["risk_level"] = "medium",
  employee_slug = "pierre",
): GlobalGuardEvaluationInput {
  return buildDefaultGlobalGuardInput({
    company_id: "test_co",
    employee_slug,
    action_type,
    risk_level,
  });
}

// ── 1. Fichiers sources ────────────────────────────────────────────────────────

describe("tech-06 — fichiers sources existent", () => {
  it("1. global-guard-types.ts existe", () => {
    expect(readSrc("global-guard-types.ts").length).toBeGreaterThan(500);
  });

  it("2. global-policy-defaults.ts existe", () => {
    expect(readSrc("global-policy-defaults.ts").length).toBeGreaterThan(500);
  });

  it("3. global-policy-evaluator.ts existe", () => {
    expect(readSrc("global-policy-evaluator.ts").length).toBeGreaterThan(200);
  });

  it("4. global-guard-evaluator.ts existe", () => {
    expect(readSrc("global-guard-evaluator.ts").length).toBeGreaterThan(200);
  });

  it("5. global-guard-validation.ts existe", () => {
    expect(readSrc("global-guard-validation.ts").length).toBeGreaterThan(200);
  });

  it("6. global-guard-snapshot.ts existe", () => {
    expect(readSrc("global-guard-snapshot.ts").length).toBeGreaterThan(200);
  });

  it("7. employee-guard-access.ts existe", () => {
    expect(readSrc("employee-guard-access.ts").length).toBeGreaterThan(200);
  });

  it("8. pierre-guard-bridge.ts existe", () => {
    expect(readSrc("pierre-guard-bridge.ts").length).toBeGreaterThan(200);
  });

  it("9. index.ts existe et exporte les fonctions principales", () => {
    const idx = readSrc("index.ts");
    expect(idx).toContain("evaluateGlobalGuard");
    expect(idx).toContain("DEFAULT_GLOBAL_POLICY_RULES");
    expect(idx).toContain("evaluatePierreActionWithGlobalGuard");
  });

  it("10. index.ts exporte buildGlobalGuardSnapshot", () => {
    expect(readSrc("index.ts")).toContain("buildGlobalGuardSnapshot");
  });
});

// ── 2. Règles par défaut ───────────────────────────────────────────────────────

describe("tech-06 — règles par défaut", () => {
  it("11. DEFAULT_GLOBAL_POLICY_RULES contient un bloqueur legal_decision", () => {
    const hasLegal = DEFAULT_GLOBAL_POLICY_RULES.some(
      (r) => r.action_types.includes("legal_decision") && r.blocks_execution,
    );
    expect(hasLegal).toBe(true);
  });

  it("12. DEFAULT_GLOBAL_POLICY_RULES contient un bloqueur payroll_execution", () => {
    const hasPayroll = DEFAULT_GLOBAL_POLICY_RULES.some(
      (r) => r.action_types.includes("payroll_execution") && r.blocks_execution,
    );
    expect(hasPayroll).toBe(true);
  });

  it("13. DEFAULT_GLOBAL_POLICY_RULES contient un bloqueur termination_decision", () => {
    const hasTermination = DEFAULT_GLOBAL_POLICY_RULES.some(
      (r) => r.action_types.includes("termination_decision") && r.blocks_execution,
    );
    expect(hasTermination).toBe(true);
  });

  it("14. DEFAULT_GLOBAL_POLICY_RULES contient un bloqueur contract_signature", () => {
    const hasContract = DEFAULT_GLOBAL_POLICY_RULES.some(
      (r) => r.action_types.includes("contract_signature") && r.blocks_execution,
    );
    expect(hasContract).toBe(true);
  });

  it("15. DEFAULT_GLOBAL_POLICY_RULES contient une règle trace_required", () => {
    const hasTrace = DEFAULT_GLOBAL_POLICY_RULES.some((r) => r.trace_required);
    expect(hasTrace).toBe(true);
  });
});

// ── 3. Validation des règles ───────────────────────────────────────────────────

describe("tech-06 — validation règles politiques", () => {
  it("16. validation accepte les règles par défaut (0 erreurs)", () => {
    const report = getGlobalGuardValidationReport(DEFAULT_GLOBAL_POLICY_RULES);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("17. validation rejette un rule_id vide", () => {
    const badRule = { ...DEFAULT_GLOBAL_POLICY_RULES[0], rule_id: "" };
    const issues = validateGlobalPolicyRule(badRule);
    expect(issues.some((i) => i.code === "V01")).toBe(true);
  });

  it("18. validation rejette une règle absolute allow pour action critique", () => {
    const badRule = {
      ...DEFAULT_GLOBAL_POLICY_RULES[0],
      rule_id: "bad_rule_test",
      effect: "allow" as const,
      severity: "absolute" as const,
    };
    const issues = validateGlobalPolicyRule(badRule);
    expect(issues.some((i) => i.code === "V19")).toBe(true);
  });
});

// ── 4. Évaluation — invariants absolus ─────────────────────────────────────────

describe("tech-06 — évaluation invariants absolus", () => {
  it("19. legal_decision → block ou refuse", () => {
    const result = evaluateGlobalGuard(makeInput("legal_decision"));
    expect(["block", "refuse"]).toContain(result.decision);
  });

  it("20. payroll_execution → block ou refuse", () => {
    const result = evaluateGlobalGuard(makeInput("payroll_execution"));
    expect(["block", "refuse"]).toContain(result.decision);
  });

  it("21. termination_decision → block ou refuse", () => {
    const result = evaluateGlobalGuard(makeInput("termination_decision"));
    expect(["block", "refuse"]).toContain(result.decision);
  });

  it("22. contract_signature → block ou refuse", () => {
    const result = evaluateGlobalGuard(makeInput("contract_signature"));
    expect(["block", "refuse"]).toContain(result.decision);
  });

  it("23. send_email high risk → require_validation", () => {
    const result = evaluateGlobalGuard(makeInput("send_email", "high"));
    expect(["require_validation", "block", "refuse"]).toContain(result.decision);
    expect(result.human_validation_required).toBe(true);
  });

  it("24. update_memory → human_validation_required = true", () => {
    const result = evaluateGlobalGuard(makeInput("update_memory"));
    expect(result.human_validation_required).toBe(true);
  });

  it("25. read_context low risk → can_execute ou can_prepare", () => {
    const result = evaluateGlobalGuard(makeInput("read_context", "low"));
    expect(result.can_prepare || result.can_execute).toBe(true);
  });

  it("26. draft_document high risk → prepare_only ou require_validation", () => {
    const result = evaluateGlobalGuard(makeInput("draft_document", "high"));
    expect(["prepare_only", "require_validation", "block", "refuse"]).toContain(result.decision);
  });
});

// ── 5. canExecuteGuardedAction ────────────────────────────────────────────────

describe("tech-06 — canExecuteGuardedAction", () => {
  it("27. legal_decision → can_execute = false", () => {
    expect(canExecuteGuardedAction(makeInput("legal_decision"))).toBe(false);
  });

  it("28. payroll_execution → can_execute = false", () => {
    expect(canExecuteGuardedAction(makeInput("payroll_execution"))).toBe(false);
  });

  it("29. termination_decision → can_execute = false", () => {
    expect(canExecuteGuardedAction(makeInput("termination_decision"))).toBe(false);
  });

  it("30. contract_signature → can_execute = false", () => {
    expect(canExecuteGuardedAction(makeInput("contract_signature"))).toBe(false);
  });
});

// ── 6. canPrepareGuardedAction ────────────────────────────────────────────────

describe("tech-06 — canPrepareGuardedAction", () => {
  it("31. draft_document low risk → can_prepare = true", () => {
    expect(canPrepareGuardedAction(makeInput("draft_document", "low"))).toBe(true);
  });
});

// ── 7. Snapshot ───────────────────────────────────────────────────────────────

describe("tech-06 — snapshot", () => {
  it("32. snapshot retourne les comptages de règles", () => {
    const snap = buildGlobalGuardSnapshot(DEFAULT_GLOBAL_POLICY_RULES);
    expect(snap.total_rules).toBe(DEFAULT_GLOBAL_POLICY_RULES.length);
    expect(snap.enabled_rules).toBeGreaterThan(0);
    expect(snap.blocker_rules).toBeGreaterThan(0);
    expect(snap.trace_required_rules).toBeGreaterThan(0);
  });

  it("33. snapshot.critical_invariants_ok = true avec règles par défaut", () => {
    const snap = buildGlobalGuardSnapshot(DEFAULT_GLOBAL_POLICY_RULES);
    expect(snap.critical_invariants_ok).toBe(true);
  });

  it("34. snapshot.coverage_score est entre 0 et 100", () => {
    const snap = buildGlobalGuardSnapshot(DEFAULT_GLOBAL_POLICY_RULES);
    expect(snap.coverage_score).toBeGreaterThanOrEqual(0);
    expect(snap.coverage_score).toBeLessThanOrEqual(100);
  });
});

// ── 8. Pierre Guard Bridge ────────────────────────────────────────────────────

describe("tech-06 — pierre guard bridge", () => {
  it("34. bridge mappe draft_hr_document → draft_document", () => {
    expect(mapPierreActionToGlobalActionType("draft_hr_document")).toBe("draft_document");
  });

  it("35. bridge mappe legal_or_disciplinary_decision → legal_decision", () => {
    expect(mapPierreActionToGlobalActionType("legal_or_disciplinary_decision")).toBe("legal_decision");
  });

  it("36. bridge bloque legal_or_disciplinary_decision via guard", () => {
    const result = evaluatePierreActionWithGlobalGuard({
      company_id: "test_co",
      pierre_action_type: "legal_or_disciplinary_decision",
    });
    expect(["block", "refuse"]).toContain(result.decision);
    expect(result.can_execute).toBe(false);
  });

  it("37. bridge mappe risque Pierre 'red' → 'high'", () => {
    expect(mapPierreRiskToGlobalRisk("red")).toBe("high");
  });

  it("38. bridge mappe risque Pierre 'black' → 'critical'", () => {
    expect(mapPierreRiskToGlobalRisk("black")).toBe("critical");
  });

  it("39. bridge mappe email.send vers send_email", () => {
    expect(mapPierreActionToGlobalActionType("email.send")).toBe("send_email");
  });

  it("40. bridge mappe payroll_official → payroll_execution (bloqué)", () => {
    const result = evaluatePierreActionWithGlobalGuard({
      company_id: "test_co",
      pierre_action_type: "payroll_official",
    });
    expect(["block", "refuse"]).toContain(result.decision);
  });
});

// ── 9. Employee Guard Access ──────────────────────────────────────────────────

describe("tech-06 — employee guard access", () => {
  it("41. Pierre est connu et actif", () => {
    const profile = getEmployeeGuardProfile("pierre");
    expect(profile.employee_slug).toBe("pierre");
    expect(profile.status).toBe("active");
  });

  it("42. employé inconnu reçoit accès minimal", () => {
    const profile = getEmployeeGuardProfile("unknown_ai_employee");
    expect(profile.status).toBe("disabled");
    expect(profile.allowed_action_types).toContain("read_context");
    expect(profile.allowed_action_types).not.toContain("send_email");
  });

  it("43. Pierre ne peut pas demander legal_decision", () => {
    expect(canEmployeeRequestAction("pierre", "legal_decision")).toBe(false);
  });

  it("44. Pierre ne peut pas demander payroll_execution", () => {
    expect(canEmployeeRequestAction("pierre", "payroll_execution")).toBe(false);
  });

  it("45. Pierre ne peut pas demander termination_decision", () => {
    expect(canEmployeeRequestAction("pierre", "termination_decision")).toBe(false);
  });

  it("46. Pierre ne peut pas demander contract_signature", () => {
    expect(canEmployeeRequestAction("pierre", "contract_signature")).toBe(false);
  });
});

// ── 10. Sécurité et conformité ────────────────────────────────────────────────

describe("tech-06 — sécurité et conformité", () => {
  it("47. pas d'appel OpenAI dans les sources", () => {
    const sources = [
      readSrc("global-guard-evaluator.ts"),
      readSrc("global-policy-evaluator.ts"),
      readSrc("pierre-guard-bridge.ts"),
    ].join("\n");
    expect(sources).not.toMatch(/openai\.com\/v1|new OpenAI\(/i);
  });

  it("48. pas d'appel Anthropic dans les sources", () => {
    const sources = [
      readSrc("global-guard-evaluator.ts"),
      readSrc("global-policy-evaluator.ts"),
    ].join("\n");
    expect(sources).not.toMatch(/anthropic\.com\/v1|new Anthropic\(/i);
  });

  it("49. pas de clé Stripe live dans les sources", () => {
    const sources = [
      readSrc("global-guard-types.ts"),
      readSrc("global-policy-defaults.ts"),
    ].join("\n");
    expect(sources).not.toMatch(/sk_live_|pk_live_/i);
  });
});

// ── 11. Documentation ─────────────────────────────────────────────────────────

describe("tech-06 — documentation", () => {
  let doc = "";
  try {
    doc = readDoc("TECH_06_CLONEGUARD_CLONEPOLICY_GLOBAL_RULES.md");
  } catch {
    doc = "";
  }

  it("45b. doc TECH_06 existe", () => {
    expect(doc.length).toBeGreaterThan(500);
  });

  it("46b. doc mentionne ClonePolicy interne", () => {
    expect(doc).toMatch(/ClonePolicy.*(interne|internal)/i);
  });

  it("47b. doc mentionne TECH-07", () => {
    expect(doc).toContain("TECH-07");
  });
});

// ── 12. TECH-03/04/05 toujours valides (smoke check) ─────────────────────────

describe("tech-06 — intégration TECH-05 invariants", () => {
  it("48. areAbsoluteInvariantsPresent retourne true pour DEFAULT_GLOBAL_POLICY_RULES", () => {
    expect(areAbsoluteInvariantsPresent(DEFAULT_GLOBAL_POLICY_RULES)).toBe(true);
  });

  it("49. areAbsoluteInvariantsPresent retourne false si legal_decision manque", () => {
    const rulesWithoutLegal = DEFAULT_GLOBAL_POLICY_RULES.filter(
      (r) => !r.action_types.includes("legal_decision"),
    );
    expect(areAbsoluteInvariantsPresent(rulesWithoutLegal)).toBe(false);
  });

  it("50. le rapport de validation a rule_count = DEFAULT_GLOBAL_POLICY_RULES.length", () => {
    const report = getGlobalGuardValidationReport(DEFAULT_GLOBAL_POLICY_RULES);
    expect(report.rule_count).toBe(DEFAULT_GLOBAL_POLICY_RULES.length);
    expect(report.ok).toBe(true);
  });
});
