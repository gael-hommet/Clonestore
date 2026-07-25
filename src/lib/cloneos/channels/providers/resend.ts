// src/lib/cloneos/channels/providers/resend.ts
// B37 — Resend email provider adapter. Server-side only, production-gated.
// Never sends in test/mock mode. Never logs API keys. Never sends to real recipients by default.

import type { ChannelProviderAdapter, ChannelProviderSendParams, ChannelProviderSendResult } from "./types";
import type { ChannelKind } from "../types";

// ── Config helpers ────────────────────────────────────────────────────────────

function getEnvSafe(key: string): string | null {
  try {
    const v = process.env[key];
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  } catch {
    return null;
  }
}

function getEnvBool(key: string, fallback: boolean): boolean {
  const raw = getEnvSafe(key);
  if (raw === null) return fallback;
  return raw.toLowerCase() === "true";
}

// ── Resend config ─────────────────────────────────────────────────────────────

export type ResendProviderConfig = {
  api_key_present: boolean;
  email_provider: string | null;
  default_from: string | null;
  allowed_from_domains: string[];
  sandbox_to: string | null;
  send_live: boolean;
  dry_run: boolean;
};

export function getResendConfig(): ResendProviderConfig {
  const api_key_present = getEnvSafe("RESEND_API_KEY") !== null;
  const email_provider = getEnvSafe("EMAIL_PROVIDER");
  const default_from = getEnvSafe("RESEND_DEFAULT_FROM");
  const raw_domains = getEnvSafe("RESEND_ALLOWED_FROM_DOMAINS") ?? "";
  const allowed_from_domains = raw_domains
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
  const sandbox_to = getEnvSafe("RESEND_SANDBOX_TO");
  const send_live = getEnvBool("EMAIL_SEND_LIVE", false);
  const dry_run = getEnvBool("EMAIL_DRY_RUN", true);

  return {
    api_key_present,
    email_provider,
    default_from,
    allowed_from_domains,
    sandbox_to,
    send_live,
    dry_run,
  };
}

// ── Config validation ─────────────────────────────────────────────────────────

export function validateResendConfig(config: ResendProviderConfig): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!config.api_key_present) errors.push("RESEND_API_KEY manquante.");
  if (config.email_provider !== "resend") errors.push("EMAIL_PROVIDER !== 'resend'.");
  return { ok: errors.length === 0, errors };
}

// ── From domain guard ─────────────────────────────────────────────────────────

export function isFromDomainAllowed(from: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true; // No restriction configured
  const domain = from.includes("@") ? from.split("@")[1]?.toLowerCase() ?? "" : from.toLowerCase();
  return allowedDomains.some((d) => domain === d || domain.endsWith("." + d));
}

// ── Payload builder ───────────────────────────────────────────────────────────

export type ResendEmailPayload = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  subject: string;
  text?: string;
  html?: string;
};

export function buildResendPayload(
  envelope: ChannelProviderSendParams["envelope"],
  body: string | null,
  body_html: string | null,
  config: ResendProviderConfig,
): ResendEmailPayload {
  const to = config.sandbox_to ? [config.sandbox_to] : envelope.to;

  const payload: ResendEmailPayload = {
    from: envelope.from,
    to,
    subject: envelope.subject ?? "(Sans objet)",
  };

  if (envelope.cc?.length > 0 && !config.sandbox_to) payload.cc = envelope.cc;
  if (envelope.bcc?.length > 0 && !config.sandbox_to) payload.bcc = envelope.bcc;
  if (envelope.metadata?.reply_to && typeof envelope.metadata.reply_to === "string") {
    payload.reply_to = envelope.metadata.reply_to;
  }

  if (body_html) payload.html = body_html;
  if (body) payload.text = body;

  return payload;
}

// ── Error mapper ──────────────────────────────────────────────────────────────

export function mapResendError(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    // Never expose actual API key values, even in error messages
    const msg = typeof e.message === "string" ? e.message : JSON.stringify(e);
    const cleaned = msg.replace(/re_[A-Za-z0-9_-]{20,}/g, "re_[REDACTED]");
    return `Resend error: ${cleaned}`;
  }
  const raw = String(error);
  return `Resend error: ${raw.replace(/re_[A-Za-z0-9_-]{20,}/g, "re_[REDACTED]")}`;
}

// ── Provider adapter ──────────────────────────────────────────────────────────

export const resendChannelProvider: ChannelProviderAdapter = {
  id: "resend",

  supports(kind: ChannelKind): boolean {
    return kind === "email";
  },

  isConfigured(): boolean {
    const cfg = getResendConfig();
    return cfg.api_key_present && cfg.email_provider === "resend";
  },

  async send(params: ChannelProviderSendParams): Promise<ChannelProviderSendResult> {
    const { envelope, body, body_html } = params;
    const cfg = getResendConfig();

    // 1. Validate config
    const validation = validateResendConfig(cfg);
    if (!validation.ok) {
      return {
        ok: false,
        provider_message_id: null,
        error: `Resend non configuré: ${validation.errors.join(", ")}`,
        meta: { provider: "resend", configured: false },
      };
    }

    // 2. Channel must be email
    if (envelope.channel_kind !== "email") {
      return {
        ok: false,
        provider_message_id: null,
        error: `Resend ne supporte pas le canal: ${envelope.channel_kind}`,
        meta: { provider: "resend" },
      };
    }

    // 3. From domain guard
    if (!isFromDomainAllowed(envelope.from, cfg.allowed_from_domains)) {
      return {
        ok: false,
        provider_message_id: null,
        error: `Domaine expéditeur non autorisé: ${envelope.from}`,
        meta: { provider: "resend", from: envelope.from },
      };
    }

    // 4. Build payload
    const payload = buildResendPayload(envelope, body, body_html ?? null, cfg);

    // 5. Dry-run check — no real send if EMAIL_DRY_RUN=true or EMAIL_SEND_LIVE=false
    // P16E §3 (F11/F12) — a dry-run has NO provider acknowledgement. We must NOT fabricate a
    // provider_message_id (an id the caller could mistake for real delivery proof), and we must
    // signal `simulated:true` / `sent:false` so a caller in a LIVE context can detect that the
    // provider silently simulated and fail closed. The original recipient is NEVER marked
    // contacted: `actual_recipients` is empty (nothing left the process).
    if (cfg.dry_run || !cfg.send_live) {
      const sandbox_redirected = !!cfg.sandbox_to;
      return {
        ok: true,
        provider_message_id: null, // no fabricated id — a dry-run is not an acknowledgement
        error: null,
        meta: {
          provider: "resend",
          simulated: true,
          sent: false,
          outcome: "PREPARED",
          dry_run: true,
          send_live: cfg.send_live,
          sandbox_redirected,
          intended_recipients: envelope.to,
          actual_recipients: [], // nothing was actually transmitted
          sandbox_to: cfg.sandbox_to ?? null,
          payload_preview: {
            from: payload.from,
            to: payload.to,
            subject: payload.subject,
            has_html: !!payload.html,
            has_text: !!payload.text,
          },
        },
      };
    }

    // 6. Live send via Resend API (dynamic import — server-side only)
    try {
      const { Resend } = await import("resend");
      const apiKey = process.env.RESEND_API_KEY!;
      const client = new Resend(apiKey);

      const sendOptions = {
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        ...(payload.cc ? { cc: payload.cc } : {}),
        ...(payload.bcc ? { bcc: payload.bcc } : {}),
        ...(payload.reply_to ? { replyTo: payload.reply_to } : {}),
        ...(payload.html ? { html: payload.html } : {}),
        // text is required by Resend SDK when html is absent
        text: payload.text ?? payload.subject,
      } as Parameters<typeof client.emails.send>[0];

      const sendResult = await client.emails.send(sendOptions);

      if (sendResult.error) {
        return {
          ok: false,
          provider_message_id: null,
          error: mapResendError(sendResult.error),
          meta: { provider: "resend", live: true },
        };
      }

      // P16E §3 (F12) — when a sandbox address is configured the payload is redirected to it.
      // Label the redirect EXPLICITLY and record intended vs actual recipients so no caller/audit
      // can claim the ORIGINAL recipient was contacted. `sent:true` requires a real provider id.
      const sandbox_redirected = !!cfg.sandbox_to;
      const acknowledged = !!sendResult.data?.id;
      return {
        ok: true,
        provider_message_id: sendResult.data?.id ?? null,
        error: null,
        meta: {
          provider: "resend",
          live: true,
          simulated: false,
          sent: acknowledged,           // only a real provider id counts as sent
          outcome: acknowledged ? "PROVIDER_REQUEST_ACCEPTED" : "STATUS_UNKNOWN",
          sandbox_redirected,
          intended_recipients: envelope.to,
          actual_recipients: payload.to, // = [sandbox_to] when redirected
          sandbox_to: cfg.sandbox_to ?? null,
        },
      };
    } catch (err) {
      return {
        ok: false,
        provider_message_id: null,
        error: mapResendError(err),
        meta: { provider: "resend", live: true },
      };
    }
  },
};
