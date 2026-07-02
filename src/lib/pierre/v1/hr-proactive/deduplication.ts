// src/lib/pierre/v1/hr-proactive/deduplication.ts
// PHASE 8.11 — signal deduplication: at most one live signal per (key, subject). Prevents a proactive
// detector run from creating duplicate follow-up missions. Pure.
import type { HrSignal } from "./signal-types";

/** Drop signals whose dedupKey is already live (in `existingDedupKeys`) or duplicated in the batch. */
export function deduplicate(signals: readonly HrSignal[], existingDedupKeys: readonly string[] = []): { fresh: HrSignal[]; suppressed: number } {
  const seen = new Set<string>(existingDedupKeys);
  const fresh: HrSignal[] = [];
  let suppressed = 0;
  for (const s of signals) {
    if (seen.has(s.dedupKey)) { suppressed++; continue; }
    seen.add(s.dedupKey); fresh.push(s);
  }
  return { fresh, suppressed };
}
