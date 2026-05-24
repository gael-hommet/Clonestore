// src/lib/cloneos/channels/__tests__/channels-b33.test.ts
// B33 — Channel Identity Layer tests. Mock mode only, no real sends.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Config ────────────────────────────────────────────────────────────────────

import { getChannelRuntimeMode, isChannelMockMode, isChannelDisabled, getChannelConfig } from "../config";

describe("config", () => {
  it("defaults to mock mode when no env var set", () => {
    vi.stubEnv("CHANNEL_RUNTIME_MODE", "");
    expect(getChannelRuntimeMode()).toBe("mock");
    expect(isChannelMockMode()).toBe(true);
    expect(isChannelDisabled()).toBe(false);
  });

  it("respects CHANNEL_RUNTIME_MODE=disabled", () => {
    vi.stubEnv("CHANNEL_RUNTIME_MODE", "disabled");
    expect(getChannelRuntimeMode()).toBe("disabled");
    expect(isChannelDisabled()).toBe(true);
    expect(isChannelMockMode()).toBe(false);
  });

  it("returns safe defaults from getChannelConfig", () => {
    vi.stubEnv("CHANNEL_RUNTIME_MODE", "mock");
    const cfg = getChannelConfig();
    expect(cfg.runtime_mode).toBe("mock");
    expect(cfg.allow_unverified_send).toBe(false);
    expect(cfg.log_body).toBe(false);
  });
});

// ── Identity helpers ──────────────────────────────────────────────────────────

import {
  isChannelActive,
  isChannelVerified,
  isChannelOutbound,
  isChannelInbound,
  isChannelUsable,
  buildDefaultChannelIdentity,
  getChannelDefaultRiskLevel,
  channelRequiresHumanValidation,
  validateChannelIdentity,
} from "../identity";
import type { ChannelIdentity } from "../types";

function makeIdentity(overrides: Partial<ChannelIdentity> = {}): ChannelIdentity {
  return buildDefaultChannelIdentity({
    id: "cid_test",
    company_id: "co_test",
    agent_slug: "pierre",
    channel_kind: "email",
    direction: "outbound",
    label: "Test Email",
    address_or_identifier: "test@company.com",
    ...overrides,
  });
}

describe("identity helpers", () => {
  it("isChannelActive returns true only for active status", () => {
    expect(isChannelActive(makeIdentity({ status: "active" }))).toBe(true);
    expect(isChannelActive(makeIdentity({ status: "draft" }))).toBe(false);
    expect(isChannelActive(makeIdentity({ status: "suspended" }))).toBe(false);
  });

  it("isChannelVerified returns true only for verified status", () => {
    expect(isChannelVerified(makeIdentity({ verification_status: "verified" }))).toBe(true);
    expect(isChannelVerified(makeIdentity({ verification_status: "pending" }))).toBe(false);
    expect(isChannelVerified(makeIdentity({ verification_status: "not_started" }))).toBe(false);
  });

  it("isChannelOutbound and isChannelInbound are exclusive", () => {
    const out = makeIdentity({ direction: "outbound" });
    const inb = makeIdentity({ direction: "inbound" });
    expect(isChannelOutbound(out)).toBe(true);
    expect(isChannelInbound(out)).toBe(false);
    expect(isChannelInbound(inb)).toBe(true);
    expect(isChannelOutbound(inb)).toBe(false);
  });

  it("isChannelUsable requires active + verified", () => {
    expect(isChannelUsable(makeIdentity({ status: "active", verification_status: "verified" }))).toBe(true);
    expect(isChannelUsable(makeIdentity({ status: "active", verification_status: "pending" }))).toBe(false);
    expect(isChannelUsable(makeIdentity({ status: "draft", verification_status: "verified" }))).toBe(false);
  });

  it("getChannelDefaultRiskLevel respects autonomy level", () => {
    expect(getChannelDefaultRiskLevel(makeIdentity({ autonomy_level: "draft_only" }))).toBe("high");
    expect(getChannelDefaultRiskLevel(makeIdentity({ autonomy_level: "low_risk_auto" }))).toBe("low");
  });

  it("channelRequiresHumanValidation is true for sensitive content", () => {
    const identity = makeIdentity({ autonomy_level: "low_risk_auto", requires_human_validation_by_default: false });
    expect(channelRequiresHumanValidation(identity, "sensitive")).toBe(true);
    expect(channelRequiresHumanValidation(identity, "low")).toBe(false);
  });

  it("validateChannelIdentity rejects missing required fields", () => {
    const result = validateChannelIdentity({ id: "", company_id: "co" });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ── Guards ────────────────────────────────────────────────────────────────────

import { checkChannelSendGuards, containsSensitiveContent, resolveRequestRiskLevel } from "../guards";
import type { ChannelSendRequest, ChannelSendUsage } from "../types";

function makeRequest(overrides: Partial<ChannelSendRequest> = {}): ChannelSendRequest {
  return {
    company_id: "co_test",
    agent_slug: "pierre",
    channel_identity_id: "cid_test",
    to: ["employee@company.com"],
    body: "Bonjour, voici votre contrat.",
    message_type: "hr_communication",
    ...overrides,
  };
}

function makeUsage(overrides: Partial<ChannelSendUsage> = {}): ChannelSendUsage {
  return {
    channel_identity_id: "cid_test",
    sends_last_hour: 0,
    sends_today: 0,
    ...overrides,
  };
}

describe("containsSensitiveContent", () => {
  it("detects French HR sensitive keywords", () => {
    expect(containsSensitiveContent("procédure de licenciement")).toBe(true);
    expect(containsSensitiveContent("faute grave du salarié")).toBe(true);
    expect(containsSensitiveContent("contentieux prud'hommal")).toBe(true);
    expect(containsSensitiveContent("harcèlement au travail")).toBe(true);
    expect(containsSensitiveContent("démission du poste")).toBe(true);
    expect(containsSensitiveContent("message normal de bienvenue")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(containsSensitiveContent(null)).toBe(false);
    expect(containsSensitiveContent(undefined)).toBe(false);
    expect(containsSensitiveContent("")).toBe(false);
  });
});

describe("resolveRequestRiskLevel", () => {
  it("returns sensitive for sensitive body content", () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest({ body: "Nous engageons une procédure de licenciement." });
    expect(resolveRequestRiskLevel(identity, request)).toBe("sensitive");
  });

  it("respects explicit blocked risk level", () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest({ risk_level: "blocked" });
    expect(resolveRequestRiskLevel(identity, request)).toBe("blocked");
  });

  it("returns low for normal content with low_risk_auto channel", () => {
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      autonomy_level: "low_risk_auto",
    });
    const request = makeRequest({ body: "Rappel: votre réunion est demain." });
    expect(resolveRequestRiskLevel(identity, request)).toBe("low");
  });
});

describe("checkChannelSendGuards", () => {
  it("blocks when channel has no company_id", () => {
    const identity = makeIdentity({ company_id: "" });
    const decision = checkChannelSendGuards({ identity, request: makeRequest(), usage: makeUsage() });
    expect(decision.allowed).toBe(false);
    expect(decision.risk_level).toBe("blocked");
  });

  it("blocks when channel is not active", () => {
    vi.stubEnv("CHANNEL_ALLOW_UNVERIFIED_SEND", "false");
    const identity = makeIdentity({ status: "draft", verification_status: "not_started" });
    const decision = checkChannelSendGuards({ identity, request: makeRequest(), usage: makeUsage() });
    expect(decision.allowed).toBe(false);
  });

  it("blocks when channel is not verified and allow_unverified_send is false", () => {
    vi.stubEnv("CHANNEL_ALLOW_UNVERIFIED_SEND", "false");
    vi.stubEnv("CHANNEL_RUNTIME_MODE", "mock");
    const identity = makeIdentity({ status: "active", verification_status: "not_started" });
    const decision = checkChannelSendGuards({ identity, request: makeRequest(), usage: makeUsage() });
    expect(decision.allowed).toBe(false);
  });

  it("blocks inbound-only channel for send", () => {
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      direction: "inbound",
    });
    const decision = checkChannelSendGuards({ identity, request: makeRequest(), usage: makeUsage() });
    expect(decision.allowed).toBe(false);
  });

  it("requires approval for sensitive content", () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest({ body: "Notification de licenciement." });
    const decision = checkChannelSendGuards({ identity, request, usage: makeUsage() });
    expect(decision.allowed).toBe(true);
    expect(decision.approval_required).toBe(true);
    expect(decision.risk_level).toBe("sensitive");
  });

  it("blocks when hourly limit exceeded", () => {
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      max_hourly_sends: 10,
    });
    const usage = makeUsage({ sends_last_hour: 10 });
    const decision = checkChannelSendGuards({ identity, request: makeRequest(), usage });
    expect(decision.allowed).toBe(false);
  });

  it("allows send for active verified outbound channel with normal content", () => {
    vi.stubEnv("CHANNEL_ALLOW_UNVERIFIED_SEND", "false");
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      direction: "outbound",
      autonomy_level: "low_risk_auto",
      requires_human_validation_by_default: false,
    });
    const decision = checkChannelSendGuards({ identity, request: makeRequest(), usage: makeUsage() });
    expect(decision.allowed).toBe(true);
    expect(decision.approval_required).toBe(false);
  });
});

// ── Permissions ───────────────────────────────────────────────────────────────

import { isRecipientAllowed, isMessageTypeAllowed, checkHourlyLimit, checkDailyLimit } from "../permissions";

describe("isRecipientAllowed", () => {
  it("blocks forbidden recipient patterns", () => {
    const identity = makeIdentity({ forbidden_recipient_patterns: ["*@competitor.com"] });
    expect(isRecipientAllowed(identity, "spy@competitor.com").ok).toBe(false);
  });

  it("warns when recipient not in allowed patterns", () => {
    const identity = makeIdentity({ allowed_recipient_patterns: ["*@company.com"] });
    const result = isRecipientAllowed(identity, "extern@other.org");
    expect(result.ok).toBe(true); // warning only, not error
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("allows recipient matching allowed pattern", () => {
    const identity = makeIdentity({ allowed_recipient_patterns: ["*@company.com"] });
    expect(isRecipientAllowed(identity, "alice@company.com").ok).toBe(true);
  });
});

describe("isMessageTypeAllowed", () => {
  it("blocks a blocked message type", () => {
    const identity = makeIdentity({ blocked_message_types: ["sensitive"] });
    expect(isMessageTypeAllowed(identity, "sensitive").ok).toBe(false);
  });

  it("allows message type when no restrictions", () => {
    const identity = makeIdentity();
    expect(isMessageTypeAllowed(identity, "notification").ok).toBe(true);
  });
});

describe("rate limits", () => {
  it("blocks when hourly limit reached", () => {
    const identity = makeIdentity({ max_hourly_sends: 5 });
    const result = checkHourlyLimit(identity, makeUsage({ sends_last_hour: 5 }));
    expect(result.ok).toBe(false);
  });

  it("warns when approaching hourly limit (>80%)", () => {
    const identity = makeIdentity({ max_hourly_sends: 10 });
    const result = checkHourlyLimit(identity, makeUsage({ sends_last_hour: 9 }));
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("blocks when daily limit reached", () => {
    const identity = makeIdentity({ max_daily_sends: 100 });
    const result = checkDailyLimit(identity, makeUsage({ sends_today: 100 }));
    expect(result.ok).toBe(false);
  });
});

// ── Envelopes ─────────────────────────────────────────────────────────────────

import { buildChannelEnvelope, normalizeEnvelopeRecipients, sanitizeEnvelopeBody } from "../envelopes";

describe("envelopes", () => {
  it("builds outbound envelope with required fields", () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest();
    const env = buildChannelEnvelope({ identity, request, riskLevel: "low", approvalRequired: false });
    expect(env.id).toMatch(/^env_/);
    expect(env.direction).toBe("outbound");
    expect(env.channel_kind).toBe("email");
    expect(env.company_id).toBe("co_test");
    expect(env.from).toBe("test@company.com");
  });

  it("does not store body by default (privacy guard)", () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest({ body: "Private content." });
    const env = buildChannelEnvelope({ identity, request, riskLevel: "low", approvalRequired: false, logBody: false });
    expect(env.body_text).toBeNull();
  });

  it("stores body when logBody=true", () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest({ body: "Private content." });
    const env = buildChannelEnvelope({ identity, request, riskLevel: "low", approvalRequired: false, logBody: true });
    expect(env.body_text).toBe("Private content.");
  });

  it("normalizeEnvelopeRecipients handles string and array", () => {
    expect(normalizeEnvelopeRecipients("a@b.com,c@d.com")).toEqual(["a@b.com", "c@d.com"]);
    expect(normalizeEnvelopeRecipients(["a@b.com", "c@d.com"])).toEqual(["a@b.com", "c@d.com"]);
    expect(normalizeEnvelopeRecipients(null)).toEqual([]);
  });

  it("sanitizeEnvelopeBody caps at 100k chars", () => {
    const long = "x".repeat(200_000);
    const result = sanitizeEnvelopeBody(long);
    expect(result?.length).toBe(100_000);
  });
});

// ── Routing ───────────────────────────────────────────────────────────────────

import { detectChannelKind, inferInboundRiskLevel, normalizeInboundMessage, routeInboundEnvelope } from "../routing";

describe("detectChannelKind", () => {
  it("detects email addresses", () => {
    expect(detectChannelKind("user@company.com")).toBe("email");
  });

  it("detects phone numbers", () => {
    expect(detectChannelKind("+33612345678")).toBe("sms");
    expect(detectChannelKind("06 12 34 56 78")).toBe("sms");
  });

  it("returns other for unknown format", () => {
    expect(detectChannelKind("slack://workspace/channel")).toBe("other");
  });
});

describe("inferInboundRiskLevel", () => {
  it("returns sensitive for sensitive keywords in subject", () => {
    expect(inferInboundRiskLevel("Procédure de licenciement", null)).toBe("sensitive");
  });

  it("returns sensitive for sensitive keywords in body", () => {
    expect(inferInboundRiskLevel(null, "Suite à la faute grave constatée...")).toBe("sensitive");
  });

  it("returns low for normal messages", () => {
    expect(inferInboundRiskLevel("Demande de congés", "Bonjour, je souhaite poser des congés.")).toBe("low");
  });
});

describe("normalizeInboundMessage", () => {
  it("handles a well-formed raw message", () => {
    const raw = { from: "employee@company.com", to: ["pierre@company.com"], subject: "Question RH", body_text: "Bonjour" };
    const msg = normalizeInboundMessage(raw);
    expect(msg.from).toBe("employee@company.com");
    expect(msg.to).toEqual(["pierre@company.com"]);
    expect(msg.subject).toBe("Question RH");
    expect(msg.id).toMatch(/^inb_/);
  });

  it("handles null/undefined gracefully", () => {
    const msg = normalizeInboundMessage(null);
    expect(msg.from).toBe("");
    expect(msg.channel_kind).toBe("other");
  });
});

describe("routeInboundEnvelope", () => {
  it("matches envelope.to against registered identities", () => {
    const envelope = {
      id: "env_1",
      from: "user@ext.com",
      to: ["pierre@company.com"],
      direction: "inbound" as const,
      channel_kind: "email" as const,
      risk_level: "low" as const,
      company_id: "co_test",
      agent_slug: "pierre",
      channel_identity_id: "cid_test",
      subject: null,
      body_text: null,
      body_html: null,
      cc: [],
      bcc: [],
      attachments: [],
      received_at: new Date().toISOString(),
      sent_at: null,
      status: "received" as const,
      approval_required: false,
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      metadata: {},
    };
    const identities = [{ id: "cid_test", agent_slug: "pierre", address_or_identifier: "pierre@company.com", channel_kind: "email" as const }];
    const decision = routeInboundEnvelope({ envelope, registeredIdentities: identities });
    expect(decision.should_process).toBe(true);
    expect(decision.matched_agent_slug).toBe("pierre");
  });

  it("returns should_process=false when no recipient matches", () => {
    const envelope = {
      id: "env_2",
      from: "user@ext.com",
      to: ["unknown@company.com"],
      direction: "inbound" as const,
      channel_kind: "email" as const,
      risk_level: "low" as const,
      company_id: "co_test",
      agent_slug: "pierre",
      channel_identity_id: "cid_test",
      subject: null,
      body_text: null,
      body_html: null,
      cc: [],
      bcc: [],
      attachments: [],
      received_at: new Date().toISOString(),
      sent_at: null,
      status: "received" as const,
      approval_required: false,
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      metadata: {},
    };
    const identities = [{ id: "cid_test", agent_slug: "pierre", address_or_identifier: "pierre@company.com", channel_kind: "email" as const }];
    const decision = routeInboundEnvelope({ envelope, registeredIdentities: identities });
    expect(decision.should_process).toBe(false);
  });

  it("returns should_process=false when from is empty", () => {
    const envelope = {
      id: "env_3",
      from: "",
      to: ["pierre@company.com"],
      direction: "inbound" as const,
      channel_kind: "email" as const,
      risk_level: "low" as const,
      company_id: "co_test",
      agent_slug: "pierre",
      channel_identity_id: "cid_test",
      subject: null,
      body_text: null,
      body_html: null,
      cc: [],
      bcc: [],
      attachments: [],
      received_at: new Date().toISOString(),
      sent_at: null,
      status: "received" as const,
      approval_required: false,
      related_mission_id: null,
      related_task_id: null,
      related_employee_id: null,
      metadata: {},
    };
    const decision = routeInboundEnvelope({ envelope, registeredIdentities: [] });
    expect(decision.should_process).toBe(false);
    expect(decision.risk_level).toBe("blocked");
  });
});

// ── Mock provider ─────────────────────────────────────────────────────────────

import { mockChannelProvider } from "../providers/mock";

describe("mockChannelProvider", () => {
  it("supports all channel kinds", () => {
    expect(mockChannelProvider.supports("email")).toBe(true);
    expect(mockChannelProvider.supports("sms")).toBe(true);
    expect(mockChannelProvider.supports("whatsapp")).toBe(true);
    expect(mockChannelProvider.supports("slack")).toBe(true);
  });

  it("is always configured", () => {
    expect(mockChannelProvider.isConfigured()).toBe(true);
  });

  it("returns ok=true with a mock provider_message_id", async () => {
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const request = makeRequest();
    const env = buildChannelEnvelope({ identity, request, riskLevel: "low", approvalRequired: false });
    const result = await mockChannelProvider.send({ envelope: env, body: "Test" });
    expect(result.ok).toBe(true);
    expect(result.provider_message_id).toMatch(/^mock_/);
    expect(result.error).toBeNull();
    expect(result.meta.mock).toBe(true);
  });
});

// ── Runtime sendChannelMessage ────────────────────────────────────────────────

import { sendChannelMessage } from "../runtime";

describe("sendChannelMessage", () => {
  beforeEach(() => {
    vi.stubEnv("CHANNEL_RUNTIME_MODE", "mock");
    vi.stubEnv("CHANNEL_ALLOW_UNVERIFIED_SEND", "false");
  });

  it("blocks in disabled mode", async () => {
    vi.stubEnv("CHANNEL_RUNTIME_MODE", "disabled");
    const identity = makeIdentity({ status: "active", verification_status: "verified" });
    const result = await sendChannelMessage({ identity, request: makeRequest(), usage: makeUsage() });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
  });

  it("blocks unverified channel in mock mode", async () => {
    const identity = makeIdentity({ status: "active", verification_status: "not_started" });
    const result = await sendChannelMessage({ identity, request: makeRequest(), usage: makeUsage() });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("blocked");
  });

  it("returns pending (not sent) when approval_required", async () => {
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      requires_human_validation_by_default: true,
    });
    const result = await sendChannelMessage({ identity, request: makeRequest(), usage: makeUsage() });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.approval_required).toBe(true);
    expect(result.provider_message_id).toBeNull();
  });

  it("sends successfully in mock mode for valid channel", async () => {
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      direction: "outbound",
      autonomy_level: "low_risk_auto",
      requires_human_validation_by_default: false,
    });
    const result = await sendChannelMessage({ identity, request: makeRequest(), usage: makeUsage() });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("sent");
    expect(result.provider_message_id).toMatch(/^mock_/);
    expect(result.trace_events.length).toBeGreaterThan(0);
  });

  it("queues for approval (pending) on sensitive content", async () => {
    const identity = makeIdentity({
      status: "active",
      verification_status: "verified",
      autonomy_level: "low_risk_auto",
      requires_human_validation_by_default: false,
    });
    const request = makeRequest({ body: "Nous procédons à votre licenciement." });
    const result = await sendChannelMessage({ identity, request, usage: makeUsage() });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("pending");
    expect(result.approval_required).toBe(true);
  });
});
