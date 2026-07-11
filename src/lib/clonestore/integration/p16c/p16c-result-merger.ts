// src/lib/clonestore/integration/p16c/p16c-result-merger.ts
// P16C — FUSION des résultats typés en STATUT AUTORITAIRE. RÈGLE DURE : une mission n'est « complétée »
// QUE si chaque tâche requise a une PREUVE de complétion autoritaire — or P16C n'exécute RIEN (l'exécution
// autoritaire reste derrière la route de confirmation + V1). Donc `authoritativeCompletion` est TOUJOURS
// false et le statut mission ne vaut JAMAIS « completed ». « préparé » ≠ « envoyé/signé/fait ». Les
// conflits (résultat en erreur / contradiction) échouent fail-closed. Module PUR.

import type {
  P16CGovernanceDecision, P16CT1Step, P16CT2Step, P16CMergedResult,
  P16COperationResult, P16COperationStatus, P16CMissionStatus,
} from "./p16c-types";

const DRAFT_T1: ReadonlySet<string> = new Set(["mail", "document"]); // « brouillon » explicite

function t1Status(step: P16CT1Step): P16COperationStatus {
  if (step.resultKind === "error") return "failed_operation";
  if (!step.permissionAllowed) return "failed_operation";
  if (step.resultKind === "blocked") return step.liveBlocked ? "provider_blocked_operation" : "failed_operation";
  if (step.liveBlocked && !step.artifactPrepared) return "provider_blocked_operation";
  return DRAFT_T1.has(step.techId) ? "generated_draft" : "prepared_artifact";
}

function t2Status(step: P16CT2Step): P16COperationStatus {
  if (step.resultKind === "error") return "failed_operation";
  if (step.resultKind === "blocked") return "failed_operation";
  return "prepared_artifact";
}

export interface P16CMergeInput {
  readonly governance: P16CGovernanceDecision;
  readonly t1Steps: readonly P16CT1Step[];
  readonly t2Steps: readonly P16CT2Step[];
  readonly cloneOsPlanPresent: boolean;
  readonly cloneOsBlockedByGovernance: boolean;
  readonly humanOnlyReasons: readonly string[];
}

/** Fusionne les résultats typés → statut mission autoritaire (jamais de complétion fabriquée). Pur. */
export function mergeResults(input: P16CMergeInput): P16CMergedResult {
  const operations: P16COperationResult[] = [];
  const conflicts: string[] = [];
  const evidenceRefs: string[] = [];

  // Décision human-only : une opération à part entière (jamais exécutée par la machine).
  const effective = input.governance.effectiveState;
  if (effective === "HUMAN_ONLY") {
    operations.push({
      ref: "governance.human_only", layer: "cloneos", status: "human_only_decision",
      detail: `Décision réservée à l'humain: ${input.humanOnlyReasons.join(", ") || "sensible"}.`,
      hasAuthoritativeCompletionEvidence: false,
    });
  }

  for (const s of input.t1Steps) {
    const status = t1Status(s);
    if (status === "failed_operation" && s.resultKind === "error") {
      conflicts.push(`T1 ${s.techId}: résultat en erreur — fail-closed.`);
    }
    operations.push({
      ref: `t1.${s.techId}`, layer: "t1", status,
      detail: `${s.reason} — kind=${s.resultKind}, mode=${s.mode}${s.liveBlocked ? " (live bloqué)" : ""}.`,
      hasAuthoritativeCompletionEvidence: false,
    });
    if (s.artifactPrepared) evidenceRefs.push(`t1.${s.techId}.artifact`);
  }

  for (const s of input.t2Steps) {
    const status = t2Status(s);
    if (status === "failed_operation" && s.resultKind === "error") {
      conflicts.push(`T2 ${s.techId}: résultat en erreur — fail-closed.`);
    }
    operations.push({
      ref: `t2.${s.techId}`, layer: "t2", status,
      detail: `${s.reason} — kind=${s.resultKind}${s.liveBlockedReason ? " (live bloqué)" : ""}.`,
      hasAuthoritativeCompletionEvidence: false,
    });
    if (s.artifactKind) evidenceRefs.push(`t2.${s.techId}.${s.artifactKind}`);
  }

  if (input.cloneOsPlanPresent) {
    operations.push({
      ref: "cloneos.mission_plan", layer: "cloneos", status: "proposed_action",
      detail: "Plan de mission CloneOS proposé (gouverné, non exécuté).",
      hasAuthoritativeCompletionEvidence: false,
    });
    evidenceRefs.push("cloneos.mission_plan");
  }

  // ── Statut mission autoritaire (jamais « completed »). ──
  const anyPrepared = operations.some((o) => o.status === "prepared_artifact" || o.status === "generated_draft" || o.status === "proposed_action");
  const anyProviderBlocked = operations.some((o) => o.status === "provider_blocked_operation");

  let missionStatus: P16CMissionStatus;
  if (conflicts.length > 0) {
    missionStatus = "conflict_failed";
  } else if (effective === "UNSUPPORTED") {
    missionStatus = "unsupported";
  } else if (effective === "HUMAN_ONLY" || effective === "PERMISSION_BLOCKED" || effective === "LEGAL_BLOCKED") {
    missionStatus = "human_only";
  } else if (anyProviderBlocked && anyPrepared) {
    missionStatus = "partial";
  } else if (effective === "PROVIDER_BLOCKED") {
    missionStatus = "provider_blocked";
  } else if (effective === "VALIDATION_REQUIRED" || effective === "PROPOSE") {
    missionStatus = "proposed";
  } else {
    missionStatus = "prepared";
  }

  const summary =
    missionStatus === "conflict_failed" ? "Conflit de résultats — fail-closed, aucune complétion revendiquée."
    : missionStatus === "unsupported" ? "Demande non supportée — aucune capacité RH correspondante."
    : missionStatus === "human_only" ? "Décision/complétion réservée à l'humain — Pierre a préparé le nécessaire."
    : missionStatus === "provider_blocked" ? "Action live requise mais bloquée — préparé localement, provider indisponible."
    : missionStatus === "partial" ? "Partiel : certains éléments préparés localement, d'autres bloqués (provider live)."
    : missionStatus === "proposed" ? "Proposition gouvernée prête — validation humaine requise avant tout effet."
    : "Préparé localement — rien n'a été envoyé/signé/exécuté (aucune complétion autoritaire).";

  return {
    missionStatus,
    operations,
    authoritativeCompletion: false,
    conflicts,
    evidenceRefs,
    summary,
  };
}
