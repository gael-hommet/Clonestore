// src/lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui-qa.ts
// PHASE 3.18 — Enterprise Footprint Server Restore UI Polish — QA Module
//
// Module pur — checklist QA pour l'observabilité UI restore/sync de l'Empreinte.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintRestoreUiQaStepId =
  | "restore_ui_model_exists"
  | "status_labels_cover_all_outcomes"
  | "source_labels_cover_local_and_server"
  | "ui_snapshot_builds"
  | "ui_badges_build"
  | "ui_cards_build"
  | "ui_timeline_build"
  | "profile_onboarding_restore_panel_visible"
  | "localstorage_fallback_visible"
  | "server_disabled_visible"
  | "server_synced_visible"
  | "table_unavailable_visible"
  | "rls_failed_visible"
  | "no_db_write_added"
  | "no_api_post_added"
  | "no_pierre_engine_import"
  | "public_launch_external_not_validated";

export type EnterpriseFootprintRestoreUiQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type EnterpriseFootprintRestoreUiQaStepSeverity =
  | "blocking"
  | "warning"
  | "info";

export type EnterpriseFootprintRestoreUiQaStep = {
  id: EnterpriseFootprintRestoreUiQaStepId;
  label: string;
  description: string;
  severity: EnterpriseFootprintRestoreUiQaStepSeverity;
  status: EnterpriseFootprintRestoreUiQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EnterpriseFootprintRestoreUiQaChecklist = {
  steps: EnterpriseFootprintRestoreUiQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.18";
};

export type EnterpriseFootprintRestoreUiQaVerdict =
  | "ready"
  | "blocked"
  | "needs_review"
  | "pending";

export type EnterpriseFootprintRestoreUiQaSummary = {
  verdict: EnterpriseFootprintRestoreUiQaVerdict;
  blocking_steps: EnterpriseFootprintRestoreUiQaStepId[];
  passed_steps: EnterpriseFootprintRestoreUiQaStepId[];
  pending_steps: EnterpriseFootprintRestoreUiQaStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintRestoreUiQaChecklist(): EnterpriseFootprintRestoreUiQaChecklist {
  const steps: EnterpriseFootprintRestoreUiQaStep[] = [
    {
      id: "restore_ui_model_exists",
      label: "Restore UI model existe",
      description: "Le fichier enterprise-footprint-restore-ui.ts est présent.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier src/lib/clonestore/enterprise-footprint/enterprise-footprint-restore-ui.ts.",
      expected_result: "Fichier présent avec toutes les fonctions.",
    },
    {
      id: "status_labels_cover_all_outcomes",
      label: "Labels statut couvrent tous les outcomes",
      description: "Les 10 statuts UI sont mappés en labels lisibles.",
      severity: "blocking", status: "pending",
      how_to_verify: "Tester getEnterpriseFootprintRestoreUiStatusLabel sur chaque statut.",
      expected_result: "Chaque statut a un label non vide.",
    },
    {
      id: "source_labels_cover_local_and_server",
      label: "Labels source couvrent local et serveur",
      description: "Les sources localstorage/server et variantes sont mappées.",
      severity: "blocking", status: "pending",
      how_to_verify: "Tester getEnterpriseFootprintRestoreUiSourceLabel.",
      expected_result: "localstorage et server ont des labels distincts.",
    },
    {
      id: "ui_snapshot_builds",
      label: "Snapshot UI se construit",
      description: "buildEnterpriseFootprintRestoreUiSnapshot retourne un snapshot valide.",
      severity: "blocking", status: "pending",
      how_to_verify: "Tester via les tests unitaires.",
      expected_result: "Snapshot avec read_only: true et fallback_local_active: true.",
    },
    {
      id: "ui_badges_build",
      label: "Badges UI se construisent",
      description: "buildEnterpriseFootprintRestoreUiBadges retourne des badges.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier les badges status/source/fallback/no-action/flag.",
      expected_result: "Badges incluant 'localStorage reste le fallback actif'.",
    },
    {
      id: "ui_cards_build",
      label: "Cards UI se construisent",
      description: "buildEnterpriseFootprintRestoreUiCards retourne 4 cards.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier les cards source/statut/flag/tentative.",
      expected_result: "4 cards contextuelles.",
    },
    {
      id: "ui_timeline_build",
      label: "Timeline UI se construit",
      description: "buildEnterpriseFootprintRestoreUiTimeline retourne une timeline.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier que la sauvegarde locale est toujours en premier.",
      expected_result: "Timeline avec sauvegarde locale d'abord.",
    },
    {
      id: "profile_onboarding_restore_panel_visible",
      label: "Panneau Statut Empreinte visible dans /profile/onboarding",
      description: "Le panneau 'Statut Empreinte' est affiché dans l'onboarding.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/onboarding — chercher 'Statut Empreinte'.",
      expected_result: "Panneau visible avec badges, source, statut, fallback.",
    },
    {
      id: "localstorage_fallback_visible",
      label: "Fallback localStorage visible",
      description: "Le message 'localStorage reste le fallback actif' est affiché.",
      severity: "blocking", status: "pending",
      how_to_verify: "Inspecter /profile/onboarding — texte fallback présent.",
      expected_result: "'localStorage reste le fallback actif' visible.",
    },
    {
      id: "server_disabled_visible",
      label: "Statut serveur désactivé visible",
      description: "Le cas serveur désactivé est lisible dans l'UI.",
      severity: "warning", status: "pending",
      how_to_verify: "Flag false → statut 'Persistance serveur désactivée'.",
      expected_result: "Statut serveur désactivé affiché clairement.",
    },
    {
      id: "server_synced_visible",
      label: "Statut serveur synchronisé visible",
      description: "Le cas serveur synchronisé est lisible dans l'UI.",
      severity: "warning", status: "pending",
      how_to_verify: "Sync OK → statut 'Empreinte synchronisée serveur'.",
      expected_result: "Statut serveur synchronisé affiché clairement.",
    },
    {
      id: "table_unavailable_visible",
      label: "Statut table indisponible visible",
      description: "Le cas table SQL absente est lisible dans l'UI.",
      severity: "warning", status: "pending",
      how_to_verify: "Table KO → warning 'SQL/RLS à vérifier manuellement'.",
      expected_result: "Warning table indisponible affiché.",
    },
    {
      id: "rls_failed_visible",
      label: "Statut RLS à vérifier visible",
      description: "Le cas RLS KO est lisible dans l'UI.",
      severity: "warning", status: "pending",
      how_to_verify: "RLS KO → 'RLS/permissions à vérifier'.",
      expected_result: "Warning RLS affiché.",
    },
    {
      id: "no_db_write_added",
      label: "Aucun write DB ajouté",
      description: "P3.18 n'ajoute aucune écriture en base.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier que le module UI est pur (pas de write).",
      expected_result: "Aucun write DB ajouté.",
    },
    {
      id: "no_api_post_added",
      label: "Aucun appel API POST ajouté",
      description: "P3.18 n'ajoute aucun POST direct vers la route.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le code — pas de fetch POST ajouté.",
      expected_result: "Aucun POST ajouté.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Aucun import moteur Pierre",
      description: "Le module UI ne contient pas d'import src/lib/pierre.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — aucun import depuis @/lib/pierre.",
      expected_result: "Aucun import Pierre moteur.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 3.18 n'active pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier go-live-proofs.local.json non modifié.",
      expected_result: "go-live-proofs.local.json inchangé. Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.18",
  };
}

export function buildEnterpriseFootprintRestoreUiQaVerdict(
  steps: EnterpriseFootprintRestoreUiQaStep[]
): EnterpriseFootprintRestoreUiQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: EnterpriseFootprintRestoreUiQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: EnterpriseFootprintRestoreUiQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeEnterpriseFootprintRestoreUiQaVerdict(summary);
  return summary;
}

export function getEnterpriseFootprintRestoreUiBlockingSteps(): EnterpriseFootprintRestoreUiQaStep[] {
  return buildEnterpriseFootprintRestoreUiQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizeEnterpriseFootprintRestoreUiQaVerdict(
  summary: EnterpriseFootprintRestoreUiQaSummary
): string {
  const lines = [
    `[QA PHASE 3.18 Restore UI] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "ready") {
    lines.push("  → QA Restore UI validée.");
  } else if (summary.verdict === "pending") {
    lines.push("  → Prêt pour vérification manuelle. Suivre les étapes dans l'ordre.");
  }
  return lines.join("\n");
}
