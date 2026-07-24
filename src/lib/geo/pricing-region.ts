// src/lib/geo/pricing-region.ts
// P18 — explicit pricing regions FR_EUR / BE_EUR / LU_EUR / CH_CHF (founder decision), layered over the
// P10 pricing canon. A pricing region is 1:1 with a legal country and is ALWAYS derived server-side from
// the authoritative legal country — never from the client. This module is the anti-manipulation core:
// given a server legal country plus any client-sent region/currency/amount, it returns the AUTHORITATIVE
// region and flags every client value that was ignored or recalculated. FR/BE/LU share the same amount &
// EUR Stripe key but are three DISTINCT pricing regions (distinct billing eligibility).
//
// It NEVER activates Stripe Live and invents no live price id. The future-price wiring is a stable
// mapping region → env price key (already in the P10 canon), resolved to a real price id only server-side.

import {
  pricingForCountry, normalizeCountry, isSupportedLaunchCountry,
  stripePriceEnvKeyForCountry, type StripePriceKey,
} from "../clonestore/pricing/country-pricing";
import type { GeoCountryCode, PricingRegion, GeoCurrency } from "./types";
import { PRICING_REGION_BY_COUNTRY, SUPPORTED_GEO_COUNTRIES } from "./country-profiles";

export const ALL_PRICING_REGIONS: readonly PricingRegion[] = ["FR_EUR", "BE_EUR", "LU_EUR", "CH_CHF"];

const COUNTRY_BY_REGION: Readonly<Record<PricingRegion, GeoCountryCode>> = {
  FR_EUR: "FR", BE_EUR: "BE", LU_EUR: "LU", CH_CHF: "CH",
};

export function isPricingRegion(v: unknown): v is PricingRegion {
  return typeof v === "string" && (ALL_PRICING_REGIONS as readonly string[]).includes(v);
}

/** The authoritative pricing region for a legal country (null if unsupported). Pure. */
export function pricingRegionForCountry(input: unknown): PricingRegion | null {
  const c = normalizeCountry(input);
  if (!c || !(SUPPORTED_GEO_COUNTRIES as readonly string[]).includes(c)) return null;
  return PRICING_REGION_BY_COUNTRY[c as GeoCountryCode];
}

export function countryForPricingRegion(region: PricingRegion): GeoCountryCode {
  return COUNTRY_BY_REGION[region];
}

/** Currency for a region, from the pricing canon (single source of truth). Pure. */
export function currencyForPricingRegion(region: PricingRegion): GeoCurrency {
  const r = pricingForCountry(COUNTRY_BY_REGION[region]);
  if (r.status !== "ok") throw new Error(`pricing-region: canon missing ${region}`);
  return r.pricing.currency as GeoCurrency;
}

/** Minor-unit amount (cents/rappen) for a region, from the pricing canon. Pure. */
export function amountMinorForPricingRegion(region: PricingRegion): number {
  const r = pricingForCountry(COUNTRY_BY_REGION[region]);
  if (r.status !== "ok") throw new Error(`pricing-region: canon missing ${region}`);
  return r.pricing.amountMinor;
}

export function stripePriceKeyForPricingRegion(region: PricingRegion): StripePriceKey {
  const key = stripePriceEnvKeyForCountry(COUNTRY_BY_REGION[region]);
  if (!key) throw new Error(`pricing-region: no stripe key for ${region}`);
  return key;
}

// ── Server-authoritative resolution + anti-manipulation ─────────────────────────────────────────

export type PricingRegionResolutionCode =
  | "ALLOWED"                    // resolved from a supported legal country
  | "COUNTRY_REQUIRED"           // no legal country → selection required (NEVER cheapest / NEVER FR)
  | "COUNTRY_NOT_SUPPORTED";     // known country outside launch scope

export type ClientOverrideFlag =
  | "REGION_IGNORED"             // client sent a pricingRegion — ignored, server value used
  | "REGION_MISMATCH"            // client region ≠ authoritative region
  | "CURRENCY_IGNORED"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_IGNORED"
  | "AMOUNT_MISMATCH";

export type PricingRegionResolution = {
  readonly ok: boolean;
  readonly code: PricingRegionResolutionCode;
  readonly legalCountry: GeoCountryCode | null;   // normalized authoritative country
  readonly pricingRegion: PricingRegion | null;   // AUTHORITATIVE (server-derived)
  readonly currency: GeoCurrency | null;
  readonly amountMinor: number | null;
  readonly stripePriceKey: StripePriceKey | null;
  /** every client-sent value that was ignored or recalculated (audit + UX). */
  readonly overridesApplied: readonly ClientOverrideFlag[];
  readonly message: string;
};

export type PricingRegionClientHints = {
  readonly pricingRegion?: unknown;   // client — NOT trusted
  readonly currency?: unknown;        // client — NOT trusted
  readonly amountMinor?: unknown;     // client — NOT trusted
};

/**
 * Resolve the authoritative pricing region from the SERVER legal country, and diff it against any
 * client-sent hints. The client can never impose region/currency/amount: whatever it sends is ignored,
 * and a mismatch is flagged (for audit + a corrective message). Unknown/unsupported country → fail-closed.
 */
export function resolvePricingRegionServerAuthoritative(
  legalCountry: unknown,
  hints: PricingRegionClientHints = {},
): PricingRegionResolution {
  const c = normalizeCountry(legalCountry);
  if (!c) {
    return {
      ok: false, code: "COUNTRY_REQUIRED", legalCountry: null, pricingRegion: null, currency: null,
      amountMinor: null, stripePriceKey: null, overridesApplied: collectIgnored(hints),
      message: "Pays légal requis : sélectionnez le pays de l'entité pour déterminer la région tarifaire (jamais l'offre la moins chère par défaut).",
    };
  }
  if (!isSupportedLaunchCountry(c)) {
    return {
      ok: false, code: "COUNTRY_NOT_SUPPORTED", legalCountry: null, pricingRegion: null, currency: null,
      amountMinor: null, stripePriceKey: null, overridesApplied: collectIgnored(hints),
      message: "Ce pays n'est pas ouvert au lancement (FR, BE, LU, CH).",
    };
  }
  const country = c as GeoCountryCode;
  const region = PRICING_REGION_BY_COUNTRY[country];
  const currency = currencyForPricingRegion(region);
  const amountMinor = amountMinorForPricingRegion(region);
  const stripePriceKey = stripePriceKeyForPricingRegion(region);

  const overrides: ClientOverrideFlag[] = [];
  if (isNonEmpty(hints.pricingRegion)) overrides.push(hints.pricingRegion === region ? "REGION_IGNORED" : "REGION_MISMATCH");
  if (isNonEmpty(hints.currency)) {
    const cc = String(hints.currency).toUpperCase();
    overrides.push(cc === currency ? "CURRENCY_IGNORED" : "CURRENCY_MISMATCH");
  }
  if (hints.amountMinor !== undefined && hints.amountMinor !== null && hints.amountMinor !== "") {
    const n = Number(hints.amountMinor);
    overrides.push(n === amountMinor ? "AMOUNT_IGNORED" : "AMOUNT_MISMATCH");
  }

  return {
    ok: true, code: "ALLOWED", legalCountry: country, pricingRegion: region, currency, amountMinor,
    stripePriceKey, overridesApplied: overrides,
    message: `Région tarifaire ${region} — ${(amountMinor / 100).toFixed(0)} ${currency} / mois (dérivée du pays légal, autorité serveur).`,
  };
}

function isNonEmpty(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

function collectIgnored(hints: PricingRegionClientHints): ClientOverrideFlag[] {
  const out: ClientOverrideFlag[] = [];
  if (isNonEmpty(hints.pricingRegion)) out.push("REGION_IGNORED");
  if (isNonEmpty(hints.currency)) out.push("CURRENCY_IGNORED");
  if (isNonEmpty(hints.amountMinor)) out.push("AMOUNT_IGNORED");
  return out;
}
