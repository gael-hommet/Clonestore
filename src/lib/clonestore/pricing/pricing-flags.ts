// src/lib/clonestore/pricing/pricing-flags.ts
// P10 — flags de la tarification par pays. Le comportement country-aware du checkout est
// OPT-IN (désactivé par défaut) pour ne PAS casser le chemin de prix unique existant
// (STRIPE_PRICE_PIERRE) ni les tests founder/go-live. Activé via STRIPE_COUNTRY_PRICING_ENABLED.

import { readEnvFlag } from "@/lib/features/product-availability";

/** La tarification par pays (résolution + guard checkout country-aware) est-elle active ? */
export function isCountryPricingEnabled(): boolean {
  return readEnvFlag("STRIPE_COUNTRY_PRICING_ENABLED");
}
