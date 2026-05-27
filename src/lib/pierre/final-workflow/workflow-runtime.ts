// B42 — Workflow runtime: execute one scenario end-to-end

import { buildPierreHrWorkflowPlan } from "../hr/workflows";
import { executePierreTask } from "../tasks/executors";
import type { PierreArtifactRequest } from "../tasks/executors";
import type {
  PierreWorkflowScenario,
  PierreWorkflowExecutionResult,
  PierreWorkflowStepResult,
  B42WorkflowAdapters,
} from "./types";
import { evaluateWorkflowQuality } from "./workflow-quality-gates";
import { makeExecutorTask } from "./workflow-fixtures";

// ── Status eligibility for execution ─────────────────────────────────────────

function isEligibleForExecution(status: string): boolean {
  return status === "ready";
}

// ── Extract artifact from executor outcome ────────────────────────────────────

function extractArtifact(
  outcome: Awaited<ReturnType<typeof executePierreTask>>,
): PierreArtifactRequest | null {
  if (!outcome.ok) return null;
  const result = outcome.result;
  if (
    result &&
    typeof result === "object" &&
    "artifact_request" in result &&
    result.artifact_request
  ) {
    return result.artifact_request as PierreArtifactRequest;
  }
  return null;
}

// ── Single scenario runner ────────────────────────────────────────────────────

export async function runWorkflowScenario(
  scenario: PierreWorkflowScenario,
  adapters: B42WorkflowAdapters,
  now: Date = new Date(),
): Promise<PierreWorkflowExecutionResult> {
  const startTime = Date.now();
  const trace: string[] = [];
  const steps: PierreWorkflowStepResult[] = [];

  const log = (msg: string) => {
    trace.push(msg);
    adapters.logTrace(scenario.id, msg);
  };

  log(`[B42] Start scenario: ${scenario.id} — ${scenario.name}`);
  log(`[B42] Domain: ${scenario.domain} | Sensitive: ${scenario.sensitive_case}`);

  // ── Step 1: Build the workflow plan ────────────────────────────────────────

  const plan = buildPierreHrWorkflowPlan(scenario.input, {
    employee_context: scenario.employee_context,
  });

  log(`[B42] Plan built: domain=${plan.domain} risk=${plan.risk_level} tasks=${plan.tasks.length}`);
  log(`[B42] Approval required: ${plan.approval_required}`);
  log(`[B42] Validation policy: blocked=${plan.validation_policy.blocked}`);

  if (plan.missing_info.length > 0) {
    log(`[B42] Missing info: ${plan.missing_info.join(", ")}`);
  }

  if (plan.blocked_actions.length > 0) {
    log(`[B42] Blocked actions (${plan.blocked_actions.length}): Pierre cannot act alone`);
  }

  // ── Step 2: Execute each task in the plan ─────────────────────────────────

  for (let i = 0; i < plan.tasks.length; i++) {
    const taskDraft = plan.tasks[i];
    const taskId = `${scenario.id}_task_${i}`;
    const isEligible = isEligibleForExecution(taskDraft.status);

    log(`[B42] Task[${i}] type=${taskDraft.type} status=${taskDraft.status} eligible=${isEligible}`);

    if (!isEligible) {
      // Task is awaiting_approval or blocked — record as skipped (correct behavior)
      const notes =
        taskDraft.status === "awaiting_approval"
          ? "Task awaiting human approval — not executed (correct)"
          : taskDraft.status === "blocked"
          ? "Task blocked — awaiting missing information (correct)"
          : `Task status=${taskDraft.status} — skipped`;

      steps.push({
        step_index: i,
        task_type: taskDraft.type,
        task_title: taskDraft.title,
        task_status_in: taskDraft.status,
        ok: true, // Correct behavior — not a failure
        outcome: null,
        artifact: null,
        notes,
      });

      log(`[B42] Task[${i}] skipped correctly: ${notes}`);
      continue;
    }

    // Execute eligible (ready) task
    const executorTask = makeExecutorTask(taskId, taskDraft, "running");
    const outcome = await executePierreTask(executorTask, { now });
    const artifact = extractArtifact(outcome);

    if (artifact) {
      adapters.recordArtifact(scenario.id, artifact);
      log(`[B42] Task[${i}] artifact: kind=${artifact.kind}`);
    }

    const stepOk = outcome.ok || outcome.status === "awaiting_approval";
    log(`[B42] Task[${i}] outcome: ok=${outcome.ok} status=${outcome.status}`);

    steps.push({
      step_index: i,
      task_type: taskDraft.type,
      task_title: taskDraft.title,
      task_status_in: taskDraft.status,
      ok: stepOk,
      outcome,
      artifact,
      notes: outcome.ok
        ? `Executed: ${outcome.log.message}`
        : `Not executed: ${outcome.message}`,
    });
  }

  // ── Step 3: Quality gate evaluation ──────────────────────────────────────

  const qualityReport = evaluateWorkflowQuality(plan, scenario, trace);

  log(`[B42] Quality gates: passed=${qualityReport.passed} hard_fails=${qualityReport.hard_fails.length}`);
  if (qualityReport.notes.length > 0) {
    qualityReport.notes.forEach((n) => log(`[B42] Gate note: ${n}`));
  }

  // ── Step 4: No-real-email assertion ──────────────────────────────────────

  const noRealEmail = adapters.assertNoRealEmailSent();
  if (!noRealEmail) {
    qualityReport.hard_fails.push("email_sent_real");
    log(`[B42] HARD FAIL: real email sent — violates B39 policy`);
  }

  const duration_ms = Date.now() - startTime;
  const passed = qualityReport.passed && noRealEmail;

  const summary = passed
    ? `PASS — ${scenario.name}: ${plan.tasks.length} tasks, domain ${plan.domain}, risk ${plan.risk_level}`
    : `FAIL — ${scenario.name}: ${qualityReport.hard_fails.join(", ")} | ${qualityReport.notes.join("; ")}`;

  log(`[B42] Scenario ${passed ? "PASSED" : "FAILED"}: ${summary}`);

  return {
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    domain: plan.domain,
    risk_level: plan.risk_level,
    plan,
    steps,
    hard_fails: qualityReport.hard_fails,
    passed,
    summary,
    trace,
    duration_ms,
  };
}
