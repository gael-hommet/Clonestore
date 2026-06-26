// TECH-06 — CloneGuard + ClonePolicy Global Rules — Policy Evaluator
// Évaluateur de règles politiques globales.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalGuardPolicyRule,
  GlobalGuardPolicyEffect,
  GlobalGuardEvaluationInput,
  GlobalPolicyEvaluationResult,
  GlobalGuardRiskLevel,
  GlobalGuardActionType,
} from "./global-guard-types";
import {
  GLOBAL_GUARD_EFFECT_RANK,
  GLOBAL_GUARD_RISK_RANK,
} from "./global-guard-types";
import { DEFAULT_GLOBAL_POLICY_RULES } from "./global-policy-defaults";

// ── Correspondance d'une règle ─────────────────────────────────────────────

/**
 * Vérifie si une règle correspond à un input d'évaluation.
 * Supporte le wildcard `*` pour domains, risk_levels, action_types.
 */
export function policyRuleMatchesInput(
  rule: GlobalGuardPolicyRule,
  input: GlobalGuardEvaluationInput,
): boolean {
  // Règle désactivée → pas de correspondance
  if (!rule.enabled) return false;

  // Vérifier action_type
  const actionMatch =
    rule.action_types.length === 0 ||
    (rule.action_types as string[]).includes("*") ||
    rule.action_types.includes(input.action_type);
  if (!actionMatch) return false;

  // Vérifier domain
  const domainMatch =
    rule.domains.length === 0 ||
    rule.domains.includes("*") ||
    rule.domains.includes(input.domain);
  if (!domainMatch) return false;

  // Vérifier risk_level
  const riskMatch =
    rule.risk_levels.length === 0 ||
    (rule.risk_levels as string[]).includes("*") ||
    rule.risk_levels.includes(input.risk_level);
  if (!riskMatch) return false;

  // Vérifier employee_slug (liste vide = tous les employés)
  if (rule.employee_slugs.length > 0) {
    const slugMatch = rule.employee_slugs.includes(input.employee_slug);
    if (!slugMatch) return false;
  }

  return true;
}

/**
 * Retourne toutes les règles qui correspondent à l'input.
 */
export function listMatchingPolicyRules(
  input: GlobalGuardEvaluationInput,
  rules: GlobalGuardPolicyRule[],
): GlobalGuardPolicyRule[] {
  return rules.filter((rule) => policyRuleMatchesInput(rule, input));
}

// ── Résolution de l'effet dominant ────────────────────────────────────────

/**
 * Résout l'effet dominant à partir d'une liste de règles matchées.
 * Priorise les effets les plus restrictifs (refuse > block > require_validation > ...).
 */
export function resolvePolicyEffectFromRules(
  matchedRules: GlobalGuardPolicyRule[],
): GlobalGuardPolicyEffect {
  if (matchedRules.length === 0) return "allow";

  let dominant: GlobalGuardPolicyEffect = "allow";

  for (const rule of matchedRules) {
    const currentRank = GLOBAL_GUARD_EFFECT_RANK[rule.effect];
    const dominantRank = GLOBAL_GUARD_EFFECT_RANK[dominant];
    if (currentRank > dominantRank) {
      dominant = rule.effect;
    }
  }

  return dominant;
}

// ── Construction du résultat ───────────────────────────────────────────────

/**
 * Construit un GlobalPolicyEvaluationResult depuis les règles matchées.
 */
export function buildPolicyEvaluationResult(
  input: GlobalGuardEvaluationInput,
  matchedRules: GlobalGuardPolicyRule[],
): GlobalPolicyEvaluationResult {
  const dominantEffect = resolvePolicyEffectFromRules(matchedRules);

  const hasHardBlock = matchedRules.some(
    (r) => r.type === "hard_block" && (r.effect === "block" || r.effect === "refuse"),
  );
  const hasSoftBlock = matchedRules.some(
    (r) => r.type === "soft_block" && (r.effect === "block" || r.effect === "prepare_only"),
  );
  const hasValidationGate = matchedRules.some(
    (r) => r.type === "validation_gate" || r.requires_human_validation,
  );
  const requiresHumanValidation = matchedRules.some((r) => r.requires_human_validation);
  const traceRequired = matchedRules.some((r) => r.trace_required);

  const blockedReasons = matchedRules
    .filter((r) => r.blocks_execution && r.refusal_message)
    .map((r) => r.refusal_message as string);

  // Premier message de refus disponible (règle absolute/refuse en priorité)
  const absoluteRefusal = matchedRules
    .filter((r) => r.severity === "absolute" && r.refusal_message)
    .map((r) => r.refusal_message as string)[0] ?? null;
  const softRefusal = matchedRules
    .filter((r) => r.refusal_message)
    .map((r) => r.refusal_message as string)[0] ?? null;
  const refusalMessage = absoluteRefusal ?? softRefusal;

  const auditNotes = matchedRules.map(
    (r) => `[${r.severity.toUpperCase()}] ${r.name} (rule_id=${r.rule_id})`,
  );

  return {
    matched_rules: matchedRules,
    dominant_effect: dominantEffect,
    has_hard_block: hasHardBlock,
    has_soft_block: hasSoftBlock,
    has_validation_gate: hasValidationGate,
    requires_human_validation: requiresHumanValidation,
    trace_required: traceRequired,
    blocked_reasons: blockedReasons,
    refusal_message: refusalMessage,
    audit_notes: auditNotes,
    evaluated_at: new Date().toISOString(),
  };
}

// ── Évaluation principale ──────────────────────────────────────────────────

/**
 * Évalue les règles politiques globales pour un input donné.
 * Utilise DEFAULT_GLOBAL_POLICY_RULES si aucune liste de règles n'est fournie.
 */
export function evaluateGlobalPolicyRules(
  input: GlobalGuardEvaluationInput,
  rules: GlobalGuardPolicyRule[] = DEFAULT_GLOBAL_POLICY_RULES,
): GlobalPolicyEvaluationResult {
  const matchedRules = listMatchingPolicyRules(input, rules);
  return buildPolicyEvaluationResult(input, matchedRules);
}

// ── Helpers de niveau de risque ────────────────────────────────────────────

/**
 * Retourne le niveau de risque le plus élevé parmi deux.
 */
export function maxRiskLevel(
  a: GlobalGuardRiskLevel,
  b: GlobalGuardRiskLevel,
): GlobalGuardRiskLevel {
  return GLOBAL_GUARD_RISK_RANK[a] >= GLOBAL_GUARD_RISK_RANK[b] ? a : b;
}

/**
 * Vérifie si une action est absolument bloquée (règle absolute + refuse/block).
 */
export function isActionAbsolutelyBlocked(
  actionType: GlobalGuardActionType,
  rules: GlobalGuardPolicyRule[] = DEFAULT_GLOBAL_POLICY_RULES,
): boolean {
  return rules.some(
    (r) =>
      r.enabled &&
      r.severity === "absolute" &&
      (r.effect === "block" || r.effect === "refuse") &&
      r.action_types.includes(actionType),
  );
}
