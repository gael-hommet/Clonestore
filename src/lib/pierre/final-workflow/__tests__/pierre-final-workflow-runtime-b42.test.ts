// B42 — Workflow Runtime Tests
// Tests the async execution of scenarios including executePierreTask integration

import { describe, it, expect } from "vitest";
import { runWorkflowScenario } from "../workflow-runtime";
import { runAllB42Workflows, runScenarioById } from "../workflow-orchestrator";
import { getScenarioById, B42_WORKFLOW_SCENARIOS } from "../workflow-scenarios";
import { buildFakeB42Adapters } from "../workflow-fixtures";

// ── T01-T10: Single scenario execution — Recrutement ─────────────────────────

describe("B42 Runtime — Scenario 01 Recrutement", () => {
  it("T01 — executes without throwing", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result).toBeDefined();
  });

  it("T02 — scenario_id matches input scenario", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.scenario_id).toBe("b42_s01_recrutement");
  });

  it("T03 — domain is hiring", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.domain).toBe("hiring");
  });

  it("T04 — has steps for each plan task", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.steps.length).toBe(result.plan.tasks.length);
  });

  it("T05 — trace is non-empty", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("T06 — passed is true", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.passed).toBe(true);
  });

  it("T07 — hard_fails is empty", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.hard_fails).toHaveLength(0);
  });

  it("T08 — adapters recorded traces", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters, state } = buildFakeB42Adapters();
    await runWorkflowScenario(scenario, adapters);
    expect(state.traces.length).toBeGreaterThan(0);
    expect(state.traces[0].scenarioId).toBe("b42_s01_recrutement");
  });

  it("T09 — duration_ms is a non-negative number", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("T10 — plan has domain hiring", async () => {
    const scenario = getScenarioById("b42_s01_recrutement")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.plan.domain).toBe("hiring");
  });
});

// ── T11-T20: Onboarding runtime ───────────────────────────────────────────────

describe("B42 Runtime — Scenario 02 Onboarding", () => {
  it("T11 — passes", async () => {
    const scenario = getScenarioById("b42_s02_onboarding")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.passed).toBe(true);
  });

  it("T12 — domain is onboarding", async () => {
    const scenario = getScenarioById("b42_s02_onboarding")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.domain).toBe("onboarding");
  });

  it("T13 — no hard fails", async () => {
    const scenario = getScenarioById("b42_s02_onboarding")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.hard_fails).toHaveLength(0);
  });

  it("T14 — has ready steps that were executed", async () => {
    const scenario = getScenarioById("b42_s02_onboarding")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    const executedSteps = result.steps.filter((s) => s.outcome !== null);
    expect(executedSteps.length).toBeGreaterThan(0);
  });

  it("T15 — no email_sent_real hard fail", async () => {
    const scenario = getScenarioById("b42_s02_onboarding")!;
    const { adapters } = buildFakeB42Adapters();
    const result = await runWorkflowScenario(scenario, adapters);
    expect(result.hard_fails).not.toContain("email_sent_real");
  });
});

// ── T21-T30: Absence runtime ──────────────────────────────────────────────────

describe("B42 Runtime — Scenario 03 Absence", () => {
  it("T21 — passes", async () => {
    const { adapters } = buildFakeB42Adapters();
    const result = await runScenarioById("b42_s03_absence");
    expect(result?.passed).toBe(true);
  });

  it("T22 — domain is absence", async () => {
    const result = await runScenarioById("b42_s03_absence");
    expect(result?.domain).toBe("absence");
  });

  it("T23 — no hard fails", async () => {
    const result = await runScenarioById("b42_s03_absence");
    expect(result?.hard_fails).toHaveLength(0);
  });
});

// ── T31-T40: Pré-paie runtime ─────────────────────────────────────────────────

describe("B42 Runtime — Scenario 04 Pré-paie", () => {
  it("T31 — passes", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    expect(result?.passed).toBe(true);
  });

  it("T32 — domain is payroll_prep", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    expect(result?.domain).toBe("payroll_prep");
  });

  it("T33 — approval_required is true in plan", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    expect(result?.plan.approval_required).toBe(true);
  });

  it("T34 — awaiting_approval steps recorded correctly", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    const awaitingSteps = result?.steps.filter(
      (s) => s.task_status_in === "awaiting_approval",
    );
    expect(awaitingSteps?.length).toBeGreaterThan(0);
  });

  it("T35 — awaiting_approval steps have ok=true (correctly handled)", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    const awaitingSteps = result?.steps.filter(
      (s) => s.task_status_in === "awaiting_approval",
    );
    awaitingSteps?.forEach((s) => {
      expect(s.ok).toBe(true);
    });
  });

  it("T36 — no hard fails", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    expect(result?.hard_fails).toHaveLength(0);
  });
});

// ── T41-T50: Dossier salarié runtime ─────────────────────────────────────────

describe("B42 Runtime — Scenario 05 Dossier salarié", () => {
  it("T41 — passes", async () => {
    const result = await runScenarioById("b42_s05_dossier");
    expect(result?.passed).toBe(true);
  });

  it("T42 — domain is employee_file", async () => {
    const result = await runScenarioById("b42_s05_dossier");
    expect(result?.domain).toBe("employee_file");
  });

  it("T43 — no hard fails", async () => {
    const result = await runScenarioById("b42_s05_dossier");
    expect(result?.hard_fails).toHaveLength(0);
  });
});

// ── T51-T55: Document RH runtime ──────────────────────────────────────────────

describe("B42 Runtime — Scenario 06 Document RH", () => {
  it("T51 — passes", async () => {
    const result = await runScenarioById("b42_s06_document_rh");
    expect(result?.passed).toBe(true);
  });

  it("T52 — domain is general_hr", async () => {
    const result = await runScenarioById("b42_s06_document_rh");
    expect(result?.domain).toBe("general_hr");
  });

  it("T53 — no hard fails", async () => {
    const result = await runScenarioById("b42_s06_document_rh");
    expect(result?.hard_fails).toHaveLength(0);
  });
});

// ── T56-T60: Email RH runtime ─────────────────────────────────────────────────

describe("B42 Runtime — Scenario 07 Email RH", () => {
  it("T56 — passes", async () => {
    const result = await runScenarioById("b42_s07_email_rh");
    expect(result?.passed).toBe(true);
  });

  it("T57 — domain is interview", async () => {
    const result = await runScenarioById("b42_s07_email_rh");
    expect(result?.domain).toBe("interview");
  });

  it("T58 — no email_sent_real hard fail", async () => {
    const result = await runScenarioById("b42_s07_email_rh");
    expect(result?.hard_fails).not.toContain("email_sent_real");
  });
});

// ── T61-T75: Cas sensible runtime ─────────────────────────────────────────────

describe("B42 Runtime — Scenario 08 Cas sensible", () => {
  it("T61 — passes (correctly blocked = pass)", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.passed).toBe(true);
  });

  it("T62 — domain is sensitive_case", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.domain).toBe("sensitive_case");
  });

  it("T63 — risk_level is black", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.risk_level).toBe("black");
  });

  it("T64 — no hard fails (sensitive correctly handled)", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.hard_fails).toHaveLength(0);
  });

  it("T65 — no steps with task_status_in=ready (all blocked/awaiting)", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    const readySteps = result?.steps.filter((s) => s.task_status_in === "ready");
    expect(readySteps).toHaveLength(0);
  });

  it("T66 — all awaiting_approval steps have ok=true", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    result?.steps.forEach((s) => {
      expect(s.ok).toBe(true);
    });
  });

  it("T67 — plan.validation_policy.blocked is true", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.plan.validation_policy.blocked).toBe(true);
  });

  it("T68 — plan.blocked_actions is non-empty", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.plan.blocked_actions.length).toBeGreaterThan(0);
  });

  it("T69 — trace contains sensitive case markers", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    const hasSensitiveTrace = result?.trace.some(
      (t) => t.includes("Sensitive") || t.includes("blocked") || t.includes("sensitive"),
    );
    expect(hasSensitiveTrace).toBe(true);
  });

  it("T70 — no email_sent_real hard fail", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.hard_fails).not.toContain("email_sent_real");
  });

  it("T71 — summary contains PASS for correctly blocked scenario", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.summary).toContain("PASS");
  });

  it("T72 — runScenarioById returns null for unknown id", async () => {
    const result = await runScenarioById("does_not_exist");
    expect(result).toBeNull();
  });
});

// ── T73-T85: All 8 workflows orchestrator ────────────────────────────────────

describe("B42 Orchestrator — All 8 Workflows", () => {
  it("T73 — runAllB42Workflows returns 8 results", async () => {
    const { results } = await runAllB42Workflows();
    expect(results).toHaveLength(8);
  });

  it("T74 — all 8 scenarios pass", async () => {
    const { results } = await runAllB42Workflows();
    const failed = results.filter((r) => !r.passed);
    expect(failed).toHaveLength(0);
  });

  it("T75 — zero hard fails across all scenarios", async () => {
    const { results } = await runAllB42Workflows();
    const totalHardFails = results.flatMap((r) => r.hard_fails).length;
    expect(totalHardFails).toBe(0);
  });

  it("T76 — all results have non-empty traces", async () => {
    const { results } = await runAllB42Workflows();
    results.forEach((r) => {
      expect(r.trace.length).toBeGreaterThan(0);
    });
  });

  it("T77 — adapter state has traces from all scenarios", async () => {
    const { adapterState } = await runAllB42Workflows();
    const scenarioIds = [...new Set(adapterState.traces.map((t) => t.scenarioId))];
    expect(scenarioIds.length).toBe(8);
  });

  it("T78 — sensitive scenario passed (correctly blocked = pass)", async () => {
    const { results } = await runAllB42Workflows();
    const sensitive = results.find((r) => r.scenario_id === "b42_s08_cas_sensible");
    expect(sensitive?.passed).toBe(true);
  });

  it("T79 — hiring scenario passed", async () => {
    const { results } = await runAllB42Workflows();
    const hiring = results.find((r) => r.scenario_id === "b42_s01_recrutement");
    expect(hiring?.passed).toBe(true);
  });

  it("T80 — prepaie scenario has approval_required=true", async () => {
    const { results } = await runAllB42Workflows();
    const prepaie = results.find((r) => r.scenario_id === "b42_s04_prepaie");
    expect(prepaie?.plan.approval_required).toBe(true);
  });

  it("T81 — all results have scenario_name populated", async () => {
    const { results } = await runAllB42Workflows();
    results.forEach((r) => {
      expect(r.scenario_name.length).toBeGreaterThan(0);
    });
  });

  it("T82 — all results have duration_ms >= 0", async () => {
    const { results } = await runAllB42Workflows();
    results.forEach((r) => {
      expect(r.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  it("T83 — all results have plan with at least 1 task", async () => {
    const { results } = await runAllB42Workflows();
    results.forEach((r) => {
      expect(r.plan.tasks.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("T84 — real email sent count stays at 0", async () => {
    const { adapterState } = await runAllB42Workflows();
    expect(adapterState.realEmailSentCount).toBe(0);
  });

  it("T85 — all results have correct scenario_id matching B42_WORKFLOW_SCENARIOS", async () => {
    const { results } = await runAllB42Workflows();
    const expectedIds = B42_WORKFLOW_SCENARIOS.map((s) => s.id);
    results.forEach((r) => {
      expect(expectedIds).toContain(r.scenario_id);
    });
  });
});
