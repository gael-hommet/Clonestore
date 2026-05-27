// B42 — Quality gates: hard fail detection

import type { PierreHrWorkflowPlan } from "../hr/workflows";
import type { PierreWorkflowScenario, WorkflowHardFail } from "./types";

// ── Gate checks ───────────────────────────────────────────────────────────────

export function checkNoTasksGenerated(plan: PierreHrWorkflowPlan): WorkflowHardFail | null {
  if (plan.tasks.length === 0) return "no_tasks_generated";
  return null;
}

export function checkWrongDomainClassified(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
): WorkflowHardFail | null {
  if (plan.domain !== scenario.expected_domain) return "wrong_domain_classified";
  return null;
}

export function checkApprovalNotRequiredForSensitive(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
): WorkflowHardFail | null {
  if (scenario.sensitive_case && !plan.approval_required) {
    return "approval_not_required_for_sensitive";
  }
  if (scenario.expected_approval_required && !plan.approval_required) {
    return "approval_not_required_for_sensitive";
  }
  return null;
}

export function checkSensitiveActionNotBlocked(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
): WorkflowHardFail | null {
  if (!scenario.sensitive_case) return null;
  if (!plan.validation_policy.blocked) return "sensitive_action_not_blocked";
  const hasUnblockedTask = plan.tasks.some((t) => t.status === "ready");
  if (hasUnblockedTask) return "sensitive_action_not_blocked";
  return null;
}

export function checkMissingTrace(trace: string[]): WorkflowHardFail | null {
  if (trace.length === 0) return "missing_trace";
  return null;
}

// ── Compound gate: run all applicable checks ──────────────────────────────────

export function runQualityGates(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
  trace: string[],
): WorkflowHardFail[] {
  const fails: WorkflowHardFail[] = [];

  const checks = [
    checkNoTasksGenerated(plan),
    checkWrongDomainClassified(plan, scenario),
    checkApprovalNotRequiredForSensitive(plan, scenario),
    checkSensitiveActionNotBlocked(plan, scenario),
    checkMissingTrace(trace),
  ];

  for (const fail of checks) {
    if (fail !== null && scenario.hard_fail_conditions.includes(fail)) {
      fails.push(fail);
    }
  }

  return fails;
}

// ── Risk level gate ───────────────────────────────────────────────────────────

export function meetsExpectedRiskLevel(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
): boolean {
  const rank: Record<string, number> = { green: 0, orange: 1, red: 2, black: 3 };
  const actual = rank[plan.risk_level] ?? 0;
  const expected = rank[scenario.expected_risk_level] ?? 0;
  // Actual risk can be equal to or higher than expected (escalation is safe)
  return actual >= expected;
}

// ── Task type coverage gate ───────────────────────────────────────────────────

export function meetsTaskTypeCoverage(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
): boolean {
  const taskTypes = plan.tasks.map((t) => t.type);
  return scenario.expected_task_type_prefixes.some((prefix) =>
    taskTypes.some((tt) => tt.startsWith(prefix)),
  );
}

// ── Minimum task count gate ───────────────────────────────────────────────────

export function meetsMinTaskCount(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
): boolean {
  return plan.tasks.length >= scenario.expected_min_tasks;
}

// ── Full pass/fail evaluation ─────────────────────────────────────────────────

export type QualityGateReport = {
  passed: boolean;
  hard_fails: WorkflowHardFail[];
  domain_ok: boolean;
  risk_level_ok: boolean;
  task_count_ok: boolean;
  task_type_ok: boolean;
  trace_ok: boolean;
  sensitive_blocked_ok: boolean;
  notes: string[];
};

export function evaluateWorkflowQuality(
  plan: PierreHrWorkflowPlan,
  scenario: PierreWorkflowScenario,
  trace: string[],
): QualityGateReport {
  const hard_fails = runQualityGates(plan, scenario, trace);
  const domain_ok = plan.domain === scenario.expected_domain;
  const risk_level_ok = meetsExpectedRiskLevel(plan, scenario);
  const task_count_ok = meetsMinTaskCount(plan, scenario);
  const task_type_ok = meetsTaskTypeCoverage(plan, scenario);
  const trace_ok = trace.length > 0;
  const sensitive_blocked_ok = scenario.sensitive_case
    ? plan.validation_policy.blocked === true
    : true;

  const notes: string[] = [];
  if (!domain_ok) notes.push(`Domain mismatch: got ${plan.domain}, expected ${scenario.expected_domain}`);
  if (!risk_level_ok) notes.push(`Risk level too low: got ${plan.risk_level}, expected min ${scenario.expected_risk_level}`);
  if (!task_count_ok) notes.push(`Not enough tasks: got ${plan.tasks.length}, min ${scenario.expected_min_tasks}`);
  if (!task_type_ok) notes.push(`Missing expected task type prefixes: ${scenario.expected_task_type_prefixes.join(", ")}`);
  if (!trace_ok) notes.push("No trace entries recorded");
  if (!sensitive_blocked_ok) notes.push("Sensitive case not properly blocked");

  const passed =
    hard_fails.length === 0 &&
    domain_ok &&
    risk_level_ok &&
    task_count_ok &&
    task_type_ok &&
    trace_ok &&
    sensitive_blocked_ok;

  return {
    passed,
    hard_fails,
    domain_ok,
    risk_level_ok,
    task_count_ok,
    task_type_ok,
    trace_ok,
    sensitive_blocked_ok,
    notes,
  };
}
