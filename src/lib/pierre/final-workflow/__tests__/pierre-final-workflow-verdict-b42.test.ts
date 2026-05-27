// B42 — Verdict, Snapshot Bridge, and Final Integration Tests

import { describe, it, expect } from "vitest";
import { buildWorkflowVerdict, formatVerdictReport } from "../workflow-verdict";
import {
  planToMissionSnapshot,
  planToSnapshotTasks,
  buildB42VerdictSnapshot,
  executionResultToSnapshot,
} from "../workflow-snapshot-bridge";
import { runAllB42Workflows } from "../workflow-orchestrator";
import { runScenarioById } from "../workflow-orchestrator";
import { buildPierreHrWorkflowPlan } from "../../hr/workflows";
import { getScenarioById } from "../workflow-scenarios";
import { buildFakeB42Adapters, makeExecutorTask } from "../workflow-fixtures";
import { runWorkflowScenario } from "../workflow-runtime";
import type { PierreWorkflowExecutionResult } from "../types";

// ── T01-T15: Verdict builder ──────────────────────────────────────────────────

describe("B42 Verdict Builder", () => {
  it("T01 — builds verdict from all results", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict).toBeDefined();
    expect(verdict.bloc).toBe("B42");
  });

  it("T02 — workflows_tested = 8", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.workflows_tested).toBe(8);
  });

  it("T03 — workflows_passed = 8", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.workflows_passed).toBe(8);
  });

  it("T04 — workflows_failed = 0", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.workflows_failed).toBe(0);
  });

  it("T05 — hard_fail_count = 0", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.hard_fail_count).toBe(0);
  });

  it("T06 — all_passed = true", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.all_passed).toBe(true);
  });

  it("T07 — safe_to_close_b42 = true", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.safe_to_close_b42).toBe(true);
  });

  it("T08 — has timestamp", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.timestamp.length).toBeGreaterThan(0);
  });

  it("T09 — summary contains ALL PASSED when all pass", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.summary).toContain("ALL 8 WORKFLOWS PASSED");
  });

  it("T10 — hard_fails_detail is empty when no hard fails", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.hard_fails_detail).toHaveLength(0);
  });

  it("T11 — gaps list is non-empty (documented limitations)", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.gaps.length).toBeGreaterThan(0);
  });

  it("T12 — results array has 8 entries", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.results).toHaveLength(8);
  });

  it("T13 — failed verdict when one scenario fails", async () => {
    const { results } = await runAllB42Workflows();
    // Inject a fake failure
    const fakeFailedResult: PierreWorkflowExecutionResult = {
      ...results[0],
      passed: false,
      hard_fails: ["no_tasks_generated"],
      scenario_id: "b42_fake_fail",
      scenario_name: "Fake Failed Scenario",
    };
    const modifiedResults = [...results.slice(1), fakeFailedResult];
    const verdict = buildWorkflowVerdict(modifiedResults);
    expect(verdict.all_passed).toBe(false);
    expect(verdict.safe_to_close_b42).toBe(false);
    expect(verdict.hard_fail_count).toBe(1);
  });

  it("T14 — formatVerdictReport returns non-empty string", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const report = formatVerdictReport(verdict);
    expect(report.length).toBeGreaterThan(100);
  });

  it("T15 — formatVerdictReport contains B42", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const report = formatVerdictReport(verdict);
    expect(report).toContain("B42");
  });
});

// ── T16-T30: Snapshot bridge ──────────────────────────────────────────────────

describe("B42 Snapshot Bridge", () => {
  it("T16 — planToMissionSnapshot returns correct domain", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Marie Dupont en CDI");
    const snapshot = planToMissionSnapshot("mission-001", plan);
    expect(snapshot.domain).toBe("hiring");
  });

  it("T17 — planToMissionSnapshot task counts are correct", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Marie Dupont en CDI le 01/07/2026");
    const snapshot = planToMissionSnapshot("mission-001", plan);
    expect(snapshot.task_count).toBe(plan.tasks.length);
  });

  it("T18 — planToMissionSnapshot tasks_ready equals count of ready tasks", () => {
    const plan = buildPierreHrWorkflowPlan("Gestion absence Sophie Bernard lundi 25/05");
    const snapshot = planToMissionSnapshot("mission-002", plan);
    const expectedReady = plan.tasks.filter((t) => t.status === "ready").length;
    expect(snapshot.tasks_ready).toBe(expectedReady);
  });

  it("T19 — planToMissionSnapshot tasks_awaiting_approval correct for payroll", () => {
    const plan = buildPierreHrWorkflowPlan("Préparer la synthèse pré-paie pour mai 2026");
    const snapshot = planToMissionSnapshot("mission-003", plan);
    const expectedAwaiting = plan.tasks.filter((t) => t.status === "awaiting_approval").length;
    expect(snapshot.tasks_awaiting_approval).toBe(expectedAwaiting);
  });

  it("T20 — planToMissionSnapshot blocked=true for sensitive_case", () => {
    const plan = buildPierreHrWorkflowPlan("Signalement harcèlement moral — cas grave");
    const snapshot = planToMissionSnapshot("mission-004", plan);
    expect(snapshot.blocked).toBe(true);
  });

  it("T21 — planToSnapshotTasks has correct count", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Marie Dupont en CDI le 01/07/2026");
    const tasks = planToSnapshotTasks("mission-001", plan);
    expect(tasks.length).toBe(plan.tasks.length);
  });

  it("T22 — planToSnapshotTasks all have domain set", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Marie Dupont en CDI le 01/07/2026");
    const tasks = planToSnapshotTasks("mission-001", plan);
    tasks.forEach((t) => {
      expect(t.domain.length).toBeGreaterThan(0);
    });
  });

  it("T23 — planToSnapshotTasks IDs are unique", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Marie Dupont en CDI le 01/07/2026");
    const tasks = planToSnapshotTasks("mission-001", plan);
    const ids = tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("T24 — executionResultToSnapshot returns correct domain", async () => {
    const result = await runScenarioById("b42_s01_recrutement");
    const snapshot = executionResultToSnapshot(result!);
    expect(snapshot.domain).toBe("hiring");
  });

  it("T25 — buildB42VerdictSnapshot returns passed status", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const snapshot = buildB42VerdictSnapshot(verdict);
    expect(snapshot.b42_status).toBe("passed");
  });

  it("T26 — buildB42VerdictSnapshot has 8 missions", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const snapshot = buildB42VerdictSnapshot(verdict);
    expect(snapshot.missions).toHaveLength(8);
  });

  it("T27 — buildB42VerdictSnapshot domain_coverage has all expected domains", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const snapshot = buildB42VerdictSnapshot(verdict);
    expect(snapshot.domain_coverage).toContain("hiring");
    expect(snapshot.domain_coverage).toContain("onboarding");
    expect(snapshot.domain_coverage).toContain("sensitive_case");
  });

  it("T28 — buildB42VerdictSnapshot hard_fails = 0 when all pass", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const snapshot = buildB42VerdictSnapshot(verdict);
    expect(snapshot.hard_fails).toBe(0);
  });

  it("T29 — snapshot workflows_passed = 8", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const snapshot = buildB42VerdictSnapshot(verdict);
    expect(snapshot.workflows_passed).toBe(8);
  });

  it("T30 — snapshot workflows_tested = 8", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const snapshot = buildB42VerdictSnapshot(verdict);
    expect(snapshot.workflows_tested).toBe(8);
  });
});

// ── T31-T45: Fake adapters and fixture helpers ────────────────────────────────

describe("B42 Fixtures and Fake Adapters", () => {
  it("T31 — buildFakeB42Adapters returns adapters and state", () => {
    const { adapters, state } = buildFakeB42Adapters();
    expect(adapters).toBeDefined();
    expect(state).toBeDefined();
  });

  it("T32 — logTrace adds to state.traces", () => {
    const { adapters, state } = buildFakeB42Adapters();
    adapters.logTrace("test-id", "test message");
    expect(state.traces).toHaveLength(1);
    expect(state.traces[0]).toEqual({ scenarioId: "test-id", message: "test message" });
  });

  it("T33 — recordArtifact adds to state.artifacts", () => {
    const { adapters, state } = buildFakeB42Adapters();
    adapters.recordArtifact("test-id", {
      kind: "document",
      doc_type: "document_rh",
      title: "Test",
      text_content: "text",
      html_content: "<p>html</p>",
    });
    expect(state.artifacts).toHaveLength(1);
    expect(state.artifacts[0].scenarioId).toBe("test-id");
  });

  it("T34 — assertNoRealEmailSent returns true initially", () => {
    const { adapters } = buildFakeB42Adapters();
    expect(adapters.assertNoRealEmailSent()).toBe(true);
  });

  it("T35 — multiple logTrace calls accumulate", () => {
    const { adapters, state } = buildFakeB42Adapters();
    adapters.logTrace("id-1", "msg 1");
    adapters.logTrace("id-1", "msg 2");
    adapters.logTrace("id-2", "msg 3");
    expect(state.traces).toHaveLength(3);
  });

  it("T36 — makeExecutorTask sets running status by default", () => {
    const task = makeExecutorTask("task-001", {
      type: "doc.generate",
      title: "Test task",
      status: "ready",
      payload_json: { domain: "hiring" },
    });
    expect(task.status).toBe("running");
    expect(task.id).toBe("task-001");
  });

  it("T37 — makeExecutorTask respects overrideStatus", () => {
    const task = makeExecutorTask(
      "task-001",
      { type: "doc.generate", title: "Test", status: "ready", payload_json: {} },
      "queued",
    );
    expect(task.status).toBe("queued");
  });

  it("T38 — makeExecutorTask preserves payload", () => {
    const payload = { domain: "hiring", risk_level: "orange" };
    const task = makeExecutorTask("task-001", {
      type: "doc.generate",
      title: "Test",
      status: "ready",
      payload_json: payload,
    });
    expect(task.payload).toEqual(payload);
  });
});

// ── T39-T50: Integration — B41 security not broken ───────────────────────────

describe("B42 Integration — B41 Security Preserved", () => {
  it("T39 — no real email sent in full workflow run", async () => {
    const { adapterState } = await runAllB42Workflows();
    expect(adapterState.realEmailSentCount).toBe(0);
  });

  it("T40 — sensitive case blocked_actions referenced without direct execution", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.plan.blocked_actions.length).toBeGreaterThan(0);
    // Verify no ready tasks were executed
    const executedReadyTasks = result?.steps.filter(
      (s) => s.task_status_in === "ready" && s.outcome !== null,
    );
    expect(executedReadyTasks).toHaveLength(0);
  });

  it("T41 — payroll prep approval gate preserved", async () => {
    const result = await runScenarioById("b42_s04_prepaie");
    const docTask = result?.plan.tasks.find((t) => t.type === "doc.generate");
    expect(docTask?.status).toBe("awaiting_approval");
    // The task should not have been executed (awaiting_approval = correct skip)
    const docStep = result?.steps.find((s) => s.task_type === "doc.generate" && s.task_status_in === "awaiting_approval");
    expect(docStep?.outcome).toBeNull();
  });

  it("T42 — contract workflow approval gate preserved", async () => {
    // Create a quick contract scenario test
    const plan = buildPierreHrWorkflowPlan(
      "Rédiger un avenant au contrat de Luc Renard. CDI, date d'effet 01/06/2026.",
    );
    expect(plan.domain).toBe("contract");
    expect(plan.approval_required).toBe(true);
    expect(plan.validation_policy.blocked).toBe(false);
    // Doc task should be awaiting_approval
    const docTask = plan.tasks.find((t) => t.type === "doc.generate");
    expect(docTask?.status).toBe("awaiting_approval");
  });

  it("T43 — offboarding high-risk approval gate", () => {
    const plan = buildPierreHrWorkflowPlan(
      "Rupture conventionnelle pour Jean Dupont. Signature prévue le 01/06/2026.",
    );
    expect(plan.domain).toBe("offboarding");
    // Rupture conventionnelle is red risk → approval required
    expect(plan.approval_required).toBe(true);
  });

  it("T44 — email.draft type tasks never use email.send in workflow scenarios", async () => {
    const { results } = await runAllB42Workflows();
    results.forEach((r) => {
      r.plan.tasks.forEach((t) => {
        // None of the workflow scenario tasks should be email.send
        expect(t.type).not.toBe("email.send");
      });
    });
  });

  it("T45 — sensitive case has ESCALATE recommendation not EXECUTE", async () => {
    const result = await runScenarioById("b42_s08_cas_sensible");
    expect(result?.plan.recommended_next_action.type).toBe("escalate");
  });
});

// ── T46-T55: Report formatting ────────────────────────────────────────────────

describe("B42 Verdict Report Formatting", () => {
  it("T46 — formatVerdictReport contains scenario IDs", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const report = formatVerdictReport(verdict);
    expect(report).toContain("b42_s01");
    expect(report).toContain("b42_s08");
  });

  it("T47 — formatVerdictReport shows 8/8 passed", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const report = formatVerdictReport(verdict);
    expect(report).toContain("8 / 8");
  });

  it("T48 — formatVerdictReport shows B42 Close SAFE", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const report = formatVerdictReport(verdict);
    expect(report).toContain("SAFE");
  });

  it("T49 — formatVerdictReport lists gaps", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    const report = formatVerdictReport(verdict);
    expect(report).toContain("gap");
  });

  it("T50 — verdict summary contains bloc B42", async () => {
    const { results } = await runAllB42Workflows();
    const verdict = buildWorkflowVerdict(results);
    expect(verdict.summary).toContain("B42");
  });
});

// ── T51-T55: Regression — B38-B41 not broken ────────────────────────────────

describe("B42 Regression — B38-B41 Preserved", () => {
  it("T51 — buildPierreHrWorkflowPlan still works (B39 regression)", () => {
    const plan = buildPierreHrWorkflowPlan("Recruter Jean Dupont CDI le 01/07/2026");
    expect(plan.domain).toBe("hiring");
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it("T52 — sensitive case still blocked (B40/B41 regression)", () => {
    const plan = buildPierreHrWorkflowPlan("Licenciement pour faute grave — décision disciplinaire");
    expect(plan.domain).toBe("sensitive_case");
    expect(plan.validation_policy.blocked).toBe(true);
  });

  it("T53 — payroll approval gate still required (B40 regression)", () => {
    const plan = buildPierreHrWorkflowPlan("Préparer la synthèse de paie avec prime et heures sup");
    expect(plan.domain).toBe("payroll_prep");
    expect(plan.approval_required).toBe(true);
  });

  it("T54 — contract approval gate still required", () => {
    const plan = buildPierreHrWorkflowPlan("Rédiger un avenant au contrat CDI à partir du 01/06");
    expect(plan.domain).toBe("contract");
    expect(plan.approval_required).toBe(true);
  });

  it("T55 — all 8 B42 scenarios still pass with B41 constraints", async () => {
    const { results } = await runAllB42Workflows();
    const allPassed = results.every((r) => r.passed);
    expect(allPassed).toBe(true);
  });
});
