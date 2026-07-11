// src/lib/clonestore/production/__tests__/p15-external-golive.test.ts
// P15 §10 — Tests de clôture go-live : Stripe live, réconciliation pays, registre légal, provider,
// monitoring, approbation owner, command center. FAIL-CLOSED partout ; jamais de fake readiness.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyStripeLiveReadonly, evaluateWebhookReadiness, maskSecret, keyShape, type StripePriceReader } from "../p15-stripe-live-verification";
import { verifyStripePrice } from "../p11-stripe-live-readiness";
import { evaluateCheckoutReconciliationGate, extractCountrySignalsFromSession } from "../p15-checkout-reconciliation-gate";
import { evaluateLegalTaxArtifactRegistry, legalTaxLaunchDecision, ARTIFACT_DEFINITIONS, type LegalTaxArtifact } from "../p15-legal-tax-artifact-registry";
import { evaluateProviderClosure } from "../p15-provider-closure";
import { evaluateMonitoringRollback } from "../p15-monitoring-rollback";
import { evaluateP15ExternalGoLive, computeP15LaunchStatus, canAuthorizeProduction } from "../p15-external-golive-contract";
import { evaluateP15FinalCommandCenter } from "../p15-final-command-center";
import { PRODUCTION_AUTHORIZED } from "../p10-production-gate";

const EMPTY = {} as Record<string, string | undefined>;

// Helpers pour un environnement "tout externe présent" (mais le plancher P10 reste false).
function fullLiveEnv(): Record<string, string | undefined> {
  return {
    STRIPE_SECRET_KEY: "sk_live_" + "x".repeat(24),
    STRIPE_WEBHOOK_SECRET: "whsec_" + "y".repeat(24),
    STRIPE_PRICE_PIERRE_EUR_MONTHLY: "price_eur_live",
    STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_chf_live",
    STRIPE_COUNTRY_PRICING_ENABLED: "true",
    CLONESTORE_STRIPE_LIVE_VERIFIED: "true",
    STRIPE_COUNTRY_RECONCILIATION_ENABLED: "true",
    CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED: "true",
    CLONESTORE_SIGNATURE_FALLBACK_APPROVED: "true",
    CLONESTORE_MONITORING_ROLLBACK_VERIFIED: "true",
    CLONESTORE_OWNER_GOLIVE_APPROVED: "true",
    CLONESTORE_OWNER_GOLIVE_APPROVED_BY: "Gael",
    CLONESTORE_OWNER_GOLIVE_DECISION: "approve_production",
  };
}
function fullExternalArtifacts(): LegalTaxArtifact[] {
  return ARTIFACT_DEFINITIONS.map((d) => ({
    artifact_id: d.artifact_id, country: d.country, source_type: "external_lawyer" as const,
    status: "approved" as const, reviewed_at: "2026-07-01T00:00:00Z", reviewer: "Cabinet X",
    file_hash: "sha256:" + d.artifact_id, notes: "reviewed", expires_at: null,
  }));
}

describe("P15 A — Stripe live readiness (read-only, fail-closed)", () => {
  it("clé TEST rejetée pour la readiness live", async () => {
    const r = await verifyStripeLiveReadonly({ env: { STRIPE_SECRET_KEY: "sk_test_abc" } });
    expect(r.verdict).toBe("TEST_MODE_BLOCKED");
    expect(r.ready).toBe(false);
  });
  it("aucune clé live locale → EXTERNAL_BLOCKED (jamais fake-ready)", async () => {
    const r = await verifyStripeLiveReadonly({ env: EMPTY });
    expect(r.verdict).toBe("EXTERNAL_BLOCKED");
    expect(r.ready).toBe(false);
  });
  it("prix EUR doit être 44900 EUR mensuel ; CHF 49900 CHF mensuel", () => {
    expect(verifyStripePrice({ active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } }, "EUR").ok).toBe(true);
    expect(verifyStripePrice({ active: true, currency: "chf", unit_amount: 49900, recurring: { interval: "month" } }, "CHF").ok).toBe(true);
    // mauvais montant / devise / non actif → invalide
    expect(verifyStripePrice({ active: true, currency: "eur", unit_amount: 39900, recurring: { interval: "month" } }, "EUR").ok).toBe(false);
    expect(verifyStripePrice({ active: true, currency: "usd", unit_amount: 44900, recurring: { interval: "month" } }, "EUR").ok).toBe(false);
    expect(verifyStripePrice({ active: false, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } }, "EUR").ok).toBe(false);
  });
  it("dry-run owner : prix EUR+CHF valides → VERIFIED ; un prix invalide → bloqué", async () => {
    const readGood: StripePriceReader = async (w) => w === "eur" ? { active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } } : { active: true, currency: "chf", unit_amount: 49900, recurring: { interval: "month" } };
    const ok = await verifyStripeLiveReadonly({ env: fullLiveEnv(), readPrice: readGood });
    expect(ok.verdict).toBe("VERIFIED");
    const readBad: StripePriceReader = async (w) => w === "eur" ? { active: true, currency: "eur", unit_amount: 44900, recurring: { interval: "month" } } : null;
    const bad = await verifyStripeLiveReadonly({ env: fullLiveEnv(), readPrice: readBad });
    expect(bad.verdict).not.toBe("VERIFIED");
  });
  it("un seul price id pour EUR et CHF → repli inter-devise INTERDIT", async () => {
    const env = { ...fullLiveEnv(), STRIPE_PRICE_PIERRE_CHF_MONTHLY: "price_eur_live" };
    const r = await verifyStripeLiveReadonly({ env });
    expect(r.noCrossCurrencyFallback).toBe(false);
    expect(r.blockers.some((b) => /repli inter-devise/i.test(b))).toBe(true);
  });
  it("webhook secret manquant → bloqué ; jamais de secret imprimé", () => {
    expect(evaluateWebhookReadiness(EMPTY).ready).toBe(false);
    expect(evaluateWebhookReadiness({ STRIPE_WEBHOOK_SECRET: "whsec_abc" }).ready).toBe(true);
    // masquage : ne révèle jamais la valeur brute
    expect(maskSecret("sk_live_supersecretvalue1234")).not.toContain("supersecret");
    expect(keyShape("sk_live_abc").live).toBe(true);
    expect(keyShape("sk_test_abc").test).toBe(true);
  });
});

describe("P15 B — Billing-country reconciliation (wired gate)", () => {
  const enabled = { enabled: true };
  it("CH facturé en EUR → pas d'activation (refund/review)", () => {
    const g = evaluateCheckoutReconciliationGate({ companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" }, enabled);
    expect(g.decision.result).toBe("refund_required");
    expect(g.shouldActivate).toBe(false);
    expect(g.refundRequired).toBe(true);
  });
  it("FR/BE/LU facturés en CHF → pas d'activation (review/block)", () => {
    for (const c of ["FR", "BE", "LU"]) {
      const g = evaluateCheckoutReconciliationGate({ companyCountry: c, stripeBillingCountry: c, chargedCurrency: "chf" }, enabled);
      expect(g.shouldActivate).toBe(false);
    }
  });
  it("combinaisons correctes activent : FR/BE/LU+EUR, CH+CHF", () => {
    for (const [c, cur] of [["FR", "eur"], ["BE", "eur"], ["LU", "eur"], ["CH", "chf"]] as const) {
      const g = evaluateCheckoutReconciliationGate({ companyCountry: c, stripeBillingCountry: c, chargedCurrency: cur }, enabled);
      expect(g.decision.result).toBe("allowed");
      expect(g.shouldActivate).toBe(true);
    }
  });
  it("pays de facturation manquant → pas d'activation (review)", () => {
    const g = evaluateCheckoutReconciliationGate({ companyCountry: "FR", stripeBillingCountry: null, chargedCurrency: "eur" }, enabled);
    expect(g.decision.result).toBe("review_required");
    expect(g.shouldActivate).toBe(false);
  });
  it("selectedCountry FORGÉ ne peut pas forcer l'activation (billing Stripe gagne)", () => {
    // forge selected=FR alors que billing réel = CH facturé eur (pas d'entreprise) → refund_required
    const g = evaluateCheckoutReconciliationGate({ selectedCountry: "FR", stripeBillingCountry: "CH", chargedCurrency: "eur" }, enabled);
    expect(g.shouldActivate).toBe(false);
    // forge selected=CH alors que company=FR + billing FR eur → company gagne → allowed (forge ignoré)
    const g2 = evaluateCheckoutReconciliationGate({ companyCountry: "FR", selectedCountry: "CH", stripeBillingCountry: "FR", chargedCurrency: "eur" }, enabled);
    expect(g2.decision.result).toBe("allowed");
  });
  it("conflit entreprise/facturation → blocage", () => {
    const g = evaluateCheckoutReconciliationGate({ companyCountry: "FR", stripeBillingCountry: "BE" }, enabled);
    expect(g.decision.result).toBe("blocked");
    expect(g.shouldActivate).toBe(false);
  });
  it("flag OFF → comportement préservé (shouldActivate true) mais audit produit", () => {
    const g = evaluateCheckoutReconciliationGate({ companyCountry: "CH", stripeBillingCountry: "CH", chargedCurrency: "eur" }, { enabled: false });
    expect(g.shouldActivate).toBe(true);          // préserve l'existant
    expect(g.decision.result).toBe("refund_required"); // mais l'audit reflète le conflit
    expect(g.audit.result).toBe("refund_required");
  });
  it("gate déterministe (idempotent) ; signature webhook enforced (invariant)", () => {
    const a = evaluateCheckoutReconciliationGate({ companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" }, enabled);
    const b = evaluateCheckoutReconciliationGate({ companyCountry: "FR", stripeBillingCountry: "FR", chargedCurrency: "eur" }, enabled);
    expect(a.decision.result).toBe(b.decision.result); // même entrée → même décision (idempotent)
    expect(evaluateWebhookReadiness({ STRIPE_WEBHOOK_SECRET: "whsec_x" }).signatureEnforced).toBe(true);
  });
  it("extraction des signaux depuis la session (billing/tax/currency/metadata)", () => {
    const s = extractCountrySignalsFromSession({ customer_details: { address: { country: "CH" } }, currency: "eur", metadata: { selected_country: "FR", company_country: "CH" } });
    expect(s.stripeBillingCountry).toBe("CH");
    expect(s.chargedCurrency).toBe("eur");
    expect(s.selectedCountry).toBe("FR");
    expect(s.companyCountry).toBe("CH");
  });
});

describe("P15 B2 — reconciliation FONCTIONNELLE sur trafic réel (fix review REFUTED)", () => {
  const enabled = { enabled: true };
  it("billing SANS metadata : CH+EUR bloqué, FR+EUR autorisé (plus d'over-block)", () => {
    // AVANT le fix : expected=null → manual_review pour tout paiement réel (over-block). APRÈS : billing = repli attendu.
    expect(evaluateCheckoutReconciliationGate({ stripeBillingCountry: "CH", chargedCurrency: "eur" }, enabled).shouldActivate).toBe(false); // abus attrapé
    expect(evaluateCheckoutReconciliationGate({ stripeBillingCountry: "FR", chargedCurrency: "eur" }, enabled).shouldActivate).toBe(true);  // légitime non bloqué
    expect(evaluateCheckoutReconciliationGate({ stripeBillingCountry: "CH", chargedCurrency: "chf" }, enabled).shouldActivate).toBe(true);
  });
  it("cohérence devise SANS billing (chemin subscription.*) : mismatch bloqué, cohérent en revue (jamais actif sans billing)", () => {
    // subscription.* sans adresse : un mismatch devise/pays est bloqué (refund) ; un cas cohérent mais sans
    // billing ne s'active JAMAIS auto (review) — stance de sécurité. Le webhook récupère le billing du customer
    // (best-effort) pour le chemin fort ; sans lui, on ne fabrique pas une activation.
    const chMismatch = evaluateCheckoutReconciliationGate({ selectedCountry: "CH", chargedCurrency: "eur" }, enabled);
    expect(chMismatch.currencyMismatch).toBe(true);
    expect(chMismatch.shouldActivate).toBe(false);
    expect(chMismatch.refundRequired).toBe(true);
    const frConsistentNoBilling = evaluateCheckoutReconciliationGate({ selectedCountry: "FR", chargedCurrency: "eur" }, enabled);
    expect(frConsistentNoBilling.shouldActivate).toBe(false); // review (pas d'activation auto sans billing)
    expect(frConsistentNoBilling.refundRequired).toBe(false); // mais pas un refund (devise cohérente)
    expect(evaluateCheckoutReconciliationGate({ companyCountry: "CH", chargedCurrency: "eur" }, enabled).shouldActivate).toBe(false);
  });
  it("les 4 chemins d'activation appliquent la réconciliation (preuve de câblage source)", () => {
    const rd = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
    const webhook = rd("src/app/api/webhooks/stripe/route.ts");
    const confirm = rd("src/app/api/checkout/confirm/route.ts");
    const checkout = rd("src/app/api/checkout/route.ts");
    // checkout.session.completed
    expect(webhook).toMatch(/evaluateCheckoutReconciliationGate/);
    // subscription.created + subscription.updated → reconcileSubscriptionStatus
    expect((webhook.match(/reconcileSubscriptionStatus\(/g) || []).length).toBeGreaterThanOrEqual(2);
    // /api/checkout/confirm
    expect(confirm).toMatch(/evaluateCheckoutReconciliationGate/);
    expect(confirm).toMatch(/review_required/);
    // checkout propage le pays résolu SERVEUR + la devise en metadata
    expect(checkout).toMatch(/metadata\.selected_country\s*=\s*resolvedCountry/);
    expect(checkout).toMatch(/metadata\.expected_currency/);
  });
});

describe("P15 C — Legal/tax artifact registry (no bare boolean)", () => {
  it("registre vide → tout manquant → not ready", () => {
    const r = evaluateLegalTaxArtifactRegistry([]);
    expect(r.legalTaxReady).toBe(false);
    expect(r.missing.length).toBe(ARTIFACT_DEFINITIONS.length);
  });
  it("brouillon interne seul → jamais ready", () => {
    const arts: LegalTaxArtifact[] = ARTIFACT_DEFINITIONS.map((d) => ({ artifact_id: d.artifact_id, source_type: "internal_draft", status: "draft", content_hash: "h" }));
    const r = evaluateLegalTaxArtifactRegistry(arts);
    expect(r.legalTaxReady).toBe(false);
    expect(r.draftOnly.length).toBeGreaterThan(0);
  });
  it("attestation owner = disclosed owner-attested, PAS preuve externe", () => {
    const arts: LegalTaxArtifact[] = ARTIFACT_DEFINITIONS.map((d) => ({ artifact_id: d.artifact_id, source_type: "owner_attestation", status: "approved", content_hash: "h" }));
    const r = evaluateLegalTaxArtifactRegistry(arts);
    expect(r.legalTaxReady).toBe(false);                 // externe non complet
    expect(r.ownerAttestedOnly.length).toBe(ARTIFACT_DEFINITIONS.length);
    // owner peut accepter le risque explicitement → lancement autorisé mais mode disclosed
    expect(legalTaxLaunchDecision(r, true).mode).toBe("owner_accepted_disclosed_risk");
    expect(legalTaxLaunchDecision(r, false).allowed).toBe(false);
  });
  it("artefact expiré → bloque", () => {
    const arts = fullExternalArtifacts().map((a) => ({ ...a, expires_at: "2020-01-01T00:00:00Z" }));
    const r = evaluateLegalTaxArtifactRegistry(arts, { nowMs: Date.parse("2026-07-09T00:00:00Z") });
    expect(r.legalTaxReady).toBe(false);
    expect(r.expired.length).toBeGreaterThan(0);
  });
  it("artefacts externes reviewed/approved + hash + non expirés → ready", () => {
    const r = evaluateLegalTaxArtifactRegistry(fullExternalArtifacts(), { nowMs: Date.parse("2026-07-09T00:00:00Z") });
    expect(r.legalTaxReady).toBe(true);
    expect(legalTaxLaunchDecision(r).mode).toBe("external_complete");
  });
});

describe("P15 D — Provider/Yousign closure", () => {
  it("sandbox → SANDBOX_ONLY, pas de claim live", () => {
    const r = evaluateProviderClosure({ CLONESTORE_SIGNATURE_API_URL: "https://sandbox.yousign.app" } as NodeJS.ProcessEnv);
    expect(r.status).toBe("SANDBOX_ONLY");
    expect(r.liveSignatureClaimAllowed).toBe(false);
    expect(r.publicPaidLaunchAllowed).toBe(false);
  });
  it("aucun provider → MISSING, pas de claim signature live", () => {
    const r = evaluateProviderClosure(EMPTY as NodeJS.ProcessEnv);
    expect(r.status).toBe("MISSING");
    expect(r.liveSignatureClaimAllowed).toBe(false);
  });
  it("fallback approuvé → lancement doc-préparé autorisé mais PAS de claim signature live", () => {
    const r = evaluateProviderClosure({ CLONESTORE_SIGNATURE_FALLBACK_APPROVED: "true" } as NodeJS.ProcessEnv);
    expect(r.status).toBe("FALLBACK_APPROVED");
    expect(r.publicPaidLaunchAllowed).toBe(true);
    expect(r.liveSignatureClaimAllowed).toBe(false);
    expect(r.copyRequirement).toMatch(/préparé/i);
  });
  it("live vérifié requiert l'attestation owner (jamais bool nu)", () => {
    // Sans attestation → jamais LIVE_VERIFIED
    expect(evaluateProviderClosure({ CLONESTORE_SIGNATURE_API_KEY: "key", CLONESTORE_SIGNATURE_API_URL: "https://api.yousign.com" } as NodeJS.ProcessEnv).status).not.toBe("LIVE_VERIFIED");
  });
});

describe("P15 E — Monitoring / rollback", () => {
  it("sans attestation → pas ready ; interrupteur & logging structurels présents", () => {
    const r = evaluateMonitoringRollback(EMPTY);
    expect(r.ready).toBe(false);
    expect(r.structuralAllPresent).toBe(true);
    expect(r.structuralChecks.some((c) => c.key === "emergency_disable_switch")).toBe(true);
    expect(r.structuralChecks.some((c) => c.key === "reconciliation_conflict_logging")).toBe(true);
    expect(r.blockers.length).toBeGreaterThan(0);
  });
  it("attestation owner → ready", () => {
    expect(evaluateMonitoringRollback({ CLONESTORE_MONITORING_ROLLBACK_VERIFIED: "true" }).ready).toBe(true);
  });
});

describe("P15 F — Owner approval + G command center", () => {
  it("aucun artefact owner → bloqué (production non autorisée)", () => {
    const r = evaluateP15ExternalGoLive({ env: EMPTY });
    expect(r.ownerApproved).toBe(false);
    expect(r.productionAuthorizationAllowed).toBe(false);
  });
  it("demo-only n'autorise pas le lancement payant ; private-pilot n'autorise pas le public", () => {
    const demo = evaluateP15ExternalGoLive({ env: { ...fullLiveEnv(), CLONESTORE_OWNER_GOLIVE_DECISION: "demo_only" }, legalArtifacts: fullExternalArtifacts(), nowMs: Date.parse("2026-07-09T00:00:00Z") });
    expect(demo.publicPaidLaunchAllowed).toBe(false);
    const pilot = evaluateP15ExternalGoLive({ env: { ...fullLiveEnv(), CLONESTORE_OWNER_GOLIVE_DECISION: "private_pilot_only" }, legalArtifacts: fullExternalArtifacts(), nowMs: Date.parse("2026-07-09T00:00:00Z") });
    expect(pilot.publicPaidLaunchAllowed).toBe(false);
  });
  it("approbation publique échoue quand même si Stripe/légal/provider/réconciliation manquent", () => {
    const r = evaluateP15ExternalGoLive({ env: { CLONESTORE_OWNER_GOLIVE_APPROVED: "true", CLONESTORE_OWNER_GOLIVE_APPROVED_BY: "Gael", CLONESTORE_OWNER_GOLIVE_DECISION: "approve_production" } });
    expect(r.ownerApproved).toBe(true);
    expect(r.allExternalGatesPass).toBe(false);
    expect(r.productionAuthorizationAllowed).toBe(false);
    expect(r.status).toBe("TECHNICAL_READY_EXTERNAL_BLOCKED");
  });
  it("full approval : toutes les portes + owner, MAIS le plancher dur P10 bloque l'autorisation", () => {
    const input = { env: fullLiveEnv(), legalArtifacts: fullExternalArtifacts(), nowMs: Date.parse("2026-07-09T00:00:00Z") };
    const r = evaluateP15ExternalGoLive(input);
    expect(r.allExternalGatesPass).toBe(true);
    expect(r.ownerApproved).toBe(true);
    expect(r.status).toBe("READY_FOR_PRODUCTION_AUTHORIZATION"); // pas PRODUCTION_AUTHORIZED
    expect(r.productionAuthorizationAllowed).toBe(false);        // plancher P10
    expect(canAuthorizeProduction(input)).toBe(false);
    expect(r.publicPaidLaunchAllowed).toBe(false);              // LAUNCHED impossible sans lever P10 + deploy
  });
  it("env local par défaut → jamais READY ; command center fail-closed", () => {
    const cc = evaluateP15FinalCommandCenter({ env: EMPTY });
    expect(["NOT_READY", "TECHNICAL_READY_EXTERNAL_BLOCKED"]).toContain(cc.globalStatus);
    expect(cc.publicPaidLaunchAllowed).toBe(false);
    expect(cc.productionAuthorizationAllowed).toBe(false);
    expect(cc.demoOnlyAllowed).toBe(true);
    expect(cc.p10HardFloorRespected).toBe(true);
    expect(cc.requiredOwnerActions.length).toBeGreaterThan(0);
  });
  it("la production ne peut PAS être autorisée par des flags env seuls (plancher P10)", () => {
    // Même avec TOUS les flags env owner-attestés, productionAuthorizationAllowed reste false.
    expect(canAuthorizeProduction({ env: fullLiveEnv(), legalArtifacts: fullExternalArtifacts(), nowMs: Date.parse("2026-07-09T00:00:00Z") })).toBe(false);
    expect(PRODUCTION_AUTHORIZED).toBe(false);
    // computeP15LaunchStatus jamais LAUNCHED localement
    expect(computeP15LaunchStatus({ env: EMPTY })).not.toBe("LAUNCHED");
  });
});
