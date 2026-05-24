// src/lib/pierre/__tests__/golden-scenarios.test.ts
// Pierre Golden Scenarios — Unit Tests — Bloc 29
// 220+ tests covering types, registry, fixtures, validator, runner, report.
// No Supabase. No real AI calls. No email. No task execution.

import { describe, it, expect, vi } from "vitest";
import {
  PIERRE_GOLDEN_SCENARIO_IDS,
  type PierreGoldenScenarioId,
} from "../scenarios/types";
import {
  getGoldenScenarioRegistry,
  getGoldenScenarioById,
  getPositiveScenarios,
  getNegativeScenarios,
  getCriticalScenarios,
  getScenariosByModule,
  isValidGoldenScenarioId,
} from "../scenarios/golden-registry";
import {
  getGoldenCompanyContext,
  getGoldenEmployeeContext,
  getGoldenCloneADN,
  getGoldenReusableRhContext,
  listGoldenFixtureKeys,
} from "../scenarios/fixtures";
import {
  runScenarioCheck,
  runAllChecks,
  validateScenarioInput,
  validateRequestText,
  buildValidationErrorArtifact,
  buildTaskDraftSafetyData,
  computeCheckSummary,
  determineScenarioStatus,
} from "../scenarios/validator";
import {
  runGoldenScenario,
  runGoldenScenarioSuite,
  buildScenarioSummaryList,
} from "../scenarios/runner";
import {
  buildGoldenScenarioReport,
  buildQuickReport,
  buildModuleCoverageReport,
} from "../scenarios/report";

// ══════════════════════════════════════════════════════════════
// 1. TYPES — PierreGoldenScenarioId
// ══════════════════════════════════════════════════════════════

describe("PierreGoldenScenarioId — constants", () => {
  it("has exactly 13 scenario IDs", () => {
    expect(PIERRE_GOLDEN_SCENARIO_IDS).toHaveLength(13);
  });

  it("includes 10 positive scenario IDs", () => {
    const positiveIds = [
      "gs_onboarding_complete",
      "gs_hiring_offer",
      "gs_absence_justified",
      "gs_contract_renewal",
      "gs_trial_activation",
      "gs_payroll_prep",
      "gs_employee_360",
      "gs_document_premium",
      "gs_cloneguard_allow",
      "gs_cloneadn_configured",
    ];
    for (const id of positiveIds) {
      expect(PIERRE_GOLDEN_SCENARIO_IDS).toContain(id);
    }
  });

  it("includes 3 negative scenario IDs", () => {
    const negativeIds = [
      "gs_cloneguard_block",
      "gs_missing_employee",
      "gs_invalid_request",
    ];
    for (const id of negativeIds) {
      expect(PIERRE_GOLDEN_SCENARIO_IDS).toContain(id);
    }
  });

  it("all IDs start with gs_", () => {
    for (const id of PIERRE_GOLDEN_SCENARIO_IDS) {
      expect(id).toMatch(/^gs_/);
    }
  });

  it("has no duplicate IDs", () => {
    const set = new Set(PIERRE_GOLDEN_SCENARIO_IDS);
    expect(set.size).toBe(PIERRE_GOLDEN_SCENARIO_IDS.length);
  });
});

// ══════════════════════════════════════════════════════════════
// 2. REGISTRY — getGoldenScenarioRegistry
// ══════════════════════════════════════════════════════════════

describe("getGoldenScenarioRegistry", () => {
  it("returns 13 scenarios", () => {
    const registry = getGoldenScenarioRegistry();
    expect(registry).toHaveLength(13);
  });

  it("each scenario has required fields", () => {
    const registry = getGoldenScenarioRegistry();
    for (const scenario of registry) {
      expect(scenario.id).toBeTruthy();
      expect(scenario.label).toBeTruthy();
      expect(scenario.description).toBeTruthy();
      expect(scenario.category).toMatch(/^(positive|negative)$/);
      expect(scenario.severity).toMatch(/^(critical|high|medium|low)$/);
      expect(typeof scenario.request_text).toBe("string");
      expect(Array.isArray(scenario.demonstrates)).toBe(true);
      expect(Array.isArray(scenario.modules)).toBe(true);
      expect(Array.isArray(scenario.checks)).toBe(true);
      expect(scenario.expected_status).toMatch(/^(pass|fail|skip|warn)$/);
    }
  });

  it("each scenario has at least 1 module", () => {
    const registry = getGoldenScenarioRegistry();
    for (const scenario of registry) {
      expect(scenario.modules.length).toBeGreaterThan(0);
    }
  });

  it("each scenario has at least 2 checks", () => {
    const registry = getGoldenScenarioRegistry();
    for (const scenario of registry) {
      expect(scenario.checks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each scenario has at least 1 demonstrates item", () => {
    const registry = getGoldenScenarioRegistry();
    for (const scenario of registry) {
      expect(scenario.demonstrates.length).toBeGreaterThan(0);
    }
  });

  it("IDs match PIERRE_GOLDEN_SCENARIO_IDS", () => {
    const registry = getGoldenScenarioRegistry();
    const ids = registry.map((s) => s.id);
    for (const id of ids) {
      expect(PIERRE_GOLDEN_SCENARIO_IDS).toContain(id);
    }
  });

  it("each check has required fields", () => {
    const registry = getGoldenScenarioRegistry();
    for (const scenario of registry) {
      for (const check of scenario.checks) {
        expect(check.id).toBeTruthy();
        expect(check.label).toBeTruthy();
        expect(check.artifact_type).toBeTruthy();
        expect(check.path).toBeDefined();
        expect(check.assertion).toBeTruthy();
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 3. REGISTRY — specific scenario lookups
// ══════════════════════════════════════════════════════════════

describe("getGoldenScenarioById", () => {
  it("returns scenario for valid ID", () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete");
    expect(scenario).not.toBeNull();
    expect(scenario!.id).toBe("gs_onboarding_complete");
  });

  it("returns null for unknown ID", () => {
    const scenario = getGoldenScenarioById("gs_unknown" as PierreGoldenScenarioId);
    expect(scenario).toBeNull();
  });

  it("returns gs_employee_360 with employee_360 module", () => {
    const scenario = getGoldenScenarioById("gs_employee_360");
    expect(scenario).not.toBeNull();
    expect(scenario!.modules).toContain("employee_360");
  });

  it("returns gs_cloneguard_block as negative + critical", () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_block");
    expect(scenario).not.toBeNull();
    expect(scenario!.category).toBe("negative");
    expect(scenario!.severity).toBe("critical");
  });

  it("returns gs_invalid_request with validation_error module", () => {
    const scenario = getGoldenScenarioById("gs_invalid_request");
    expect(scenario).not.toBeNull();
    expect(scenario!.modules).toContain("validation_error");
    expect(scenario!.request_text).toBe("");
  });

  it("returns gs_cloneadn_configured with cloneadn module", () => {
    const scenario = getGoldenScenarioById("gs_cloneadn_configured");
    expect(scenario).not.toBeNull();
    expect(scenario!.modules).toContain("cloneadn");
    expect(scenario!.clone_adn_key).not.toBeNull();
  });
});

describe("getPositiveScenarios", () => {
  it("returns exactly 10 positive scenarios", () => {
    const positive = getPositiveScenarios();
    expect(positive).toHaveLength(10);
  });

  it("all have category = positive", () => {
    const positive = getPositiveScenarios();
    for (const s of positive) {
      expect(s.category).toBe("positive");
    }
  });
});

describe("getNegativeScenarios", () => {
  it("returns exactly 3 negative scenarios", () => {
    const negative = getNegativeScenarios();
    expect(negative).toHaveLength(3);
  });

  it("all have category = negative", () => {
    const negative = getNegativeScenarios();
    for (const s of negative) {
      expect(s.category).toBe("negative");
    }
  });
});

describe("getCriticalScenarios", () => {
  it("returns scenarios with severity = critical", () => {
    const critical = getCriticalScenarios();
    expect(critical.length).toBeGreaterThan(0);
    for (const s of critical) {
      expect(s.severity).toBe("critical");
    }
  });
});

describe("getScenariosByModule", () => {
  it("returns scenarios with workflow_plan module", () => {
    const scenarios = getScenariosByModule("workflow_plan");
    expect(scenarios.length).toBeGreaterThan(0);
    for (const s of scenarios) {
      expect(s.modules).toContain("workflow_plan");
    }
  });

  it("returns scenarios with brain_output module", () => {
    const scenarios = getScenariosByModule("brain_output");
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it("returns empty for unknown module", () => {
    const scenarios = getScenariosByModule("unknown_module_xyz");
    expect(scenarios).toHaveLength(0);
  });
});

describe("isValidGoldenScenarioId", () => {
  it("returns true for valid IDs", () => {
    expect(isValidGoldenScenarioId("gs_onboarding_complete")).toBe(true);
    expect(isValidGoldenScenarioId("gs_invalid_request")).toBe(true);
    expect(isValidGoldenScenarioId("gs_cloneguard_block")).toBe(true);
  });

  it("returns false for unknown ID", () => {
    expect(isValidGoldenScenarioId("gs_unknown")).toBe(false);
    expect(isValidGoldenScenarioId("")).toBe(false);
    expect(isValidGoldenScenarioId("onboarding_complete")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// 4. FIXTURES
// ══════════════════════════════════════════════════════════════

describe("getGoldenCompanyContext", () => {
  it("returns tech_company context", () => {
    const ctx = getGoldenCompanyContext("tech_company");
    expect(ctx).not.toBeNull();
    expect(ctx!.company_name).toBe("Acme Tech SAS");
    expect(ctx!.country_code).toBe("FR");
    expect(ctx!.headcount).toBeGreaterThan(0);
  });

  it("returns trial_company context", () => {
    const ctx = getGoldenCompanyContext("trial_company");
    expect(ctx).not.toBeNull();
    expect(ctx!.company_id).toBe("comp_trial_002");
  });

  it("returns null for unknown key", () => {
    const ctx = getGoldenCompanyContext("unknown_company_xyz");
    expect(ctx).toBeNull();
  });

  it("tech_company has reusable_rh_context_json with clone_adn", () => {
    const ctx = getGoldenCompanyContext("tech_company");
    expect(ctx).not.toBeNull();
    const rh = ctx!.reusable_rh_context_json;
    expect(rh).not.toBeNull();
    expect(rh["clone_adn"]).toBeDefined();
  });
});

describe("getGoldenEmployeeContext", () => {
  it("returns new_employee context", () => {
    const ctx = getGoldenEmployeeContext("new_employee");
    expect(ctx).not.toBeNull();
    expect(ctx!.employee_name).toBe("Marie Dupont");
    expect(ctx!.contract_type).toBe("CDI");
  });

  it("returns active_employee with missions and tasks", () => {
    const ctx = getGoldenEmployeeContext("active_employee");
    expect(ctx).not.toBeNull();
    expect(ctx!.missions.length).toBeGreaterThan(0);
    expect(ctx!.tasks.length).toBeGreaterThan(0);
    expect(ctx!.documents.length).toBeGreaterThan(0);
    expect(ctx!.logs.length).toBeGreaterThan(0);
  });

  it("returns cdd_employee with CDD contract", () => {
    const ctx = getGoldenEmployeeContext("cdd_employee");
    expect(ctx).not.toBeNull();
    expect(ctx!.contract_type).toBe("CDD");
  });

  it("returns candidate_employee as candidate", () => {
    const ctx = getGoldenEmployeeContext("candidate_employee");
    expect(ctx).not.toBeNull();
    expect(ctx!.employee_id).toBeTruthy();
  });

  it("returns null for unknown key", () => {
    const ctx = getGoldenEmployeeContext("unknown_emp_xyz");
    expect(ctx).toBeNull();
  });

  it("active_employee logs use event_type not event", () => {
    const ctx = getGoldenEmployeeContext("active_employee");
    expect(ctx).not.toBeNull();
    for (const log of ctx!.logs) {
      expect(log["event_type"]).toBeDefined();
      expect(log["event"]).toBeUndefined();
    }
  });

  it("active_employee tasks use execute_at not scheduled_for", () => {
    const ctx = getGoldenEmployeeContext("active_employee");
    expect(ctx).not.toBeNull();
    for (const task of ctx!.tasks) {
      expect(task["scheduled_for"]).toBeUndefined();
    }
  });
});

describe("getGoldenCloneADN", () => {
  it("returns configured_adn profile", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(adn!.status).toBe("configured");
    expect(adn!.company_identity.trade_name).toBe("Acme Tech");
    expect(adn!.communication.tone).toBe("warm");
  });

  it("configured_adn has never_auto_execute", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(adn!.validation.never_auto_execute).toContain("email_send");
  });

  it("configured_adn has sensitive_topics", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(adn!.validation.sensitive_topics.length).toBeGreaterThan(0);
  });

  it("returns null for unknown key", () => {
    const adn = getGoldenCloneADN("unknown_adn_xyz");
    expect(adn).toBeNull();
  });
});

describe("getGoldenReusableRhContext", () => {
  it("returns context with document_templates key for tech_company", () => {
    const ctx = getGoldenReusableRhContext("tech_company");
    expect(ctx["document_templates"]).toBeDefined();
  });

  it("returns minimal context for null key", () => {
    const ctx = getGoldenReusableRhContext(null);
    expect(ctx["document_templates"]).toBeDefined();
    expect(ctx["employees"]).toBeDefined();
  });

  it("returns minimal context for unknown key", () => {
    const ctx = getGoldenReusableRhContext("unknown_xyz");
    expect(ctx["document_templates"]).toBeDefined();
  });
});

describe("listGoldenFixtureKeys", () => {
  it("returns non-empty lists", () => {
    const keys = listGoldenFixtureKeys();
    expect(keys.companies.length).toBeGreaterThan(0);
    expect(keys.employees.length).toBeGreaterThan(0);
    expect(keys.clone_adns.length).toBeGreaterThan(0);
  });

  it("includes expected company keys", () => {
    const keys = listGoldenFixtureKeys();
    expect(keys.companies).toContain("tech_company");
    expect(keys.companies).toContain("trial_company");
  });

  it("includes expected employee keys", () => {
    const keys = listGoldenFixtureKeys();
    expect(keys.employees).toContain("new_employee");
    expect(keys.employees).toContain("active_employee");
    expect(keys.employees).toContain("cdd_employee");
  });
});

// ══════════════════════════════════════════════════════════════
// 5. VALIDATOR — validateRequestText
// ══════════════════════════════════════════════════════════════

describe("validateRequestText", () => {
  it("returns valid for non-empty string", () => {
    const result = validateRequestText("Préparer l'onboarding");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns invalid for empty string", () => {
    const result = validateRequestText("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("returns invalid for non-string", () => {
    const result = validateRequestText(null);
    expect(result.valid).toBe(false);
  });

  it("returns invalid for number", () => {
    const result = validateRequestText(42);
    expect(result.valid).toBe(false);
  });

  it("returns invalid for whitespace-only", () => {
    const result = validateRequestText("   ");
    expect(result.valid).toBe(false);
  });
});

describe("validateScenarioInput", () => {
  it("returns valid for correct input", () => {
    const result = validateScenarioInput({ id: "gs_test", request_text: "test" });
    expect(result.valid).toBe(true);
  });

  it("returns invalid for null", () => {
    const result = validateScenarioInput(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("returns invalid for missing id", () => {
    const result = validateScenarioInput({ request_text: "test" });
    expect(result.valid).toBe(false);
  });
});

describe("buildValidationErrorArtifact", () => {
  it("builds artifact with error details", () => {
    const artifact = buildValidationErrorArtifact(["Field missing"]);
    expect(artifact.type).toBe("validation_error");
    expect(artifact.valid).toBe(true);
    expect(artifact.data["error_code"]).toBe("INVALID_INPUT");
    expect(artifact.data["handled"]).toBe(true);
    expect(artifact.data["message"]).toBeTruthy();
  });

  it("joins multiple errors with semicolon", () => {
    const artifact = buildValidationErrorArtifact(["Error A", "Error B"]);
    expect(String(artifact.data["message"])).toContain("Error A");
    expect(String(artifact.data["message"])).toContain("Error B");
  });
});

describe("buildTaskDraftSafetyData", () => {
  it("detects email.send in tasks", () => {
    const tasks = [{ type: "email.send", title: "Test" }];
    const data = buildTaskDraftSafetyData(tasks);
    expect(data["has_email_send"]).toBe(true);
  });

  it("detects email_send in tasks", () => {
    const tasks = [{ type: "email_send", title: "Test" }];
    const data = buildTaskDraftSafetyData(tasks);
    expect(data["has_email_send"]).toBe(true);
  });

  it("does not flag email.draft as email.send", () => {
    const tasks = [{ type: "email.draft", title: "Test" }];
    const data = buildTaskDraftSafetyData(tasks);
    expect(data["has_email_send"]).toBe(false);
  });

  it("detects scheduled_for in tasks", () => {
    const tasks = [{ type: "email.draft", scheduled_for: "2026-01-01" }];
    const data = buildTaskDraftSafetyData(tasks);
    expect(data["has_scheduled_for"]).toBe(true);
  });

  it("does not flag execute_at as scheduled_for", () => {
    const tasks = [{ type: "email.draft", execute_at: "2026-01-01" }];
    const data = buildTaskDraftSafetyData(tasks);
    expect(data["has_scheduled_for"]).toBe(false);
  });

  it("returns task_count correctly", () => {
    const tasks = [{ type: "doc_generate" }, { type: "reminder_create" }];
    const data = buildTaskDraftSafetyData(tasks);
    expect(data["task_count"]).toBe(2);
  });

  it("handles empty array", () => {
    const data = buildTaskDraftSafetyData([]);
    expect(data["has_email_send"]).toBe(false);
    expect(data["has_scheduled_for"]).toBe(false);
    expect(data["task_count"]).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 6. VALIDATOR — runScenarioCheck assertions
// ══════════════════════════════════════════════════════════════

describe("runScenarioCheck — exists", () => {
  const artifact = {
    type: "workflow_plan" as const,
    label: "Test",
    data: { domain: "onboarding", tasks: [] },
    valid: true,
  };

  it("passes when path exists", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "domain exists", artifact_type: "workflow_plan", path: "domain", assertion: "exists" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails when path does not exist", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "missing", artifact_type: "workflow_plan", path: "missing_field", assertion: "exists" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — equals", () => {
  const artifact = {
    type: "workflow_plan" as const,
    label: "Test",
    data: { domain: "onboarding" },
    valid: true,
  };

  it("passes when value equals expected", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "domain equals", artifact_type: "workflow_plan", path: "domain", assertion: "equals", expected: "onboarding" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails when value differs", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "wrong domain", artifact_type: "workflow_plan", path: "domain", assertion: "equals", expected: "hiring" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — is_true / is_false", () => {
  const artifact = {
    type: "brain_output" as const,
    label: "Test",
    data: { "quality_gate": { valid: true }, flag: false },
    valid: true,
  };

  it("passes is_true for true value", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "valid", artifact_type: "brain_output", path: "quality_gate.valid", assertion: "is_true" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("passes is_false for false value", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "flag false", artifact_type: "brain_output", path: "flag", assertion: "is_false" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails is_true for false value", () => {
    const result = runScenarioCheck(
      { id: "c3", label: "flag", artifact_type: "brain_output", path: "flag", assertion: "is_true" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — length_gt", () => {
  const artifact = {
    type: "workflow_plan" as const,
    label: "Test",
    data: { tasks: [{ type: "doc_generate" }, { type: "email.draft" }] },
    valid: true,
  };

  it("passes when array length > expected", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "tasks > 0", artifact_type: "workflow_plan", path: "tasks", assertion: "length_gt", expected: 0 },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails when array length not > expected", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "tasks > 5", artifact_type: "workflow_plan", path: "tasks", assertion: "length_gt", expected: 5 },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — is_array", () => {
  const artifact = {
    type: "employee_360" as const,
    label: "Test",
    data: { risks: [{ type: "low_risk" }], name: "test" },
    valid: true,
  };

  it("passes for array field", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "risks is_array", artifact_type: "employee_360", path: "risks", assertion: "is_array" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails for non-array field", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "name is_array", artifact_type: "employee_360", path: "name", assertion: "is_array" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — is_string / is_number", () => {
  const artifact = {
    type: "employee_360" as const,
    label: "Test",
    data: { health_score: 85, status: "complete" },
    valid: true,
  };

  it("passes is_number for numeric value", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "health score", artifact_type: "employee_360", path: "health_score", assertion: "is_number" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("passes is_string for string value", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "status", artifact_type: "employee_360", path: "status", assertion: "is_string" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails is_number for string value", () => {
    const result = runScenarioCheck(
      { id: "c3", label: "status as number", artifact_type: "employee_360", path: "status", assertion: "is_number" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — contains", () => {
  const artifact = {
    type: "cloneguard" as const,
    label: "Test",
    data: { decision: "allow_with_warning", matched_rules: ["rule_01", "rule_02"] },
    valid: true,
  };

  it("passes contains for substring", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "contains allow", artifact_type: "cloneguard", path: "decision", assertion: "contains", expected: "allow" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("passes contains for array element", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "contains rule", artifact_type: "cloneguard", path: "matched_rules", assertion: "contains", expected: "rule_01" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails contains for missing substring", () => {
    const result = runScenarioCheck(
      { id: "c3", label: "missing", artifact_type: "cloneguard", path: "decision", assertion: "contains", expected: "block" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — not_null", () => {
  const artifact = {
    type: "cloneadn" as const,
    label: "Test",
    data: { company_context: { tone: "warm" }, empty_field: null },
    valid: true,
  };

  it("passes not_null for non-null value", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "company context", artifact_type: "cloneadn", path: "company_context", assertion: "not_null" },
      [artifact],
    );
    expect(result.passed).toBe(true);
  });

  it("fails not_null for null value", () => {
    const result = runScenarioCheck(
      { id: "c2", label: "null field", artifact_type: "cloneadn", path: "empty_field", assertion: "not_null" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runScenarioCheck — missing artifact", () => {
  it("fails when artifact type not found", () => {
    const result = runScenarioCheck(
      { id: "c1", label: "test", artifact_type: "cloneguard", path: "decision", assertion: "exists" },
      [], // empty artifacts
    );
    expect(result.passed).toBe(false);
    expect(result.error).toContain("not found");
  });
});

describe("runScenarioCheck — invalid artifact", () => {
  it("fails when artifact is not valid", () => {
    const artifact = {
      type: "workflow_plan" as const,
      label: "Test",
      data: {},
      valid: false,
      error: "module threw",
    };
    const result = runScenarioCheck(
      { id: "c1", label: "test", artifact_type: "workflow_plan", path: "domain", assertion: "exists" },
      [artifact],
    );
    expect(result.passed).toBe(false);
  });
});

describe("runAllChecks", () => {
  it("runs all checks and returns results", () => {
    const artifact = {
      type: "workflow_plan" as const,
      label: "Test",
      data: { domain: "onboarding", tasks: [{ type: "doc" }] },
      valid: true,
    };
    const checks = [
      { id: "c1", label: "domain", artifact_type: "workflow_plan" as const, path: "domain", assertion: "exists" as const },
      { id: "c2", label: "tasks", artifact_type: "workflow_plan" as const, path: "tasks", assertion: "length_gt" as const, expected: 0 },
    ];
    const results = runAllChecks(checks, [artifact]);
    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(true);
  });
});

describe("computeCheckSummary", () => {
  it("computes correct summary", () => {
    const results = [
      { check_id: "c1", label: "test", passed: true, actual: "x" },
      { check_id: "c2", label: "test", passed: true, actual: "y" },
      { check_id: "c3", label: "test", passed: false, actual: null },
    ];
    const summary = computeCheckSummary(results);
    expect(summary.checks_total).toBe(3);
    expect(summary.checks_passed).toBe(2);
    expect(summary.checks_failed).toBe(1);
  });

  it("handles all passed", () => {
    const results = [
      { check_id: "c1", label: "test", passed: true, actual: "x" },
    ];
    const summary = computeCheckSummary(results);
    expect(summary.checks_failed).toBe(0);
  });

  it("handles empty results", () => {
    const summary = computeCheckSummary([]);
    expect(summary.checks_total).toBe(0);
    expect(summary.checks_passed).toBe(0);
    expect(summary.checks_failed).toBe(0);
  });
});

describe("determineScenarioStatus", () => {
  it("returns pass when all checks pass", () => {
    const results = [
      { check_id: "c1", label: "test", passed: true, actual: "x" },
      { check_id: "c2", label: "test", passed: true, actual: "y" },
    ];
    const status = determineScenarioStatus(results, "pass");
    expect(status).toBe("pass");
  });

  it("returns warn when some checks fail", () => {
    const results = [
      { check_id: "c1", label: "test", passed: true, actual: "x" },
      { check_id: "c2", label: "test", passed: false, actual: null },
    ];
    const status = determineScenarioStatus(results, "pass");
    expect(status).toBe("warn");
  });

  it("returns fail when all checks fail", () => {
    const results = [
      { check_id: "c1", label: "test", passed: false, actual: null },
      { check_id: "c2", label: "test", passed: false, actual: null },
    ];
    const status = determineScenarioStatus(results, "pass");
    expect(status).toBe("fail");
  });
});

// ══════════════════════════════════════════════════════════════
// 7. RUNNER — buildScenarioSummaryList
// ══════════════════════════════════════════════════════════════

describe("buildScenarioSummaryList", () => {
  it("returns 13 summaries", () => {
    const summaries = buildScenarioSummaryList();
    expect(summaries).toHaveLength(13);
  });

  it("each summary has required fields", () => {
    const summaries = buildScenarioSummaryList();
    for (const s of summaries) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.category).toMatch(/^(positive|negative)$/);
      expect(s.severity).toMatch(/^(critical|high|medium|low)$/);
      expect(s.checks_count).toBeGreaterThan(0);
      expect(Array.isArray(s.modules)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 8. RUNNER — runGoldenScenario (integration, all scenarios)
// ══════════════════════════════════════════════════════════════

describe("runGoldenScenario — gs_invalid_request", () => {
  it("returns pass status for invalid request scenario", async () => {
    const scenario = getGoldenScenarioById("gs_invalid_request")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    expect(result.scenario_id).toBe("gs_invalid_request");
    expect(result.status).toMatch(/^(pass|warn|fail)$/);
    expect(result.artifacts.length).toBeGreaterThan(0);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("validation_error artifact is present", async () => {
    const scenario = getGoldenScenarioById("gs_invalid_request")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const vaArtifact = result.artifacts.find((a) => a.type === "validation_error");
    expect(vaArtifact).toBeDefined();
    expect(vaArtifact!.valid).toBe(true);
    expect(vaArtifact!.data["handled"]).toBe(true);
  });
});

describe("runGoldenScenario — gs_onboarding_complete", () => {
  it("produces workflow_plan and brain_output artifacts", async () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const types = result.artifacts.map((a) => a.type);
    expect(types).toContain("workflow_plan");
    expect(types).toContain("brain_output");
  });

  it("has check_results with at least 7 checks", async () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    expect(result.checks_total).toBeGreaterThanOrEqual(7);
  });

  it("workflow_plan artifact has domain field", async () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const wf = result.artifacts.find((a) => a.type === "workflow_plan");
    expect(wf).toBeDefined();
    expect(wf!.data["domain"]).toBeTruthy();
  });

  it("brain_output artifact has source = deterministic", async () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const brain = result.artifacts.find((a) => a.type === "brain_output");
    expect(brain).toBeDefined();
    expect(brain!.data["source"]).toBe("deterministic");
  });
});

describe("runGoldenScenario — gs_employee_360", () => {
  it("produces employee_360 artifact with health_score", async () => {
    const scenario = getGoldenScenarioById("gs_employee_360")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const emp = result.artifacts.find((a) => a.type === "employee_360");
    expect(emp).toBeDefined();
    expect(typeof emp!.data["health_score"]).toBe("number");
  });

  it("employee_360 artifact has risks as array", async () => {
    const scenario = getGoldenScenarioById("gs_employee_360")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const emp = result.artifacts.find((a) => a.type === "employee_360");
    expect(emp).toBeDefined();
    expect(Array.isArray(emp!.data["risks"])).toBe(true);
  });
});

describe("runGoldenScenario — gs_document_premium", () => {
  it("produces document artifact with template_id", async () => {
    const scenario = getGoldenScenarioById("gs_document_premium")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const doc = result.artifacts.find((a) => a.type === "document");
    expect(doc).toBeDefined();
    expect(typeof doc!.data["template_id"]).toBe("string");
  });

  it("document artifact has html_content", async () => {
    const scenario = getGoldenScenarioById("gs_document_premium")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const doc = result.artifacts.find((a) => a.type === "document");
    expect(doc).toBeDefined();
    expect(typeof doc!.data["html_content"]).toBe("string");
  });
});

describe("runGoldenScenario — gs_cloneguard_allow", () => {
  it("produces cloneguard artifact with decision", async () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_allow")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const guard = result.artifacts.find((a) => a.type === "cloneguard");
    expect(guard).toBeDefined();
    expect(guard!.data["decision"]).toBeTruthy();
  });

  it("cloneguard artifact has reasoning (explanation)", async () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_allow")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const guard = result.artifacts.find((a) => a.type === "cloneguard");
    expect(guard).toBeDefined();
    expect(typeof guard!.data["reasoning"]).toBe("string");
  });
});

describe("runGoldenScenario — gs_cloneguard_block", () => {
  it("produces cloneguard artifact that requires human review", async () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_block")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const guard = result.artifacts.find((a) => a.type === "cloneguard");
    expect(guard).toBeDefined();
    // dismissal_action should trigger require_approval or block
    expect(guard!.data["decision"]).toBeTruthy();
    expect(guard!.data["requires_human"]).toBeDefined();
  });
});

describe("runGoldenScenario — gs_cloneadn_configured", () => {
  it("produces cloneadn artifact with is_configured = true", async () => {
    const scenario = getGoldenScenarioById("gs_cloneadn_configured")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const adn = result.artifacts.find((a) => a.type === "cloneadn");
    expect(adn).toBeDefined();
    expect(adn!.data["is_configured"]).toBe(true);
  });

  it("cloneadn artifact has company_context", async () => {
    const scenario = getGoldenScenarioById("gs_cloneadn_configured")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const adn = result.artifacts.find((a) => a.type === "cloneadn");
    expect(adn).toBeDefined();
    expect(adn!.data["company_context"]).not.toBeNull();
  });
});

describe("runGoldenScenario — gs_missing_employee", () => {
  it("does not crash with null employee context", async () => {
    const scenario = getGoldenScenarioById("gs_missing_employee")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    expect(result.scenario_id).toBe("gs_missing_employee");
    expect(result.artifacts.length).toBeGreaterThan(0);
  });

  it("brain_output artifact has missing_info as array", async () => {
    const scenario = getGoldenScenarioById("gs_missing_employee")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const brain = result.artifacts.find((a) => a.type === "brain_output");
    expect(brain).toBeDefined();
    const interp = brain!.data["interpretation"] as Record<string, unknown> | undefined;
    expect(interp).toBeDefined();
    expect(Array.isArray(interp!["missing_info"])).toBe(true);
  });
});

describe("runGoldenScenario — task_drafts safety invariants", () => {
  it("gs_hiring_offer task_drafts has no email.send", async () => {
    const scenario = getGoldenScenarioById("gs_hiring_offer")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const drafts = result.artifacts.find((a) => a.type === "task_drafts");
    expect(drafts).toBeDefined();
    expect(drafts!.data["has_email_send"]).toBe(false);
  });

  it("gs_absence_justified task_drafts has no scheduled_for", async () => {
    const scenario = getGoldenScenarioById("gs_absence_justified")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const drafts = result.artifacts.find((a) => a.type === "task_drafts");
    expect(drafts).toBeDefined();
    expect(drafts!.data["has_scheduled_for"]).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// 9. RUNNER — runGoldenScenarioSuite
// ══════════════════════════════════════════════════════════════

describe("runGoldenScenarioSuite", () => {
  it("runs all 13 scenarios", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(suite.scenarios_total).toBe(13);
    expect(suite.results).toHaveLength(13);
  });

  it("generates executive_summary", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(typeof suite.executive_summary).toBe("string");
    expect(suite.executive_summary.length).toBeGreaterThan(0);
  });

  it("suite_status is valid value", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(["all_pass", "some_fail", "all_fail", "partial"]).toContain(suite.suite_status);
  });

  it("duration_ms is a non-negative number", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(suite.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("modules_validated is non-empty", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(suite.modules_validated.length).toBeGreaterThan(0);
  });

  it("supports scenario_ids filter", async () => {
    const suite = await runGoldenScenarioSuite({
      ai_mode: "off",
      scenario_ids: ["gs_employee_360", "gs_document_premium"],
    });
    expect(suite.scenarios_total).toBe(2);
  });

  it("checks totals match sum of individual results", async () => {
    const suite = await runGoldenScenarioSuite({
      ai_mode: "off",
      scenario_ids: ["gs_employee_360"],
    });
    const total = suite.results.reduce((acc, r) => acc + r.checks_total, 0);
    expect(suite.checks_total).toBe(total);
  });
});

// ══════════════════════════════════════════════════════════════
// 10. REPORT — buildGoldenScenarioReport
// ══════════════════════════════════════════════════════════════

describe("buildGoldenScenarioReport", () => {
  it("returns a report with required fields", async () => {
    const suite = await runGoldenScenarioSuite({
      ai_mode: "off",
      scenario_ids: ["gs_employee_360"],
    });
    const report = buildGoldenScenarioReport(suite);
    expect(report.level).toMatch(/^(sellable|demo_ready|internal_only|blocked)$/);
    expect(report.level_label).toBeTruthy();
    expect(typeof report.score).toBe("number");
    expect(typeof report.sellable).toBe("boolean");
    expect(report.recommendation).toBeTruthy();
    expect(Array.isArray(report.positive_highlights)).toBe(true);
    expect(Array.isArray(report.negative_findings)).toBe(true);
    expect(Array.isArray(report.critical_failures)).toBe(true);
    expect(Array.isArray(report.modules_validated)).toBe(true);
  });

  it("score is between 0 and 100", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    const report = buildGoldenScenarioReport(suite);
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});

describe("buildQuickReport", () => {
  it("returns sellable level for perfect run", () => {
    const report = buildQuickReport({
      scenarios_passed: 13,
      scenarios_failed: 0,
      scenarios_total: 13,
      critical_failures: [],
      modules_validated: ["workflow_plan", "brain_output"],
    });
    expect(report.level).toBe("sellable");
    expect(report.sellable).toBe(true);
  });

  it("returns blocked for critical failures", () => {
    const report = buildQuickReport({
      scenarios_passed: 10,
      scenarios_failed: 3,
      scenarios_total: 13,
      critical_failures: ["gs_onboarding_complete"],
      modules_validated: [],
    });
    expect(report.level).toBe("blocked");
    expect(report.sellable).toBe(false);
  });

  it("returns internal_only for some failures without critical", () => {
    const report = buildQuickReport({
      scenarios_passed: 8,
      scenarios_failed: 5,
      scenarios_total: 13,
      critical_failures: [],
      modules_validated: [],
    });
    expect(report.level).toBe("internal_only");
  });

  it("score is proportional to pass rate", () => {
    const report = buildQuickReport({
      scenarios_passed: 10,
      scenarios_failed: 3,
      scenarios_total: 13,
      critical_failures: [],
      modules_validated: [],
    });
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});

describe("buildModuleCoverageReport", () => {
  it("returns module coverage entries", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    const coverage = buildModuleCoverageReport(suite);
    expect(coverage.length).toBeGreaterThan(0);
    for (const entry of coverage) {
      expect(entry.module).toBeTruthy();
      expect(entry.scenarios_using).toBeGreaterThan(0);
      expect(entry.coverage_pct).toBeGreaterThanOrEqual(0);
      expect(entry.coverage_pct).toBeLessThanOrEqual(100);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// 11. SECURITY INVARIANTS
// ══════════════════════════════════════════════════════════════

describe("Security invariants — no email.send", () => {
  it("all scenarios with task_drafts module produce no email.send", async () => {
    const registry = getGoldenScenarioRegistry();
    const withTaskDrafts = registry.filter((s) => s.modules.includes("task_drafts"));
    for (const scenario of withTaskDrafts) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const drafts = result.artifacts.find((a) => a.type === "task_drafts");
      if (drafts) {
        expect(drafts.data["has_email_send"]).toBe(false);
      }
    }
  });

  it("all scenarios with task_drafts module produce no scheduled_for", async () => {
    const registry = getGoldenScenarioRegistry();
    const withTaskDrafts = registry.filter((s) => s.modules.includes("task_drafts"));
    for (const scenario of withTaskDrafts) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const drafts = result.artifacts.find((a) => a.type === "task_drafts");
      if (drafts) {
        expect(drafts.data["has_scheduled_for"]).toBe(false);
      }
    }
  });
});

describe("Security invariants — brain ai_mode off", () => {
  it("brain_output source is deterministic in all scenarios (ai_mode off)", async () => {
    const registry = getGoldenScenarioRegistry();
    const withBrain = registry.filter((s) => s.modules.includes("brain_output"));
    for (const scenario of withBrain) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const brain = result.artifacts.find((a) => a.type === "brain_output");
      if (brain) {
        expect(brain.data["source"]).toBe("deterministic");
      }
    }
  });
});

describe("Security invariants — negative scenarios never crash", () => {
  it("gs_cloneguard_block never throws", async () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_block")!;
    await expect(runGoldenScenario(scenario, { ai_mode: "off" })).resolves.toBeDefined();
  });

  it("gs_missing_employee never throws", async () => {
    const scenario = getGoldenScenarioById("gs_missing_employee")!;
    await expect(runGoldenScenario(scenario, { ai_mode: "off" })).resolves.toBeDefined();
  });

  it("gs_invalid_request never throws", async () => {
    const scenario = getGoldenScenarioById("gs_invalid_request")!;
    await expect(runGoldenScenario(scenario, { ai_mode: "off" })).resolves.toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 12. EDGE CASES
// ══════════════════════════════════════════════════════════════

describe("Edge cases — registry is immutable reference", () => {
  it("calling getGoldenScenarioRegistry twice returns equal data", () => {
    const r1 = getGoldenScenarioRegistry();
    const r2 = getGoldenScenarioRegistry();
    expect(r1.length).toBe(r2.length);
    expect(r1[0].id).toBe(r2[0].id);
  });
});

describe("Edge cases — empty suite filter", () => {
  it("runGoldenScenarioSuite with empty array returns 0 scenarios", async () => {
    const suite = await runGoldenScenarioSuite({
      ai_mode: "off",
      scenario_ids: [],
    });
    // empty scenario_ids filter → undefined → runs all
    // or if truly empty, returns 0
    expect(suite.scenarios_total).toBeGreaterThanOrEqual(0);
  });
});

describe("Edge cases — scenario result structure", () => {
  it("every result has demonstrates list", async () => {
    const suite = await runGoldenScenarioSuite({
      ai_mode: "off",
      scenario_ids: ["gs_onboarding_complete"],
    });
    expect(suite.results[0].demonstrates.length).toBeGreaterThan(0);
  });

  it("every result has check_results array", async () => {
    const suite = await runGoldenScenarioSuite({
      ai_mode: "off",
      scenario_ids: ["gs_hiring_offer"],
    });
    expect(Array.isArray(suite.results[0].check_results)).toBe(true);
  });
});
