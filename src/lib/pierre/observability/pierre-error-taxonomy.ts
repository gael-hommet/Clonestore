// B43 — Pierre HR error taxonomy: all canonical Pierre error codes

import type { ObservableEventDomain, ObservabilitySeverity } from "../../observability/types";

// ── Pierre error code catalogue ───────────────────────────────────────────────

export type PierreErrorCode =
  // Mission layer
  | "PIERRE_MISSION_NOT_FOUND"
  | "PIERRE_MISSION_ALREADY_CLOSED"
  | "PIERRE_MISSION_COMPANY_MISMATCH"
  // Task layer
  | "PIERRE_TASK_EXECUTION_FAILED"
  | "PIERRE_TASK_APPROVAL_REQUIRED"
  | "PIERRE_TASK_BLOCKED_SENSITIVE"
  | "PIERRE_TASK_NOT_FOUND"
  // Workflow layer
  | "PIERRE_WORKFLOW_HARD_FAIL"
  | "PIERRE_WORKFLOW_NO_TASKS"
  | "PIERRE_WORKFLOW_DOMAIN_MISMATCH"
  // Email layer
  | "PIERRE_EMAIL_BLOCKED_BY_POLICY"
  | "PIERRE_EMAIL_SEND_FAILED"
  | "PIERRE_EMAIL_RECIPIENT_INVALID"
  // AI layer
  | "PIERRE_AI_CALL_FAILED"
  | "PIERRE_AI_BUDGET_EXCEEDED"
  | "PIERRE_AI_TIMEOUT"
  // Document layer
  | "PIERRE_DOCUMENT_GENERATION_FAILED"
  | "PIERRE_PDF_RENDER_FAILED"
  // RGPD layer
  | "PIERRE_RGPD_PURGE_BLOCKED"
  // Security layer
  | "PIERRE_SECURITY_VIOLATION";

// ── Code metadata ─────────────────────────────────────────────────────────────

type PierreErrorMeta = {
  code: PierreErrorCode;
  domain: ObservableEventDomain;
  severity: ObservabilitySeverity;
  retryable: boolean;
  safe_message: string;
};

const PIERRE_ERROR_META: Record<PierreErrorCode, PierreErrorMeta> = {
  PIERRE_MISSION_NOT_FOUND: {
    code: "PIERRE_MISSION_NOT_FOUND",
    domain: "mission",
    severity: "error",
    retryable: false,
    safe_message: "Mission introuvable. Vérifiez l'identifiant et réessayez.",
  },
  PIERRE_MISSION_ALREADY_CLOSED: {
    code: "PIERRE_MISSION_ALREADY_CLOSED",
    domain: "mission",
    severity: "warning",
    retryable: false,
    safe_message: "Cette mission est déjà clôturée.",
  },
  PIERRE_MISSION_COMPANY_MISMATCH: {
    code: "PIERRE_MISSION_COMPANY_MISMATCH",
    domain: "mission",
    severity: "critical",
    retryable: false,
    safe_message: "Erreur d'accès — contactez le support.",
  },
  PIERRE_TASK_EXECUTION_FAILED: {
    code: "PIERRE_TASK_EXECUTION_FAILED",
    domain: "task",
    severity: "error",
    retryable: true,
    safe_message: "L'exécution de la tâche a échoué. Réessai en cours.",
  },
  PIERRE_TASK_APPROVAL_REQUIRED: {
    code: "PIERRE_TASK_APPROVAL_REQUIRED",
    domain: "task",
    severity: "info",
    retryable: false,
    safe_message: "Cette tâche nécessite une validation humaine avant d'être exécutée.",
  },
  PIERRE_TASK_BLOCKED_SENSITIVE: {
    code: "PIERRE_TASK_BLOCKED_SENSITIVE",
    domain: "task",
    severity: "warning",
    retryable: false,
    safe_message: "Cette action est bloquée car elle concerne un cas sensible. Une validation est requise.",
  },
  PIERRE_TASK_NOT_FOUND: {
    code: "PIERRE_TASK_NOT_FOUND",
    domain: "task",
    severity: "error",
    retryable: false,
    safe_message: "Tâche introuvable.",
  },
  PIERRE_WORKFLOW_HARD_FAIL: {
    code: "PIERRE_WORKFLOW_HARD_FAIL",
    domain: "workflow",
    severity: "critical",
    retryable: false,
    safe_message: "Une erreur critique du workflow a été détectée. L'action a été bloquée.",
  },
  PIERRE_WORKFLOW_NO_TASKS: {
    code: "PIERRE_WORKFLOW_NO_TASKS",
    domain: "workflow",
    severity: "error",
    retryable: false,
    safe_message: "Aucune tâche n'a pu être générée pour cette demande.",
  },
  PIERRE_WORKFLOW_DOMAIN_MISMATCH: {
    code: "PIERRE_WORKFLOW_DOMAIN_MISMATCH",
    domain: "workflow",
    severity: "error",
    retryable: false,
    safe_message: "Le domaine de la demande n'a pas été correctement identifié.",
  },
  PIERRE_EMAIL_BLOCKED_BY_POLICY: {
    code: "PIERRE_EMAIL_BLOCKED_BY_POLICY",
    domain: "email",
    severity: "warning",
    retryable: false,
    safe_message: "Cet email a été bloqué par la politique d'envoi. Une validation est requise.",
  },
  PIERRE_EMAIL_SEND_FAILED: {
    code: "PIERRE_EMAIL_SEND_FAILED",
    domain: "email",
    severity: "error",
    retryable: true,
    safe_message: "L'envoi de l'email a échoué. Réessai en cours.",
  },
  PIERRE_EMAIL_RECIPIENT_INVALID: {
    code: "PIERRE_EMAIL_RECIPIENT_INVALID",
    domain: "email",
    severity: "error",
    retryable: false,
    safe_message: "L'adresse email du destinataire est invalide.",
  },
  PIERRE_AI_CALL_FAILED: {
    code: "PIERRE_AI_CALL_FAILED",
    domain: "ai",
    severity: "error",
    retryable: true,
    safe_message: "Le service IA n'a pas répondu. Réessai en cours.",
  },
  PIERRE_AI_BUDGET_EXCEEDED: {
    code: "PIERRE_AI_BUDGET_EXCEEDED",
    domain: "ai",
    severity: "error",
    retryable: false,
    safe_message: "Quota IA atteint — contactez votre administrateur.",
  },
  PIERRE_AI_TIMEOUT: {
    code: "PIERRE_AI_TIMEOUT",
    domain: "ai",
    severity: "warning",
    retryable: true,
    safe_message: "Le service IA met trop de temps à répondre. Réessai en cours.",
  },
  PIERRE_DOCUMENT_GENERATION_FAILED: {
    code: "PIERRE_DOCUMENT_GENERATION_FAILED",
    domain: "document",
    severity: "error",
    retryable: true,
    safe_message: "La génération du document a échoué. Réessai en cours.",
  },
  PIERRE_PDF_RENDER_FAILED: {
    code: "PIERRE_PDF_RENDER_FAILED",
    domain: "pdf",
    severity: "error",
    retryable: true,
    safe_message: "La génération du PDF a échoué. Réessai en cours.",
  },
  PIERRE_RGPD_PURGE_BLOCKED: {
    code: "PIERRE_RGPD_PURGE_BLOCKED",
    domain: "rgpd",
    severity: "critical",
    retryable: false,
    safe_message: "La purge RGPD a été bloquée. Contactez votre DPO.",
  },
  PIERRE_SECURITY_VIOLATION: {
    code: "PIERRE_SECURITY_VIOLATION",
    domain: "security",
    severity: "critical",
    retryable: false,
    safe_message: "Une violation de sécurité a été détectée. L'action a été bloquée.",
  },
};

// ── Lookup functions ──────────────────────────────────────────────────────────

export function getPierreErrorMeta(code: PierreErrorCode): PierreErrorMeta {
  return PIERRE_ERROR_META[code];
}

export function isPierreErrorCode(code: string): code is PierreErrorCode {
  return code in PIERRE_ERROR_META;
}

export function isPierreCriticalNonRetryable(code: string): boolean {
  if (!isPierreErrorCode(code)) return false;
  const meta = PIERRE_ERROR_META[code];
  return meta.severity === "critical" && !meta.retryable;
}

export function isPierreRetryable(code: string): boolean {
  if (!isPierreErrorCode(code)) return false;
  return PIERRE_ERROR_META[code].retryable;
}

export function getPierreSafeMessage(code: string): string {
  if (isPierreErrorCode(code)) return PIERRE_ERROR_META[code].safe_message;
  return "Une erreur s'est produite. Veuillez réessayer ou contacter le support.";
}

// ── Non-retryable set (for policy enforcement) ────────────────────────────────

export const PIERRE_NON_RETRYABLE_CODES = new Set<string>(
  Object.values(PIERRE_ERROR_META)
    .filter((m) => !m.retryable)
    .map((m) => m.code),
);
