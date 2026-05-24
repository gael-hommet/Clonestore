// src/lib/cloneos/channels/runtime.ts
// B33 — Channel send/receive runtime. Orchestrates guards → envelope → provider → events.
// All sends are mock by default (CHANNEL_RUNTIME_MODE=mock). No real external calls without explicit config.

import type {
  ChannelIdentity,
  ChannelSendRequest,
  ChannelSendResult,
  ChannelSendUsage,
  InboundMessage,
} from "./types";
import type { InboundRoutingDecision } from "./routing";
import { getChannelConfig, getChannelRuntimeMode, isChannelDisabled } from "./config";
import { checkChannelSendGuards } from "./guards";
import { buildChannelEnvelope, buildInboundEnvelope } from "./envelopes";
import {
  buildSendBlockedEvent,
  buildSendAttemptEvent,
  buildSendSuccessEvent,
  buildSendFailedEvent,
  buildApprovalRequiredEvent,
  buildInboundReceivedEvent,
} from "./events";
import { normalizeInboundMessage, routeInboundEnvelope } from "./routing";
import { getProviderForMode } from "./providers/mock";
import type { ChannelProviderAdapter } from "./providers/types";

export type { InboundRoutingDecision };

// ── Re-exports for convenience ────────────────────────────────────────────────

export { normalizeInboundMessage, routeInboundEnvelope };

// ── Send orchestrator ─────────────────────────────────────────────────────────

export async function sendChannelMessage(params: {
  identity: ChannelIdentity;
  request: ChannelSendRequest;
  usage: ChannelSendUsage;
  provider?: ChannelProviderAdapter;
}): Promise<ChannelSendResult> {
  const { identity, request, usage } = params;
  const config = getChannelConfig();
  const mode = getChannelRuntimeMode();

  // 1. Disabled mode — block all sends
  if (isChannelDisabled()) {
    const envelope = buildChannelEnvelope({ identity, request, riskLevel: "blocked", approvalRequired: true });
    const blocked = buildSendBlockedEvent(identity, "Canal désactivé (CHANNEL_RUNTIME_MODE=disabled).");
    return {
      ok: false,
      status: "blocked",
      provider_message_id: null,
      envelope,
      blocked_reason: "Canal désactivé (CHANNEL_RUNTIME_MODE=disabled).",
      approval_required: false,
      trace_events: [blocked],
      error: null,
    };
  }

  // 2. Run send guards
  const guard = checkChannelSendGuards({ identity, request, usage, requestedByUserId: request.requested_by_user_id });

  if (!guard.allowed) {
    const envelope = buildChannelEnvelope({ identity, request, riskLevel: guard.risk_level, approvalRequired: guard.approval_required });
    const blocked = buildSendBlockedEvent(identity, guard.blocked_reason ?? "Bloqué par les gardes.", {
      risk_level: guard.risk_level,
      warnings: guard.warnings,
    });
    return {
      ok: false,
      status: "blocked",
      provider_message_id: null,
      envelope,
      blocked_reason: guard.blocked_reason,
      approval_required: guard.approval_required,
      trace_events: [blocked],
      error: null,
    };
  }

  // 3. Build envelope
  const envelope = buildChannelEnvelope({
    identity,
    request,
    riskLevel: guard.risk_level,
    approvalRequired: guard.approval_required,
    logBody: config.log_body,
  });

  const traceEvents = [];

  // 4. Approval required — queue without sending
  if (guard.approval_required) {
    traceEvents.push(buildApprovalRequiredEvent(identity, envelope, { warnings: guard.warnings }));
    return {
      ok: true,
      status: "pending",
      provider_message_id: null,
      envelope: { ...envelope, status: "pending" },
      blocked_reason: null,
      approval_required: true,
      trace_events: traceEvents,
      error: null,
    };
  }

  // 5. Resolve provider
  const provider = params.provider ?? getProviderForMode(mode);

  traceEvents.push(buildSendAttemptEvent(identity, envelope, { mode, warnings: guard.warnings }));

  if (!provider) {
    const failedEvent = buildSendFailedEvent(identity, envelope, "Aucun provider disponible pour ce mode.");
    traceEvents.push(failedEvent);
    return {
      ok: false,
      status: "failed",
      provider_message_id: null,
      envelope: { ...envelope, status: "failed" },
      blocked_reason: null,
      approval_required: false,
      trace_events: traceEvents,
      error: "Aucun provider disponible pour ce mode.",
    };
  }

  if (!provider.supports(identity.channel_kind)) {
    const failedEvent = buildSendFailedEvent(identity, envelope, `Provider "${provider.id}" ne supporte pas le canal ${identity.channel_kind}.`);
    traceEvents.push(failedEvent);
    return {
      ok: false,
      status: "failed",
      provider_message_id: null,
      envelope: { ...envelope, status: "failed" },
      blocked_reason: null,
      approval_required: false,
      trace_events: traceEvents,
      error: `Provider "${provider.id}" ne supporte pas le canal ${identity.channel_kind}.`,
    };
  }

  // 6. Send via provider
  let providerResult;
  try {
    providerResult = await provider.send({ envelope, body: request.body ?? null, body_html: request.body_html ?? null });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const failedEvent = buildSendFailedEvent(identity, envelope, error);
    traceEvents.push(failedEvent);
    return {
      ok: false,
      status: "failed",
      provider_message_id: null,
      envelope: { ...envelope, status: "failed" },
      blocked_reason: null,
      approval_required: false,
      trace_events: traceEvents,
      error,
    };
  }

  if (!providerResult.ok) {
    const error = providerResult.error ?? "Erreur provider inconnue.";
    traceEvents.push(buildSendFailedEvent(identity, envelope, error, providerResult.meta));
    return {
      ok: false,
      status: "failed",
      provider_message_id: null,
      envelope: { ...envelope, status: "failed" },
      blocked_reason: null,
      approval_required: false,
      trace_events: traceEvents,
      error,
    };
  }

  // 7. Success
  traceEvents.push(buildSendSuccessEvent(identity, envelope, providerResult.provider_message_id, providerResult.meta));

  return {
    ok: true,
    status: "sent",
    provider_message_id: providerResult.provider_message_id,
    envelope: { ...envelope, status: "sent" },
    blocked_reason: null,
    approval_required: false,
    trace_events: traceEvents,
    error: null,
  };
}

// ── Inbound receive orchestrator ──────────────────────────────────────────────

export function receiveInboundMessage(params: {
  raw: unknown;
  identity: ChannelIdentity;
  logBody?: boolean;
}): {
  inbound: InboundMessage;
  envelope: ReturnType<typeof buildInboundEnvelope>;
  trace_events: ReturnType<typeof buildInboundReceivedEvent>[];
} {
  const { raw, identity, logBody = false } = params;
  const inbound = normalizeInboundMessage(raw);

  const envelope = buildInboundEnvelope({
    identity,
    from: inbound.from,
    to: inbound.to,
    subject: inbound.subject,
    body_text: inbound.body_text,
    riskLevel: inbound.metadata?.risk_level as "low" | "medium" | "high" | "sensitive" | "blocked" | undefined,
    rawMessageId: inbound.id,
    logBody,
  });

  const traceEvents = [buildInboundReceivedEvent(identity, envelope, { from: inbound.from })];

  return { inbound, envelope, trace_events: traceEvents };
}
