// src/lib/clonestore/messages/profile-messages-context-feed-qa.ts
// PHASE 3.17 — Profile Messages CloneOS History Feed Merge — QA Module
//
// Module pur — checklist QA pour le feed contextuel unifié dans /profile/messages.
// Pas de Supabase. Pas de réseau. Pas de write. Pas d'import Pierre.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProfileMessagesContextFeedQaStepId =
  | "context_feed_bridge_exists"
  | "enterprise_feed_reused"
  | "cloneos_history_feed_reused_or_created"
  | "context_summary_builds"
  | "context_sections_build"
  | "context_items_build"
  | "profile_messages_context_panel_visible"
  | "read_only_badge_visible"
  | "no_db_write"
  | "no_api_post"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_message_sent"
  | "no_cloneos_execution"
  | "fallback_empty_state_available"
  | "public_launch_external_not_validated";

export type ProfileMessagesContextFeedQaStepStatus =
  | "pending"
  | "passed"
  | "failed"
  | "skipped";

export type ProfileMessagesContextFeedQaStepSeverity =
  | "blocking"
  | "warning"
  | "info";

export type ProfileMessagesContextFeedQaStep = {
  id: ProfileMessagesContextFeedQaStepId;
  label: string;
  description: string;
  severity: ProfileMessagesContextFeedQaStepSeverity;
  status: ProfileMessagesContextFeedQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type ProfileMessagesContextFeedQaChecklist = {
  steps: ProfileMessagesContextFeedQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.17";
};

export type ProfileMessagesContextFeedQaVerdict =
  | "ready"
  | "blocked"
  | "needs_review"
  | "pending";

export type ProfileMessagesContextFeedQaSummary = {
  verdict: ProfileMessagesContextFeedQaVerdict;
  blocking_steps: ProfileMessagesContextFeedQaStepId[];
  passed_steps: ProfileMessagesContextFeedQaStepId[];
  pending_steps: ProfileMessagesContextFeedQaStepId[];
  message: string;
  safe_to_activate: boolean;
};

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildProfileMessagesContextFeedQaChecklist(): ProfileMessagesContextFeedQaChecklist {
  const steps: ProfileMessagesContextFeedQaStep[] = [
    {
      id: "context_feed_bridge_exists",
      label: "Bridge context feed existe",
      description: "Le fichier profile-messages-context-feed.ts est présent.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier src/lib/clonestore/messages/profile-messages-context-feed.ts.",
      expected_result: "Fichier présent avec toutes les fonctions.",
    },
    {
      id: "enterprise_feed_reused",
      label: "Feed Empreinte P3.16 réutilisé",
      description: "Le context feed importe loadEnterpriseFootprintForMessagesFeed.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — import depuis enterprise-footprint.",
      expected_result: "loadEnterpriseFootprintForMessagesFeed utilisé.",
    },
    {
      id: "cloneos_history_feed_reused_or_created",
      label: "Feed CloneOS history réutilisé ou créé",
      description: "Le context feed utilise le bridge CloneOS history localStorage.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — import loadProfileMessagesCloneOSHistoryFeed.",
      expected_result: "Bridge CloneOS history utilisé.",
    },
    {
      id: "context_summary_builds",
      label: "Summary contextuel se construit",
      description: "buildProfileMessagesContextFeedSummary retourne un objet valide.",
      severity: "blocking", status: "pending",
      how_to_verify: "Tester via les tests unitaires.",
      expected_result: "Summary avec read_only: true et compteurs.",
    },
    {
      id: "context_sections_build",
      label: "Sections contextuelles se construisent",
      description: "buildProfileMessagesContextFeedSections retourne des sections.",
      severity: "warning", status: "pending",
      how_to_verify: "Vérifier les sections enterprise/cloneos/empty.",
      expected_result: "Sections adaptées au contexte disponible.",
    },
    {
      id: "context_items_build",
      label: "Items contextuels se construisent",
      description: "buildProfileMessagesContextFeedItems retourne des items read_only.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier que tous les items ont read_only: true.",
      expected_result: "Tous les items ont read_only: true (max 8).",
    },
    {
      id: "profile_messages_context_panel_visible",
      label: "Panneau contexte visible dans /profile/messages",
      description: "La section Contexte système est affichée dans la page messages.",
      severity: "blocking", status: "pending",
      how_to_verify: "Aller sur /profile/messages — chercher 'Contexte système'.",
      expected_result: "Panneau unifié visible avec Empreinte + CloneOS.",
    },
    {
      id: "read_only_badge_visible",
      label: "Badge Lecture seule visible",
      description: "Le badge 'Lecture seule' est affiché dans le panneau contexte.",
      severity: "blocking", status: "pending",
      how_to_verify: "Inspecter /profile/messages — badge 'Lecture seule' présent.",
      expected_result: "Badges 'Lecture seule', 'Aucune action exécutée', 'Aucun message envoyé'.",
    },
    {
      id: "no_db_write",
      label: "Aucun write DB depuis /profile/messages",
      description: "Le panneau contexte ne déclenche aucune écriture en base.",
      severity: "blocking", status: "pending",
      how_to_verify: "DevTools → Network — aucun POST.",
      expected_result: "Aucun write DB.",
    },
    {
      id: "no_api_post",
      label: "Aucun appel API POST",
      description: "Aucun fetch POST vers une route enterprise-footprint ou CloneOS.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier le code source — pas de fetch POST.",
      expected_result: "Aucun appel POST.",
    },
    {
      id: "no_supabase_import",
      label: "Aucun import Supabase dans les bridges",
      description: "profile-messages-context-feed.ts n'importe pas Supabase directement.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — aucun import @supabase/supabase-js.",
      expected_result: "Aucun import Supabase dans le context feed.",
    },
    {
      id: "no_pierre_engine_import",
      label: "Aucun import moteur Pierre",
      description: "Les bridges ne contiennent pas d'import src/lib/pierre.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire le source — aucun import depuis @/lib/pierre.",
      expected_result: "Aucun import Pierre moteur.",
    },
    {
      id: "no_message_sent",
      label: "Aucun message envoyé",
      description: "Les feed items ne prétendent pas envoyer de message réel.",
      severity: "blocking", status: "pending",
      how_to_verify: "Lire les feed items — aucun n'indique qu'un message a été envoyé.",
      expected_result: "Aucun item avec 'message envoyé' en positif.",
    },
    {
      id: "no_cloneos_execution",
      label: "Aucune exécution CloneOS",
      description: "Le feed lit l'historique CloneOS mais n'exécute aucune commande.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier que le feed est plan-only / read-only.",
      expected_result: "Aucune exécution CloneOS — plan-only, lecture seule.",
    },
    {
      id: "fallback_empty_state_available",
      label: "Empty state disponible",
      description: "Si aucune source, un empty state propre est affiché.",
      severity: "warning", status: "pending",
      how_to_verify: "Vider localStorage → /profile/messages → empty state visible.",
      expected_result: "Empty state avec CTA /profile/onboarding et /profile/agents.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 3.17 n'active pas le lancement public externe.",
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
    phase: "3.17",
  };
}

export function buildProfileMessagesContextFeedQaVerdict(
  steps: ProfileMessagesContextFeedQaStep[]
): ProfileMessagesContextFeedQaSummary {
  const blockingFailed = steps.filter(
    (s) => s.severity === "blocking" && s.status === "failed"
  );
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter(
    (s) => s.status === "pending" || s.status === "skipped"
  );

  let verdict: ProfileMessagesContextFeedQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: ProfileMessagesContextFeedQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_activate: verdict !== "blocked",
  };
  summary.message = summarizeProfileMessagesContextFeedQaVerdict(summary);
  return summary;
}

export function getProfileMessagesContextFeedBlockingSteps(): ProfileMessagesContextFeedQaStep[] {
  return buildProfileMessagesContextFeedQaChecklist().steps.filter(
    (s) => s.severity === "blocking"
  );
}

export function summarizeProfileMessagesContextFeedQaVerdict(
  summary: ProfileMessagesContextFeedQaSummary
): string {
  const lines = [
    `[QA PHASE 3.17 Context Feed] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe : ${summary.safe_to_activate}`,
  ];
  if (summary.verdict === "ready") {
    lines.push("  → QA Context Feed validée.");
  } else if (summary.verdict === "pending") {
    lines.push("  → Prêt pour vérification manuelle. Suivre les étapes dans l'ordre.");
  }
  return lines.join("\n");
}
