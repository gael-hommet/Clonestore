// src/lib/clonestore/pricing/country-pricing.ts
// P10 — CANON de tarification par pays (launch countries). Module PUR et testable :
// aucun appel Stripe, aucun accès env, aucune I/O. Source de vérité UNIQUE des règles
// « quel pays paie quel prix, dans quelle devise, via quelle clé de prix Stripe ».
//
// Règle métier absolue :
//   FR / BE / LU → 449 EUR / mois  (groupe EUR_LAUNCH, devise EUR)
//   CH           → 499 CHF / mois  (groupe CHF_LAUNCH, devise CHF)
//   Un client suisse NE PEUT PAS acheter l'offre EUR. Un client FR/BE/LU NE PEUT PAS acheter l'offre CHF.
//   Un pays INCONNU n'obtient JAMAIS silencieusement l'offre la moins chère → « country_required ».

// ── Types canoniques ────────────────────────────────────────────────────────
export type LaunchCountry = "FR" | "BE" | "LU" | "CH";
export type Currency = "EUR" | "CHF";
export type CountryGroup = "EUR_LAUNCH" | "CHF_LAUNCH";
export type StripePriceKey = "STRIPE_PRICE_PIERRE_EUR_MONTHLY" | "STRIPE_PRICE_PIERRE_CHF_MONTHLY";

/** Identité produit (une seule offre Pierre, mensuelle). */
export const AGENT_SLUG = "pierre" as const;

export const SUPPORTED_LAUNCH_COUNTRIES: readonly LaunchCountry[] = ["FR", "BE", "LU", "CH"];
export const EUR_LAUNCH: readonly LaunchCountry[] = ["FR", "BE", "LU"];
export const CHF_LAUNCH: readonly LaunchCountry[] = ["CH"];

/** Prix mensuel canonique par pays (montant en unité principale, pas en centimes). */
export interface CountryPricing {
  readonly country: LaunchCountry;
  readonly group: CountryGroup;
  readonly currency: Currency;
  readonly amount: number;        // 449 ou 499 (unité principale)
  readonly amountMinor: number;   // 44900 ou 49900 (centimes / rappen) — attendu Stripe unit_amount
  readonly interval: "month";
  readonly display: string;       // ex. « 449 € / mois » ou « 499 CHF / mois »
  readonly stripePriceKey: StripePriceKey;
}

const PRICING: Readonly<Record<LaunchCountry, CountryPricing>> = {
  FR: { country: "FR", group: "EUR_LAUNCH", currency: "EUR", amount: 449, amountMinor: 44900, interval: "month", display: "449 € / mois", stripePriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" },
  BE: { country: "BE", group: "EUR_LAUNCH", currency: "EUR", amount: 449, amountMinor: 44900, interval: "month", display: "449 € / mois", stripePriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" },
  LU: { country: "LU", group: "EUR_LAUNCH", currency: "EUR", amount: 449, amountMinor: 44900, interval: "month", display: "449 € / mois", stripePriceKey: "STRIPE_PRICE_PIERRE_EUR_MONTHLY" },
  CH: { country: "CH", group: "CHF_LAUNCH", currency: "CHF", amount: 499, amountMinor: 49900, interval: "month", display: "499 CHF / mois", stripePriceKey: "STRIPE_PRICE_PIERRE_CHF_MONTHLY" },
};

/** Montant Stripe attendu (unité mineure : centimes/rappen) pour un pays, ou null si non supporté.
 *  FR/BE/LU → 44900 (EUR) ; CH → 49900 (CHF). Utilisé par le guard de prix currency-aware. */
export function expectedUnitAmountForCountry(input: unknown): number | null {
  if (!isSupportedLaunchCountry(input)) return null;
  return PRICING[normalizeCountry(input) as LaunchCountry].amountMinor;
}

/** La devise ISO Stripe (minuscule) attendue pour un pays, ou null. Ex. "eur"/"chf". */
export function expectedStripeCurrencyForCountry(input: unknown): string | null {
  const c = currencyForCountry(input);
  return c ? c.toLowerCase() : null;
}

// ── Décision canonique (codes partagés avec le guard de checkout) ────────────
export type PricingDecisionCode =
  | "ALLOWED"
  | "COUNTRY_REQUIRED"            // pays inconnu / non résolu → sélection requise (JAMAIS l'offre la moins chère)
  | "COUNTRY_NOT_SUPPORTED"      // pays connu mais hors périmètre de lancement
  | "CH_REQUIRES_CHF_PRICE"      // CH tente d'acheter une offre EUR → interdit
  | "EUR_COUNTRY_REQUIRES_EUR_PRICE" // FR/BE/LU tente d'acheter l'offre CHF → interdit
  | "CURRENCY_MISMATCH"          // devise incompatible avec le pays
  | "COUNTRY_PRICE_MISMATCH";    // incompatibilité pays↔clé de prix générique

/** Résultat de résolution de prix : soit une tarification, soit un état « à résoudre ». */
export type PricingResolution =
  | { readonly status: "ok"; readonly pricing: CountryPricing }
  | { readonly status: "country_required" }                       // inconnu → sélection requise
  | { readonly status: "unsupported"; readonly country: string }; // hors périmètre

// ── Normalisation d'entrée ──────────────────────────────────────────────────
// Alias pays courants → ISO-3166-1 alpha-2. Robuste aux entrées « sales »
// (casse, espaces, noms complets FR/EN/DE). Retourne un code ISO-2 majuscule ou null.
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  fr: "FR", fra: "FR", france: "FR",
  be: "BE", bel: "BE", belgium: "BE", belgique: "BE", belgie: "BE", belgien: "BE",
  lu: "LU", lux: "LU", luxembourg: "LU", luxemburg: "LU",
  ch: "CH", che: "CH", switzerland: "CH", suisse: "CH", schweiz: "CH", svizzera: "CH",
};

/** Normalise une entrée pays vers ISO-2 majuscule (ou null si non reconnu). Pur. */
export function normalizeCountry(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
  // Code ISO-2 direct (deux lettres) : normalisé en majuscule (mais pas forcément supporté).
  if (/^[a-z]{2}$/.test(lower)) return lower.toUpperCase();
  return null;
}

/** Le pays (après normalisation) fait-il partie des pays de lancement supportés ? Pur. */
export function isSupportedLaunchCountry(input: unknown): input is LaunchCountry {
  const c = normalizeCountry(input);
  return !!c && (SUPPORTED_LAUNCH_COUNTRIES as readonly string[]).includes(c);
}

/** Groupe pays (EUR_LAUNCH / CHF_LAUNCH) ou null si non supporté. Pur. */
export function countryGroupFor(input: unknown): CountryGroup | null {
  if (!isSupportedLaunchCountry(input)) return null;
  return PRICING[normalizeCountry(input) as LaunchCountry].group;
}

/** Devise canonique du pays ou null si non supporté. Pur. */
export function currencyForCountry(input: unknown): Currency | null {
  if (!isSupportedLaunchCountry(input)) return null;
  return PRICING[normalizeCountry(input) as LaunchCountry].currency;
}

/** Clé d'env Stripe canonique du pays ou null si non supporté. Pur. */
export function stripePriceEnvKeyForCountry(input: unknown): StripePriceKey | null {
  if (!isSupportedLaunchCountry(input)) return null;
  return PRICING[normalizeCountry(input) as LaunchCountry].stripePriceKey;
}

/** Résout la tarification d'un pays. Inconnu → country_required (JAMAIS l'offre la moins chère). Pur. */
export function pricingForCountry(input: unknown): PricingResolution {
  const c = normalizeCountry(input);
  if (!c) return { status: "country_required" };
  if (!(SUPPORTED_LAUNCH_COUNTRIES as readonly string[]).includes(c)) return { status: "unsupported", country: c };
  return { status: "ok", pricing: PRICING[c as LaunchCountry] };
}

/** Défaut pour pays inconnu : EXIGE une sélection — ne retourne AUCUN prix (anti-abus). Pur. */
export function defaultPricingForUnknownCountry(): PricingResolution {
  return { status: "country_required" };
}

/** Devise compatible avec le pays ? (CH↔CHF, FR/BE/LU↔EUR). Pur. */
export function isCountryCurrencyCompatible(input: unknown, currency: unknown): boolean {
  const expected = currencyForCountry(input);
  return !!expected && currency === expected;
}

/** Clé de prix Stripe canonique compatible avec le pays ? Pur.
 *  IMPORTANT : opère sur la CLÉ canonique (StripePriceKey), pas sur un price_id Stripe brut
 *  (un module pur ne peut pas connaître la devise d'un price_id ; le guard mappe id→clé via env). */
export function isCountryPriceCompatible(input: unknown, priceKey: unknown): boolean {
  const expected = stripePriceEnvKeyForCountry(input);
  return !!expected && priceKey === expected;
}

/** Le pays PEUT-IL acheter cette clé de prix ? = supporté ET clé compatible. Pur. */
export function canCountryBuyPrice(input: unknown, priceKey: unknown): boolean {
  return isSupportedLaunchCountry(input) && isCountryPriceCompatible(input, priceKey);
}

// ── Explication de décision (audit + UX) ────────────────────────────────────
export interface CountryPriceDecision {
  readonly allowed: boolean;
  readonly code: PricingDecisionCode;
  readonly country: string | null;         // normalisé
  readonly expectedCurrency: Currency | null;
  readonly expectedPriceKey: StripePriceKey | null;
  readonly requestedPriceKey: string | null;
  readonly message: string;                 // humain (jamais un conseil juridique/fiscal)
}

/**
 * Explique la décision « ce pays peut-il acheter cette clé de prix ? » avec un code stable.
 * Priorité des raisons : inconnu → country_required ; non supporté ; puis mismatch pays↔prix
 * (CH↔EUR spécifique, FR/BE/LU↔CHF spécifique, sinon générique).
 */
export function explainCountryPriceDecision(input: { country?: unknown; priceKey?: unknown }): CountryPriceDecision {
  const country = normalizeCountry(input.country);
  const requestedPriceKey = typeof input.priceKey === "string" ? input.priceKey : null;

  if (!country) {
    return { allowed: false, code: "COUNTRY_REQUIRED", country: null, expectedCurrency: null, expectedPriceKey: null, requestedPriceKey, message: "Choisissez votre pays de facturation pour afficher le prix exact." };
  }
  if (!(SUPPORTED_LAUNCH_COUNTRIES as readonly string[]).includes(country)) {
    return { allowed: false, code: "COUNTRY_NOT_SUPPORTED", country, expectedCurrency: null, expectedPriceKey: null, requestedPriceKey, message: "Ce pays n'est pas encore ouvert au lancement. Contactez-nous pour être recontacté." };
  }
  const expectedCurrency = currencyForCountry(country)!;
  const expectedPriceKey = stripePriceEnvKeyForCountry(country)!;

  if (requestedPriceKey && requestedPriceKey !== expectedPriceKey) {
    // Mismatch : codes spécifiques pour le message et l'audit.
    if (country === "CH") {
      return { allowed: false, code: "CH_REQUIRES_CHF_PRICE", country, expectedCurrency, expectedPriceKey, requestedPriceKey, message: "Votre pays de facturation indique la Suisse. L'offre applicable est 499 CHF / mois." };
    }
    return { allowed: false, code: "EUR_COUNTRY_REQUIRES_EUR_PRICE", country, expectedCurrency, expectedPriceKey, requestedPriceKey, message: "Pour la France, la Belgique et le Luxembourg, l'offre applicable est 449 € / mois." };
  }

  return { allowed: true, code: "ALLOWED", country, expectedCurrency, expectedPriceKey, requestedPriceKey: requestedPriceKey ?? expectedPriceKey, message: `Offre applicable : ${PRICING[country as LaunchCountry].display}.` };
}

/** Vue publique compacte (sérialisable) pour l'UI / les preuves. Pur. */
export function publicPricingCatalog(): ReadonlyArray<{ group: CountryGroup; countries: LaunchCountry[]; display: string; amount: number; currency: Currency }> {
  return [
    { group: "EUR_LAUNCH", countries: [...EUR_LAUNCH], display: "449 € / mois", amount: 449, currency: "EUR" },
    { group: "CHF_LAUNCH", countries: [...CHF_LAUNCH], display: "499 CHF / mois", amount: 499, currency: "CHF" },
  ];
}
