// src/lib/clonestore/runtime-integration/runtime-mission-draft-restore-ui-qa.ts
// PHASE 4.7 — Runtime Mission Draft Server Restore UI Polish — QA
//
// Module PUR. Checklist QA de l'amélioration UI restore/statut (observability).
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.
// Aucune exécution. Aucune mission réelle. Serveur feature-flaggé · activation P4.6.

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftRestoreUiQaStepId =
  | "restore_ui_model_exists"
  | "restore_ui_statuses_cover_local_and_server"
  | "restore_ui_sources_cover_local_server_fallback"
  | "restore_ui_badges_include_no_execution"
  | "restore_ui_badges_include_no_real_mission"
  | "restore_ui_badges_include_no_pierre_call"
  | "restore_ui_badges_include_no_ai_call"
  | "restore_ui_mentions_server_feature_flagged"
  | "restore_ui_mentions_manual_activation_p46"
  | "profile_messages_restore_panel_visible"
  | "profile_messages_local_server_status_visible"
  | "profile_messages_restore_button_visible"
  | "profile_messages_no_auto_restore_on_mount"
  | "no_db_write_added"
  | "no_api_post_added"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeMissionDraftRestoreUiQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type RuntimeMissionDraftRestoreUiQaStepSeverity =
  | "blocking" | "warning" | "info";

export type RuntimeMissionDraftRestoreUiQaStep = {
  id: RuntimeMissionDraftRestoreUiQaStepId;
  label: string;
  description: string;
  severity: RuntimeMissionDraftRestoreUiQaStepSeverity;
  status: RuntimeMissionDraftRestoreUiQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type RuntimeMissionDraftRestoreUiQaChecklist = {
  steps: RuntimeMissionDraftRestoreUiQaStep[];
  total: number;
  blocking_count: number;
  phase: "4.7";
  generated_at: string;
};

export type RuntimeMissionDraftRestoreUiQaVerdict =
  | "ready"
  | "blocked"
  | "passed"
  | "needs_review"
  | "pending";

export type RuntimeMissionDraftRestoreUiQaSummary = {
  verdict: RuntimeMissionDraftRestoreUiQaVerdict;
  blocking_steps: RuntimeMissionDraftRestoreUiQaStepId[];
  passed_steps: RuntimeMissionDraftRestoreUiQaStepId[];
  pending_steps: RuntimeMissionDraftRestoreUiQaStepId[];
  message: string;
  ui_polish_only: true;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftRestoreUiQaChecklist(): RuntimeMissionDraftRestoreUiQaChecklist {
  const steps: RuntimeMissionDraftRestoreUiQaStep[] = [
    {
      id: "restore_ui_model_exists",
      label: "Modèle UI restore présent",
      description: "runtime-mission-draft-restore-ui.ts existe et exporte snapshot/badges/cards/timeline/warnings.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le module et ses exports.",
      expected_result: "buildRuntimeMissionDraftRestoreUiSnapshot et helpers exportés.",
    },
    {
      id: "restore_ui_statuses_cover_local_and_server",
      label: "Statuses local + serveur couverts",
      description: "local_only/local_saved/local_restored + server_disabled/server_synced/server_restored/server_failed.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire l'union RuntimeMissionDraftRestoreUiStatus.",
      expected_result: "Statuses local et serveur présents.",
    },
    {
      id: "restore_ui_sources_cover_local_server_fallback",
      label: "Sources local/serveur/fallback couvertes",
      description: "localstorage/server/fallback_local/server_disabled/manual_activation_required.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire l'union RuntimeMissionDraftRestoreUiSource.",
      expected_result: "Sources locales, serveur et fallback présentes.",
    },
    {
      id: "restore_ui_badges_include_no_execution",
      label: "Badge No-execution",
      description: "Les badges incluent No-execution.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier buildRuntimeMissionDraftRestoreUiBadges.",
      expected_result: "Badge No-execution présent.",
    },
    {
      id: "restore_ui_badges_include_no_real_mission",
      label: "Badge Aucune mission réelle",
      description: "Les badges incluent Aucune mission réelle.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier buildRuntimeMissionDraftRestoreUiBadges.",
      expected_result: "Badge Aucune mission réelle présent.",
    },
    {
      id: "restore_ui_badges_include_no_pierre_call",
      label: "Badge Aucun appel Pierre",
      description: "Les badges incluent Aucun appel Pierre.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier buildRuntimeMissionDraftRestoreUiBadges.",
      expected_result: "Badge Aucun appel Pierre présent.",
    },
    {
      id: "restore_ui_badges_include_no_ai_call",
      label: "Badge Aucun appel IA",
      description: "Les badges incluent Aucun appel IA.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier buildRuntimeMissionDraftRestoreUiBadges.",
      expected_result: "Badge Aucun appel IA présent.",
    },
    {
      id: "restore_ui_mentions_server_feature_flagged",
      label: "Serveur feature-flaggé mentionné",
      description: "Le modèle mentionne que le serveur reste feature-flaggé.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier les badges/cards.",
      expected_result: "Mention Serveur feature-flaggé présente.",
    },
    {
      id: "restore_ui_mentions_manual_activation_p46",
      label: "Activation manuelle P4.6 mentionnée",
      description: "Le modèle rappelle l'activation manuelle P4.6 quand flag false.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier les warnings/cards.",
      expected_result: "Mention activation manuelle P4.6 présente.",
    },
    {
      id: "profile_messages_restore_panel_visible",
      label: "Panneau Statut brouillon runtime visible",
      description: "/profile/messages affiche un panneau Statut brouillon runtime.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages.",
      expected_result: "Panneau Statut brouillon runtime affiché.",
    },
    {
      id: "profile_messages_local_server_status_visible",
      label: "Statut local/serveur visible",
      description: "Source effective, statut local et statut serveur sont affichés.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le panneau statut.",
      expected_result: "Source effective + statut local + statut serveur visibles.",
    },
    {
      id: "profile_messages_restore_button_visible",
      label: "Bouton restore visible",
      description: "Le bouton Restaurer le dernier brouillon local reste présent.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les boutons.",
      expected_result: "Bouton de restauration visible.",
    },
    {
      id: "profile_messages_no_auto_restore_on_mount",
      label: "Aucun restore auto au mount",
      description: "Aucun restore ni save automatique au montage de la page.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier qu'aucun useEffect ne déclenche persist/restore au mount.",
      expected_result: "Restore/save au clic uniquement.",
    },
    {
      id: "no_db_write_added",
      label: "Aucun write DB ajouté",
      description: "P4.7 n'ajoute aucun write base de données.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence de nouveau write.",
      expected_result: "Aucun write ajouté.",
    },
    {
      id: "no_api_post_added",
      label: "Aucun POST ajouté",
      description: "P4.7 n'ajoute aucun POST réseau.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence de nouvel appel POST dans la page/le module.",
      expected_result: "Aucun POST ajouté.",
    },
    {
      id: "no_supabase_import",
      label: "Aucun import Supabase",
      description: "Le modèle restore UI n'importe pas de base de données.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les imports du module.",
      expected_result: "Aucun import base de données.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Aucun import moteur Pierre",
      description: "Aucun import src/lib/pierre dans le module restore UI.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier les imports.",
      expected_result: "Aucun import moteur Pierre.",
    },
    {
      id: "no_cloneos_execution",
      label: "Aucune exécution CloneOS",
      description: "Aucune exécution déclenchée par le polish UI.",
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
      description: "P4.7 ne valide pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier la doc et les badges.",
      expected_result: "Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    phase: "4.7",
    generated_at: new Date().toISOString(),
  };
}

export function buildRuntimeMissionDraftRestoreUiQaVerdict(
  steps: RuntimeMissionDraftRestoreUiQaStep[]
): RuntimeMissionDraftRestoreUiQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionDraftRestoreUiQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready";
  else verdict = "needs_review";

  const summary: RuntimeMissionDraftRestoreUiQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    ui_polish_only: true,
  };
  summary.message = summarizeRuntimeMissionDraftRestoreUiQaVerdict(summary);
  return summary;
}

export function getRuntimeMissionDraftRestoreUiBlockingSteps(): RuntimeMissionDraftRestoreUiQaStep[] {
  return buildRuntimeMissionDraftRestoreUiQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeMissionDraftRestoreUiQaVerdict(
  summary: RuntimeMissionDraftRestoreUiQaSummary
): string {
  const lines = [
    `[QA PHASE 4.7 Runtime Mission Draft Restore UI Polish] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  UI/observability polish uniquement — aucune nouvelle persistance, aucune exécution.`,
  ];
  if (summary.verdict === "passed") lines.push("  → Restore UI Polish validée.");
  else if (summary.verdict === "ready") lines.push("  → Prêt pour vérification manuelle UI.");
  lines.push("  Serveur feature-flaggé · activation manuelle P4.6 · Scale 80k non prouvé · Lancement public externe non validé.");
  return lines.join("\n");
}
