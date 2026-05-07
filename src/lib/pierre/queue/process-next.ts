import { buildPierreTaskClaimPatch, decidePierreTaskClaim } from "../tasks/claim";
import { processPierreTask, type PierreQueuePersistenceAdapter, type PierreQueueTaskRecord } from "./process-task";

export type PierreQueueSourceAdapter = {
  fetchNextRunnableTask: (params: {
    now: Date;
  }) => Promise<PierreQueueTaskRecord | null>;
};

export type PierreProcessNextInput = {
  workerId: string;
  queueSource: PierreQueueSourceAdapter;
  persistence: PierreQueuePersistenceAdapter;
  now?: Date;
  lockMinutes?: number;
};

export type PierreProcessNextResult =
  | {
      ok: true;
      phase: "completed";
      processed: true;
      taskId: string;
      missionId: string | null;
      finalStatus: string;
    }
  | {
      ok: false;
      phase: "idle" | "claim_rejected" | "processing_failed";
      processed: false;
      taskId?: string;
      missionId?: string | null;
      finalStatus?: string;
      reason: string;
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

export async function processNextPierreTask(
  input: PierreProcessNextInput,
): Promise<PierreProcessNextResult> {
  const now = input.now ?? new Date();
  const nextTask = await input.queueSource.fetchNextRunnableTask({ now });

  if (!nextTask) {
    return {
      ok: false,
      phase: "idle",
      processed: false,
      reason: "Aucune tâche exécutable n’est disponible.",
    };
  }

  const missionId = asString(nextTask.mission_id);

  const claimDecision = decidePierreTaskClaim({
    task: nextTask,
    workerId: input.workerId,
    now,
    lockMinutes: input.lockMinutes,
  });

  if (!claimDecision.allowed) {
    await input.persistence.insertTaskLog({
      mission_id: missionId,
      task_id: nextTask.id,
      level: "warning",
      event: "task_claim_rejected",
      message: claimDecision.reason,
      payload: {
        conflict_code: claimDecision.conflict_code,
      },
    });

    return {
      ok: false,
      phase: "claim_rejected",
      processed: false,
      taskId: nextTask.id,
      missionId,
      finalStatus: claimDecision.next_status,
      reason: claimDecision.reason,
    };
  }

  const claimPatch = buildPierreTaskClaimPatch({
    task: nextTask,
    workerId: input.workerId,
    now,
    lockMinutes: input.lockMinutes,
  });

  await input.persistence.updateTask(nextTask.id, claimPatch.patch);

  await input.persistence.insertTaskLog({
    mission_id: missionId,
    task_id: nextTask.id,
    level: "info",
    event: "task_claimed",
    message: claimPatch.reason,
    payload: {
      worker_id: input.workerId,
    },
  });

  const processed = await processPierreTask({
    task: {
      ...nextTask,
      ...claimPatch.patch,
    },
    workerId: input.workerId,
    persistence: input.persistence,
    now,
  });

  if (processed.ok) {
    return {
      ok: true,
      phase: "completed",
      processed: true,
      taskId: processed.taskId,
      missionId: processed.missionId,
      finalStatus: processed.finalStatus,
    };
  }

  return {
    ok: false,
    phase: "processing_failed",
    processed: false,
    taskId: processed.taskId,
    missionId: processed.missionId,
    finalStatus: processed.finalStatus,
    reason: processed.reason,
  };
}