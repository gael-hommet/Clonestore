// B42 — Final Workflow Completion — Core types
// Pure module: no DB, no async side-effects

import type {
  PierreHrWorkflowDomain,
  PierreHrWorkflowRiskLevel,
  PierreHrWorkflowPlan,
} from "../hr/workflows";
import type { PierreExecutorOutcome, PierreArtifactRequest } from "../tasks/executors";

// ── Hard fail conditions ──────────────────────────────────────────────────────

export type WorkflowHardFail =
  | "email_sent_real"
  | "sensitive_action_not_blocked"
  | "missing_trace"
  | "cross_tenant_leak"
  | "security_bypass"
  | "b41_policy_violated"
  | "no_tasks_generated"
  | "wrong_domain_classified"
  | "approval_not_required_for_sensitive"
  | "document_content_logged_raw";

// ── Scenario definition ───────────────────────────────────────────────────────

export type PierreWorkflowScenario = {
  id: string;
  name: string;
  description: string;
  domain: PierreHrWorkflowDomain;
  input: string;
  employee_context: Record<string, unknown> | null;
  expected_domain: PierreHrWorkflowDomain;
  expected_risk_level: PierreHrWorkflowRiskLevel;
  expected_approval_required: boolean;
  expected_min_tasks: number;
  expected_task_type_prefixes: string[];
  sensitive_case: boolean;
  expected_blocked: boolean;
  hard_fail_conditions: WorkflowHardFail[];
};

// ── Per-step result ───────────────────────────────────────────────────────────

export type PierreWorkflowStepResult = {
  step_index: number;
  task_type: string;
  task_title: string;
  task_status_in: string;
  ok: boolean;
  outcome: PierreExecutorOutcome | null;
  artifact: PierreArtifactRequest | null;
  notes: string;
};

// ── Full scenario execution result ────────────────────────────────────────────

export type PierreWorkflowExecutionResult = {
  scenario_id: string;
  scenario_name: string;
  domain: PierreHrWorkflowDomain;
  risk_level: PierreHrWorkflowRiskLevel;
  plan: PierreHrWorkflowPlan;
  steps: PierreWorkflowStepResult[];
  hard_fails: WorkflowHardFail[];
  passed: boolean;
  summary: string;
  trace: string[];
  duration_ms: number;
};

// ── Final B42 verdict ─────────────────────────────────────────────────────────

export type PierreWorkflowVerdict = {
  bloc: "B42";
  timestamp: string;
  workflows_tested: number;
  workflows_passed: number;
  workflows_failed: number;
  hard_fail_count: number;
  all_passed: boolean;
  safe_to_close_b42: boolean;
  results: PierreWorkflowExecutionResult[];
  summary: string;
  hard_fails_detail: Array<{ scenario_id: string; scenario_name: string; fails: WorkflowHardFail[] }>;
  gaps: string[];
};

// ── Adapter-injectable interface ──────────────────────────────────────────────

export type B42WorkflowAdapters = {
  logTrace: (scenarioId: string, message: string) => void;
  recordArtifact: (scenarioId: string, artifact: PierreArtifactRequest) => void;
  assertNoRealEmailSent: () => boolean;
};
