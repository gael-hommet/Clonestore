// src/lib/cloneos/channels/__tests__/channels-b39-live-email.test.ts
// B39 — Live email production: policy, recipient, rate limit, audit, runtime.
// No real sends. No real API keys. No OpenAI. No Anthropic. No AI credits.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  decideEmailSendPolicy,
} from "../email-production/send-policy";
import {
  checkRecipientAllowed,
  checkAllRecipientsAllowed,
  checkRecipientCount,
  matchesPattern,
} from "../email-production/recipient-policy";
import {
  checkRateLimit,
  recordEmailSent,
  resetRateLimitCounters,
  getRateLimitCounters,
} from "../email-production/rate-limit";
import {
  buildEmailAuditEvent,
  resolveAuditEventType,
  getAuditLog,
  clearAuditLog,
  recordEmailAuditEvent,
} from "../email-production/audit";
import type {
  EmailSendContext,
  EmailSendPayload,
  EmailProductionConfig,
  EmailRecipientPolicy,
  EmailRateLimitPolicy,
} from "../email-production/types";

// ── Factories ─────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<EmailSendContext> = {}): EmailSendContext {
  return {
    company_id: "co_test",
    user_id: "usr_test",
    access_level: "paid_customer",
    mission_id: "mis_test",
    task_id: null,
    employee_id: null,
    message_type: "hr_communication",
    is_sensitive: false,
    is_official_document: false,
    approval_required: false,
    ...overrides,
  };
}

function makePayload(overrides: Partial<EmailSendPayload> = {}): EmailSendPayload {
  return {
    from: "pierre@company.com",
    to: ["hr@client.com"],
    cc: [],
    bcc: [],
    subject: "Test email RH",
    body_text: "Bonjour, ceci est un test.",
    body_html: null,
    attachments: [],
    ...overrides,
  };
}

function makeConfig(overrides: Partial<EmailProductionConfig> = {}): EmailProductionConfig {
  return {
    mode: "dry_run",
    send_live: false,
    dry_run: true,
    sandbox_to: null,
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

function makeRecipientPolicy(overrides: Partial<EmailRecipientPolicy> = {}): EmailRecipientPolicy {
  return {
    allowlist_patterns: [],
    blocklist_patterns: [],
    require_paid_customer: true,
    max_recipients_per_send: 10,
    ...overrides,
  };
}

function makeRateLimitPolicy(overrides: Partial<EmailRateLimitPolicy> = {}): EmailRateLimitPolicy {
  return {
    max_hourly_per_company: 5,
    max_daily_per_company: 20,
    max_hourly_per_user: 3,
    max_daily_per_user: 10,
    ...overrides,
  };
}

// ── T1–T8: Send policy — access level blocking ────────────────────────────────

describe("B39 — Send policy: access level enforcement", () => {
  it("T1: paid_customer + dry_run → allowed_dry_run", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("allowed_dry_run");
  });

  it("T2: anonymous → blocked_public_demo", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ access_level: "anonymous" }),
      makePayload(),
      makeConfig(),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_public_demo");
  });

  it("T3: logged_unpaid → blocked_unpaid_user", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ access_level: "logged_unpaid" }),
      makePayload(),
      makeConfig(),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_unpaid_user");
  });

  it("T4: trial → blocked_trial", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ access_level: "trial" }),
      makePayload(),
      makeConfig(),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_trial");
  });

  it("T5: internal_admin + dry_run → allowed_dry_run", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ access_level: "internal_admin" }),
      makePayload(),
      makeConfig(),
    );
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("allowed_dry_run");
  });

  it("T6: emergency_shutdown → blocked_emergency_shutdown regardless of access level", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ access_level: "internal_admin" }),
      makePayload(),
      makeConfig({ emergency_shutdown: true }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_emergency_shutdown");
  });

  it("T7: mock mode → blocked_mode_mock (treated as allowed with no delivery)", () => {
    const decision = decideEmailSendPolicy(
      makeContext(),
      makePayload(),
      makeConfig({ mode: "mock" }),
    );
    expect(decision.status).toBe("blocked_mode_mock");
    expect(decision.dry_run_reason).toContain("mock");
  });

  it("T8: sensitive without approval_required → blocked_sensitive_requires_validation", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ is_sensitive: true, approval_required: false }),
      makePayload(),
      makeConfig(),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_sensitive_requires_validation");
  });
});

// ── T9–T14: Send policy — mode and sandbox ────────────────────────────────────

describe("B39 — Send policy: mode resolution", () => {
  it("T9: sandbox mode → allowed_sandbox with effective_recipients=sandbox_to", () => {
    const decision = decideEmailSendPolicy(
      makeContext(),
      makePayload({ to: ["real@client.com"] }),
      makeConfig({ mode: "sandbox", sandbox_to: "sandbox@team.com" }),
    );
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("allowed_sandbox");
    expect(decision.effective_recipients).toContain("sandbox@team.com");
    expect(decision.effective_recipients).not.toContain("real@client.com");
  });

  it("T10: live mode paid_customer → allowed", () => {
    const decision = decideEmailSendPolicy(
      makeContext(),
      makePayload(),
      makeConfig({ mode: "live", send_live: true, dry_run: false }),
    );
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("allowed");
  });

  it("T11: sensitive + approval_required=true → requires_human_validation=true", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ is_sensitive: true, approval_required: true }),
      makePayload(),
      makeConfig(),
    );
    expect(decision.allowed).toBe(true);
    expect(decision.requires_human_validation).toBe(true);
  });

  it("T12: audit_ref is generated for every decision", () => {
    const d1 = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    const d2 = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    expect(d1.audit_ref).toBeTruthy();
    expect(d2.audit_ref).toBeTruthy();
    expect(d1.audit_ref).not.toBe(d2.audit_ref);
  });

  it("T13: dry_run reason is set for dry_run mode", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig({ mode: "dry_run" }));
    expect(decision.dry_run_reason).toBeTruthy();
    expect(decision.dry_run_reason).toContain("dry_run");
  });

  it("T14: too many recipients → blocked_recipient_not_allowed", () => {
    const decision = decideEmailSendPolicy(
      makeContext(),
      makePayload({ to: Array.from({ length: 15 }, (_, i) => `r${i}@client.com`) }),
      makeConfig(),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_recipient_not_allowed");
  });
});

// ── T15–T22: Recipient policy ─────────────────────────────────────────────────

describe("B39 — Recipient policy: allowlist / blocklist", () => {
  it("T15: empty allowlist → any recipient allowed", () => {
    const r = checkRecipientAllowed("anyone@any.com", makeRecipientPolicy());
    expect(r.allowed).toBe(true);
  });

  it("T16: allowlist set → only matching recipients allowed", () => {
    const policy = makeRecipientPolicy({ allowlist_patterns: ["*@verified.com"] });
    expect(checkRecipientAllowed("user@verified.com", policy).allowed).toBe(true);
    expect(checkRecipientAllowed("user@other.com", policy).allowed).toBe(false);
  });

  it("T17: blocklist wins over allowlist", () => {
    const policy = makeRecipientPolicy({
      allowlist_patterns: ["*@verified.com"],
      blocklist_patterns: ["blocked@verified.com"],
    });
    expect(checkRecipientAllowed("blocked@verified.com", policy).allowed).toBe(false);
    expect(checkRecipientAllowed("ok@verified.com", policy).allowed).toBe(true);
  });

  it("T18: blocklist blocks matching recipient", () => {
    const policy = makeRecipientPolicy({ blocklist_patterns: ["*@competitor.com"] });
    expect(checkRecipientAllowed("ceo@competitor.com", policy).allowed).toBe(false);
  });

  it("T19: batch check — all allowed returns all_allowed=true", () => {
    const result = checkAllRecipientsAllowed(["a@client.com", "b@client.com"], makeRecipientPolicy());
    expect(result.all_allowed).toBe(true);
    expect(result.allowed).toHaveLength(2);
  });

  it("T20: batch check — one blocked returns all_allowed=false", () => {
    const policy = makeRecipientPolicy({ blocklist_patterns: ["bad@spam.com"] });
    const result = checkAllRecipientsAllowed(["ok@client.com", "bad@spam.com"], policy);
    expect(result.all_allowed).toBe(false);
    expect(result.blocked).toHaveLength(1);
  });

  it("T21: glob pattern with wildcard works (case-insensitive)", () => {
    expect(matchesPattern("User@EXAMPLE.COM", "*@example.com")).toBe(true);
    expect(matchesPattern("user@other.com", "*@example.com")).toBe(false);
  });

  it("T22: checkRecipientCount — zero recipients → not ok", () => {
    const r = checkRecipientCount([], makeRecipientPolicy());
    expect(r.ok).toBe(false);
  });
});

// ── T23–T31: Rate limiting ────────────────────────────────────────────────────

describe("B39 — Rate limiting: in-memory counters", () => {
  beforeEach(() => resetRateLimitCounters());
  afterEach(() => resetRateLimitCounters());

  it("T23: first send → allowed", () => {
    const r = checkRateLimit("co_a", "usr_a", makeRateLimitPolicy());
    expect(r.ok).toBe(true);
  });

  it("T24: send below company hourly limit → allowed", () => {
    const policy = makeRateLimitPolicy({ max_hourly_per_company: 5 });
    for (let i = 0; i < 4; i++) recordEmailSent("co_b", null);
    expect(checkRateLimit("co_b", null, policy).ok).toBe(true);
  });

  it("T25: exceed company hourly limit → blocked_rate_limit_hourly", () => {
    const policy = makeRateLimitPolicy({ max_hourly_per_company: 3 });
    for (let i = 0; i < 3; i++) recordEmailSent("co_c", null);
    const r = checkRateLimit("co_c", null, policy);
    expect(r.ok).toBe(false);
    expect(r.blocked_scope).toBe("company_hourly");
  });

  it("T26: exceed user hourly limit → blocked", () => {
    const policy = makeRateLimitPolicy({ max_hourly_per_user: 2 });
    for (let i = 0; i < 2; i++) recordEmailSent("co_d", "usr_d");
    const r = checkRateLimit("co_d", "usr_d", policy);
    expect(r.ok).toBe(false);
    expect(r.blocked_scope).toBe("user_hourly");
  });

  it("T27: different companies have independent counters", () => {
    const policy = makeRateLimitPolicy({ max_hourly_per_company: 2 });
    for (let i = 0; i < 2; i++) recordEmailSent("co_x", null);
    expect(checkRateLimit("co_y", null, policy).ok).toBe(true);
  });

  it("T28: reset clears all counters", () => {
    const policy = makeRateLimitPolicy({ max_hourly_per_company: 1 });
    recordEmailSent("co_z", null);
    expect(checkRateLimit("co_z", null, policy).ok).toBe(false);
    resetRateLimitCounters();
    expect(checkRateLimit("co_z", null, policy).ok).toBe(true);
  });

  it("T29: getRateLimitCounters reflects recorded sends", () => {
    recordEmailSent("co_e", "usr_e");
    recordEmailSent("co_e", "usr_e");
    const c = getRateLimitCounters("co_e", "usr_e");
    expect(c.company_hourly).toBe(2);
    expect(c.user_hourly).toBe(2);
  });

  it("T30: null userId — company counter only", () => {
    recordEmailSent("co_f", null);
    const c = getRateLimitCounters("co_f", null);
    expect(c.company_hourly).toBe(1);
    expect(c.user_hourly).toBe(0);
  });

  it("T31: blocked reason contains limit values", () => {
    const policy = makeRateLimitPolicy({ max_hourly_per_company: 2 });
    for (let i = 0; i < 2; i++) recordEmailSent("co_g", null);
    const r = checkRateLimit("co_g", null, policy);
    expect(r.blocked_reason).toContain("2");
  });
});

// ── T32–T40: Audit events ─────────────────────────────────────────────────────

describe("B39 — Audit events: structure and redaction", () => {
  beforeEach(() => clearAuditLog());
  afterEach(() => clearAuditLog());

  it("T32: audit event has required fields", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    const event = buildEmailAuditEvent({
      event_type: "send_dry_run",
      context: makeContext(),
      decision,
      subject: "Test",
      provider: "mock",
      provider_message_id: "msg_001",
      error: null,
    });
    expect(event.audit_ref).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.company_id).toBe("co_test");
    expect(event.event_type).toBe("send_dry_run");
  });

  it("T33: subject is hashed — not stored verbatim", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    const event = buildEmailAuditEvent({
      event_type: "send_dry_run",
      context: makeContext(),
      decision,
      subject: "Licenciement confidentiel — NE PAS DIFFUSER",
      provider: "mock",
      provider_message_id: null,
      error: null,
    });
    expect(event.subject_hash).not.toContain("Licenciement confidentiel");
    expect(event.subject_hash?.length).toBeLessThan(20);
  });

  it("T34: audit event never contains body", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    const event = buildEmailAuditEvent({
      event_type: "send_dry_run",
      context: makeContext(),
      decision,
      subject: "Test",
      provider: "mock",
      provider_message_id: null,
      error: null,
    });
    expect(JSON.stringify(event)).not.toContain("Bonjour");
    expect(JSON.stringify(event)).not.toContain("body");
  });

  it("T35: resolveAuditEventType — blocked decision → send_blocked", () => {
    const decision = decideEmailSendPolicy(
      makeContext({ access_level: "anonymous" }),
      makePayload(),
      makeConfig(),
    );
    expect(resolveAuditEventType(decision, false)).toBe("send_blocked");
  });

  it("T36: resolveAuditEventType — dry_run → send_dry_run", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig({ mode: "dry_run" }));
    expect(resolveAuditEventType(decision, true)).toBe("send_dry_run");
  });

  it("T37: resolveAuditEventType — sandbox → send_sandbox", () => {
    const decision = decideEmailSendPolicy(
      makeContext(),
      makePayload(),
      makeConfig({ mode: "sandbox", sandbox_to: "s@test.com" }),
    );
    expect(resolveAuditEventType(decision, true)).toBe("send_sandbox");
  });

  it("T38: resolveAuditEventType — rate_limit → rate_limit_hit", () => {
    const decision = decideEmailSendPolicy(
      makeContext(),
      makePayload(),
      makeConfig({ mode: "dry_run" }),
    );
    // Simulate rate limit status
    const rlDecision = { ...decision, status: "blocked_rate_limit_hourly" as const, allowed: false };
    expect(resolveAuditEventType(rlDecision, false)).toBe("rate_limit_hit");
  });

  it("T39: audit log accumulates events", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    const e1 = buildEmailAuditEvent({ event_type: "send_dry_run", context: makeContext(), decision, subject: "S1", provider: "mock", provider_message_id: null, error: null });
    const e2 = buildEmailAuditEvent({ event_type: "send_dry_run", context: makeContext(), decision, subject: "S2", provider: "mock", provider_message_id: null, error: null });
    recordEmailAuditEvent(e1);
    recordEmailAuditEvent(e2);
    expect(getAuditLog().length).toBe(2);
  });

  it("T40: clearAuditLog resets the log", () => {
    const decision = decideEmailSendPolicy(makeContext(), makePayload(), makeConfig());
    const e = buildEmailAuditEvent({ event_type: "send_dry_run", context: makeContext(), decision, subject: "S", provider: "mock", provider_message_id: null, error: null });
    recordEmailAuditEvent(e);
    expect(getAuditLog().length).toBeGreaterThan(0);
    clearAuditLog();
    expect(getAuditLog().length).toBe(0);
  });
});
