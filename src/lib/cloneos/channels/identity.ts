// src/lib/cloneos/channels/identity.ts
// B33 — ChannelIdentity helpers: validation, status checks, defaults.
// Pure, no async, no DB, no side effects.

import type {
  ChannelIdentity,
  ChannelKind,
  ChannelDirection,
  ChannelRiskLevel,
  ChannelValidationResult,
  ChannelAutonomyLevel,
} from "./types";

// ── Status checks ─────────────────────────────────────────────────────────────

export function isChannelActive(identity: ChannelIdentity): boolean {
  return identity.status === "active";
}

export function isChannelVerified(identity: ChannelIdentity): boolean {
  return identity.verification_status === "verified";
}

export function isChannelOutbound(identity: ChannelIdentity): boolean {
  return identity.direction === "outbound" || identity.direction === "bidirectional";
}

export function isChannelInbound(identity: ChannelIdentity): boolean {
  return identity.direction === "inbound" || identity.direction === "bidirectional";
}

export function isChannelRevoked(identity: ChannelIdentity): boolean {
  return identity.status === "revoked";
}

export function isChannelSuspended(identity: ChannelIdentity): boolean {
  return identity.status === "suspended";
}

export function isChannelUsable(identity: ChannelIdentity): boolean {
  return identity.status === "active" && identity.verification_status === "verified";
}

// ── Risk level helpers ────────────────────────────────────────────────────────

export function getChannelDefaultRiskLevel(identity: ChannelIdentity): ChannelRiskLevel {
  if (identity.autonomy_level === "draft_only") return "high";
  if (identity.autonomy_level === "validation_required") return "medium";
  if (identity.autonomy_level === "advanced_governed") return "low";
  if (identity.channel_kind === "voice" || identity.channel_kind === "phone") return "medium";
  if (identity.channel_kind === "whatsapp" || identity.channel_kind === "sms") return "medium";
  return "low";
}

export function channelRequiresHumanValidation(
  identity: ChannelIdentity,
  riskLevel: ChannelRiskLevel,
): boolean {
  if (identity.requires_human_validation_by_default) return true;
  if (riskLevel === "sensitive" || riskLevel === "blocked") return true;
  if (identity.autonomy_level === "draft_only" || identity.autonomy_level === "validation_required") return true;
  return false;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateChannelIdentity(identity: unknown): ChannelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!identity || typeof identity !== "object") {
    return { ok: false, errors: ["Channel identity is not an object."], warnings };
  }

  const id = identity as Partial<ChannelIdentity>;

  if (!id.id || typeof id.id !== "string" || id.id.trim().length === 0) {
    errors.push("Channel identity id is missing.");
  }
  if (!id.company_id || typeof id.company_id !== "string" || id.company_id.trim().length === 0) {
    errors.push("Channel identity company_id is required.");
  }
  if (!id.agent_slug || typeof id.agent_slug !== "string" || id.agent_slug.trim().length === 0) {
    errors.push("Channel identity agent_slug is required.");
  }
  if (!id.channel_kind || typeof id.channel_kind !== "string") {
    errors.push("Channel identity channel_kind is required.");
  }
  if (!id.direction || typeof id.direction !== "string") {
    errors.push("Channel identity direction is required.");
  }
  if (!id.address_or_identifier || typeof id.address_or_identifier !== "string" || id.address_or_identifier.trim().length === 0) {
    errors.push("Channel identity address_or_identifier is required.");
  }
  if (!id.status || typeof id.status !== "string") {
    errors.push("Channel identity status is required.");
  }
  if (!id.verification_status || typeof id.verification_status !== "string") {
    errors.push("Channel identity verification_status is required.");
  }

  // Warnings
  if (!id.label || (typeof id.label === "string" && id.label.trim().length === 0)) {
    warnings.push("Channel identity label is empty.");
  }
  if (id.max_daily_sends === null || id.max_daily_sends === undefined) {
    warnings.push("No max_daily_sends configured — global default will apply.");
  }
  if (!Array.isArray(id.allowed_message_types) || id.allowed_message_types.length === 0) {
    warnings.push("No allowed_message_types configured — all types assumed allowed.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Factory / defaults ────────────────────────────────────────────────────────

export function buildDefaultChannelIdentity(overrides: Partial<ChannelIdentity> & {
  id: string;
  company_id: string;
  agent_slug: string;
  channel_kind: ChannelKind;
  direction: ChannelDirection;
  address_or_identifier: string;
}): ChannelIdentity {
  return {
    label: overrides.address_or_identifier,
    display_name: null,
    reply_to: null,
    signature: null,
    status: "draft",
    verification_status: "not_started",
    provider: null,
    external_ref: null,
    site_id: null,
    manager_id: null,
    allowed_sender_user_ids: [],
    allowed_recipient_patterns: [],
    forbidden_recipient_patterns: [],
    allowed_message_types: [],
    blocked_message_types: [],
    autonomy_level: "draft_only",
    requires_human_validation_by_default: true,
    max_daily_sends: null,
    max_hourly_sends: null,
    created_at: null,
    updated_at: null,
    verified_at: null,
    revoked_at: null,
    ...overrides,
  };
}

// ── Autonomy description ──────────────────────────────────────────────────────

export function describeChannelAutonomy(level: ChannelAutonomyLevel): string {
  switch (level) {
    case "draft_only": return "Brouillon uniquement — aucun envoi automatique autorisé.";
    case "low_risk_auto": return "Auto faible risque — envois automatiques pour messages non sensibles.";
    case "validation_required": return "Validation requise — tout envoi nécessite approbation humaine.";
    case "advanced_governed": return "Gouvernance avancée — envois selon politique CloneGuard complète.";
    case "custom_enterprise": return "Gouvernance entreprise personnalisée.";
  }
}
