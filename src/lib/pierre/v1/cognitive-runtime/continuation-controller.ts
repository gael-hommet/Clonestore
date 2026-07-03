// src/lib/pierre/v1/cognitive-runtime/continuation-controller.ts
// PHASE 8.14 — long-running continuation (owner §14). Maps the REAL persisted mission-run status into a
// cognitive terminal state, so Pierre can resume after page close / logout / restart / provider timeout
// (the durability lives in the existing pierre_rt_* tables + scheduler + fencing — NOT re-implemented
// here). Pure mapping over an injected status reader (DB in production); the resume action delegates to
// the existing worker loop.

import type { PierreCognitiveTerminalState } from "./types";

// The run-engine statuses (pierre_rt_mission_runs.status) mapped to cognitive terminal states.
export function mapRunStatusToTerminal(status: string, waitKind?: string | null): PierreCognitiveTerminalState {
  switch (status) {
    case "completed": return "COMPLETED";
    case "cancelled": return "CANCELLED";
    case "failed": return "FAILED_TERMINAL";
    case "blocked": return "BLOCKED_PERMISSION";
    case "waiting":
      switch (waitKind) {
        case "approval": return "AWAITING_APPROVAL";
        case "timer": return "AWAITING_DATE";
        case "external_event": return "AWAITING_PROVIDER";
        default: return "AWAITING_INFORMATION";
      }
    case "paused": return "AWAITING_CONFIRMATION";
    case "queued":
    case "running": return "FAILED_RECOVERABLE"; // still in flight; not terminal — caller keeps polling
    default: return "FAILED_RECOVERABLE";
  }
}

export type RunStatusReader = (missionRunId: string) => Promise<{ status: string; waitKind?: string | null } | null>;

/** Read the durable status of a cognitive operation. Fail-closed: unknown → recoverable, never "done". */
export async function readCognitiveStatus(missionRunId: string, read: RunStatusReader): Promise<{ terminal: PierreCognitiveTerminalState; live: boolean }> {
  const row = await read(missionRunId);
  if (!row) return { terminal: "FAILED_RECOVERABLE", live: false };
  const terminal = mapRunStatusToTerminal(row.status, row.waitKind);
  const live = row.status === "queued" || row.status === "running" || row.status === "waiting" || row.status === "paused";
  return { terminal, live };
}
