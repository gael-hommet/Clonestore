// src/lib/cloneos/channels/verification.ts
// B33 — Channel ownership verification. Pure, no async, no DB.
// Callers supply the verified state from DB/session. This module decides.

import type { ChannelIdentity, ChannelValidationResult } from "./types";

// ── Verification checks ───────────────────────────────────────────────────────

export function isOwnerAuthorized(
  identity: ChannelIdentity,
  userId: string | null | undefined,
): boolean {
  if (!userId || typeof userId !== "string") return false;

  // If no allowed_sender_user_ids configured, any authenticated user is allowed
  if (!Array.isArray(identity.allowed_sender_user_ids) || identity.allowed_sender_user_ids.length === 0) {
    return true;
  }

  return identity.allowed_sender_user_ids.includes(userId);
}

export function requiresOwnerVerification(identity: ChannelIdentity): boolean {
  return (
    Array.isArray(identity.allowed_sender_user_ids) &&
    identity.allowed_sender_user_ids.length > 0
  );
}

export function checkChannelVerification(identity: ChannelIdentity): ChannelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (identity.verification_status === "not_started") {
    errors.push("Canal non vérifié : la vérification n'a pas encore démarré.");
  } else if (identity.verification_status === "pending") {
    errors.push("Canal en attente de vérification — envoi bloqué.");
  } else if (identity.verification_status === "failed") {
    errors.push("Vérification du canal échouée — envoi bloqué.");
  } else if (identity.verification_status === "expired") {
    errors.push("Vérification du canal expirée — re-vérification requise.");
  } else if (identity.verification_status === "revoked") {
    errors.push("Vérification du canal révoquée — envoi définitivement bloqué.");
  }

  if (identity.verification_status === "verified" && identity.verified_at === null) {
    warnings.push("Canal marqué vérifié mais sans date de vérification.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Status checks ─────────────────────────────────────────────────────────────

export function checkChannelStatusForSend(identity: ChannelIdentity): ChannelValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (identity.status) {
    case "draft":
      errors.push("Canal en état brouillon — activation requise avant envoi.");
      break;
    case "pending_verification":
      errors.push("Canal en attente de vérification — envoi bloqué.");
      break;
    case "suspended":
      errors.push("Canal suspendu — contact administrateur pour réactiver.");
      break;
    case "revoked":
      errors.push("Canal révoqué — envoi définitivement bloqué.");
      break;
    case "failed":
      errors.push("Canal en état d'erreur — envoi bloqué.");
      break;
    case "archived":
      errors.push("Canal archivé — envoi bloqué.");
      break;
    case "active":
      break; // OK
    default:
      warnings.push(`Statut de canal inconnu: "${identity.status}".`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ── Address / identifier normalization ───────────────────────────────────────

export function normalizeChannelAddress(address: string): string {
  return typeof address === "string" ? address.trim().toLowerCase() : "";
}

export function isEmailAddress(address: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim());
}

export function isPhoneNumber(address: string): boolean {
  return /^\+?[0-9\s\-().]{7,20}$/.test(address.trim());
}

export function isValidChannelAddress(kind: ChannelIdentity["channel_kind"], address: string): boolean {
  const normalized = normalizeChannelAddress(address);
  if (!normalized) return false;

  switch (kind) {
    case "email": return isEmailAddress(normalized);
    case "phone":
    case "sms":
    case "voice": return isPhoneNumber(address.trim());
    case "whatsapp": return isPhoneNumber(address.trim()) || isEmailAddress(normalized);
    case "teams":
    case "slack":
    case "web_form":
    case "internal_inbox":
    case "other": return normalized.length >= 2;
    default: return normalized.length >= 2;
  }
}
