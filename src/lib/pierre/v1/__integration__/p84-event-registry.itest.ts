// PHASE 8.4.1 — the communication event registry is the ONLY source of a policy. A communicable
// event has an explicit policy; a known internal lifecycle event is non-communicable (skipped); an
// unknown event is quarantined (never a permissive default). A payload can never supply a policy.
import { describe, it, expect } from "vitest";
import { classifyCommunicationEvent, getCommunicationPolicy, isMandatoryCategory, allCommunicablePolicies } from "../communication-event-registry";

describe("P8.4.1 communication event registry", () => {
  it("communicable events resolve to an explicit server policy", () => {
    const c = classifyCommunicationEvent("document.ready_for_review");
    expect(c.kind).toBe("communicable");
    if (c.kind === "communicable") {
      expect(c.policy.allowedChannels).toContain("in_app");
      expect(c.policy.category).toBe("approval");
      expect(c.policy.templateKey).toBe("document.ready_for_review");
    }
  });
  it("known internal lifecycle events are NON-communicable (skipped, not quarantined)", () => {
    for (const k of ["contract.created", "signature.document_uploaded", "template.approved", "signature.provider_request_created"]) {
      expect(classifyCommunicationEvent(k).kind).toBe("non_communicable");
    }
  });
  it("an unknown event is quarantined (never a permissive default policy)", () => {
    expect(classifyCommunicationEvent("totally.made.up").kind).toBe("unknown");
    expect(getCommunicationPolicy("totally.made.up")).toBeNull();
  });
  it("mandatory categories can never be opted out (security / transactional / approval)", () => {
    expect(isMandatoryCategory("security")).toBe(true);
    expect(isMandatoryCategory("transactional")).toBe(true);
    expect(isMandatoryCategory("approval")).toBe(true);
    expect(isMandatoryCategory("optional")).toBe(false);
    expect(isMandatoryCategory("operational")).toBe(false);
  });
  it("every communicable policy guarantees a delivery channel and a template", () => {
    // PHASE 8.6 — internal-recipient policies guarantee in_app (the member's inbox). An EXTERNAL-recipient
    // policy (an invitee who is not yet a member, e.g. member.invited via the `invited_email` strategy) has
    // no in-app inbox, so it guarantees email instead. Every communicable policy still guarantees at least
    // one required channel + a real template + bounded attempts.
    for (const p of allCommunicablePolicies()) {
      if (p.recipientStrategy === "invited_email") {
        expect(p.requiredChannels).toContain("email");
      } else {
        expect(p.requiredChannels).toContain("in_app");
      }
      expect(p.requiredChannels.length).toBeGreaterThan(0);
      expect(p.templateKey.length).toBeGreaterThan(0);
      expect(p.maxAttempts).toBeGreaterThan(0);
    }
  });
});
