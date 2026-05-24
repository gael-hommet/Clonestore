// src/lib/cloneos/channels/permissions.ts
// B33 — Channel send/receive permissions, rate limits. Pure, no async, no DB.
// Callers supply usage from DB/cache. This module decides.

import type {
  ChannelIdentity,
  ChannelSendRequest,
  ChannelSendUsage,
  ChannelMessageType,
  ChannelValidationResult,
} from "./types";
import { getChannelConfig } from "./config";

// ── Direction permission ──────────────────────────────────────────────────────

export function canSendFromChannel(identity: ChannelIdentity): ChannelValidationResult {
  if (identity.direction === "inbound") {
    return {
      ok: false,
      errors: [`Canal "${identity.label}" est inbound uniquement — envoi impossible.`],
      warnings: [],
    };
  }
  return { ok: true, errors: [], warnings: [] };
}

export function canReceiveOnChannel(identity: ChannelIdentity): ChannelValidationResult {
  if (identity.direction === "outbound") {
    return {
      ok: false,
      errors: [`Canal "${identity.label}" est outbound uniquement — réception impossible.`],
      warnings: [],
    };
  }
  return { ok: true, errors: [], warnings: [] };
}

// ── Recipient check ───────────────────────────────────────────────────────────

function matchesPattern(value: string, pattern: string): boolean {
  // Exact match or wildcard suffix (e.g., "@company.com" matches any email ending in @company.com)
  const safe = value.trim().toLowerCase();
  const pat = pattern.trim().toLowerCase();
  if (pat === "*") return true;
  if (pat.startsWith("*")) return safe.endsWith(pat.slice(1));
  if (pat.endsWith("*")) return safe.startsWith(pat.slice(0, -1));
  return safe === pat;
}

export function isRecipientAllowed(
  identity: ChannelIdentity,
  recipient: string,
): ChannelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!recipient || typeof recipient !== "string") {
    return { ok: false, errors: ["Recipient is empty."], warnings };
  }

  // Check forbidden patterns first (takes priority)
  const forbidden = Array.isArray(identity.forbidden_recipient_patterns)
    ? identity.forbidden_recipient_patterns
    : [];

  for (const pat of forbidden) {
    if (matchesPattern(recipient, pat)) {
      errors.push(`Destinataire "${recipient}" interdit par la politique du canal.`);
      return { ok: false, errors, warnings };
    }
  }

  // If allowed patterns defined, recipient must match one
  const allowed = Array.isArray(identity.allowed_recipient_patterns)
    ? identity.allowed_recipient_patterns
    : [];

  if (allowed.length > 0) {
    const isAllowed = allowed.some((pat) => matchesPattern(recipient, pat));
    if (!isAllowed) {
      warnings.push(`Destinataire "${recipient}" non dans les patterns autorisés du canal.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Message type permission ───────────────────────────────────────────────────

export function isMessageTypeAllowed(
  identity: ChannelIdentity,
  messageType: ChannelMessageType,
): ChannelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const blocked = Array.isArray(identity.blocked_message_types)
    ? identity.blocked_message_types
    : [];

  if (blocked.includes(messageType)) {
    errors.push(`Type de message "${messageType}" interdit sur ce canal.`);
    return { ok: false, errors, warnings };
  }

  const allowed = Array.isArray(identity.allowed_message_types)
    ? identity.allowed_message_types
    : [];

  // If no allowed types specified, all non-blocked types are permitted
  if (allowed.length > 0 && !allowed.includes(messageType)) {
    errors.push(`Type de message "${messageType}" non autorisé sur ce canal (types autorisés: ${allowed.join(", ")}).`);
    return { ok: false, errors, warnings };
  }

  return { ok: true, errors: [], warnings };
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

export function checkHourlyLimit(
  identity: ChannelIdentity,
  usage: ChannelSendUsage,
): ChannelValidationResult {
  const config = getChannelConfig();
  const max = identity.max_hourly_sends ?? config.max_hourly_sends_default;

  if (max <= 0) return { ok: true, errors: [], warnings: [] };

  if (usage.sends_last_hour >= max) {
    return {
      ok: false,
      errors: [`Limite horaire atteinte pour ce canal (${usage.sends_last_hour}/${max} envois/heure).`],
      warnings: [],
    };
  }

  if (usage.sends_last_hour >= max * 0.8) {
    return {
      ok: true,
      errors: [],
      warnings: [`Proche de la limite horaire (${usage.sends_last_hour}/${max} envois/heure).`],
    };
  }

  return { ok: true, errors: [], warnings: [] };
}

export function checkDailyLimit(
  identity: ChannelIdentity,
  usage: ChannelSendUsage,
): ChannelValidationResult {
  const config = getChannelConfig();
  const max = identity.max_daily_sends ?? config.max_daily_sends_default;

  if (max <= 0) return { ok: true, errors: [], warnings: [] };

  if (usage.sends_today >= max) {
    return {
      ok: false,
      errors: [`Limite journalière atteinte pour ce canal (${usage.sends_today}/${max} envois/jour).`],
      warnings: [],
    };
  }

  if (usage.sends_today >= max * 0.8) {
    return {
      ok: true,
      errors: [],
      warnings: [`Proche de la limite journalière (${usage.sends_today}/${max} envois/jour).`],
    };
  }

  return { ok: true, errors: [], warnings: [] };
}

// ── Aggregated permissions check for send request ────────────────────────────

export function checkSendPermissions(params: {
  identity: ChannelIdentity;
  request: ChannelSendRequest;
  usage: ChannelSendUsage;
}): ChannelValidationResult {
  const { identity, request, usage } = params;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Direction
  const dirCheck = canSendFromChannel(identity);
  errors.push(...dirCheck.errors);
  warnings.push(...dirCheck.warnings);
  if (!dirCheck.ok) return { ok: false, errors, warnings };

  // Message type
  const typeCheck = isMessageTypeAllowed(identity, request.message_type);
  errors.push(...typeCheck.errors);
  warnings.push(...typeCheck.warnings);

  // Recipients
  for (const recipient of request.to) {
    const recipCheck = isRecipientAllowed(identity, recipient);
    errors.push(...recipCheck.errors);
    warnings.push(...recipCheck.warnings);
  }

  // Rate limits
  const hourlyCheck = checkHourlyLimit(identity, usage);
  errors.push(...hourlyCheck.errors);
  warnings.push(...hourlyCheck.warnings);

  const dailyCheck = checkDailyLimit(identity, usage);
  errors.push(...dailyCheck.errors);
  warnings.push(...dailyCheck.warnings);

  return { ok: errors.length === 0, errors, warnings };
}
