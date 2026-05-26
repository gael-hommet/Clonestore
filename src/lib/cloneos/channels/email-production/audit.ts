// src/lib/cloneos/channels/email-production/audit.ts
// B39 — Structured audit events for email sends.
// Audit events are structured, redacted, and never contain full body or API keys.
// Memory store by default — no Supabase dependency.

import type {
  EmailAuditEvent,
  EmailAuditEventType,
  EmailSendContext,
  EmailSendPolicyDecision,
  EmailRuntimeMode,
  EmailSendAuthorizationStatus,
} from "./types";

// ── In-memory audit log (resets on restart) ───────────────────────────────────

const _auditLog: EmailAuditEvent[] = [];

export function getAuditLog(): Readonly<EmailAuditEvent[]> {
  return _auditLog;
}

export function clearAuditLog(): void {
  _auditLog.length = 0;
}

// ── Subject hash (never store full subject — privacy) ─────────────────────────

function hashSubjectPrefix(subject: string): string {
  const prefix = subject.slice(0, 6).replace(/\s+/g, "_");
  return `${prefix}_${subject.length}c`;
}

// ── Event builder ─────────────────────────────────────────────────────────────

export function buildEmailAuditEvent(params: {
  event_type: EmailAuditEventType;
  context: EmailSendContext;
  decision: EmailSendPolicyDecision;
  subject: string;
  provider: string;
  provider_message_id: string | null;
  error: string | null;
}): EmailAuditEvent {
  const { event_type, context, decision, subject, provider, provider_message_id, error } = params;

  return {
    event_type,
    audit_ref: decision.audit_ref,
    timestamp: new Date().toISOString(),
    company_id: context.company_id,
    user_id: context.user_id,
    mission_id: context.mission_id,
    mode: decision.mode,
    authorization_status: decision.status,
    recipient_count: decision.effective_recipients.length,
    effective_recipients: decision.effective_recipients,
    subject_hash: hashSubjectPrefix(subject),
    message_type: context.message_type,
    is_sensitive: context.is_sensitive,
    provider,
    provider_message_id,
    blocked_reason: decision.blocked_reason,
    error,
  };
}

// ── Record to in-memory log ───────────────────────────────────────────────────

export function recordEmailAuditEvent(event: EmailAuditEvent): void {
  _auditLog.push(event);
  // Warn on sensitive blocked events
  if (event.is_sensitive && event.event_type === "send_blocked") {
    console.warn(
      `[B39_AUDIT] Sensitive email blocked — ref=${event.audit_ref} company=${event.company_id}`,
    );
  }
}

// ── Derive event type from decision ──────────────────────────────────────────

export function resolveAuditEventType(
  decision: EmailSendPolicyDecision,
  providerOk: boolean,
): EmailAuditEventType {
  if (!decision.allowed) {
    const status = decision.status;
    if (status === "blocked_rate_limit_hourly" || status === "blocked_rate_limit_daily") {
      return "rate_limit_hit";
    }
    if (status === "blocked_recipient_not_allowed") {
      return "recipient_blocked";
    }
    return "send_blocked";
  }
  if (decision.mode === "dry_run") return "send_dry_run";
  if (decision.mode === "sandbox") return "send_sandbox";
  if (decision.mode === "mock") return "send_dry_run";
  if (!providerOk) return "send_failed";
  if (decision.requires_human_validation) return "send_approval_required";
  return "send_allowed";
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getAuditEventsByCompany(companyId: string): EmailAuditEvent[] {
  return _auditLog.filter((e) => e.company_id === companyId);
}

export function getAuditEventsByStatus(status: EmailSendAuthorizationStatus): EmailAuditEvent[] {
  return _auditLog.filter((e) => e.authorization_status === status);
}

export function countSentByCompany(companyId: string): number {
  return _auditLog.filter(
    (e) => e.company_id === companyId && (e.event_type === "send_allowed" || e.event_type === "send_sandbox"),
  ).length;
}
