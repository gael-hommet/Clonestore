// Décision PURE de réconciliation d'entitlement — fail-closed.
// Invariant testé : aucun accès payant sans abonnement Stripe réel, lié au compte, actif.

import { describe, it, expect } from "vitest";
import { decideEntitlementReconciliation } from "../entitlement-reconciliation";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const sub = (over: Partial<{ id: string; status: string | null; customerId: string | null; metadataUserId: string | null; metadataAgentSlug: string | null }> = {}) => ({
  id: "sub_1",
  status: "active",
  customerId: "cus_1",
  metadataUserId: USER,
  metadataAgentSlug: "pierre",
  ...over,
});

const order = (subId: string | null = "sub_1") => ({
  stripe_subscription_id: subId,
  stripe_customer_id: "cus_1",
});

const base = { userId: USER, agentSlug: "pierre" };

describe("decideEntitlementReconciliation — refus fail-closed", () => {
  it("aucune ligne orders → 402 NO_SUBSCRIPTION", () => {
    const d = decideEntitlementReconciliation({ ...base, order: null, subscription: null });
    expect(d.ok).toBe(false);
    if (!d.ok) { expect(d.code).toBe("NO_SUBSCRIPTION"); expect(d.httpStatus).toBe(402); }
  });

  it("orders sans stripe_subscription_id → 402 NO_SUBSCRIPTION (le trou historique)", () => {
    const d = decideEntitlementReconciliation({ ...base, order: order(null), subscription: sub() });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("NO_SUBSCRIPTION");
  });

  it("abonnement introuvable chez Stripe → 402 SUBSCRIPTION_NOT_FOUND", () => {
    const d = decideEntitlementReconciliation({ ...base, order: order(), subscription: null });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_NOT_FOUND");
  });

  it("id Stripe différent de l'id local → 402 SUBSCRIPTION_NOT_FOUND", () => {
    const d = decideEntitlementReconciliation({ ...base, order: order("sub_1"), subscription: sub({ id: "sub_autre" }) });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_NOT_FOUND");
  });

  it("abonnement d'un AUTRE utilisateur → 403 SUBSCRIPTION_USER_MISMATCH", () => {
    const d = decideEntitlementReconciliation({ ...base, order: order(), subscription: sub({ metadataUserId: OTHER }) });
    expect(d.ok).toBe(false);
    if (!d.ok) { expect(d.code).toBe("SUBSCRIPTION_USER_MISMATCH"); expect(d.httpStatus).toBe(403); }
  });

  it("abonnement d'un AUTRE produit → 400 SUBSCRIPTION_AGENT_MISMATCH", () => {
    const d = decideEntitlementReconciliation({ ...base, order: order(), subscription: sub({ metadataAgentSlug: "clara" }) });
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_AGENT_MISMATCH");
  });

  it.each(["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused", null, "inconnu"])(
    "statut Stripe « %s » → jamais d'accès (402 SUBSCRIPTION_NOT_ACTIVE)",
    (status) => {
      const d = decideEntitlementReconciliation({ ...base, order: order(), subscription: sub({ status }) });
      expect(d.ok).toBe(false);
      if (!d.ok) expect(d.code).toBe("SUBSCRIPTION_NOT_ACTIVE");
    },
  );
});

describe("decideEntitlementReconciliation — octroi", () => {
  it.each(["active", "trialing"])("statut « %s » → accès accordé", (status) => {
    const d = decideEntitlementReconciliation({ ...base, order: order(), subscription: sub({ status }) });
    expect(d.ok).toBe(true);
    if (d.ok) { expect(d.status).toBe(status); expect(d.subscriptionId).toBe("sub_1"); }
  });

  it("metadata absente : liaison serveur déjà établie par orders → accès accordé", () => {
    const d = decideEntitlementReconciliation({
      ...base,
      order: order(),
      subscription: sub({ metadataUserId: null, metadataAgentSlug: null }),
    });
    expect(d.ok).toBe(true);
  });

  it("customer Stripe absent → repli sur le customer local", () => {
    const d = decideEntitlementReconciliation({ ...base, order: order(), subscription: sub({ customerId: null }) });
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.customerId).toBe("cus_1");
  });
});
