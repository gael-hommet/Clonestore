// TECH-06 — CloneGuard + ClonePolicy Global Rules — Guard Evaluator
// Évaluateur de décision guard global.
// Pure functions: no async, no Supabase, no Next.js, no side effects.
//
// Ce module est le point d'entrée principal pour la décision CloneGuard.
// Il agrège le résultat de ClonePolicy et prend la décision finale.

import type {
  GlobalGuardEvaluationInput,
  GlobalGuardEvaluationResult,
  GlobalGuardDecision,
  GlobalGuardExecutionMode,
  GlobalPolicyEvaluationResult,
  GlobalGuardPolicyRule,
  GlobalGuardPolicyEffect,
  GlobalGuardActionType,
  GlobalGuardRiskLevel,
  GlobalGuardValidationRequirement,
} from "./global-guard-types";
import {
  GLOBAL_GUARD_DECISION_RANK,
  GLOBAL_GUARD_RISK_RANK,
  ABSOLUTE_BLOCKED_ACTION_TYPES,
  ALWAYS_VALIDATION_REQUIRED_ACTIONS,
} from "./global-guard-types";
import { evaluateGlobalPolicyRules } from "./global-policy-evaluator";
import { DEFAULT_GLOBAL_POLICY_RULES } from "./global-policy-defaults";

// ── Mapping effet → décision ───────────────────────────────────────────────

/**
 * Mappe un effet de politique vers une décision guard.
 */
export function mapPolicyResultToGuardDecision(
  policyResult: GlobalPolicyEvaluationResult,
): GlobalGuardDecision {
  const effect = policyResult.dominant_effect;

  switch (effect) {
    case "refuse":
      return "refuse";
    case "block":
      return "block";
    case "require_validation":
      return "require_validation";
    case "prepare_only":
      return "prepare_only";
    case "allow_with_warning":
    case "allow":
      // Si validation humaine requise malgré effect=allow → require_validation
      if (policyResult.requires_human_validation && policyResult.has_validation_gate) {
        return "require_validation";
      }
      return "allow";
    default:
      return "allow";
  }
}

// ── Décision pour les invariants absolus ──────────────────────────────────

/**
 * Applique les invariants absolus indépendamment des règles politiques.
 * Ces invariants ne peuvent JAMAIS être contournés.
 */
function applyAbsoluteInvariants(
  input: GlobalGuardEvaluationInput,
): {
  forced: boolean;
  decision: GlobalGuardDecision;
  reason: string;
} | null {
  if (ABSOLUTE_BLOCKED_ACTION_TYPES.includes(input.action_type)) {
    return {
      forced: true,
      decision: "refuse",
      reason: `L'action "${input.action_type}" est refusée de façon absolue par les invariants CloneGuard. Aucun employé IA ne peut l'exécuter de façon autonome.`,
    };
  }
  return null;
}

// ── Mode d'exécution ──────────────────────────────────────────────────────

/**
 * Calcule le mode d'exécution résultant.
 */
function resolveExecutionMode(
  decision: GlobalGuardDecision,
  input: GlobalGuardEvaluationInput,
): GlobalGuardExecutionMode {
  if (decision === "refuse" || decision === "block") return "blocked";
  if (decision === "require_validation") return "human_required";
  if (decision === "prepare_only") return "supervised";
  // allow — vérifier le mode demandé
  if (input.requested_execution_mode === "blocked") return "blocked";
  if (input.requested_execution_mode === "human_required") return "human_required";
  if (input.risk_level === "high" || input.risk_level === "critical") return "supervised";
  return input.requested_execution_mode;
}

// ── Calcul des prérequis de validation ────────────────────────────────────

function resolveValidationRequirements(
  decision: GlobalGuardDecision,
  policyResult: GlobalPolicyEvaluationResult,
  input: GlobalGuardEvaluationInput,
): GlobalGuardValidationRequirement[] {
  const reqs = new Set<GlobalGuardValidationRequirement>();

  // Toujours tracer
  reqs.add("trace_only");

  if (
    decision === "refuse" ||
    decision === "block" ||
    decision === "require_validation"
  ) {
    reqs.add("human_approval");
  }

  if (ALWAYS_VALIDATION_REQUIRED_ACTIONS.includes(input.action_type)) {
    reqs.add("human_approval");
    if (
      input.action_type === "legal_decision" ||
      input.action_type === "termination_decision" ||
      input.action_type === "contract_signature"
    ) {
      reqs.add("legal_review");
    }
    if (
      input.action_type === "payroll_execution" ||
      input.action_type === "delete_data"
    ) {
      reqs.add("admin_required");
    }
  }

  if (input.risk_level === "critical") {
    reqs.add("supervisor_review");
  }

  for (const matched of policyResult.matched_rules) {
    if (matched.validation_requirement !== "none") {
      reqs.add(matched.validation_requirement);
    }
  }

  return [...reqs];
}

// ── Construction du résultat complet ──────────────────────────────────────

/**
 * Construit un GlobalGuardEvaluationResult complet.
 */
function buildGuardEvaluationResult(
  input: GlobalGuardEvaluationInput,
  policyResult: GlobalPolicyEvaluationResult,
  overrideDecision?: { decision: GlobalGuardDecision; reason: string },
): GlobalGuardEvaluationResult {
  const decision = overrideDecision?.decision ?? mapPolicyResultToGuardDecision(policyResult);
  const executionMode = resolveExecutionMode(decision, input);

  const canExecute =
    decision === "allow" && executionMode !== "blocked" && executionMode !== "human_required";
  const canPrepare =
    decision !== "refuse" &&
    (decision === "allow" || decision === "prepare_only" || decision === "require_validation");
  const humanValidationRequired =
    decision === "require_validation" ||
    decision === "refuse" ||
    decision === "block" ||
    policyResult.requires_human_validation ||
    ALWAYS_VALIDATION_REQUIRED_ACTIONS.includes(input.action_type);

  const blockedReasons = [...policyResult.blocked_reasons];
  if (overrideDecision?.reason) {
    blockedReasons.unshift(overrideDecision.reason);
  }

  const auditNotes = [...policyResult.audit_notes];
  if (overrideDecision) {
    auditNotes.unshift(`[ABSOLUTE_INVARIANT] ${overrideDecision.reason}`);
  }

  const validationRequirements = resolveValidationRequirements(decision, policyResult, input);

  return {
    decision,
    risk_level: input.risk_level,
    execution_mode: executionMode,
    matched_rules: policyResult.matched_rules.map((r) => r.rule_id),
    required_validations: validationRequirements,
    blocked_reasons: blockedReasons,
    refusal_message: policyResult.refusal_message,
    trace_required: policyResult.trace_required || true,
    can_execute: canExecute,
    can_prepare: canPrepare,
    human_validation_required: humanValidationRequired,
    audit_notes: auditNotes,
    evaluated_at: new Date().toISOString(),
  };
}

// ── Évaluateur principal ───────────────────────────────────────────────────

/**
 * Évalue une action via le pipeline CloneGuard global.
 * Pipeline : invariants absolus → politique → décision finale.
 */
export function evaluateGlobalGuard(
  input: GlobalGuardEvaluationInput,
  rules: GlobalGuardPolicyRule[] = DEFAULT_GLOBAL_POLICY_RULES,
): GlobalGuardEvaluationResult {
  // 1. Invariants absolus — priorité maximale
  const absoluteOverride = applyAbsoluteInvariants(input);

  // 2. Évaluation politique
  const policyResult = evaluateGlobalPolicyRules(input, rules);

  // 3. Construction du résultat
  return buildGuardEvaluationResult(input, policyResult, absoluteOverride ?? undefined);
}

// ── Helpers de construction d'input ───────────────────────────────────────

/**
 * Crée un input par défaut avec des valeurs de fallback sécurisées.
 */
export function buildDefaultGlobalGuardInput(
  partial: Partial<GlobalGuardEvaluationInput> & {
    company_id: string;
    employee_slug: string;
    action_type: GlobalGuardActionType;
  },
): GlobalGuardEvaluationInput {
  return {
    request_id: `req_${Date.now()}`,
    company_id: partial.company_id,
    employee_slug: partial.employee_slug,
    domain: partial.domain ?? "custom",
    action_type: partial.action_type,
    requested_execution_mode: partial.requested_execution_mode ?? "supervised",
    risk_level: partial.risk_level ?? "medium",
    subject_type: partial.subject_type ?? "custom",
    payload_summary: partial.payload_summary ?? "",
    human_validation_present: partial.human_validation_present ?? false,
    enterprise_context_available: partial.enterprise_context_available ?? false,
    trace_context_available: partial.trace_context_available ?? false,
    metadata: partial.metadata ?? {},
  };
}

// ── Helpers de décision ────────────────────────────────────────────────────

/**
 * Retourne la décision guard pour un input donné (version simplifiée).
 */
export function getGlobalGuardDecision(
  input: GlobalGuardEvaluationInput,
  rules?: GlobalGuardPolicyRule[],
): GlobalGuardDecision {
  return evaluateGlobalGuard(input, rules).decision;
}

/**
 * Vérifie si une action peut être exécutée automatiquement.
 * Les actions absolument bloquées retournent toujours false.
 */
export function canExecuteGuardedAction(
  input: GlobalGuardEvaluationInput,
  rules?: GlobalGuardPolicyRule[],
): boolean {
  // Invariant absolu : jamais exécutable pour ces 4 types
  if (ABSOLUTE_BLOCKED_ACTION_TYPES.includes(input.action_type)) return false;
  return evaluateGlobalGuard(input, rules).can_execute;
}

/**
 * Vérifie si une action peut être préparée (draft, sans exécution).
 */
export function canPrepareGuardedAction(
  input: GlobalGuardEvaluationInput,
  rules?: GlobalGuardPolicyRule[],
): boolean {
  if (input.action_type === "refuse" as GlobalGuardActionType) return false;
  return evaluateGlobalGuard(input, rules).can_prepare;
}

/**
 * Vérifie si une validation humaine est requise pour cette action.
 */
export function requiresHumanValidation(
  input: GlobalGuardEvaluationInput,
  rules?: GlobalGuardPolicyRule[],
): boolean {
  if (ALWAYS_VALIDATION_REQUIRED_ACTIONS.includes(input.action_type)) return true;
  return evaluateGlobalGuard(input, rules).human_validation_required;
}
