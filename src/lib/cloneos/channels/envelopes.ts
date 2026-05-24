// src/lib/cloneos/channels/envelopes.ts
// B33 — MessageEnvelope builder. Pure, no async, no DB.

import type {
  ChannelIdentity,
  ChannelSendRequest,
  MessageEnvelope,
  MessageEnvelopeAttachment,
  ChannelRiskLevel,
  ChannelEnvelopeStatus,
} from "./types";

// ── ID generation ─────────────────────────────────────────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

export function generateEnvelopeId(params: {
  channel_identity_id: string;
  direction: string;
  to: string[];
  created_at: string;
}): string {
  const seed = [params.channel_identity_id, params.direction, params.to.join(","), params.created_at].join(":");
  return `env_${djb2(seed).toString(36)}_${Date.now().toString(36)}`;
}

// ── Recipient normalization ───────────────────────────────────────────────────

export function normalizeEnvelopeRecipients(recipients: unknown): string[] {
  if (!recipients) return [];
  if (Array.isArray(recipients)) {
    return recipients
      .map((r) => (typeof r === "string" ? r.trim() : ""))
      .filter((r) => r.length > 0);
  }
  if (typeof recipients === "string") {
    return recipients
      .split(/[,;]/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
  }
  return [];
}

// ── Attachment normalization ──────────────────────────────────────────────────

export function normalizeAttachments(attachments: unknown): MessageEnvelopeAttachment[] {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((a) => a && typeof a === "object")
    .map((a) => {
      const att = a as Record<string, unknown>;
      return {
        filename: typeof att.filename === "string" ? att.filename : "attachment",
        content_type: typeof att.content_type === "string" ? att.content_type : "application/octet-stream",
        size_bytes: typeof att.size_bytes === "number" ? att.size_bytes : null,
        url: typeof att.url === "string" ? att.url : null,
      };
    });
}

// ── Body sanitization ─────────────────────────────────────────────────────────

export function sanitizeEnvelopeBody(body: string | null | undefined): string | null {
  if (typeof body !== "string" || body.trim().length === 0) return null;
  return body.slice(0, 100_000); // hard cap at 100k chars
}

// ── Envelope builder ──────────────────────────────────────────────────────────

export function buildChannelEnvelope(params: {
  identity: ChannelIdentity;
  request: ChannelSendRequest;
  riskLevel: ChannelRiskLevel;
  approvalRequired: boolean;
  status?: ChannelEnvelopeStatus;
  logBody?: boolean;
}): MessageEnvelope {
  const { identity, request, riskLevel, approvalRequired, logBody = false } = params;
  const now = new Date().toISOString();

  const id = generateEnvelopeId({
    channel_identity_id: identity.id,
    direction: "outbound",
    to: request.to,
    created_at: now,
  });

  const status: ChannelEnvelopeStatus = params.status ?? (approvalRequired ? "pending" : "pending");

  return {
    id,
    company_id: identity.company_id,
    agent_slug: identity.agent_slug,
    channel_identity_id: identity.id,
    direction: "outbound",
    channel_kind: identity.channel_kind,
    from: identity.address_or_identifier,
    to: normalizeEnvelopeRecipients(request.to),
    cc: [],
    bcc: [],
    subject: request.subject ?? null,
    // Only store body if log_body is true (privacy guard)
    body_text: logBody ? sanitizeEnvelopeBody(request.body) : null,
    body_html: logBody ? sanitizeEnvelopeBody(request.body_html ?? null) : null,
    attachments: normalizeAttachments(request.attachments),
    received_at: null,
    sent_at: status === "sent" ? now : null,
    status,
    risk_level: riskLevel,
    approval_required: approvalRequired,
    related_mission_id: request.mission_id ?? null,
    related_task_id: request.task_id ?? null,
    related_employee_id: request.employee_id ?? null,
    metadata: {
      message_type: request.message_type,
      requested_by_user_id: request.requested_by_user_id ?? null,
      ...(request.metadata ?? {}),
    },
  };
}

// ── Inbound envelope builder ──────────────────────────────────────────────────

export function buildInboundEnvelope(params: {
  identity: ChannelIdentity;
  from: string;
  to: string[];
  subject: string | null;
  body_text: string | null;
  riskLevel?: ChannelRiskLevel;
  rawMessageId?: string | null;
  logBody?: boolean;
}): MessageEnvelope {
  const { identity, from, to, subject, riskLevel = "low", logBody = false } = params;
  const now = new Date().toISOString();

  const id = generateEnvelopeId({
    channel_identity_id: identity.id,
    direction: "inbound",
    to,
    created_at: now,
  });

  return {
    id,
    company_id: identity.company_id,
    agent_slug: identity.agent_slug,
    channel_identity_id: identity.id,
    direction: "inbound",
    channel_kind: identity.channel_kind,
    from,
    to,
    cc: [],
    bcc: [],
    subject: subject ?? null,
    body_text: logBody ? sanitizeEnvelopeBody(params.body_text) : null,
    body_html: null,
    attachments: [],
    received_at: now,
    sent_at: null,
    status: "received",
    risk_level: riskLevel,
    approval_required: false,
    related_mission_id: null,
    related_task_id: null,
    related_employee_id: null,
    metadata: {
      raw_message_id: params.rawMessageId ?? null,
    },
  };
}
