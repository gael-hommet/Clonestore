// src/lib/cloneos/channels/email-production/recipient-policy.ts
// B39 — Recipient allowlist/blocklist enforcement.
// Pure functions. No async, no DB, no env reads (policy passed in).

import type { EmailRecipientPolicy } from "./types";

// ── Pattern matcher ───────────────────────────────────────────────────────────
// Supports simple glob: * = any chars, no regex injection.

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesPattern(email: string, pattern: string): boolean {
  try {
    return globToRegex(pattern).test(email.trim().toLowerCase());
  } catch {
    return false;
  }
}

function matchesAnyPattern(email: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  return patterns.some((p) => matchesPattern(email, p));
}

// ── Individual recipient checks ───────────────────────────────────────────────

export type RecipientCheckResult = {
  allowed: boolean;
  blocked_reason: string | null;
};

export function checkRecipientAllowed(
  email: string,
  policy: EmailRecipientPolicy,
): RecipientCheckResult {
  if (!email || typeof email !== "string") {
    return { allowed: false, blocked_reason: "Adresse email invalide ou vide." };
  }

  // Blocklist wins over allowlist
  if (matchesAnyPattern(email, policy.blocklist_patterns)) {
    return {
      allowed: false,
      blocked_reason: `Destinataire bloqué par la politique de blocklist : ${email}`,
    };
  }

  // If allowlist is non-empty, recipient must match at least one pattern
  if (policy.allowlist_patterns.length > 0) {
    if (!matchesAnyPattern(email, policy.allowlist_patterns)) {
      return {
        allowed: false,
        blocked_reason: `Destinataire non dans la allowlist : ${email}`,
      };
    }
  }

  return { allowed: true, blocked_reason: null };
}

// ── Batch check ───────────────────────────────────────────────────────────────

export type BatchRecipientCheckResult = {
  all_allowed: boolean;
  blocked: Array<{ email: string; reason: string }>;
  allowed: string[];
};

export function checkAllRecipientsAllowed(
  recipients: string[],
  policy: EmailRecipientPolicy,
): BatchRecipientCheckResult {
  const blocked: Array<{ email: string; reason: string }> = [];
  const allowed: string[] = [];

  for (const email of recipients) {
    const result = checkRecipientAllowed(email, policy);
    if (result.allowed) {
      allowed.push(email);
    } else {
      blocked.push({ email, reason: result.blocked_reason ?? "Bloqué." });
    }
  }

  return {
    all_allowed: blocked.length === 0,
    blocked,
    allowed,
  };
}

export function checkRecipientCount(
  recipients: string[],
  policy: EmailRecipientPolicy,
): { ok: boolean; reason: string | null } {
  const total = recipients.length;
  if (total === 0) return { ok: false, reason: "Aucun destinataire fourni." };
  if (total > policy.max_recipients_per_send) {
    return {
      ok: false,
      reason: `Trop de destinataires : ${total} > max ${policy.max_recipients_per_send}`,
    };
  }
  return { ok: true, reason: null };
}
