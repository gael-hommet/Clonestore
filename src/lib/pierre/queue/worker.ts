import type { PierreQueuePersistenceAdapter, PierreQueueTaskRecord } from "./process-task";
import type { PierreQueueSourceAdapter } from "./process-next";
import { processNextPierreTask } from "./process-next";

export type PierreWorkerConfig = {
  workerId: string;
  lockMinutes?: number;
  batchSize?: number;
  stopOnFirstFailure?: boolean;
};

export type PierreWorkerAdapters = {
  queueSource: PierreQueueSourceAdapter;
  persistence: PierreQueuePersistenceAdapter;
};

export type PierreWorkerRunResult = {
  workerId: string;
  startedAt: string;
  endedAt: string;
  attempted: number;
  completed: number;
  failed: number;
  idle: boolean;
  items: Array<{
    ok: boolean;
    taskId?: string;
    missionId?: string | null;
    phase: string;
    finalStatus?: string;
    reason?: string;
  }>;
};

function sanitizeBatchSize(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 5;
  }
  return Math.max(1, Math.min(100, Math.floor(value)));
}

export async function runPierreWorkerBatch(
  config: PierreWorkerConfig,
  adapters: PierreWorkerAdapters,
): Promise<PierreWorkerRunResult> {
  const startedAt = new Date();
  const batchSize = sanitizeBatchSize(config.batchSize);
  const items: PierreWorkerRunResult["items"] = [];

  let attempted = 0;
  let completed = 0;
  let failed = 0;
  let idle = false;

  for (let index = 0; index < batchSize; index += 1) {
    attempted += 1;

    const result = await processNextPierreTask({
      workerId: config.workerId,
      queueSource: adapters.queueSource,
      persistence: adapters.persistence,
      now: new Date(),
      lockMinutes: config.lockMinutes,
    });

    items.push({
      ok: result.ok,
      taskId: result.taskId,
      missionId: result.missionId,
      phase: result.phase,
      finalStatus: result.finalStatus,
      reason: "reason" in result ? result.reason : undefined,
    });

    if (result.phase === "idle") {
      idle = true;
      break;
    }

    if (result.ok) {
      completed += 1;
    } else {
      failed += 1;
      if (config.stopOnFirstFailure) {
        break;
      }
    }
  }

  const endedAt = new Date();

  return {
    workerId: config.workerId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    attempted,
    completed,
    failed,
    idle,
    items,
  };
}