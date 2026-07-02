// src/lib/pierre/v1/hr-mission-packs/completion-evidence.ts
// PHASE 8.11 — what proves a mission pack DONE. Each pack declares completion criteria; this layer
// evaluates a case's collected evidence against them. Pure + deterministic — the runtime records the
// evidence, this decides whether the case may close. A pack cannot close with a criterion unmet.

import type { HrMissionPackDefinition, HrMissionCompletionCriterion } from "./types";

// Evidence a running case accumulates (from the verified runtime: artifacts, mutations, comms, etc.).
export type CaseEvidence = {
  artifacts: string[];         // artifact kinds produced
  mutations: string[];         // employee mutation targets applied
  communications: string[];    // communications sent (delivery ids / template families)
  approvals: string[];         // approval decisions recorded
  humanDecisions: string[];    // legally-reserved decisions recorded
  externalReconciliations: string[]; // provider reconciliations completed
  state: string;               // terminal state reached
};

export function emptyEvidence(): CaseEvidence {
  return { artifacts: [], mutations: [], communications: [], approvals: [], humanDecisions: [], externalReconciliations: [], state: "" };
}

function criterionMet(c: HrMissionCompletionCriterion, e: CaseEvidence): boolean {
  switch (c.check) {
    case "artifact": return e.artifacts.length > 0;
    case "mutation": return e.mutations.length > 0;
    case "communication": return e.communications.length > 0;
    case "approval": return e.approvals.length > 0;
    case "human_recorded": return e.humanDecisions.length > 0;
    case "external_reconciled": return e.externalReconciliations.length > 0;
    case "state": return e.state === "completed";
  }
}

export type CompletionResult = { ok: boolean; met: string[]; unmet: string[] };
export function evaluateCompletion(pack: HrMissionPackDefinition, e: CaseEvidence): CompletionResult {
  const met: string[] = []; const unmet: string[] = [];
  for (const c of pack.completionCriteria) (criterionMet(c, e) ? met : unmet).push(c.id);
  return { ok: unmet.length === 0, met, unmet };
}

/** The evidence a pack REQUIRES to close (for docs / expectations). */
export function requiredEvidenceKinds(pack: HrMissionPackDefinition): string[] {
  return [...new Set(pack.completionCriteria.map((c) => c.check))];
}
