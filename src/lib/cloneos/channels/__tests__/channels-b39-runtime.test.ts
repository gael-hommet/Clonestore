// src/lib/cloneos/channels/__tests__/channels-b39-runtime.test.ts
// B39.1 — Direct tests on sendEmailProduction() runtime.
// Uses injectable fake provider — no real Resend, no network, no API key required.
// No OpenAI. No Anthropic. No AI credits. No real emails.

import { describe, it, expect, beforeEach } from "vitest";
import { sendEmailProduction } from "../email-production/runtime";
import { resetRateLimitCounters, getRateLimitCounters } from "../email-production/rate-limit";
import { clearAuditLog, getAuditLog } from "../email-production/audit";
import type {
  EmailSendContext,
  EmailSendPayload,
  EmailProductionConfig,
} from "../email-production/types";
import type { EmailProviderAdapter, EmailProviderSendInput, EmailProviderSendResult } from "../email-production/provider-adapter";

// ── Fake provider ─────────────────────────────────────────────────────────────

function makeFakeProvider(overrides: {
  ok?: boolean;
  error?: string | null;
  fail_with_throw?: boolean;
} = {}): EmailProviderAdapter & { calls: EmailProviderSendInput[] } {
  const calls: EmailProviderSendInput[] = [];
  return {
    name: "fake",
    calls,
    async send(input: EmailProviderSendInput): Promise<EmailProviderSendResult> {
      calls.push(input);
      if (overrides.fail_with_throw) throw new Error("Provider threw an error");
      return {
        ok: overrides.ok ?? true,
        provider: "fake",
        provider_message_id: overrides.ok === false ? null : `fake_${Date.now().toString(36)}`,
        error: overrides.ok === false ? (overrides.error ?? "Provider error") : null,
      };
    },
  };
}

// ── Factories ─────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<EmailSendContext> = {}): EmailSendContext {
  return {
    company_id: "co_rt_test",
    user_id: "usr_rt_test",
    access_level: "paid_customer",
    mission_id: null,
    task_id: null,
    employee_id: null,
    message_type: "notification",
    is_sensitive: false,
    is_official_document: false,
    approval_required: false,
    ...overrides,
  };
}

function makePayload(overrides: Partial<EmailSendPayload> = {}): EmailSendPayload {
  return {
    from: "pierre@co.com",
    to: ["hr@client.com"],
    cc: [],
    bcc: [],
    subject: "Test notification",
    body_text: "Bonjour, test.",
    body_html: null,
    attachments: [],
    ...overrides,
  };
}

function makeConfig(overrides: Partial<EmailProductionConfig> = {}): EmailProductionConfig {
  return {
    mode: "mock",
    send_live: false,
    dry_run: true,
    dry_run_provider_calls: false,
    sandbox_to: null,
    sandbox_send_live: false,
    resend_api_key_present: false,
    default_from: "Pierre <noreply@test.com>",
    log_body: false,
    emergency_shutdown: false,
    recipient_policy: {
      allowlist_patterns: [],
      blocklist_patterns: [],
      require_paid_customer: true,
      max_recipients_per_send: 10,
    },
    rate_limit_policy: {
      max_hourly_per_company: 50,
      max_daily_per_company: 200,
      max_hourly_per_user: 10,
      max_daily_per_user: 50,
    },
    ...overrides,
  };
}

beforeEach(() => {
  resetRateLimitCounters();
  clearAuditLog();
});

// ── T1–T6: Blocked — provider never called ────────────────────────────────────

describe("B39.1 runtime — blocked: provider is never called", () => {
  it("T1: anonymous → ok=false, provider not called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext({ access_level: "anonymous" }),
      makePayload(),
      { config: makeConfig({ mode: "dry_run", dry_run_provider_calls: true }), provider },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_public_demo");
    expect(provider.calls).toHaveLength(0);
  });

  it("T2: logged_unpaid → ok=false, provider not called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext({ access_level: "logged_unpaid" }),
      makePayload(),
      { config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }), provider },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_unpaid_user");
    expect(provider.calls).toHaveLength(0);
  });

  it("T3: trial → ok=false, provider not called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext({ access_level: "trial" }),
      makePayload(),
      { config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }), provider },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_trial");
    expect(provider.calls).toHaveLength(0);
  });

  it("T4: sensitive without approval_required → ok=false, provider not called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext({ is_sensitive: true, approval_required: false }),
      makePayload(),
      { config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }), provider },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_sensitive_requires_validation");
    expect(provider.calls).toHaveLength(0);
  });

  it("T5: recipient blocklisted → ok=false, provider not called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext(),
      makePayload({ to: ["spam@blocked.com"] }),
      {
        config: makeConfig({
          mode: "live",
          send_live: true,
          resend_api_key_present: true,
          recipient_policy: {
            allowlist_patterns: [],
            blocklist_patterns: ["*@blocked.com"],
            require_paid_customer: true,
            max_recipients_per_send: 10,
          },
        }),
        provider,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_recipient_not_allowed");
    expect(provider.calls).toHaveLength(0);
  });

  it("T6: rate limit exceeded → ok=false, provider not called", async () => {
    const provider = makeFakeProvider();
    const config = makeConfig({
      mode: "live",
      send_live: true,
      resend_api_key_present: true,
      rate_limit_policy: {
        max_hourly_per_company: 1,
        max_daily_per_company: 10,
        max_hourly_per_user: 10,
        max_daily_per_user: 50,
      },
    });
    // First send: should pass (records counter)
    await sendEmailProduction(makeContext(), makePayload(), { config, provider });
    // Second send: rate limit exceeded
    const result = await sendEmailProduction(makeContext(), makePayload(), { config, provider });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_rate_limit_hourly");
    // Provider was called once (first send), not for the blocked one
    expect(provider.calls).toHaveLength(1);
  });
});

// ── T7–T11: Mock mode ─────────────────────────────────────────────────────────

describe("B39.1 runtime — mock mode", () => {
  it("T7: mock mode → ok=true, dry_run=true, sent=false, provider=mock", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "mock" }),
      provider,
    });
    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.provider).toBe("mock");
    expect(provider.calls).toHaveLength(0); // provider never called in mock mode
  });

  it("T8: mock mode creates audit event", async () => {
    await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "mock" }),
    });
    const logs = getAuditLog();
    expect(logs).toHaveLength(1);
    expect(logs[0].event_type).toBe("send_dry_run");
  });

  it("T9: mock mode — audit event never contains body text", async () => {
    await sendEmailProduction(
      makeContext(),
      makePayload({ body_text: "Contenu très confidentiel — licenciement" }),
      { config: makeConfig({ mode: "mock" }) },
    );
    const log = getAuditLog()[0];
    expect(JSON.stringify(log)).not.toContain("licenciement");
    expect(JSON.stringify(log)).not.toContain("Contenu");
  });
});

// ── T10–T13: Dry run mode ─────────────────────────────────────────────────────

describe("B39.1 runtime — dry_run mode", () => {
  it("T10: dry_run default — provider NOT called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "dry_run", dry_run_provider_calls: false }),
      provider,
    });
    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
    expect(result.sent).toBe(false);
    expect(provider.calls).toHaveLength(0);
  });

  it("T11: dry_run default → creates send_dry_run audit", async () => {
    await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "dry_run", dry_run_provider_calls: false }),
    });
    const logs = getAuditLog();
    expect(logs[0].event_type).toBe("send_dry_run");
  });

  it("T12: dry_run_provider_calls=true → provider IS called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "dry_run", dry_run_provider_calls: true }),
      provider,
    });
    expect(result.ok).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].dry_run).toBe(true);
  });

  it("T13: dry_run_provider_calls=true but no provider → still returns ok=true (graceful)", async () => {
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({
        mode: "dry_run",
        dry_run_provider_calls: true,
        resend_api_key_present: false,
      }),
      // no provider injected and no API key → getDefault returns null → graceful fallback
    });
    expect(result.ok).toBe(true);
    expect(result.dry_run).toBe(true);
  });
});

// ── T14–T17: Sandbox mode ─────────────────────────────────────────────────────

describe("B39.1 runtime — sandbox mode", () => {
  it("T14: sandbox default — provider NOT called", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({
        mode: "sandbox",
        sandbox_to: "sandbox@team.com",
        sandbox_send_live: false,
      }),
      provider,
    });
    expect(result.ok).toBe(true);
    expect(result.sandbox).toBe(true);
    expect(result.sent).toBe(false);
    expect(provider.calls).toHaveLength(0);
  });

  it("T15: sandbox redirects effective_recipients to sandbox_to", async () => {
    const result = await sendEmailProduction(
      makeContext(),
      makePayload({ to: ["real@client.com"] }),
      {
        config: makeConfig({
          mode: "sandbox",
          sandbox_to: "sandbox@team.com",
          sandbox_send_live: false,
        }),
      },
    );
    expect(result.effective_recipients).toContain("sandbox@team.com");
    expect(result.effective_recipients).not.toContain("real@client.com");
  });

  it("T16: sandbox creates send_sandbox audit", async () => {
    await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({
        mode: "sandbox",
        sandbox_to: "s@test.com",
        sandbox_send_live: false,
      }),
    });
    expect(getAuditLog()[0].event_type).toBe("send_sandbox");
  });

  it("T17: sandbox_send_live=true → provider called exactly once, only to sandbox_to", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext(),
      makePayload({ to: ["real@client.com"] }),
      {
        config: makeConfig({
          mode: "sandbox",
          sandbox_to: "sandbox@team.com",
          sandbox_send_live: true,
          send_live: true,
          resend_api_key_present: true,
        }),
        provider,
      },
    );
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].effective_recipients).toEqual(["sandbox@team.com"]);
    expect(provider.calls[0].effective_recipients).not.toContain("real@client.com");
    expect(result.sandbox).toBe(true);
  });
});

// ── T18–T25: Live mode ────────────────────────────────────────────────────────

describe("B39.1 runtime — live mode", () => {
  it("T18: live without provider → blocked_provider_not_configured", async () => {
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({
        mode: "live",
        send_live: true,
        resend_api_key_present: false,
        dry_run_provider_calls: false,
      }),
      // no provider injected
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked_provider_not_configured");
  });

  it("T19: live with fake provider → provider called exactly once", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    expect(result.ok).toBe(true);
    expect(provider.calls).toHaveLength(1);
  });

  it("T20: live success → sent=true, dry_run=false", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    expect(result.sent).toBe(true);
    expect(result.dry_run).toBe(false);
    expect(result.sandbox).toBe(false);
  });

  it("T21: live success → records rate limit counter", async () => {
    const provider = makeFakeProvider();
    await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    const counters = getRateLimitCounters("co_rt_test", "usr_rt_test");
    expect(counters.company_hourly).toBe(1);
  });

  it("T22: live success → audit event send_allowed", async () => {
    const provider = makeFakeProvider();
    await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    expect(getAuditLog()[0].event_type).toBe("send_allowed");
  });

  it("T23: live provider returns ok=false → result ok=false, sent=false", async () => {
    const provider = makeFakeProvider({ ok: false, error: "Resend API error" });
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    expect(result.ok).toBe(false);
    expect(result.sent).toBe(false);
    expect(result.error).toContain("Resend API error");
  });

  it("T24: live provider throws → result ok=false, send_failed audit", async () => {
    const provider = makeFakeProvider({ fail_with_throw: true });
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    expect(result.ok).toBe(false);
    expect(result.sent).toBe(false);
    expect(getAuditLog()[0].event_type).toBe("send_failed");
  });

  it("T25: live provider failure → rate limit NOT recorded", async () => {
    const provider = makeFakeProvider({ ok: false });
    await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
      provider,
    });
    const counters = getRateLimitCounters("co_rt_test", "usr_rt_test");
    expect(counters.company_hourly).toBe(0);
  });
});

// ── T26–T30: Audit integrity & absolute constraints ───────────────────────────

describe("B39.1 runtime — audit integrity & constraints", () => {
  it("T26: audit event never contains body_text content", async () => {
    await sendEmailProduction(
      makeContext(),
      makePayload({ body_text: "SECRET: clé RESEND_API_KEY=re_abc123" }),
      { config: makeConfig({ mode: "mock" }) },
    );
    const logJson = JSON.stringify(getAuditLog());
    expect(logJson).not.toContain("re_abc123");
    expect(logJson).not.toContain("SECRET");
    expect(logJson).not.toContain("RESEND_API_KEY");
  });

  it("T27: audit event subject_hash never contains full subject", async () => {
    await sendEmailProduction(
      makeContext(),
      makePayload({ subject: "Licenciement confidentiel — NE PAS DIFFUSER" }),
      { config: makeConfig({ mode: "mock" }) },
    );
    const log = getAuditLog()[0];
    expect(log.subject_hash).not.toContain("Licenciement");
    expect(log.subject_hash).not.toContain("confidentiel");
  });

  it("T28: provider receives no bcc when bcc is empty", async () => {
    const provider = makeFakeProvider();
    await sendEmailProduction(
      makeContext(),
      makePayload({ bcc: [] }),
      {
        config: makeConfig({
          mode: "dry_run",
          dry_run_provider_calls: true,
        }),
        provider,
      },
    );
    // provider was called but effective_recipients should not include empty bcc
    expect(provider.calls[0].effective_recipients).toHaveLength(1);
  });

  it("T29: effective_recipients are correct by mode (live)", async () => {
    const provider = makeFakeProvider();
    const result = await sendEmailProduction(
      makeContext(),
      makePayload({ to: ["a@client.com"], cc: ["b@client.com"], bcc: ["c@client.com"] }),
      {
        config: makeConfig({ mode: "live", send_live: true, resend_api_key_present: true }),
        provider,
      },
    );
    expect(result.effective_recipients).toContain("a@client.com");
    expect(result.effective_recipients).toContain("b@client.com");
    expect(result.effective_recipients).toContain("c@client.com");
  });

  it("T30: no RESEND_API_KEY required for mock/dry_run tests", async () => {
    // This test runs without any RESEND_API_KEY in env — must pass
    const result = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "mock" }),
    });
    expect(result.ok).toBe(true);
    const resultDry = await sendEmailProduction(makeContext(), makePayload(), {
      config: makeConfig({ mode: "dry_run", dry_run_provider_calls: false }),
    });
    expect(resultDry.ok).toBe(true);
  });
});
