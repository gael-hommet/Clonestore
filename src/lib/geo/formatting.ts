// src/lib/geo/formatting.ts
// P18 — locale/currency/timezone-aware formatting DERIVED from a CountryProfile, so product surfaces
// stop hardcoding "fr-FR" / "€" / "Europe/Paris". These are display helpers only — they never decide
// price, currency or jurisdiction (that is the server resolver's job). Pure.
//
// IMPORTANT distinction preserved here: the UI locale (how text is formatted) is independent from the
// legal currency. A Swiss entity shown in a French UI still displays CHF; a Belgian entity in French UI
// still displays EUR. Currency ALWAYS comes from the profile (legal country), never from the UI locale.

import type { CountryProfile } from "./types";

/** Format the monthly price of a profile in its legal currency (never inferred from UI locale). */
export function formatProfilePrice(profile: CountryProfile): string {
  return formatMoneyMinor(profile, profile.priceAmountMinor);
}

/** Format a minor-unit amount in the profile's legal currency, using the profile's default locale. */
export function formatMoneyMinor(profile: CountryProfile, amountMinor: number): string {
  try {
    return new Intl.NumberFormat(profile.defaultLocale, {
      style: "currency", currency: profile.currency, maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    }).format(amountMinor / 100);
  } catch {
    // fail-safe display — never throw in a render path
    return `${(amountMinor / 100).toFixed(amountMinor % 100 === 0 ? 0 : 2)} ${profile.currency}`;
  }
}

/** Format a date in the profile's timezone + locale. Accepts a Date or ISO string. */
export function formatDate(profile: CountryProfile, date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(profile.defaultLocale, {
      timeZone: profile.timezone, day: "2-digit", month: "2-digit", year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Format a date+time in the profile's timezone + locale. */
export function formatDateTime(profile: CountryProfile, date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(profile.defaultLocale, {
      timeZone: profile.timezone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Format a plain number in the profile's locale (grouping/decimal separators). */
export function formatNumber(profile: CountryProfile, n: number): string {
  try {
    return new Intl.NumberFormat(profile.defaultLocale).format(n);
  } catch {
    return String(n);
  }
}

/** Normalize a phone number to the profile's country calling code hint (display only, no validation). */
export function phoneCallingCode(profile: CountryProfile): string {
  return profile.phoneCountryCode;
}
