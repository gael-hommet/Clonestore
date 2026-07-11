// src/lib/clonestore/pricing/public-pricing-resolver.ts
// P10 §4 — Résolution SERVEUR de la tarification publique. PURE (prend des signaux en entrée ;
// un wrapper de route extrait les signaux de la requête). Ordre de FORCE des signaux :
//   1. entreprise VÉRIFIÉE (registration_country, utilisateur authentifié)  → "verified"
//   2. sélection EXPLICITE de l'utilisateur                                  → "selected"
//   3. header géo (x-vercel-ip-country)                                      → "geo"
//   4. Accept-Language (indice FAIBLE)                                        → "weak"
//   5. inconnu                                                                → "unknown"
// RÈGLE : un pays inconnu n'obtient JAMAIS un prix « par défaut » (surtout pas le moins cher) →
// il DEMANDE une sélection. Le checkout reste TOUJOURS l'autorité finale (requiresCheckoutRevalidation).

import {
  normalizeCountry, isSupportedLaunchCountry, pricingForCountry,
  type Currency, type StripePriceKey,
} from "./country-pricing";

export type PricingConfidence = "verified" | "selected" | "geo" | "weak" | "unknown";

export interface PricingSignals {
  /** Sélection explicite de l'utilisateur (intention forte ; revalidée au checkout). */
  readonly selectedCountry?: string | null;
  /** Pays d'immatriculation de l'entreprise vérifiée (authentifié). Autorité la plus forte. */
  readonly companyCountry?: string | null;
  /** Pays de facturation connu (si distinct de l'entreprise). */
  readonly billingCountry?: string | null;
  /** Header géo (x-vercel-ip-country) — jamais une preuve de paiement, indice moyen. */
  readonly geoCountry?: string | null;
  /** Header Accept-Language — indice le plus faible. */
  readonly acceptLanguage?: string | null;
}

export interface PublicPricingResolution {
  readonly resolvedCountry: string | null;      // ISO-2 normalisé, ou null
  readonly confidence: PricingConfidence;
  readonly supported: boolean;                  // resolvedCountry ∈ pays de lancement
  readonly price: { readonly amount: number; readonly currency: Currency; readonly display: string; readonly stripePriceKey: StripePriceKey } | null;
  readonly requiresCountrySelection: boolean;   // true tant qu'on n'est pas assez sûr pour checkout
  readonly requiresCheckoutRevalidation: boolean; // TOUJOURS true : le checkout est autoritatif
  readonly auditReason: string;                 // code stable pour l'audit/UX
}

/** Extrait le premier sous-tag de RÉGION d'un header Accept-Language (ex. "fr-CH,fr;q=0.9" → "CH"). */
export function parseAcceptLanguageCountry(header: string | null | undefined): string | null {
  if (!header || typeof header !== "string") return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim();          // ex. "fr-CH"
    const m = tag.match(/^[a-zA-Z]{2,3}-([A-Za-z]{2})$/);
    if (m) {
      const c = normalizeCountry(m[1]);
      if (c) return c;
    }
  }
  return null;
}

function priceOf(country: string): PublicPricingResolution["price"] {
  const r = pricingForCountry(country);
  if (r.status !== "ok") return null;
  return { amount: r.pricing.amount, currency: r.pricing.currency, display: r.pricing.display, stripePriceKey: r.pricing.stripePriceKey };
}

/**
 * Résout la tarification publique à partir des signaux. Pur, déterministe, sans I/O.
 * - entreprise vérifiée supportée → prix affiché, sélection non requise (autorité).
 * - sélection explicite supportée → prix affiché, sélection non requise.
 * - géo supporté → prix SUGGÉRÉ affiché, revalidation checkout (géo ≠ preuve).
 * - accept-language supporté → pays SUGGÉRÉ, mais sélection explicite REQUISE avant checkout.
 * - pays résolu NON supporté → pas de prix, sélection requise (état waitlist/contact).
 * - inconnu → pas de prix, sélection requise.
 */
export function resolvePublicPricing(signals: PricingSignals): PublicPricingResolution {
  const REVALIDATE = true; // le checkout est toujours l'autorité finale

  const company = normalizeCountry(signals.companyCountry);
  const billing = normalizeCountry(signals.billingCountry);
  const selected = normalizeCountry(signals.selectedCountry);
  const geo = normalizeCountry(signals.geoCountry);
  const lang = parseAcceptLanguageCountry(signals.acceptLanguage);

  // Aide : construit une résolution pour un pays + niveau de confiance donnés.
  const build = (country: string, confidence: PricingConfidence, requiresSelection: boolean, reason: string): PublicPricingResolution => {
    if (!isSupportedLaunchCountry(country)) {
      return { resolvedCountry: country, confidence, supported: false, price: null, requiresCountrySelection: true, requiresCheckoutRevalidation: REVALIDATE, auditReason: "COUNTRY_NOT_SUPPORTED" };
    }
    return { resolvedCountry: country, confidence, supported: true, price: priceOf(country), requiresCountrySelection: requiresSelection, requiresCheckoutRevalidation: REVALIDATE, auditReason: reason };
  };

  // 1. Entreprise vérifiée (authentifié) — autorité la plus forte, y compris si non supportée.
  if (company) return build(company, "verified", false, "VERIFIED_COMPANY_COUNTRY");
  // 2. Pays de facturation vérifié.
  if (billing) return build(billing, "verified", false, "VERIFIED_BILLING_COUNTRY");
  // 3. Sélection explicite.
  if (selected) return build(selected, "selected", false, "EXPLICIT_SELECTION");
  // 4. Géo (Vercel) — prix suggéré, mais checkout revalide (IP ≠ preuve).
  if (geo) {
    if (!isSupportedLaunchCountry(geo)) return build(geo, "geo", true, "GEO_UNSUPPORTED");
    return { resolvedCountry: geo, confidence: "geo", supported: true, price: priceOf(geo), requiresCountrySelection: false, requiresCheckoutRevalidation: REVALIDATE, auditReason: "GEO_SUGGESTION" };
  }
  // 5. Accept-Language — indice FAIBLE : suggestion, sélection explicite REQUISE avant checkout.
  if (lang && isSupportedLaunchCountry(lang)) {
    return { resolvedCountry: lang, confidence: "weak", supported: true, price: priceOf(lang), requiresCountrySelection: true, requiresCheckoutRevalidation: REVALIDATE, auditReason: "WEAK_LOCALE_HINT" };
  }
  // 6. Inconnu — AUCUN prix par défaut ; sélection requise (anti-abus).
  return { resolvedCountry: null, confidence: "unknown", supported: false, price: null, requiresCountrySelection: true, requiresCheckoutRevalidation: REVALIDATE, auditReason: "COUNTRY_REQUIRED" };
}
