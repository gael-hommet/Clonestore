// src/lib/clonestore/production/p11-stripe-country-reconciliation.ts
// P11 §4 — Réconciliation du PAYS de facturation au paiement (couche TECHNIQUE, pas juridique).
// P10 empêche la manipulation du prix par le client. P11 ferme le contrôle au moment du paiement :
// quand Stripe renvoie le pays de facturation / TVA / du moyen de paiement (webhook ou confirm),
// on le confronte au pays attendu. Conflit fort → revue/blocage ; suisse payant en EUR → remboursement
// requis (anti-abus revenu) ; pays manquant → revue ; IP faible seul → simple avertissement (pas une preuve).
// PUR et testable. Ne prétend RIEN de définitif juridiquement.

import { normalizeCountry, isSupportedLaunchCountry, currencyForCountry, type Currency } from "@/lib/clonestore/pricing/country-pricing";

export type ReconciliationResult = "allowed" | "blocked" | "review_required" | "refund_required" | "manual_review";

export type ReconciliationReasonCode =
  | "STRIPE_BILLING_COUNTRY_MATCH"
  | "STRIPE_BILLING_COUNTRY_MISSING"
  | "STRIPE_BILLING_COUNTRY_CONFLICT"
  | "STRIPE_TAX_COUNTRY_CONFLICT"
  | "PAYMENT_METHOD_COUNTRY_CONFLICT"
  | "COMPANY_COUNTRY_CONFLICT"
  | "MANUAL_REVIEW_REQUIRED";

export interface ReconciliationInput {
  /** Pays attendu (celui sous lequel la mission/l'offre a été vendue = pays résolu par le guard P10). */
  readonly expectedCountry?: string | null;
  readonly selectedCountry?: string | null;
  readonly companyCountry?: string | null;         // registration_country vérifié (fort)
  readonly stripeBillingCountry?: string | null;   // customer_details.address.country
  readonly stripeTaxCountry?: string | null;       // tax country si dispo
  readonly paymentMethodCountry?: string | null;   // pays de la carte si dispo
  readonly geoCountry?: string | null;             // IP — indice FAIBLE, jamais une preuve
  readonly chargedCurrency?: string | null;        // devise réellement facturée (eur/chf)
}

export interface ReconciliationDecision {
  readonly result: ReconciliationResult;
  readonly code: ReconciliationReasonCode;
  readonly expectedCountry: string | null;
  readonly currency: Currency | null;
  readonly warnings: string[];
  readonly message: string;   // humain (jamais un conseil juridique/fiscal)
}

const n = (v: unknown): string | null => normalizeCountry(v);

/**
 * Réconcilie le pays au paiement. Priorité :
 *  1. pays attendu = companyCountry vérifié ?? expectedCountry ?? selectedCountry.
 *  2. si Stripe billing country manquant → review_required (STRIPE_BILLING_COUNTRY_MISSING).
 *  3. billing ≠ attendu :
 *     - suisse (billing CH) alors qu'on a facturé/attendu de l'EUR moins cher → REFUND_REQUIRED (abus revenu).
 *     - sinon → blocked / review (STRIPE_BILLING_COUNTRY_CONFLICT / COMPANY_COUNTRY_CONFLICT).
 *  4. tax/payment-method country divergents → warning + manual_review si non résolu.
 *  5. tout concorde → allowed. IP (geo) divergente seule → warning only (jamais une preuve).
 */
export function reconcileStripeCountry(input: ReconciliationInput): ReconciliationDecision {
  const warnings: string[] = [];
  const company = n(input.companyCountry);
  const expected = company ?? n(input.expectedCountry) ?? n(input.selectedCountry);
  const billing = n(input.stripeBillingCountry);
  const tax = n(input.stripeTaxCountry);
  const pm = n(input.paymentMethodCountry);
  const geo = n(input.geoCountry);
  const currency = expected && isSupportedLaunchCountry(expected) ? (currencyForCountry(expected) as Currency) : null;

  // IP divergente seule → avertissement (jamais une preuve de paiement).
  if (geo && expected && isSupportedLaunchCountry(geo) && geo !== expected) {
    warnings.push(`GEO_WEAK_CONFLICT: IP=${geo} ≠ attendu=${expected} (avertissement ; jamais une preuve).`);
  }

  if (!expected) {
    return { result: "manual_review", code: "MANUAL_REVIEW_REQUIRED", expectedCountry: null, currency: null, warnings, message: "Pays attendu indéterminé — revue manuelle." };
  }

  // Pays de facturation Stripe manquant → on ne peut pas confirmer → revue.
  if (!billing) {
    return { result: "review_required", code: "STRIPE_BILLING_COUNTRY_MISSING", expectedCountry: expected, currency, warnings, message: "Pays de facturation Stripe absent — confirmation requise avant d'honorer." };
  }

  // Conflit pays de facturation.
  if (billing !== expected) {
    // Cas revenu : le client est en réalité suisse (billing CH) mais on a facturé/attendu de l'EUR (offre moins chère).
    const billedEur = (input.chargedCurrency ?? "").toLowerCase() === "eur" || currency === "EUR";
    if (billing === "CH" && billedEur) {
      return { result: "refund_required", code: "STRIPE_BILLING_COUNTRY_CONFLICT", expectedCountry: expected, currency, warnings, message: "Facturation suisse détectée sur une offre EUR — remboursement / re-facturation CHF requis." };
    }
    // Conflit fort avec une entreprise vérifiée → blocage.
    if (company && billing !== company) {
      return { result: "blocked", code: "COMPANY_COUNTRY_CONFLICT", expectedCountry: expected, currency, warnings, message: "Pays de facturation ≠ pays d'immatriculation vérifié — blocage, revue requise." };
    }
    // Autre conflit → revue.
    return { result: "review_required", code: "STRIPE_BILLING_COUNTRY_CONFLICT", expectedCountry: expected, currency, warnings, message: `Pays de facturation (${billing}) ≠ pays attendu (${expected}) — revue requise.` };
  }

  // Billing concorde le PAYS — mais la DEVISE facturée doit AUSSI correspondre (contrôle
  // INCONDITIONNEL : c'est le rôle d'une couche de réconciliation de re-vérifier au paiement).
  // Ex. billing=CH + chargée en EUR → remboursement/re-facturation CHF requis.
  if (currency && input.chargedCurrency && input.chargedCurrency.toLowerCase() !== currency.toLowerCase()) {
    return { result: "refund_required", code: "STRIPE_BILLING_COUNTRY_CONFLICT", expectedCountry: expected, currency, warnings, message: `Devise facturée (${input.chargedCurrency.toLowerCase()}) ≠ devise du pays ${expected} (${currency}) — remboursement / re-facturation requis.` };
  }

  // Vérifs secondaires : tax / payment-method.
  if (tax && tax !== expected && isSupportedLaunchCountry(tax)) {
    return { result: "review_required", code: "STRIPE_TAX_COUNTRY_CONFLICT", expectedCountry: expected, currency, warnings, message: `Pays fiscal (${tax}) ≠ pays attendu (${expected}) — revue TVA requise.` };
  }
  if (pm && pm !== expected && isSupportedLaunchCountry(pm)) {
    warnings.push(`PAYMENT_METHOD_COUNTRY_CONFLICT: carte ${pm} ≠ attendu ${expected}.`);
    return { result: "review_required", code: "PAYMENT_METHOD_COUNTRY_CONFLICT", expectedCountry: expected, currency, warnings, message: `Pays du moyen de paiement (${pm}) ≠ pays attendu (${expected}) — revue requise.` };
  }

  return { result: "allowed", code: "STRIPE_BILLING_COUNTRY_MATCH", expectedCountry: expected, currency, warnings, message: `Pays de facturation confirmé (${expected}).` };
}

/** Réponses aux questions de conception (§4) — documentation technique embarquée (pas un conseil juridique). */
export const STRIPE_COUNTRY_RECONCILIATION_PLAN = {
  canCollectBillingAddress: "OUI — Stripe Checkout: billing_address_collection:'required'.",
  canRestrictBillingCountry: "PARTIEL — Checkout ne whitelig pas les pays de facturation ; on collecte puis on réconcilie (webhook/confirm) via customer_details.address.country.",
  taxHandling: "Stripe Tax (automatic_tax) OU gestion manuelle par pays ; à décider avec l'avocat/comptable (external_pending).",
  webhookInspectsBillingCountry: "OUI — le webhook peut lire session.customer_details.address.country + subscription currency (fetchSubscriptionProof capture déjà la devise).",
  paymentMethodCountry: "Disponible via PaymentMethod.card.country (best-effort, post-paiement).",
  scenarios: {
    selectedFR_billingCH: "review/refund (CH billing sur offre EUR → refund_required).",
    selectedCH_billingFR: "review (billing FR ≠ CH attendu).",
    geoCH_billingFR: "billing (fort) gagne → allowed ; geo seul = warning.",
    companyCH_billingFR: "blocked (COMPANY_COUNTRY_CONFLICT).",
    stripeNoBillingCountry: "review_required (STRIPE_BILLING_COUNTRY_MISSING).",
  },
  disclaimer: "Couche TECHNIQUE de réconciliation. N'établit PAS la conformité juridique/fiscale finale — validation externe requise.",
} as const;
