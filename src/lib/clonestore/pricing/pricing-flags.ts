// src/lib/clonestore/pricing/pricing-flags.ts
// P10 → PAYMENT PATH CLOSURE (2026-07-24) — la tarification par pays est désormais RÉVÉLÉE PAR
// DÉFAUT, même pattern que CloneChat (C1.2, isCloneChatEnabled) : une variable absente ou vide
// active la fonctionnalité ; seul un arrêt d'urgence EXPLICITE (STRIPE_COUNTRY_PRICING_ENABLED=
// false|0|off|disabled|no) la coupe. Justification : « aucune autre combinaison n'est valide »
// (FR/BE/LU=449€, CH=499CHF) est désormais le contrat canonique du paiement Pierre, pas une
// fonctionnalité optionnelle — le chemin prix unique (STRIPE_PRICE_PIERRE, EUR uniquement, aucune
// validation pays) ne doit plus être le comportement par défaut. Le guard reste fail-closed
// (checkout-country-guard.ts) : rien n'est jamais activé sans country_pricing_config réel.

const EMERGENCY_OFF_VALUES = new Set(["false", "0", "off", "disabled", "no"]);

/** La tarification par pays (résolution + guard checkout country-aware) est-elle active ?
 *  Révélée par défaut — seul un arrêt d'urgence explicite la désactive. */
export function isCountryPricingEnabled(): boolean {
  const raw = process.env.STRIPE_COUNTRY_PRICING_ENABLED;
  if (typeof raw !== "string" || raw.trim() === "") return true;
  return !EMERGENCY_OFF_VALUES.has(raw.trim().toLowerCase());
}
