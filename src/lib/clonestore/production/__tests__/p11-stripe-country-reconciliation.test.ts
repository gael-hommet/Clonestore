// src/lib/clonestore/production/__tests__/p11-stripe-country-reconciliation.test.ts
// P11 §9 — réconciliation du pays de facturation au paiement.
import { describe, it, expect } from "vitest";
import { reconcileStripeCountry } from "../p11-stripe-country-reconciliation";

describe("P11 Stripe country reconciliation", () => {
  it("selected FR + Stripe billing CH → refund_required (Swiss billing on EUR offer)", () => {
    const d = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "CH", chargedCurrency: "eur" });
    expect(d.result).toBe("refund_required");
    expect(d.code).toBe("STRIPE_BILLING_COUNTRY_CONFLICT");
  });

  it("selected CH + Stripe billing FR → review (billing ≠ expected)", () => {
    const d = reconcileStripeCountry({ selectedCountry: "CH", stripeBillingCountry: "FR", chargedCurrency: "chf" });
    expect(["review_required", "blocked"]).toContain(d.result);
    expect(d.expectedCountry).toBe("CH");
  });

  it("company CH + billing FR → blocked (COMPANY_COUNTRY_CONFLICT)", () => {
    const d = reconcileStripeCountry({ companyCountry: "CH", selectedCountry: "CH", stripeBillingCountry: "FR" });
    expect(d.result).toBe("blocked");
    expect(d.code).toBe("COMPANY_COUNTRY_CONFLICT");
  });

  it("Stripe billing country missing → review_required", () => {
    const d = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: null });
    expect(d.result).toBe("review_required");
    expect(d.code).toBe("STRIPE_BILLING_COUNTRY_MISSING");
  });

  it("matching countries → allowed", () => {
    const d = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" });
    expect(d.result).toBe("allowed");
    expect(d.code).toBe("STRIPE_BILLING_COUNTRY_MATCH");
    expect(d.currency).toBe("EUR");
  });

  it("CH matching CH → allowed with CHF", () => {
    const d = reconcileStripeCountry({ selectedCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "chf" });
    expect(d.result).toBe("allowed");
    expect(d.currency).toBe("CHF");
  });

  it("country matches but WRONG currency charged (CH billed EUR) → refund_required (unconditional currency check)", () => {
    const d = reconcileStripeCountry({ selectedCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" });
    expect(d.result).toBe("refund_required"); // CH must be charged CHF even when the country matches
    const d2 = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "chf" });
    expect(d2.result).toBe("refund_required"); // FR must be charged EUR
  });

  it("weak geo conflict alone (geo CH, billing FR = expected FR) → allowed + warning, not proof", () => {
    const d = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", geoCountry: "CH", chargedCurrency: "eur" });
    expect(d.result).toBe("allowed"); // billing (strong) confirms FR; geo is only a warning
    expect(d.warnings.join(" ")).toContain("GEO_WEAK_CONFLICT");
  });

  it("tax country conflict → review_required (STRIPE_TAX_COUNTRY_CONFLICT)", () => {
    const d = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", stripeTaxCountry: "CH", chargedCurrency: "eur" });
    expect(d.result).toBe("review_required");
    expect(d.code).toBe("STRIPE_TAX_COUNTRY_CONFLICT");
  });

  it("payment method country conflict → review_required", () => {
    const d = reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", paymentMethodCountry: "CH", chargedCurrency: "eur" });
    expect(d.result).toBe("review_required");
    expect(d.code).toBe("PAYMENT_METHOD_COUNTRY_CONFLICT");
  });

  it("no expected country at all → manual_review", () => {
    const d = reconcileStripeCountry({});
    expect(d.result).toBe("manual_review");
    expect(d.code).toBe("MANUAL_REVIEW_REQUIRED");
  });
});
