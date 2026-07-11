// src/lib/clonestore/pricing/__tests__/p10-emit-proofs.test.ts
// P10 §11 — ÉMETTEUR de preuves : calcule les artefacts JSON depuis les modules RÉELS (canon,
// resolver, guard, config, gate, audit) et les écrit dans .p10-proofs/p10-run1/. Les valeurs sont
// donc DÉRIVÉES du code, pas recopiées à la main. Exécuté comme un test (assertions incluses).
import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUPPORTED_LAUNCH_COUNTRIES, EUR_LAUNCH, CHF_LAUNCH, pricingForCountry, canCountryBuyPrice,
  explainCountryPriceDecision, publicPricingCatalog, normalizeCountry,
} from "../country-pricing";
import { resolvePublicPricing } from "../public-pricing-resolver";
import { evaluateCheckoutCountryGuard } from "../checkout-country-guard";
import { validateStripePricingConfig, resolveStripePriceIdForCountry } from "../stripe-pricing-config";
import { buildPricingAuditRecord } from "../pricing-audit";
import { evaluateP10ProductionGate } from "@/lib/clonestore/production/p10-production-gate";

const DIR = resolve(process.cwd(), ".p10-proofs", "p10-run1");
const write = (name: string, obj: unknown) => { mkdirSync(DIR, { recursive: true }); writeFileSync(resolve(DIR, name), JSON.stringify(obj, null, 2)); };
const STRIPE_OK = { eurConfigured: true, chfConfigured: true };

describe("P10 emit proofs (computed from real modules)", () => {
  it("pricing-canon.json", () => {
    const compatibility = SUPPORTED_LAUNCH_COUNTRIES.map((c) => ({
      country: c,
      pricing: (() => { const r = pricingForCountry(c); return r.status === "ok" ? r.pricing : r; })(),
      canBuyEUR: canCountryBuyPrice(c, "STRIPE_PRICE_PIERRE_EUR_MONTHLY"),
      canBuyCHF: canCountryBuyPrice(c, "STRIPE_PRICE_PIERRE_CHF_MONTHLY"),
    }));
    const proof = {
      runId: "p10-run1",
      supported: SUPPORTED_LAUNCH_COUNTRIES, eurLaunch: EUR_LAUNCH, chfLaunch: CHF_LAUNCH,
      catalog: publicPricingCatalog(),
      compatibility,
      unknown: pricingForCountry(null),
      unsupported_US: pricingForCountry("US"),
      normalizeSamples: { "France": normalizeCountry("France"), "SUISSE": normalizeCountry("SUISSE"), " be ": normalizeCountry(" be "), "garbage!!": normalizeCountry("garbage!!") },
      chBuyingEur: explainCountryPriceDecision({ country: "CH", priceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" }),
      frBuyingChf: explainCountryPriceDecision({ country: "FR", priceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY" }),
    };
    // invariants
    expect(compatibility.find((x) => x.country === "CH")?.canBuyEUR).toBe(false);
    expect(compatibility.filter((x) => EUR_LAUNCH.includes(x.country as never)).every((x) => x.canBuyCHF === false)).toBe(true);
    write("pricing-canon.json", proof);
  });

  it("public-pricing-resolver.json", () => {
    const cases = {
      selected_CH: resolvePublicPricing({ selectedCountry: "CH" }),
      selected_FR: resolvePublicPricing({ selectedCountry: "France" }),
      verified_CH_beats_selected_FR: resolvePublicPricing({ companyCountry: "CH", selectedCountry: "FR" }),
      selected_FR_beats_geo_CH: resolvePublicPricing({ selectedCountry: "FR", geoCountry: "CH" }),
      geo_CH_suggests: resolvePublicPricing({ geoCountry: "CH" }),
      weak_acceptlanguage_CH: resolvePublicPricing({ acceptLanguage: "fr-CH,fr;q=0.9" }),
      unknown: resolvePublicPricing({}),
      verified_unsupported_US: resolvePublicPricing({ companyCountry: "US" }),
    };
    expect(cases.unknown.price).toBeNull();
    expect(cases.verified_CH_beats_selected_FR.price?.currency).toBe("CHF");
    write("public-pricing-resolver.json", { runId: "p10-run1", cases });
  });

  it("checkout-guard.json", () => {
    const matrix = {
      ch_requests_eur_forced_chf: evaluateCheckoutCountryGuard({ selectedCountry: "CH", requestedPriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", stripe: STRIPE_OK }),
      fr_requests_chf_forced_eur: evaluateCheckoutCountryGuard({ selectedCountry: "FR", requestedPriceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY", stripe: STRIPE_OK }),
      company_ch_vs_selected_fr: evaluateCheckoutCountryGuard({ companyCountry: "CH", selectedCountry: "FR", stripe: STRIPE_OK }),
      geo_ch_cheap_direction_review: evaluateCheckoutCountryGuard({ selectedCountry: "FR", geoCountry: "CH", stripe: STRIPE_OK }),
      geo_same_currency_allowed: evaluateCheckoutCountryGuard({ selectedCountry: "FR", geoCountry: "BE", stripe: STRIPE_OK }),
      client_priceid_ignored: evaluateCheckoutCountryGuard({ selectedCountry: "CH", requestedPriceId: "price_hacked", requestedCurrency: "EUR", stripe: STRIPE_OK }),
      no_country: evaluateCheckoutCountryGuard({ stripe: STRIPE_OK }),
      unsupported: evaluateCheckoutCountryGuard({ selectedCountry: "US", stripe: STRIPE_OK }),
      ch_chf_not_configured: evaluateCheckoutCountryGuard({ selectedCountry: "CH", stripe: { eurConfigured: true, chfConfigured: false } }),
      production_disabled: evaluateCheckoutCountryGuard({ selectedCountry: "FR", stripe: STRIPE_OK, requireProduction: true, productionReady: false }),
    };
    expect(matrix.ch_requests_eur_forced_chf.resolvedPriceKey).toBe("STRIPE_PRICE_PIERRE_CHF_MONTHLY");
    expect(matrix.ch_chf_not_configured.code).toBe("STRIPE_PRICE_NOT_CONFIGURED");
    write("checkout-guard.json", { runId: "p10-run1", matrix });
  });

  it("stripe-config.json", () => {
    const proof = {
      runId: "p10-run1",
      full_test: validateStripePricingConfig({ forProduction: false, env: { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf" } }),
      production_needs_live: validateStripePricingConfig({ forProduction: true, env: { STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf" } }),
      ch_missing_chf_failclosed: resolveStripePriceIdForCountry("CH", { STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur" }),
      fr_legacy_alias: resolveStripePriceIdForCountry("FR", { STRIPE_PRICE_PIERRE: "price_legacy_eur" }),
      ch_never_uses_legacy: resolveStripePriceIdForCountry("CH", { STRIPE_PRICE_PIERRE: "price_legacy_eur" }),
    };
    expect(proof.ch_missing_chf_failclosed.ok).toBe(false);
    expect(proof.ch_never_uses_legacy.ok).toBe(false);
    write("stripe-config.json", proof);
  });

  it("audit-log-proof.json", () => {
    const rec = buildPricingAuditRecord({
      requestId: "req-demo", userId: "user-demo", selectedCountry: "FR", resolvedCountry: "CH", geoCountry: "CH",
      companyCountry: "CH", requestedPriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY", resolvedPriceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY",
      currency: "CHF", decision: "review_required", reasonCode: "COMPANY_COUNTRY_CONFLICT", ip: "198.51.100.42", at: "2026-07-08T12:00:00.000Z",
    }, { salt: "demo-salt", auditId: "pa_demo" });
    expect(JSON.stringify(rec)).not.toContain("198.51.100.42"); // no raw IP
    expect(rec.ipHash).toMatch(/^ip_/);
    write("audit-log-proof.json", { runId: "p10-run1", note: "IP hashée/tronquée, jamais stockée en clair", sampleRecord: rec });
  });

  it("production-gate.json", () => {
    const perfectEnv = { STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec_x", STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur", STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf", STRIPE_COUNTRY_PRICING_ENABLED: "true" };
    const verdict = evaluateP10ProductionGate(perfectEnv);
    expect(verdict.ok).toBe(false);              // FAIL-CLOSED even with a perfect Stripe env
    expect(verdict.productionAuthorized).toBe(false);
    write("production-gate.json", { runId: "p10-run1", note: "Même avec un env Stripe parfait, la production reste FERMÉE (legal/provider/owner). PRODUCTION_AUTHORIZED=false.", verdict });
  });
});
