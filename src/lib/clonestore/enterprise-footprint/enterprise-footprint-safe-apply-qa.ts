// src/lib/clonestore/enterprise-footprint/enterprise-footprint-safe-apply-qa.ts
// PHASE 3.14 — Enterprise Footprint Safe Apply — QA Module
//
// Module pur — aucun appel réseau, aucun Supabase, aucun write, aucun import Pierre.

export type EnterpriseFootprintSafeApplyQaStepId =
  | "sql_draft_exists"
  | "sql_not_auto_applied"
  | "feature_flag_default_false"
  | "route_get_readonly"
  | "route_post_feature_flagged"
  | "route_auth_required"
  | "no_service_role"
  | "runtime_localstorage_first"
  | "runtime_health_check_before_write"
  | "runtime_no_write_when_flag_false"
  | "runtime_no_write_when_auth_missing"
  | "runtime_no_write_when_validation_fails"
  | "runtime_fallback_on_table_missing"
  | "profile_onboarding_uses_safe_runtime"
  | "profile_agents_no_server_write"
  | "pierre_setup_no_server_write"
  | "pierre_use_no_server_write"
  | "localstorage_fallback_preserved"
  | "rollback_supported"
  | "public_launch_external_not_validated";

export type EnterpriseFootprintSafeApplyQaStepStatus =
  | "pending" | "passed" | "failed" | "skipped";

export type EnterpriseFootprintSafeApplyQaStep = {
  id: EnterpriseFootprintSafeApplyQaStepId;
  label: string;
  description: string;
  severity: "blocking" | "warning" | "info";
  status: EnterpriseFootprintSafeApplyQaStepStatus;
  how_to_verify: string;
  expected_result: string;
};

export type EnterpriseFootprintSafeApplyQaVerdict =
  | "ready_for_qa" | "blocked" | "passed" | "needs_review";

export type EnterpriseFootprintSafeApplyQaChecklist = {
  steps: EnterpriseFootprintSafeApplyQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "3.14";
};

export type EnterpriseFootprintSafeApplyQaSummary = {
  verdict: EnterpriseFootprintSafeApplyQaVerdict;
  blocking_steps: EnterpriseFootprintSafeApplyQaStepId[];
  passed_steps: EnterpriseFootprintSafeApplyQaStepId[];
  pending_steps: EnterpriseFootprintSafeApplyQaStepId[];
  message: string;
  qa_safe: boolean;
};

export function buildEnterpriseFootprintSafeApplyQaChecklist(): EnterpriseFootprintSafeApplyQaChecklist {
  const steps: EnterpriseFootprintSafeApplyQaStep[] = [
    {
      id: "sql_draft_exists",
      label: "SQL draft PHASE_3_13 existe",
      description: "Le fichier SQL draft de la table est présent dans supabase/sql/.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier supabase/sql/PHASE_3_13_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE.sql",
      expected_result: "Fichier SQL présent avec table + RLS + policies.",
    },
    {
      id: "sql_not_auto_applied",
      label: "SQL non appliqué automatiquement",
      description: "Aucun code n'applique le SQL automatiquement.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier l'absence d'appels supabase.rpc() ou migrate() dans le code.",
      expected_result: "SQL appliqué uniquement manuellement par l'opérateur.",
    },
    {
      id: "feature_flag_default_false",
      label: "Feature flag default false",
      description: "NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED = false par défaut.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier enterprise-footprint-server-flags.ts.",
      expected_result: "Flag retourne false sans env var définie.",
    },
    {
      id: "route_get_readonly",
      label: "Route GET lecture seule",
      description: "GET /api/profile/enterprise-footprint ne fait aucun write.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier route.ts : pas d'insert/update/delete/upsert dans GET.",
      expected_result: "GET retourne le latest footprint sans write.",
    },
    {
      id: "route_post_feature_flagged",
      label: "Route POST feature-flaggée",
      description: "POST vérifie isEnterpriseFootprintServerPersistenceEnabled() avant write.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier route.ts : retourne 423 si flag false.",
      expected_result: "POST retourne 423/403 si flag false.",
    },
    {
      id: "route_auth_required",
      label: "Route auth obligatoire",
      description: "GET et POST exigent une session auth valide.",
      severity: "blocking", status: "pending",
      how_to_verify: "Appeler la route sans auth → 401.",
      expected_result: "401 si non authentifié.",
    },
    {
      id: "no_service_role",
      label: "Pas de service role dans la route",
      description: "La route utilise supabaseServer() (anon key + cookies) pas le service role.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier route.ts : pas de SUPABASE_SERVICE_ROLE_KEY.",
      expected_result: "Aucune référence au service role dans la route.",
    },
    {
      id: "runtime_localstorage_first",
      label: "Runtime localStorage FIRST",
      description: "persistEnterpriseFootprintWithFallback sauvegarde localStorage avant server.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier runtime : saveEnterpriseFootprintToLocalStorage appelé avant guards.",
      expected_result: "local_saved = true même si serveur KO.",
    },
    {
      id: "runtime_health_check_before_write",
      label: "Runtime health check avant write",
      description: "checkEnterpriseFootprintServerTableReadiness appelé avant write.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier runtime : health check avant persistEnterpriseFootprintServerSafely.",
      expected_result: "Pas de write si table absente ou RLS KO.",
    },
    {
      id: "runtime_no_write_when_flag_false",
      label: "Pas de write serveur si flag false",
      description: "Runtime retourne local_saved_server_disabled si flag false.",
      severity: "blocking", status: "pending",
      how_to_verify: "Appeler runtime avec flag false → status = local_saved_server_disabled.",
      expected_result: "server_attempted: false, server_synced: false.",
    },
    {
      id: "runtime_no_write_when_auth_missing",
      label: "Pas de write si auth manquant",
      description: "Runtime retourne local_saved_auth_required si userId ou supabase absent.",
      severity: "blocking", status: "pending",
      how_to_verify: "Appeler runtime sans userId → status = local_saved_auth_required.",
      expected_result: "server_attempted: false.",
    },
    {
      id: "runtime_no_write_when_validation_fails",
      label: "Pas de write si validation échoue",
      description: "Runtime retourne local_saved_validation_failed si payload invalide.",
      severity: "blocking", status: "pending",
      how_to_verify: "Appeler runtime avec payload invalide → status = local_saved_validation_failed.",
      expected_result: "server_attempted: false.",
    },
    {
      id: "runtime_fallback_on_table_missing",
      label: "Fallback si table absente",
      description: "Runtime retourne local_saved_table_unavailable si table SQL absente.",
      severity: "blocking", status: "pending",
      how_to_verify: "Appeler runtime avec table absente → status = local_saved_table_unavailable.",
      expected_result: "local_saved: true, server_synced: false.",
    },
    {
      id: "profile_onboarding_uses_safe_runtime",
      label: "/profile/onboarding utilise le safe runtime",
      description: "La page onboarding utilise persistEnterpriseFootprintWithFallback.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier import persistEnterpriseFootprintWithFallback dans onboarding/page.tsx.",
      expected_result: "Import présent et utilisé à la place du simple saveEnterpriseFootprintToLocalStorage.",
    },
    {
      id: "profile_agents_no_server_write",
      label: "/profile/agents pas de write serveur",
      description: "/profile/agents ne fait pas d'appel write enterprise-footprint.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier /profile/agents/page.tsx : pas de persist/upsert footprint.",
      expected_result: "Aucun write enterprise-footprint dans /profile/agents.",
    },
    {
      id: "pierre_setup_no_server_write",
      label: "/agents/pierre/setup pas de write serveur",
      description: "/agents/pierre/setup ne fait pas d'appel write enterprise-footprint.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier page.tsx : pas de persist enterprise-footprint.",
      expected_result: "Aucun write enterprise-footprint dans Pierre Setup.",
    },
    {
      id: "pierre_use_no_server_write",
      label: "/agents/pierre/use pas de write serveur",
      description: "/agents/pierre/use ne fait pas d'appel write enterprise-footprint.",
      severity: "blocking", status: "pending",
      how_to_verify: "Vérifier page.tsx : pas de persist enterprise-footprint.",
      expected_result: "Aucun write enterprise-footprint dans Pierre Use.",
    },
    {
      id: "localstorage_fallback_preserved",
      label: "Fallback localStorage préservé",
      description: "localStorage reste la source de vérité si serveur indisponible.",
      severity: "blocking", status: "pending",
      how_to_verify: "Désactiver le serveur → vérifier que localStorage est utilisé.",
      expected_result: "Données localStorage toujours accessibles.",
    },
    {
      id: "rollback_supported",
      label: "Rollback supporté",
      description: "Si serveur write échoue, localStorage reste intact.",
      severity: "blocking", status: "pending",
      how_to_verify: "Simuler échec serveur → vérifier localStorage non altéré.",
      expected_result: "localStorage intact après tout échec serveur.",
    },
    {
      id: "public_launch_external_not_validated",
      label: "Lancement public externe non validé",
      description: "PHASE 3.14 n'active pas le lancement public externe.",
      severity: "info", status: "pending",
      how_to_verify: "Vérifier go-live-proofs.local.json non modifié.",
      expected_result: "Lancement public externe non validé.",
    },
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "3.14",
  };
}

export function buildEnterpriseFootprintSafeApplyQaVerdict(
  steps: EnterpriseFootprintSafeApplyQaStep[]
): EnterpriseFootprintSafeApplyQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: EnterpriseFootprintSafeApplyQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "passed";
  else if (pending.length === steps.length) verdict = "ready_for_qa";
  else verdict = "needs_review";

  const qaSafe = verdict === "passed" || (verdict === "needs_review" && blockingFailed.length === 0);

  const summary: EnterpriseFootprintSafeApplyQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    qa_safe: qaSafe,
  };
  summary.message = summarizeEnterpriseFootprintSafeApplyQaVerdict(summary);
  return summary;
}

export function getEnterpriseFootprintSafeApplyBlockingSteps(): EnterpriseFootprintSafeApplyQaStep[] {
  return buildEnterpriseFootprintSafeApplyQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeEnterpriseFootprintSafeApplyQaVerdict(
  summary: EnterpriseFootprintSafeApplyQaSummary
): string {
  const lines = [
    `[QA PHASE 3.14 Safe Apply] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Étapes réussies : ${summary.passed_steps.length}`,
    `  Étapes en attente : ${summary.pending_steps.length}`,
    `  Étapes bloquantes échouées : ${summary.blocking_steps.length}`,
  ];
  if (summary.verdict === "passed") lines.push("  → QA Safe Apply validée.");
  else if (summary.verdict === "ready_for_qa") lines.push("  → Prêt pour QA manuelle.");
  return lines.join("\n");
}
