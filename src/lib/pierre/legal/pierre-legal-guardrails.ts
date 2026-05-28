// B47 — Pierre Legal Guardrails
// Evaluates actions for legal safety and enforces Pierre's legal limits.
// Pure: no Supabase, no Next, no async. No throw.

import type { LegalRiskLevel } from "../../legal-commercial/types";
import {
  classifyHrTextCategory,
  getTaxonomyDefinition,
  type PierreSensitiveHrCategory,
} from "./pierre-legal-taxonomy";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PierreLegalActionEvaluation = {
  category: PierreSensitiveHrCategory;
  risk_level: LegalRiskLevel;
  autonomous_allowed: boolean;
  send_allowed: boolean;
  export_allowed: boolean;
  human_validation_required: boolean;
  legal_review_recommended: boolean;
  required_disclaimers: string[];
  blocked_actions: string[];
  safe_next_actions: string[];
  warnings: string[];
};

// ── Sensitive action patterns ─────────────────────────────────────────────────

const AUTO_SEND_BLOCKED_PATTERNS = [
  "auto_send",
  "send_dismissal",
  "send_sanction",
  "licenciement",
  "sanction",
  "sign_contract",
  "finalize_contract",
  "certify",
  "auto_decide",
  "decide_alone",
  "submit_dsn",
  "generate_payslip",
];

// ── Evaluators ────────────────────────────────────────────────────────────────

export function evaluatePierreActionLegalSafety(
  action: string,
  text?: string,
): PierreLegalActionEvaluation {
  const category = text ? classifyHrTextCategory(text) : classifyHrTextCategory(action);
  const def = getTaxonomyDefinition(category);
  const warnings: string[] = [];

  if (!def) {
    return {
      category: "other",
      risk_level: "low",
      autonomous_allowed: false,
      send_allowed: false,
      export_allowed: false,
      human_validation_required: false,
      legal_review_recommended: false,
      required_disclaimers: ["HUMAN_RESPONSIBILITY"],
      blocked_actions: [],
      safe_next_actions: ["prepare_draft", "escalate_if_uncertain"],
      warnings: [],
    };
  }

  // Check for auto-send patterns in action
  const actionLower = action.toLowerCase();
  const blocked_actions = AUTO_SEND_BLOCKED_PATTERNS.filter((p) => actionLower.includes(p));

  if (blocked_actions.length > 0) {
    warnings.push(`Actions bloquées détectées : ${blocked_actions.join(", ")}.`);
  }
  if (!def.policy.human_validation_required && def.risk_level === "high") {
    warnings.push("Action à risque élevé — revue humaine recommandée.");
  }

  return {
    category,
    risk_level: def.risk_level,
    autonomous_allowed: def.policy.autonomous_allowed,
    send_allowed: def.policy.send_allowed,
    export_allowed: def.policy.export_allowed,
    human_validation_required: def.policy.human_validation_required,
    legal_review_recommended: def.policy.legal_review_recommended,
    required_disclaimers: def.policy.required_disclaimers,
    blocked_actions,
    safe_next_actions: def.policy.safe_next_actions,
    warnings,
  };
}

export function enforcePierreLegalGuardrails(
  action: string,
  text?: string,
): { allowed: boolean; reason: string | null; evaluation: PierreLegalActionEvaluation } {
  const evaluation = evaluatePierreActionLegalSafety(action, text);

  if (evaluation.blocked_actions.length > 0) {
    return {
      allowed: false,
      reason: `Action bloquée par guardrail légal : ${evaluation.blocked_actions[0]}`,
      evaluation,
    };
  }

  // Auto-decisions never allowed in sensitive categories
  const sensitiveCategories: PierreSensitiveHrCategory[] = [
    "dismissal", "sanction", "harassment", "discrimination", "legal",
  ];
  if (sensitiveCategories.includes(evaluation.category) && evaluation.autonomous_allowed === false) {
    const isAutoAction = action.toLowerCase().includes("auto") || action.toLowerCase().includes("decide") || action.toLowerCase().includes("send");
    if (isAutoAction) {
      return {
        allowed: false,
        reason: `Décision autonome interdite pour la catégorie "${evaluation.category}".`,
        evaluation,
      };
    }
  }

  return { allowed: true, reason: null, evaluation };
}

export function buildPierreLegalSafeNextActions(
  action: string,
  text?: string,
): string[] {
  const evaluation = evaluatePierreActionLegalSafety(action, text);
  return evaluation.safe_next_actions;
}

export function getPierreHumanValidationRequirement(
  action: string,
  text?: string,
): { required: boolean; reason: string } {
  const evaluation = evaluatePierreActionLegalSafety(action, text);
  if (evaluation.human_validation_required) {
    return {
      required: true,
      reason: `Catégorie "${evaluation.category}" — validation humaine obligatoire avant toute action.`,
    };
  }
  if (evaluation.risk_level === "high" || evaluation.risk_level === "critical") {
    return {
      required: true,
      reason: `Risque ${evaluation.risk_level} — validation humaine recommandée.`,
    };
  }
  return { required: false, reason: "Action non sensible — pas de validation humaine obligatoire." };
}
