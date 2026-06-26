// src/lib/clonestore/runtime-integration/runtime-mission-draft-qa.ts
// PHASE 4.3 — Runtime Mission Draft — QA Module
//
// Module pur. Pas de Supabase, pas d'API, pas de write, pas d'import Pierre.

export type RuntimeMissionDraftQaStepId =
  | "mission_draft_types_exist"
  | "mission_draft_builder_exists"
  | "mission_draft_validation_exists"
  | "mission_draft_snapshot_exists"
  | "mission_draft_from_runtime_result"
  | "pierre_route_creates_pierre_draft"
  | "unsupported_route_creates_unsupported_draft"
  | "blocked_guard_creates_blocked_draft"
  | "human_validation_creates_awaiting_validation"
  | "cloneguard_snapshot_required"
  | "clonetrace_snapshot_required"
  | "idempotency_required"
  | "queue_hints_preserved"
  | "cost_hints_preserved"
  | "draft_read_only"
  | "draft_plan_only"
  | "draft_execution_disabled"
  | "draft_db_write_disabled"
  | "draft_no_pierre_engine_call"
  | "draft_no_ai_call"
  | "draft_no_email_or_document"
  | "profile_messages_draft_preview_visible"
  | "preview_created_by_click_only"
  | "no_api_route_created_for_draft_execution"
  | "no_supabase_import"
  | "no_pierre_engine_import"
  | "no_cloneos_execution"
  | "no_clonevoice_activation"
  | "scale_80k_not_proven_visible"
  | "public_launch_external_not_validated";

export type RuntimeMissionDraftQaStepStatus = "pending" | "passed" | "failed" | "skipped";
export type RuntimeMissionDraftQaStepSeverity = "blocking" | "warning" | "info";

export type RuntimeMissionDraftQaStep = {
  id: RuntimeMissionDraftQaStepId;
  label: string;
  severity: RuntimeMissionDraftQaStepSeverity;
  status: RuntimeMissionDraftQaStepStatus;
  expected_result: string;
};

export type RuntimeMissionDraftQaChecklist = {
  steps: RuntimeMissionDraftQaStep[];
  total: number;
  blocking_count: number;
  generated_at: string;
  phase: "4.3";
};

export type RuntimeMissionDraftQaVerdict = "ready" | "blocked" | "needs_review" | "pending";

export type RuntimeMissionDraftQaSummary = {
  verdict: RuntimeMissionDraftQaVerdict;
  blocking_steps: RuntimeMissionDraftQaStepId[];
  passed_steps: RuntimeMissionDraftQaStepId[];
  pending_steps: RuntimeMissionDraftQaStepId[];
  message: string;
  safe_to_advance: boolean;
};

export function buildRuntimeMissionDraftQaChecklist(): RuntimeMissionDraftQaChecklist {
  const mk = (
    id: RuntimeMissionDraftQaStepId,
    label: string,
    severity: RuntimeMissionDraftQaStepSeverity,
    expected_result: string
  ): RuntimeMissionDraftQaStep => ({ id, label, severity, status: "pending", expected_result });

  const steps: RuntimeMissionDraftQaStep[] = [
    mk("mission_draft_types_exist", "Types mission draft présents", "blocking", "types présents."),
    mk("mission_draft_builder_exists", "Builder présent", "blocking", "builder présent."),
    mk("mission_draft_validation_exists", "Validation présente", "blocking", "validation présente."),
    mk("mission_draft_snapshot_exists", "Snapshot présent", "blocking", "snapshot présent."),
    mk("mission_draft_from_runtime_result", "Draft depuis runtime result", "blocking", "builder depuis RuntimeIntegrationReadResult."),
    mk("pierre_route_creates_pierre_draft", "Route Pierre → pierre_mission_draft", "blocking", "kind pierre_mission_draft."),
    mk("unsupported_route_creates_unsupported_draft", "Route absente → unsupported_domain_draft", "blocking", "kind unsupported_domain_draft."),
    mk("blocked_guard_creates_blocked_draft", "Guard block → blocked_draft", "blocking", "kind blocked_draft + status blocked."),
    mk("human_validation_creates_awaiting_validation", "Validation → awaiting_validation", "blocking", "status awaiting_validation."),
    mk("cloneguard_snapshot_required", "CloneGuard snapshot requis", "blocking", "guard_snapshot.cloneguard_required true."),
    mk("clonetrace_snapshot_required", "CloneTrace snapshot requis", "blocking", "trace_snapshot.clonetrace_required true."),
    mk("idempotency_required", "Idempotency requise", "blocking", "idempotency.required true."),
    mk("queue_hints_preserved", "Queue hints préservés", "warning", "queue_snapshot présent."),
    mk("cost_hints_preserved", "Cost hints préservés", "warning", "cost_snapshot présent."),
    mk("draft_read_only", "Draft read-only", "blocking", "read_only true."),
    mk("draft_plan_only", "Draft plan-only", "blocking", "plan_only true."),
    mk("draft_execution_disabled", "Exécution désactivée", "blocking", "execution_enabled false."),
    mk("draft_db_write_disabled", "Write DB désactivé", "blocking", "db_write_enabled false."),
    mk("draft_no_pierre_engine_call", "Aucun appel moteur Pierre", "blocking", "pierre_engine_called false."),
    mk("draft_no_ai_call", "Aucun appel IA", "blocking", "ai_call_performed false."),
    mk("draft_no_email_or_document", "Aucun email/document", "blocking", "email_sent/document_generated false."),
    mk("profile_messages_draft_preview_visible", "Aperçu draft visible /profile/messages", "blocking", "Panneau brouillon visible."),
    mk("preview_created_by_click_only", "Aperçu créé au clic uniquement", "blocking", "Pas de création auto."),
    mk("no_api_route_created_for_draft_execution", "Aucune route d'exécution draft", "blocking", "Pas de route POST exécution."),
    mk("no_supabase_import", "Aucun import Supabase", "blocking", "Pas de @supabase/supabase-js."),
    mk("no_pierre_engine_import", "Aucun import moteur Pierre", "blocking", "Pas de @/lib/pierre."),
    mk("no_cloneos_execution", "Aucune exécution CloneOS", "blocking", "Aucune exécution."),
    mk("no_clonevoice_activation", "Aucune activation CloneVoice", "blocking", "CloneVoice non actif."),
    mk("scale_80k_not_proven_visible", "Scale 80k non prouvé visible", "info", "Badge 'Scale 80k non prouvé'."),
    mk("public_launch_external_not_validated", "Lancement public externe non validé", "info", "Aucune claim de lancement public externe."),
  ];

  return {
    steps,
    total: steps.length,
    blocking_count: steps.filter((s) => s.severity === "blocking").length,
    generated_at: new Date().toISOString(),
    phase: "4.3",
  };
}

export function buildRuntimeMissionDraftQaVerdict(
  steps: RuntimeMissionDraftQaStep[]
): RuntimeMissionDraftQaSummary {
  const blockingFailed = steps.filter((s) => s.severity === "blocking" && s.status === "failed");
  const passed = steps.filter((s) => s.status === "passed");
  const pending = steps.filter((s) => s.status === "pending" || s.status === "skipped");

  let verdict: RuntimeMissionDraftQaVerdict;
  if (blockingFailed.length > 0) verdict = "blocked";
  else if (pending.length === 0) verdict = "ready";
  else if (pending.length === steps.length) verdict = "pending";
  else verdict = "needs_review";

  const summary: RuntimeMissionDraftQaSummary = {
    verdict,
    blocking_steps: blockingFailed.map((s) => s.id),
    passed_steps: passed.map((s) => s.id),
    pending_steps: pending.map((s) => s.id),
    message: "",
    safe_to_advance: verdict !== "blocked",
  };
  summary.message = summarizeRuntimeMissionDraftQaVerdict(summary);
  return summary;
}

export function getRuntimeMissionDraftBlockingSteps(): RuntimeMissionDraftQaStep[] {
  return buildRuntimeMissionDraftQaChecklist().steps.filter((s) => s.severity === "blocking");
}

export function summarizeRuntimeMissionDraftQaVerdict(
  summary: RuntimeMissionDraftQaSummary
): string {
  return [
    `[QA PHASE 4.3 Mission Draft] Verdict : ${summary.verdict.toUpperCase()}`,
    `  Réussies : ${summary.passed_steps.length} · En attente : ${summary.pending_steps.length}`,
    `  Bloquantes échouées : ${summary.blocking_steps.length}`,
    `  Safe to advance : ${summary.safe_to_advance}`,
    `  Brouillon local — aucune mission créée en base. Scale 80k non prouvé. Lancement public externe : non validé.`,
  ].join("\n");
}
