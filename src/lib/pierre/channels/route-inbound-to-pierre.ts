// src/lib/pierre/channels/route-inbound-to-pierre.ts
// B33 — Routes normalized inbound envelopes to Pierre decisions. Pure, no async, no DB.

import type { MessageEnvelope, ChannelIdentity } from "../../cloneos/channels/types";
import { inferInboundRiskLevel } from "../../cloneos/channels/routing";
import { containsSensitiveContent } from "../../cloneos/channels/guards";
import { pierreCanAutoReply } from "./permissions";
import type { PierreInboundDecision, PierreInboundChannelRequest } from "./types";

// ── Route inbound envelope to Pierre action ───────────────────────────────────

export function routeInboundEnvelopeToPierre(params: {
  envelope: MessageEnvelope;
  identity: ChannelIdentity;
  existingMissionIds?: string[];
}): PierreInboundDecision {
  const { envelope, identity, existingMissionIds = [] } = params;

  // Must be inbound
  if (envelope.direction !== "inbound") {
    return {
      action: "ignored_not_for_pierre",
      channel_identity_id: identity.id,
      matched_agent_slug: identity.agent_slug,
      risk_level: "low",
      blocked_reason: "Enveloppe non entrante — ignorée.",
      suggested_mission_id: null,
      metadata: { direction: envelope.direction },
    };
  }

  // Must match Pierre's agent
  if (envelope.agent_slug !== identity.agent_slug) {
    return {
      action: "ignored_not_for_pierre",
      channel_identity_id: identity.id,
      matched_agent_slug: null,
      risk_level: "low",
      blocked_reason: "Agent non correspondant.",
      suggested_mission_id: null,
      metadata: { envelope_agent: envelope.agent_slug, identity_agent: identity.agent_slug },
    };
  }

  const riskLevel = inferInboundRiskLevel(envelope.subject, envelope.body_text);

  // Block sensitive content immediately
  if (riskLevel === "sensitive" || containsSensitiveContent(envelope.subject ?? "") || containsSensitiveContent(envelope.body_text ?? "")) {
    return {
      action: "blocked_sensitive",
      channel_identity_id: identity.id,
      matched_agent_slug: identity.agent_slug,
      risk_level: "sensitive",
      blocked_reason: "Contenu sensible détecté — validation humaine requise.",
      suggested_mission_id: null,
      metadata: { from: envelope.from },
    };
  }

  // Can Pierre auto-reply?
  if (!pierreCanAutoReply(identity, riskLevel)) {
    return {
      action: "ask_for_more_info",
      channel_identity_id: identity.id,
      matched_agent_slug: identity.agent_slug,
      risk_level: riskLevel,
      blocked_reason: "Canal nécessite validation humaine avant traitement automatique.",
      suggested_mission_id: null,
      metadata: { autonomy_level: identity.autonomy_level, requires_human_validation: identity.requires_human_validation_by_default },
    };
  }

  // Attach to existing mission if one is provided
  if (existingMissionIds.length > 0) {
    return {
      action: "attach_to_existing_mission",
      channel_identity_id: identity.id,
      matched_agent_slug: identity.agent_slug,
      risk_level: riskLevel,
      blocked_reason: null,
      suggested_mission_id: existingMissionIds[0],
      metadata: { from: envelope.from, existing_missions: existingMissionIds },
    };
  }

  // Default: create new mission
  return {
    action: "create_mission",
    channel_identity_id: identity.id,
    matched_agent_slug: identity.agent_slug,
    risk_level: riskLevel,
    blocked_reason: null,
    suggested_mission_id: null,
    metadata: { from: envelope.from, channel_kind: envelope.channel_kind },
  };
}

// ── Prepare Pierre channel send request from template ─────────────────────────

export function preparePierreChannelSend(params: {
  identity: ChannelIdentity;
  to: string[];
  subject: string | null;
  body: string;
  missionId?: string | null;
  taskId?: string | null;
  employeeId?: string | null;
  requestedByUserId?: string | null;
  messageType?: "hr_communication" | "notification" | "confirmation" | "reminder" | "other";
}): {
  channel_identity_id: string;
  company_id: string;
  agent_slug: string;
  to: string[];
  subject: string | null;
  body: string;
  message_type: "hr_communication" | "notification" | "confirmation" | "reminder" | "other";
  mission_id: string | null;
  task_id: string | null;
  employee_id: string | null;
  requested_by_user_id: string | null;
  approval_required: boolean;
} {
  const { identity } = params;
  return {
    channel_identity_id: identity.id,
    company_id: identity.company_id,
    agent_slug: identity.agent_slug,
    to: params.to,
    subject: params.subject,
    body: params.body,
    message_type: params.messageType ?? "hr_communication",
    mission_id: params.missionId ?? null,
    task_id: params.taskId ?? null,
    employee_id: params.employeeId ?? null,
    requested_by_user_id: params.requestedByUserId ?? null,
    approval_required: identity.requires_human_validation_by_default,
  };
}
