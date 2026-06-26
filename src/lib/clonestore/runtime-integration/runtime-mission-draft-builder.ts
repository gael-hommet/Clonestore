// src/lib/clonestore/runtime-integration/runtime-mission-draft-builder.ts
// PHASE 4.3 — Runtime Mission Draft — Builder
//
// Construit un brouillon de mission LOCAL/IN-MEMORY depuis un RuntimeIntegrationReadResult.
// Aucune mission créée en base. Aucun fetch. Aucun Supabase. Aucun moteur Pierre.

import type { RuntimeIntegrationReadResult } from "./runtime-integration-types";
import type {
  RuntimeMissionDraft,
  RuntimeMissionDraftKind,
  RuntimeMissionDraftStatus,
  RuntimeMissionDraftSource,
  RuntimeMissionDraftStep,
  RuntimeMissionDraftValidationRequirement,
  RuntimeMissionDraftGuardSnapshot,
  RuntimeMissionDraftTraceSnapshot,
  RuntimeMissionDraftScaleSnapshot,
  RuntimeMissionDraftQueueSnapshot,
  RuntimeMissionDraftCostSnapshot,
  RuntimeMissionDraftIdempotencySnapshot,
  RuntimeMissionDraftRiskLevel,
  RuntimeMissionDraftValidationMode,
  RuntimeMissionDraftIssue,
  RuntimeMissionDraftRecommendation,
  RuntimeMissionDraftAction,
} from "./runtime-mission-draft-types";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeMissionDraftBuildOptions = {
  source?: RuntimeMissionDraftSource;
  title_override?: string;
  company_id?: string;
  user_id?: string;
};

// ── Kind / status ─────────────────────────────────────────────────────────────

export function deriveRuntimeMissionDraftKind(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftKind {
  if (result.plan.guard_decision.decision === "block") return "blocked_draft";
  if (!result.route.employee_key) return "unsupported_domain_draft";
  return "pierre_mission_draft";
}

export function deriveRuntimeMissionDraftStatus(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftStatus {
  if (result.plan.guard_decision.decision === "block" || result.plan.status === "blocked") return "blocked";
  if (!result.route.employee_key || result.plan.status === "simulated_only") return "simulated_only";
  if (result.plan.guard_decision.human_validation_required || result.plan.status === "awaiting_validation") {
    return "awaiting_validation";
  }
  return "ready_for_review";
}

// ── Title / objective / summary ───────────────────────────────────────────────

export function buildRuntimeMissionDraftTitle(result: RuntimeIntegrationReadResult): string {
  const kind = deriveRuntimeMissionDraftKind(result);
  if (kind === "blocked_draft") return "Brouillon bloqué par CloneGuard";
  if (kind === "unsupported_domain_draft") return "Mission non supportée · Simulation uniquement";
  return "Pierre · Brouillon de mission RH";
}

export function buildRuntimeMissionDraftObjective(result: RuntimeIntegrationReadResult): string {
  const text = result.intent.normalized_text || result.command.raw_text || "Demande non précisée";
  return `Objectif (plan-only) : ${text}. Brouillon local — aucune exécution, aucune mission créée en base.`;
}

export function buildRuntimeMissionDraftSummary(result: RuntimeIntegrationReadResult): string {
  const route = result.route.employee_key ?? "aucun employé actif";
  return [
    `Routage : ${route} · Domaine : ${result.intent.domain} · Risque : ${result.intent.risk_level}.`,
    `Validation : ${result.intent.validation_mode} · ${result.plan.steps.length} étape(s).`,
    "CloneGuard et CloneTrace obligatoires.",
    "Brouillon in-memory — aucun write DB, aucun appel Pierre, aucun appel IA.",
  ].join(" ");
}

// ── Steps ─────────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftSteps(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftStep[] {
  return result.plan.steps.map((s, i) => ({
    draft_step_id: `draftstep_${i}_${s.step_id}`,
    label: s.label,
    description: s.description,
    source_plan_step_id: s.step_id,
    function_key: s.function_key,
    capability_key: s.capability_key,
    risk_level: s.risk_level as RuntimeMissionDraftRiskLevel,
    validation_mode: s.validation_mode as RuntimeMissionDraftValidationMode,
    requires_human_validation: s.requires_human_validation,
    status: s.status as RuntimeMissionDraftStatus,
    plan_only: true,
    execution_enabled: false,
    read_only: true,
  }));
}

// ── Validation requirements ───────────────────────────────────────────────────

export function buildRuntimeMissionDraftValidationRequirements(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftValidationRequirement[] {
  const reqs: RuntimeMissionDraftValidationRequirement[] = [];
  const guard = result.plan.guard_decision;

  if (guard.decision === "block") {
    reqs.push({
      requirement_id: "req_human_decision_exclusive",
      label: "Décision humaine exclusive",
      reason: "Action finale (juridique/disciplinaire) — décision humaine exclusive requise.",
      risk_level: "blocked",
      required_approver_role: "legal_or_hr_director",
      blocks_execution: true,
    });
  } else if (guard.human_validation_required) {
    reqs.push({
      requirement_id: "req_human_validation",
      label: "Validation humaine requise",
      reason: "Sujet sensible — validation humaine requise via CloneGuard avant toute exécution future.",
      risk_level: result.intent.risk_level === "sensitive" ? "sensitive" : "high",
      required_approver_role: "hr_manager",
      blocks_execution: false,
    });
  }

  return reqs;
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftGuardSnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftGuardSnapshot {
  const g = result.plan.guard_decision;
  return {
    decision: g.decision,
    risk_level: g.risk_level as RuntimeMissionDraftRiskLevel,
    reasons: g.reasons,
    sensitive_topics: g.sensitive_topics,
    cloneguard_required: true,
    human_validation_required: g.human_validation_required,
    bypass_allowed: false,
  };
}

export function buildRuntimeMissionDraftTraceSnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftTraceSnapshot {
  const t = result.plan.trace_contract;
  return {
    trace_id: t.trace_id,
    clonetrace_required: true,
    server_write_enabled: false,
    contains_personal_data: t.contains_personal_data,
    events: t.events.map((e) => e.event_key),
    final_event: "execution_not_started",
  };
}

export function buildRuntimeMissionDraftScaleSnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftScaleSnapshot {
  const s = result.plan.scale_hints;
  return {
    stateless_runtime_required: true,
    tenant_scoped_by: "user_id_and_company_id",
    idempotency_key_required: true,
    rate_limit_required: s.rate_limit_required,
    load_test_required: s.load_test_required,
    scale_80k_not_proven: true,
  };
}

export function buildRuntimeMissionDraftQueueSnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftQueueSnapshot {
  const q = result.plan.queue_hints;
  return {
    queue_name: q.queue_name,
    priority: q.priority,
    retry_count_recommended: q.retry_count_recommended,
    dead_letter_on_failure: true,
  };
}

export function buildRuntimeMissionDraftCostSnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftCostSnapshot {
  const c = result.plan.cost_hints;
  return {
    orchestration_model_tier: "cheap_or_standard",
    premium_model_only_for: c.premium_model_only_for,
    avoid_premium_model_for: c.avoid_premium_model_for,
    token_budget_required: true,
  };
}

export function buildRuntimeMissionDraftIdempotencySnapshot(
  result: RuntimeIntegrationReadResult
): RuntimeMissionDraftIdempotencySnapshot {
  const idem = result.plan.idempotency;
  return {
    idempotency_key: idem.idempotency_key,
    derived_from: idem.derived_from,
    required: true,
  };
}

// ── Issues / recommendations / actions ────────────────────────────────────────

export function buildRuntimeMissionDraftIssues(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftIssue[] {
  const issues: RuntimeMissionDraftIssue[] = [];
  if (draft.kind === "blocked_draft") {
    issues.push({ code: "draft_blocked", message: "Brouillon bloqué par CloneGuard — action finale.", severity: "blocking" });
  }
  if (draft.kind === "unsupported_domain_draft") {
    issues.push({ code: "draft_unsupported", message: "Aucun employé IA actif pour ce domaine.", severity: "warning" });
  }
  if (draft.status === "awaiting_validation") {
    issues.push({ code: "draft_awaiting_validation", message: "Validation humaine requise avant toute exécution future.", severity: "warning" });
  }
  if (draft.missing_context.length > 0) {
    issues.push({ code: "draft_missing_context", message: `Contexte manquant : ${draft.missing_context.join(", ")}.`, severity: "info" });
  }
  return issues;
}

export function buildRuntimeMissionDraftRecommendations(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftRecommendation[] {
  const recs: RuntimeMissionDraftRecommendation[] = [];
  if (draft.kind === "unsupported_domain_draft") {
    recs.push({ id: "rec-domain", text: "Pierre couvre le RH en V1 — reformuler une demande RH.", href: "/profile/agents", action_label: "Mon espace" });
  }
  if (draft.status === "awaiting_validation") {
    recs.push({ id: "rec-validation", text: "Validation humaine requise — préparer un approbateur.", href: "/profile/onboarding", action_label: "Onboarding" });
  }
  recs.push({ id: "rec-local", text: "Brouillon local — aucune mission créée en base. Persistance gouvernée en Phase 4.4.", href: "/profile/messages", action_label: "Messages" });
  return recs;
}

export function buildRuntimeMissionDraftActions(
  draft: RuntimeMissionDraft
): RuntimeMissionDraftAction[] {
  void draft;
  return [
    { id: "go-messages", label: "Messages", href: "/profile/messages", primary: true },
    { id: "go-agents", label: "Mon espace", href: "/profile/agents", primary: false },
    { id: "go-onboarding", label: "Onboarding", href: "/profile/onboarding", primary: false },
    { id: "go-pierre-use", label: "Cockpit Pierre", href: "/agents/pierre/use", primary: false },
  ];
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildRuntimeMissionDraftFromIntegrationResult(
  result: RuntimeIntegrationReadResult,
  options?: RuntimeMissionDraftBuildOptions
): RuntimeMissionDraft {
  const now = new Date().toISOString();
  const kind = deriveRuntimeMissionDraftKind(result);
  const status = deriveRuntimeMissionDraftStatus(result);

  const blockedReasons =
    result.plan.guard_decision.decision === "block"
      ? result.plan.guard_decision.reasons
      : [];

  const baseDraft: RuntimeMissionDraft = {
    draft_id: `rtdraft_${result.command.command_id}`,
    kind,
    source: options?.source ?? "command_center_preview",
    status,
    title: options?.title_override ?? buildRuntimeMissionDraftTitle(result),
    objective: buildRuntimeMissionDraftObjective(result),
    summary: buildRuntimeMissionDraftSummary(result),
    employee_key: result.route.employee_key,
    command_id: result.command.command_id,
    intent_id: result.intent.intent_id,
    route_id: result.route.route_id,
    plan_id: result.plan.plan_id,
    company_id: options?.company_id ?? result.command.company_id,
    user_id: options?.user_id ?? result.command.user_id,
    domain: result.intent.domain,
    risk_level: result.intent.risk_level as RuntimeMissionDraftRiskLevel,
    validation_mode: result.intent.validation_mode as RuntimeMissionDraftValidationMode,
    steps: buildRuntimeMissionDraftSteps(result),
    validation_requirements: buildRuntimeMissionDraftValidationRequirements(result),
    missing_context: [...result.intent.missing_context],
    blocked_reasons: blockedReasons,
    guard_snapshot: buildRuntimeMissionDraftGuardSnapshot(result),
    trace_snapshot: buildRuntimeMissionDraftTraceSnapshot(result),
    scale_snapshot: buildRuntimeMissionDraftScaleSnapshot(result),
    queue_snapshot: buildRuntimeMissionDraftQueueSnapshot(result),
    cost_snapshot: buildRuntimeMissionDraftCostSnapshot(result),
    idempotency: buildRuntimeMissionDraftIdempotencySnapshot(result),
    recommendations: [],
    issues: [],
    actions: [],
    created_at: now,
    updated_at: now,
    read_only: true,
    plan_only: true,
    execution_enabled: false,
    db_write_enabled: false,
    api_execution_enabled: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
  };

  baseDraft.issues = buildRuntimeMissionDraftIssues(baseDraft);
  baseDraft.recommendations = buildRuntimeMissionDraftRecommendations(baseDraft);
  baseDraft.actions = buildRuntimeMissionDraftActions(baseDraft);
  return baseDraft;
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeMissionDraft(draft: RuntimeMissionDraft): string {
  return [
    `[Mission Draft] ${draft.title} · ${draft.status}`,
    `  Kind : ${draft.kind} · Employé : ${draft.employee_key ?? "aucun"}`,
    `  Étapes : ${draft.steps.length} · Validations : ${draft.validation_requirements.length}`,
    `  CloneGuard : ${draft.guard_snapshot.decision} · CloneTrace requis : ${draft.trace_snapshot.clonetrace_required}`,
    `  Idempotency : ${draft.idempotency.required} · Brouillon local — aucune mission créée en base.`,
    `  execution_enabled : ${draft.execution_enabled} · Scale 80k non prouvé.`,
  ].join("\n");
}
