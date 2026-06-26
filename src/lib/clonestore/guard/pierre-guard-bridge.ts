// TECH-06 — CloneGuard + ClonePolicy Global Rules — Pierre Bridge
// Bridge entre Pierre (TECH-02, premier employé IA RH) et CloneGuard Global.
//
// IMPORTANT :
//   Ce bridge NE modifie PAS le moteur Pierre (src/lib/pierre/).
//   Pierre peut utiliser CloneGuard Global sans aucune modification de son code.
//   Le branchement runtime complet (remplacer cloneguard.ts Pierre par ce module)
//   peut venir lors d'un futur bloc si nécessaire.
//
// Mappings Pierre → Global :
//   draft_hr_document        → draft_document
//   prepare_email            → draft_email
//   send_email               → send_email
//   employee_record_update   → modify_record
//   memory_update            → update_memory
//   legal_or_disciplinary_decision → legal_decision
//   payroll_official         → payroll_execution
//   termination              → termination_decision
//   contract_signature       → contract_signature
//   doc_generate             → draft_document
//   doc_rewrite              → draft_document
//   pdf_generate             → draft_document
//   reminder_create          → create_task
//   followup_schedule        → create_task
//   unknown_action           → custom
//   (tout autre)             → read_context (safe fallback)
//
// Pure functions: no async, no Supabase, no Next.js, no side effects.

import type {
  GlobalGuardActionType,
  GlobalGuardRiskLevel,
  GlobalGuardEvaluationInput,
  GlobalGuardEvaluationResult,
  GlobalGuardDomain,
} from "./global-guard-types";
import {
  evaluateGlobalGuard,
  buildDefaultGlobalGuardInput,
} from "./global-guard-evaluator";

// ── Mapping des actions Pierre → Global ───────────────────────────────────

const PIERRE_ACTION_TO_GLOBAL: Record<string, GlobalGuardActionType> = {
  // Document actions
  "draft_hr_document":        "draft_document",
  "doc_generate":             "draft_document",
  "doc_rewrite":              "draft_document",
  "pdf_generate":             "draft_document",
  "document.generate":        "draft_document",
  "document.rewrite":         "draft_document",

  // Email actions
  "prepare_email":            "draft_email",
  "email.draft":              "draft_email",
  "send_email":               "send_email",
  "email.send":               "send_email",

  // Task actions
  "reminder_create":          "create_task",
  "followup_schedule":        "create_task",
  "create_task":              "create_task",

  // Record actions
  "employee_record_update":   "modify_record",
  "modify_record":            "modify_record",

  // Memory actions
  "memory_update":            "update_memory",
  "update_memory":            "update_memory",

  // ABSOLUTE BLOCKS — mapped to absolute action types
  "legal_or_disciplinary_decision": "legal_decision",
  "legal_decision":           "legal_decision",
  "disciplinary_decision":    "legal_decision",
  "payroll_official":         "payroll_execution",
  "payroll_execution":        "payroll_execution",
  "termination":              "termination_decision",
  "termination_decision":     "termination_decision",
  "dismissal_action":         "termination_decision",
  "contract_signature":       "contract_signature",
  "contract_action":          "contract_signature",

  // Data actions
  "export_data":              "export_data",

  // Unknown / default
  "unknown_action":           "custom",
};

// ── Mapping des niveaux de risque Pierre → Global ─────────────────────────

const PIERRE_RISK_TO_GLOBAL: Record<string, GlobalGuardRiskLevel> = {
  "green":    "low",
  "low":      "low",
  "yellow":   "medium",
  "medium":   "medium",
  "orange":   "medium",
  "red":      "high",
  "high":     "high",
  "black":    "critical",
  "critical": "critical",
};

// ── Fonctions de mapping ───────────────────────────────────────────────────

/**
 * Mappe un type d'action Pierre vers un GlobalGuardActionType.
 * Fallback sécurisé : "read_context" si inconnu.
 */
export function mapPierreActionToGlobalActionType(
  pierreAction: string | null | undefined,
): GlobalGuardActionType {
  if (!pierreAction) return "read_context";
  const lower = pierreAction.toLowerCase().trim();
  return PIERRE_ACTION_TO_GLOBAL[lower] ?? "read_context";
}

/**
 * Mappe un niveau de risque Pierre vers GlobalGuardRiskLevel.
 * Fallback sécurisé : "medium" si inconnu.
 */
export function mapPierreRiskToGlobalRisk(
  pierreRisk: string | null | undefined,
): GlobalGuardRiskLevel {
  if (!pierreRisk) return "medium";
  const lower = pierreRisk.toLowerCase().trim();
  return PIERRE_RISK_TO_GLOBAL[lower] ?? "medium";
}

// ── Paramètres du bridge ───────────────────────────────────────────────────

export interface PierreGuardBridgeParams {
  company_id: string;
  pierre_action_type: string;
  pierre_risk_level?: string;
  pierre_domain?: string;
  payload_summary?: string;
  human_validation_present?: boolean;
}

export interface PierreGuardBridgeResult {
  global_input: GlobalGuardEvaluationInput;
  global_result: GlobalGuardEvaluationResult;
  pierre_action_type: string;
  mapped_global_action_type: GlobalGuardActionType;
  mapped_global_risk_level: GlobalGuardRiskLevel;
  can_execute: boolean;
  can_prepare: boolean;
  human_validation_required: boolean;
  decision: string;
  refusal_message: string | null;
  blocked_reasons: string[];
}

// ── Construction de l'input ────────────────────────────────────────────────

/**
 * Construit un GlobalGuardEvaluationInput depuis les paramètres Pierre.
 */
export function buildPierreGuardInput(
  params: PierreGuardBridgeParams,
): GlobalGuardEvaluationInput {
  const globalAction = mapPierreActionToGlobalActionType(params.pierre_action_type);
  const globalRisk = mapPierreRiskToGlobalRisk(params.pierre_risk_level);
  const domain = (params.pierre_domain ?? "hr") as GlobalGuardDomain;

  return buildDefaultGlobalGuardInput({
    company_id: params.company_id,
    employee_slug: "pierre",
    action_type: globalAction,
    domain,
    risk_level: globalRisk,
    payload_summary: params.payload_summary ?? "",
    human_validation_present: params.human_validation_present ?? false,
  });
}

// ── Évaluation principale ──────────────────────────────────────────────────

/**
 * Évalue une action Pierre via le pipeline CloneGuard Global.
 * Pierre n'a pas besoin d'être modifié pour utiliser ce bridge.
 */
export function evaluatePierreActionWithGlobalGuard(
  params: PierreGuardBridgeParams,
): PierreGuardBridgeResult {
  const globalInput = buildPierreGuardInput(params);
  const globalResult = evaluateGlobalGuard(globalInput);

  return {
    global_input: globalInput,
    global_result: globalResult,
    pierre_action_type: params.pierre_action_type,
    mapped_global_action_type: globalInput.action_type,
    mapped_global_risk_level: globalInput.risk_level,
    can_execute: globalResult.can_execute,
    can_prepare: globalResult.can_prepare,
    human_validation_required: globalResult.human_validation_required,
    decision: globalResult.decision,
    refusal_message: globalResult.refusal_message,
    blocked_reasons: globalResult.blocked_reasons,
  };
}

// ── Fallback de compatibilité Pierre ──────────────────────────────────────

/**
 * Construit un résultat de fallback compatible avec le format attendu par Pierre,
 * en cas d'erreur ou indisponibilité du guard global.
 * Ce fallback est conservateur : il bloque toujours les actions critiques.
 */
export function buildPierreGuardLegacyFallback(
  result: GlobalGuardEvaluationResult,
): {
  allowed_to_auto_execute: boolean;
  requires_human: boolean;
  decision: string;
  explanation: string;
} {
  return {
    allowed_to_auto_execute: result.can_execute,
    requires_human: result.human_validation_required,
    decision: result.decision,
    explanation: result.audit_notes.join("; ") || "CloneGuard Global evaluation",
  };
}
