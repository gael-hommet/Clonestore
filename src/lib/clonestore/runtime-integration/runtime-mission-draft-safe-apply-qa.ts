// src/lib/clonestore/runtime-integration/runtime-mission-draft-safe-apply-qa.ts
// PHASE 4.5 — Runtime Mission Draft Safe Apply — QA Module
//
// Module pur. Pas de Supabase, pas d'API, pas de write, pas d'import Pierre.

export type RuntimeMissionDraftSafeApplyQaStepId =
  | "localstorage_runtime_exists"
  | "safe_apply_types_exist"
  | "server_api_contract_exists"
  | "server_route_exists"
  | "server_route_get_capabilities"
  | "server_route_post_feature_flagged"
  | "server_route_returns_423_when_disabled"
  | "api_client_exists"
  | "safe_apply_runtime_exists"
  | "ui_status_model_exists"
  | "localstorage_first"
  | "local_saved_before_server_attempt"
  | "server_disabled_fallback_local"
  | "restore_local_available"
  | "no_execution_flags_preserved"
  | "no_mission_created"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "no_openai_call"
  | "no_email_or_document"
  | "profile_messages_save_button_visible"
  | "profile_messages_safe_apply_status_visible"
  | "no_auto_persist_on_mount"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeMissionDraftSafeApplyQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type RuntimeMissionDraftSafeApplyQaStepSeverity = "blocking" | "warning" | "info";

export type RuntimeMissionDraftSafeApplyQaStep = {
  id: RuntimeMissionDraftSafeApplyQaStepId;
  label: string;
  severity: RuntimeMissionDraftSafeApplyQaStepSeverity;
  status: RuntimeMissionDraftSafeApplyQaStepStatus;
  expected_result: string;
};

export type RuntimeMissionDraftSafeApplyQaChecklist = {
  steps: RuntimeMissionDraftSafeApplyQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "4.5";
};

export type RuntimeMissionDraftSafeApplyQaVerdict = "ready" | "blocked" | "needs_review" | "pending";

export type RuntimeMissionDraftSafeApplyQaSummary = {
  verdict: RuntimeMissionDraftSafeApplyQaVerdict;
  blocking_steps: RuntimeMissionDraftSafeApplyQaStepId[];
  passed_steps: RuntimeMissionDraftSafeApplyQaStepId[];
  pending_steps: RuntimeMissionDraftSafeApplyQaStepId[];
  message: string;
  safe_to_advance: boolean;
};

export function buildRuntimeMissionDraftSafeApplyQaChecklist(): RuntimeMissionDraftSafeApplyQaChecklist {
  const mk = (
    id: RuntimeMissionDraftSafeApplyQaStepId,
    label: string,
    severity: RuntimeMissionDraftSafeApplyQaStepSeverity,
    expected_result: string
  ): RuntimeMissionDraftSafeApplyQaStep => ({ id, label, severity, status: "pending", expected_result });

  const steps: RuntimeMissionDraftSafeApplyQaStep[] = [
    mk("localstorage_runtime_exists", "LocalStorage runtime présent", "blocking", "localstorage.ts présent."),
    mk("safe_apply_types_exist", "Safe apply types présents", "blocking", "safe-apply-types.ts présent."),
    mk("server_api_contract_exists", "Server API contract présent", "blocking", "server-api-contract.ts présent."),
    mk("server_route_exists", "Route serveur présente", "blocking", "mission-drafts/route.ts présent."),
    mk("server_route_get_capabilities", "GET capabilities", "blocking", "GET retourne capabilities."),
    mk("server_route_post_feature_flagged", "POST feature-flaggé", "blocking", "POST gated par flag."),
    mk("server_route_returns_423_when_disabled", "POST 423 si flag false", "blocking", "423 quand désactivé."),
    mk("api_client_exists", "API client présent", "blocking", "api-client.ts présent."),
    mk("safe_apply_runtime_exists", "Safe apply runtime présent", "blocking", "safe-apply.ts présent."),
    mk("ui_status_model_exists", "UI status model présent", "blocking", "safe-apply-ui.ts présent."),
    mk("localstorage_first", "localStorage-first", "blocking", "localStorage sauvegardé en premier."),
    mk("local_saved_before_server_attempt", "Local avant serveur", "blocking", "save local avant tentative serveur."),
    mk("server_disabled_fallback_local", "Fallback local si serveur désactivé", "blocking", "local_saved_server_disabled."),
    mk("restore_local_available", "Restore local disponible", "blocking", "restore depuis localStorage."),
    mk("no_execution_flags_preserved", "Flags no-execution préservés", "blocking", "execution_started/mission_created false."),
    mk("no_mission_created", "Aucune mission créée", "blocking", "mission_created false."),
    mk("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking", "Pas de @/lib/pierre."),
    mk("no_cloneos_execution", "Aucune exécution CloneOS", "blocking", "Aucune exécution."),
    mk("no_clonevoice_activation", "Aucune activation CloneVoice", "blocking", "CloneVoice non actif."),
    mk("no_openai_call", "Aucun appel OpenAI", "blocking", "Aucun appel IA."),
    mk("no_email_or_document", "Aucun email/document", "blocking", "email_sent/document_generated false."),
    mk("profile_messages_save_button_visible", "Bouton sauvegarde visible", "blocking", "Bouton 'Sauvegarder le brouillon localement'."),
    mk("profile_messages_safe_apply_status_visible", "Statut safe apply visible", "warning", "Badges/cards safe apply."),
    mk("no_auto_persist_on_mount", "Aucune persist auto au mount", "blocking", "Pas de save au montage."),
    mk("scale_80k_not_proven_visible", "Scale 80k non prouvé visible", "info", "Badge 'Scale 80k non prouvé'."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé", "info", "Aucune claim."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "4.5",
  };
}

export function buildRuntimeMissionDraftSafeApplyQaVerdict(
  steps: RuntimeMissionDraftSafeApplyQaStep[]
): RuntimeMissionDraftSafeApplyQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionDraftSafeApplyQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: RuntimeMissionDraftSafeApplyQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_advance: verdict !== "blocked",
  };
  summary.message = summarizeRuntimeMissionDraftSafeApplyQaVerdict(summary);
  return summary;
}

export function getRuntimeMissionDraftSafeApplyBlockingSteps(): RuntimeMissionDraftSafeApplyQaStep[] {
  return buildRuntimeMissionDraftSafeApplyQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeMissionDraftSafeApplyQaVerdict(
  summary: RuntimeMissionDraftSafeApplyQaSummary
): string {
  return [
    `[QA PHASE 4.5 Safe Apply] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Réussies : ${summary.passed_steps.length} · En attente : ${summary.pending_steps.length}`,
    `  Bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to advance : ${summary.safe_to_advance}`,
    `  localStorage-first · serveur flaggé default false · POST 423. Scale 80k non prouvé. Lancement public externe : non validé.`,
  ].join("\n");
}
