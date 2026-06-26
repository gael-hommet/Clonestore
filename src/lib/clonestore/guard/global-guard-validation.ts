// TECH-06 — CloneGuard + ClonePolicy Global Rules — Validation
// 23 règles de validation pour GlobalGuardPolicyRule.
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalGuardPolicyRule,
  GlobalGuardValidationIssue,
  GlobalGuardValidationReport,
} from "./global-guard-types";

// ── Helper ─────────────────────────────────────────────────────────────────

function issue(
  code: string,
  field: string,
  message: string,
  severity: "error" | "warning" | "info",
): GlobalGuardValidationIssue {
  return { code, field, message, severity };
}

// ── Validation d'une règle ────────────────────────────────────────────────

/**
 * Valide une règle politique individuelle.
 * Retourne un tableau de problèmes (vide = valide).
 */
export function validateGlobalPolicyRule(
  rule: GlobalGuardPolicyRule,
): GlobalGuardValidationIssue[] {
  const issues: GlobalGuardValidationIssue[] = [];

  // V01 : rule_id non vide
  if (!rule.rule_id?.trim()) {
    issues.push(issue("V01", "rule_id", "rule_id est requis.", "error"));
  }

  // V02 : name non vide
  if (!rule.name?.trim()) {
    issues.push(issue("V02", "name", "Le nom de la règle est requis.", "error"));
  }

  // V03 : effect valide
  const validEffects = ["allow", "allow_with_warning", "prepare_only", "require_validation", "block", "refuse"];
  if (!validEffects.includes(rule.effect)) {
    issues.push(issue("V03", "effect", `L'effet "${rule.effect}" est invalide.`, "error"));
  }

  // V04 : severity valide
  const validSeverities = ["info", "warning", "enforcement", "critical", "absolute"];
  if (!validSeverities.includes(rule.severity)) {
    issues.push(issue("V04", "severity", `La sévérité "${rule.severity}" est invalide.`, "error"));
  }

  // V05 : enabled est un booléen
  if (typeof rule.enabled !== "boolean") {
    issues.push(issue("V05", "enabled", "enabled doit être un booléen.", "error"));
  }

  // V06 : action_types non vide
  if (!Array.isArray(rule.action_types) || rule.action_types.length === 0) {
    issues.push(issue("V06", "action_types", "action_types doit contenir au moins une valeur.", "error"));
  }

  // V07 : risk_levels non vide
  if (!Array.isArray(rule.risk_levels) || rule.risk_levels.length === 0) {
    issues.push(issue("V07", "risk_levels", "risk_levels doit contenir au moins une valeur.", "error"));
  }

  // V08 : source non vide
  if (!rule.source?.trim()) {
    issues.push(issue("V08", "source", "La source de la règle est requise.", "error"));
  }

  // V09 : created_at présent
  if (!rule.created_at?.trim()) {
    issues.push(issue("V09", "created_at", "created_at est requis.", "error"));
  }

  // V10 : updated_at présent
  if (!rule.updated_at?.trim()) {
    issues.push(issue("V10", "updated_at", "updated_at est requis.", "error"));
  }

  // V11–V14 : actions critiques — s'appliquent uniquement aux règles NON trace_gate.
  // Une règle de type trace_gate (traçage obligatoire) peut couvrir toutes les actions
  // car son rôle est d'imposer la trace, pas d'autoriser l'exécution.
  // Les invariants absolus sont enforced via applyAbsoluteInvariants() dans l'évaluateur.
  const isTracingRule = rule.type === "trace_gate";

  // V11 : legal_decision doit être bloqué/refusé si couvert (hors trace_gate)
  if (!isTracingRule && rule.action_types.includes("legal_decision") && rule.enabled) {
    const isBlockedOrRefused = rule.effect === "block" || rule.effect === "refuse";
    if (!isBlockedOrRefused) {
      issues.push(issue(
        "V11", "action_types",
        "Les règles non-trace couvrant legal_decision doivent avoir effect=block ou effect=refuse.",
        "error",
      ));
    }
  }

  // V12 : payroll_execution doit être bloqué/refusé si couvert (hors trace_gate)
  if (!isTracingRule && rule.action_types.includes("payroll_execution") && rule.enabled) {
    const isBlockedOrRefused = rule.effect === "block" || rule.effect === "refuse";
    if (!isBlockedOrRefused) {
      issues.push(issue(
        "V12", "action_types",
        "Les règles non-trace couvrant payroll_execution doivent avoir effect=block ou effect=refuse.",
        "error",
      ));
    }
  }

  // V13 : termination_decision doit être bloqué/refusé si couvert (hors trace_gate)
  if (!isTracingRule && rule.action_types.includes("termination_decision") && rule.enabled) {
    const isBlockedOrRefused = rule.effect === "block" || rule.effect === "refuse";
    if (!isBlockedOrRefused) {
      issues.push(issue(
        "V13", "action_types",
        "Les règles non-trace couvrant termination_decision doivent avoir effect=block ou effect=refuse.",
        "error",
      ));
    }
  }

  // V14 : contract_signature doit être bloqué/refusé si couvert (hors trace_gate)
  if (!isTracingRule && rule.action_types.includes("contract_signature") && rule.enabled) {
    const isBlockedOrRefused = rule.effect === "block" || rule.effect === "refuse";
    if (!isBlockedOrRefused) {
      issues.push(issue(
        "V14", "action_types",
        "Les règles non-trace couvrant contract_signature doivent avoir effect=block ou effect=refuse.",
        "error",
      ));
    }
  }

  // V15 : update_memory doit exiger validation en V1 (hors trace_gate)
  if (!isTracingRule && rule.action_types.includes("update_memory") && rule.enabled) {
    const requiresVal = rule.requires_human_validation ||
      rule.effect === "require_validation" ||
      rule.effect === "block" ||
      rule.effect === "refuse";
    if (!requiresVal) {
      issues.push(issue(
        "V15", "action_types",
        "En V1, les règles non-trace couvrant update_memory doivent exiger une validation humaine.",
        "warning",
      ));
    }
  }

  // V16 : send_email high/critical doit exiger validation (hors trace_gate)
  if (
    !isTracingRule &&
    rule.action_types.includes("send_email") &&
    rule.enabled &&
    (rule.risk_levels.includes("high") || rule.risk_levels.includes("critical"))
  ) {
    const requiresVal = rule.requires_human_validation ||
      rule.effect === "require_validation" ||
      rule.effect === "block" ||
      rule.effect === "refuse";
    if (!requiresVal) {
      issues.push(issue(
        "V16", "action_types",
        "Les règles non-trace send_email avec risk high/critical doivent exiger une validation humaine.",
        "error",
      ));
    }
  }

  // V17 : delete_data doit être bloqué sans admin/human (hors trace_gate)
  if (!isTracingRule && rule.action_types.includes("delete_data") && rule.enabled) {
    const isRestricted = rule.effect === "block" ||
      rule.effect === "refuse" ||
      rule.requires_human_validation;
    if (!isRestricted) {
      issues.push(issue(
        "V17", "action_types",
        "Les règles non-trace couvrant delete_data doivent bloquer ou exiger une validation admin/humain.",
        "error",
      ));
    }
  }

  // V18 : trace_required true pour règles critiques
  if (
    rule.severity === "critical" || rule.severity === "absolute"
  ) {
    if (!rule.trace_required) {
      issues.push(issue(
        "V18", "trace_required",
        "Les règles critiques ou absolues doivent avoir trace_required = true.",
        "error",
      ));
    }
  }

  // V19 : pas d'action critique en mode autonomous (allow + sévérité absolute)
  if (
    rule.effect === "allow" &&
    rule.severity === "absolute" &&
    ["legal_decision", "payroll_execution", "termination_decision", "contract_signature"].some(
      (a) => rule.action_types.includes(a as never),
    )
  ) {
    issues.push(issue(
      "V19", "effect",
      "Une règle absolute ne peut pas avoir effect=allow pour des actions critiques.",
      "error",
    ));
  }

  // V20 : aucune règle ne peut supprimer une trace (trace_required=false pour delete_data absolute)
  if (
    rule.action_types.includes("delete_data") &&
    rule.severity === "absolute" &&
    !rule.trace_required
  ) {
    issues.push(issue(
      "V20", "trace_required",
      "Une règle absolute sur delete_data doit toujours avoir trace_required = true.",
      "error",
    ));
  }

  // V21 : pas de "public launch ready" dans description/refusal
  const textToCheck = (rule.description + (rule.refusal_message ?? "")).toLowerCase();
  if (textToCheck.includes("public launch ready")) {
    issues.push(issue(
      "V21", "description",
      "Le texte de la règle ne doit pas contenir 'public launch ready'.",
      "error",
    ));
  }

  // V22 : pas de "conformité garantie" dans description
  if (textToCheck.match(/conformit.* garantie|garantit.* conformit/)) {
    issues.push(issue(
      "V22", "description",
      "Le texte de la règle ne doit pas affirmer une conformité garantie.",
      "error",
    ));
  }

  // V23 : pas de wording zero-trust
  if (textToCheck.match(/zero.trust|z.ro.confiance|zero.confiance/)) {
    issues.push(issue(
      "V23", "description",
      "Le texte de la règle ne doit pas utiliser le terme 'zero-trust'. CloneTrust = autonomie graduelle.",
      "warning",
    ));
  }

  return issues;
}

// ── Validation d'un ensemble de règles ────────────────────────────────────

/**
 * Valide un ensemble de règles politiques.
 * Retourne un tableau de toutes les issues trouvées.
 */
export function validateGlobalPolicyRules(
  rules: GlobalGuardPolicyRule[],
): GlobalGuardValidationIssue[] {
  const allIssues: GlobalGuardValidationIssue[] = [];

  // Vérifier les rule_id uniques
  const ruleIds = rules.map((r) => r.rule_id);
  const duplicates = ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i);
  if (duplicates.length > 0) {
    allIssues.push(issue(
      "VG01", "rule_id",
      `rule_id dupliqués détectés : ${[...new Set(duplicates)].join(", ")}`,
      "error",
    ));
  }

  // Valider chaque règle individuellement
  for (const rule of rules) {
    const ruleIssues = validateGlobalPolicyRule(rule);
    allIssues.push(...ruleIssues);
  }

  return allIssues;
}

// ── Rapport de validation ──────────────────────────────────────────────────

/**
 * Génère un rapport de validation complet pour un ensemble de règles.
 */
export function getGlobalGuardValidationReport(
  rules: GlobalGuardPolicyRule[],
): GlobalGuardValidationReport {
  const allIssues = validateGlobalPolicyRules(rules);
  const errors = allIssues.filter((i) => i.severity === "error");
  const warnings = allIssues.filter((i) => i.severity === "warning");

  const enabledRules = rules.filter((r) => r.enabled);
  const blockerRules = enabledRules.filter(
    (r) => r.blocks_execution || r.effect === "block" || r.effect === "refuse",
  );
  const validationRules = enabledRules.filter(
    (r) => r.requires_human_validation || r.effect === "require_validation",
  );
  const traceRequiredRules = enabledRules.filter((r) => r.trace_required);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    rule_count: rules.length,
    enabled_count: enabledRules.length,
    blocker_rule_count: blockerRules.length,
    validation_rule_count: validationRules.length,
    trace_required_count: traceRequiredRules.length,
    checked_at: new Date().toISOString(),
  };
}
