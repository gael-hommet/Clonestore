// src/lib/pierre/v1/runtime-compensations.ts
// PHASE 8.5-R4 §R4.13 — build an HONEST cancellation summary from a set of effects produced by a run.
// Each effect is classified against the compensation registry: a compensatable effect is cancelled
// (locally), an irreversible one is reported as such (NEVER pretended-undone), and a failed compensation
// is surfaced so the mission is NOT declared cleanly cancelled. A mission with a required-but-failed
// compensation must go to blocked/manual_review, not cancelled.

import { getCompensationRule, isCompensatable, isIrreversible } from "./runtime-compensation-registry";

export type RunEffect = { action_key: string; state: string; reference?: string | null; compensation_failed?: boolean };

export type CancellationSummary = {
  cancelled_local_effects: Array<{ action_key: string; reference: string | null }>;
  irreversible_external_effects: Array<{ action_key: string; reference: string | null; reason: string }>;
  compensation_failures: Array<{ action_key: string; reference: string | null }>;
  manual_actions_required: string[];
  clean: boolean; // true iff no irreversible effect and no compensation failure → a clean local cancel
};

export function buildCancellationSummary(effects: RunEffect[]): CancellationSummary {
  const summary: CancellationSummary = { cancelled_local_effects: [], irreversible_external_effects: [], compensation_failures: [], manual_actions_required: [], clean: true };
  for (const e of effects) {
    const ref = e.reference ?? null;
    const rule = getCompensationRule(e.action_key);
    if (e.compensation_failed) {
      summary.compensation_failures.push({ action_key: e.action_key, reference: ref });
      summary.manual_actions_required.push(`resolve failed compensation for ${e.action_key} (${ref ?? "n/a"})`);
      summary.clean = false;
      continue;
    }
    if (isIrreversible(e.action_key, e.state)) {
      summary.irreversible_external_effects.push({ action_key: e.action_key, reference: ref, reason: rule?.safeSummary ?? "irreversible external effect" });
      summary.manual_actions_required.push(`acknowledge irreversible ${e.action_key} (${e.state})`);
      summary.clean = false;
      continue;
    }
    if (isCompensatable(e.action_key, e.state)) {
      summary.cancelled_local_effects.push({ action_key: e.action_key, reference: ref });
    }
  }
  return summary;
}
