// src/lib/pierre/__tests__/golden-scenarios-crossblock.test.ts
// Pierre Golden Scenarios — Cross-bloc Regression Tests — Bloc 29
// Verifies that golden scenarios exercise all previous blocs correctly.
// No Supabase. No real AI calls. No email. No task execution.

import { describe, it, expect } from "vitest";
import {
  getGoldenScenarioRegistry,
  getGoldenScenarioById,
} from "../scenarios/golden-registry";
import { runGoldenScenario, runGoldenScenarioSuite } from "../scenarios/runner";
import {
  getGoldenCloneADN,
  getGoldenCompanyContext,
  getGoldenEmployeeContext,
} from "../scenarios/fixtures";
import { buildGoldenScenarioReport } from "../scenarios/report";

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: BRAIN FINAL (Bloc 26)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 26 — Brain Final Core", () => {
  it("brain produces interpretation with intent in all brain scenarios", async () => {
    const registry = getGoldenScenarioRegistry();
    const withBrain = registry.filter((s) => s.modules.includes("brain_output"));
    for (const scenario of withBrain) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const brain = result.artifacts.find((a) => a.type === "brain_output");
      if (!brain) continue;
      const interp = brain.data["interpretation"] as Record<string, unknown>;
      expect(interp).toBeDefined();
      expect(typeof interp["intent"]).toBe("string");
    }
  });

  it("brain quality gate is present in all brain scenarios", async () => {
    const registry = getGoldenScenarioRegistry();
    const withBrain = registry.filter((s) => s.modules.includes("brain_output"));
    for (const scenario of withBrain) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const brain = result.artifacts.find((a) => a.type === "brain_output");
      if (!brain) continue;
      expect(brain.data["quality_gate"]).toBeDefined();
    }
  });

  it("brain always returns source = deterministic when ai_mode = off", async () => {
    const registry = getGoldenScenarioRegistry();
    const withBrain = registry.filter((s) => s.modules.includes("brain_output"));
    for (const scenario of withBrain) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const brain = result.artifacts.find((a) => a.type === "brain_output");
      if (!brain) continue;
      expect(brain.data["source"]).toBe("deterministic");
    }
  });

  it("brain ai_enabled is false in all scenarios (ai_mode off)", async () => {
    const registry = getGoldenScenarioRegistry();
    const withBrain = registry.filter((s) => s.modules.includes("brain_output"));
    for (const scenario of withBrain) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const brain = result.artifacts.find((a) => a.type === "brain_output");
      if (!brain) continue;
      expect(brain.data["ai_enabled"]).toBe(false);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: TASK BRIDGE (Bloc 26)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 26 — Task Bridge invariants", () => {
  it("task_drafts never contain email.send", async () => {
    const registry = getGoldenScenarioRegistry();
    const withTasks = registry.filter((s) => s.modules.includes("task_drafts"));
    for (const scenario of withTasks) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const drafts = result.artifacts.find((a) => a.type === "task_drafts");
      if (!drafts) continue;
      expect(drafts.data["has_email_send"]).toBe(false);
    }
  });

  it("task_drafts never contain scheduled_for", async () => {
    const registry = getGoldenScenarioRegistry();
    const withTasks = registry.filter((s) => s.modules.includes("task_drafts"));
    for (const scenario of withTasks) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const drafts = result.artifacts.find((a) => a.type === "task_drafts");
      if (!drafts) continue;
      expect(drafts.data["has_scheduled_for"]).toBe(false);
    }
  });

  it("task_drafts include task_count field", async () => {
    const scenario = getGoldenScenarioById("gs_hiring_offer")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const drafts = result.artifacts.find((a) => a.type === "task_drafts");
    expect(drafts).toBeDefined();
    expect(typeof drafts!.data["task_count"]).toBe("number");
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: HR WORKFLOWS (Bloc 17)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 17 — HR Workflows", () => {
  it("workflow_plan domain is a valid domain string for key scenarios", async () => {
    const validDomains = [
      "hiring", "onboarding", "absence", "contract", "payroll_prep",
      "employee_file", "training", "interview", "offboarding", "sensitive_case", "general_hr",
    ];
    const scenarioIds = [
      "gs_onboarding_complete", "gs_hiring_offer", "gs_absence_justified",
      "gs_contract_renewal", "gs_payroll_prep",
    ] as const;
    for (const id of scenarioIds) {
      const scenario = getGoldenScenarioById(id)!;
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const wf = result.artifacts.find((a) => a.type === "workflow_plan");
      expect(wf).toBeDefined();
      expect(validDomains).toContain(wf!.data["domain"]);
    }
  });

  it("workflow_plan always has tasks array", async () => {
    const registry = getGoldenScenarioRegistry();
    const withWorkflow = registry.filter((s) => s.modules.includes("workflow_plan"));
    for (const scenario of withWorkflow) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const wf = result.artifacts.find((a) => a.type === "workflow_plan");
      if (!wf) continue;
      expect(Array.isArray(wf.data["tasks"])).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: EMPLOYEE FILE 360 (Bloc 11)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 11 — Employee File 360", () => {
  it("employee_360 has health_score as number", async () => {
    const scenario = getGoldenScenarioById("gs_employee_360")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const emp = result.artifacts.find((a) => a.type === "employee_360");
    expect(emp).toBeDefined();
    expect(typeof emp!.data["health_score"]).toBe("number");
    expect(emp!.data["health_score"] as number).toBeGreaterThanOrEqual(0);
    expect(emp!.data["health_score"] as number).toBeLessThanOrEqual(100);
  });

  it("employee_360 has timeline array", async () => {
    const scenario = getGoldenScenarioById("gs_employee_360")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const emp = result.artifacts.find((a) => a.type === "employee_360");
    expect(emp).toBeDefined();
    expect(Array.isArray(emp!.data["timeline"])).toBe(true);
  });

  it("employee_360 has next_actions array", async () => {
    const scenario = getGoldenScenarioById("gs_employee_360")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const emp = result.artifacts.find((a) => a.type === "employee_360");
    expect(emp).toBeDefined();
    expect(Array.isArray(emp!.data["next_actions"])).toBe(true);
  });

  it("onboarding scenario also produces employee_360 artifact", async () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const emp = result.artifacts.find((a) => a.type === "employee_360");
    expect(emp).toBeDefined();
    expect(emp!.valid).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: PREMIUM DOCUMENT SYSTEM (Bloc 20/27)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 20/27 — Premium Document System", () => {
  it("document artifact always has template_id", async () => {
    const registry = getGoldenScenarioRegistry();
    const withDoc = registry.filter((s) => s.modules.includes("document"));
    for (const scenario of withDoc) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const doc = result.artifacts.find((a) => a.type === "document");
      if (!doc) continue;
      expect(typeof doc.data["template_id"]).toBe("string");
    }
  });

  it("document artifact always has html_content", async () => {
    const registry = getGoldenScenarioRegistry();
    const withDoc = registry.filter((s) => s.modules.includes("document"));
    for (const scenario of withDoc) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const doc = result.artifacts.find((a) => a.type === "document");
      if (!doc) continue;
      expect(typeof doc.data["html_content"]).toBe("string");
    }
  });

  it("document status is rendered or blocked (never throws)", async () => {
    const registry = getGoldenScenarioRegistry();
    const withDoc = registry.filter((s) => s.modules.includes("document"));
    for (const scenario of withDoc) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const doc = result.artifacts.find((a) => a.type === "document");
      if (!doc) continue;
      expect(["rendered", "blocked"]).toContain(doc.data["status"]);
    }
  });

  it("onboarding document has family = onboarding", async () => {
    const scenario = getGoldenScenarioById("gs_onboarding_complete")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const doc = result.artifacts.find((a) => a.type === "document");
    expect(doc).toBeDefined();
    expect(doc!.data["family"]).toBe("onboarding");
  });

  it("contract renewal document has family = amendment", async () => {
    const scenario = getGoldenScenarioById("gs_contract_renewal")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const doc = result.artifacts.find((a) => a.type === "document");
    expect(doc).toBeDefined();
    expect(doc!.data["family"]).toBe("amendment");
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: CLONEGUARD (Bloc 14)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 14 — CloneGuard", () => {
  it("cloneguard always returns a valid decision", async () => {
    const registry = getGoldenScenarioRegistry();
    const withGuard = registry.filter((s) => s.modules.includes("cloneguard"));
    const validDecisions = ["allow", "allow_with_warning", "require_approval", "block", "refuse"];
    for (const scenario of withGuard) {
      const result = await runGoldenScenario(scenario, { ai_mode: "off" });
      const guard = result.artifacts.find((a) => a.type === "cloneguard");
      if (!guard) continue;
      expect(validDecisions).toContain(guard.data["decision"]);
    }
  });

  it("gs_cloneguard_block — dismissal_action triggers requires_human", async () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_block")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const guard = result.artifacts.find((a) => a.type === "cloneguard");
    expect(guard).toBeDefined();
    expect(guard!.data["requires_human"]).toBe(true);
  });

  it("gs_cloneguard_allow — returns explanation (reasoning)", async () => {
    const scenario = getGoldenScenarioById("gs_cloneguard_allow")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const guard = result.artifacts.find((a) => a.type === "cloneguard");
    expect(guard).toBeDefined();
    expect(typeof guard!.data["reasoning"]).toBe("string");
    expect((guard!.data["reasoning"] as string).length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: CLONEADN (Bloc 28)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Bloc 28 — CloneADN", () => {
  it("configured_adn fixture has correct status", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(["configured", "strong", "locked"]).toContain(adn!.status);
  });

  it("gs_cloneadn_configured produces cloneadn artifact with rules_evaluated", async () => {
    const scenario = getGoldenScenarioById("gs_cloneadn_configured")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const adn = result.artifacts.find((a) => a.type === "cloneadn");
    expect(adn).toBeDefined();
    expect(adn!.data["rules_evaluated"]).toBe(true);
  });

  it("gs_cloneadn_configured — company_context is not null when profile is configured", async () => {
    const scenario = getGoldenScenarioById("gs_cloneadn_configured")!;
    const result = await runGoldenScenario(scenario, { ai_mode: "off" });
    const adn = result.artifacts.find((a) => a.type === "cloneadn");
    expect(adn).toBeDefined();
    expect(adn!.data["company_context"]).not.toBeNull();
  });

  it("configured_adn sensitive_topics include licenciement", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(adn!.validation.sensitive_topics).toContain("licenciement");
  });

  it("configured_adn never_auto_execute includes email_send", () => {
    const adn = getGoldenCloneADN("configured_adn");
    expect(adn).not.toBeNull();
    expect(adn!.validation.never_auto_execute).toContain("email_send");
  });

  it("tech_company reusable context has clone_adn key", () => {
    const company = getGoldenCompanyContext("tech_company");
    expect(company).not.toBeNull();
    expect(company!.reusable_rh_context_json["clone_adn"]).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: REPORT (sellable proof)
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc Report — sellable proof", () => {
  it("report level is always a valid level", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    const report = buildGoldenScenarioReport(suite);
    expect(["sellable", "demo_ready", "internal_only", "blocked"]).toContain(report.level);
  });

  it("report has non-empty executive_summary", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    const report = buildGoldenScenarioReport(suite);
    expect(report.executive_summary.length).toBeGreaterThan(0);
  });

  it("report positive_highlights matches passed positive scenarios", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    const report = buildGoldenScenarioReport(suite);
    const passedPositive = suite.results.filter(
      (r) => r.status === "pass" && r.category === "positive",
    );
    expect(report.positive_highlights.length).toBe(passedPositive.length);
  });

  it("blocked level is returned when critical failure exists", async () => {
    // Simulate a suite with critical failures
    const mockSuite = {
      generated_at: new Date().toISOString(),
      scenarios_total: 13,
      scenarios_passed: 9,
      scenarios_failed: 4,
      scenarios_warned: 0,
      scenarios_skipped: 0,
      checks_total: 65,
      checks_passed: 50,
      checks_failed: 15,
      results: [],
      duration_ms: 1000,
      suite_status: "some_fail" as const,
      executive_summary: "Some failures",
      critical_failures: ["gs_onboarding_complete"],
      modules_validated: ["workflow_plan"],
    };
    const report = buildGoldenScenarioReport(mockSuite);
    expect(report.level).toBe("blocked");
    expect(report.sellable).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: FIXTURE SAFETY
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc fixture safety", () => {
  it("active_employee fixture tasks use execute_at not scheduled_for", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    expect(emp).not.toBeNull();
    for (const task of emp!.tasks) {
      expect(task["scheduled_for"]).toBeUndefined();
      expect(task["execute_at"]).toBeDefined();
    }
  });

  it("active_employee fixture logs use event_type not event", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    expect(emp).not.toBeNull();
    for (const log of emp!.logs) {
      expect(log["event_type"]).toBeDefined();
      expect(log["event"]).toBeUndefined();
    }
  });

  it("active_employee fixture logs use message not payload", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    expect(emp).not.toBeNull();
    for (const log of emp!.logs) {
      expect(log["message"]).toBeDefined();
      expect(log["payload"]).toBeUndefined();
    }
  });

  it("active_employee fixture logs use meta_json not level", () => {
    const emp = getGoldenEmployeeContext("active_employee");
    expect(emp).not.toBeNull();
    for (const log of emp!.logs) {
      expect(log["meta_json"]).toBeDefined();
      expect(log["level"]).toBeUndefined();
    }
  });

  it("company fixture has document_templates key preserved", () => {
    const company = getGoldenCompanyContext("tech_company");
    expect(company).not.toBeNull();
    const rh = company!.reusable_rh_context_json;
    expect(rh["document_templates"]).toBeDefined();
    expect(rh["employees"]).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// CROSS-BLOC: SUITE TOTALS CONSISTENCY
// ══════════════════════════════════════════════════════════════

describe("Cross-bloc suite totals consistency", () => {
  it("scenarios_passed + scenarios_failed + warned + skipped = scenarios_total", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    const sum =
      suite.scenarios_passed +
      suite.scenarios_failed +
      suite.scenarios_warned +
      suite.scenarios_skipped;
    expect(sum).toBe(suite.scenarios_total);
  });

  it("checks_passed + checks_failed = checks_total", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(suite.checks_passed + suite.checks_failed).toBe(suite.checks_total);
  });

  it("results length matches scenarios_total", async () => {
    const suite = await runGoldenScenarioSuite({ ai_mode: "off" });
    expect(suite.results.length).toBe(suite.scenarios_total);
  });
});
