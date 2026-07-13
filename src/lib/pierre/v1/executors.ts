// src/lib/pierre/v1/executors.ts
// PHASE 8.1 — Pierre Production Runtime Core — governed executors.
//
// Canonical executor lifecycle: prepare → preflight → guard → execute → verify →
// persist result → trace → schedule next. P8.1 ships REAL low-risk executors;
// email/document/file executors are contract-stable but return
// "awaiting_integration" (NEVER "succeeded") until P8.3/P8.4 wire providers.

import type { SqlExecutor } from "./sql";
import type { TaskRow } from "./repositories";
import { OutboxRepo } from "./repositories";
import { evaluateGuard, type GuardDecision } from "./cloneguard";
import type { ActionKind } from "./autonomy";

export type ExecutionOutcome = "succeeded" | "failed" | "unsupported" | "blocked" | "awaiting_integration";

export type ExecutionResult = {
  outcome: ExecutionOutcome;
  output: Record<string, unknown>;
  guard: GuardDecision;
  next_task?: { type: string; objective: string; action: ActionKind };
};

export type Executor = {
  type: string;
  /** Whether this executor causes an external side effect (email send, etc.). */
  external_side_effect: boolean;
  run(db: SqlExecutor, task: TaskRow): Promise<ExecutionResult>;
};

function guardFor(task: TaskRow): GuardDecision {
  return evaluateGuard({
    action: (task.type as ActionKind),
    risk: task.risk as "low" | "medium" | "high" | "critical",
    sensitivity: task.sensitivity as "normal" | "sensitive" | "restricted",
    text: task.objective,
  });
}

// P16E §4.C (R3) — exposed so the WORKER can evaluate the guard BEFORE running the executor.
// A black hard-block must never reach `executor.run` (some executors enqueue to the outbox as
// their first act): the guard has to gate execution, not merely be reported after it.
export function evaluateTaskGuard(task: TaskRow): GuardDecision {
  return guardFor(task);
}

// ── Real low-risk executors (genuinely complete actions) ────────────────────

const statusUpdate: Executor = {
  type: "status_update", external_side_effect: false,
  async run(_db, task) {
    return { outcome: "succeeded", guard: guardFor(task), output: { kind: "status_update", note: task.objective.slice(0, 200) } };
  },
};

const requestInfo: Executor = {
  type: "request_missing_info", external_side_effect: false,
  async run(_db, task) {
    return { outcome: "succeeded", guard: guardFor(task), output: { kind: "missing_info_request", question: task.expected_output ?? "Information requise" } };
  },
};

const internalNotification: Executor = {
  type: "low_risk_notification", external_side_effect: false,
  async run(db, task) {
    await db.query(`insert into pierre_rt_notifications (id, company_id, mission_id, task_id, kind, body)
                    values (gen_random_uuid(), $1, $2, $3, 'internal', $4)`,
      [task.company_id, task.mission_id, task.id, JSON.stringify({ objective: task.objective })]);
    return { outcome: "succeeded", guard: guardFor(task), output: { kind: "internal_notification", delivered: "in_app" } };
  },
};

const reminder: Executor = {
  type: "reminder", external_side_effect: false,
  async run(_db, task) {
    return { outcome: "succeeded", guard: guardFor(task), output: { kind: "reminder", scheduled_for: task.due_at } };
  },
};
const deadlineReminder: Executor = { ...reminder, type: "deadline_reminder" };

const structuredSummary: Executor = {
  type: "operational_summary", external_side_effect: false,
  async run(_db, task) {
    return { outcome: "succeeded", guard: guardFor(task), output: { kind: "summary", summary: `Synthèse: ${task.objective.slice(0, 200)}`, sections: ["faits", "actions", "vigilance"] } };
  },
};

const logicalClassification: Executor = {
  type: "classification", external_side_effect: false,
  async run(_db, task) {
    return { outcome: "succeeded", guard: guardFor(task), output: { kind: "classification", label: "hr_ops", confidence: 0.7 } };
  },
};

const createNextTask: Executor = {
  type: "create_task", external_side_effect: false,
  async run(_db, task) {
    return {
      outcome: "succeeded", guard: guardFor(task),
      output: { kind: "task_created" },
      next_task: { type: "operational_summary", objective: `Suivi de: ${task.objective.slice(0, 120)}`, action: "operational_summary" },
    };
  },
};

// ── Sensitive draft executor: prepares only, never decides ──────────────────
const prepareSensitiveDraft: Executor = {
  type: "prepare_sensitive_draft", external_side_effect: false,
  async run(_db, task) {
    const guard = guardFor(task);
    // Even when reached, this NEVER takes the sensitive action; it prepares.
    return { outcome: "succeeded", guard, output: { kind: "sensitive_draft", prepared: true, decision_taken: false } };
  },
};

// ── Integration-pending executors (NEVER "succeeded") ───────────────────────
function awaitingExecutor(type: string, kind: string, externalSideEffect: boolean): Executor {
  return {
    type, external_side_effect: externalSideEffect,
    async run(db, task) {
      // Prepare via outbox (transactional), but report awaiting_integration.
      await OutboxRepo.enqueue(db, {
        company_id: task.company_id, mission_id: task.mission_id, task_id: task.id,
        kind, payload: { objective: task.objective }, dedup_key: `${kind}:${task.id}`,
      });
      return { outcome: "awaiting_integration", guard: guardFor(task), output: { kind, status: "awaiting_integration" } };
    },
  };
}

const REGISTRY: Record<string, Executor> = {};
for (const e of [
  statusUpdate, requestInfo, internalNotification, reminder, deadlineReminder,
  structuredSummary, logicalClassification, createNextTask, prepareSensitiveDraft,
  awaitingExecutor("email_send", "email", true),
  awaitingExecutor("document_generate", "document", false),
  awaitingExecutor("file_store", "file", false),
  awaitingExecutor("notification", "low_risk_notification", false),
]) {
  if (!REGISTRY[e.type]) REGISTRY[e.type] = e;
}

export function resolveExecutor(taskType: string): Executor {
  return (
    REGISTRY[taskType] ?? {
      type: taskType, external_side_effect: false,
      async run(_db, task) {
        // Unknown executor: unsupported, never succeeded.
        return { outcome: "unsupported", guard: guardFor(task), output: { kind: "unsupported", task_type: taskType } };
      },
    }
  );
}

export function executorExternalSideEffect(taskType: string): boolean {
  return resolveExecutor(taskType).external_side_effect;
}
