// src/lib/cloneos/channels/events.ts
// B33 — Channel trace events builder. Pure, no async, no DB.
// Callers persist events; this module only builds them.

import type { ChannelTraceEvent, ChannelIdentity, MessageEnvelope } from "./types";

// ── ID generation ─────────────────────────────────────────────────────────────

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function makeEventId(channelId: string, eventType: string, ts: string): string {
  return `evt_${djb2(channelId + ":" + eventType + ":" + ts).toString(36)}_${Date.now().toString(36)}`;
}

// ── Event builder ─────────────────────────────────────────────────────────────

export function buildChannelTraceEvent(params: {
  channel_identity_id: string;
  envelope_id: string | null;
  event_type: string;
  message: string;
  meta?: Record<string, unknown>;
}): ChannelTraceEvent {
  const ts = new Date().toISOString();
  return {
    id: makeEventId(params.channel_identity_id, params.event_type, ts),
    channel_identity_id: params.channel_identity_id,
    envelope_id: params.envelope_id,
    event_type: params.event_type,
    message: params.message,
    meta: params.meta ?? {},
    created_at: ts,
  };
}

// ── Named event factories ─────────────────────────────────────────────────────

export function buildSendBlockedEvent(
  identity: ChannelIdentity,
  reason: string,
  meta?: Record<string, unknown>,
): ChannelTraceEvent {
  return buildChannelTraceEvent({
    channel_identity_id: identity.id,
    envelope_id: null,
    event_type: "send_blocked",
    message: `Envoi bloqué sur canal "${identity.label}": ${reason}`,
    meta: { channel_kind: identity.channel_kind, ...meta },
  });
}

export function buildSendAttemptEvent(
  identity: ChannelIdentity,
  envelope: MessageEnvelope,
  meta?: Record<string, unknown>,
): ChannelTraceEvent {
  return buildChannelTraceEvent({
    channel_identity_id: identity.id,
    envelope_id: envelope.id,
    event_type: "send_attempt",
    message: `Tentative d'envoi sur canal "${identity.label}" (${identity.channel_kind})`,
    meta: {
      to_count: envelope.to.length,
      risk_level: envelope.risk_level,
      approval_required: envelope.approval_required,
      channel_kind: identity.channel_kind,
      ...meta,
    },
  });
}

export function buildSendSuccessEvent(
  identity: ChannelIdentity,
  envelope: MessageEnvelope,
  providerMessageId: string | null,
  meta?: Record<string, unknown>,
): ChannelTraceEvent {
  return buildChannelTraceEvent({
    channel_identity_id: identity.id,
    envelope_id: envelope.id,
    event_type: "send_success",
    message: `Message envoyé avec succès sur canal "${identity.label}"`,
    meta: {
      provider_message_id: providerMessageId,
      channel_kind: identity.channel_kind,
      ...meta,
    },
  });
}

export function buildSendFailedEvent(
  identity: ChannelIdentity,
  envelope: MessageEnvelope | null,
  error: string,
  meta?: Record<string, unknown>,
): ChannelTraceEvent {
  return buildChannelTraceEvent({
    channel_identity_id: identity.id,
    envelope_id: envelope?.id ?? null,
    event_type: "send_failed",
    message: `Échec d'envoi sur canal "${identity.label}": ${error}`,
    meta: { channel_kind: identity.channel_kind, error, ...meta },
  });
}

export function buildApprovalRequiredEvent(
  identity: ChannelIdentity,
  envelope: MessageEnvelope,
  meta?: Record<string, unknown>,
): ChannelTraceEvent {
  return buildChannelTraceEvent({
    channel_identity_id: identity.id,
    envelope_id: envelope.id,
    event_type: "approval_required",
    message: `Validation humaine requise avant envoi sur canal "${identity.label}"`,
    meta: {
      risk_level: envelope.risk_level,
      channel_kind: identity.channel_kind,
      ...meta,
    },
  });
}

export function buildInboundReceivedEvent(
  identity: ChannelIdentity,
  envelope: MessageEnvelope,
  meta?: Record<string, unknown>,
): ChannelTraceEvent {
  return buildChannelTraceEvent({
    channel_identity_id: identity.id,
    envelope_id: envelope.id,
    event_type: "inbound_received",
    message: `Message entrant reçu sur canal "${identity.label}" (${identity.channel_kind})`,
    meta: {
      from: envelope.from,
      channel_kind: identity.channel_kind,
      ...meta,
    },
  });
}

export function buildChannelEventLog(events: ChannelTraceEvent[], logBody = false): Record<string, unknown>[] {
  return events.map((e) => {
    const base: Record<string, unknown> = {
      id: e.id,
      channel_identity_id: e.channel_identity_id,
      envelope_id: e.envelope_id,
      event_type: e.event_type,
      message: e.message,
      created_at: e.created_at,
    };
    if (logBody) {
      base.meta = e.meta;
    } else {
      // Strip any potentially sensitive fields from meta in trace output
      const { body: _b, body_text: _bt, body_html: _bh, ...safeMeta } = e.meta as Record<string, unknown>;
      if (Object.keys(safeMeta).length > 0) base.meta = safeMeta;
    }
    return base;
  });
}
