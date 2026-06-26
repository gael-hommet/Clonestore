// src/lib/clonestore/runtime-integration/runtime-mission-promotion-preview-ui-qa.ts
// PHASE 4.9 — Runtime Controlled Mission Preview UI / Read-Only Promotion Panel — QA
//
// Module PUR. Checklist QA du panneau d'aperçu de promotion (read-only) dans
// /profile/messages. Pas de base de données. Pas de réseau. Pas de write.
// Pas d'import Pierre. Aucune exécution. Aucune promotion appliquée.

export type RuntimeMissionPromotionPreviewUiQaStepId =
  | "promotion_preview_panel_visible"
  | "promotion_preview_uses_contract"
  | "promotion_preview_uses_snapshot"
  | "promotion_preview_shows_verdict"
  | "promotion_preview_shows_gates"
  | "promotion_preview_shows_controlled_mission"
  | "promotion_preview_badges_no_execution"
  | "promotion_preview_badges_no_real_mission"
  | "promotion_preview_mentions_human_validation"
  | "promotion_preview_mentions_promotion_not_applied"
  | "promotion_preview_no_auto_run_on_mount"
  | "promotion_preview_click_only"
  | "no_db_write_added"
  | "no_api_post_added"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeMissionPromotionPreviewUiQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type RuntimeMissionPromotionPreviewUiQaStepSeverity =
  | "blocking" | "warning" | "info";

export type RuntimeMissionPromotionPreviewUiQaStep = {
  id: RuntimeMissionPromotionPreviewUiQaStepId;
  label: string;
  description: string;
  severity: RuntimeMissionPromotionPreviewUiQaStepSeverity;
  status: RuntimeMissionPromotionPreviewUiQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type RuntimeMissionPromotionPreviewUiQaChecklist = {
  steps: RuntimeMissionPromotionPreviewUiQaStep[];
  total: number;
  blocking_count: number;
  phase: "4.9";
  generated_at: string;
};

export type RuntimeMissionPromotionPreviewUiQaVerdict =
  | "ready"
  | "blocked"
  | "passed"
  | "needs_review"
  | "pending";

export type RuntimeMissionPromotionPreviewUiQaSummary = {
  verdict: RuntimeMissionPromotionPreviewUiQaVerdict;
  blocking_steps: RuntimeMissionPromotionPreviewUiQaStepId[];
  passed_steps: RuntimeMissionPromotionPreviewUiQaStepId[];
  pending_steps: RuntimeMissionPromotionPreviewUiQaStepId[];
  message: string;
  ui_preview_only: true;
};

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildRuntimeMissionPromotionPreviewUiQaChecklist(): RuntimeMissionPromotionPreviewUiQaChecklist {
  const steps: RuntimeMissionPromotionPreviewUiQaStep[] = [
    {
      id: "promotion_preview_panel_visible",
      label: "Panneau d'aperçu visible",
      description: "/profile/messages affiche un panneau d'aperçu de promotion en mission contrôlée.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages, préparer un brouillon, prévisualiser la promotion.",
      expected_result: "Panneau d'aperçu de promotion affiché.",
    },
    {
      id: "promotion_preview_uses_contract",
      label: "Aperçu via le contrat P4.8",
      description: "L'aperçu utilise buildRuntimeMissionPromotionContract.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'appel du contrat de promotion.",
      expected_result: "Contrat de promotion construit au clic.",
    },
    {
      id: "promotion_preview_uses_snapshot",
      label: "Aperçu via le snapshot P4.8",
      description: "L'aperçu utilise buildRuntimeMissionPromotionSnapshot.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'usage du snapshot.",
      expected_result: "Snapshot preview utilisé.",
    },
    {
      id: "promotion_preview_shows_verdict",
      label: "Verdict affiché",
      description: "Le verdict d'éligibilité est affiché.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier l'affichage du verdict.",
      expected_result: "Verdict eligible/requires_human_validation/not_eligible/blocked visible.",
    },
    {
      id: "promotion_preview_shows_gates",
      label: "Gates affichés",
      description: "Les gates d'éligibilité sont affichés.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier l'affichage des gates/sections.",
      expected_result: "Gates d'éligibilité visibles.",
    },
    {
      id: "promotion_preview_shows_controlled_mission",
      label: "Mission contrôlée affichée",
      description: "Si éligible, la mission contrôlée (contrat) est affichée.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier l'affichage de la mission contrôlée.",
      expected_result: "Mission contrôlée (statut/validation) visible quand éligible.",
    },
    {
      id: "promotion_preview_badges_no_execution",
      label: "Badge No-execution",
      description: "Les badges incluent No-execution.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les badges du snapshot.",
      expected_result: "Badge No-execution présent.",
    },
    {
      id: "promotion_preview_badges_no_real_mission",
      label: "Badge Aucune mission réelle",
      description: "Les badges incluent Aucune mission réelle.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les badges du snapshot.",
      expected_result: "Badge Aucune mission réelle présent.",
    },
    {
      id: "promotion_preview_mentions_human_validation",
      label: "Validation humaine mentionnée",
      description: "Le panneau mentionne la validation humaine requise.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier la microcopy.",
      expected_result: "Mention validation humaine requise présente.",
    },
    {
      id: "promotion_preview_mentions_promotion_not_applied",
      label: "Promotion non appliquée mentionnée",
      description: "Le panneau précise que la promotion n'est pas appliquée.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier la microcopy.",
      expected_result: "Mention promotion non appliquée présente.",
    },
    {
      id: "promotion_preview_no_auto_run_on_mount",
      label: "Aucun aperçu auto au mount",
      description: "Aucun aperçu de promotion déclenché au montage de la page.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier qu'aucun useEffect ne déclenche l'aperçu au mount.",
      expected_result: "Aperçu au clic uniquement.",
    },
    {
      id: "promotion_preview_click_only",
      label: "Aperçu au clic uniquement",
      description: "L'aperçu n'est construit qu'au clic du bouton.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le handler au clic.",
      expected_result: "Aperçu déclenché au clic.",
    },
    {
      id: "no_db_write_added",
      label: "Aucun write DB ajouté",
      description: "P4.9 n'ajoute aucun write base de données.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence de write.",
      expected_result: "Aucun write ajouté.",
    },
    {
      id: "no_api_post_added",
      label: "Aucun POST ajouté",
      description: "P4.9 n'ajoute aucun POST réseau.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence de nouvel appel POST.",
      expected_result: "Aucun POST ajouté.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Aucun import moteur Pierre",
      description: "Aucun import du dossier moteur Pierre.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les imports de la page.",
      expected_result: "Aucun import moteur Pierre.",
    },
    {
      id: "no_cloneos_execution",
      label: "Aucune exécution CloneOS",
      description: "Aucune exécution déclenchée par l'aperçu.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence d'exécution.",
      expected_result: "Aucune exécution CloneOS.",
    },
    {
      id: "no_clonevoice_activation",
      label: "Aucune activation CloneVoice",
      description: "CloneVoice non actif.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence d'activation CloneVoice.",
      expected_result: "CloneVoice non actif.",
    },
    {
      id: "scale_80k_not_proven_visible",
      label: "Scale 80k non prouvé visible",
      description: "Le badge Scale 80k non prouvé est affiché.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier les badges.",
      expected_result: "Scale 80k non prouvé visible.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "P4.9 ne valide pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier la doc et les badges.",
      expected_result: "Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    phase: "4.9",
    generated_at: new Date().toISOString(),
  };
}

export function buildRuntimeMissionPromotionPreviewUiQaVerdict(
  steps: RuntimeMissionPromotionPreviewUiQaStep[]
): RuntimeMissionPromotionPreviewUiQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionPromotionPreviewUiQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: RuntimeMissionPromotionPreviewUiQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    ui_preview_only: true,
  };
  summary.message = summarizeRuntimeMissionPromotionPreviewUiQaVerdict(summary);
  return summary;
}

export function getRuntimeMissionPromotionPreviewUiBlockingSteps(): RuntimeMissionPromotionPreviewUiQaStep[] {
  return buildRuntimeMissionPromotionPreviewUiQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeMissionPromotionPreviewUiQaVerdict(
  summary: RuntimeMissionPromotionPreviewUiQaSummary
): string {
  const lines = [
    `[QA PHASE 4.9 Runtime Controlled Mission Preview UI] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Aperçu read-only uniquement — promotion non appliquée, aucune mission réelle, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Preview UI validée.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification manuelle UI.");
  lines.push("  Validation humaine requise · CloneGuard/CloneTrace obligatoires · Scale 80k non prouvé · Lancement public externe non validé.");
  return lines.join("\n");
}
