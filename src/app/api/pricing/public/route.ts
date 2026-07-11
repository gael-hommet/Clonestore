// src/app/api/pricing/public/route.ts
// P10 §4 — Résolution SERVEUR de la tarification publique (fonctionne SANS compte). Le prix
// exact est décidé côté serveur à partir des signaux (sélection ?country=, géo x-vercel-ip-country,
// Accept-Language faible). Un pays inconnu n'obtient AUCUN prix par défaut → sélection requise.
// Quand la tarification par pays est désactivée (flag off), on renvoie le prix EUR historique (449).

import { NextResponse } from "next/server";
import { isCountryPricingEnabled } from "@/lib/clonestore/pricing/pricing-flags";
import { resolvePublicPricing } from "@/lib/clonestore/pricing/public-pricing-resolver";
import { SUPPORTED_LAUNCH_COUNTRIES, publicPricingCatalog } from "@/lib/clonestore/pricing/country-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COUNTRY_LABELS: Record<string, string> = { FR: "France", BE: "Belgique", LU: "Luxembourg", CH: "Suisse" };

function noStore(data: unknown) {
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const selectedCountry = url.searchParams.get("country");
  const enabled = isCountryPricingEnabled();

  const countries = SUPPORTED_LAUNCH_COUNTRIES.map((c) => ({ code: c, label: COUNTRY_LABELS[c] ?? c }));

  if (!enabled) {
    // Comportement historique : offre unique EUR 449 (pas de sélection pays imposée).
    return noStore({
      ok: true,
      enabled: false,
      resolvedCountry: "FR",
      confidence: "selected",
      supported: true,
      requiresCountrySelection: false,
      requiresCheckoutRevalidation: true,
      price: { amount: 449, currency: "EUR", display: "449 € / mois" },
      countries,
      catalog: publicPricingCatalog(),
      message: "449 € / mois.",
    });
  }

  const geoCountry = request.headers.get("x-vercel-ip-country") ?? request.headers.get("x-country");
  const acceptLanguage = request.headers.get("accept-language");
  const res = resolvePublicPricing({ selectedCountry, geoCountry, acceptLanguage });

  const message = res.price
    ? (res.requiresCountrySelection ? `Prix suggéré : ${res.price.display}. Confirmez votre pays pour continuer.` : `${res.price.display}.`)
    : res.auditReason === "COUNTRY_NOT_SUPPORTED"
      ? "Ce pays n'est pas encore ouvert au lancement. Contactez-nous pour être recontacté."
      : "Choisissez votre pays de facturation pour afficher le prix exact.";

  return noStore({
    ok: true,
    enabled: true,
    resolvedCountry: res.resolvedCountry,
    confidence: res.confidence,
    supported: res.supported,
    requiresCountrySelection: res.requiresCountrySelection,
    requiresCheckoutRevalidation: res.requiresCheckoutRevalidation,
    price: res.price ? { amount: res.price.amount, currency: res.price.currency, display: res.price.display } : null,
    countries,
    catalog: publicPricingCatalog(),
    message,
  });
}
