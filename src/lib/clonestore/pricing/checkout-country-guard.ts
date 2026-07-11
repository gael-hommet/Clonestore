// src/lib/clonestore/pricing/checkout-country-guard.ts
// P10 §5 — GUARD de checkout SERVEUR-AUTORITATIF pour la tarification par pays. PUR et testable.
// Le client PEUT proposer un pays/prix, mais le SERVEUR décide du prix final :
//   - le prix est TOUJOURS dérivé du pays AUTORITATIF côté serveur (canon), jamais du client ;
//   - CH ne peut JAMAIS payer en EUR ; FR/BE/LU ne peuvent JAMAIS payer en CHF ;
//   - un price_id/pays/devise fourni par le client n'est PAS de confiance (ignoré + journalisé) ;
//   - un conflit avec une PREUVE FORTE (entreprise/facturation vérifiée) → revue/forçage ;
//   - un conflit IP FAIBLE seul → NE bloque PAS un utilisateur légitime, mais est JOURNALISÉ.

import {
  normalizeCountry, isSupportedLaunchCountry, stripePriceEnvKeyForCountry, currencyForCountry,
  type Currency, type StripePriceKey, type LaunchCountry,
} from "./country-pricing";

export type CheckoutGuardCode =
  | "ALLOWED"
  | "COUNTRY_REQUIRED"
  | "COUNTRY_NOT_SUPPORTED"
  | "COUNTRY_PRICE_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "CH_REQUIRES_CHF_PRICE"
  | "EUR_COUNTRY_REQUIRES_EUR_PRICE"
  | "BILLING_COUNTRY_CONFLICT"
  | "COMPANY_COUNTRY_CONFLICT"
  | "GEO_WEAK_CONFLICT"
  | "STRIPE_PRICE_NOT_CONFIGURED"
  | "PRODUCTION_DISABLED";

export interface CheckoutGuardInput {
  readonly selectedCountry?: string | null;   // demandé par le client (revalidé)
  readonly geoCountry?: string | null;        // x-vercel-ip-country (indice faible)
  readonly companyCountry?: string | null;    // entreprise vérifiée (fort)
  readonly billingCountry?: string | null;    // facturation connue (fort)
  readonly taxCountry?: string | null;        // TVA/fiscal (corroboration/log)
  readonly requestedPriceKey?: string | null; // clé de prix demandée par le client — NON de confiance
  readonly requestedPriceId?: string | null;  // price_id client brut — NON de confiance (ignoré)
  readonly requestedCurrency?: string | null; // devise demandée par le client — NON de confiance
  readonly stripe: { readonly eurConfigured: boolean; readonly chfConfigured: boolean };
  /** false → contexte production non prêt : la route peut renvoyer PRODUCTION_DISABLED. */
  readonly productionReady?: boolean;
  readonly requireProduction?: boolean;
}

export interface CheckoutGuardDecision {
  readonly ok: boolean;                 // procéder à la création de session
  readonly reviewRequired: boolean;     // état de revue (ni succès silencieux, ni crash)
  readonly resolvedCountry: string | null;
  readonly resolvedPriceKey: StripePriceKey | null; // dérivé SERVEUR (autoritatif)
  readonly currency: Currency | null;
  readonly code: CheckoutGuardCode;
  readonly message: string;             // humain (jamais un conseil juridique/fiscal)
  readonly warnings: string[];
  readonly ignoredClientPrice: boolean; // un prix client a été fourni et ignoré
}

const nn = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function fail(code: CheckoutGuardCode, message: string, extra?: Partial<CheckoutGuardDecision>): CheckoutGuardDecision {
  return { ok: false, reviewRequired: false, resolvedCountry: null, resolvedPriceKey: null, currency: null, code, message, warnings: [], ignoredClientPrice: false, ...extra };
}

/**
 * Évalue le guard de checkout. Le prix final est TOUJOURS `resolvedPriceKey` (dérivé du canon,
 * jamais du client). Retourne ok=true seulement si le pays est résolu, supporté, sans conflit
 * fort, et la clé de prix requise configurée dans Stripe.
 */
export function evaluateCheckoutCountryGuard(input: CheckoutGuardInput): CheckoutGuardDecision {
  const warnings: string[] = [];

  const company = normalizeCountry(input.companyCountry);
  const billing = normalizeCountry(input.billingCountry);
  const selected = normalizeCountry(input.selectedCountry);
  const geo = normalizeCountry(input.geoCountry);
  const tax = normalizeCountry(input.taxCountry);
  const requestedPriceKey = nn(input.requestedPriceKey);
  const ignoredClientPrice = !!requestedPriceKey || !!nn(input.requestedPriceId) || !!nn(input.requestedCurrency);
  if (ignoredClientPrice) warnings.push("Prix/pays/devise fourni par le client IGNORÉ — le serveur dérive le prix du pays autoritatif.");

  // ── 1. Pays AUTORITATIF, par ordre de force : entreprise > facturation > sélection ──
  const authoritative = company ?? billing ?? selected;
  if (!authoritative) return fail("COUNTRY_REQUIRED", "Choisissez votre pays de facturation pour continuer.", { warnings });
  if (!isSupportedLaunchCountry(authoritative)) {
    return fail("COUNTRY_NOT_SUPPORTED", "Ce pays n'est pas encore ouvert au lancement.", { resolvedCountry: authoritative, warnings });
  }
  const country = authoritative as LaunchCountry;
  const resolvedPriceKey = stripePriceEnvKeyForCountry(country) as StripePriceKey;
  const currency = currencyForCountry(country) as Currency;

  // ── 2. Conflits PREUVE FORTE (entreprise / facturation vérifiée ≠ sélection) → revue ──
  const strong = company ?? billing;
  const strongSource: CheckoutGuardCode = company ? "COMPANY_COUNTRY_CONFLICT" : "BILLING_COUNTRY_CONFLICT";
  if (strong && selected && isSupportedLaunchCountry(strong) && selected !== strong) {
    const forced = stripePriceEnvKeyForCountry(strong) as StripePriceKey;
    const forcedCur = currencyForCountry(strong) as Currency;
    const msg = strong === "CH"
      ? "Votre pays de facturation indique la Suisse. L'offre applicable est 499 CHF / mois."
      : "Votre pays de facturation ne correspond pas à la sélection. L'offre applicable est 449 € / mois.";
    return {
      ok: false, reviewRequired: true, resolvedCountry: strong, resolvedPriceKey: forced, currency: forcedCur,
      code: strongSource, message: msg, warnings, ignoredClientPrice,
    };
  }

  // ── 3. Conflit géo FAIBLE (IP ≠ preuve de paiement) ──
  if (geo && isSupportedLaunchCountry(geo) && geo !== country) {
    warnings.push(`GEO_WEAK_CONFLICT: IP=${geo} ≠ pays autoritatif=${country} (journalisé).`);
    // PROTECTION SENS « MOINS CHER » : si l'IP indique la Suisse (offre 499 CHF) mais le pays
    // résolu est une offre EUR MOINS CHÈRE, SANS preuve forte confirmant l'EUR → on EXIGE une
    // CONFIRMATION (revue), pas un blocage dur : un voyageur FR légitime confirme son pays ; un
    // client suisse ne peut pas glisser silencieusement vers l'EUR. Le sens inverse (IP EUR →
    // CH, plus cher) n'est pas une fraude et reste autorisé (journalisé).
    const cheaperDirection = currencyForCountry(geo) === "CHF" && currency === "EUR" && !strong;
    if (cheaperDirection) {
      return {
        ok: false, reviewRequired: true, resolvedCountry: country, resolvedPriceKey, currency,
        code: "GEO_WEAK_CONFLICT",
        message: "Votre localisation suggère la Suisse. Confirmez votre pays de facturation — l'offre suisse est 499 CHF / mois.",
        warnings, ignoredClientPrice,
      };
    }
  }
  if (tax && isSupportedLaunchCountry(tax) && tax !== country) {
    warnings.push(`TAX_COUNTRY_NOTE: fiscal=${tax} ≠ pays autoritatif=${country} (à vérifier au paiement).`);
  }

  // ── 4. Prix/devise client (jamais de confiance) : mismatch → journalisé, prix FORCÉ correct ──
  if (requestedPriceKey && requestedPriceKey !== resolvedPriceKey) {
    const code: CheckoutGuardCode = country === "CH" ? "CH_REQUIRES_CHF_PRICE"
      : (country === "FR" || country === "BE" || country === "LU") ? "EUR_COUNTRY_REQUIRES_EUR_PRICE"
      : "COUNTRY_PRICE_MISMATCH";
    warnings.push(`${code}: clé de prix demandée « ${requestedPriceKey} » ignorée ; prix forcé « ${resolvedPriceKey} ».`);
  }
  const reqCur = nn(input.requestedCurrency)?.toUpperCase();
  if (reqCur && reqCur !== currency) {
    warnings.push(`CURRENCY_MISMATCH: devise demandée « ${reqCur} » ignorée ; devise correcte « ${currency} ».`);
  }

  // ── 5. Config Stripe FAIL-CLOSED (aucun repli inter-devise) ──
  const priceConfigured = currency === "EUR" ? input.stripe.eurConfigured : input.stripe.chfConfigured;
  if (!priceConfigured) {
    return { ok: false, reviewRequired: false, resolvedCountry: country, resolvedPriceKey, currency, code: "STRIPE_PRICE_NOT_CONFIGURED", message: "Le paiement pour ce pays n'est pas encore configuré. Réessayez plus tard.", warnings, ignoredClientPrice };
  }

  // ── 6. Contexte production (optionnel) ──
  if (input.requireProduction && input.productionReady === false) {
    return { ok: false, reviewRequired: false, resolvedCountry: country, resolvedPriceKey, currency, code: "PRODUCTION_DISABLED", message: "Les paiements ne sont pas encore ouverts.", warnings, ignoredClientPrice };
  }

  // ── 7. Autorisé : prix SERVEUR-AUTORITATIF ──
  return { ok: true, reviewRequired: false, resolvedCountry: country, resolvedPriceKey, currency, code: "ALLOWED", message: `Offre applicable : ${currency === "EUR" ? "449 € / mois" : "499 CHF / mois"}.`, warnings, ignoredClientPrice };
}
