// src/lib/cloneos/channels/email-production/types.ts
// B39 — Live email production types.
// More granular than B33 ChannelRuntimeMode (mock/disabled/production).
// Pure types — no logic, no env reads.

// ── Runtime mode ──────────────────────────────────────────────────────────────

export type EmailRuntimeMode =
  | "mock"      // No provider call. Returns fake result. Default — safe for all tests.
  | "dry_run"   // No provider call by default. Simulates policy without delivery. EMAIL_DRY_RUN_PROVIDER_CALLS=true opts in.
  | "sandbox"   // No provider call by default. Redirects to EMAIL_SANDBOX_TO. EMAIL_SANDBOX_SEND_LIVE=true opts in.
  | "live";     // Real delivery. Requires EMAIL_SEND_LIVE=true + RESEND_API_KEY + paid_customer. Paying customers only.

// ── Authorization status ──────────────────────────────────────────────────────

export type EmailSendAuthorizationStatus =
  | "allowed"
  | "allowed_dry_run"
  | "allowed_sandbox"
  | "blocked_not_paid"
  | "blocked_public_demo"
  | "blocked_unpaid_user"
  | "blocked_trial"
  | "blocked_recipient_not_allowed"
  | "blocked_rate_limit_hourly"
  | "blocked_rate_limit_daily"
  | "blocked_emergency_shutdown"
  | "blocked_sensitive_requires_validation"
  | "blocked_mode_mock"
  | "blocked_provider_not_configured";

// ── Access levels recognized by the email policy ─────────────────────────────

export type EmailAccessLevel =
  | "anonymous"
  | "logged_unpaid"
  | "trial"
  | "paid_customer"
  | "internal_admin";

// ── Recipient policy ──────────────────────────────────────────────────────────

export type EmailRecipientPolicy = {
  allowlist_patterns: string[];   // e.g. ["*@verified-client.com", "admin@*"] — empty = allow all
  blocklist_patterns: string[];   // e.g. ["*@competitor.com"] — always rejected
  require_paid_customer: boolean; // false = non-paying users are blocked regardless
  max_recipients_per_send: number;
};

// ── Rate limit policy ─────────────────────────────────────────────────────────

export type EmailRateLimitPolicy = {
  max_hourly_per_company: number;
  max_daily_per_company: number;
  max_hourly_per_user: number;
  max_daily_per_user: number;
};

// ── Send context ──────────────────────────────────────────────────────────────

export type EmailSendContext = {
  company_id: string;
  user_id: string | null;
  access_level: EmailAccessLevel;
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  message_type: EmailMessageType;
  is_sensitive: boolean;
  is_official_document: boolean;
  approval_required?: boolean;
  requested_by_user_id?: string | null;
};

// ── Message type ──────────────────────────────────────────────────────────────

export type EmailMessageType =
  | "hr_communication"
  | "notification"
  | "document"
  | "confirmation"
  | "reminder"
  | "sensitive"
  | "internal_alert"
  | "other";

// ── Email payload ─────────────────────────────────────────────────────────────

export type EmailSendPayload = {
  from: string;
  reply_to?: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body_text: string;
  body_html: string | null;
  attachments: EmailAttachment[];
};

export type EmailAttachment = {
  filename: string;
  content: string;   // base64
  content_type: string;
};

// ── Policy decision ───────────────────────────────────────────────────────────

export type EmailSendPolicyDecision = {
  allowed: boolean;
  status: EmailSendAuthorizationStatus;
  mode: EmailRuntimeMode;
  effective_recipients: string[];   // may be redirected (sandbox_to)
  dry_run_reason: string | null;
  blocked_reason: string | null;
  requires_human_validation: boolean;
  audit_ref: string;               // correlation id for audit trail
};

// ── Send result ───────────────────────────────────────────────────────────────

export type EmailSendResult = {
  ok: boolean;
  status: EmailSendAuthorizationStatus;
  mode: EmailRuntimeMode;
  provider: string;
  provider_message_id: string | null;
  effective_recipients: string[];
  dry_run: boolean;       // true for mock / dry_run / sandbox (no real delivery)
  sent: boolean;          // true only when live provider confirmed delivery
  sandbox: boolean;       // true when recipients were redirected to sandbox_to
  blocked_reason: string | null;
  requires_human_validation: boolean;
  audit_event: EmailAuditEvent;
  error: string | null;
};

// ── Audit event ───────────────────────────────────────────────────────────────

export type EmailAuditEventType =
  | "send_allowed"
  | "send_dry_run"
  | "send_sandbox"
  | "send_blocked"
  | "send_failed"
  | "send_approval_required"
  | "rate_limit_hit"
  | "recipient_blocked";

export type EmailAuditEvent = {
  event_type: EmailAuditEventType;
  audit_ref: string;
  timestamp: string;           // ISO 8601
  company_id: string;
  user_id: string | null;
  mission_id: string | null;
  mode: EmailRuntimeMode;
  authorization_status: EmailSendAuthorizationStatus;
  recipient_count: number;
  effective_recipients: string[];  // never stores full body
  subject_hash: string | null;    // SHA-like prefix, not full subject
  message_type: EmailMessageType;
  is_sensitive: boolean;
  provider: string;
  provider_message_id: string | null;
  blocked_reason: string | null;
  error: string | null;
};

// ── B39 config ────────────────────────────────────────────────────────────────

export type EmailProductionConfig = {
  mode: EmailRuntimeMode;
  send_live: boolean;
  dry_run: boolean;
  dry_run_provider_calls: boolean;    // B39.1: false by default — dry_run never calls provider
  sandbox_to: string | null;
  sandbox_send_live: boolean;         // B39.1: false by default — sandbox never calls provider
  resend_api_key_present: boolean;
  default_from: string;
  log_body: boolean;
  emergency_shutdown: boolean;
  recipient_policy: EmailRecipientPolicy;
  rate_limit_policy: EmailRateLimitPolicy;
};
