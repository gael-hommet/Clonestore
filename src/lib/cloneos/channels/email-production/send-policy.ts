// src/lib/cloneos/channels/email-production/send-policy.ts
// B39 — Authorization policy for email sends.
// Pure: no async, no DB. Enforces: paid-only, mode checks, recipient checks, rate limits.

import type {
  EmailSendContext,
  EmailSendPayload,
  EmailSendPolicyDecision,
  EmailProductionConfig,
  EmailRuntimeMode,
  EmailSendAuthorizationStatus,
} from "./types";
import { checkAllRecipientsAllowed, checkRecipientCount } from "./recipient-policy";
import { checkRateLimit } from "./rate-limit";

// ── Blocked access levels ─────────────────────────────────────────────────────

const BLOCKED_ACCESS_LEVELS = new Set([
  "anonymous",
  "logged_unpaid",
  "trial",
]);

// ── Ref generator ─────────────────────────────────────────────────────────────

let _refCounter = 0;

function makeAuditRef(companyId: string): string {
  _refCounter = (_refCounter + 1) % 65536;
  return `b39_${companyId.slice(0, 8)}_${Date.now().toString(36)}_${_refCounter.toString(16)}`;
}

// ── Effective recipients (sandbox redirect) ───────────────────────────────────

function resolveEffectiveRecipients(
  payload: EmailSendPayload,
  mode: EmailRuntimeMode,
  sandboxTo: string | null,
): string[] {
  if (mode === "sandbox" && sandboxTo) {
    return [sandboxTo];
  }
  return [...payload.to, ...payload.cc, ...payload.bcc].filter(Boolean);
}

// ── Main policy decision ──────────────────────────────────────────────────────

export function decideEmailSendPolicy(
  context: EmailSendContext,
  payload: EmailSendPayload,
  config: EmailProductionConfig,
): EmailSendPolicyDecision {
  const auditRef = makeAuditRef(context.company_id);
  const mode = config.mode;

  const deny = (
    status: EmailSendAuthorizationStatus,
    reason: string,
  ): EmailSendPolicyDecision => ({
    allowed: false,
    status,
    mode,
    effective_recipients: [],
    dry_run_reason: null,
    blocked_reason: reason,
    requires_human_validation: false,
    audit_ref: auditRef,
  });

  // 1. Emergency shutdown
  if (config.emergency_shutdown) {
    return deny("blocked_emergency_shutdown", "Arrêt d'urgence actif — tous les emails bloqués.");
  }

  // 2. Mock mode — block real sends (tests use mock only)
  if (mode === "mock") {
    const effectiveRecipients = resolveEffectiveRecipients(payload, mode, config.sandbox_to);
    return {
      allowed: true,
      status: "blocked_mode_mock",
      mode,
      effective_recipients: effectiveRecipients,
      dry_run_reason: "Mode mock — aucun vrai envoi.",
      blocked_reason: null,
      requires_human_validation: false,
      audit_ref: auditRef,
    };
  }

  // 3. Access level — non-paying users are blocked
  if (context.access_level === "anonymous") {
    return deny("blocked_public_demo", "Visiteurs anonymes — 0€ IA, 0 email.");
  }
  if (context.access_level === "logged_unpaid") {
    return deny("blocked_unpaid_user", "Utilisateur non-payant — envoi email non autorisé.");
  }
  if (context.access_level === "trial") {
    return deny("blocked_trial", "Compte trial — envoi email non autorisé sans abonnement actif.");
  }

  // 4. Sensitive requires human validation — must not auto-send
  if (context.is_sensitive || context.message_type === "sensitive") {
    if (!context.approval_required) {
      return deny(
        "blocked_sensitive_requires_validation",
        "Email sensible — validation humaine obligatoire. Définissez approval_required=true.",
      );
    }
    // approved sensitive → proceed with human validation flag
  }

  // 5. Recipient count
  const countCheck = checkRecipientCount(
    [...payload.to, ...payload.cc, ...payload.bcc],
    config.recipient_policy,
  );
  if (!countCheck.ok) {
    return deny("blocked_recipient_not_allowed", countCheck.reason ?? "Trop de destinataires.");
  }

  // 6. Recipient allowlist/blocklist (skip in sandbox/dry_run — redirected anyway)
  if (mode === "live") {
    const recipientCheck = checkAllRecipientsAllowed(
      [...payload.to, ...payload.cc, ...payload.bcc],
      config.recipient_policy,
    );
    if (!recipientCheck.all_allowed) {
      const firstBlocked = recipientCheck.blocked[0];
      return deny(
        "blocked_recipient_not_allowed",
        firstBlocked?.reason ?? "Destinataire non autorisé.",
      );
    }
  }

  // 7. Rate limiting
  const rateCheck = checkRateLimit(
    context.company_id,
    context.user_id,
    config.rate_limit_policy,
  );
  if (!rateCheck.ok) {
    const status: EmailSendAuthorizationStatus =
      rateCheck.blocked_scope === "company_hourly" ? "blocked_rate_limit_hourly"
      : rateCheck.blocked_scope === "company_daily"  ? "blocked_rate_limit_daily"
      : rateCheck.blocked_scope === "user_hourly"    ? "blocked_rate_limit_hourly"
      : "blocked_rate_limit_daily";
    return deny(status, rateCheck.blocked_reason ?? "Limite de débit atteinte.");
  }

  // 8. Resolve effective recipients and mode-specific status
  const effectiveRecipients = resolveEffectiveRecipients(payload, mode, config.sandbox_to);

  if (mode === "dry_run") {
    return {
      allowed: true,
      status: "allowed_dry_run",
      mode,
      effective_recipients: effectiveRecipients,
      dry_run_reason: "Mode dry_run — appel provider simulé, aucune livraison réelle.",
      blocked_reason: null,
      requires_human_validation: context.is_sensitive || context.approval_required === true,
      audit_ref: auditRef,
    };
  }

  if (mode === "sandbox") {
    return {
      allowed: true,
      status: "allowed_sandbox",
      mode,
      effective_recipients: effectiveRecipients,
      dry_run_reason: `Mode sandbox — tous les emails redirigés vers ${config.sandbox_to ?? "(non configuré)"}.`,
      blocked_reason: null,
      requires_human_validation: context.is_sensitive || context.approval_required === true,
      audit_ref: auditRef,
    };
  }

  // live
  return {
    allowed: true,
    status: "allowed",
    mode,
    effective_recipients: effectiveRecipients,
    dry_run_reason: null,
    blocked_reason: null,
    requires_human_validation: context.is_sensitive || context.approval_required === true,
    audit_ref: auditRef,
  };
}

// ── Helper: is access level blocked? ────────────────────────────────────────

export function isAccessLevelBlockedForEmail(accessLevel: string): boolean {
  return BLOCKED_ACCESS_LEVELS.has(accessLevel);
}
