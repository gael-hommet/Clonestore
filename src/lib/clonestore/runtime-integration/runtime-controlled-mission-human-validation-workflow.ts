// src/lib/clonestore/runtime-integration/runtime-controlled-mission-human-validation-workflow.ts
// PHASE 4.11 — Controlled Mission Human Validation — Workflow Builder
//
// Module PUR. Construit le workflow de validation humaine et simule des décisions
// EN APERÇU (preview), sans rien appliquer. Ne mute jamais le contrat.
// Pas de base de données. Pas de réseau. Pas de write. Pas d'import Pierre.
//
// INVARIANTS (toujours faux) : approval_applied false · promotion_applied false ·
// controlled_mission_created false · mission_created false · execution_enabled false ·
// execution_started false · db_write_performed false · pierre_engine_called false ·
// ai_call_performed false. "approved_preview" ne crée AUCUNE vraie mission.

import type { RuntimeMissionPromotionContract } from "./runtime-mission-promotion-types";
import type {
  RuntimeControlledMissionHumanValidationWorkflow,
  RuntimeControlledMissionHumanValidationMode,
  RuntimeControlledMissionHumanValidationStatus,
  RuntimeControlledMissionHumanValidationDecision,
  RuntimeControlledMissionHumanValidationDecisionRecord,
  RuntimeControlledMissionHumanValidationTracePreview,
  RuntimeControlledMissionHumanValidationActorRole,
  RuntimeControlledMissionHumanValidationIssue,
} from "./runtime-controlled-mission-human-validation-types";
import { buildRuntimeControlledMissionHumanValidationPolicy } from "./runtime-controlled-mission-human-validation-policy";
import { buildRuntimeControlledMissionHumanValidationGates } from "./runtime-controlled-mission-human-validation-gates";

// ── Options ───────────────────────────────────────────────────────────────────

export type RuntimeControlledMissionHumanValidationWorkflowOptions = {
  now?: string;
  requester_id?: string;
  company_id?: string;
  mode?: RuntimeControlledMissionHumanValidationMode;
};

export type RuntimeControlledMissionHumanValidationDecisionOptions = {
  actor_id?: string;
  note?: string;
  now?: string;
};

// ── Trace preview ─────────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationTracePreview(
  workflow: Pick<RuntimeControlledMissionHumanValidationWorkflow, "workflow_id" | "second_validation_required">
): RuntimeControlledMissionHumanValidationTracePreview {
  const events = [
    "workflow_created",
    "policy_classified",
    "gates_built",
    "validators_required",
    "decision_preview_only",
    "no_execution",
    "promotion_not_applied",
  ];
  if (workflow.second_validation_required) events.push("second_validator_required");
  return {
    trace_id: `hvtrace_${workflow.workflow_id}`,
    clonetrace_required: true,
    server_write_enabled: false,
    events,
    final_event: "execution_not_started",
  };
}

// ── Initial status ────────────────────────────────────────────────────────────

function deriveInitialStatus(
  contract: RuntimeMissionPromotionContract,
  sensitivity: string
): RuntimeControlledMissionHumanValidationStatus {
  if (sensitivity === "blocked" || contract.decision.verdict === "blocked") return "blocked";
  if (contract.decision.verdict === "not_eligible") return "blocked";
  return "awaiting_validator";
}

// ── Workflow builder ──────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationWorkflow(
  contract: RuntimeMissionPromotionContract,
  options?: RuntimeControlledMissionHumanValidationWorkflowOptions
): RuntimeControlledMissionHumanValidationWorkflow {
  const now = options?.now ?? new Date().toISOString();
  const policy = buildRuntimeControlledMissionHumanValidationPolicy(contract);
  const gates = buildRuntimeControlledMissionHumanValidationGates(contract, policy);
  const candidateId = `cand_${contract.promotion_id}`;
  const workflowId = `hvwf_${contract.promotion_id}`;

  const partial = { workflow_id: workflowId, second_validation_required: policy.second_validator_required };

  return {
    workflow_id: workflowId,
    candidate_id: candidateId,
    promotion_id: contract.promotion_id,
    draft_id: contract.draft_id,
    status: deriveInitialStatus(contract, policy.sensitivity),
    mode: options?.mode ?? "design_only",
    risk_level: policy.risk_level,
    sensitivity: policy.sensitivity,
    required_validators: policy.required_validators,
    gates,
    requirements: policy.requirements,
    decisions: [],
    trace_preview: buildRuntimeControlledMissionHumanValidationTracePreview(partial),
    human_validation_required: true,
    second_validation_required: policy.second_validator_required,
    approved_preview: false,
    // ── Invariants littéraux ──────────────────────────────────────────────────
    approval_applied: false,
    promotion_applied: false,
    controlled_mission_created: false,
    mission_created: false,
    execution_enabled: false,
    execution_started: false,
    db_write_performed: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    scale_80k_not_proven: true,
    read_only: true,
    preview_only: true,
    created_at: now,
    updated_at: now,
  };
}

// ── Decision record ───────────────────────────────────────────────────────────

export function buildRuntimeControlledMissionHumanValidationDecisionRecord(
  workflow: RuntimeControlledMissionHumanValidationWorkflow,
  decision: RuntimeControlledMissionHumanValidationDecision,
  options?: RuntimeControlledMissionHumanValidationDecisionOptions & { actor_role?: RuntimeControlledMissionHumanValidationActorRole }
): RuntimeControlledMissionHumanValidationDecisionRecord {
  void workflow;
  return {
    decision,
    actor_role: options?.actor_role ?? "validator",
    actor_id: options?.actor_id ?? null,
    note: options?.note ?? "",
    decided_at: options?.now ?? new Date().toISOString(),
    preview_only: true,
    approval_applied: false,
    execution_started: false,
  };
}

// ── Apply decision (PREVIEW only — n'applique rien) ───────────────────────────

export function applyRuntimeControlledMissionHumanValidationDecisionPreview(
  workflow: RuntimeControlledMissionHumanValidationWorkflow,
  decisionRecord: RuntimeControlledMissionHumanValidationDecisionRecord,
  options?: { now?: string }
): RuntimeControlledMissionHumanValidationWorkflow {
  const now = options?.now ?? decisionRecord.decided_at ?? new Date().toISOString();
  const decisions = [...workflow.decisions, decisionRecord];
  const approvals = decisions.filter((d) => d.decision === "approve_preview").length;

  let status: RuntimeControlledMissionHumanValidationStatus = workflow.status;
  let approvedPreview = workflow.approved_preview;

  switch (decisionRecord.decision) {
    case "approve_preview":
      if (workflow.sensitivity === "blocked") {
        status = "blocked";
        approvedPreview = false;
      } else if (workflow.second_validation_required && approvals < 2) {
        status = "awaiting_second_validator";
        approvedPreview = false;
      } else {
        status = "approved_preview";
        approvedPreview = true;
      }
      break;
    case "request_changes":
      status = "changes_requested";
      approvedPreview = false;
      break;
    case "reject":
      status = "rejected";
      approvedPreview = false;
      break;
    case "block":
      status = "blocked";
      approvedPreview = false;
      break;
    case "escalate":
      status = workflow.sensitivity === "blocked" ? "blocked" : "awaiting_second_validator";
      approvedPreview = false;
      break;
    case "no_decision":
    default:
      status = "awaiting_validator";
      approvedPreview = false;
      break;
  }

  // Reconstruit un workflow immuable — TOUS les flags d'exécution restent false,
  // même en "approved_preview". approval_applied false.
  return {
    ...workflow,
    decisions,
    status,
    approved_preview: approvedPreview,
    approval_applied: false,
    promotion_applied: false,
    controlled_mission_created: false,
    mission_created: false,
    execution_enabled: false,
    execution_started: false,
    db_write_performed: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    read_only: true,
    preview_only: true,
    updated_at: now,
  };
}

// ── Validation / sanitization ─────────────────────────────────────────────────

export function validateRuntimeControlledMissionHumanValidationWorkflow(
  workflow: RuntimeControlledMissionHumanValidationWorkflow
): { valid: boolean; issues: RuntimeControlledMissionHumanValidationIssue[] } {
  const issues: RuntimeControlledMissionHumanValidationIssue[] = [];
  if (!workflow.workflow_id?.trim()) issues.push({ code: "workflow_id_required", message: "workflow_id requis.", severity: "blocking" });
  if (!workflow.promotion_id?.trim()) issues.push({ code: "promotion_id_required", message: "promotion_id requis.", severity: "blocking" });
  if (workflow.human_validation_required !== true) issues.push({ code: "human_validation_required", message: "human_validation_required doit être true.", severity: "blocking" });
  if (workflow.read_only !== true) issues.push({ code: "read_only_required", message: "read_only doit être true.", severity: "blocking" });
  if (workflow.preview_only !== true) issues.push({ code: "preview_only_required", message: "preview_only doit être true.", severity: "blocking" });

  const mustBeFalse: Array<[string, boolean]> = [
    ["approval_applied", workflow.approval_applied],
    ["promotion_applied", workflow.promotion_applied],
    ["controlled_mission_created", workflow.controlled_mission_created],
    ["mission_created", workflow.mission_created],
    ["execution_enabled", workflow.execution_enabled],
    ["execution_started", workflow.execution_started],
    ["db_write_performed", workflow.db_write_performed],
    ["pierre_engine_called", workflow.pierre_engine_called],
    ["ai_call_performed", workflow.ai_call_performed],
    ["email_sent", workflow.email_sent],
    ["message_sent", workflow.message_sent],
    ["document_generated", workflow.document_generated],
    ["clonevoice_active", workflow.clonevoice_active],
    ["public_launch_external_validated", workflow.public_launch_external_validated],
  ];
  for (const [name, value] of mustBeFalse) {
    if (value !== false) {
      issues.push({ code: "no_execution_violation", message: `${name} doit être false.`, severity: "blocking" });
    }
  }
  return { valid: issues.filter((i) => i.severity === "blocking").length === 0, issues };
}

export function sanitizeRuntimeControlledMissionHumanValidationWorkflow(
  workflow: RuntimeControlledMissionHumanValidationWorkflow
): RuntimeControlledMissionHumanValidationWorkflow {
  return {
    ...workflow,
    human_validation_required: true,
    approval_applied: false,
    promotion_applied: false,
    controlled_mission_created: false,
    mission_created: false,
    execution_enabled: false,
    execution_started: false,
    db_write_performed: false,
    pierre_engine_called: false,
    ai_call_performed: false,
    email_sent: false,
    message_sent: false,
    document_generated: false,
    clonevoice_active: false,
    public_launch_external_validated: false,
    scale_80k_not_proven: true,
    read_only: true,
    preview_only: true,
  };
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export function summarizeRuntimeControlledMissionHumanValidationWorkflow(
  workflow: RuntimeControlledMissionHumanValidationWorkflow
): string {
  return [
    `[Human Validation Workflow PHASE 4.11] ${workflow.status} · sensibilité : ${workflow.sensitivity}`,
    `  Validateurs requis : ${workflow.required_validators.filter((v) => v.required).map((v) => v.role).join(", ")}`,
    `  Double validation : ${workflow.second_validation_required} · Décisions : ${workflow.decisions.length}`,
    `  approved_preview : ${workflow.approved_preview} · approval_applied : ${workflow.approval_applied} (toujours false)`,
    `  Aucune mission réelle · Aucune exécution · Aucun appel Pierre · Aucun appel IA.`,
    `  Scale 80k non prouvé · Lancement public externe non validé.`,
  ].join("\n");
}
