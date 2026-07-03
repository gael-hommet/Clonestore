// src/lib/pierre/v1/cognitive-runtime/continuation.ts
// PHASE 8.14 (D6) — the authoritative continuation loop. Unlike a status-only read, this RELOADS the
// durable cognitive operation, drives the real durable worker to resume in-flight work, re-reads the
// persisted run status, maps it to a cognitive terminal state, and PERSISTS the new state. It resumes
// after restart/approval/provider/date because the run engine's fencing/lease/waits already hold the
// durable position — continuation reconciles the cognitive operation with that durable truth. Completed
// effects are never repeated (the worker is idempotent + fenced).

import { createPgMemoryStore } from "./operational-memory";
import { mapRunStatusToTerminal } from "./continuation-controller";
import type { PierreCognitiveTerminalState } from "./types";

type Db = { query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: T[] }> };
type Ctx = { company_id: string; user_id: string };

export type ContinuationResult = { found: boolean; resumed: boolean; terminalState: PierreCognitiveTerminalState };

/**
 * Resume a durable cognitive operation. `deps.runWorker` drives the real runtime worker (injected so the
 * caller supplies the tenant-bound worker call). Returns the reconciled terminal state, persisted.
 */
export async function continueCognitiveOperation(
  db: Db, ctx: Ctx, operationId: string, deps: { runWorker: () => Promise<unknown>; nowIso: string },
): Promise<ContinuationResult> {
  const store = createPgMemoryStore(db);
  const op = await store.get(ctx.company_id, operationId);
  if (!op) return { found: false, resumed: false, terminalState: "FAILED_RECOVERABLE" };

  let resumed = false;
  let terminal = op.terminalState;
  if (op.missionRunId) {
    // Reload current run status; if still live, drive the durable worker to advance it (real resumption).
    let statusRow = (await db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id = $1 and company_id = $2`, [op.missionRunId, ctx.company_id])).rows[0];
    const live = statusRow && ["queued", "running", "waiting", "paused"].includes(statusRow.status);
    if (live) {
      await deps.runWorker();
      resumed = true;
      statusRow = (await db.query<{ status: string }>(`select status from pierre_rt_mission_runs where id = $1 and company_id = $2`, [op.missionRunId, ctx.company_id])).rows[0];
    }
    if (statusRow) terminal = mapRunStatusToTerminal(String(statusRow.status));
  }

  // Persist the reconciled state (optimistic version bump; completed effects are not repeated).
  await store.save({ ...op, terminalState: terminal, updatedAtIso: deps.nowIso });
  return { found: true, resumed, terminalState: terminal };
}
