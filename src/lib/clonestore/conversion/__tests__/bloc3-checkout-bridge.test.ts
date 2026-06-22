import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetConversionStoreForTests,
  createConversionSessionFromGrant,
  importAttributionGrant,
  getGrantByTokenId,
  listConversionEvents,
} from "../storage";
import {
  bridgeCheckoutCompleted,
  bridgeCheckoutStarted,
  bridgePierreActivated,
  buildConversionCheckoutMetadata,
} from "../checkout-bridge";

const TOKEN_ID = "fedcba9876543210fedcba9876543210";

function freshSession() {
  __resetConversionStoreForTests();
  importAttributionGrant({
    tokenId: TOKEN_ID,
    keyVersion: 1,
    variant: "VARIANT_DEPARTMENT_OUTCOME",
    cohort: "COHORT_DIRECT_A",
    contactKind: "DIRECT",
    campaign: "spring_2026",
  });
  return createConversionSessionFromGrant(getGrantByTokenId(TOKEN_ID)!);
}

describe("BLOC 3 — checkout bridge", () => {
  beforeEach(() => __resetConversionStoreForTests());

  it("buildConversionCheckoutMetadata ne contient que les clés autorisées", () => {
    const session = freshSession();
    const r = buildConversionCheckoutMetadata({
      conversion_session_id: session.id,
      user_id: "u_test",
      agent_slug: "pierre",
      order_id: "ord_1",
      tenant_id: "t_1",
    });
    expect(r.ok).toBe(true);
    expect(r.metadata["conversion_variant"]).toBe("VARIANT_DEPARTMENT_OUTCOME");
    expect(r.metadata["conversion_session_id"]).toBe(session.id);
    expect(r.metadata["agent_slug"]).toBe("pierre");
    expect(r.metadata["order_id"]).toBe("ord_1");
    expect(r.metadata["tenant_id"]).toBe("t_1");
    expect(r.metadata["funnel_version"]).toBe("v1");
    expect(r.metadata["conversion_campaign"]).toBe("spring_2026");
    // pas de token, ni d'email, ni de bearer
    expect(Object.keys(r.metadata).some((k) => /token|secret|email/i.test(k))).toBe(false);
  });

  it("bridgeCheckoutStarted attache user et émet l'événement serveur", () => {
    const session = freshSession();
    const r = bridgeCheckoutStarted({ sessionId: session.id, userId: "u_alice", tenantId: "t_acme", orderId: "ord_1" });
    expect(r.ok).toBe(true);
    expect(r.session?.userId).toBe("u_alice");
    expect(r.session?.stage).toBe("checkout_pending");
    expect(listConversionEvents(session.id).some((e) => e.eventId === "checkout_started")).toBe(true);
  });

  it("bridgeCheckoutCompleted refuse une session attachée à un autre user", () => {
    const session = freshSession();
    bridgeCheckoutStarted({ sessionId: session.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    const r = bridgeCheckoutCompleted({
      metadata: { user_id: "u_bob", conversion_session_id: session.id },
      orderId: "ord_1",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("user_mismatch");
  });

  it("bridgeCheckoutCompleted idempotent (même order_id → un seul event)", () => {
    const session = freshSession();
    bridgeCheckoutStarted({ sessionId: session.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    bridgeCheckoutCompleted({ metadata: { user_id: "u_alice", conversion_session_id: session.id }, orderId: "ord_1" });
    bridgeCheckoutCompleted({ metadata: { user_id: "u_alice", conversion_session_id: session.id }, orderId: "ord_1" });
    const completed = listConversionEvents(session.id).filter((e) => e.eventId === "checkout_completed");
    expect(completed.length).toBe(1);
  });

  it("bridgePierreActivated avance le stage à 'activated' et émet l'événement", () => {
    const session = freshSession();
    bridgeCheckoutStarted({ sessionId: session.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    bridgeCheckoutCompleted({ metadata: { user_id: "u_alice", conversion_session_id: session.id }, orderId: "ord_1" });
    const r = bridgePierreActivated({ sessionId: session.id });
    expect(r.ok).toBe(true);
    expect(r.session?.stage).toBe("activated");
    expect(listConversionEvents(session.id).some((e) => e.eventId === "pierre_activated")).toBe(true);
  });
});
