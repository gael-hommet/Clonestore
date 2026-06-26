// src/lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed-qa.ts
// PHASE 3.16 — Profile Messages Enterprise Footprint Feed QA
//
// Module pur — checklist QA pour l'intégration de l'Empreinte dans /profile/messages.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type EnterpriseFootprintMessagesFeedQaStepId =
  | "messages_feed_bridge_exists"
  | "footprint_snapshot_or_empty_state"
  | "onboarding_fallback_available"
  | "feed_summary_builds"
  | "feed_cards_build"
  | "feed_items_build"
  | "feed_recommendations_build"
  | "profile_messages_panel_visible"
  | "read_only_badge_visible"
  | "no_db_write"
  | "no_api_post"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_message_sent"
  | "rollback_empty_state_available"
  | "public_launch_external_not_validated";

export type EnterpriseFootprintMessagesFeedQaStepStatus =
  | "pending"   // non encore vérifié
  | "passed"    // vérifié OK
  | "failed"    // vérifié KO
  | "skipped";  // délibérément ignoré

export type EnterpriseFootprintMessagesFeedQaStepSeverity =
  | "blocking"  // bloque si failed
  | "warning"   // avertissement
  | "info";     // informatif

export type EnterpriseFootprintMessagesFeedQaStep = {
  id: EnterpriseFootprintMessagesFeedQaStepId;
  label: string;
  description: string;
  severity: EnterpriseFootprintMessagesFeedQaStepSeverity;
  status: EnterpriseFootprintMessagesFeedQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EnterpriseFootprintMessagesFeedQaChecklist = {
  steps: EnterpriseFootprintMessagesFeedQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.16";
};

export type EnterpriseFootprintMessagesFeedQaVerdict =
  | "ready"         // tous les checks passent
  | "blocked"       // au moins un blocking failed
  | "needs_review"  // étapes pending/warning
  | "pending";      // aucune vérification effectuée

export type EnterpriseFootprintMessagesFeedQaSummary = {
  verdict: EnterpriseFootprintMessagesFeedQaVerdict;
  blocking_steps: EnterpriseFootprintMessagesFeedQaStepId[];
  passed_steps: EnterpriseFootprintMessagesFeedQaStepId[];
  pending_steps: EnterpriseFootprintMessagesFeedQaStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildEnterpriseFootprintMessagesFeedQaChecklist(): EnterpriseFootprintMessagesFeedQaChecklist {
  const steps: EnterpriseFootprintMessagesFeedQaStep[] = [
    {
      id: "messages_feed_bridge_exists",
      label: "Bridge messages feed existe",
      description: "Le fichier enterprise-footprint-messages-feed.ts est présent.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier src/lib/clonestore/enterprise-footprint/enterprise-footprint-messages-feed.ts.",
      expected_result: "Fichier présent avec toutes les fonctions.",
    },
    {
      id: "footprint_snapshot_or_empty_state",
      label: "Snapshot ou empty state rendu",
      description: "loadEnterpriseFootprintForMessagesFeed() retourne un résultat valide.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages — panneau Empreinte visible.",
      expected_result: "Panneau affiché avec données ou empty state propre.",
    },
    {
      id: "onboarding_fallback_available",
      label: "Fallback onboarding draft disponible",
      description: "Sans snapshot, l'onboarding draft est utilisé comme fallback.",
      severity: "warning", status: "pending",
      how_to_verify: "Vider le snapshot localStorage, recharger — données depuis draft.",
      expected_result: "Source = 'onboarding_draft_fallback' ou empty state.",
    },
    {
      id: "feed_summary_builds",
      label: "Summary feed se construit",
      description: "buildEnterpriseFootprintMessagesFeedSummary() retourne un objet valide.",
      severity: "blocking", status: "pending",
      how_to_verify: "Tester manuellement ou via les tests unitaires.",
      expected_result: "Objet summary avec read_only: true.",
    },
    {
      id: "feed_cards_build",
      label: "Cards feed se construisent",
      description: "buildEnterpriseFootprintMessagesFeedCards() retourne 4 cards.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier via tests ou DevTools.",
      expected_result: "4 cards : Empreinte, Validation, Documents, À compléter.",
    },
    {
      id: "feed_items_build",
      label: "Feed items se construisent",
      description: "buildEnterpriseFootprintMessagesFeedItems() retourne des items read_only.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier que les items ont read_only: true.",
      expected_result: "Tous les items ont read_only: true.",
    },
    {
      id: "feed_recommendations_build",
      label: "Recommendations se construisent",
      description: "buildEnterpriseFootprintMessagesFeedRecommendations() retourne des recommendations.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier l'affichage dans /profile/messages.",
      expected_result: "Recommendations adaptées au contexte.",
    },
    {
      id: "profile_messages_panel_visible",
      label: "Panneau Empreinte visible dans /profile/messages",
      description: "La section Empreinte Entreprise est affichée dans la page messages.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages — chercher 'Empreinte Entreprise'.",
      expected_result: "Section visible avec badges Lecture seule.",
    },
    {
      id: "read_only_badge_visible",
      label: "Badge Lecture seule visible",
      description: "Le badge 'Lecture seule' est affiché dans le panneau Empreinte.",
      severity: "blocking", status: "pending",
      how_to_verify: "Inspecter /profile/messages — badge 'Lecture seule' présent.",
      expected_result: "Badge 'Lecture seule' et 'Aucune action exécutée' visibles.",
    },
    {
      id: "no_db_write",
      label: "Aucun write DB depuis /profile/messages",
      description: "Le panneau Empreinte ne déclenche aucune écriture en base.",
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools → Network — aucun POST vers enterprise-footprint.",
      expected_result: "Aucun POST /api/profile/enterprise-footprint.",
    },
    {
      id: "no_api_post",
      label: "Aucun appel API POST",
      description: "Aucun fetch POST vers la route enterprise-footprint.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le code source — pas de fetch POST.",
      expected_result: "Aucun appel POST à /api/profile/enterprise-footprint.",
    },
    {
      id: "no_supabase_import",
      label: "Aucun import Supabase dans le bridge",
      description: "enterprise-footprint-messages-feed.ts n'importe pas Supabase directement.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — aucun import @supabase/supabase-js.",
      expected_result: "Aucun import Supabase dans le bridge messages feed.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Aucun import moteur Pierre",
      description: "Le bridge ne contient pas d'import src/lib/pierre.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — aucun import depuis @/lib/pierre.",
      expected_result: "Aucun import Pierre moteur dans le bridge.",
    },
    {
      id: "no_message_sent",
      label: "Aucun message envoyé",
      description: "Les feed items ne prétendent pas envoyer de message réel.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire les feed items — aucun n'indique qu'un message a été envoyé.",
      expected_result: "Aucun feed item avec 'message envoyé' / 'exécuté' en positif.",
    },
    {
      id: "rollback_empty_state_available",
      label: "Empty state disponible",
      description: "Si l'Empreinte est absente, un empty state propre est affiché.",
      severity: "warning", status: "pending",
      how_to_verify: "Vider localStorage → /profile/messages → empty state visible.",
      expected_result: "Empty state avec CTA /profile/onboarding.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 3.16 n'active pas le lancement public externe.",
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
    phase: "3.16",
  };
}

export function buildEnterpriseFootprintMessagesFeedQaVerdict(
  steps: EnterpriseFootprintMessagesFeedQaStep[]
): EnterpriseFootprintMessagesFeedQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: EnterpriseFootprintMessagesFeedQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: EnterpriseFootprintMessagesFeedQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeEnterpriseFootprintMessagesFeedQaVerdict(summary);
  return summary;
}

export function getEnterpriseFootprintMessagesFeedBlockingSteps(): EnterpriseFootprintMessagesFeedQaStep[] {
  return buildEnterpriseFootprintMessagesFeedQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizeEnterpriseFootprintMessagesFeedQaVerdict(
  summary: EnterpriseFootprintMessagesFeedQaSummary
): string {
  const lines = [
    `[QA PHASE 3.16 Messages Feed] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "ready") {
    lines.push("  → QA Messages Feed validée.");
  } else if (summary.verdict === "pending") {
    lines.push("  → Prêt pour vérification manuelle. Suivre les étapes dans l'ordre.");
  }
  return lines.join("\n");
}
