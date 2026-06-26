// TECH-06 — CloneGuard + ClonePolicy Global Rules — Snapshot
// Génère un résumé (snapshot) de l'état des règles CloneGuard.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalGuardPolicyRule,
  GlobalGuardSnapshot,
  GlobalGuardActionType,
  GlobalGuardDecision,
} from "./global-guard-types";
import { areAbsoluteInvariantsPresent } from "./global-policy-defaults";

// ── Comptage par effet/décision ────────────────────────────────────────────

/**
 * Compte les règles activées par effet dominant.
 */
export function countPoliciesByDecision(
  rules: GlobalGuardPolicyRule[],
): Record<string, number> {
  const counts: Record<string, number> = {
    allow: 0,
    allow_with_warning: 0,
    prepare_only: 0,
    require_validation: 0,
    block: 0,
    refuse: 0,
  };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.effect in counts) {
      counts[rule.effect]++;
    }
  }

  return counts;
}

// ── Règles critiques bloquantes ────────────────────────────────────────────

/**
 * Retourne les règles activées qui bloquent l'exécution.
 */
export function listCriticalBlockerPolicies(
  rules: GlobalGuardPolicyRule[],
): GlobalGuardPolicyRule[] {
  return rules.filter(
    (r) =>
      r.enabled &&
      r.blocks_execution &&
      (r.severity === "critical" || r.severity === "absolute"),
  );
}

/**
 * Retourne les règles qui exigent une validation humaine.
 */
export function listHumanValidationPolicies(
  rules: GlobalGuardPolicyRule[],
): GlobalGuardPolicyRule[] {
  return rules.filter((r) => r.enabled && r.requires_human_validation);
}

/**
 * Retourne les règles qui exigent une trace.
 */
export function listTraceRequiredPolicies(
  rules: GlobalGuardPolicyRule[],
): GlobalGuardPolicyRule[] {
  return rules.filter((r) => r.enabled && r.trace_required);
}

// ── Calcul de la couverture ────────────────────────────────────────────────

/**
 * Calcule un score de couverture (0–100) basé sur les règles actives.
 * Vérifie que les 4 invariants absolus et les domaines critiques sont couverts.
 */
export function buildGuardCoverageSummary(
  rules: GlobalGuardPolicyRule[],
): { score: number; notes: string[] } {
  const enabledRules = rules.filter((r) => r.enabled);
  const notes: string[] = [];
  let score = 0;

  // 1. Les 4 invariants absolus (40 pts)
  const hasLegalBlock = enabledRules.some(
    (r) => r.action_types.includes("legal_decision") && r.blocks_execution,
  );
  const hasPayrollBlock = enabledRules.some(
    (r) => r.action_types.includes("payroll_execution") && r.blocks_execution,
  );
  const hasTerminationBlock = enabledRules.some(
    (r) => r.action_types.includes("termination_decision") && r.blocks_execution,
  );
  const hasContractBlock = enabledRules.some(
    (r) => r.action_types.includes("contract_signature") && r.blocks_execution,
  );

  if (hasLegalBlock) { score += 10; } else { notes.push("MANQUE: règle blocker legal_decision"); }
  if (hasPayrollBlock) { score += 10; } else { notes.push("MANQUE: règle blocker payroll_execution"); }
  if (hasTerminationBlock) { score += 10; } else { notes.push("MANQUE: règle blocker termination_decision"); }
  if (hasContractBlock) { score += 10; } else { notes.push("MANQUE: règle blocker contract_signature"); }

  // 2. Traçage obligatoire (20 pts)
  const hasTraceRule = enabledRules.some((r) => r.trace_required);
  if (hasTraceRule) { score += 20; } else { notes.push("MANQUE: règle trace_required"); }

  // 3. Validation email (10 pts)
  const hasEmailValidation = enabledRules.some(
    (r) => r.action_types.includes("send_email") && r.requires_human_validation,
  );
  if (hasEmailValidation) { score += 10; } else { notes.push("MANQUE: validation send_email"); }

  // 4. Validation memory update (10 pts)
  const hasMemoryValidation = enabledRules.some(
    (r) => r.action_types.includes("update_memory") && r.requires_human_validation,
  );
  if (hasMemoryValidation) { score += 10; } else { notes.push("MANQUE: validation update_memory"); }

  // 5. delete_data bloqué (10 pts)
  const hasDeleteBlock = enabledRules.some(
    (r) => r.action_types.includes("delete_data") && r.blocks_execution,
  );
  if (hasDeleteBlock) { score += 10; } else { notes.push("MANQUE: règle blocker delete_data"); }

  return { score, notes };
}

// ── Snapshot principal ────────────────────────────────────────────────────

/**
 * Génère un snapshot de l'état des règles CloneGuard.
 */
export function buildGlobalGuardSnapshot(
  rules: GlobalGuardPolicyRule[],
): GlobalGuardSnapshot {
  const enabledRules = rules.filter((r) => r.enabled);
  const blockerRules = enabledRules.filter(
    (r) => r.blocks_execution || r.effect === "block" || r.effect === "refuse",
  );
  const validationRules = enabledRules.filter(
    (r) => r.requires_human_validation || r.effect === "require_validation",
  );
  const traceRules = enabledRules.filter((r) => r.trace_required);

  // Extraire les action_types couverts (sans doublons)
  const actionTypesSet = new Set<GlobalGuardActionType>();
  for (const rule of enabledRules) {
    for (const at of rule.action_types) {
      actionTypesSet.add(at);
    }
  }

  // Extraire les domaines couverts (sans doublons)
  const domainsSet = new Set<string>();
  for (const rule of enabledRules) {
    for (const d of rule.domains) {
      domainsSet.add(d);
    }
  }

  const { score, notes } = buildGuardCoverageSummary(rules);
  const criticalInvariantsOk = areAbsoluteInvariantsPresent(rules);

  return {
    total_rules: rules.length,
    enabled_rules: enabledRules.length,
    blocker_rules: blockerRules.length,
    validation_rules: validationRules.length,
    trace_required_rules: traceRules.length,
    covered_action_types: [...actionTypesSet],
    covered_domains: [...domainsSet],
    coverage_score: score,
    critical_invariants_ok: criticalInvariantsOk,
    generated_at: new Date().toISOString(),
  };
}
