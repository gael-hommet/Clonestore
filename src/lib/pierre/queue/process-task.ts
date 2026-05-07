import { buildPierreTaskRunPatch, decidePierreTaskRun } from "../tasks/run";
import { executePierreTask, type PierreExecutorTask } from "../tasks/executors";
import { buildPierreTaskReleasePatch } from "../tasks/release";
import { buildPierreTaskRetryPatch } from "../tasks/retry";

export type PierreQueueTaskRecord = {
  id: string;
  mission_id?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  payload?: unknown;
  result?: unknown;
  claimed_by?: string | null;
  claimed_at?: string | null;
  locked_until?: string | null;
  scheduled_for?: string | null;
  approval_required?: boolean | null;
  retry_count?: number | null;
  max_retries?: number | null;
  error_message?: string | null;
  blocked_reason?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type PierreQueuePersistenceAdapter = {
  updateTask: (
    taskId: string,
    patch: Record<string, unknown>,
  ) => Promise<void>;
  insertTaskLog: (entry: {
    mission_id?: string | null;
    task_id?: string | null;
    level: "info" | "warning" | "error";
    event: string;
    message: string;
    payload?: Record<string, unknown> | null;
  }) => Promise<void>;
};

export type PierreProcessTaskInput = {
  task: PierreQueueTaskRecord;
  workerId: string;
  persistence: PierreQueuePersistenceAdapter;
  now?: Date;
};

export type PierreProcessTaskResult =
  | {
      ok: true;
      phase: "completed";
      taskId: string;
      missionId: string | null;
      finalStatus: "completed";
      result: Record<string, unknown>;
    }
  | {
      ok: false;
      phase:
        | "run_rejected"
        | "executor_failed"
        | "retry_scheduled"
        | "released"
        | "process_error";
      taskId: string;
      missionId: string | null;
      finalStatus: string;
      reason: string;
      errorCode?: string;
    };

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

async function safeInsertLog(
  persistence: PierreQueuePersistenceAdapter,
  entry: {
    mission_id?: string | null;
    task_id?: string | null;
    level: "info" | "warning" | "error";
    event: string;
    message: string;
    payload?: Record<string, unknown> | null;
  },
) {
  await persistence.insertTaskLog(entry);
}

export async function processPierreTask(
  input: PierreProcessTaskInput,
): Promise<PierreProcessTaskResult> {
  const now = input.now ?? new Date();
  const task = input.task;
  const taskId = task.id;
  const missionId = asString(task.mission_id);

  try {
    const runDecision = decidePierreTaskRun({
      task,
      now,
    });

    if (!runDecision.allowed) {
      await safeInsertLog(input.persistence, {
        mission_id: missionId,
        task_id: taskId,
        level:
          runDecision.run_code === "TERMINAL_STATUS" ? "info" : "warning",
        event: "task_run_rejected",
        message: runDecision.reason,
        payload: {
          run_code: runDecision.run_code,
          next_status: runDecision.next_status,
        },
      });

      return {
        ok: false,
        phase: "run_rejected",
        taskId,
        missionId,
        finalStatus: runDecision.next_status,
        reason: runDecision.reason,
        errorCode: runDecision.run_code,
      };
    }

    const runPatch = buildPierreTaskRunPatch({
      task,
      now,
    });

    await input.persistence.updateTask(taskId, runPatch.patch);

    await safeInsertLog(input.persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: "info",
      event: "task_run_started",
      message: runPatch.reason,
      payload: {
        worker_id: input.workerId,
      },
    });

    const executorTask: PierreExecutorTask = {
      ...task,
      status: "running",
      started_at: now.toISOString(),
      claimed_by: input.workerId,
    };

    const outcome = await executePierreTask(executorTask, { now });

    if (outcome.ok) {
      await input.persistence.updateTask(taskId, {
        status: "completed",
        result: outcome.result,
        error_message: null,
        blocked_reason: null,
        locked_until: null,
        claimed_at: null,
        claimed_by: null,
        completed_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      await safeInsertLog(input.persistence, {
        mission_id: missionId,
        task_id: taskId,
        level: outcome.log.level,
        event: outcome.log.event,
        message: outcome.log.message,
        payload: outcome.log.payload || null,
      });

      return {
        ok: true,
        phase: "completed",
        taskId,
        missionId,
        finalStatus: "completed",
        result: outcome.result,
      };
    }

    await safeInsertLog(input.persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: outcome.log.level,
      event: outcome.log.event,
      message: outcome.log.message,
      payload: outcome.log.payload || null,
    });

    if (
      outcome.status === "awaiting_info" ||
      outcome.status === "awaiting_approval" ||
      outcome.status === "blocked"
    ) {
      const releasePatch = buildPierreTaskReleasePatch({
        task: {
          ...task,
          status: "running",
          claimed_by: input.workerId,
          claimed_at: now.toISOString(),
        },
        workerId: input.workerId,
        now,
        mode: "unlock_only",
        force: true,
      });

      await input.persistence.updateTask(taskId, {
        ...releasePatch.patch,
        status: outcome.status,
        error_message:
          outcome.status === "blocked" ? outcome.message : null,
        blocked_reason:
          outcome.status === "blocked" ? outcome.message : null,
        updated_at: now.toISOString(),
      });

      return {
        ok: false,
        phase: "released",
        taskId,
        missionId,
        finalStatus: outcome.status,
        reason: outcome.message,
        errorCode: outcome.error_code,
      };
    }

    const retryPatch = buildPierreTaskRetryPatch({
      task: {
        ...task,
        status: "failed",
      },
      now,
    });

    if (!retryPatch.allowed) {
      await input.persistence.updateTask(taskId, {
        status: "failed",
        error_message: outcome.message,
        locked_until: null,
        claimed_at: null,
        claimed_by: null,
        updated_at: now.toISOString(),
      });

      return {
        ok: false,
        phase: "executor_failed",
        taskId,
        missionId,
        finalStatus: "failed",
        reason: outcome.message,
        errorCode: outcome.error_code,
      };
    }

    await input.persistence.updateTask(taskId, {
      ...retryPatch.patch,
      error_message: outcome.message,
      updated_at: now.toISOString(),
    });

    await safeInsertLog(input.persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: "warning",
      event: "task_retry_scheduled",
      message: retryPatch.reason,
      payload: {
        error_code: outcome.error_code,
        failure_message: outcome.message,
      },
    });

    return {
      ok: false,
      phase: "retry_scheduled",
      taskId,
      missionId,
      finalStatus: "scheduled",
      reason: retryPatch.reason,
      errorCode: outcome.error_code,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Task processing failed.";

    await safeInsertLog(input.persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: "error",
      event: "task_process_error",
      message,
      payload: null,
    });

    await input.persistence.updateTask(taskId, {
      status: "failed",
      error_message: message,
      locked_until: null,
      claimed_at: null,
      claimed_by: null,
      updated_at: now.toISOString(),
    });

    return {
      ok: false,
      phase: "process_error",
      taskId,
      missionId,
      finalStatus: "failed",
      reason: message,
      errorCode: "PROCESS_TASK_ERROR",
    };
  }
}