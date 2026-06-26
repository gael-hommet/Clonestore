// src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup-qa.ts
// PHASE 3.10 — Pierre Setup Reads Enterprise Footprint — QA Module Setup
//
// Module pur — aucun appel réseau, aucun Supabase, aucun write, aucun import pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierreSetupFootprintQaStepId =
  | "footprint_snapshot_or_empty_state"
  | "onboarding_fallback_available"
  | "pierre_context_builds"
  | "pierre_context_validates"
  | "setup_summary_builds"
  | "setup_cards_build"
  | "setup_recommendations_build"
  | "setup_panel_visible"
  | "read_only_badge_visible"
  | "no_db_write"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_runtime_execution"
  | "rollback_empty_state_available";

export type PierreSetupFootprintQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type PierreSetupFootprintQaStep = {
  id: PierreSetupFootprintQaStepId;
  label: string;
  description: string;
  severity: "blocking" | "warning" | "info";
  status: PierreSetupFootprintQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type PierreSetupFootprintQaVerdict =
  | "ready_for_qa"
  | "blocked"
  | "passed"
  | "needs_review";

export type PierreSetupFootprintQaChecklist = {
  steps: PierreSetupFootprintQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.10";
};

export type PierreSetupFootprintQaSummary = {
  verdict: PierreSetupFootprintQaVerdict;
  blocking_steps: PierreSetupFootprintQaStepId[];
  passed_steps: PierreSetupFootprintQaStepId[];
  pending_steps: PierreSetupFootprintQaStepId[];
  message: string;
  qa_safe: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildPierreSetupFootprintQaChecklist(): PierreSetupFootprintQaChecklist {
  const steps: PierreSetupFootprintQaStep[] = [
    {
      id: "footprint_snapshot_or_empty_state",
      label: "Snapshot disponible ou état vide propre",
      description:
        "loadPierreSetupEnterpriseFootprint() retourne soit un résultat valide, soit un empty state.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Aller sur /agents/pierre/setup → vérifier panneau Empreinte Entreprise.",
      expected_result: "Panneau affiché avec données ou message 'Empreinte Entreprise manquante' + CTA.",
    },
    {
      id: "onboarding_fallback_available",
      label: "Fallback depuis GlobalOnboardingDraft",
      description:
        "Si snapshot absent, essayer GlobalOnboardingDraft localStorage.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Supprimer snapshot, garder draft onboarding → aller sur /agents/pierre/setup.",
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
      how_to_verify: "Vérifier les recommendations affichées dans le panneau.",
      expected_result: "Recommendations cohérentes avec le contexte.",
    },
    {
      id: "setup_summary_builds",
      label: "Summary Setup construit",
      description:
        "buildPierreSetupFootprintSummary(footprint, context) retourne un objet complet.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que company_name, readiness, risk sont affichés.",
      expected_result: "Tous les champs summary présents.",
    },
    {
      id: "setup_cards_build",
      label: "Cards Setup construites",
      description:
        "buildPierreSetupFootprintCards(footprint, context) retourne 4 cards.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier les 4 cartes : Readiness Pierre, Risque RH, Validations, Contexte RH.",
      expected_result: "4 cartes minimum affichées.",
    },
    {
      id: "setup_recommendations_build",
      label: "Recommendations construites",
      description:
        "buildPierreSetupFootprintRecommendations retourne des recommandations pertinentes.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier les recommandations dans le panneau.",
      expected_result: "Au moins 1 recommendation affichée.",
    },
    {
      id: "setup_panel_visible",
      label: "Panneau visible dans /agents/pierre/setup",
      description:
        "Le panneau 'Empreinte Entreprise' est visible dans la page.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Aller sur /agents/pierre/setup → vérifier le panneau.",
      expected_result: "Panneau 'Empreinte Entreprise' visible avec indicateurs.",
    },
    {
      id: "read_only_badge_visible",
      label: "Badge lecture seule visible",
      description:
        "Les badges 'Lecture seule' et 'Aucune action exécutée' sont visibles.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier les badges dans le panneau.",
      expected_result: "Badges 'Lecture seule' + 'Aucune action exécutée' présents.",
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
      description: "Le bridge setup est localStorage-only.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier enterprise-footprint-pierre-setup.ts : pas d'import @supabase/supabase-js.",
      expected_result: "Aucun import Supabase dans le bridge setup.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Pas d'import moteur Pierre",
      description: "Le bridge setup n'importe pas src/lib/pierre/**.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier enterprise-footprint-pierre-setup.ts : pas d'import @/lib/pierre.",
      expected_result: "Aucun import moteur Pierre.",
    },
    {
      id: "no_runtime_execution",
      label: "Pas d'exécution runtime",
      description: "Aucune fonction Pierre n'est exécutée depuis le panneau.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que /agents/pierre/setup ne contient pas de processCloneOSCommand ou executeTask pour l'empreinte.",
      expected_result: "Aucun appel runtime Pierre pour l'empreinte.",
    },
    {
      id: "rollback_empty_state_available",
      label: "Rollback → état vide propre",
      description:
        "Si localStorage supprimé, le panneau affiche l'état vide sans erreur.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Supprimer les clés localStorage → aller sur /agents/pierre/setup.",
      expected_result: "Message 'Empreinte Entreprise manquante' + CTA /profile/onboarding.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.10",
  };
}

export function buildPierreSetupFootprintQaVerdict(
  steps: PierreSetupFootprintQaStep[]
): PierreSetupFootprintQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: PierreSetupFootprintQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_qa";
  else verdict = "needs_review";

  const qaSafe = verdict === "passed" || (verdict === "needs_review" && blockingFailed.length === 0);

  const summary: PierreSetupFootprintQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    qa_safe: qaSafe,
  };
  summary.message = summarizePierreSetupFootprintQaVerdict(summary);
  return summary;
}

export function getPierreSetupFootprintBlockingSteps(): PierreSetupFootprintQaStep[] {
  return buildPierreSetupFootprintQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizePierreSetupFootprintQaVerdict(
  summary: PierreSetupFootprintQaSummary
): string {
  const lines = [
    `[QA PHASE 3.10 Pierre Setup] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
  ];
  if (summary.verdict === "passed") lines.push("  → QA Pierre Setup validée.");
  else if (summary.verdict === "ready_for_qa") lines.push("  → Prêt pour QA manuelle.");
  return lines.join("\n");
}
