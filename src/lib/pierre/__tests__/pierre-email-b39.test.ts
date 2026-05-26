// src/lib/pierre/__tests__/pierre-email-b39.test.ts
// B39 — Pierre email layer: policy, templates, actions, access control.
// No real sends. No OpenAI. No Anthropic. No AI credits.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildPierreEmailContext,
  pierreEmailRequiresApproval,
  pierreEmailIsSensitive,
  pierreEmailIsAllowedForAccessLevel,
  listPierreEmailUseCases,
  isPierreEmailUseCase,
} from "@/lib/pierre/email/pierre-email-policy";
import {
  getPierreEmailTemplate,
  buildPierreTemplatedPayload,
  listPierreEmailTemplates,
} from "@/lib/pierre/email/pierre-email-templates";
import {
  decideEmailSendPolicy,
} from "@/lib/cloneos/channels/email-production/send-policy";
import type { EmailProductionConfig } from "@/lib/cloneos/channels/email-production/types";
import { resetRateLimitCounters } from "@/lib/cloneos/channels/email-production/rate-limit";
import { clearAuditLog, buildEmailAuditEvent } from "@/lib/cloneos/channels/email-production/audit";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

beforeEach(() => {
  resetRateLimitCounters();
  clearAuditLog();
});

// ── T1–T10: Pierre email policy ───────────────────────────────────────────────

describe("B39 — Pierre email policy", () => {
  it("T1: buildPierreEmailContext — paid_customer hr_notification → allowed context", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_test",
      user_id: "usr_test",
      access_level: "paid_customer",
      use_case: "hr_notification",
    });
    expect(ctx.access_level).toBe("paid_customer");
    expect(ctx.message_type).toBe("notification");
    expect(ctx.is_sensitive).toBe(false);
    expect(ctx.approval_required).toBe(false);
  });

  it("T2: sensitive_hr use case → is_sensitive=true, approval_required=true", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_test",
      user_id: "usr_test",
      access_level: "paid_customer",
      use_case: "sensitive_hr",
    });
    expect(ctx.is_sensitive).toBe(true);
    expect(ctx.approval_required).toBe(true);
  });

  it("T3: document_delivery → is_official_document=true, approval_required=true", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_test",
      user_id: "usr_test",
      access_level: "paid_customer",
      use_case: "document_delivery",
    });
    expect(ctx.is_official_document).toBe(true);
    expect(ctx.approval_required).toBe(true);
  });

  it("T4: anonymous → email blocked for all use cases", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_test",
      user_id: null,
      access_level: "anonymous",
      use_case: "hr_notification",
    });
    const decision = decideEmailSendPolicy(ctx, {
      from: "p@c.com", to: ["r@c.com"], cc: [], bcc: [],
      subject: "Test", body_text: "T", body_html: null, attachments: [],
    }, makeConfig());
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_public_demo");
  });

  it("T5: trial → blocked_trial", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_test",
      user_id: "usr_t",
      access_level: "trial",
      use_case: "hr_notification",
    });
    const decision = decideEmailSendPolicy(ctx, {
      from: "p@c.com", to: ["r@c.com"], cc: [], bcc: [],
      subject: "Test", body_text: "T", body_html: null, attachments: [],
    }, makeConfig());
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_trial");
  });

  it("T6: pierreEmailRequiresApproval — sensitive_hr → true", () => {
    expect(pierreEmailRequiresApproval("sensitive_hr")).toBe(true);
  });

  it("T7: pierreEmailRequiresApproval — hr_notification → false", () => {
    expect(pierreEmailRequiresApproval("hr_notification")).toBe(false);
  });

  it("T8: pierreEmailIsSensitive — sensitive_hr → true", () => {
    expect(pierreEmailIsSensitive("sensitive_hr")).toBe(true);
    expect(pierreEmailIsSensitive("hr_notification")).toBe(false);
  });

  it("T9: pierreEmailIsAllowedForAccessLevel — paid_customer → true for all non-demo", () => {
    expect(pierreEmailIsAllowedForAccessLevel("hr_notification", "paid_customer")).toBe(true);
    expect(pierreEmailIsAllowedForAccessLevel("onboarding_email", "paid_customer")).toBe(true);
  });

  it("T10: demo_static use case → never allowed for email", () => {
    expect(pierreEmailIsAllowedForAccessLevel("demo_static", "internal_admin")).toBe(false);
  });
});

// ── T11–T18: Pierre email templates ──────────────────────────────────────────

describe("B39 — Pierre email templates", () => {
  it("T11: all use cases have a template", () => {
    const useCases = listPierreEmailUseCases();
    const templates = listPierreEmailTemplates();
    expect(templates.length).toBe(useCases.length);
  });

  it("T12: sensitive templates have requires_human_review=true and forbidden_auto_send=true", () => {
    const t = getPierreEmailTemplate("sensitive_hr");
    expect(t.requires_human_review).toBe(true);
    expect(t.forbidden_auto_send).toBe(true);
  });

  it("T13: hr_notification — no forbidden_auto_send", () => {
    const t = getPierreEmailTemplate("hr_notification");
    expect(t.forbidden_auto_send).toBe(false);
  });

  it("T14: buildPierreTemplatedPayload interpolates variables", () => {
    const payload = buildPierreTemplatedPayload({
      use_case: "hr_notification",
      from: "pierre@company.com",
      to: ["emp@client.com"],
      vars: {
        company_name: "Acme Corp",
        employee_first_name: "Jean",
        sender_name: "Marie Dupont",
        sender_title: "DRH",
      },
    });
    expect(payload.subject).toContain("Acme Corp");
    expect(payload.body_text).toContain("Jean");
    expect(payload.body_text).not.toContain("{{employee_first_name}}");
  });

  it("T15: buildPierreTemplatedPayload sets from/to correctly", () => {
    const payload = buildPierreTemplatedPayload({
      use_case: "hr_notification",
      from: "pierre@company.com",
      to: ["emp@client.com"],
      vars: {},
    });
    expect(payload.from).toBe("pierre@company.com");
    expect(payload.to).toContain("emp@client.com");
  });

  it("T16: document_delivery template has requires_human_review=true", () => {
    const t = getPierreEmailTemplate("document_delivery");
    expect(t.requires_human_review).toBe(true);
  });

  it("T17: executive_report_delivery template has forbidden_auto_send=true", () => {
    const t = getPierreEmailTemplate("executive_report_delivery");
    expect(t.forbidden_auto_send).toBe(true);
  });

  it("T18: all official document templates forbid auto-send", () => {
    const official = ["document_delivery", "executive_report_delivery", "sensitive_hr", "hr_communication"] as const;
    for (const useCase of official) {
      const t = getPierreEmailTemplate(useCase);
      expect(t.forbidden_auto_send).toBe(true);
    }
  });
});

// ── T19–T25: Pierre email integration with send-policy ───────────────────────

describe("B39 — Pierre email: integration with send-policy", () => {
  it("T19: paid_customer hr_notification dry_run → allowed_dry_run", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_a",
      user_id: "usr_a",
      access_level: "paid_customer",
      use_case: "hr_notification",
    });
    const payload = buildPierreTemplatedPayload({
      use_case: "hr_notification",
      from: "p@c.com",
      to: ["r@c.com"],
      vars: { company_name: "Acme", employee_first_name: "Jean" },
    });
    const decision = decideEmailSendPolicy(ctx, payload, makeConfig());
    expect(decision.allowed).toBe(true);
    expect(decision.status).toBe("allowed_dry_run");
  });

  it("T20: sensitive_hr without approval_required → blocked", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_a",
      user_id: "usr_a",
      access_level: "paid_customer",
      use_case: "sensitive_hr",
      override_approval_required: false,
    });
    const payload = buildPierreTemplatedPayload({
      use_case: "sensitive_hr",
      from: "p@c.com",
      to: ["r@c.com"],
      vars: {},
    });
    const decision = decideEmailSendPolicy(ctx, payload, makeConfig());
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_sensitive_requires_validation");
  });

  it("T21: sensitive_hr with approval_required=true → allowed with human validation", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_a",
      user_id: "usr_a",
      access_level: "paid_customer",
      use_case: "sensitive_hr",
      override_approval_required: true,
    });
    const payload = buildPierreTemplatedPayload({
      use_case: "sensitive_hr",
      from: "p@c.com",
      to: ["r@c.com"],
      vars: {},
    });
    const decision = decideEmailSendPolicy(ctx, payload, makeConfig());
    expect(decision.allowed).toBe(true);
    expect(decision.requires_human_validation).toBe(true);
  });

  it("T22: sandbox mode → effective_recipients redirected to sandbox_to", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_a",
      user_id: "usr_a",
      access_level: "paid_customer",
      use_case: "hr_notification",
    });
    const payload = buildPierreTemplatedPayload({
      use_case: "hr_notification",
      from: "p@c.com",
      to: ["real@client.com"],
      vars: {},
    });
    const decision = decideEmailSendPolicy(ctx, payload, makeConfig({ mode: "sandbox", sandbox_to: "sandbox@team.com" }));
    expect(decision.effective_recipients).toContain("sandbox@team.com");
    expect(decision.effective_recipients).not.toContain("real@client.com");
  });

  it("T23: internal_admin can send in dry_run mode", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_admin",
      user_id: "usr_admin",
      access_level: "internal_admin",
      use_case: "internal_alert",
    });
    const payload = buildPierreTemplatedPayload({
      use_case: "internal_alert",
      from: "p@c.com",
      to: ["team@internal.com"],
      vars: { company_name: "CloneStore" },
    });
    const decision = decideEmailSendPolicy(ctx, payload, makeConfig());
    expect(decision.allowed).toBe(true);
  });

  it("T24: emergency_shutdown blocks internal_admin too", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_admin",
      user_id: "usr_admin",
      access_level: "internal_admin",
      use_case: "internal_alert",
    });
    const payload = buildPierreTemplatedPayload({
      use_case: "internal_alert",
      from: "p@c.com",
      to: ["team@internal.com"],
      vars: {},
    });
    const decision = decideEmailSendPolicy(ctx, payload, makeConfig({ emergency_shutdown: true }));
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_emergency_shutdown");
  });

  it("T25: isPierreEmailUseCase validates correctly", () => {
    expect(isPierreEmailUseCase("hr_notification")).toBe(true);
    expect(isPierreEmailUseCase("unknown_use_case")).toBe(false);
  });
});

// ── T26–T31: Pierre constraints validation ────────────────────────────────────

describe("B39 — Pierre absolute constraints", () => {
  it("T26: listPierreEmailUseCases returns at least 10 use cases", () => {
    expect(listPierreEmailUseCases().length).toBeGreaterThanOrEqual(10);
  });

  it("T27: no demo use case is allowed to send real emails", () => {
    const demoCtx = buildPierreEmailContext({
      company_id: "co_pub",
      user_id: null,
      access_level: "anonymous",
      use_case: "demo_static",
    });
    const decision = decideEmailSendPolicy(demoCtx, {
      from: "p@c.com", to: ["r@c.com"], cc: [], bcc: [],
      subject: "Demo", body_text: "Demo", body_html: null, attachments: [],
    }, makeConfig());
    expect(decision.allowed).toBe(false);
  });

  it("T28: logged_unpaid cannot send emails", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_u",
      user_id: "usr_u",
      access_level: "logged_unpaid",
      use_case: "hr_notification",
    });
    const decision = decideEmailSendPolicy(ctx, {
      from: "p@c.com", to: ["r@c.com"], cc: [], bcc: [],
      subject: "Test", body_text: "T", body_html: null, attachments: [],
    }, makeConfig());
    expect(decision.allowed).toBe(false);
    expect(decision.status).toBe("blocked_unpaid_user");
  });

  it("T29: subject hash never reveals full subject content", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_t",
      user_id: "usr_t",
      access_level: "paid_customer",
      use_case: "hr_notification",
    });
    const decision = decideEmailSendPolicy(ctx, {
      from: "p@c.com", to: ["r@c.com"], cc: [], bcc: [],
      subject: "Confidential HR Decision for Employee", body_text: "T", body_html: null, attachments: [],
    }, makeConfig());
    const event = buildEmailAuditEvent({
      event_type: "send_dry_run",
      context: ctx,
      decision,
      subject: "Confidential HR Decision for Employee",
      provider: "mock",
      provider_message_id: null,
      error: null,
    });
    expect(event.subject_hash).not.toContain("Confidential HR Decision");
  });

  it("T30: all sensitive templates require human review", () => {
    const sensitive = ["sensitive_hr", "document_delivery", "executive_report_delivery"] as const;
    for (const uc of sensitive) {
      const t = getPierreEmailTemplate(uc);
      expect(t.requires_human_review).toBe(true);
    }
  });

  it("T31: access level mapping is exhaustive — no unknown levels pass", () => {
    const ctx = buildPierreEmailContext({
      company_id: "co_x",
      user_id: "usr_x",
      access_level: "completely_unknown_level",
      use_case: "hr_notification",
    });
    // Unknown maps to logged_unpaid (safe fallback)
    expect(ctx.access_level).toBe("logged_unpaid");
    const decision = decideEmailSendPolicy(ctx, {
      from: "p@c.com", to: ["r@c.com"], cc: [], bcc: [],
      subject: "T", body_text: "T", body_html: null, attachments: [],
    }, makeConfig());
    expect(decision.allowed).toBe(false);
  });
});
