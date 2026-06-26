// TECH-08 — CloneOS Command Center — Command Guard Integration
// Évalue chaque tâche du plan via CloneGuard (TECH-06).
// Ne bypasse jamais CloneGuard.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  CloneOSMissionPlan,
  CloneOSTaskPlan,
  CloneOSCommandContext,
  CloneOSCommandGuardResult,
  CloneOSTaskGuardResult,
} from "./cloneos-command-types";

// TECH-06 — CloneGuard
import {
  evaluateGlobalGuard,
  buildDefaultGlobalGuardInput,
} from "../guard/global-guard-evaluator";
import type {
  GlobalGuardActionType,
  GlobalGuardRiskLevel,
} from "../guard/global-guard-types";

// ── Mapping CloneOS → CloneGuard ──────────────────────────────────────────────

const RISK_LEVEL_MAP: Record<string, GlobalGuardRiskLevel> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

const ACTION_TYPE_MAP: Record<string, GlobalGuardActionType> = {
  read_context: "read_context",
  draft_document: "draft_document",
  draft_email: "draft_email",
  send_email: "send_email",
  create_task: "create_task",
  update_memory: "update_memory",
  modify_record: "modify_record",
  export_data: "export_data",
  legal_decision: "legal_decision",
  payroll_execution: "payroll_execution",
  termination_decision: "termination_decision",
  contract_signature: "contract_signature",
  external_api_call: "external_api_call",
  delete_data: "delete_data",
  custom: "custom",
};

function toGuardActionType(actionType: string): GlobalGuardActionType {
  return ACTION_TYPE_MAP[actionType] ?? "custom";
}

function toGuardRiskLevel(risk: string): GlobalGuardRiskLevel {
  return RISK_LEVEL_MAP[risk] ?? "medium";
}

// ── Builder input Guard depuis tâche ─────────────────────────────────────────

export function buildGuardInputFromCloneOSTask(
  task: CloneOSTaskPlan,
  context: CloneOSCommandContext,
) {
  return buildDefaultGlobalGuardInput({
    action_type: toGuardActionType(task.action_type),
    risk_level: toGuardRiskLevel(task.risk_level),
    company_id: context.company_id,
    employee_slug: context.selected_employee_slug ?? "unknown",
  });
}

// ── Évaluation d'une tâche ────────────────────────────────────────────────────

export function evaluateCloneOSTaskWithGuard(
  task: CloneOSTaskPlan,
  context: CloneOSCommandContext,
): CloneOSTaskGuardResult {
  const guardInput = buildGuardInputFromCloneOSTask(task, context);
  const guardResult = evaluateGlobalGuard(guardInput);

  const notes: string[] = [];
  if (guardResult.matched_rules.length > 0) {
    notes.push(`Règles applicables : ${guardResult.matched_rules.join(", ")}`);
  }
  if (guardResult.decision === "refuse") {
    notes.push("Action refusée — invariant absolu CloneGuard.");
  }
  if (guardResult.decision === "block") {
    notes.push("Action bloquée — politique CloneGuard.");
  }

  return {
    task_id: task.task_id,
    action_type: task.action_type,
    decision: guardResult.decision,
    rule_ids_matched: guardResult.matched_rules,
    requires_human_validation: guardResult.human_validation_required,
    can_execute: guardResult.can_execute,
    notes,
  };
}

// ── Agrégation des résultats ──────────────────────────────────────────────────

/**
 * Agrège les résultats Guard de toutes les tâches en une décision globale.
 * La décision la plus restrictive l'emporte.
 */
export function aggregateGuardResults(
  taskResults: CloneOSTaskGuardResult[],
): CloneOSCommandGuardResult["overall_decision"] {
  const hasRefused = taskResults.some((r) => r.decision === "refuse");
  const hasBlocked = taskResults.some((r) => r.decision === "block");
  const hasValidation = taskResults.some((r) => r.decision === "require_validation");
  const hasPrepareOnly = taskResults.some((r) => r.decision === "prepare_only");

  if (hasRefused) return "refused";
  if (hasBlocked) return "block";
  if (hasValidation) return "require_validation";
  if (hasPrepareOnly) return "prepare_only";
  return "allow";
}

// ── Évaluation du plan complet ────────────────────────────────────────────────

export function evaluateCloneOSCommandPlanWithGuard(
  plan: CloneOSMissionPlan,
  context: CloneOSCommandContext,
): CloneOSCommandGuardResult {
  const taskResults: CloneOSTaskGuardResult[] = plan.tasks.map((task) =>
    evaluateCloneOSTaskWithGuard(task, context),
  );

  const overallDecision = aggregateGuardResults(taskResults);

  const hasBlocked = taskResults.some((r) => r.decision === "block");
  const hasRefused = taskResults.some((r) => r.decision === "refuse");
  const hasValidation = taskResults.some((r) => r.decision === "require_validation");
  const criticalCount = taskResults.filter((r) =>
    r.decision === "block" || r.decision === "refuse",
  ).length;

  return {
    overall_decision: overallDecision,
    task_results: taskResults,
    has_blocked_tasks: hasBlocked,
    has_refused_tasks: hasRefused,
    has_validation_required_tasks: hasValidation,
    critical_action_count: criticalCount,
    evaluated_at: new Date().toISOString(),
  };
}

/**
 * Applique la décision Guard au plan pour ajuster les tâches.
 * Retourne le plan mis à jour.
 */
export function applyGuardDecisionToPlan(
  plan: CloneOSMissionPlan,
  guardResult: CloneOSCommandGuardResult,
): CloneOSMissionPlan {
  const updatedTasks: CloneOSTaskPlan[] = plan.tasks.map((task) => {
    const taskGuard = guardResult.task_results.find((r) => r.task_id === task.task_id);
    if (!taskGuard) return task;

    return {
      ...task,
      requires_validation: taskGuard.requires_human_validation || task.requires_validation,
      can_auto_execute: taskGuard.can_execute && !taskGuard.requires_human_validation,
    };
  });

  const planNotes = [...plan.plan_notes];
  if (guardResult.has_refused_tasks) {
    planNotes.push("GUARD : Certaines actions ont été refusées — invariants absolus.");
  }
  if (guardResult.has_blocked_tasks) {
    planNotes.push("GUARD : Certaines actions ont été bloquées par politique.");
  }
  if (guardResult.has_validation_required_tasks) {
    planNotes.push("GUARD : Validation humaine requise avant exécution.");
  }

  return {
    ...plan,
    tasks: updatedTasks,
    validation_required: plan.validation_required || guardResult.has_validation_required_tasks,
    plan_notes: planNotes,
  };
}
