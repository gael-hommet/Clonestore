// src/lib/clonestore/founder-acceptance/launch-country-fit.ts
// P13 §4 — MATRICE DE FIT PAYS pour le lancement FR / BE / LU / CH. Répond honnêtement à :
// « Pierre est-il crédible par pays SANS prétendre que la validation légale est terminée ? »
//
// Ce module NE réinvente RIEN : il DÉRIVE des modules VÉRIFIÉS existants —
//   • Tarification/devise  ← P10  src/lib/clonestore/pricing/country-pricing.ts
//   • Légal/fiscal ready   ← P11  p11-legal-tax-readiness.ts        (false sans preuve externe)
//   • Provider (Yousign)   ← P11  p11-provider-readiness.ts         (false : signature non live)
//   • Go-live autorisé     ← P11  p11-final-golive-readiness.ts     (productionAuthorized = false, plancher P10)
// Aucune I/O réseau, aucune activation. Ne formule AUCUN conseil juridique/fiscal final.

import {
  SUPPORTED_LAUNCH_COUNTRIES, pricingForCountry, currencyForCountry, normalizeCountry,
  type LaunchCountry, type Currency,
} from "@/lib/clonestore/pricing/country-pricing";
import { evaluateLegalTaxReadiness } from "@/lib/clonestore/production/p11-legal-tax-readiness";
import { evaluateProviderReadiness } from "@/lib/clonestore/production/p11-provider-readiness";
import { evaluateP11FinalGoLiveReadiness } from "@/lib/clonestore/production/p11-final-golive-readiness";

export const LAUNCH_COUNTRIES: readonly LaunchCountry[] = [...SUPPORTED_LAUNCH_COUNTRIES] as LaunchCountry[];

const COUNTRY_LABEL: Record<LaunchCountry, string> = { FR: "France", BE: "Belgique", LU: "Luxembourg", CH: "Suisse" };

/** Tarif attendu par pays (dérivé de P10 — source de vérité unique). FR/BE/LU 449 EUR, CH 499 CHF. */
export const COUNTRY_EXPECTED_PRICING: Readonly<Record<LaunchCountry, { amount: number; currency: Currency; display: string }>> = {
  FR: { amount: 449, currency: "EUR", display: "449 € / mois" },
  BE: { amount: 449, currency: "EUR", display: "449 € / mois" },
  LU: { amount: 449, currency: "EUR", display: "449 € / mois" },
  CH: { amount: 499, currency: "CHF", display: "499 CHF / mois" },
};

/** Exigences de fit pays (dimensions évaluées). */
export const COUNTRY_FIT_REQUIREMENTS: readonly string[] = [
  "product_ready", "pricing_ready", "currency_correct", "legal_ready", "tax_ready",
  "provider_ready", "document_ready", "launch_allowed", "safe_copy", "disclaimers_present",
];

// ── Copie légale/pays INTERDITE (surpromesse) vs SÛRE (préparation, à valider) ──────
export const COUNTRY_LEGAL_COPY_FORBIDDEN: readonly string[] = [
  "conforme au droit suisse", "conforme au droit belge", "conforme au droit luxembourgeois",
  "conforme au droit français", "juridiquement garanti", "validé par un avocat", "validé avocat",
  "applicable sans vérification", "100% conforme", "100 % conforme", "aucun risque légal",
  "sans risque légal", "conformité garantie", "contrat conforme", "signature légale garantie",
  "yousign live", "stripe live", "tva validée", "tax validated", "production authorized",
];

export const COUNTRY_SAFE_COPY: readonly string[] = [
  "Je prépare", "Je propose", "Je structure",
  "À valider selon vos règles et votre conseil", "Validation humaine requise",
  "Contrôle légal externe recommandé", "Revue juridique externe requise",
  "Document préparé — à faire valider",
];

// ── Évaluation par pays ─────────────────────────────────────────────────────────────
export type CountryFitVerdict = "COUNTRY_FIT_OK" | "COUNTRY_FIT_PENDING_EXTERNAL" | "COUNTRY_FIT_BLOCKED";

/** Preuves observées par P13 (produit + copie), + env pour les évaluateurs P11 (défaut process.env). */
export interface CountryFitEvidence {
  /** Les parcours produit P12/Pierre fonctionnent pour ce pays (preuve navigateur). Défaut: true. */
  readonly productReady?: boolean;
  /** Une surpromesse légale/pays a été détectée dans la copie (scan) → bloquant. Défaut: false. */
  readonly unsafeCopyDetected?: boolean;
  /** Les documents légaux sont affichés comme « à faire valider » (non FR-only silencieux). Défaut: true. */
  readonly documentsFlaggedForReview?: boolean;
  /** Env pour les évaluateurs P11 (légal/fiscal/provider/go-live). Défaut: process.env (tout pending). */
  readonly env?: NodeJS.ProcessEnv;
}

export interface CountryFitResult {
  readonly country: LaunchCountry;
  readonly label: string;
  readonly currency: Currency;
  readonly expectedDisplay: string;
  // A. produit / tarification
  readonly product_ready: boolean;
  readonly pricing_ready: boolean;
  readonly currency_correct: boolean;
  // C/D. légal / fiscal / provider / documents (DÉRIVÉS de P11 — false sans preuve externe)
  readonly legal_ready: boolean;
  readonly tax_ready: boolean;
  readonly provider_ready: boolean;
  readonly document_ready: boolean;
  // B. copie
  readonly safe_copy: boolean;
  readonly disclaimers_present: boolean;
  // E. lancement
  readonly launch_allowed: boolean;
  readonly launch_blockers: string[];
  readonly disclaimers_required: string[];
  readonly verdict: CountryFitVerdict;
  readonly note: string;
}

/**
 * Évalue le fit d'UN pays de lancement. Tarification/devise viennent de P10 ; legal/tax/provider/
 * launch viennent des évaluateurs P11 réels (donc false par défaut, honnêtement pending).
 * Verdict :
 *   BLOCKED  → prix/devise faux OU surpromesse de copie détectée.
 *   PENDING_EXTERNAL → produit + prix corrects + copie sûre, mais items externes (légal/provider/go-live) pending.
 *   OK       → tout vert, y compris externe (n'arrive pas tant que P11 externe n'est pas levé).
 */
export function evaluateCountryFit(country: unknown, evidence: CountryFitEvidence = {}): CountryFitResult {
  const norm = normalizeCountry(country);
  const c = (norm && (SUPPORTED_LAUNCH_COUNTRIES as readonly string[]).includes(norm) ? norm : null) as LaunchCountry | null;
  const env = evidence.env ?? process.env;

  // Pays non supporté → bloqué (jamais présenté comme prêt).
  if (!c) {
    return {
      country: (norm ?? "??") as LaunchCountry, label: String(country),
      currency: "EUR", expectedDisplay: "—",
      product_ready: false, pricing_ready: false, currency_correct: false,
      legal_ready: false, tax_ready: false, provider_ready: false, document_ready: false,
      safe_copy: true, disclaimers_present: false,
      launch_allowed: false,
      launch_blockers: ["Pays hors périmètre de lancement (FR/BE/LU/CH uniquement)."],
      disclaimers_required: [], verdict: "COUNTRY_FIT_BLOCKED",
      note: "Pays non supporté au lancement.",
    };
  }

  const expected = COUNTRY_EXPECTED_PRICING[c];
  const resolution = pricingForCountry(c);
  const pricing_ready = resolution.status === "ok" && resolution.pricing.amount === expected.amount;
  const currency_correct = currencyForCountry(c) === expected.currency;

  const productReady = evidence.productReady !== false;              // défaut: true (P12 flows OK)
  const unsafeCopy = evidence.unsafeCopyDetected === true;           // défaut: false
  const documentsFlagged = evidence.documentsFlaggedForReview !== false; // défaut: true

  // DÉRIVÉ des évaluateurs P11 (source de vérité, false sans preuve externe).
  const legalTax = evaluateLegalTaxReadiness(env);
  const provider = evaluateProviderReadiness(env);
  const golive = evaluateP11FinalGoLiveReadiness(env);
  const countryLegal = legalTax.countryChecklist.find((x) => x.country === c) ?? null;

  const legal_ready = !!countryLegal && countryLegal.status === "verified";
  const tax_ready = legalTax.legalTaxReady; // = false sans preuve fiscale externe
  const provider_ready = provider.ready;    // = false : signature non live (Yousign P8.7.4)
  // document_ready : les documents légaux doivent être validés (legal_ready) ET affichés comme
  // « à faire valider » tant que non validés. Sans preuve légale → non prêt (mais divulgué).
  const document_ready = legal_ready && documentsFlagged;
  const launch_allowed = golive.productionAuthorized; // = false (plancher dur P10)

  const launch_blockers: string[] = [];
  if (!legal_ready) launch_blockers.push("Revue juridique externe non finalisée (FR/BE/LU/CH).");
  if (!tax_ready) launch_blockers.push("Revue fiscale/TVA externe non finalisée (EUR/CHF, TVA CH vs UE).");
  if (!provider_ready) launch_blockers.push("Signature/provider (Yousign) non live (P8.7.4).");
  if (!launch_allowed) launch_blockers.push("Go-live non autorisé (PRODUCTION_AUTHORIZED=false — plancher P10).");

  const disclaimers_required: string[] = [];
  if (!legal_ready) disclaimers_required.push("Afficher : « Documents légaux à faire valider par votre conseil ». ");
  if (!tax_ready) disclaimers_required.push("Afficher : « Traitement TVA/fiscal à confirmer selon votre situation ». ");
  if (!provider_ready) disclaimers_required.push("Afficher : « Signature électronique non encore activée en production ». ");
  disclaimers_required.push("Pierre parle en « prépare/propose/à valider » ; jamais « conforme au droit " + COUNTRY_LABEL[c].toLowerCase() + " ».");

  // Verdict.
  let verdict: CountryFitVerdict;
  let note: string;
  if (!pricing_ready || !currency_correct || unsafeCopy) {
    verdict = "COUNTRY_FIT_BLOCKED";
    note = unsafeCopy
      ? `${COUNTRY_LABEL[c]} : surpromesse légale/pays détectée dans la copie — interdit.`
      : `${COUNTRY_LABEL[c]} : tarification/devise incorrecte.`;
  } else if (!launch_allowed || !legal_ready || !tax_ready || !provider_ready) {
    verdict = "COUNTRY_FIT_PENDING_EXTERNAL";
    note = `${COUNTRY_LABEL[c]} : produit + tarification crédibles ; items externes (légal/fiscal/provider/go-live) PENDING et divulgués — pas présentés comme finaux.`;
  } else {
    verdict = "COUNTRY_FIT_OK";
    note = `${COUNTRY_LABEL[c]} : fit complet (produit + tarification + externe validé).`;
  }

  return {
    country: c, label: COUNTRY_LABEL[c], currency: expected.currency, expectedDisplay: expected.display,
    product_ready: productReady, pricing_ready, currency_correct,
    legal_ready, tax_ready, provider_ready, document_ready,
    safe_copy: !unsafeCopy, disclaimers_present: documentsFlagged,
    launch_allowed, launch_blockers, disclaimers_required, verdict, note,
  };
}

export interface AllLaunchCountriesResult {
  readonly countries: CountryFitResult[];
  readonly anyBlocked: boolean;
  readonly allPricingReady: boolean;
  readonly allProductReady: boolean;
  readonly anyLaunchAllowed: boolean;      // attendu false tant que P11 externe non levé
  readonly countryFitCredible: boolean;    // aucun bloqué (OK ou PENDING_EXTERNAL) → crédible sans prétendre au légal
  readonly note: string;
}

/** Évalue les 4 pays de lancement. Pur (sauf lecture env par les évaluateurs P11). */
export function evaluateAllLaunchCountries(evidence: CountryFitEvidence = {}): AllLaunchCountriesResult {
  const countries = LAUNCH_COUNTRIES.map((c) => evaluateCountryFit(c, evidence));
  const anyBlocked = countries.some((c) => c.verdict === "COUNTRY_FIT_BLOCKED");
  const allPricingReady = countries.every((c) => c.pricing_ready && c.currency_correct);
  const allProductReady = countries.every((c) => c.product_ready);
  const anyLaunchAllowed = countries.some((c) => c.launch_allowed);
  return {
    countries, anyBlocked, allPricingReady, allProductReady, anyLaunchAllowed,
    countryFitCredible: !anyBlocked && allPricingReady,
    note: anyBlocked
      ? "FIT PAYS BLOQUÉ : au moins un pays a une tarification/devise erronée ou une surpromesse."
      : "FIT PAYS CRÉDIBLE pour FR/BE/LU/CH — produit + tarification prêts ; légal/fiscal/provider/go-live restent PENDING (externes) et sont divulgués, jamais présentés comme finaux.",
  };
}
