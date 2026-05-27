// B42 — Bridge between workflow results and cockpit snapshot format

import type { PierreWorkflowExecutionResult, PierreWorkflowVerdict } from "./types";
import type { PierreHrWorkflowPlan } from "../hr/workflows";

// ── Minimal cockpit-compatible task shape ─────────────────────────────────────

export type WorkflowSnapshotTask = {
  id: string;
  type: string;
  title: string;
  status: string;
  approval_required: boolean;
  domain: string;
  risk_level: string;
  workflow_step: string | null;
};

// ── Cockpit-compatible mission snapshot shape ─────────────────────────────────

export type WorkflowMissionSnapshot = {
  id: string;
  domain: string;
  risk_level: string;
  summary: string;
  priority: string;
  approval_required: boolean;
  blocked: boolean;
  task_count: number;
  tasks_ready: number;
  tasks_awaiting_approval: number;
  tasks_blocked: number;
  recommended_next_action: string;
  missing_info_count: number;
};

// ── Convert plan to mission snapshot ─────────────────────────────────────────

export function planToMissionSnapshot(
  missionId: string,
  plan: PierreHrWorkflowPlan,
): WorkflowMissionSnapshot {
  const tasks = plan.tasks;
  return {
    id: missionId,
    domain: plan.domain,
    risk_level: plan.risk_level,
    summary: plan.summary,
    priority: plan.priority,
    approval_required: plan.approval_required,
    blocked: plan.validation_policy.blocked,
    task_count: tasks.length,
    tasks_ready: tasks.filter((t) => t.status === "ready").length,
    tasks_awaiting_approval: tasks.filter((t) => t.status === "awaiting_approval").length,
    tasks_blocked: tasks.filter((t) => t.status === "blocked").length,
    recommended_next_action: plan.recommended_next_action.description,
    missing_info_count: plan.missing_info.length,
  };
}

// ── Convert plan tasks to snapshot tasks ─────────────────────────────────────

export function planToSnapshotTasks(
  missionId: string,
  plan: PierreHrWorkflowPlan,
): WorkflowSnapshotTask[] {
  return plan.tasks.map((t, i) => ({
    id: `${missionId}_t${i}`,
    type: t.type,
    title: t.title,
    status: t.status,
    approval_required: t.approval_required,
    domain: String(t.payload_json.domain ?? plan.domain),
    risk_level: String(t.payload_json.risk_level ?? plan.risk_level),
    workflow_step: typeof t.payload_json.workflow_step === "string" ? t.payload_json.workflow_step : null,
  }));
}

// ── Convert execution result to mission snapshot ──────────────────────────────

export function executionResultToSnapshot(
  result: PierreWorkflowExecutionResult,
): WorkflowMissionSnapshot {
  return planToMissionSnapshot(result.scenario_id, result.plan);
}

// ── Build a summary snapshot from a full B42 verdict ─────────────────────────

export type B42VerdictSnapshot = {
  b42_status: "passed" | "failed";
  workflows_tested: number;
  workflows_passed: number;
  hard_fails: number;
  domain_coverage: string[];
  missions: WorkflowMissionSnapshot[];
};

export function buildB42VerdictSnapshot(verdict: PierreWorkflowVerdict): B42VerdictSnapshot {
  const missions = verdict.results.map((r) =>
    executionResultToSnapshot(r),
  );

  const domainCoverage = [...new Set(verdict.results.map((r) => r.domain))];

  return {
    b42_status: verdict.all_passed ? "passed" : "failed",
    workflows_tested: verdict.workflows_tested,
    workflows_passed: verdict.workflows_passed,
    hard_fails: verdict.hard_fail_count,
    domain_coverage: domainCoverage,
    missions,
  };
}
