// src/lib/pierre/v1/cognitive-runtime/proactive-controller.ts
// PHASE 8.14 — turns raw detector candidates into governed proactive work. REUSES the existing
// hr-proactive primitives (deduplicate, signalToMissionRequest) and adds the missing PRIORITY GATE
// (owner §17): decide per signal → ignore / observe / task / mission / alert, ranked by severity + a
// bounded priority score. Pure + DI (detectors inject already-tenant-scoped candidates from real DB
// queries). No alert spam (dedup), no duplicate work (existing dedup keys), fail-closed (no pack → no
// mission via signalToMissionRequest).

import { deduplicate } from "../hr-proactive/deduplication";
import { signalToMissionRequest, type MissionCreationRequest } from "../hr-proactive/mission-creation";
import type { HrSignal, SignalSeverity } from "../hr-proactive/signal-types";

export type ProactiveDecision = "ignore" | "observe" | "task" | "mission" | "alert";

export type ProactiveOutcome = {
  readonly signal: HrSignal;
  readonly decision: ProactiveDecision;
  readonly priority: number;             // 1 (low) … 100 (urgent)
  readonly missionRequest: MissionCreationRequest | null;
  readonly reason: string;
};

const SEVERITY_WEIGHT: Record<SignalSeverity, number> = { info: 20, warning: 55, critical: 90 };

/** Priority gate for a single signal. Deterministic + bounded. */
export function decideProactive(signal: HrSignal): ProactiveOutcome {
  const priority = SEVERITY_WEIGHT[signal.severity] ?? 20;
  const missionRequest = signalToMissionRequest(signal); // null when no governed pack exists → fail-closed
  let decision: ProactiveDecision;
  if (signal.severity === "critical") decision = missionRequest ? "mission" : "alert";
  else if (signal.severity === "warning") decision = missionRequest ? "mission" : "task";
  else decision = "observe";
  return {
    signal, decision, priority, missionRequest,
    reason: missionRequest ? `governed pack ${missionRequest.packId}` : "no governed pack → observe/alert only",
  };
}

/**
 * Process a batch of freshly-detected signals: dedup against existing live keys, then decide + rank.
 * Returns outcomes highest-priority first. Detectors supply `existingDedupKeys` from the DB so we never
 * open duplicate proactive work.
 */
export function runProactiveBatch(
  detected: readonly HrSignal[],
  existingDedupKeys: readonly string[] = [],
): { outcomes: ProactiveOutcome[]; suppressed: number } {
  const { fresh, suppressed } = deduplicate(detected, existingDedupKeys);
  const outcomes = fresh
    .map(decideProactive)
    .sort((a, b) => b.priority - a.priority || a.signal.dedupKey.localeCompare(b.signal.dedupKey));
  return { outcomes, suppressed };
}
