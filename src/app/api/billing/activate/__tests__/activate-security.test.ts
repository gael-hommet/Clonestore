// Tests de sécurité de la VRAIE route POST /api/billing/activate.
//
// Régression fermée : la route accordait `status:"active"` à tout porteur d'un Bearer
// valide, SANS jamais interroger Stripe (accès payant gratuit). On prouve désormais :
//   • pas de Bearer                       → 401, aucune écriture ;
//   • Bearer valide sans abonnement       → 402, aucune écriture  ← la faille ;
//   • abonnement non actif                → 402, aucune écriture ;
//   • abonnement d'un autre utilisateur   → 403, aucune écriture ;
//   • Stripe non configuré                → 503, aucune écriture ;
//   • abonnement réellement actif         → 200 + écriture idempotente.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  order: null as { stripe_subscription_id: string | null; stripe_customer_id: string | null } | null,
  sub: null as Record<string, unknown> | null,
  user: { id: "user-1" } as { id: string } | null,
  authError: null as { message: string } | null,
  upsert: vi.fn(),
}));

vi.mock("@/lib/billing/order-activation", () => ({
  createOrderAdminClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: h.authError }) },
  }),
  getOrderStatus: async () => h.order,
  upsertOrderActivation: async (...args: unknown[]) => { h.upsert(...args); },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: {
      retrieve: async () => {
        if (!h.sub) throw new Error("No such subscription");
        return h.sub;
      },
    },
  }),
}));

async function post(headers: Record<string, string> = { authorization: "Bearer tok" }) {
  const { POST } = await import("../route");
  return POST(new Request("http://x/api/billing/activate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ agent_slug: "pierre" }),
  }));
}

const activeSub = { id: "sub_1", status: "active", customer: "cus_1", metadata: { user_id: "user-1", agent_slug: "pierre" } };

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_activate";
  h.order = null;
  h.sub = null;
  h.user = { id: "user-1" };
  h.authError = null;
  h.upsert.mockClear();
});

describe("POST /api/billing/activate — aucun octroi sans preuve Stripe", () => {
  it("sans Bearer → 401 et aucune écriture", async () => {
    const res = await post({});
    expect(res.status).toBe(401);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("Bearer invalide → 401 et aucune écriture", async () => {
    h.user = null;
    h.authError = { message: "bad token" };
    const res = await post();
    expect(res.status).toBe(401);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("FAILLE FERMÉE : Bearer valide mais aucun abonnement → 402, aucune écriture", async () => {
    h.order = null;
    const res = await post();
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("NO_SUBSCRIPTION");
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("abonnement introuvable chez Stripe → 402, aucune écriture", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = null;
    const res = await post();
    expect(res.status).toBe(402);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("abonnement annulé → 402, aucune écriture", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { ...activeSub, status: "canceled" };
    const res = await post();
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe("SUBSCRIPTION_NOT_ACTIVE");
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("abonnement d'un autre utilisateur → 403, aucune écriture", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { ...activeSub, metadata: { user_id: "user-2", agent_slug: "pierre" } };
    const res = await post();
    expect(res.status).toBe(403);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("Stripe non configuré → 503, aucune écriture", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await post();
    expect(res.status).toBe(503);
    expect(h.upsert).not.toHaveBeenCalled();
  });
});

describe("POST /api/billing/activate — reflet de la vérité Stripe", () => {
  it("abonnement actif → 200 et upsert du statut réel", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1" };
    h.sub = activeSub;
    const res = await post();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("active");
    expect(h.upsert).toHaveBeenCalledTimes(1);
    expect(h.upsert.mock.calls[0][1]).toMatchObject({
      user_id: "user-1",
      agent_slug: "pierre",
      status: "active",
      stripe_subscription_id: "sub_1",
    });
  });

  it("abonnement en essai → 200 et statut trialing", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1" };
    h.sub = { ...activeSub, status: "trialing" };
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("trialing");
  });

  it("idempotence : deux appels → même résultat", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1" };
    h.sub = activeSub;
    const a = await post();
    const b = await post();
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(h.upsert).toHaveBeenCalledTimes(2);
  });
});
