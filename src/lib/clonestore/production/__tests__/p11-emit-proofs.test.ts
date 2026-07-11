// src/lib/clonestore/production/__tests__/p11-emit-proofs.test.ts
// P11 §10 — ÉMETTEUR de preuves : calcule les artefacts JSON depuis les modules RÉELS et les écrit
// dans .p11-proofs/p11-run1/. Valeurs DÉRIVÉES du code (pas recopiées). Exécuté comme un test.
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateStripeLiveReadiness, verifyStripePrice } from "../p11-stripe-live-readiness";
import { reconcileStripeCountry, STRIPE_COUNTRY_RECONCILIATION_PLAN } from "../p11-stripe-country-reconciliation";
import { evaluateLegalTaxReadiness } from "../p11-legal-tax-readiness";
import { evaluateProviderReadiness } from "../p11-provider-readiness";
import { evaluateP11FinalGoLiveReadiness } from "../p11-final-golive-readiness";
import { evaluateP11CommandCenter } from "../p11-final-golive-command-center";

const DIR = resolve(process.cwd(), ".p11-proofs", "p11-run1");
const write = (name: string, obj: unknown) => { mkdirSync(DIR, { recursive: true }); writeFileSync(resolve(DIR, name), JSON.stringify(obj, null, 2)); };

// Env réel du poste (rien de configuré pour le go-live) → tout externe/owner en attente.
const REAL = process.env;

describe("P11 emit proofs (computed from real modules)", () => {
  it("stripe-live-readiness.json", () => {
    const real = evaluateStripeLiveReadiness(REAL);
    const demoVerify = {
      eur_ok: verifyStripePrice({ active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } }, "EUR"),
      eur_wrong_amount: verifyStripePrice({ active: true, currency: "eur", unit_amount: 39900, recurring: { interval: "month" } }, "EUR"),
      chf_ok: verifyStripePrice({ active: true, currency: "chf", unit_amount: 49900, recurring: { interval: "month" } }, "CHF"),
      ch_using_eur_price: verifyStripePrice({ active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } }, "CHF"),
    };
    expect(real.liveApiVerified).toBe(false);
    // Aucune VALEUR de secret dans la preuve (le préfixe « sk_live_ » en texte de conseil est OK).
    const blob = JSON.stringify(real);
    expect(blob).not.toMatch(/sk_(live|test)_[A-Za-z0-9]{8,}/);
    write("stripe-live-readiness.json", { runId: "p11-run1", realEnvReadiness: real, priceVerificationLogicDemo: demoVerify, note: "Aucun appel Stripe live ; verifyStripePrice() unit-testée ; liveApiVerified=false." });
  });

  it("stripe-country-reconciliation.json", () => {
    const scenarios = {
      selected_FR_billing_CH: reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "CH", chargedCurrency: "eur" }),
      selected_CH_billing_FR: reconcileStripeCountry({ selectedCountry: "CH", stripeBillingCountry: "FR", chargedCurrency: "chf" }),
      company_CH_billing_FR: reconcileStripeCountry({ companyCountry: "CH", selectedCountry: "CH", stripeBillingCountry: "FR" }),
      billing_missing: reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: null }),
      match_FR: reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" }),
      geo_weak_only: reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", geoCountry: "CH", chargedCurrency: "eur" }),
      tax_conflict: reconcileStripeCountry({ selectedCountry: "FR", stripeBillingCountry: "FR", stripeTaxCountry: "CH", chargedCurrency: "eur" }),
    };
    expect(scenarios.selected_FR_billing_CH.result).toBe("refund_required");
    write("stripe-country-reconciliation.json", { runId: "p11-run1", scenarios, plan: STRIPE_COUNTRY_RECONCILIATION_PLAN });
  });

  it("legal-tax-readiness.json", () => {
    const r = evaluateLegalTaxReadiness({});
    expect(r.legalTaxReady).toBe(false);
    write("legal-tax-readiness.json", { runId: "p11-run1", readiness: r });
  });

  it("provider-readiness.json", () => {
    const r = evaluateProviderReadiness(REAL);
    expect(r.ready).toBe(false);
    const blob = JSON.stringify(r);
    expect(blob).not.toContain(process.env.CLONESTORE_SIGNATURE_API_KEY ?? "___never___");
    write("provider-readiness.json", { runId: "p11-run1", readiness: { ...r, signature: { ...r.signature } }, note: "Aucune clé secrète exposée." });
  });

  it("final-golive-readiness.json + final-golive-command-center.json", () => {
    const readiness = evaluateP11FinalGoLiveReadiness(REAL);
    const cc = evaluateP11CommandCenter(REAL);
    expect(readiness.productionAuthorized).toBe(false);
    expect(readiness.runtimeProductionAuthorizedConst).toBe(false);
    expect(readiness.finalVerdict).toBe("TECHNICAL_READINESS_VERIFIED_EXTERNAL_GOLIVE_BLOCKED");
    expect(cc.globalStatus).toBe("NOT_READY");
    expect(cc.publicLaunchAllowed).toBe(false);
    // No secret leakage in the aggregate proofs.
    for (const blob of [JSON.stringify(readiness), JSON.stringify(cc)]) {
      expect(blob).not.toMatch(/sk_(live|test)_[A-Za-z0-9]/);
      expect(blob).not.toMatch(/whsec_[A-Za-z0-9]/);
    }
    write("final-golive-readiness.json", { runId: "p11-run1", readiness });
    write("final-golive-command-center.json", { runId: "p11-run1", commandCenter: cc });
  });
});
