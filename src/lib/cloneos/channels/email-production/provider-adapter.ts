// src/lib/cloneos/channels/email-production/provider-adapter.ts
// B39.1 — Injectable email provider adapter.
// Tests inject a fake adapter. Live uses Resend B37 adapter.
// Dry_run / sandbox / mock: no adapter called by default.

import type { EmailSendPayload, EmailProductionConfig } from "./types";

// ── Provider adapter interface ────────────────────────────────────────────────

export type EmailProviderSendInput = {
  payload: EmailSendPayload;
  effective_recipients: string[];
  mode: "dry_run" | "sandbox" | "live";
  sandbox_to: string | null;
  dry_run: boolean;
  metadata: Record<string, unknown>;
};

export type EmailProviderSendResult = {
  ok: boolean;
  provider: string;
  provider_message_id: string | null;
  error: string | null;
};

export type EmailProviderAdapter = {
  name: string;
  send(input: EmailProviderSendInput): Promise<EmailProviderSendResult>;
};

// ── Mock adapter (always safe, no network) ────────────────────────────────────

export function createMockEmailProviderAdapter(): EmailProviderAdapter {
  return {
    name: "mock",
    async send(input): Promise<EmailProviderSendResult> {
      return {
        ok: true,
        provider: "mock",
        provider_message_id: `mock_${Date.now().toString(36)}`,
        error: null,
      };
    },
  };
}

// ── Resend adapter (wraps B37 provider) ───────────────────────────────────────
// Only used for live or sandbox_send_live. Never for dry_run or mock.

export function createResendEmailProviderAdapter(): EmailProviderAdapter {
  return {
    name: "resend",
    async send(input): Promise<EmailProviderSendResult> {
      const { resendChannelProvider } = await import("../providers/resend");

      if (!resendChannelProvider.isConfigured()) {
        return {
          ok: false,
          provider: "resend",
          provider_message_id: null,
          error: "RESEND_API_KEY manquant — provider Resend non configuré.",
        };
      }

      const fakeEnvelope = {
        id: `env_b39_${Date.now().toString(36)}`,
        company_id: "b39",
        agent_slug: "pierre",
        channel_identity_id: "b39_runtime",
        direction: "outbound" as const,
        channel_kind: "email" as const,
        from: input.payload.from,
        to: input.effective_recipients,
        cc: [] as string[],
        bcc: [] as string[],
        subject: input.payload.subject,
        body_text: input.payload.body_text,
        body_html: input.payload.body_html ?? null,
        attachments: (input.payload.attachments ?? []).map((a) => ({
          filename: a.filename,
          content_type: a.content_type,
          size_bytes: null,
          url: null,
        })),
        received_at: null,
        sent_at: null,
        status: "pending" as const,
        risk_level: "low" as const,
        approval_required: false,
        related_mission_id: null,
        related_task_id: null,
        related_employee_id: null,
        metadata: { b39: true, ...input.metadata },
      };

      const result = await resendChannelProvider.send({
        envelope: fakeEnvelope,
        body: input.payload.body_text,
        body_html: input.payload.body_html ?? null,
      });

      return {
        ok: result.ok,
        provider: "resend",
        provider_message_id: result.provider_message_id,
        error: result.error,
      };
    },
  };
}

// ── Default adapter resolver ──────────────────────────────────────────────────
// Returns the correct adapter based on config.
// Tests override by injecting a fake adapter directly.

export function getDefaultEmailProviderAdapter(config: EmailProductionConfig): EmailProviderAdapter | null {
  if (config.mode === "mock") return null;
  if (config.mode === "dry_run" && !config.dry_run_provider_calls) return null;
  if (config.mode === "sandbox" && !config.sandbox_send_live) return null;

  // Live mode: require API key
  if (config.mode === "live") {
    if (!config.resend_api_key_present) return null;
    return createResendEmailProviderAdapter();
  }

  // Sandbox live or dry_run with provider calls
  if (config.resend_api_key_present) {
    return createResendEmailProviderAdapter();
  }

  return null;
}
