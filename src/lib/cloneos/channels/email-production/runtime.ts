// src/lib/cloneos/channels/email-production/runtime.ts
// B39.1 — Email production runtime. Hardened orchestrator.
// By default: mock → no provider, dry_run → no provider, sandbox → no provider.
// Provider is only called for: live (always), sandbox_live (opt-in), dry_run_provider_calls (opt-in).
// Does NOT call OpenAI or Anthropic. Does NOT consume AI credits.
// Provider is injectable for tests — no real Resend in test suite.

import type {
  EmailSendContext,
  EmailSendPayload,
  EmailSendResult,
  EmailProductionConfig,
} from "./types";
import { getEmailProductionConfig } from "./config";
import { decideEmailSendPolicy } from "./send-policy";
import { recordEmailSent } from "./rate-limit";
import { buildEmailAuditEvent, recordEmailAuditEvent, resolveAuditEventType } from "./audit";
import {
  getDefaultEmailProviderAdapter,
  type EmailProviderAdapter,
} from "./provider-adapter";

// ── Runtime options ───────────────────────────────────────────────────────────

export type EmailProductionSendOptions = {
  config?: EmailProductionConfig;
  provider?: EmailProviderAdapter;  // inject a fake provider in tests
};

// ── Helper: build blocked result ──────────────────────────────────────────────

function makeBlockedResult(
  decision: ReturnType<typeof decideEmailSendPolicy>,
  auditEvent: ReturnType<typeof buildEmailAuditEvent>,
): EmailSendResult {
  return {
    ok: false,
    status: decision.status,
    mode: decision.mode,
    provider: "none",
    provider_message_id: null,
    effective_recipients: [],
    dry_run: true,
    sent: false,
    sandbox: false,
    blocked_reason: decision.blocked_reason,
    requires_human_validation: decision.requires_human_validation,
    audit_event: auditEvent,
    error: decision.blocked_reason,
  };
}

// ── Main send orchestrator ────────────────────────────────────────────────────

export async function sendEmailProduction(
  context: EmailSendContext,
  payload: EmailSendPayload,
  options: EmailProductionSendOptions = {},
): Promise<EmailSendResult> {
  const config = options.config ?? getEmailProductionConfig();
  const decision = decideEmailSendPolicy(context, payload, config);

  // ── 1. Blocked (real blocks — not mock) ──────────────────────────────────

  if (!decision.allowed && decision.status !== "blocked_mode_mock") {
    const auditEvent = buildEmailAuditEvent({
      event_type: resolveAuditEventType(decision, false),
      context,
      decision,
      subject: payload.subject,
      provider: "none",
      provider_message_id: null,
      error: decision.blocked_reason,
    });
    recordEmailAuditEvent(auditEvent);
    return makeBlockedResult(decision, auditEvent);
  }

  // ── 2. Mock mode — no provider, fake result ───────────────────────────────

  if (config.mode === "mock" || decision.status === "blocked_mode_mock") {
    const auditEvent = buildEmailAuditEvent({
      event_type: "send_dry_run",
      context,
      decision,
      subject: payload.subject,
      provider: "mock",
      provider_message_id: `mock_${decision.audit_ref}`,
      error: null,
    });
    recordEmailAuditEvent(auditEvent);
    return {
      ok: true,
      status: decision.status,
      mode: "mock",
      provider: "mock",
      provider_message_id: `mock_${decision.audit_ref}`,
      effective_recipients: decision.effective_recipients,
      dry_run: true,
      sent: false,
      sandbox: false,
      blocked_reason: null,
      requires_human_validation: decision.requires_human_validation,
      audit_event: auditEvent,
      error: null,
    };
  }

  // ── 3. Dry run — no provider call by default ──────────────────────────────

  if (config.mode === "dry_run") {
    // Provider is only called if EMAIL_DRY_RUN_PROVIDER_CALLS=true
    if (!config.dry_run_provider_calls) {
      const auditEvent = buildEmailAuditEvent({
        event_type: "send_dry_run",
        context,
        decision,
        subject: payload.subject,
        provider: "dry_run",
        provider_message_id: null,
        error: null,
      });
      recordEmailAuditEvent(auditEvent);
      return {
        ok: true,
        status: decision.status,
        mode: "dry_run",
        provider: "dry_run",
        provider_message_id: null,
        effective_recipients: decision.effective_recipients,
        dry_run: true,
        sent: false,
        sandbox: false,
        blocked_reason: null,
        requires_human_validation: decision.requires_human_validation,
        audit_event: auditEvent,
        error: null,
      };
    }

    // dry_run_provider_calls=true — use injected or default provider
    const provider = options.provider ?? getDefaultEmailProviderAdapter(config);
    if (!provider) {
      const auditEvent = buildEmailAuditEvent({
        event_type: "send_dry_run",
        context,
        decision,
        subject: payload.subject,
        provider: "dry_run",
        provider_message_id: null,
        error: null,
      });
      recordEmailAuditEvent(auditEvent);
      return {
        ok: true,
        status: decision.status,
        mode: "dry_run",
        provider: "dry_run",
        provider_message_id: null,
        effective_recipients: decision.effective_recipients,
        dry_run: true,
        sent: false,
        sandbox: false,
        blocked_reason: null,
        requires_human_validation: decision.requires_human_validation,
        audit_event: auditEvent,
        error: null,
      };
    }

    const providerResult = await provider.send({
      payload,
      effective_recipients: decision.effective_recipients,
      mode: "dry_run",
      sandbox_to: config.sandbox_to,
      dry_run: true,
      metadata: { b39: true, mode: "dry_run" },
    });
    const auditEvent = buildEmailAuditEvent({
      event_type: providerResult.ok ? "send_dry_run" : "send_failed",
      context,
      decision,
      subject: payload.subject,
      provider: providerResult.provider,
      provider_message_id: providerResult.provider_message_id,
      error: providerResult.ok ? null : providerResult.error,
    });
    recordEmailAuditEvent(auditEvent);
    return {
      ok: providerResult.ok,
      status: decision.status,
      mode: "dry_run",
      provider: providerResult.provider,
      provider_message_id: providerResult.provider_message_id,
      effective_recipients: decision.effective_recipients,
      dry_run: true,
      sent: false,
      sandbox: false,
      blocked_reason: null,
      requires_human_validation: decision.requires_human_validation,
      audit_event: auditEvent,
      error: providerResult.ok ? null : providerResult.error,
    };
  }

  // ── 4. Sandbox — no provider call by default ──────────────────────────────

  if (config.mode === "sandbox") {
    // Provider is only called if sandbox_send_live=true (EMAIL_SANDBOX_SEND_LIVE=true + EMAIL_SEND_LIVE=true)
    if (!config.sandbox_send_live) {
      const auditEvent = buildEmailAuditEvent({
        event_type: "send_sandbox",
        context,
        decision,
        subject: payload.subject,
        provider: "sandbox",
        provider_message_id: null,
        error: null,
      });
      recordEmailAuditEvent(auditEvent);
      return {
        ok: true,
        status: decision.status,
        mode: "sandbox",
        provider: "sandbox",
        provider_message_id: null,
        effective_recipients: decision.effective_recipients,
        dry_run: true,
        sent: false,
        sandbox: true,
        blocked_reason: null,
        requires_human_validation: decision.requires_human_validation,
        audit_event: auditEvent,
        error: null,
      };
    }

    // sandbox_send_live=true — send to sandbox_to only
    const provider = options.provider ?? getDefaultEmailProviderAdapter(config);
    if (!provider) {
      const blockedDecision = {
        ...decision,
        status: "blocked_provider_not_configured" as const,
        blocked_reason: "Provider non configuré pour sandbox live (RESEND_API_KEY manquant).",
      };
      const auditEvent = buildEmailAuditEvent({
        event_type: "send_blocked",
        context,
        decision: blockedDecision,
        subject: payload.subject,
        provider: "none",
        provider_message_id: null,
        error: blockedDecision.blocked_reason,
      });
      recordEmailAuditEvent(auditEvent);
      return makeBlockedResult(blockedDecision, auditEvent);
    }

    const providerResult = await provider.send({
      payload,
      effective_recipients: decision.effective_recipients, // already set to [sandbox_to]
      mode: "sandbox",
      sandbox_to: config.sandbox_to,
      dry_run: false,
      metadata: { b39: true, mode: "sandbox" },
    });
    const auditEvent = buildEmailAuditEvent({
      event_type: providerResult.ok ? "send_sandbox" : "send_failed",
      context,
      decision,
      subject: payload.subject,
      provider: providerResult.provider,
      provider_message_id: providerResult.provider_message_id,
      error: providerResult.ok ? null : providerResult.error,
    });
    recordEmailAuditEvent(auditEvent);
    return {
      ok: providerResult.ok,
      status: decision.status,
      mode: "sandbox",
      provider: providerResult.provider,
      provider_message_id: providerResult.provider_message_id,
      effective_recipients: decision.effective_recipients,
      dry_run: true,
      sent: false,
      sandbox: true,
      blocked_reason: null,
      requires_human_validation: decision.requires_human_validation,
      audit_event: auditEvent,
      error: providerResult.ok ? null : providerResult.error,
    };
  }

  // ── 5. Live — provider required ───────────────────────────────────────────

  const provider = options.provider ?? getDefaultEmailProviderAdapter(config);

  if (!provider) {
    // No provider configured for live mode
    const blockedDecision = {
      ...decision,
      status: "blocked_provider_not_configured" as const,
      allowed: false,
      blocked_reason: "Provider non configuré pour live (RESEND_API_KEY manquant ou non activé).",
    };
    const auditEvent = buildEmailAuditEvent({
      event_type: "send_blocked",
      context,
      decision: blockedDecision,
      subject: payload.subject,
      provider: "none",
      provider_message_id: null,
      error: blockedDecision.blocked_reason,
    });
    recordEmailAuditEvent(auditEvent);
    return makeBlockedResult(blockedDecision, auditEvent);
  }

  // Call provider exactly once
  let providerResult;
  try {
    providerResult = await provider.send({
      payload,
      effective_recipients: decision.effective_recipients,
      mode: "live",
      sandbox_to: null,
      dry_run: false,
      metadata: { b39: true, mode: "live" },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const auditEvent = buildEmailAuditEvent({
      event_type: "send_failed",
      context,
      decision,
      subject: payload.subject,
      provider: provider.name,
      provider_message_id: null,
      error,
    });
    recordEmailAuditEvent(auditEvent);
    return {
      ok: false,
      status: decision.status,
      mode: "live",
      provider: provider.name,
      provider_message_id: null,
      effective_recipients: decision.effective_recipients,
      dry_run: false,
      sent: false,
      sandbox: false,
      blocked_reason: null,
      requires_human_validation: decision.requires_human_validation,
      audit_event: auditEvent,
      error,
    };
  }

  // Record rate limit on successful live send
  if (providerResult.ok) {
    recordEmailSent(context.company_id, context.user_id);
  }

  const eventType = providerResult.ok ? "send_allowed" : "send_failed";
  const auditEvent = buildEmailAuditEvent({
    event_type: eventType,
    context,
    decision,
    subject: payload.subject,
    provider: providerResult.provider,
    provider_message_id: providerResult.provider_message_id,
    error: providerResult.ok ? null : providerResult.error,
  });
  recordEmailAuditEvent(auditEvent);

  return {
    ok: providerResult.ok,
    status: decision.status,
    mode: "live",
    provider: providerResult.provider,
    provider_message_id: providerResult.provider_message_id,
    effective_recipients: decision.effective_recipients,
    dry_run: false,
    sent: providerResult.ok,
    sandbox: false,
    blocked_reason: null,
    requires_human_validation: decision.requires_human_validation,
    audit_event: auditEvent,
    error: providerResult.ok ? null : providerResult.error,
  };
}

// ── Public re-exports for convenience ────────────────────────────────────────

export { getEmailProductionConfig } from "./config";
export { decideEmailSendPolicy } from "./send-policy";
export { checkRateLimit, recordEmailSent, resetRateLimitCounters } from "./rate-limit";
export { checkRecipientAllowed, checkAllRecipientsAllowed } from "./recipient-policy";
export { getAuditLog, clearAuditLog, getAuditEventsByCompany } from "./audit";
export { createMockEmailProviderAdapter, createResendEmailProviderAdapter } from "./provider-adapter";
