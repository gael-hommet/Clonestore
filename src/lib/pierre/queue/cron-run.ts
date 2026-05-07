import type { PierreQueuePersistenceAdapter } from "./process-task";
import type { PierreQueueSourceAdapter } from "./process-next";
import { runPierreWorkerBatch } from "./worker";

export type PierreCronRunConfig = {
  workerCount?: number;
  batchSizePerWorker?: number;
  lockMinutes?: number;
  stopOnFirstFailure?: boolean;
  workerIdPrefix?: string;
};

export type PierreCronRunAdapters = {
  queueSource: PierreQueueSourceAdapter;
  persistence: PierreQueuePersistenceAdapter;
};

export type PierreCronRunResult = {
  startedAt: string;
  endedAt: string;
  workers: Array<{
    workerId: string;
    attempted: number;
    completed: number;
    failed: number;
    idle: boolean;
  }>;
  totals: {
    attempted: number;
    completed: number;
    failed: number;
    idleWorkers: number;
  };
};

function sanitizeWorkerCount(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(50, Math.floor(value)));
}

export async function runPierreCronBatch(
  config: PierreCronRunConfig,
  adapters: PierreCronRunAdapters,
): Promise<PierreCronRunResult> {
  const startedAt = new Date();
  const workerCount = sanitizeWorkerCount(config.workerCount);
  const prefix = config.workerIdPrefix || "pierre-worker";
  const workers: PierreCronRunResult["workers"] = [];

  let attempted = 0;
  let completed = 0;
  let failed = 0;
  let idleWorkers = 0;

  for (let index = 0; index < workerCount; index += 1) {
    const workerId = `${prefix}-${index + 1}`;

    const result = await runPierreWorkerBatch(
      {
        workerId,
        batchSize: config.batchSizePerWorker,
        lockMinutes: config.lockMinutes,
        stopOnFirstFailure: config.stopOnFirstFailure,
      },
      adapters,
    );

    workers.push({
      workerId: result.workerId,
      attempted: result.attempted,
      completed: result.completed,
      failed: result.failed,
      idle: result.idle,
    });

    attempted += result.attempted;
    completed += result.completed;
    failed += result.failed;
    if (result.idle) idleWorkers += 1;
  }

  const endedAt = new Date();

  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    workers,
    totals: {
      attempted,
      completed,
      failed,
      idleWorkers,
    },
  };
}