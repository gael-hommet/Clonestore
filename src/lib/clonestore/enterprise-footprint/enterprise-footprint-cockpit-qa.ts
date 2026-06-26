// src/lib/clonestore/enterprise-footprint/enterprise-footprint-cockpit-qa.ts
// PHASE 3.9 — Empreinte Entreprise Cockpit Integration — QA Module Cockpit
//
// Module pur — aucun appel réseau, aucun Supabase, aucun write.

import type {
  EnterpriseFootprintReadWriteQaStepId,
  EnterpriseFootprintReadWriteQaStepStatus,
  EnterpriseFootprintReadWriteQaStep,
} from "./enterprise-footprint-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintCockpitQaStepId =
  | "footprint_snapshot_available_or_empty_state"
  | "onboarding_fallback_available"
  | "cockpit_summary_builds"
  | "cockpit_cards_build"
  | "cockpit_actions_build"
  | "cockpit_preview_visible"
  | "read_only_badge_visible"
  | "no_db_write"
  | "no_supabase_import_in_page"
  | "no_pierre_engine_change"
  | "pierre_handoff_design_ready"
  | "rollback_localstorage_available";

export type EnterpriseFootprintCockpitQaStep = {
  id: EnterpriseFootprintCockpitQaStepId;
  label: string;
  description: string;
  severity: "blocking" | "warning" | "info";
  status: EnterpriseFootprintReadWriteQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EnterpriseFootprintCockpitQaVerdict =
  | "ready_for_qa"
  | "blocked"
  | "passed"
  | "needs_review";

export type EnterpriseFootprintCockpitQaChecklist = {
  steps: EnterpriseFootprintCockpitQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.9";
};

export type EnterpriseFootprintCockpitQaSummary = {
  verdict: EnterpriseFootprintCockpitQaVerdict;
  blocking_steps: EnterpriseFootprintCockpitQaStepId[];
  passed_steps: EnterpriseFootprintCockpitQaStepId[];
  pending_steps: EnterpriseFootprintCockpitQaStepId[];
  message: string;
  qa_safe: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintCockpitQaChecklist(): EnterpriseFootprintCockpitQaChecklist {
  const steps: EnterpriseFootprintCockpitQaStep[] = [
    {
      id: "footprint_snapshot_available_or_empty_state",
      label: "Snapshot disponible ou état vide propre",
      description:
        "loadEnterpriseFootprintForCockpit() retourne soit un footprint valide, soit un empty state avec CTA /profile/onboarding.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Aller sur /profile/agents → vérifier section Empreinte Entreprise.",
      expected_result: "Soit données affichées, soit message 'Aucune Empreinte Entreprise' + CTA.",
    },
    {
      id: "onboarding_fallback_available",
      label: "Fallback depuis GlobalOnboardingDraft",
      description:
        "Si snapshot absent, essayer de charger depuis GlobalOnboardingDraft localStorage.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Supprimer clonestore.enterpriseFootprint.snapshot.v1, garder clonestore.globalOnboarding.draft.v1 → aller sur /profile/agents.",
      expected_result: "Empreinte affichée avec source 'Brouillon onboarding'.",
    },
    {
      id: "cockpit_summary_builds",
      label: "Summary cockpit construit",
      description:
        "buildEnterpriseFootprintCockpitSummary(footprint) retourne un objet complet.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier que company_name, readiness_score, coverage_score sont affichés.",
      expected_result: "Tous les champs summary sont présents et cohérents.",
    },
    {
      id: "cockpit_cards_build",
      label: "Cards cockpit construites",
      description:
        "buildEnterpriseFootprintCockpitCards(footprint) retourne les 4 cartes minimum.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier les cartes Readiness, CloneADN, Humains, Règles.",
      expected_result: "4 cartes minimum affichées.",
    },
    {
      id: "cockpit_actions_build",
      label: "Actions cockpit disponibles",
      description:
        "buildEnterpriseFootprintCockpitActions(footprint) retourne les CTAs.",
      severity: "warning",
      status: "pending",
      how_to_verify: "Vérifier les boutons CTA dans la section.",
      expected_result: "/profile/onboarding, /profile/messages, /profile/technologies, /agents/pierre/setup présents.",
    },
    {
      id: "cockpit_preview_visible",
      label: "Aperçu visible dans /profile/agents",
      description:
        "La section 'Empreinte Entreprise' est visible dans /profile/agents.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Aller sur /profile/agents → scroller jusqu'à la section.",
      expected_result: "Section 'Empreinte Entreprise' affichée avec données.",
    },
    {
      id: "read_only_badge_visible",
      label: "Badge lecture seule visible",
      description:
        "La mention 'Lecture seule' ou 'Aucune action exécutée' est visible.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "Vérifier le badge dans la section empreinte.",
      expected_result: "Badge 'Lecture seule' + 'Aucune action exécutée' visible.",
    },
    {
      id: "no_db_write",
      label: "Aucun write DB depuis le cockpit",
      description:
        "Le cockpit ne déclenche aucun write DB pour l'empreinte.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "DevTools → Network → vérifier absence de requêtes INSERT/UPSERT vers clonestore_enterprise_footprints.",
      expected_result: "Aucune requête write vers Supabase.",
    },
    {
      id: "no_supabase_import_in_page",
      label: "Pas d'import Supabase dédié footprint dans la page",
      description:
        "Le cockpit bridge est localStorage-only — pas de Supabase import ajouté pour l'empreinte.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Vérifier enterprise-footprint-cockpit.ts : pas d'import @supabase/supabase-js.",
      expected_result: "Aucun import Supabase dans le cockpit bridge.",
    },
    {
      id: "no_pierre_engine_change",
      label: "Moteur Pierre intact",
      description:
        "Aucune modification de src/lib/pierre/** ou src/app/api/pierre/**.",
      severity: "blocking",
      status: "pending",
      how_to_verify: "git diff src/lib/pierre/ src/app/api/pierre/",
      expected_result: "Aucune modification.",
    },
    {
      id: "pierre_handoff_design_ready",
      label: "Pierre handoff design prêt",
      description:
        "enterprise-footprint-pierre-handoff.ts contient buildPierreEnterpriseFootprintContext.",
      severity: "info",
      status: "pending",
      how_to_verify: "Vérifier que le fichier existe et exporte les fonctions attendues.",
      expected_result: "Fichier présent, fonctions exportées, pas d'import src/lib/pierre.",
    },
    {
      id: "rollback_localstorage_available",
      label: "Rollback localStorage disponible",
      description:
        "Si les données localStorage sont supprimées, le cockpit affiche l'état vide sans erreur.",
      severity: "blocking",
      status: "pending",
      how_to_verify:
        "Supprimer les deux clés localStorage → aller sur /profile/agents.",
      expected_result: "Message 'Aucune Empreinte Entreprise' + CTA /profile/onboarding.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.9",
  };
}

export function buildEnterpriseFootprintCockpitQaVerdict(
  steps: EnterpriseFootprintCockpitQaStep[]
): EnterpriseFootprintCockpitQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: EnterpriseFootprintCockpitQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_qa";
  else verdict = "needs_review";

  const qaSafe = verdict === "passed" || (verdict === "needs_review" && blockingFailed.length === 0);

  const summary: EnterpriseFootprintCockpitQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    qa_safe: qaSafe,
  };
  summary.message = summarizeEnterpriseFootprintCockpitQaVerdict(summary);
  return summary;
}

export function getEnterpriseFootprintCockpitBlockingSteps(): EnterpriseFootprintCockpitQaStep[] {
  return buildEnterpriseFootprintCockpitQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizeEnterpriseFootprintCockpitQaVerdict(
  summary: EnterpriseFootprintCockpitQaSummary
): string {
  const lines = [
    `[QA PHASE 3.9 Cockpit] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
  ];
  if (summary.verdict === "passed") lines.push("  → Cockpit intégration validée.");
  else if (summary.verdict === "ready_for_qa") lines.push("  → Prêt pour QA manuelle.");
  return lines.join("\n");
}
