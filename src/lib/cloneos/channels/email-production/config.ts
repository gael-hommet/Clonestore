// src/lib/cloneos/channels/email-production/config.ts
// B39 — Email production config. Reads env vars. No async, no side effects.
// EMAIL_SEND_LIVE=false by default — real sends require explicit opt-in.

import type { EmailProductionConfig, EmailRuntimeMode, EmailRecipientPolicy, EmailRateLimitPolicy } from "./types";

// ── Mode resolver ─────────────────────────────────────────────────────────────

function resolveEmailRuntimeMode(): EmailRuntimeMode {
  const raw = process.env.EMAIL_RUNTIME_MODE?.toLowerCase().trim();

  // Emergency shutdown overrides everything
  if (process.env.AI_EMERGENCY_SHUTDOWN === "true") return "mock";

  if (raw === "live") {
    // live requires EMAIL_SEND_LIVE=true as an extra safety gate
    if (process.env.EMAIL_SEND_LIVE === "true") return "live";
    // EMAIL_RUNTIME_MODE=live without EMAIL_SEND_LIVE=true → sandbox
    return "sandbox";
  }
  if (raw === "sandbox") return "sandbox";
  if (raw === "dry_run") return "dry_run";

  // Default: mock. Safe for all tests and dev.
  return "mock";
}

// ── Recipient policy ──────────────────────────────────────────────────────────

function parsePatternList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function buildRecipientPolicy(): EmailRecipientPolicy {
  return {
    allowlist_patterns: parsePatternList(process.env.EMAIL_RECIPIENT_ALLOWLIST),
    blocklist_patterns: parsePatternList(process.env.EMAIL_RECIPIENT_BLOCKLIST),
    require_paid_customer: true, // never relaxed — non-paying = no email
    max_recipients_per_send: parseInt(process.env.EMAIL_MAX_RECIPIENTS_PER_SEND ?? "10", 10),
  };
}

// ── Rate limit policy ─────────────────────────────────────────────────────────

function buildRateLimitPolicy(): EmailRateLimitPolicy {
  return {
    max_hourly_per_company: parseInt(process.env.EMAIL_RATE_HOURLY_PER_COMPANY ?? "50", 10),
    max_daily_per_company: parseInt(process.env.EMAIL_RATE_DAILY_PER_COMPANY ?? "200", 10),
    max_hourly_per_user: parseInt(process.env.EMAIL_RATE_HOURLY_PER_USER ?? "10", 10),
    max_daily_per_user: parseInt(process.env.EMAIL_RATE_DAILY_PER_USER ?? "50", 10),
  };
}

// ── Main config builder ───────────────────────────────────────────────────────

export function getEmailProductionConfig(): EmailProductionConfig {
  const mode = resolveEmailRuntimeMode();
  const sendLive = process.env.EMAIL_SEND_LIVE === "true";
  const dryRun = process.env.EMAIL_DRY_RUN !== "false"; // default: true (safe)

  return {
    mode,
    send_live: sendLive,
    dry_run: mode !== "live",
    // B39.1: dry_run never calls provider unless explicitly opted in
    dry_run_provider_calls: process.env.EMAIL_DRY_RUN_PROVIDER_CALLS === "true",
    sandbox_to: process.env.EMAIL_SANDBOX_TO ?? process.env.RESEND_SANDBOX_TO ?? null,
    // B39.1: sandbox never calls provider unless explicitly opted in + EMAIL_SEND_LIVE=true
    sandbox_send_live: process.env.EMAIL_SANDBOX_SEND_LIVE === "true" && sendLive,
    resend_api_key_present: !!(process.env.RESEND_API_KEY),
    default_from: process.env.RESEND_DEFAULT_FROM ?? "Pierre <noreply@clonestore.io>",
    log_body: process.env.EMAIL_LOG_BODY === "true",
    emergency_shutdown: process.env.AI_EMERGENCY_SHUTDOWN === "true",
    recipient_policy: buildRecipientPolicy(),
    rate_limit_policy: buildRateLimitPolicy(),
  };
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function isEmailLiveModeEnabled(): boolean {
  return resolveEmailRuntimeMode() === "live";
}

export function isEmailMockMode(): boolean {
  return resolveEmailRuntimeMode() === "mock";
}

export function isEmailEmergencyShutdown(): boolean {
  return process.env.AI_EMERGENCY_SHUTDOWN === "true";
}
