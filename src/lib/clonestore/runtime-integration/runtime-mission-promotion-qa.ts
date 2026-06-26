// src/lib/clonestore/runtime-integration/runtime-mission-promotion-qa.ts
// PHASE 4.8 — Runtime Mission Promotion Contract — QA
//
// Module PUR. Checklist QA du contrat de promotion design-only.
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.
// Aucune exécution. Aucune mission réelle. CloneGuard/CloneTrace obligatoires.

export type RuntimeMissionPromotionQaStepId =
  | "promotion_types_module_exists"
  | "promotion_contract_module_exists"
  | "controlled_mission_no_execution_flags"
  | "promotion_applied_false"
  | "requires_human_validation_true"
  | "cloneguard_required_in_contract"
  | "clonetrace_required_in_contract"
  | "idempotency_preserved"
  | "gates_cover_eligibility"
  | "decision_no_promotion_applied"
  | "blocked_draft_not_promotable"
  | "unsupported_domain_not_promotable"
  | "no_db_write"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_ai_call"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeMissionPromotionQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type RuntimeMissionPromotionQaStepSeverity =
  | "blocking" | "warning" | "info";

export type RuntimeMissionPromotionQaStep = {
  id: RuntimeMissionPromotionQaStepId;
  label: string;
  description: string;
  severity: RuntimeMissionPromotionQaStepSeverity;
  status: RuntimeMissionPromotionQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type RuntimeMissionPromotionQaChecklist = {
  steps: RuntimeMissionPromotionQaStep[];
  total: number;
  blocking_count: number;
  phase: "4.8";
  generated_at: string;
};

export type RuntimeMissionPromotionQaVerdict =
  | "ready"
  | "blocked"
  | "passed"
  | "needs_review"
  | "pending";

export type RuntimeMissionPromotionQaSummary = {
  verdict: RuntimeMissionPromotionQaVerdict;
  blocking_steps: RuntimeMissionPromotionQaStepId[];
  passed_steps: RuntimeMissionPromotionQaStepId[];
  pending_steps: RuntimeMissionPromotionQaStepId[];
  message: string;
  design_only: true;
};

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionQaChecklist(): RuntimeMissionPromotionQaChecklist {
  const steps: RuntimeMissionPromotionQaStep[] = [
    {
      id: "promotion_types_module_exists",
      label: "Module de types présent",
      description: "runtime-mission-promotion-types.ts existe.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le fichier.",
      expected_result: "ControlledMission + RuntimeMissionPromotionContract définis.",
    },
    {
      id: "promotion_contract_module_exists",
      label: "Module contrat présent",
      description: "runtime-mission-promotion-contract.ts existe.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le fichier.",
      expected_result: "buildRuntimeMissionPromotionContract exporté.",
    },
    {
      id: "controlled_mission_no_execution_flags",
      label: "Mission contrôlée sans flag d'exécution",
      description: "execution_enabled / mission_executed / autonomous_execution false.",
      severity: "blocking", status: "pending",
      how_to_verify: "Inspecter les safety flags de la mission contrôlée.",
      expected_result: "Tous les flags d'exécution false.",
    },
    {
      id: "promotion_applied_false",
      label: "promotion_applied false",
      description: "Le contrat ne promeut rien réellement.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier safety_flags.promotion_applied et decision.promotion_applied.",
      expected_result: "promotion_applied false partout.",
    },
    {
      id: "requires_human_validation_true",
      label: "Validation humaine requise",
      description: "requires_human_validation true.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier safety_flags.requires_human_validation.",
      expected_result: "requires_human_validation true.",
    },
    {
      id: "cloneguard_required_in_contract",
      label: "CloneGuard obligatoire",
      description: "La mission contrôlée conserve CloneGuard.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier guard_snapshot.cloneguard_required.",
      expected_result: "CloneGuard requis true.",
    },
    {
      id: "clonetrace_required_in_contract",
      label: "CloneTrace obligatoire",
      description: "La mission contrôlée conserve CloneTrace.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier trace_snapshot.clonetrace_required.",
      expected_result: "CloneTrace requis true.",
    },
    {
      id: "idempotency_preserved",
      label: "Idempotency préservée",
      description: "La clé d'idempotency est conservée.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier idempotency.required.",
      expected_result: "Idempotency requise true.",
    },
    {
      id: "gates_cover_eligibility",
      label: "Gates couvrent l'éligibilité",
      description: "Les gates couvrent draft valide / non bloqué / employé / guard / trace / idempotency.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier buildRuntimeMissionPromotionGates.",
      expected_result: "Gates d'éligibilité complets.",
    },
    {
      id: "decision_no_promotion_applied",
      label: "Décision sans promotion appliquée",
      description: "La décision n'applique jamais la promotion.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier decision.promotion_applied.",
      expected_result: "decision.promotion_applied false.",
    },
    {
      id: "blocked_draft_not_promotable",
      label: "Brouillon bloqué non promouvable",
      description: "Un brouillon bloqué par CloneGuard ne produit pas de mission contrôlée.",
      severity: "blocking", status: "pending",
      how_to_verify: "Promouvoir un brouillon bloqué.",
      expected_result: "verdict blocked · controlled_mission null.",
    },
    {
      id: "unsupported_domain_not_promotable",
      label: "Domaine non supporté non promouvable",
      description: "Un brouillon sans employé IA n'est pas promouvable.",
      severity: "warning", status: "pending",
      how_to_verify: "Promouvoir un brouillon de domaine non supporté.",
      expected_result: "verdict not_eligible · controlled_mission null.",
    },
    {
      id: "no_db_write",
      label: "Aucun write DB",
      description: "Le contrat n'écrit rien en base.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence de write.",
      expected_result: "Aucun write DB.",
    },
    {
      id: "no_supabase_import",
      label: "Aucun import base de données",
      description: "Les modules de promotion n'importent pas de base de données.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les imports.",
      expected_result: "Aucun import base de données.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Aucun import moteur Pierre",
      description: "Aucun import du dossier moteur Pierre.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les imports.",
      expected_result: "Aucun import moteur Pierre.",
    },
    {
      id: "no_ai_call",
      label: "Aucun appel IA",
      description: "ai_call_performed false.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les safety flags.",
      expected_result: "Aucun appel IA.",
    },
    {
      id: "no_cloneos_execution",
      label: "Aucune exécution CloneOS",
      description: "Aucune exécution déclenchée.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence d'exécution.",
      expected_result: "Aucune exécution CloneOS.",
    },
    {
      id: "no_clonevoice_activation",
      label: "Aucune activation CloneVoice",
      description: "CloneVoice non actif.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier clonevoice_active.",
      expected_result: "CloneVoice non actif.",
    },
    {
      id: "scale_80k_not_proven_visible",
      label: "Scale 80k non prouvé visible",
      description: "scale_80k_not_proven true.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier les snapshots scale.",
      expected_result: "Scale 80k non prouvé.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "P4.8 ne valide pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier la doc et les flags.",
      expected_result: "Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    phase: "4.8",
    generated_at: new Date().toISOString(),
  };
}

export function buildRuntimeMissionPromotionQaVerdict(
  steps: RuntimeMissionPromotionQaStep[]
): RuntimeMissionPromotionQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionPromotionQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: RuntimeMissionPromotionQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    design_only: true,
  };
  summary.message = summarizeRuntimeMissionPromotionQaVerdict(summary);
  return summary;
}

export function getRuntimeMissionPromotionBlockingSteps(): RuntimeMissionPromotionQaStep[] {
  return buildRuntimeMissionPromotionQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeMissionPromotionQaVerdict(
  summary: RuntimeMissionPromotionQaSummary
): string {
  const lines = [
    `[QA PHASE 4.8 Runtime Mission Promotion Contract] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Design-only — aucune mission réelle, aucune exécution, promotion_applied false.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Contrat de promotion validé (design).");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification.");
  lines.push("  Validation humaine requise · CloneGuard/CloneTrace obligatoires · Scale 80k non prouvé · Lancement public externe non validé.");
  return lines.join("\n");
}
