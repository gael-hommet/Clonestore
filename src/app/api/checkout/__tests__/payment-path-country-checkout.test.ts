// src/app/api/checkout/__tests__/payment-path-country-checkout.test.ts
//
// PAYMENT PATH CLOSURE (2026-07-24) — preuve que POST /api/checkout résout désormais le pays
// et le prix CÔTÉ SERVEUR pour les 4 pays de lancement (FR/BE/LU/CH), avec la tarification par
// pays révélée par défaut (aucune variable d'env à positionner). Le client ne peut jamais forcer
// un prix/une devise ; le serveur ignore toute valeur client et journalise la tentative.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type CreateCall = { params: Record<string, unknown>; options?: { idempotencyKey?: string } };

const h = vi.hoisted(() => ({
  sessionsCreate: [] as CreateCall[],
  customersCreate: [] as CreateCall[],
}));

vi.mock("stripe", () => {
  class FakeStripe {
    constructor(_key: string, _cfg?: unknown) {}
    prices = {
      retrieve: async (id: string) => {
        if (id === "price_eur_test") return { id, unit_amount: 44900, currency: "eur" };
        if (id === "price_chf_test") return { id, unit_amount: 49900, currency: "chf" };
        return { id, unit_amount: 44900, currency: "eur" };
      },
    };
    customers = {
      retrieve: async () => { throw new Error("not found"); },
      create: async (params: Record<string, unknown>, options?: { idempotencyKey?: string }) => {
        h.customersCreate.push({ params, options });
        return { id: "cus_test_1" };
      },
    };
    checkout = {
      sessions: {
        create: async (params: Record<string, unknown>, options?: { idempotencyKey?: string }) => {
          h.sessionsCreate.push({ params, options });
          return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" };
        },
      },
    };
  }
  return { default: FakeStripe };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "PAYMENT_PATH_TEST-user-1", email: "payment-path-test@example.com" } }, error: null }) },
  }),
}));

vi.mock("@/lib/pierre/access", () => ({ hasPierreAccess: async () => ({ ok: false, error: null }) }));
vi.mock("@/lib/billing/order-activation", () => ({
  getStripeCustomerIdForUser: async () => null,
  getOrderStatus: async () => null,
}));
vi.mock("@/lib/clonestore/conversion/storage", () => ({
  isConversionBackendAvailable: () => false,
  getConversionSession: () => null,
}));
// Aucune entreprise vérifiée en base pour ces tests -> le pays autoritatif vient de la
// sélection transmise par /checkout (comportement "utilisateur sans entreprise validée").
vi.mock("@/lib/pierre/v1/db", () => ({
  getRuntimeDb: async () => ({ query: async () => ({ rows: [] }) }),
}));

// LEGAL AND COMMERCIAL TRUST CLOSURE (2026-07-24) — POST /api/checkout now requires a
// legal_acceptance payload (CGV + confidentialité version + timestamp) before creating any
// session. Injected by default here so the 10 pre-existing Payment Path assertions below stay
// focused on pricing/idempotency, not acceptance; a test overrides it explicitly to prove the
// server-side refusal still fires even if a caller bypasses the checkout page's own checkbox.
const DEFAULT_LEGAL_ACCEPTANCE = {
  cgv_version: "Draft 1.0",
  privacy_version: "Draft 1.0",
  accepted_at: "2026-07-24T00:00:00.000Z",
};

async function post(body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const req = new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    headers: { authorization: "Bearer tok", "content-type": "application/json" },
    body: JSON.stringify({ legal_acceptance: DEFAULT_LEGAL_ACCEPTANCE, ...body }),
  });
  return POST(req);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";
  process.env.STRIPE_SECRET_KEY = "sk_test_payment_path";
  process.env.STRIPE_PRICE_PIERRE_EUR_MONTHLY = "price_eur_test";
  process.env.STRIPE_PRICE_PIERRE_CHF_MONTHLY = "price_chf_test";
  delete process.env.STRIPE_PRICE_PIERRE; // isole du legacy alias pour ce test
  delete process.env.STRIPE_COUNTRY_PRICING_ENABLED; // révélé par défaut — pas besoin de le positionner
  delete process.env.CLONESTORE_PAYMENT_MODE;
  h.sessionsCreate = [];
  h.customersCreate = [];
});

describe("PAYMENT PATH CLOSURE — /api/checkout par pays (tarification révélée par défaut)", () => {
  it("France : session EUR 449€, metadata FR, price_eur_test", async () => {
    const res = await post({ agent_slug: "pierre", country: "FR" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(h.sessionsCreate).toHaveLength(1);
    expect(h.sessionsCreate[0].params.line_items).toEqual([{ price: "price_eur_test", quantity: 1 }]);
    expect((h.sessionsCreate[0].params.metadata as Record<string, string>).selected_country).toBe("FR");
  });

  it("Belgique : session EUR 449€, metadata BE", async () => {
    const res = await post({ agent_slug: "pierre", country: "BE" });
    expect(res.status).toBe(200);
    expect(h.sessionsCreate[0].params.line_items).toEqual([{ price: "price_eur_test", quantity: 1 }]);
    expect((h.sessionsCreate[0].params.metadata as Record<string, string>).selected_country).toBe("BE");
  });

  it("Luxembourg : session EUR 449€, metadata LU", async () => {
    const res = await post({ agent_slug: "pierre", country: "LU" });
    expect(res.status).toBe(200);
    expect(h.sessionsCreate[0].params.line_items).toEqual([{ price: "price_eur_test", quantity: 1 }]);
    expect((h.sessionsCreate[0].params.metadata as Record<string, string>).selected_country).toBe("LU");
  });

  it("Suisse : session CHF 499, metadata CH, price_chf_test (jamais price_eur_test)", async () => {
    const res = await post({ agent_slug: "pierre", country: "CH" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(h.sessionsCreate[0].params.line_items).toEqual([{ price: "price_chf_test", quantity: 1 }]);
    expect((h.sessionsCreate[0].params.metadata as Record<string, string>).selected_country).toBe("CH");
    expect((h.sessionsCreate[0].params.metadata as Record<string, string>).expected_currency).toBe("chf");
  });

  it("pays absent -> COUNTRY_REQUIRED, aucune session créée", async () => {
    const res = await post({ agent_slug: "pierre" });
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("COUNTRY_REQUIRED");
    expect(h.sessionsCreate).toHaveLength(0);
  });

  it("pays non supporté (DE) -> COUNTRY_NOT_SUPPORTED, aucune session créée", async () => {
    const res = await post({ agent_slug: "pierre", country: "DE" });
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("COUNTRY_NOT_SUPPORTED");
    expect(h.sessionsCreate).toHaveLength(0);
  });

  it("le client ne peut PAS forcer un price_id/une devise différente de son pays : CH + price_key EUR forcé -> prix CHF quand même, jamais de repli EUR", async () => {
    const res = await post({ agent_slug: "pierre", country: "CH", price_key: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", currency: "eur" });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(h.sessionsCreate[0].params.line_items).toEqual([{ price: "price_chf_test", quantity: 1 }]); // jamais price_eur_test
  });

  it("un price_id brut envoyé par le client est totalement ignoré (jamais utilisé dans line_items)", async () => {
    await post({ agent_slug: "pierre", country: "FR", price_id: "price_ATTAQUE_arbitraire" });
    expect(h.sessionsCreate[0].params.line_items).toEqual([{ price: "price_eur_test", quantity: 1 }]);
  });

  it("double requête concurrente FR : idempotencyKey identique (Stripe dédupliquerait la 2e création)", async () => {
    const body = { agent_slug: "pierre", country: "FR" };
    await post(body);
    await post(body);
    expect(h.sessionsCreate).toHaveLength(2);
    expect(h.sessionsCreate[0].options?.idempotencyKey).toBe(h.sessionsCreate[1].options?.idempotencyKey);
  });

  it("changement de pays (même utilisateur) -> idempotencyKey DIFFÉRENTE (bascule EUR->CHF légitime crée une vraie nouvelle session)", async () => {
    await post({ agent_slug: "pierre", country: "FR" });
    await post({ agent_slug: "pierre", country: "CH" });
    expect(h.sessionsCreate[0].options?.idempotencyKey).not.toBe(h.sessionsCreate[1].options?.idempotencyKey);
  });

  it("refuse sans acceptation CGV/confidentialité -> LEGAL_ACCEPTANCE_REQUIRED, aucune session créée", async () => {
    const res = await post({ agent_slug: "pierre", country: "FR", legal_acceptance: undefined });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.code).toBe("LEGAL_ACCEPTANCE_REQUIRED");
    expect(h.sessionsCreate).toHaveLength(0);
  });
});
