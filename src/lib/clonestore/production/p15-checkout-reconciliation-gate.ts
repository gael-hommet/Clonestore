// src/lib/clonestore/production/p15-checkout-reconciliation-gate.ts
// P15 §4 — GATE de réconciliation pays au checkout. Enveloppe reconcileStripeCountry (P11) et décide
// si l'ACTIVATION payante peut procéder. PUR + testable. Câblé dans le webhook Stripe de façon ADDITIVE
// et FLAG-GATED (STRIPE_COUNTRY_RECONCILIATION_ENABLED) : flag OFF → comportement existant préservé ;
// flag ON → un conflit fort n'active PAS l'accès payant (statut de revue) + audit.
//
// Sécurité : le pays ATTENDU vient d'abord de l'entreprise vérifiée (fort), puis expected, puis selected
// (client, FAIBLE). Le pays de FACTURATION vient de Stripe (vérité serveur). Un selectedCountry FORGÉ ne
// peut donc jamais forcer l'activation : le billing Stripe doit concorder.

import { reconcileStripeCountry, type ReconciliationDecision, type ReconciliationInput } from "./p11-stripe-country-reconciliation";
import { normalizeCountry, isSupportedLaunchCountry, currencyForCountry } from "@/lib/clonestore/pricing/country-pricing";

const flagOn = (v: string | undefined): boolean => { const s = (v ?? "").trim().toLowerCase(); return s === "true" || s === "1" || s === "on" || s === "enabled"; };

/** Extrait les signaux pays d'un objet checkout.session.completed (best-effort, sans throw). */
export function extractCountrySignalsFromSession(session: Record<string, unknown>): {
  stripeBillingCountry: string | null;
  stripeTaxCountry: string | null;
  chargedCurrency: string | null;
  selectedCountry: string | null;
  companyCountry: string | null;
} {
  const rec = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null);
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  const customerDetails = rec(session["customer_details"]);
  const address = customerDetails ? rec(customerDetails["address"]) : null;
  const billing = address ? str(address["country"]) : null;

  // Tax : customer_details.tax_ids[0].country OU tax country si dispo.
  let taxCountry: string | null = null;
  const taxIds = customerDetails ? customerDetails["tax_ids"] : null;
  if (Array.isArray(taxIds) && taxIds.length > 0) { const t0 = rec(taxIds[0]); taxCountry = t0 ? str(t0["country"]) : null; }

  const currency = str(session["currency"]);
  const meta = rec(session["metadata"]);
  const selectedCountry = meta ? str(meta["selected_country"]) : null;   // client — FAIBLE
  const companyCountry = meta ? str(meta["company_country"]) : null;      // vérifié en amont — fort si présent

  return { stripeBillingCountry: billing, stripeTaxCountry: taxCountry, chargedCurrency: currency, selectedCountry, companyCountry };
}

export type ReconciliationActivationStatus = "active" | "review_required" | "payment_country_conflict";

export interface ReconciliationGateResult {
  readonly enabled: boolean;
  readonly decision: ReconciliationDecision;
  readonly currencyMismatch: boolean;             // devise facturée ≠ devise du pays (indépendant du billing)
  readonly shouldActivate: boolean;               // flag OFF → true (préserve) ; flag ON → allowed
  readonly activationStatus: ReconciliationActivationStatus; // statut d'ordre à écrire
  readonly refundRequired: boolean;
  readonly audit: {
    readonly result: ReconciliationDecision["result"];
    readonly code: ReconciliationDecision["code"];
    readonly expectedCountry: string | null;
    readonly billingCountry: string | null;
    readonly chargedCurrency: string | null;
    readonly enabled: boolean;
    readonly activationStatus: ReconciliationActivationStatus;
    readonly message: string;
    readonly warnings: string[];
  };
}

/**
 * Décide l'activation à partir des signaux pays. `enabled` (STRIPE_COUNTRY_RECONCILIATION_ENABLED) :
 * OFF → shouldActivate=true (comportement existant préservé, mais on AUDIT quand même) ;
 * ON → shouldActivate = (result === "allowed"). Un conflit fort (blocked/refund_required/conflict) →
 * pas d'activation payante ; statut de revue + refundRequired. Pur.
 */
export function evaluateCheckoutReconciliationGate(input: ReconciliationInput, opts: { enabled?: boolean; env?: Record<string, string | undefined> } = {}): ReconciliationGateResult {
  const enabled = opts.enabled ?? flagOn((opts.env ?? process.env).STRIPE_COUNTRY_RECONCILIATION_ENABLED);

  // Pays ATTENDU : entreprise (fort) > expected > pays de FACTURATION Stripe (vérité serveur) > selected (client, faible).
  // On passe le billing comme repli `expectedCountry` pour que reconcileStripeCountry ait toujours un pays de
  // référence quand company/selected sont absents (metadata) — sinon la réconciliation renverrait manual_review
  // pour TOUT paiement réel et sur-bloquerait (bug corrigé après review adversariale P15).
  const decision = reconcileStripeCountry({ ...input, expectedCountry: input.expectedCountry ?? input.stripeBillingCountry ?? null });

  // Contrôle de COHÉRENCE DEVISE indépendant : la devise facturée DOIT correspondre à la devise canonique
  // du meilleur signal pays disponible (facturation > entreprise > sélection). Fonctionne MÊME sans adresse
  // de facturation (ex. events subscription.* qui ne portent que la devise + metadata pays). Attrape CH+EUR /
  // FR-BE-LU+CHF quel que soit le chemin d'activation ; n'over-bloque PAS un client légitime (FR+EUR concorde).
  const countrySignal = normalizeCountry(input.stripeBillingCountry) ?? normalizeCountry(input.companyCountry) ?? normalizeCountry(input.selectedCountry);
  const expectedCurrency = countrySignal && isSupportedLaunchCountry(countrySignal) ? currencyForCountry(countrySignal) : null;
  const chargedCur = (input.chargedCurrency ?? "").toLowerCase();
  const currencyMismatch = !!(expectedCurrency && chargedCur && chargedCur !== expectedCurrency.toLowerCase());

  // ACTIVATION exige : un pays de FACTURATION présent (vérité serveur) + réconciliation allowed + devise
  // cohérente. Sans adresse de facturation → jamais d'activation auto (review au mieux, block si devise
  // incohérente) — même stance de sécurité que « pays de facturation manquant → revue ». Le contrôle de
  // devise reste actif pour classer un mismatch en refund même sans billing (chemin subscription.*).
  const billingPresent = !!normalizeCountry(input.stripeBillingCountry);
  const allowed = billingPresent && decision.result === "allowed" && !currencyMismatch;
  const refundRequired = decision.result === "refund_required" || currencyMismatch;

  // Statut d'activation à écrire quand le gate est actif.
  let activationStatus: ReconciliationActivationStatus;
  if (allowed) activationStatus = "active";
  else if (decision.result === "blocked" || decision.code === "COMPANY_COUNTRY_CONFLICT") activationStatus = "payment_country_conflict";
  else activationStatus = "review_required"; // review_required / refund_required / manual_review

  // Flag OFF → on préserve l'activation (shouldActivate=true) mais on garde l'audit ; flag ON → gate réel.
  const shouldActivate = enabled ? allowed : true;

  return {
    enabled, decision, currencyMismatch, shouldActivate,
    activationStatus: shouldActivate ? "active" : activationStatus,
    refundRequired,
    audit: {
      result: currencyMismatch && decision.result === "allowed" ? "refund_required" : decision.result,
      code: decision.code, expectedCountry: decision.expectedCountry,
      billingCountry: input.stripeBillingCountry ?? null, chargedCurrency: input.chargedCurrency ?? null,
      enabled, activationStatus: shouldActivate ? "active" : activationStatus,
      message: currencyMismatch ? `${decision.message} | Devise facturée (${chargedCur}) ≠ devise du pays (${expectedCurrency}) — remboursement/re-facturation requis.` : decision.message,
      warnings: decision.warnings,
    },
  };
}
