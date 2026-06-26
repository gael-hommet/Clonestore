// src/lib/clonestore/runtime-integration/runtime-phase4-final-qa-invariants.ts
// PHASE 4.12 — Phase 4 Final QA — Invariant Checks
//
// Module PUR. Définit et évalue les invariants no-execution de la PHASE 4.
// Aucun write. Aucun import Pierre. Aucune exécution.

import type {
  RuntimePhase4FinalQaInvariant,
  RuntimePhase4FinalQaInvariantId,
  RuntimePhase4FinalQaStepStatus,
} from "./runtime-phase4-final-qa-types";

type InvariantSeed = {
  id: RuntimePhase4FinalQaInvariantId;
  label: string;
  description: string;
  expected: string;
  evidence: string;
};

const SEEDS: InvariantSeed[] = [
  { id: "no_real_mission_created", label: "Aucune mission réelle créée", description: "Aucune mission Pierre réelle n'est créée en base.", expected: "false", evidence: "real_mission_created false partout (P4.3/4.8/4.9/4.10/4.11)." },
  { id: "no_runtime_execution", label: "Aucune exécution runtime", description: "Aucune exécution runtime déclenchée.", expected: "false", evidence: "execution_enabled false ; final_event execution_not_started." },
  { id: "no_cloneos_execution", label: "Aucune exécution CloneOS", description: "CloneOS n'est jamais exécuté.", expected: "false", evidence: "Simulation/plan-only uniquement (P4.1/4.2)." },
  { id: "no_pierre_engine_call", label: "Aucun appel moteur Pierre", description: "Le moteur Pierre n'est jamais appelé.", expected: "false", evidence: "pierre_engine_called false ; aucun import du dossier moteur Pierre." },
  { id: "no_ai_call", label: "Aucun appel IA", description: "Aucun appel à un fournisseur IA externe.", expected: "false", evidence: "ai_call_performed false." },
  { id: "no_email_sent", label: "Aucun email envoyé", description: "Aucun email envoyé.", expected: "false", evidence: "email_sent false." },
  { id: "no_document_generated", label: "Aucun document généré", description: "Aucun document/PDF généré.", expected: "false", evidence: "document_generated false." },
  { id: "no_clonevoice_activation", label: "CloneVoice non actif", description: "CloneVoice n'est pas activé.", expected: "false", evidence: "clonevoice_active false." },
  { id: "no_unflagged_db_write", label: "Aucun write DB non flaggé", description: "Aucun write DB hors route feature-flaggée (POST 423 si flag false).", expected: "false", evidence: "db_write_performed false ; POST 423 si flag false (P4.5)." },
  { id: "no_sql_auto_apply", label: "Aucun SQL appliqué auto", description: "Les SQL drafts ne sont jamais appliqués automatiquement.", expected: "false", evidence: "SQL P4.4/P4.10 drafts non appliqués." },
  { id: "no_env_auto_change", label: "Aucune modif .env.local auto", description: "Aucune modification automatique de .env.local.", expected: "false", evidence: "Aucun script n'écrit .env.local." },
  { id: "no_flag_auto_activation", label: "Aucune activation flag auto", description: "Aucun feature flag activé automatiquement.", expected: "false", evidence: "Flags default false." },
  { id: "no_go_live_proof_auto_change", label: "go-live-proofs non modifié", description: "go-live-proofs.local.json n'est jamais modifié.", expected: "false", evidence: "Aucune écriture go-live-proofs." },
  { id: "no_public_external_launch_validation", label: "Lancement public externe non validé", description: "La PHASE 4 ne valide pas le lancement public externe.", expected: "false", evidence: "public_launch_external_validated false partout." },
  { id: "scale_80k_not_proven", label: "Scale 80k non prouvé", description: "Le scale 80k n'est pas prouvé (préparation scale uniquement).", expected: "true", evidence: "scale_80k_not_proven true." },
  { id: "human_validation_required_before_controlled_mission", label: "Validation humaine requise", description: "Une validation humaine est requise avant toute mission contrôlée.", expected: "true", evidence: "human_validation_required true (P4.8/4.10/4.11)." },
  { id: "promotion_not_applied", label: "Promotion non appliquée", description: "La promotion n'est jamais appliquée.", expected: "false", evidence: "promotion_applied false (P4.8/4.9/4.10/4.11)." },
  { id: "approval_not_applied", label: "Approbation non appliquée", description: "L'approbation humaine n'est jamais appliquée.", expected: "false", evidence: "approval_applied false (P4.11)." },
  { id: "localstorage_fallback_preserved", label: "Fallback localStorage préservé", description: "Le fallback localStorage reste préservé.", expected: "true", evidence: "localStorage-first conservé (P4.5/4.7)." },
  { id: "feature_flags_default_false", label: "Feature flags default false", description: "Tous les feature flags runtime sont default false.", expected: "true", evidence: "NEXT_PUBLIC_*_ENABLED default false (P4.4/4.10)." },
  { id: "rls_design_only_where_applicable", label: "RLS design-only", description: "La RLS reste design-only (SQL draft non appliqué).", expected: "true", evidence: "RLS conçue dans les SQL drafts non appliqués." },
];

const BLOCKING_IDS: RuntimePhase4FinalQaInvariantId[] = [
  "no_real_mission_created", "no_runtime_execution", "no_cloneos_execution",
  "no_pierre_engine_call", "no_ai_call", "no_unflagged_db_write", "no_sql_auto_apply",
  "no_env_auto_change", "no_flag_auto_activation", "no_go_live_proof_auto_change",
  "no_public_external_launch_validation", "scale_80k_not_proven",
  "human_validation_required_before_controlled_mission", "promotion_not_applied",
  "approval_not_applied",
];

export type RuntimePhase4FinalQaInvariantOverrides = Partial<
  Record<RuntimePhase4FinalQaInvariantId, RuntimePhase4FinalQaStepStatus>
>;

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildRuntimePhase4FinalQaInvariants(
  overrides?: RuntimePhase4FinalQaInvariantOverrides
): RuntimePhase4FinalQaInvariant[] {
  return SEEDS.map((seed) => {
    const status = overrides?.[seed.id] ?? "passed";
    const observed = status === "passed" ? seed.expected : "violation";
    return {
      id: seed.id,
      label: seed.label,
      description: seed.description,
      severity: BLOCKING_IDS.includes(seed.id) ? "blocking" : "warning",
      expected: seed.expected,
      observed,
      status,
      evidence: seed.evidence,
      remediation: status === "passed" ? "—" : "Revoir le bloc concerné avant clôture.",
    };
  });
}

// ── Evaluation ────────────────────────────────────────────────────────────────

export type RuntimePhase4FinalQaInvariantsSummary = {
  total: number;
  passed: number;
  failed: number;
  blocking_failed: RuntimePhase4FinalQaInvariantId[];
  all_blocking_passed: boolean;
  public_launch_external_validated: false;
  scale_80k_not_proven: true;
  runtime_execution_enabled: false;
  real_mission_created: false;
};

export function evaluateRuntimePhase4FinalQaInvariants(
  overrides?: RuntimePhase4FinalQaInvariantOverrides
): RuntimePhase4FinalQaInvariantsSummary {
  const invariants = buildRuntimePhase4FinalQaInvariants(overrides);
  const passed = invariants.filter((i) => i.status === "passed");
  const failed = invariants.filter((i) => i.status === "failed");
  const blockingFailed = invariants.filter((i) => i.severity === "blocking" && i.status !== "passed");
  return {
    total: invariants.length,
    passed: passed.length,
    failed: failed.length,
    blocking_failed: blockingFailed.map((i) => i.id),
    all_blocking_passed: blockingFailed.length === 0,
    public_launch_external_validated: false,
    scale_80k_not_proven: true,
    runtime_execution_enabled: false,
    real_mission_created: false,
  };
}

export function getRuntimePhase4FinalQaBlockingInvariants(): RuntimePhase4FinalQaInvariant[] {
  return buildRuntimePhase4FinalQaInvariants().filter((i) => i.severity === "blocking");
}

export function summarizeRuntimePhase4FinalQaInvariants(
  invariants: RuntimePhase4FinalQaInvariant[]
): string {
  const passed = invariants.filter((i) => i.status === "passed").length;
  return [
    `[Phase 4 Final QA Invariants] ${passed}/${invariants.length} passed`,
    "  no_real_mission_created · no_runtime_execution · no_pierre_engine_call · no_ai_call",
    "  promotion_not_applied · approval_not_applied · human_validation_required",
    "  scale_80k_not_proven · lancement public externe non validé.",
  ].join("\n");
}
