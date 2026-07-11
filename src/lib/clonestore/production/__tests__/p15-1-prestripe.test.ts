// src/lib/clonestore/production/__tests__/p15-1-prestripe.test.ts
// P15.1 §9 — Pré-Stripe / mode démo sûr : paiement jamais live par défaut, aucune session en mode
// disabled, flux démo/fondateur non payant, prix pays corrects, réconciliation toujours bloquante,
// production toujours off, aucune revendication live dans la copie.
import { describe, it, expect } from "vitest";
import { resolvePaymentMode, paymentModeStatus, canCreateCheckoutSession, paidAccessPossible, paymentExplicitlyBlocked } from "../p15-1-payment-mode";
import { prelaunchStatus, prelaunchCopyIsSafe, verifyNoLiveClaim, SAFE_SIGNATURE_COPY, DEMO_FOUNDER_ACTIONS } from "../p15-1-prelaunch";
import { evaluateCheckoutReconciliationGate } from "../p15-checkout-reconciliation-gate";
import { evaluateP15ExternalGoLive } from "../p15-external-golive-contract";
import { PRODUCTION_AUTHORIZED } from "../p10-production-gate";
import { pricingForCountry } from "@/lib/clonestore/pricing/country-pricing";

const EMPTY = {} as Record<string, string | undefined>;
const LIVE_KEYS = { STRIPE_SECRET_KEY: "sk_live_" + "x".repeat(24), STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_PIERRE_EUR_MONTHLY: "p_eur", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "p_chf" };

describe("P15.1 — Payment mode (never live, fail-closed)", () => {
  it("le mode par défaut n'est JAMAIS live", () => {
    expect(resolvePaymentMode(EMPTY)).not.toBe("live");                 // aucune clé → disabled
    expect(resolvePaymentMode({ STRIPE_SECRET_KEY: "sk_test_a" })).toBe("test");
    // clés LIVE présentes MAIS production non autorisée (plancher P10) → disabled, jamais live
    expect(resolvePaymentMode(LIVE_KEYS)).toBe("disabled");
    expect(paidAccessPossible(LIVE_KEYS)).toBe(false);
  });
  it("mode disabled → aucune session de checkout, paiement explicitement bloqué", () => {
    expect(canCreateCheckoutSession({ CLONESTORE_PAYMENT_MODE: "disabled" })).toBe(false);
    expect(paymentExplicitlyBlocked({ CLONESTORE_PAYMENT_MODE: "disabled" })).toBe(true);
    expect(paymentExplicitlyBlocked({ CLONESTORE_PAYMENT_DISABLED: "true" })).toBe(true);
    expect(paymentExplicitlyBlocked(LIVE_KEYS)).toBe(true);             // clés live sans autorisation
    expect(paymentExplicitlyBlocked(EMPTY)).toBe(false);               // aucune clé → géré par 503 existant
  });
  it("statut : allowed actions (démo/tarifs) + blocked actions (session/charge)", () => {
    const s = paymentModeStatus(EMPTY);
    expect(s.mode).toBe("disabled");
    expect(s.paidAccessPossible).toBe(false);
    expect(s.productionAuthorized).toBe(false);
    expect(s.allowedActions.some((a) => /démo/i.test(a))).toBe(true);
    expect(s.blockedActions.some((a) => /paiement|session/i.test(a))).toBe(true);
  });
});

describe("P15.1 — Demo/founder flow (non-paid)", () => {
  it("aucune action démo/fondateur n'active un accès payant", () => {
    const s = prelaunchStatus();
    expect(s.noneOfTheActionsActivatePaidAccess).toBe(true);
    expect(DEMO_FOUNDER_ACTIONS.every((a) => a.paid === false)).toBe(true);
    expect(s.demoAvailable).toBe(true);
    expect(s.founderAccessAvailable).toBe(true);
    expect(s.paymentOpen).toBe(false);
  });
});

describe("P15.1 — Pricing still correct (display only)", () => {
  it("FR/BE/LU = 449 EUR, CH = 499 CHF", () => {
    for (const c of ["FR", "BE", "LU"]) { const r = pricingForCountry(c); expect(r.status).toBe("ok"); if (r.status === "ok") { expect(r.pricing.amount).toBe(449); expect(r.pricing.currency).toBe("EUR"); } }
    const ch = pricingForCountry("CH"); if (ch.status === "ok") { expect(ch.pricing.amount).toBe(499); expect(ch.pricing.currency).toBe("CHF"); }
  });
});

describe("P15.1 — Reconciliation logic still blocking (test-mode rehearsal)", () => {
  const enabled = { enabled: true };
  it("CH billed EUR → bloqué", () => {
    expect(evaluateCheckoutReconciliationGate({ companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" }, enabled).shouldActivate).toBe(false);
    expect(evaluateCheckoutReconciliationGate({ stripeBillingCountry: "CH", chargedCurrency: "eur" }, enabled).shouldActivate).toBe(false);
  });
  it("FR/BE/LU billed CHF → bloqué", () => {
    for (const c of ["FR", "BE", "LU"]) expect(evaluateCheckoutReconciliationGate({ companyCountry: c, stripeBillingCountry: c, chargedCurrency: "chf" }, enabled).shouldActivate).toBe(false);
  });
  it("combinaisons correctes activent (logique inchangée)", () => {
    expect(evaluateCheckoutReconciliationGate({ companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" }, enabled).shouldActivate).toBe(true);
    expect(evaluateCheckoutReconciliationGate({ companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "chf" }, enabled).shouldActivate).toBe(true);
  });
});

describe("P15.1 — Production stays off; owner approval alone cannot launch", () => {
  it("PRODUCTION_AUTHORIZED reste false", () => { expect(PRODUCTION_AUTHORIZED).toBe(false); });
  it("owner approuvé seul → aucune autorisation de production ni lancement payant", () => {
    const r = evaluateP15ExternalGoLive({ env: { CLONESTORE_OWNER_GOLIVE_APPROVED: "true", CLONESTORE_OWNER_GOLIVE_APPROVED_BY: "Gael", CLONESTORE_OWNER_GOLIVE_DECISION: "approve_production" } });
    expect(r.ownerApproved).toBe(true);
    expect(r.productionAuthorizationAllowed).toBe(false);
    expect(r.publicPaidLaunchAllowed).toBe(false);
  });
});

describe("P15.1 — Copy safety (no live claim, safe signature fallback)", () => {
  it("copie de pré-lancement + signature repli = sûres", () => {
    expect(prelaunchCopyIsSafe()).toBe(true);
    for (const c of SAFE_SIGNATURE_COPY) expect(verifyNoLiveClaim(c).safe).toBe(true);
  });
  it("les revendications live/signature auto sont détectées comme NON sûres", () => {
    for (const bad of ["Document signé automatiquement", "Yousign live", "Signature électronique intégrée", "Stripe live activé", "Production live"]) {
      expect(verifyNoLiveClaim(bad).safe).toBe(false);
    }
  });
  it("la copie du garde checkout PAYMENT_DISABLED passe le linter (review P15.1 fix)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/checkout/route.ts"), "utf8");
    // Extrait le message d'erreur du garde PAYMENT_DISABLED et vérifie l'absence de revendication live.
    const m = route.match(/PAYMENT_DISABLED[\s\S]{0,80}?error:\s*"([^"]+)"/);
    expect(m).toBeTruthy();
    // la COPIE utilisateur du garde ne contient aucune revendication live (les commentaires de code P10
    // « clés Stripe LIVE » ne sont pas de la copie utilisateur → on ne teste QUE le message d'erreur).
    if (m) expect(verifyNoLiveClaim(m[1]).safe).toBe(true);
  });
});
