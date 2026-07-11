// Customer mapping sur la VRAIE route POST /api/checkout.
//
// Régression fermée : `checkout.sessions.create` ne passait ni `customer` ni
// `client_reference_id` et n'avait aucune clé d'idempotence. Stripe créait donc un
// Customer neuf à chaque session (réabonnement, double-clic, retry réseau).
//
// On prouve ici : réutilisation du Customer existant, création idempotente sinon,
// refus si le Customer appartient à un autre compte, et clés d'idempotence sur les
// deux écritures Stripe (POST customers.create, POST checkout.sessions.create).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type CreateCall = { params: Record<string, unknown>; options?: { idempotencyKey?: string } };

const h = vi.hoisted(() => ({
  existingCustomerId: null as string | null,
  retrieved: null as unknown, // valeur renvoyée par customers.retrieve
  retrieveThrows: false,
  customersCreate: [] as CreateCall[],
  sessionsCreate: [] as CreateCall[],
}));

vi.mock("stripe", () => {
  class FakeStripe {
    constructor(_key: string, _cfg?: unknown) {}
    prices = { retrieve: async () => ({ id: "price_x", unit_amount: 44900, currency: "eur" }) };
    customers = {
      retrieve: async (_id: string) => {
        if (h.retrieveThrows) throw new Error("No such customer");
        return h.retrieved;
      },
      create: async (params: Record<string, unknown>, options?: { idempotencyKey?: string }) => {
        h.customersCreate.push({ params, options });
        return { id: "cus_nouveau" };
      },
    };
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>, options?: { idempotencyKey?: string }) => {
          h.sessionsCreate.push({ params, options });
          return { id: "cs_1", url: "https://checkout.stripe.test/cs_1" };
        },
      },
    };
  }
  return { default: FakeStripe };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "user-1", email: "cabinet@exemple.fr" } }, error: null }) },
  }),
}));

vi.mock("@/lib/pierre/access", () => ({
  hasPierreAccess: async () => ({ ok: false, error: null }),
}));

vi.mock("@/lib/billing/order-activation", () => ({
  getStripeCustomerIdForUser: async () => h.existingCustomerId,
  getOrderStatus: async () => null,
}));

vi.mock("@/lib/clonestore/conversion/storage", () => ({
  isConversionBackendAvailable: () => false,
  getConversionSession: () => null,
}));

async function post() {
  const { POST } = await import("../route");
  const req = new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { authorization: "Bearer tok", "content-type": "application/json" },
    body: JSON.stringify({ agent_slug: "pierre" }),
  });
  return POST(req);
}

beforeEach(() => {
  // createAdminClient() valide la présence de ces variables avant d'appeler createClient.
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_customer_mapping";
  process.env.STRIPE_PRICE_PIERRE = "price_x";
  delete process.env.STRIPE_COUNTRY_PRICING_ENABLED;
  delete process.env.CLONESTORE_PAYMENT_MODE;
  h.existingCustomerId = null;
  h.retrieved = null;
  h.retrieveThrows = false;
  h.customersCreate = [];
  h.sessionsCreate = [];
});

describe("POST /api/checkout — réutilisation du Stripe Customer", () => {
  it("customer existant et valide → réutilisé, AUCUN customer créé", async () => {
    h.existingCustomerId = "cus_1";
    h.retrieved = { id: "cus_1", metadata: { user_id: "user-1" } };

    const res = await post();
    expect(res.status).toBe(200);
    expect(h.customersCreate).toHaveLength(0);
    expect(h.sessionsCreate[0].params.customer).toBe("cus_1");
  });

  it("customer historique sans metadata → réutilisé (liaison établie par orders)", async () => {
    h.existingCustomerId = "cus_legacy";
    h.retrieved = { id: "cus_legacy" };

    await post();
    expect(h.customersCreate).toHaveLength(0);
    expect(h.sessionsCreate[0].params.customer).toBe("cus_legacy");
  });

  it("aucun customer local → création idempotente avec l'email et la metadata user_id", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(h.customersCreate).toHaveLength(1);
    expect(h.customersCreate[0].params).toEqual({ email: "cabinet@exemple.fr", metadata: { user_id: "user-1" } });
    expect(h.customersCreate[0].options?.idempotencyKey).toBe("cs-customer:user-1");
    expect(h.sessionsCreate[0].params.customer).toBe("cus_nouveau");
  });

  it("customer local introuvable chez Stripe → un nouveau est créé", async () => {
    h.existingCustomerId = "cus_disparu";
    h.retrieveThrows = true;

    await post();
    expect(h.customersCreate).toHaveLength(1);
    expect(h.sessionsCreate[0].params.customer).toBe("cus_nouveau");
  });

  it("customer supprimé chez Stripe → un nouveau est créé", async () => {
    h.existingCustomerId = "cus_1";
    h.retrieved = { id: "cus_1", deleted: true };

    await post();
    expect(h.customersCreate).toHaveLength(1);
    expect(h.sessionsCreate[0].params.customer).toBe("cus_nouveau");
  });
});

describe("POST /api/checkout — refus si le customer appartient à un autre compte", () => {
  it("metadata.user_id d'un autre utilisateur → 409, aucune session, aucun doublon", async () => {
    h.existingCustomerId = "cus_1";
    h.retrieved = { id: "cus_1", metadata: { user_id: "user-2" } };

    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CUSTOMER_USER_MISMATCH");
    expect(h.sessionsCreate).toHaveLength(0);
    expect(h.customersCreate).toHaveLength(0);
  });
});

describe("POST /api/checkout — client_reference_id et idempotence", () => {
  it("la session porte client_reference_id = user_id", async () => {
    await post();
    expect(h.sessionsCreate[0].params.client_reference_id).toBe("user-1");
  });

  it("la session est créée sous une clé d'idempotence (user, produit, prix)", async () => {
    await post();
    expect(h.sessionsCreate[0].options?.idempotencyKey).toBe("cs-checkout:user-1:pierre:price_x");
  });

  it("double-clic : deux appels → clé identique (Stripe renvoie la session d'origine)", async () => {
    h.existingCustomerId = "cus_1";
    h.retrieved = { id: "cus_1", metadata: { user_id: "user-1" } };

    await post();
    await post();
    expect(h.sessionsCreate).toHaveLength(2);
    expect(h.sessionsCreate[0].options?.idempotencyKey).toBe(h.sessionsCreate[1].options?.idempotencyKey);
  });

  it("customer_update recopie adresse et nom sur le Customer (signal pays P15)", async () => {
    await post();
    expect(h.sessionsCreate[0].params.customer_update).toEqual({ address: "auto", name: "auto" });
    expect(h.sessionsCreate[0].params.billing_address_collection).toBe("required");
  });
});
