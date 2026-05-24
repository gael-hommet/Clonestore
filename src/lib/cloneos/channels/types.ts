// src/lib/cloneos/channels/types.ts
// B33 — CloneStore Contact & Channel Identity Layer — core types.
// Pure types only: no async, no DB, no side effects.

// ── Enumerations ──────────────────────────────────────────────────────────────

export type ChannelKind =
  | "email"
  | "phone"
  | "sms"
  | "voice"
  | "whatsapp"
  | "teams"
  | "slack"
  | "web_form"
  | "internal_inbox"
  | "other";

export type ChannelDirection =
  | "inbound"
  | "outbound"
  | "bidirectional";

export type ChannelStatus =
  | "draft"
  | "pending_verification"
  | "active"
  | "suspended"
  | "revoked"
  | "failed"
  | "archived";

export type ChannelVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed"
  | "expired"
  | "revoked";

export type ChannelRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "sensitive"
  | "blocked";

export type ChannelAutonomyLevel =
  | "draft_only"
  | "low_risk_auto"
  | "validation_required"
  | "advanced_governed"
  | "custom_enterprise";

export type ChannelMessageType =
  | "notification"
  | "document"
  | "hr_communication"
  | "alert"
  | "confirmation"
  | "reminder"
  | "internal"
  | "sensitive"
  | "draft"
  | "other";

export type ChannelEnvelopeStatus =
  | "pending"
  | "approved"
  | "sent"
  | "delivered"
  | "failed"
  | "blocked"
  | "draft"
  | "received";

export type ChannelRuntimeMode =
  | "mock"
  | "disabled"
  | "production";

// ── Channel Identity ──────────────────────────────────────────────────────────

export type ChannelIdentity = {
  id: string;
  company_id: string;
  agent_slug: string;
  channel_kind: ChannelKind;
  direction: ChannelDirection;
  label: string;
  address_or_identifier: string;
  display_name: string | null;
  reply_to: string | null;
  signature: string | null;
  status: ChannelStatus;
  verification_status: ChannelVerificationStatus;
  provider: string | null;
  external_ref: string | null;
  site_id: string | null;
  manager_id: string | null;
  allowed_sender_user_ids: string[];
  allowed_recipient_patterns: string[];
  forbidden_recipient_patterns: string[];
  allowed_message_types: ChannelMessageType[];
  blocked_message_types: ChannelMessageType[];
  autonomy_level: ChannelAutonomyLevel;
  requires_human_validation_by_default: boolean;
  max_daily_sends: number | null;
  max_hourly_sends: number | null;
  created_at: string | null;
  updated_at: string | null;
  verified_at: string | null;
  revoked_at: string | null;
};

// ── Message Envelope ──────────────────────────────────────────────────────────

export type MessageEnvelopeAttachment = {
  filename: string;
  content_type: string;
  size_bytes: number | null;
  url: string | null;
};

export type MessageEnvelope = {
  id: string;
  company_id: string;
  agent_slug: string;
  channel_identity_id: string;
  direction: ChannelDirection;
  channel_kind: ChannelKind;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: MessageEnvelopeAttachment[];
  received_at: string | null;
  sent_at: string | null;
  status: ChannelEnvelopeStatus;
  risk_level: ChannelRiskLevel;
  approval_required: boolean;
  related_mission_id: string | null;
  related_task_id: string | null;
  related_employee_id: string | null;
  metadata: Record<string, unknown>;
};

// ── Send Request / Result ─────────────────────────────────────────────────────

export type ChannelSendRequest = {
  company_id: string;
  agent_slug: string;
  channel_identity_id: string;
  to: string[];
  subject: string | null;
  body: string;
  body_html?: string | null;
  attachments?: MessageEnvelopeAttachment[];
  message_type: ChannelMessageType;
  risk_level?: ChannelRiskLevel;
  approval_required?: boolean;
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;
  requested_by_user_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type ChannelTraceEvent = {
  id: string;
  channel_identity_id: string;
  envelope_id: string | null;
  event_type: string;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type ChannelSendResult = {
  ok: boolean;
  status: ChannelEnvelopeStatus;
  provider_message_id: string | null;
  envelope: MessageEnvelope | null;
  blocked_reason: string | null;
  approval_required: boolean;
  trace_events: ChannelTraceEvent[];
  error: string | null;
};

// ── Guard Decision ────────────────────────────────────────────────────────────

export type ChannelGuardDecision = {
  allowed: boolean;
  approval_required: boolean;
  risk_level: ChannelRiskLevel;
  blocked_reason: string | null;
  warnings: string[];
};

// ── Inbound message (normalized from raw provider payload) ────────────────────

export type InboundMessage = {
  id: string;
  channel_kind: ChannelKind;
  from: string;
  to: string[];
  subject: string | null;
  body_text: string | null;
  received_at: string;
  raw: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

// ── Channel Send Usage (for rate limiting) ────────────────────────────────────

export type ChannelSendUsage = {
  channel_identity_id: string;
  sends_last_hour: number;
  sends_today: number;
};

// ── Provider adapter interface (implemented in providers/) ────────────────────

export type ChannelProviderSendParams = {
  identity: ChannelIdentity;
  envelope: MessageEnvelope;
  request: ChannelSendRequest;
  runtime_mode: ChannelRuntimeMode;
};

export type ChannelProviderAdapter = {
  id: string;
  supports(kind: ChannelKind): boolean;
  isConfigured(): boolean;
  send(params: ChannelProviderSendParams): Promise<{
    ok: boolean;
    provider_message_id: string | null;
    status: ChannelEnvelopeStatus;
    error: string | null;
  }>;
};

// ── Validation result ─────────────────────────────────────────────────────────

export type ChannelValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};
