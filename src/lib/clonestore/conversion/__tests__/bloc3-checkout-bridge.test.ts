import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  __resetConversionStoreForTests,
  attachUserToSession,
  createConversionSessionFromGrant,
  importAttributionGrant,
  getGrantByTokenId,
  listConversionEvents,
} from "../storage";
import {
  bridgeCheckoutCompleted,
  bridgeCheckoutFailed,
  bridgeCheckoutStarted,
  bridgePierreActivated,
  buildConversionCheckoutMetadata,
  LEADFORGE_CHECKOUT_METADATA_FIELDS,
} from "../checkout-bridge";

const TOKEN_ID = "fedcba9876543210fedcba9876543210fedcba00"; // 40 hex

function setup() {
  process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE = "true";
  __resetConversionStoreForTests();
  importAttributionGrant({
    tokenId: TOKEN_ID,
    variant: "VARIANT_DEPARTMENT_OUTCOME",
    cohort: "V0-A",
    contactKind: "DIRECT",
    campaignId: "spring_2026",
    prospectId: "lf_001",
  });
  return createConversionSessionFromGrant(getGrantByTokenId(TOKEN_ID)!);
}

describe("BLOC 3 — checkout bridge (alignement metadata LeadForge)", () => {
  beforeEach(() => setup());
  afterEach(() => {
    __resetConversionStoreForTests();
    delete process.env.CLONESTORE_B3_ALLOW_IN_MEMORY_CONVERSION_STORE;
  });

  it("expose les 5 champs LeadForge attendus", () => {
    expect([...LEADFORGE_CHECKOUT_METADATA_FIELDS]).toEqual([
      "prospect_token",
      "campaign",
      "cohort",
      "variant",
      "funnel_version",
    ]);
  });

  it("buildConversionCheckoutMetadata inclut les clés LeadForge + CloneStore, jamais de bearer/PII", () => {
    const s = setup();
    const r = buildConversionCheckoutMetadata({
      conversionSessionId: s.id,
      userId: "u_test",
      agentSlug: "pierre",
      orderId: "ord_1",
      tenantId: "t_1",
      prospectTokenRaw: TOKEN_ID + ".deadbeef".repeat(8), // bearer complet
    });
    expect(r.ok).toBe(true);
    expect(r.metadata["variant"]).toBe("VARIANT_DEPARTMENT_OUTCOME");
    expect(r.metadata["funnel_version"]).toBe("v0.1");
    expect(r.metadata["campaign"]).toBe("spring_2026");
    expect(r.metadata["cohort"]).toBe("V0-A");
    expect(r.metadata["user_id"]).toBe("u_test");
    expect(r.metadata["agent_slug"]).toBe("pierre");
    expect(r.metadata["order_id"]).toBe("ord_1");
    expect(r.metadata["tenant_id"]).toBe("t_1");
    // prospect_token RÉDUIT au token_id (40 hex), bearer drop
    expect(r.metadata["prospect_token"]).toBe(TOKEN_ID);
    expect(r.metadata["prospect_token"]).not.toContain(".");
    // pas de fuite (prospect_token EST autorisé par le contrat LeadForge ;
    // on vérifie que c'est bien le SEUL champ "token" et qu'il ne contient
    // pas de secret / email / bearer).
    const tokenKeys = Object.keys(r.metadata).filter((k) => /token$|secret|email/i.test(k));
    expect(tokenKeys).toEqual(["prospect_token"]);
    expect(r.metadata["prospect_token"]).toBe(TOKEN_ID); // déjà vérifié au-dessus
    expect(r.metadata["prospect_token"].length).toBe(40); // token_id, pas bearer
  });

  it("bridgeCheckoutStarted attache user, avance stage, émet event serveur", () => {
    const s = setup();
    const r = bridgeCheckoutStarted({ sessionId: s.id, userId: "u_alice", tenantId: "t_acme", orderId: "ord_1" });
    expect(r.ok).toBe(true);
    expect(r.session?.userId).toBe("u_alice");
    expect(r.session?.stage).toBe("checkout_pending");
    expect(listConversionEvents(s.id).some((e) => e.eventType === "checkout_started")).toBe(true);
  });

  it("bridgeCheckoutCompleted refuse user mismatch (cross-user attack)", () => {
    const s = setup();
    bridgeCheckoutStarted({ sessionId: s.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    const r = bridgeCheckoutCompleted({
      metadata: { user_id: "u_bob", conversion_session_id: s.id },
      orderId: "ord_1",
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("user_mismatch");
  });

  it("bridgeCheckoutCompleted idempotent par order_id (replay = no double event)", () => {
    const s = setup();
    bridgeCheckoutStarted({ sessionId: s.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    bridgeCheckoutCompleted({ metadata: { user_id: "u_alice", conversion_session_id: s.id }, orderId: "ord_1" });
    bridgeCheckoutCompleted({ metadata: { user_id: "u_alice", conversion_session_id: s.id }, orderId: "ord_1" });
    const events = listConversionEvents(s.id).filter((e) => e.eventType === "checkout_completed");
    expect(events.length).toBe(1);
  });

  it("bridgePierreActivated avance stage à 'activated' et émet event", () => {
    const s = setup();
    bridgeCheckoutStarted({ sessionId: s.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    bridgeCheckoutCompleted({ metadata: { user_id: "u_alice", conversion_session_id: s.id }, orderId: "ord_1" });
    const r = bridgePierreActivated({ sessionId: s.id });
    expect(r.ok).toBe(true);
    expect(r.session?.stage).toBe("activated");
    expect(listConversionEvents(s.id).some((e) => e.eventType === "pierre_activated")).toBe(true);
  });

  it("bridgeCheckoutFailed émet event sans avancer le stage", () => {
    const s = setup();
    bridgeCheckoutStarted({ sessionId: s.id, userId: "u_alice", tenantId: "t1", orderId: "ord_1" });
    const r = bridgeCheckoutFailed({ sessionId: s.id, reason: "invoice.payment_failed", orderId: "ord_1" });
    expect(r.ok).toBe(true);
    expect(listConversionEvents(s.id).some((e) => e.eventType === "checkout_failed")).toBe(true);
    // Session ne régresse pas à "checkout_pending"
    expect(r.session?.stage).toBe("checkout_pending");
  });
});
