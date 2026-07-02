// src/lib/pierre/v1/hr-proactive/detector.ts
// PHASE 8.11 — the proactive detector. Pure: given a snapshot of candidate items (already fetched by
// the verified runtime under tenant scope), it emits governed signals for known signal keys. It does
// NOT query the DB and never invents subjects.
import type { HrSignal } from "./signal-types";
import { getSignalDefinition } from "./signal-registry";

export type CandidateItem = { signalKey: string; companyId: string; subjectRef: string; detectedAt: string };

export function detect(items: readonly CandidateItem[]): HrSignal[] {
  const out: HrSignal[] = [];
  for (const it of items) {
    const def = getSignalDefinition(it.signalKey);
    if (!def) continue; // unknown signal keys are ignored (fail-closed: only registered signals fire)
    out.push({ key: def.key, companyId: it.companyId, subjectRef: it.subjectRef, detectedAt: it.detectedAt, severity: def.defaultSeverity, dedupKey: `${def.key}:${it.subjectRef}` });
  }
  return out;
}
