// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use-qa.ts
// PHASE 3.11 — Pierre Use Reads Enterprise Footprint — QA Module Use
//
// Module pur — aucun appel réseau, aucun Supabase, aucun write, aucun import pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierreUseFootprintQaStepId =
  | "footprint_snapshot_or_empty_state"
  | "onboarding_fallback_available"
  | "pierre_context_builds"
  | "pierre_context_validates"
  | "use_summary_builds"
  | "use_cards_build"
  | "use_warnings_build"
  | "use_suggestions_build"
  | "use_panel_visible"
  | "read_only_badge_visible"
  | "plan_only_badge_visible"
  | "no_db_write"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_runtime_execution"
  | "no_auto_submit"
  | "rollback_empty_state_available";

export type PierreUseFootprintQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type PierreUseFootprintQaStep = {
  id: PierreUseFootprintQaStepId;
  label: string;
  description: string;
  severity: "blocking" | "warning" | "info";
  status: PierreUseFootprintQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type PierreUseFootprintQaVerdict =
  | "ready_for_qa"
  | "blocked"
  | "passed"
  | "needs_review";

export type PierreUseFootprintQaChecklist = {
  steps: PierreUseFootprintQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.11";
};

export type PierreUseFootprintQaSummary = {
  verdict: PierreUseFootprintQaVerdict;
  blocking_steps: PierreUseFootprintQaStepId[];
  passed_steps: PierreUseFootprintQaStepId[];
  pending_steps: PierreUseFootprintQaStepId[];
  message: string;
  qa_safe: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildPierreUseFootprintQaChecklist(): PierreUseFootprintQaChecklist {
  const steps: PierreUseFootprintQaStep[] = [
    {
      id: "footprint_snapshot_or_empty_state",
      label: "Snapshot disponible ou état vide propre",
      description:
        "loadPierreUseEnterpriseFootprint() retourne soit un résultat valide, soit un empty state.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Aller sur /agents/pierre/use → vérifier panneau Empreinte Entreprise.",
      expected_result:
        "Panneau affiché avec données ou message 'Empreinte Entreprise manquante' + CTA.",
    },
    {
      id: "onboarding_fallback_available",
      label: "Fallback depuis GlobalOnboardingDraft",
      description:
        "Si snapshot absent, essayer GlobalOnboardingDraft localStorage.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Supprimer snapshot, garder draft onboarding → aller sur /agents/pierre/use.",
      expected_result: "Panneau affiché avec source 'Brouillon onboarding'.",
    },
    {
      id: "pierre_context_builds",
      label: "Contexte Pierre construit",
      description:
        "buildPierreEnterpriseFootprintContext(footprint) retourne un contexte valide.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que company_name, approvers, approval_rules sont présents.",
      expected_result: "Contexte avec tous les champs attendus.",
    },
    {
      id: "pierre_context_validates",
      label: "Contexte Pierre validé",
      description:
        "validatePierreEnterpriseFootprintContext(context) retourne les issues.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier les warnings affichés dans le panneau.",
      expected_result: "Warnings cohérents avec le contexte.",
    },
    {
      id: "use_summary_builds",
      label: "Summary Use construit",
      description:
        "buildPierreUseFootprintSummary(footprint, context) retourne un objet complet.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que company_name, readiness, risk sont affichés.",
      expected_result: "Tous les champs summary présents.",
    },
    {
      id: "use_cards_build",
      label: "Cards Use construites",
      description:
        "buildPierreUseFootprintCards(footprint, context) retourne 4 cards.",
      severity: "warning",
      status: "pending",
      how_to_verify:
        "Vérifier les 4 cartes : Contexte entreprise, Readiness, Garde-fous RH, Ressources RH.",
      expected_result: "4 cartes minimum affichées.",
    },
    {
      id: "use_warnings_build",
      label: "Warnings construits",
      description:
        "buildPierreUseFootprintWarnings retourne des warnings pertinents.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier les warnings dans le panneau.",
      expected_result: "Au moins 1 warning affiché (plan_only_reminder toujours présent).",
    },
    {
      id: "use_suggestions_build",
      label: "Suggestions plan-only construites",
      description:
        "buildPierreUseFootprintMissionSuggestions retourne 5 suggestions avec plan_only: true.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier les suggestions affichées dans le panneau.",
      expected_result: "5 suggestions plan-only affichées, aucune ne soumet automatiquement.",
    },
    {
      id: "use_panel_visible",
      label: "Panneau visible dans /agents/pierre/use",
      description:
        "Le panneau 'Empreinte Entreprise' est visible dans la page.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Aller sur /agents/pierre/use → vérifier le panneau.",
      expected_result: "Panneau 'Empreinte Entreprise' visible avec indicateurs.",
    },
    {
      id: "read_only_badge_visible",
      label: "Badge lecture seule visible",
      description:
        "Le badge 'Lecture seule' est visible.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier le badge dans le panneau.",
      expected_result: "Badge 'Lecture seule' présent.",
    },
    {
      id: "plan_only_badge_visible",
      label: "Badge plan-only visible",
      description:
        "Le badge 'Plan-only' ou 'Aucune action exécutée' est visible.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier le badge dans le panneau.",
      expected_result: "Badge 'Plan-only' / 'Aucune action exécutée' présent.",
    },
    {
      id: "no_db_write",
      label: "Aucun write DB",
      description: "Le panneau ne déclenche aucune écriture DB.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "DevTools → Network → vérifier absence de requêtes INSERT.",
      expected_result: "Aucune requête write Supabase.",
    },
    {
      id: "no_supabase_import",
      label: "Pas d'import Supabase dédié footprint",
      description: "Le bridge use est localStorage-only.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier enterprise-footprint-pierre-use.ts : pas d'import @supabase/supabase-js.",
      expected_result: "Aucun import Supabase dans le bridge use.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Pas d'import moteur Pierre",
      description: "Le bridge use n'importe pas src/lib/pierre/**.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier enterprise-footprint-pierre-use.ts : pas d'import @/lib/pierre.",
      expected_result: "Aucun import moteur Pierre.",
    },
    {
      id: "no_runtime_execution",
      label: "Pas d'exécution runtime",
      description: "Aucune fonction Pierre n'est exécutée depuis le panneau.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier que /agents/pierre/use ne contient pas de processCloneOSCommand ou executeTask pour l'empreinte.",
      expected_result: "Aucun appel runtime Pierre pour l'empreinte.",
    },
    {
      id: "no_auto_submit",
      label: "Pas d'auto-submit depuis les suggestions",
      description:
        "Les boutons de suggestions ne soumettent pas automatiquement au moteur Pierre.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Cliquer sur une suggestion → vérifier que le moteur n'est pas appelé automatiquement.",
      expected_result:
        "Cliquer sur suggestion remplit seulement le champ texte ou affiche le prompt — pas d'exécution.",
    },
    {
      id: "rollback_empty_state_available",
      label: "Rollback → état vide propre",
      description:
        "Si localStorage supprimé, le panneau affiche l'état vide sans erreur.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Supprimer les clés localStorage → aller sur /agents/pierre/use.",
      expected_result:
        "Message 'Empreinte Entreprise manquante' + CTA /profile/onboarding.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.11",
  };
}

export function buildPierreUseFootprintQaVerdict(
  steps: PierreUseFootprintQaStep[]
): PierreUseFootprintQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: PierreUseFootprintQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_qa";
  else verdict = "needs_review";

  const qaSafe =
    verdict === "passed" ||
    (verdict === "needs_review" && blockingFailed.length === 0);

  const summary: PierreUseFootprintQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    qa_safe: qaSafe,
  };
  summary.message = summarizePierreUseFootprintQaVerdict(summary);
  return summary;
}

export function getPierreUseFootprintBlockingSteps(): PierreUseFootprintQaStep[] {
  return buildPierreUseFootprintQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizePierreUseFootprintQaVerdict(
  summary: PierreUseFootprintQaSummary
): string {
  const lines = [
    `[QA PHASE 3.11 Pierre Use] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
  ];
  if (summary.verdict === "passed") lines.push("  → QA Pierre Use validée.");
  else if (summary.verdict === "ready_for_qa") lines.push("  → Prêt pour QA manuelle.");
  return lines.join("\n");
}
