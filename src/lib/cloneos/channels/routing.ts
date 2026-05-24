// src/lib/cloneos/channels/routing.ts
// B33 — Inbound message normalization and routing. Pure, no async, no DB.

import type {
  InboundMessage,
  MessageEnvelope,
  ChannelKind,
  ChannelRiskLevel,
} from "./types";
import { containsSensitiveContent } from "./guards";

// ── Channel kind detection ────────────────────────────────────────────────────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9\s\-().]{7,20}$/;

export function detectChannelKind(address: string): ChannelKind {
  const a = typeof address === "string" ? address.trim() : "";
  if (EMAIL_PATTERN.test(a)) return "email";
  if (PHONE_PATTERN.test(a)) return "sms";
  return "other";
}

// ── Inbound ID generation ─────────────────────────────────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function makeInboundId(from: string, ts: string): string {
  return `inb_${djb2(from + ":" + ts).toString(36)}_${Date.now().toString(36)}`;
}

// ── Risk level inference ──────────────────────────────────────────────────────

export function inferInboundRiskLevel(
  subject: string | null | undefined,
  body: string | null | undefined,
): ChannelRiskLevel {
  const text = [(subject ?? ""), (body ?? "")].join(" ");
  if (containsSensitiveContent(text)) return "sensitive";
  return "low";
}

// ── Normalize inbound ─────────────────────────────────────────────────────────

export function normalizeInboundMessage(raw: unknown): InboundMessage {
  const now = new Date().toISOString();

  if (!raw || typeof raw !== "object") {
    return {
      id: makeInboundId("unknown", now),
      channel_kind: "other",
      from: "",
      to: [],
      subject: null,
      body_text: null,
      received_at: now,
      raw: {},
      metadata: {},
    };
  }

  const r = raw as Record<string, unknown>;

  const from = typeof r.from === "string" ? r.from.trim() :
    typeof r.sender === "string" ? r.sender.trim() : "";

  const toRaw = Array.isArray(r.to) ? r.to :
    (typeof r.to === "string" ? [r.to] : []);
  const to = toRaw.map((t) => typeof t === "string" ? t.trim() : "").filter(Boolean);

  const subject = typeof r.subject === "string" ? r.subject.trim() || null : null;
  const bodyText = typeof r.body_text === "string" ? r.body_text.trim() || null :
    typeof r.body === "string" ? r.body.trim() || null :
    typeof r.text === "string" ? r.text.trim() || null : null;

  const receivedAt = typeof r.received_at === "string" ? r.received_at :
    typeof r.timestamp === "string" ? r.timestamp : now;

  const channelKind: ChannelKind = typeof r.channel_kind === "string"
    ? (r.channel_kind as ChannelKind)
    : detectChannelKind(from);

  return {
    id: makeInboundId(from || "unknown", receivedAt),
    channel_kind: channelKind,
    from,
    to,
    subject,
    body_text: bodyText,
    received_at: receivedAt,
    raw: r,
    metadata: typeof r.metadata === "object" && r.metadata !== null ? (r.metadata as Record<string, unknown>) : {},
  };
}

// ── Routing decision ──────────────────────────────────────────────────────────

export type InboundRoutingDecision = {
  should_process: boolean;
  channel_identity_id: string | null;
  matched_agent_slug: string | null;
  risk_level: ChannelRiskLevel;
  blocked_reason: string | null;
  metadata: Record<string, unknown>;
};

export function routeInboundEnvelope(params: {
  envelope: MessageEnvelope;
  registeredIdentities: { id: string; agent_slug: string; address_or_identifier: string; channel_kind: ChannelKind }[];
}): InboundRoutingDecision {
  const { envelope, registeredIdentities } = params;

  if (!envelope.from) {
    return {
      should_process: false,
      channel_identity_id: null,
      matched_agent_slug: null,
      risk_level: "blocked",
      blocked_reason: "Message entrant sans expéditeur identifié.",
      metadata: {},
    };
  }

  // Match inbound by recipient (envelope.to) against registered identities
  for (const identity of registeredIdentities) {
    const matchAddr = identity.address_or_identifier.trim().toLowerCase();
    const toMatch = envelope.to.map((t) => t.trim().toLowerCase());

    if (toMatch.includes(matchAddr) || toMatch.some((t) => t.includes(matchAddr))) {
      return {
        should_process: true,
        channel_identity_id: identity.id,
        matched_agent_slug: identity.agent_slug,
        risk_level: envelope.risk_level,
        blocked_reason: null,
        metadata: { matched_address: matchAddr },
      };
    }
  }

  return {
    should_process: false,
    channel_identity_id: null,
    matched_agent_slug: null,
    risk_level: "low",
    blocked_reason: "Aucun canal enregistré ne correspond aux destinataires.",
    metadata: { to: envelope.to },
  };
}
