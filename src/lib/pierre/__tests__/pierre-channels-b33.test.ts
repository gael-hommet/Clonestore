// src/lib/pierre/__tests__/pierre-channels-b33.test.ts
// B33 — Pierre channel bridge tests. Mock mode only, no real sends.

import { describe, it, expect } from "vitest";
import type { ChannelIdentity } from "../../cloneos/channels/types";
import { buildDefaultChannelIdentity } from "../../cloneos/channels/identity";
import { buildInboundEnvelope } from "../../cloneos/channels/envelopes";
import { routeInboundEnvelopeToPierre, preparePierreChannelSend } from "../channels/route-inbound-to-pierre";
import { pierreRequiresApproval, isPierreAuthorizedForChannel, pierreCanAutoReply } from "../channels/permissions";
import type { PierreChannelSendRequest } from "../channels/types";

// ── Test helpers ──────────────────────────────────────────────────────────────

function makePierreIdentity(overrides: Partial<ChannelIdentity> = {}): ChannelIdentity {
  return buildDefaultChannelIdentity({
    id: "cid_pierre",
    company_id: "co_acme",
    agent_slug: "pierre",
    channel_kind: "email",
    direction: "bidirectional",
    label: "Pierre Email ACME",
    address_or_identifier: "pierre@acme.com",
    status: "active",
    verification_status: "verified",
    autonomy_level: "low_risk_auto",
    requires_human_validation_by_default: false,
    ...overrides,
  });
}

function makeInboundEnvelope(params: {
  from?: string;
  subject?: string | null;
  body_text?: string | null;
  agent_slug?: string;
} = {}) {
  const identity = makePierreIdentity({ agent_slug: params.agent_slug ?? "pierre" });
  return buildInboundEnvelope({
    identity,
    from: params.from ?? "employee@acme.com",
    to: ["pierre@acme.com"],
    subject: params.subject ?? null,
    body_text: params.body_text ?? null,
    logBody: true,
  });
}

// ── routeInboundEnvelopeToPierre ──────────────────────────────────────────────

describe("routeInboundEnvelopeToPierre", () => {
  it("creates mission for a normal inbound message", () => {
    const identity = makePierreIdentity();
    const envelope = makeInboundEnvelope({ subject: "Demande de congés", body_text: "Je souhaite poser 5 jours." });
    const decision = routeInboundEnvelopeToPierre({ envelope, identity });
    expect(decision.action).toBe("create_mission");
    expect(decision.risk_level).toBe("low");
    expect(decision.blocked_reason).toBeNull();
  });

  it("blocks_sensitive for sensitive HR content", () => {
    const identity = makePierreIdentity();
    const envelope = makeInboundEnvelope({
      subject: "Procédure de licenciement",
      body_text: "Suite à la faute grave constatée...",
    });
    const decision = routeInboundEnvelopeToPierre({ envelope, identity });
    expect(decision.action).toBe("blocked_sensitive");
    expect(decision.risk_level).toBe("sensitive");
    expect(decision.blocked_reason).toBeTruthy();
  });

  it("attaches to existing mission when existingMissionIds provided", () => {
    const identity = makePierreIdentity();
    const envelope = makeInboundEnvelope({ body_text: "Réponse à votre email d'hier." });
    const decision = routeInboundEnvelopeToPierre({ envelope, identity, existingMissionIds: ["miss_abc123"] });
    expect(decision.action).toBe("attach_to_existing_mission");
    expect(decision.suggested_mission_id).toBe("miss_abc123");
  });

  it("asks for more info when channel requires human validation", () => {
    const identity = makePierreIdentity({
      autonomy_level: "validation_required",
      requires_human_validation_by_default: true,
    });
    const envelope = makeInboundEnvelope({ body_text: "Question sur mon contrat." });
    const decision = routeInboundEnvelopeToPierre({ envelope, identity });
    expect(decision.action).toBe("ask_for_more_info");
  });

  it("ignores non-inbound envelopes", () => {
    const identity = makePierreIdentity();
    const envelope = { ...makeInboundEnvelope(), direction: "outbound" as const };
    const decision = routeInboundEnvelopeToPierre({ envelope, identity });
    expect(decision.action).toBe("ignored_not_for_pierre");
  });

  it("ignores envelope for wrong agent", () => {
    const identity = makePierreIdentity({ agent_slug: "pierre" });
    const envelope = { ...makeInboundEnvelope(), agent_slug: "another-agent" };
    const decision = routeInboundEnvelopeToPierre({ envelope, identity });
    expect(decision.action).toBe("ignored_not_for_pierre");
  });
});

// ── Pierre permissions ────────────────────────────────────────────────────────

describe("pierreRequiresApproval", () => {
  function makeRequest(overrides: Partial<PierreChannelSendRequest> = {}): PierreChannelSendRequest {
    return {
      company_id: "co_acme",
      agent_slug: "pierre",
      channel_identity_id: "cid_pierre",
      to: ["employee@acme.com"],
      body: "Voici votre confirmation.",
      message_type: "notification",
      ...overrides,
    };
  }

  it("requires approval when request.approval_required=true", () => {
    expect(pierreRequiresApproval(makeRequest({ approval_required: true }), "low")).toBe(true);
  });

  it("requires approval for sensitive risk level", () => {
    expect(pierreRequiresApproval(makeRequest(), "sensitive")).toBe(true);
  });

  it("requires approval for high risk level", () => {
    expect(pierreRequiresApproval(makeRequest(), "high")).toBe(true);
  });

  it("requires approval for hr_communication message type", () => {
    expect(pierreRequiresApproval(makeRequest({ message_type: "hr_communication" }), "low")).toBe(true);
  });

  it("requires approval for sensitive message type", () => {
    expect(pierreRequiresApproval(makeRequest({ message_type: "sensitive" }), "low")).toBe(true);
  });

  it("does not require approval for normal notification at low risk", () => {
    expect(pierreRequiresApproval(makeRequest({ message_type: "notification" }), "low")).toBe(false);
  });

  it("does not require approval for reminder at medium risk", () => {
    expect(pierreRequiresApproval(makeRequest({ message_type: "reminder" }), "medium")).toBe(false);
  });
});

describe("isPierreAuthorizedForChannel", () => {
  it("returns true when identity.agent_slug matches", () => {
    const identity = makePierreIdentity({ agent_slug: "pierre" });
    expect(isPierreAuthorizedForChannel(identity, "pierre")).toBe(true);
  });

  it("returns false when agent_slug differs", () => {
    const identity = makePierreIdentity({ agent_slug: "pierre" });
    expect(isPierreAuthorizedForChannel(identity, "other-agent")).toBe(false);
  });
});

describe("pierreCanAutoReply", () => {
  it("returns false for sensitive risk", () => {
    const identity = makePierreIdentity({ autonomy_level: "low_risk_auto", requires_human_validation_by_default: false });
    expect(pierreCanAutoReply(identity, "sensitive")).toBe(false);
  });

  it("returns false for blocked risk", () => {
    const identity = makePierreIdentity({ autonomy_level: "low_risk_auto", requires_human_validation_by_default: false });
    expect(pierreCanAutoReply(identity, "blocked")).toBe(false);
  });

  it("returns false for draft_only channel", () => {
    const identity = makePierreIdentity({ autonomy_level: "draft_only", requires_human_validation_by_default: false });
    expect(pierreCanAutoReply(identity, "low")).toBe(false);
  });

  it("returns false when requires_human_validation_by_default=true", () => {
    const identity = makePierreIdentity({ autonomy_level: "low_risk_auto", requires_human_validation_by_default: true });
    expect(pierreCanAutoReply(identity, "low")).toBe(false);
  });

  it("returns true for low_risk_auto channel with low risk and no human validation required", () => {
    const identity = makePierreIdentity({ autonomy_level: "low_risk_auto", requires_human_validation_by_default: false });
    expect(pierreCanAutoReply(identity, "low")).toBe(true);
  });
});

// ── preparePierreChannelSend ──────────────────────────────────────────────────

describe("preparePierreChannelSend", () => {
  it("builds a send request with identity defaults", () => {
    const identity = makePierreIdentity({ requires_human_validation_by_default: true });
    const prepared = preparePierreChannelSend({
      identity,
      to: ["employee@acme.com"],
      subject: "Votre contrat",
      body: "Veuillez signer votre contrat.",
      missionId: "miss_001",
      employeeId: "emp_001",
    });
    expect(prepared.company_id).toBe("co_acme");
    expect(prepared.agent_slug).toBe("pierre");
    expect(prepared.channel_identity_id).toBe("cid_pierre");
    expect(prepared.approval_required).toBe(true);
    expect(prepared.mission_id).toBe("miss_001");
    expect(prepared.employee_id).toBe("emp_001");
  });

  it("inherits approval_required from identity", () => {
    const identity = makePierreIdentity({ requires_human_validation_by_default: false });
    const prepared = preparePierreChannelSend({
      identity,
      to: ["employee@acme.com"],
      subject: null,
      body: "Test.",
    });
    expect(prepared.approval_required).toBe(false);
  });
});
