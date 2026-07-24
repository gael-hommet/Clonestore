// src/lib/clonestore/production/__tests__/p15-reconciliation-revealed-default.test.ts
// PAYMENT PATH CLOSURE (2026-07-24) — isCheckoutReconciliationEnabled() est désormais révélée
// par défaut. La réconciliation pays au checkout devient le comportement standard, pas une
// fonctionnalité opt-in oubliée.
import { describe, it, expect } from "vitest";
import {
  isCheckoutReconciliationEnabled,
  evaluateCheckoutReconciliationGate,
} from "@/lib/clonestore/production/p15-checkout-reconciliation-gate";

describe("isCheckoutReconciliationEnabled — révélé par défaut", () => {
  it("env vide -> true", () => {
    expect(isCheckoutReconciliationEnabled({})).toBe(true);
  });
  it("arrêt d'urgence explicite -> false", () => {
    expect(isCheckoutReconciliationEnabled({ STRIPE_COUNTRY_RECONCILIATION_ENABLED: "false" })).toBe(false);
  });
});

describe("evaluateCheckoutReconciliationGate — comportement par défaut (flag révélé)", () => {
  it("FR payé en EUR avec facturation FR -> activation (aucun conflit)", () => {
    const g = evaluateCheckoutReconciliationGate(
      { companyCountry: null, selectedCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" },
      { env: {} },
    );
    expect(g.enabled).toBe(true);
    expect(g.shouldActivate).toBe(true);
    expect(g.activationStatus).toBe("active");
  });

  it("session déclarée France mais facturation Stripe Suisse -> PAS d'activation silencieuse (country_review_required)", () => {
    const g = evaluateCheckoutReconciliationGate(
      { companyCountry: null, selectedCountry: "FR", stripeBillingCountry: "CH", chargedCurrency: "eur" },
      { env: {} },
    );
    expect(g.shouldActivate).toBe(false);
    expect(g.activationStatus).not.toBe("active");
  });

  it("Suisse facturée en EUR (devise incohérente) -> pas d'activation, remboursement requis", () => {
    const g = evaluateCheckoutReconciliationGate(
      { companyCountry: null, selectedCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" },
      { env: {} },
    );
    expect(g.currencyMismatch).toBe(true);
    expect(g.shouldActivate).toBe(false);
    expect(g.refundRequired).toBe(true);
  });

  it("arrêt d'urgence explicite -> comportement legacy préservé (toujours activé)", () => {
    const g = evaluateCheckoutReconciliationGate(
      { companyCountry: null, selectedCountry: "FR", stripeBillingCountry: "CH", chargedCurrency: "eur" },
      { env: { STRIPE_COUNTRY_RECONCILIATION_ENABLED: "false" } },
    );
    expect(g.enabled).toBe(false);
    expect(g.shouldActivate).toBe(true);
    expect(g.activationStatus).toBe("active");
  });
});
