// src/lib/cloneos/channels/__tests__/p16e-f11-f12-truthful-email.test.ts
// P16E §3 (F11/F12) — l'email ne peut jamais revendiquer un envoi non prouvé.
//
// F11 — en mode LIVE, si le fournisseur simule silencieusement (le B37 Resend décide dry-run
//       depuis SON propre EMAIL_DRY_RUN alors que B39 se croit live), il renvoyait ok:true + un
//       provider_message_id FABRIQUÉ ; le runtime marquait sent:true + audit send_allowed.
//       Désormais : un envoi live EXIGE un accusé (provider_message_id non nul) ; sinon échec fermé.
// F12 — une redirection sandbox doit être ÉTIQUETÉE ; le destinataire d'origine n'est jamais
//       marqué contacté ; aucun id fabriqué.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resendChannelProvider } from "../providers/resend";
import { sendEmailProduction } from "../email-production/runtime";
import type { EmailProviderAdapter, EmailProviderSendInput, EmailProviderSendResult } from "../email-production/provider-adapter";
import type { EmailProductionConfig } from "../email-production/config";
import type { EmailSendContext, EmailSendPayload } from "../email-production/runtime";

// Fournisseur qui « réussit » SANS accusé (simulation silencieuse) — le cœur de F11.
function silentlySimulatingProvider(): EmailProviderAdapter {
  return {
    name: "fake",
    async send(_input: EmailProviderSendInput): Promise<EmailProviderSendResult> {
      return { ok: true, provider: "fake", provider_message_id: null, error: null };
    },
  };
}
function acknowledgingProvider(id = "prov_real_123"): EmailProviderAdapter {
  return {
    name: "fake",
    async send(): Promise<EmailProviderSendResult> {
      return { ok: true, provider: "fake", provider_message_id: id, error: null };
    },
  };
}

const ctx = (): EmailSendContext => ({
  company_id: "co", user_id: "u", access_level: "paid_customer", mission_id: null, task_id: null,
  employee_id: null, message_type: "notification", is_sensitive: false, is_official_document: false, approval_required: false,
});
const payload = (): EmailSendPayload => ({ from: "pierre@co.com", to: ["hr@client.com"], cc: [], bcc: [], subject: "S", body_text: "B", body_html: null, attachments: [] });
const liveConfig = (over: Partial<EmailProductionConfig> = {}): EmailProductionConfig => ({
  mode: "live", send_live: true, dry_run: false, dry_run_provider_calls: false, sandbox_to: null, sandbox_send_live: false,
  resend_api_key_present: true, default_from: "Pierre <noreply@test.com>", log_body: false, emergency_shutdown: false,
  recipient_policy: { allowlist_patterns: [], blocklist_patterns: [], require_paid_customer: true, max_recipients_per_send: 10 },
  rate_limit_policy: { max_hourly_per_company: 50, max_daily_per_company: 200, max_hourly_per_user: 10, max_daily_per_user: 50 },
  ...over,
} as EmailProductionConfig);

describe("P16E §3 F11 — le runtime live ne revendique pas 'sent' sans accusé", () => {
  it("provider live sans accusé (id null) ⇒ NON envoyé, échec fermé (jamais send_allowed)", async () => {
    const res = await sendEmailProduction(ctx(), payload(), { config: liveConfig(), provider: silentlySimulatingProvider() }) as Record<string, unknown>;
    expect(res.sent).toBe(false);
    expect(res.ok).toBe(false);
    expect(res.provider_message_id).toBeNull();
    expect((res.audit_event as Record<string, unknown>)?.event_type).not.toBe("send_allowed");
  });

  it("provider live AVEC accusé réel ⇒ envoyé avec preuve", async () => {
    const res = await sendEmailProduction(ctx(), payload(), { config: liveConfig(), provider: acknowledgingProvider("prov_xyz") }) as Record<string, unknown>;
    expect(res.sent).toBe(true);
    expect(res.provider_message_id).toBe("prov_xyz");
    expect((res.audit_event as Record<string, unknown>)?.event_type).toBe("send_allowed");
  });
});

describe("P16E §3 F11/F12 — le fournisseur Resend en dry-run est véridique", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_fake_key");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    vi.stubEnv("EMAIL_DRY_RUN", "true");
    vi.stubEnv("EMAIL_SEND_LIVE", "false");
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  const params = () => ({
    envelope: { id: "env1", channel_kind: "email" as const, from: "pierre@co.com", to: ["hr@client.com"], cc: [], bcc: [], subject: "S", metadata: {} },
    body: "B", body_html: null,
  });

  it("dry-run ⇒ aucun id fabriqué, simulated=true, sent=false, actual_recipients vide", async () => {
    const r = await resendChannelProvider.send(params() as never);
    expect(r.provider_message_id).toBeNull();
    expect(r.meta.simulated).toBe(true);
    expect(r.meta.sent).toBe(false);
    expect(r.meta.actual_recipients).toEqual([]);
    expect(r.meta.intended_recipients).toEqual(["hr@client.com"]);
  });

  it("sandbox configuré ⇒ redirection ÉTIQUETÉE et destinataire d'origine jamais marqué contacté", async () => {
    vi.stubEnv("RESEND_SANDBOX_TO", "sandbox@clonestore.test");
    const r = await resendChannelProvider.send(params() as never);
    expect(r.meta.sandbox_redirected).toBe(true);
    expect(r.meta.intended_recipients).toEqual(["hr@client.com"]); // l'original, non contacté
    expect(r.meta.actual_recipients).toEqual([]); // dry-run: rien n'est parti
    expect(r.meta.sent).toBe(false);
  });
});
