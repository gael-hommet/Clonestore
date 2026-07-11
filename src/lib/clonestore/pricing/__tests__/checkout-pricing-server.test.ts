// src/lib/clonestore/pricing/__tests__/checkout-pricing-server.test.ts
// P10 §9 — orchestration serveur du checkout country-aware (signaux, guard, prix, audit).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock du runtime P8 (lecture seule du pays d'entreprise). Contrôlé par __companyRows.
const state: { companyRows: Array<{ registration_country: string | null }> } = { companyRows: [] };
vi.mock("@/lib/pierre/v1/db", () => ({
  getRuntimeDb: async () => ({ query: async () => ({ rows: state.companyRows, rowCount: state.companyRows.length }) }),
}));

import { resolvePierreCheckoutPricing } from "../checkout-pricing-server";

const AT = "2026-07-08T12:00:00.000Z";
function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/checkout", { method: "POST", headers });
}

beforeEach(() => {
  state.companyRows = [];
  vi.stubEnv("STRIPE_PRICE_PIERRE_EUR_MONTHLY", "price_eur_live");
  vi.stubEnv("STRIPE_PRICE_PIERRE_CHF_MONTHLY", "price_chf_live");
  vi.stubEnv("STRIPE_PRICE_PIERRE", "");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("P10 checkout pricing server orchestration", () => {
  it("CH selection + client-requested EUR price/currency → forced CHF price id (client IGNORED)", async () => {
    const audit: unknown[] = [];
    const r = await resolvePierreCheckoutPricing({
      request: req(), userId: "u1", at: AT, auditSink: (rec) => audit.push(rec),
      body: { country: "CH", price_key: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", price_id: "price_hacked", currency: "EUR" },
    });
    expect(r.decision.ok).toBe(true);
    expect(r.decision.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
    expect(r.priceId).toBe("price_chf_live"); // server-derived CHF, not the client's EUR/hacked id
    expect(r.currency).toBe("CHF");
    expect(r.decision.ignoredClientPrice).toBe(true);
    expect(audit).toHaveLength(1);
    expect((audit[0] as { resolvedPriceKey: string }).resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
  });

  it("FR selection → EUR price id", async () => {
    const r = await resolvePierreCheckoutPricing({ request: req(), userId: "u1", at: AT, body: { country: "France" } });
    expect(r.priceId).toBe("price_eur_live");
    expect(r.currency).toBe("EUR");
    expect(r.expectedUnitAmount).toBe(44900);
    expect(r.expectedCurrency).toBe("eur");
  });

  it("verified company CH beats selected FR → COMPANY_COUNTRY_CONFLICT (review, CHF)", async () => {
    state.companyRows = [{ registration_country: "CH" }];
    const r = await resolvePierreCheckoutPricing({ request: req(), userId: "u1", at: AT, body: { country: "FR" } });
    expect(r.decision.ok).toBe(false);
    expect(r.decision.code).toBe("COMPANY_COUNTRY_CONFLICT");
    expect(r.decision.reviewRequired).toBe(true);
    expect(r.resolvedCountry).toBe("CH");
    expect(r.outcome).toBe("review_required");
  });

  it("no country signal → COUNTRY_REQUIRED (no price)", async () => {
    const r = await resolvePierreCheckoutPricing({ request: req(), userId: "u1", at: AT, body: {} });
    expect(r.decision.ok).toBe(false);
    expect(r.decision.code).toBe("COUNTRY_REQUIRED");
    expect(r.priceId).toBeNull();
    expect(r.outcome).toBe("country_required");
  });

  it("unsupported country → COUNTRY_NOT_SUPPORTED", async () => {
    const r = await resolvePierreCheckoutPricing({ request: req(), userId: "u1", at: AT, body: { country: "US" } });
    expect(r.decision.code).toBe("COUNTRY_NOT_SUPPORTED");
    expect(r.priceId).toBeNull();
  });

  it("CHF not configured + CH → STRIPE_PRICE_NOT_CONFIGURED (fail-closed, no EUR fallback)", async () => {
    vi.stubEnv("STRIPE_PRICE_PIERRE_CHF_MONTHLY", "");
    const r = await resolvePierreCheckoutPricing({ request: req(), userId: "u1", at: AT, body: { country: "CH" } });
    expect(r.decision.ok).toBe(false);
    expect(r.decision.code).toBe("STRIPE_PRICE_NOT_CONFIGURED");
    expect(r.priceId).toBeNull();
    // never leaks the EUR price id
    expect(JSON.stringify(r)).not.toContain("price_eur_live");
  });

  it("geo x-vercel-ip-country=CH + selected FR (cheap direction) → REVIEW, captured in audit", async () => {
    const audit: Array<{ geoCountry: string | null; resolvedCountry: string | null; decision: string }> = [];
    const r = await resolvePierreCheckoutPricing({
      request: req({ "x-vercel-ip-country": "CH" }), userId: "u1", at: AT,
      body: { country: "FR" }, auditSink: (rec) => audit.push(rec as never),
    });
    expect(r.resolvedCountry).toBe("FR");           // selection is the resolved country
    expect(r.decision.ok).toBe(false);              // but the cheap-direction geo conflict forces review
    expect(r.decision.reviewRequired).toBe(true);
    expect(r.decision.code).toBe("GEO_WEAK_CONFLICT");
    expect(r.outcome).toBe("review_required");
    expect(audit[0].geoCountry).toBe("CH");         // geo captured for audit/review
  });

  it("geo x-vercel-ip-country=FR + selected FR (no conflict) → allowed EUR", async () => {
    const r = await resolvePierreCheckoutPricing({ request: req({ "x-vercel-ip-country": "FR" }), userId: "u1", at: AT, body: { country: "FR" } });
    expect(r.decision.ok).toBe(true);
    expect(r.priceId).toBe("price_eur_live");
  });
});
