// B43 — Pierre-specific observable event builders

import type { ObservableEventDomain, ObservableEventStatus, ObservabilitySeverity } from "../../observability/types";
import type { ObservableEventInput } from "../../observability/event-log";
import { buildObservableEvent } from "../../observability/event-log";
import type { PierreErrorCode } from "./pierre-error-taxonomy";
import { getPierreErrorMeta, getPierreSafeMessage } from "./pierre-error-taxonomy";

// ── Shared context for all Pierre events ──────────────────────────────────────

export type PierreEventContext = {
  correlation_id: string;
  causation_id?: string | null;
  company_id?: string | null;
  user_id?: string | null;
  mission_id?: string | null;
  task_id?: string | null;
  agent_slug?: string;
};

// ── Mission events ────────────────────────────────────────────────────────────

export function buildMissionSubmittedEvent(
  ctx: PierreEventContext,
  meta: { input_preview: string; domain: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "mission",
    event_type: "mission.submitted",
    status: "started",
    severity: "info",
    message: `Mission soumise — domaine: ${meta.domain}`,
    safe_user_message: "Pierre analyse votre demande.",
    metadata: { domain: meta.domain, input_length: meta.input_preview.length },
  });
}

export function buildMissionCompletedEvent(
  ctx: PierreEventContext,
  meta: { task_count: number; domain: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "mission",
    event_type: "mission.completed",
    status: "succeeded",
    severity: "info",
    message: `Mission complétée — ${meta.task_count} tâche(s) générée(s)`,
    safe_user_message: `Pierre a généré ${meta.task_count} tâche(s).`,
    metadata: { task_count: meta.task_count, domain: meta.domain },
  });
}

export function buildMissionBlockedEvent(
  ctx: PierreEventContext,
  meta: { reason: string; domain: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "mission",
    event_type: "mission.blocked",
    status: "blocked",
    severity: "warning",
    message: `Mission bloquée — ${meta.reason}`,
    safe_user_message: "Cette mission nécessite une validation avant de continuer.",
    metadata: { reason: meta.reason, domain: meta.domain },
  });
}

// ── Task events ───────────────────────────────────────────────────────────────

export function buildTaskStartedEvent(
  ctx: PierreEventContext,
  meta: { task_type: string; task_id: string },
) {
  return buildObservableEvent({
    ...ctx,
    task_id: meta.task_id,
    domain: "task",
    event_type: "task.started",
    status: "started",
    severity: "info",
    message: `Tâche démarrée — type: ${meta.task_type}`,
    safe_user_message: null,
    metadata: { task_type: meta.task_type },
  });
}

export function buildTaskCompletedEvent(
  ctx: PierreEventContext,
  meta: { task_type: string; task_id: string; duration_ms?: number },
) {
  return buildObservableEvent({
    ...ctx,
    task_id: meta.task_id,
    domain: "task",
    event_type: "task.completed",
    status: "succeeded",
    severity: "info",
    message: `Tâche complétée — type: ${meta.task_type}`,
    safe_user_message: null,
    metadata: { task_type: meta.task_type, duration_ms: meta.duration_ms },
  });
}

export function buildTaskFailedEvent(
  ctx: PierreEventContext,
  meta: { task_type: string; task_id: string; error_code: string },
) {
  return buildObservableEvent({
    ...ctx,
    task_id: meta.task_id,
    domain: "task",
    event_type: "task.failed",
    status: "failed",
    severity: "error",
    message: `Tâche échouée — type: ${meta.task_type}, code: ${meta.error_code}`,
    safe_user_message: getPierreSafeMessage(meta.error_code),
    error_code: meta.error_code,
    metadata: { task_type: meta.task_type },
  });
}

export function buildTaskApprovalRequiredEvent(
  ctx: PierreEventContext,
  meta: { task_type: string; task_id: string; reason: string },
) {
  return buildObservableEvent({
    ...ctx,
    task_id: meta.task_id,
    domain: "task",
    event_type: "task.approval_required",
    status: "blocked",
    severity: "info",
    message: `Approbation requise — type: ${meta.task_type}`,
    safe_user_message: "Cette tâche nécessite une validation humaine.",
    error_code: "PIERRE_TASK_APPROVAL_REQUIRED",
    metadata: { task_type: meta.task_type, reason: meta.reason },
  });
}

// ── AI events ─────────────────────────────────────────────────────────────────

export function buildAiCallStartedEvent(ctx: PierreEventContext, meta: { purpose: string }) {
  return buildObservableEvent({
    ...ctx,
    domain: "ai",
    event_type: "ai.call.started",
    status: "started",
    severity: "info",
    message: `Appel IA démarré — ${meta.purpose}`,
    safe_user_message: null,
    metadata: { purpose: meta.purpose },
  });
}

export function buildAiCallSucceededEvent(
  ctx: PierreEventContext,
  meta: { purpose: string; tokens_used?: number; duration_ms?: number },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "ai",
    event_type: "ai.call.succeeded",
    status: "succeeded",
    severity: "info",
    message: `Appel IA réussi — ${meta.purpose}`,
    safe_user_message: null,
    metadata: { purpose: meta.purpose, tokens_used: meta.tokens_used, duration_ms: meta.duration_ms },
  });
}

export function buildAiCallFailedEvent(
  ctx: PierreEventContext,
  meta: { purpose: string; error_code: PierreErrorCode; retryable: boolean },
) {
  const errorMeta = getPierreErrorMeta(meta.error_code);
  return buildObservableEvent({
    ...ctx,
    domain: "ai",
    event_type: "ai.call.failed",
    status: meta.retryable ? "retried" : "failed",
    severity: errorMeta.severity,
    message: `Appel IA échoué — ${meta.purpose} — code: ${meta.error_code}`,
    safe_user_message: errorMeta.safe_message,
    error_code: meta.error_code,
    metadata: { purpose: meta.purpose, retryable: meta.retryable },
  });
}

// ── Email events ──────────────────────────────────────────────────────────────

export function buildEmailPreparedEvent(
  ctx: PierreEventContext,
  meta: { template: string; recipient_domain?: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "email",
    event_type: "email.prepared",
    status: "started",
    severity: "info",
    message: `Email préparé — template: ${meta.template}`,
    safe_user_message: null,
    metadata: { template: meta.template, recipient_domain: meta.recipient_domain },
  });
}

export function buildEmailBlockedEvent(
  ctx: PierreEventContext,
  meta: { template: string; reason: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "email",
    event_type: "email.blocked",
    status: "blocked",
    severity: "warning",
    message: `Email bloqué — template: ${meta.template} — raison: ${meta.reason}`,
    safe_user_message: "Cet email a été bloqué par la politique d'envoi.",
    error_code: "PIERRE_EMAIL_BLOCKED_BY_POLICY",
    metadata: { template: meta.template, reason: meta.reason },
  });
}

export function buildEmailSentEvent(
  ctx: PierreEventContext,
  meta: { template: string; recipient_domain?: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "email",
    event_type: "email.sent",
    status: "succeeded",
    severity: "info",
    message: `Email envoyé — template: ${meta.template}`,
    safe_user_message: null,
    metadata: { template: meta.template, recipient_domain: meta.recipient_domain },
  });
}

// ── Security events ───────────────────────────────────────────────────────────

export function buildSecurityViolationEvent(
  ctx: PierreEventContext,
  meta: { violation_type: string; resource?: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "security",
    event_type: "security.violation",
    status: "failed",
    severity: "critical",
    message: `Violation de sécurité — type: ${meta.violation_type}`,
    safe_user_message: "Une violation de sécurité a été détectée. L'action a été bloquée.",
    error_code: "PIERRE_SECURITY_VIOLATION",
    metadata: { violation_type: meta.violation_type, resource: meta.resource },
  });
}

// ── Document events ───────────────────────────────────────────────────────────

export function buildDocumentGeneratedEvent(
  ctx: PierreEventContext,
  meta: { doc_type: string; duration_ms?: number },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "document",
    event_type: "document.generated",
    status: "succeeded",
    severity: "info",
    message: `Document généré — type: ${meta.doc_type}`,
    safe_user_message: null,
    metadata: { doc_type: meta.doc_type, duration_ms: meta.duration_ms },
  });
}

export function buildDocumentFailedEvent(
  ctx: PierreEventContext,
  meta: { doc_type: string; error_code: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "document",
    event_type: "document.failed",
    status: "failed",
    severity: "error",
    message: `Génération document échouée — type: ${meta.doc_type}`,
    safe_user_message: getPierreSafeMessage(meta.error_code),
    error_code: meta.error_code,
    metadata: { doc_type: meta.doc_type },
  });
}

// ── RGPD events ───────────────────────────────────────────────────────────────

export function buildRgpdPurgeBlockedEvent(
  ctx: PierreEventContext,
  meta: { reason: string; resource_id?: string },
) {
  return buildObservableEvent({
    ...ctx,
    domain: "rgpd",
    event_type: "rgpd.purge.blocked",
    status: "blocked",
    severity: "critical",
    message: `Purge RGPD bloquée — ${meta.reason}`,
    safe_user_message: "La purge RGPD a été bloquée. Contactez votre DPO.",
    error_code: "PIERRE_RGPD_PURGE_BLOCKED",
    metadata: { reason: meta.reason, resource_id: meta.resource_id },
  });
}
