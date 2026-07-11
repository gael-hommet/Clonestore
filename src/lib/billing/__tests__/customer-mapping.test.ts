// Mapping User ↔ Stripe Customer — décisions pures + clés d'idempotence.
// Invariants : un seul Customer par utilisateur ; jamais de réutilisation du Customer
// d'un autre compte ; clés déterministes (double-clic → une seule écriture Stripe).

import { describe, it, expect } from "vitest";
import {
  decideCustomerBinding,
  toCustomerView,
  customerIdempotencyKey,
  checkoutIdempotencyKey,
} from "../customer-mapping";

const USER = "user-1";
const OTHER = "user-2";

const customer = (over: Partial<{ id: string; deleted: boolean; metadataUserId: string | null }> = {}) => ({
  id: "cus_1",
  deleted: false,
  metadataUserId: USER,
  ...over,
});

describe("decideCustomerBinding — création", () => {
  it("aucun customer local → create(no_local_customer)", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: null, customer: null });
    expect(d).toEqual({ ok: true, action: "create", reason: "no_local_customer" });
  });

  it("customer local introuvable chez Stripe → create(not_found)", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: "cus_1", customer: null });
    expect(d).toEqual({ ok: true, action: "create", reason: "not_found" });
  });

  it("id Stripe différent de l'id local → create(not_found)", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: "cus_1", customer: customer({ id: "cus_autre" }) });
    expect(d).toEqual({ ok: true, action: "create", reason: "not_found" });
  });

  it("customer supprimé chez Stripe → create(deleted)", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: "cus_1", customer: customer({ deleted: true }) });
    expect(d).toEqual({ ok: true, action: "create", reason: "deleted" });
  });
});

describe("decideCustomerBinding — réutilisation", () => {
  it("customer valide de l'utilisateur → reuse", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: "cus_1", customer: customer() });
    expect(d).toEqual({ ok: true, action: "reuse", customerId: "cus_1" });
  });

  it("customer historique SANS metadata → reuse (liaison déjà établie par orders)", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: "cus_1", customer: customer({ metadataUserId: null }) });
    expect(d).toEqual({ ok: true, action: "reuse", customerId: "cus_1" });
  });
});

describe("decideCustomerBinding — refus", () => {
  it("customer d'un AUTRE utilisateur → 409, jamais de réutilisation ni de doublon silencieux", () => {
    const d = decideCustomerBinding({ userId: USER, existingCustomerId: "cus_1", customer: customer({ metadataUserId: OTHER }) });
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("CUSTOMER_USER_MISMATCH");
      expect(d.httpStatus).toBe(409);
    }
  });
});

describe("toCustomerView", () => {
  it("normalise un Customer Stripe", () => {
    expect(toCustomerView({ id: "cus_1", metadata: { user_id: USER } })).toEqual({ id: "cus_1", deleted: false, metadataUserId: USER });
  });

  it("normalise un DeletedCustomer", () => {
    expect(toCustomerView({ id: "cus_1", deleted: true })).toEqual({ id: "cus_1", deleted: true, metadataUserId: null });
  });

  it.each([null, undefined, "cus_1", {}, { id: 42 }])("entrée invalide %# → null", (raw) => {
    expect(toCustomerView(raw)).toBeNull();
  });
});

describe("clés d'idempotence", () => {
  it("customer : déterministe et propre à l'utilisateur", () => {
    expect(customerIdempotencyKey(USER)).toBe("cs-customer:user-1");
    expect(customerIdempotencyKey(USER)).toBe(customerIdempotencyKey(USER));
    expect(customerIdempotencyKey(OTHER)).not.toBe(customerIdempotencyKey(USER));
  });

  it("checkout : déterministe pour (user, produit, prix)", () => {
    const a = checkoutIdempotencyKey({ userId: USER, agentSlug: "pierre", priceId: "price_eur" });
    const b = checkoutIdempotencyKey({ userId: USER, agentSlug: "pierre", priceId: "price_eur" });
    expect(a).toBe(b);
    expect(a).toBe("cs-checkout:user-1:pierre:price_eur");
  });

  it("checkout : un changement de prix produit une NOUVELLE clé (session légitime)", () => {
    const eur = checkoutIdempotencyKey({ userId: USER, agentSlug: "pierre", priceId: "price_eur" });
    const chf = checkoutIdempotencyKey({ userId: USER, agentSlug: "pierre", priceId: "price_chf" });
    expect(eur).not.toBe(chf);
  });

  it("checkout : cloisonne les utilisateurs et les produits", () => {
    const base = { agentSlug: "pierre", priceId: "price_eur" };
    expect(checkoutIdempotencyKey({ ...base, userId: USER })).not.toBe(checkoutIdempotencyKey({ ...base, userId: OTHER }));
    expect(checkoutIdempotencyKey({ userId: USER, agentSlug: "pierre", priceId: "p" })).not.toBe(
      checkoutIdempotencyKey({ userId: USER, agentSlug: "clara", priceId: "p" }),
    );
  });
});
