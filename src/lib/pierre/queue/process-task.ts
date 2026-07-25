import { executePierreTask, type PierreExecutorTask } from "../tasks/executors";
import { evaluatePierreCloneGuard } from "../hr/cloneguard";
import { evaluateGovernance } from "../hr/governance";

export type PierreQueueTaskRecord = {
  id: string;
  mission_id?: string | null;
  user_id?: string | null;
  agent_slug?: string | null;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  payload?: unknown;
  payload_json?: unknown;
  result?: unknown;
  result_json?: unknown;
  locked_by?: string | null;
  locked_at?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  execute_at?: string | null;
  scheduled_for?: string | null;
  approval_required?: boolean | null;
  retry_count?: number | null;
  max_retries?: number | null;
  last_error?: string | null;
  error_message?: string | null;
  blocked_reason?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
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

  insertArtifact?: (params: {
    taskId: string;
    missionId: string | null;
    userId: string | null;
    artifactRequest: Record<string, unknown>;
  }) => Promise<{ artifact_id: string | null; artifact_kind: string }>;
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
      finalStatus: "done";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractArtifactRequest(
  result: Record<string, unknown>,
): Record<string, unknown> | null {
  const artifactRequest = result.artifact_request;
  return isRecord(artifactRequest) ? artifactRequest : null;
}

function resolvePayload(task: PierreQueueTaskRecord): unknown {
  if (task.payload !== undefined && task.payload !== null) return task.payload;
  if (task.payload_json !== undefined && task.payload_json !== null) {
    return task.payload_json;
  }
  return {};
}

function resolveResult(task: PierreQueueTaskRecord): unknown {
  if (task.result !== undefined && task.result !== null) return task.result;
  if (task.result_json !== undefined && task.result_json !== null) {
    return task.result_json;
  }
  return {};
}

function isTerminalStatus(status: string | null): boolean {
  return (
    status === "done" ||
    status === "error" ||
    status === "cancelled" ||
    status === "blocked"
  );
}

function isDue(task: PierreQueueTaskRecord, now: Date): boolean {
  const dateValue = asString(task.execute_at) || asString(task.scheduled_for);
  if (!dateValue) return true;

  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return true;

  return timestamp <= now.getTime();
}

function nextRetryDate(now: Date, retryCount: number): string {
  const delayMinutes = Math.min(30, Math.max(2, 2 * (retryCount + 1)));
  return new Date(now.getTime() + delayMinutes * 60_000).toISOString();
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

async function persistArtifactIfNeeded(params: {
  persistence: PierreQueuePersistenceAdapter;
  taskId: string;
  missionId: string | null;
  userId: string | null;
  result: Record<string, unknown>;
}) {
  const { persistence, taskId, missionId, userId, result } = params;
  const artifactRequest = extractArtifactRequest(result);

  if (!artifactRequest) {
    return result;
  }

  if (!persistence.insertArtifact) {
    await safeInsertLog(persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: "warning",
      event: "artifact_persistence_unavailable",
      message:
        "La tâche a produit une demande d'artefact, mais l'adapter de persistance est indisponible.",
      payload: {
        artifact_request: artifactRequest,
      },
    });

    return {
      ...result,
      artifact_persistence: {
        ok: false,
        reason: "INSERT_ARTIFACT_ADAPTER_MISSING",
      },
    };
  }

  const artifact = await persistence.insertArtifact({
    taskId,
    missionId,
    userId,
    artifactRequest,
  });

  await safeInsertLog(persistence, {
    mission_id: missionId,
    task_id: taskId,
    level: "info",
    event: "artifact_persisted",
    message: `Artefact Pierre persisté : ${artifact.artifact_kind}`,
    payload: {
      artifact_id: artifact.artifact_id,
      artifact_kind: artifact.artifact_kind,
      artifact_request: artifactRequest,
    },
  });

  return {
    ...result,
    artifact_persistence: {
      ok: true,
      artifact_id: artifact.artifact_id,
      artifact_kind: artifact.artifact_kind,
    },
  };
}

export async function processPierreTask(
  input: PierreProcessTaskInput,
): Promise<PierreProcessTaskResult> {
  const now = input.now ?? new Date();
  const task = input.task;
  const taskId = task.id;
  const missionId = asString(task.mission_id);
  const userId = asString(task.user_id);
  const currentStatus = asString(task.status) || "ready";

  try {
    if (isTerminalStatus(currentStatus)) {
      const reason = `La tâche est déjà dans un statut terminal : ${currentStatus}.`;

      await safeInsertLog(input.persistence, {
        mission_id: missionId,
        task_id: taskId,
        level: "info",
        event: "task_run_rejected",
        message: reason,
        payload: {
          status: currentStatus,
        },
      });

      return {
        ok: false,
        phase: "run_rejected",
        taskId,
        missionId,
        finalStatus: currentStatus,
        reason,
        errorCode: "TERMINAL_STATUS",
      };
    }

    if (currentStatus === "awaiting_approval") {
      const reason = "La tâche attend une validation humaine.";

      await safeInsertLog(input.persistence, {
        mission_id: missionId,
        task_id: taskId,
        level: "warning",
        event: "task_run_rejected",
        message: reason,
        payload: {
          status: currentStatus,
        },
      });

      return {
        ok: false,
        phase: "run_rejected",
        taskId,
        missionId,
        finalStatus: currentStatus,
        reason,
        errorCode: "APPROVAL_REQUIRED",
      };
    }

    if (!isDue(task, now)) {
      const reason = "La tâche est planifiée pour plus tard.";

      await safeInsertLog(input.persistence, {
        mission_id: missionId,
        task_id: taskId,
        level: "info",
        event: "task_run_rejected",
        message: reason,
        payload: {
          execute_at: task.execute_at ?? task.scheduled_for ?? null,
        },
      });

      return {
        ok: false,
        phase: "run_rejected",
        taskId,
        missionId,
        finalStatus: currentStatus,
        reason,
        errorCode: "NOT_DUE_YET",
      };
    }

    // Governance re-evaluation gate — parity with tasks/execute-task.ts.
    // The queue worker previously called executePierreTask directly, trusting only the
    // governance flags baked into payload_json at task-creation time (executors.ts checkHrGate).
    // A task created by a path that never classified it (or whose flags were stripped) could
    // therefore auto-execute an absolute-refusal / black-level action (sanction, licenciement,
    // harcèlement…). We re-run CloneGuard + governance on the live task content here and hard-block
    // on any refuse/block decision, so a sensitive action can never complete on this path.
    {
      const govPayload = resolvePayload(task);
      const guardEval = evaluatePierreCloneGuard({
        task_type: asString(task.type),
        task_title: asString(task.title),
        payload_json: isRecord(govPayload) ? govPayload : null,
        approval_required: task.approval_required === true,
        now: now.toISOString(),
      });
      const govEval = evaluateGovernance({
        task_type: asString(task.type),
        task_title: asString(task.title),
        payload_json: isRecord(govPayload) ? govPayload : null,
        approval_required: task.approval_required === true,
        guard_evaluation: guardEval,
        now: now.toISOString(),
      });

      const hardBlocked =
        guardEval.decision === "refuse" ||
        guardEval.decision === "block" ||
        govEval.decision === "refuse" ||
        govEval.decision === "block";

      if (hardBlocked) {
        const reason =
          govEval.explanation ||
          guardEval.explanation ||
          "Action bloquée par la gouvernance : décision humaine requise.";

        await input.persistence.updateTask(taskId, {
          status: "blocked",
          last_error: reason,
          blocked_reason: reason,
          locked_by: null,
          locked_at: null,
          updated_at: now.toISOString(),
        });

        await safeInsertLog(input.persistence, {
          mission_id: missionId,
          task_id: taskId,
          level: "warning",
          event: "task_governance_blocked",
          message: reason,
          payload: {
            guard_decision: guardEval.decision,
            governance_decision: govEval.decision,
            risk_level: govEval.risk_level,
          },
        });

        return {
          ok: false,
          phase: "released",
          taskId,
          missionId,
          finalStatus: "blocked",
          reason,
          errorCode: "GOVERNANCE_BLOCKED",
        };
      }
    }

    await input.persistence.updateTask(taskId, {
      status: "running",
      locked_by: input.workerId,
      locked_at: now.toISOString(),
      started_at: task.started_at ?? now.toISOString(),
      updated_at: now.toISOString(),
    });

    await safeInsertLog(input.persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: "info",
      event: "task_run_started",
      message: "Exécution de la tâche Pierre démarrée.",
      payload: {
        worker_id: input.workerId,
        previous_status: currentStatus,
      },
    });

    const executorTask: PierreExecutorTask = {
      ...task,
      payload: resolvePayload(task),
      result: resolveResult(task),
      status: "running",
      started_at: task.started_at ?? now.toISOString(),
      claimed_by: input.workerId,
      locked_by: input.workerId,
    };

    const outcome = await executePierreTask(executorTask, { now });

    if (outcome.ok) {
      const finalResult = await persistArtifactIfNeeded({
        persistence: input.persistence,
        taskId,
        missionId,
        userId,
        result: outcome.result,
      });

      await input.persistence.updateTask(taskId, {
        status: "done",
        result_json: finalResult,
        last_error: null,
        locked_by: null,
        locked_at: null,
        finished_at: now.toISOString(),
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
        finalStatus: "done",
        result: finalResult,
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
      const finalStatus =
        outcome.status === "awaiting_info" ? "blocked" : outcome.status;

      await input.persistence.updateTask(taskId, {
        status: finalStatus,
        last_error: outcome.message,
        locked_by: null,
        locked_at: null,
        blocked_reason:
          finalStatus === "blocked" ? outcome.message : task.blocked_reason ?? null,
        updated_at: now.toISOString(),
      });

      return {
        ok: false,
        phase: "released",
        taskId,
        missionId,
        finalStatus,
        reason: outcome.message,
        errorCode: outcome.error_code,
      };
    }

    const retryCount = asNumber(task.retry_count) ?? 0;
    const maxRetries = asNumber(task.max_retries) ?? 3;

    if (retryCount >= maxRetries) {
      await input.persistence.updateTask(taskId, {
        status: "error",
        last_error: outcome.message,
        locked_by: null,
        locked_at: null,
        updated_at: now.toISOString(),
      });

      return {
        ok: false,
        phase: "executor_failed",
        taskId,
        missionId,
        finalStatus: "error",
        reason: outcome.message,
        errorCode: outcome.error_code,
      };
    }

    await input.persistence.updateTask(taskId, {
      status: "retry",
      retry_count: retryCount + 1,
      execute_at: nextRetryDate(now, retryCount),
      last_error: outcome.message,
      locked_by: null,
      locked_at: null,
      updated_at: now.toISOString(),
    });

    await safeInsertLog(input.persistence, {
      mission_id: missionId,
      task_id: taskId,
      level: "warning",
      event: "task_retry_scheduled",
      message: "La tâche Pierre a échoué et sera retentée.",
      payload: {
        error_code: outcome.error_code,
        failure_message: outcome.message,
        retry_count: retryCount + 1,
        max_retries: maxRetries,
      },
    });

    return {
      ok: false,
      phase: "retry_scheduled",
      taskId,
      missionId,
      finalStatus: "retry",
      reason: outcome.message,
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
      status: "error",
      last_error: message,
      locked_by: null,
      locked_at: null,
      updated_at: now.toISOString(),
    });

    return {
      ok: false,
      phase: "process_error",
      taskId,
      missionId,
      finalStatus: "error",
      reason: message,
      errorCode: "PROCESS_TASK_ERROR",
    };
  }
}