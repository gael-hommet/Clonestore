// Routes de cycle de vie d'abonnement : cancel (fin de période), resume, portal, statut.
// On teste les VRAIES fonctions de route avec Stripe et Supabase simulés.

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  user: { id: "user-1", email: "a@b.fr" } as { id: string; email: string } | null,
  authError: null as { message: string } | null,
  order: null as { stripe_subscription_id: string | null; stripe_customer_id: string | null } | null,
  customerId: null as string | null,
  sub: null as Record<string, unknown> | null,
  customer: null as unknown,
  subUpdate: [] as Array<{ id: string; params: Record<string, unknown>; options?: { idempotencyKey?: string } }>,
  portalCreate: [] as Array<Record<string, unknown>>,
  portalThrows: null as string | null,
}));

vi.mock("@/lib/billing/order-activation", () => ({
  createOrderAdminClient: () => ({
    auth: { getUser: async () => ({ data: { user: h.user }, error: h.authError }) },
  }),
  getOrderStatus: async () => h.order,
  getStripeCustomerIdForUser: async () => h.customerId,
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    subscriptions: {
      retrieve: async (id: string) => {
        if (!h.sub) throw new Error("No such subscription");
        return { id, ...h.sub };
      },
      update: async (id: string, params: Record<string, unknown>, options?: { idempotencyKey?: string }) => {
        h.subUpdate.push({ id, params, options });
        return { id, status: "active", cancel_at_period_end: params.cancel_at_period_end === true };
      },
    },
    customers: { retrieve: async () => h.customer },
    billingPortal: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          if (h.portalThrows) throw new Error(h.portalThrows);
          h.portalCreate.push(params);
          return { url: "https://billing.stripe.test/session" };
        },
      },
    },
  }),
}));

vi.mock("@/lib/base-url", () => ({ getBaseUrl: () => "https://app.test" }));

const authHeaders = { authorization: "Bearer tok", "content-type": "application/json" };
const body = JSON.stringify({ agent_slug: "pierre" });

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_lifecycle";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  h.user = { id: "user-1", email: "a@b.fr" };
  h.authError = null;
  h.order = null;
  h.customerId = null;
  h.sub = null;
  h.customer = null;
  h.subUpdate = [];
  h.portalCreate = [];
  h.portalThrows = null;
});

async function callCancel() {
  const { POST } = await import("../../orders/cancel/route");
  return POST(new Request("http://x/api/orders/cancel", { method: "POST", headers: authHeaders, body }));
}
async function callResume() {
  const { POST } = await import("../../orders/resume/route");
  return POST(new Request("http://x/api/orders/resume", { method: "POST", headers: authHeaders, body }));
}
async function callPortal() {
  const { POST } = await import("../portal/route");
  return POST(new Request("http://x/api/billing/portal", { method: "POST", headers: authHeaders }));
}
async function callStatus() {
  const { GET } = await import("../subscription/route");
  return GET(new Request("http://x/api/billing/subscription?agent_slug=pierre", { headers: authHeaders }));
}

describe("POST /api/orders/cancel — annulation en fin de période", () => {
  it("sans Bearer → 401, aucun appel Stripe", async () => {
    const { POST } = await import("../../orders/cancel/route");
    const res = await POST(new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body }));
    expect(res.status).toBe(401);
    expect(h.subUpdate).toHaveLength(0);
  });

  it("aucun abonnement → 404, aucun appel Stripe", async () => {
    h.order = null;
    const res = await callCancel();
    expect(res.status).toBe(404);
    expect(h.subUpdate).toHaveLength(0);
  });

  it("abonnement d'un autre utilisateur → 403, aucune écriture", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { status: "active", metadata: { user_id: "autre" }, cancel_at_period_end: false };
    const res = await callCancel();
    expect(res.status).toBe(403);
    expect(h.subUpdate).toHaveLength(0);
  });

  it("abonnement de l'utilisateur → cancel_at_period_end:true sous clé d'idempotence", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { status: "active", metadata: { user_id: "user-1" }, cancel_at_period_end: false };
    const res = await callCancel();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cancel_at_period_end).toBe(true);
    expect(h.subUpdate[0].params).toEqual({ cancel_at_period_end: true });
    expect(h.subUpdate[0].options?.idempotencyKey).toBe("cs-sub-cancel_at_period_end:sub_1");
  });
});

describe("POST /api/orders/resume — reprise avant échéance", () => {
  it("abonnement de l'utilisateur → cancel_at_period_end:false", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { status: "active", metadata: { user_id: "user-1" }, cancel_at_period_end: true };
    const res = await callResume();
    expect(res.status).toBe(200);
    expect((await res.json()).cancel_at_period_end).toBe(false);
    expect(h.subUpdate[0].params).toEqual({ cancel_at_period_end: false });
    expect(h.subUpdate[0].options?.idempotencyKey).toBe("cs-sub-resume:sub_1");
  });
});

describe("POST /api/billing/portal", () => {
  it("aucun customer → 409, aucune session portail", async () => {
    h.customerId = null;
    const res = await callPortal();
    expect(res.status).toBe(409);
    expect(h.portalCreate).toHaveLength(0);
  });

  it("customer de l'utilisateur → session avec return_url sûre", async () => {
    h.customerId = "cus_1";
    h.customer = { id: "cus_1", metadata: { user_id: "user-1" } };
    const res = await callPortal();
    expect(res.status).toBe(200);
    expect((await res.json()).url).toContain("billing.stripe.test");
    expect(h.portalCreate[0].customer).toBe("cus_1");
    expect(h.portalCreate[0].return_url).toBe("https://app.test/mon-clonestore/facturation");
  });

  it("customer d'un autre utilisateur → 409, aucune session", async () => {
    h.customerId = "cus_1";
    h.customer = { id: "cus_1", metadata: { user_id: "autre" } };
    const res = await callPortal();
    expect(res.status).toBe(409);
    expect(h.portalCreate).toHaveLength(0);
  });

  it("Billing Portal non configuré dans le Dashboard → 503 PORTAL_NOT_CONFIGURED", async () => {
    h.customerId = "cus_1";
    h.customer = { id: "cus_1", metadata: { user_id: "user-1" } };
    h.portalThrows = "No configuration provided and your test mode default configuration has not been created. Provide a configuration or create your default in the Stripe portal settings.";
    const res = await callPortal();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("PORTAL_NOT_CONFIGURED");
  });
});

describe("GET /api/billing/subscription — statut pour l'UI", () => {
  it("aucun abonnement → état none, jamais d'erreur", async () => {
    h.order = null;
    const res = await callStatus();
    expect(res.status).toBe(200);
    expect((await res.json()).subscription.uiState).toBe("none");
  });

  it("annulation programmée → cancel_scheduled + reprenable", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { status: "active", metadata: { user_id: "user-1" }, cancel_at_period_end: true, items: { data: [{ current_period_end: 1_900_000_000 }] } };
    const res = await callStatus();
    const json = await res.json();
    expect(json.subscription.uiState).toBe("cancel_scheduled");
    expect(json.subscription.canResume).toBe(true);
    expect(json.subscription.currentPeriodEnd).toBe(1_900_000_000);
  });

  it("abonnement d'un autre utilisateur → none (aucune fuite)", async () => {
    h.order = { stripe_subscription_id: "sub_1", stripe_customer_id: null };
    h.sub = { status: "active", metadata: { user_id: "autre" }, cancel_at_period_end: false };
    const res = await callStatus();
    expect((await res.json()).subscription.uiState).toBe("none");
  });
});
