// TECH-06 — CloneGuard + ClonePolicy Global Rules — Index
// Point d'entrée unique pour la couche CloneGuard/ClonePolicy globale.
//
// Architecture :
//   CloneStore Platform
//   → CloneGuard Global (ce module)
//   → ClonePolicy Global Rules (interne à CloneGuard)
//   → Employee Runtime Contract (TECH-02)
//   → Pierre / futurs employés IA
//
// IMPORTANT :
//   CloneGuard n'est PAS "le guard de Pierre".
//   ClonePolicy n'est PAS une technologie client séparée.
//   Pierre (src/lib/pierre/hr/cloneguard.ts) reste intact.

// ── Types ─────────────────────────────────────────────────────────────────

export type {
  GlobalGuardDecision,
  GlobalGuardRiskLevel,
  GlobalGuardActionType,
  GlobalGuardDomain,
  GlobalGuardSubjectType,
  GlobalGuardExecutionMode,
  GlobalGuardValidationRequirement,
  GlobalGuardPolicyRuleType,
  GlobalGuardPolicyRuleSeverity,
  GlobalGuardPolicyCondition,
  GlobalGuardPolicyEffect,
  GlobalGuardPolicyRule,
  GlobalGuardRequestContext,
  GlobalGuardEmployeeContext,
  GlobalGuardEnterpriseContext,
  GlobalGuardEvaluationInput,
  GlobalGuardEvaluationResult,
  GlobalPolicyEvaluationResult,
  GlobalGuardValidationIssue,
  GlobalGuardValidationReport,
  GlobalGuardSnapshot,
} from "./global-guard-types";

export {
  GLOBAL_GUARD_DECISION_RANK,
  GLOBAL_GUARD_EFFECT_RANK,
  GLOBAL_GUARD_RISK_RANK,
  ABSOLUTE_BLOCKED_ACTION_TYPES,
  ALWAYS_VALIDATION_REQUIRED_ACTIONS,
} from "./global-guard-types";

// ── Defaults ──────────────────────────────────────────────────────────────

export {
  DEFAULT_GLOBAL_POLICY_RULES,
  areAbsoluteInvariantsPresent,
} from "./global-policy-defaults";

// ── Policy Evaluator ──────────────────────────────────────────────────────

export {
  policyRuleMatchesInput,
  listMatchingPolicyRules,
  resolvePolicyEffectFromRules,
  buildPolicyEvaluationResult,
  evaluateGlobalPolicyRules,
  maxRiskLevel,
  isActionAbsolutelyBlocked,
} from "./global-policy-evaluator";

// ── Guard Evaluator ───────────────────────────────────────────────────────

export {
  mapPolicyResultToGuardDecision,
  evaluateGlobalGuard,
  buildDefaultGlobalGuardInput,
  getGlobalGuardDecision,
  canExecuteGuardedAction,
  canPrepareGuardedAction,
  requiresHumanValidation,
} from "./global-guard-evaluator";

// ── Validation ────────────────────────────────────────────────────────────

export {
  validateGlobalPolicyRule,
  validateGlobalPolicyRules,
  getGlobalGuardValidationReport,
} from "./global-guard-validation";

// ── Snapshot ──────────────────────────────────────────────────────────────

export {
  countPoliciesByDecision,
  listCriticalBlockerPolicies,
  listHumanValidationPolicies,
  listTraceRequiredPolicies,
  buildGuardCoverageSummary,
  buildGlobalGuardSnapshot,
} from "./global-guard-snapshot";

// ── Employee Guard Access ─────────────────────────────────────────────────

export {
  BASE_ALLOWED_ACTION_TYPES,
  HR_ALLOWED_ACTION_TYPES,
  UNIVERSAL_BLOCKED_ACTION_TYPES,
  buildEmployeeGuardContext,
  getEmployeeGuardProfile,
  getAllowedActionTypesForEmployee,
  getBlockedActionTypesForEmployee,
  canEmployeeRequestAction,
  buildGuardInputForEmployeeAction,
} from "./employee-guard-access";

// ── Pierre Bridge ─────────────────────────────────────────────────────────

export type {
  PierreGuardBridgeParams,
  PierreGuardBridgeResult,
} from "./pierre-guard-bridge";

export {
  mapPierreActionToGlobalActionType,
  mapPierreRiskToGlobalRisk,
  buildPierreGuardInput,
  evaluatePierreActionWithGlobalGuard,
  buildPierreGuardLegacyFallback,
} from "./pierre-guard-bridge";
