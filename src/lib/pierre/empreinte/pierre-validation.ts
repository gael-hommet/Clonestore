// B44 — PierreEmpreinte validation
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  PierreEmpreinte,
  PierreEmpreintePatch,
} from "./types";
import type { EmpreinteValidationResult, EmpreinteValidationIssue } from "../../clonestore/empreinte/types";

const VALID_AI_MODES = ["off", "assist", "primary"];
const VALID_TRUST_LEVELS = ["minimal", "supervised", "trusted", "autonomous"];
const VALID_EMAIL_SEND_MODES = ["mock", "draft_only", "live_with_approval", "live_auto"];
const VALID_CONFIDENTIALITY_LEVELS = ["internal", "restricted", "confidential", "secret"];
const VALID_PAYROLL_CYCLES = ["monthly", "bimonthly", "weekly"];
const VALID_EXPORT_FORMATS = ["csv", "excel", "xml", "json"];

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{3,6}$/.test(v);
}

export function validatePierreEmpreinte(
  empreinte: PierreEmpreinte,
): EmpreinteValidationResult {
  const issues: EmpreinteValidationIssue[] = [];

  // Identity
  if (empreinte.identity.display_name.length === 0) {
    issues.push({ field: "identity.display_name", message: "Le nom d'affichage ne peut pas être vide.", severity: "error" });
  }
  if (empreinte.identity.brand_color_hex && !isValidHex(empreinte.identity.brand_color_hex)) {
    issues.push({ field: "identity.brand_color_hex", message: "Couleur hex invalide.", severity: "warning" });
  }

  // Autonomy
  if (!VALID_AI_MODES.includes(empreinte.autonomy.ai_mode)) {
    issues.push({ field: "autonomy.ai_mode", message: "Mode IA invalide.", severity: "error" });
  }
  if (!VALID_TRUST_LEVELS.includes(empreinte.autonomy.trust_level)) {
    issues.push({ field: "autonomy.trust_level", message: "Niveau de confiance invalide.", severity: "error" });
  }
  if (empreinte.autonomy.max_auto_actions_per_session < 0) {
    issues.push({ field: "autonomy.max_auto_actions_per_session", message: "La valeur doit être >= 0.", severity: "error" });
  }

  // Email rules
  if (!VALID_EMAIL_SEND_MODES.includes(empreinte.email_rules.send_mode)) {
    issues.push({ field: "email_rules.send_mode", message: "Mode d'envoi email invalide.", severity: "error" });
  }
  if (empreinte.email_rules.send_mode === "live_auto") {
    issues.push({ field: "email_rules.send_mode", message: "live_auto désactive toute validation humaine — utiliser live_with_approval.", severity: "warning" });
  }
  if (empreinte.email_rules.default_reply_to && !isValidEmail(empreinte.email_rules.default_reply_to)) {
    issues.push({ field: "email_rules.default_reply_to", message: "Email reply-to invalide.", severity: "error" });
  }
  if (empreinte.email_rules.max_recipients_per_email < 1 || empreinte.email_rules.max_recipients_per_email > 100) {
    issues.push({ field: "email_rules.max_recipients_per_email", message: "Nombre de destinataires entre 1 et 100.", severity: "warning" });
  }

  // Sensitive cases
  if (!VALID_CONFIDENTIALITY_LEVELS.includes(empreinte.sensitive_cases.confidentiality_level)) {
    issues.push({ field: "sensitive_cases.confidentiality_level", message: "Niveau de confidentialité invalide.", severity: "error" });
  }
  if (empreinte.sensitive_cases.escalation_email && !isValidEmail(empreinte.sensitive_cases.escalation_email)) {
    issues.push({ field: "sensitive_cases.escalation_email", message: "Email d'escalade invalide.", severity: "error" });
  }

  // Prepayroll
  if (empreinte.prepayroll.enabled) {
    if (empreinte.prepayroll.payroll_cycle && !VALID_PAYROLL_CYCLES.includes(empreinte.prepayroll.payroll_cycle)) {
      issues.push({ field: "prepayroll.payroll_cycle", message: "Cycle de paie invalide.", severity: "error" });
    }
    if (empreinte.prepayroll.auto_export_format && !VALID_EXPORT_FORMATS.includes(empreinte.prepayroll.auto_export_format)) {
      issues.push({ field: "prepayroll.auto_export_format", message: "Format d'export invalide.", severity: "error" });
    }
    if (empreinte.prepayroll.cutoff_day !== null && (empreinte.prepayroll.cutoff_day < 1 || empreinte.prepayroll.cutoff_day > 28)) {
      issues.push({ field: "prepayroll.cutoff_day", message: "Jour de coupure entre 1 et 28.", severity: "warning" });
    }
  }

  // Document style
  if (empreinte.document_style.primary_color_hex && !isValidHex(empreinte.document_style.primary_color_hex)) {
    issues.push({ field: "document_style.primary_color_hex", message: "Couleur primaire hex invalide.", severity: "warning" });
  }
  if (empreinte.document_style.secondary_color_hex && !isValidHex(empreinte.document_style.secondary_color_hex)) {
    issues.push({ field: "document_style.secondary_color_hex", message: "Couleur secondaire hex invalide.", severity: "warning" });
  }
  if (empreinte.document_style.page_margin_mm < 5 || empreinte.document_style.page_margin_mm > 50) {
    issues.push({ field: "document_style.page_margin_mm", message: "Marge entre 5 et 50 mm.", severity: "warning" });
  }

  // Workflow rules
  if (empreinte.workflow_rules.max_tasks_per_mission < 1 || empreinte.workflow_rules.max_tasks_per_mission > 100) {
    issues.push({ field: "workflow_rules.max_tasks_per_mission", message: "Nombre de tâches entre 1 et 100.", severity: "warning" });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: errorCount === 0,
    issues,
    error_count: errorCount,
    warning_count: warningCount,
  };
}

export function validatePierreEmpreintePatch(
  _patch: PierreEmpreintePatch,
): EmpreinteValidationResult {
  // Patch-level validation — minimal since full validation runs after merge
  return { valid: true, issues: [], error_count: 0, warning_count: 0 };
}
