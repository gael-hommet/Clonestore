// src/lib/geo/country-profiles.ts
// P18 — the central registry of the four CountryProfiles (FR/BE/LU/CH). Pricing fields are DERIVED
// from the P10 pricing canon (clonestore/pricing/country-pricing.ts) so price truth stays single-sourced.
// This module asserts NO HR legal rule. It carries administrative/structural facts (currency, timezone,
// locales, phone code, identifier FORMATS, subdivisions, terminology) backed by official-source pointers,
// plus document-template availability that stays DISABLED_UNTIL_VERIFIED / HUMAN_VALIDATION_REQUIRED until
// the HR canon has VERIFIED rules & reviewed templates. See P18_OFFICIAL_SOURCES_REGISTER.md for evidence.

import { pricingForCountry } from "../clonestore/pricing/country-pricing";
import type {
  CountryProfile, GeoCountryCode, PricingRegion, GeoCurrency, OfficialSourceReference,
} from "./types";

const PRICING_REGION: Record<GeoCountryCode, PricingRegion> = {
  FR: "FR_EUR", BE: "BE_EUR", LU: "LU_EUR", CH: "CH_CHF",
};

/** Derive price fields from the pricing canon (single source of price truth). Build-time guard. */
function derivePrice(country: GeoCountryCode): {
  currency: GeoCurrency; priceAmount: number; priceAmountMinor: number; priceDisplay: string;
} {
  const r = pricingForCountry(country);
  if (r.status !== "ok") {
    // A supported geo country MUST have a pricing entry — a mismatch is a wiring bug, fail loud at load.
    throw new Error(`geo/country-profiles: pricing canon has no entry for supported country '${country}'`);
  }
  return {
    currency: r.pricing.currency as GeoCurrency,
    priceAmount: r.pricing.amount,
    priceAmountMinor: r.pricing.amountMinor,
    priceDisplay: `${r.pricing.display}`,
  };
}

const CONSULTED = "2026-07-15";

// Official-source pointers shared across profiles (standards bodies) — evidence in the sources register.
const STD_ISO4217: OfficialSourceReference = { topic: "currency", authority: "ISO", title: "ISO 4217 currency codes", url: "https://www.iso.org/iso-4217-currency-codes.html", consultedOn: CONSULTED, certainty: "STANDARD_REFERENCE" };
const STD_IANA_TZ: OfficialSourceReference = { topic: "timezone", authority: "IANA", title: "IANA Time Zone Database", url: "https://www.iana.org/time-zones", consultedOn: CONSULTED, certainty: "STANDARD_REFERENCE" };
const STD_E164: OfficialSourceReference = { topic: "phone_code", authority: "ITU-T", title: "ITU-T E.164 assigned country codes", url: "https://www.itu.int/rec/T-REC-E.164", consultedOn: CONSULTED, certainty: "STANDARD_REFERENCE" };

// ── FRANCE ──────────────────────────────────────────────────────────────────────────────────────
const FR: CountryProfile = {
  countryCode: "FR", legalJurisdiction: "FR", displayName: "France",
  pricingRegion: PRICING_REGION.FR, billingInterval: "month", ...derivePrice("FR"),
  defaultLocale: "fr-FR", supportedLocales: ["fr-FR"], plannedLocales: [],
  timezone: "Europe/Paris", phoneCountryCode: "+33", taxRegion: "FR-EU-VAT",
  formats: {
    dateFormat: "dd/MM/yyyy", timeFormat: "HH:mm", numberDecimalSeparator: ",", numberGroupSeparator: " ",
    currencyDisplay: "449 €", addressFormat: ["line1", "line2", "postal_code city", "country"],
  },
  companyIdentifierTypes: [
    { key: "siren", label: "SIREN", required: true, formatHint: "9 chiffres — ex. 552 100 554", pattern: "^\\d{9}$" },
    { key: "siret", label: "SIRET (établissement)", required: false, formatHint: "14 chiffres", pattern: "^\\d{14}$" },
    { key: "vat_fr", label: "TVA intracommunautaire", required: false, formatHint: "FR + 11 caractères — ex. FR40303265045", pattern: "^FR[0-9A-Z]{2}\\d{9}$" },
  ],
  requiredCompanyFields: ["legal_name", "registration_country", "siren", "address", "postal_code", "city"],
  optionalCompanyFields: ["siret", "vat_fr", "legal_form", "sector"],
  subdivision: { kind: "none", iso3166_2Prefix: "FR-", contextRequiredForRules: false, label: "Région/Département", notes: "Non requis pour la résolution des règles RH nationales." },
  employmentTerminology: {
    employer: "employeur", employee: "salarié", employmentContract: "contrat de travail", amendment: "avenant",
    trialPeriod: "période d'essai", noticePeriod: "préavis", termination: "rupture du contrat",
    resignation: "démission", dismissal: "licenciement",
  },
  documentTemplates: [
    { key: "employment_contract", label: "Contrat de travail", availability: "HUMAN_VALIDATION_REQUIRED", notes: "Brouillon possible ; finalisation légale = revue humaine (0 règle VERIFIED)." },
    { key: "amendment", label: "Avenant", availability: "HUMAN_VALIDATION_REQUIRED" },
    { key: "exit_certificate", label: "Documents de sortie", availability: "DISABLED_UNTIL_VERIFIED" },
  ],
  complianceWarnings: [
    "Aucune règle de droit du travail français n'est asservie automatiquement (0 règle VERIFIED) : les actions juridiquement sensibles restent gouvernées / validation humaine.",
  ],
  officialSourceReferences: [
    { topic: "company_identifier_siren_siret", authority: "INSEE", title: "SIREN/SIRET — répertoire Sirene", url: "https://www.insee.fr/fr/information/1972062", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    { topic: "registre_national_entreprises", authority: "INPI", title: "Registre national des entreprises (RNE)", url: "https://data.inpi.fr/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    { topic: "data_protection_authority", authority: "CNIL", title: "CNIL — autorité de protection des données", url: "https://www.cnil.fr/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    STD_ISO4217, STD_IANA_TZ, STD_E164,
  ],
  version: 1, effectiveFrom: "2026-07-15", status: "ACTIVE", fallbackPolicy: "FAIL_CLOSED_REQUIRE_SELECTION",
};

// ── BELGIUM ─────────────────────────────────────────────────────────────────────────────────────
const BE: CountryProfile = {
  countryCode: "BE", legalJurisdiction: "BE", displayName: "Belgique",
  pricingRegion: PRICING_REGION.BE, billingInterval: "month", ...derivePrice("BE"),
  defaultLocale: "fr-BE", supportedLocales: ["fr-BE"], plannedLocales: ["nl-BE", "de-BE"],
  timezone: "Europe/Brussels", phoneCountryCode: "+32", taxRegion: "BE-EU-VAT",
  formats: {
    dateFormat: "dd/MM/yyyy", timeFormat: "HH:mm", numberDecimalSeparator: ",", numberGroupSeparator: ".",
    currencyDisplay: "449 €", addressFormat: ["line1", "line2", "postal_code city", "country"],
  },
  companyIdentifierTypes: [
    { key: "bce", label: "Numéro d'entreprise (BCE/KBO)", required: true, formatHint: "10 chiffres — ex. 0999.999.999", pattern: "^[01]\\d{9}$" },
    { key: "vat_be", label: "Numéro de TVA", required: false, formatHint: "BE + 10 chiffres (numéro d'entreprise, série 0 ou 1) — ex. BE0999999999 / BE1000000000", pattern: "^BE[01]\\d{9}$" },
  ],
  requiredCompanyFields: ["legal_name", "registration_country", "bce", "address", "postal_code", "city"],
  optionalCompanyFields: ["vat_be", "legal_form", "sector"],
  subdivision: { kind: "region", iso3166_2Prefix: "BE-", contextRequiredForRules: true, label: "Région (Flandre / Wallonie / Bruxelles)", notes: "Certaines matières (ex. formation, aides) varient par région/communauté — demander si une règle en dépend." },
  employmentTerminology: {
    employer: "employeur", employee: "travailleur", employmentContract: "contrat de travail", amendment: "avenant",
    trialPeriod: "clause d'essai", noticePeriod: "délai de préavis", termination: "fin du contrat",
    resignation: "démission", dismissal: "licenciement",
  },
  documentTemplates: [
    { key: "employment_contract", label: "Contrat de travail", availability: "DISABLED_UNTIL_VERIFIED", notes: "Aucun modèle belge vérifié — jamais le modèle FR." },
    { key: "amendment", label: "Avenant", availability: "DISABLED_UNTIL_VERIFIED" },
    { key: "exit_certificate", label: "Documents de sortie", availability: "DISABLED_UNTIL_VERIFIED" },
  ],
  complianceWarnings: [
    "Le droit du travail belge diffère du droit français — aucune règle FR n'est appliquée à une entité belge (moteur d'exécution fail-closed).",
    "Juridiction = Belgique quelle que soit la langue d'interface (fr/nl/de).",
  ],
  officialSourceReferences: [
    { topic: "company_identifier_bce", authority: "SPF Économie — BCE/KBO", title: "Banque-Carrefour des Entreprises", url: "https://economie.fgov.be/fr/themes/entreprises/banque-carrefour-des", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    { topic: "data_protection_authority", authority: "APD/GBA", title: "Autorité de protection des données", url: "https://www.autoriteprotectiondonnees.be/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    STD_ISO4217, STD_IANA_TZ, STD_E164,
  ],
  version: 1, effectiveFrom: "2026-07-15", status: "ARCHITECTURE_READY", fallbackPolicy: "FAIL_CLOSED_REQUIRE_SELECTION",
};

// ── LUXEMBOURG ──────────────────────────────────────────────────────────────────────────────────
const LU: CountryProfile = {
  countryCode: "LU", legalJurisdiction: "LU", displayName: "Luxembourg",
  pricingRegion: PRICING_REGION.LU, billingInterval: "month", ...derivePrice("LU"),
  defaultLocale: "fr-LU", supportedLocales: ["fr-LU"], plannedLocales: ["de-LU", "lb-LU", "en-LU"],
  timezone: "Europe/Luxembourg", phoneCountryCode: "+352", taxRegion: "LU-EU-VAT",
  formats: {
    dateFormat: "dd/MM/yyyy", timeFormat: "HH:mm", numberDecimalSeparator: ",", numberGroupSeparator: " ",
    currencyDisplay: "449 €", addressFormat: ["line1", "line2", "postal_code city", "country"],
  },
  companyIdentifierTypes: [
    { key: "rcsl", label: "Numéro RCS (RCSL)", required: true, formatHint: "B + chiffres — ex. B123456", pattern: "^[A-Z]\\d{1,7}$" },
    { key: "vat_lu", label: "Numéro de TVA", required: false, formatHint: "LU + 8 chiffres — ex. LU12345678", pattern: "^LU\\d{8}$" },
  ],
  requiredCompanyFields: ["legal_name", "registration_country", "rcsl", "address", "postal_code", "city"],
  optionalCompanyFields: ["vat_lu", "legal_form", "sector"],
  subdivision: { kind: "none", iso3166_2Prefix: "LU-", contextRequiredForRules: false, label: "Canton (administratif)", notes: "Non requis pour la résolution des règles RH nationales." },
  employmentTerminology: {
    employer: "employeur", employee: "salarié", employmentContract: "contrat de travail", amendment: "avenant",
    trialPeriod: "période d'essai", noticePeriod: "préavis", termination: "fin du contrat",
    resignation: "démission", dismissal: "licenciement",
  },
  documentTemplates: [
    { key: "employment_contract", label: "Contrat de travail", availability: "DISABLED_UNTIL_VERIFIED", notes: "Aucun modèle luxembourgeois vérifié — jamais le modèle FR/BE." },
    { key: "amendment", label: "Avenant", availability: "DISABLED_UNTIL_VERIFIED" },
    { key: "exit_certificate", label: "Documents de sortie", availability: "DISABLED_UNTIL_VERIFIED" },
  ],
  complianceWarnings: [
    "Le droit du travail luxembourgeois est propre — aucune assimilation à la France ou à la Belgique.",
    "Contexte multilingue (lb/fr/de) : la juridiction reste le Luxembourg quelle que soit la langue.",
  ],
  officialSourceReferences: [
    { topic: "company_identifier_rcsl", authority: "LBR", title: "Luxembourg Business Registers — RCS", url: "https://www.lbr.lu/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    { topic: "data_protection_authority", authority: "CNPD", title: "Commission nationale pour la protection des données", url: "https://cnpd.public.lu/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    STD_ISO4217, STD_IANA_TZ, STD_E164,
  ],
  version: 1, effectiveFrom: "2026-07-15", status: "ARCHITECTURE_READY", fallbackPolicy: "FAIL_CLOSED_REQUIRE_SELECTION",
};

// ── SWITZERLAND ─────────────────────────────────────────────────────────────────────────────────
const CH: CountryProfile = {
  countryCode: "CH", legalJurisdiction: "CH", displayName: "Suisse",
  pricingRegion: PRICING_REGION.CH, billingInterval: "month", ...derivePrice("CH"),
  defaultLocale: "fr-CH", supportedLocales: ["fr-CH"], plannedLocales: ["de-CH", "it-CH"],
  timezone: "Europe/Zurich", phoneCountryCode: "+41", taxRegion: "CH-VAT",
  formats: {
    dateFormat: "dd.MM.yyyy", timeFormat: "HH:mm", numberDecimalSeparator: ".", numberGroupSeparator: "’",
    currencyDisplay: "499 CHF", addressFormat: ["line1", "line2", "postal_code city", "country"],
  },
  companyIdentifierTypes: [
    { key: "ide", label: "IDE/UID", required: true, formatHint: "CHE-xxx.xxx.xxx — ex. CHE-123.456.789", pattern: "^CHE-?\\d{3}\\.?\\d{3}\\.?\\d{3}$" },
    { key: "vat_ch", label: "N° TVA", required: false, formatHint: "CHE-xxx.xxx.xxx TVA/MWST", pattern: "^CHE-?\\d{3}\\.?\\d{3}\\.?\\d{3}( ?(TVA|MWST|IVA))?$" },
  ],
  requiredCompanyFields: ["legal_name", "registration_country", "ide", "address", "postal_code", "city", "canton"],
  optionalCompanyFields: ["vat_ch", "legal_form", "sector"],
  subdivision: { kind: "canton", iso3166_2Prefix: "CH-", contextRequiredForRules: true, label: "Canton", notes: "Plusieurs matières RH dépendent du canton (jours fériés, salaire minimum cantonal…) : demander le canton ou refuser d'affirmer une règle cantonale." },
  employmentTerminology: {
    employer: "employeur", employee: "employé", employmentContract: "contrat de travail (CO)", amendment: "modification du contrat",
    trialPeriod: "temps d'essai", noticePeriod: "délai de congé", termination: "résiliation",
    resignation: "démission", dismissal: "congé/licenciement",
  },
  documentTemplates: [
    { key: "employment_contract", label: "Contrat de travail (CO)", availability: "DISABLED_UNTIL_VERIFIED", notes: "Aucun modèle suisse vérifié — jamais le modèle FR." },
    { key: "amendment", label: "Modification du contrat", availability: "DISABLED_UNTIL_VERIFIED" },
    { key: "exit_certificate", label: "Certificat de travail", availability: "DISABLED_UNTIL_VERIFIED" },
  ],
  complianceWarnings: [
    "La Suisse relève du Code des obligations (CO) et de la LTr, avec des spécificités CANTONALES — aucune règle FR n'est appliquée.",
    "Régime de protection des données = nLPD (non-UE/RGPD) — ne pas présumer le RGPD.",
    "Une règle dépendant du canton exige le canton : sans canton, Pierre refuse d'affirmer la règle.",
  ],
  officialSourceReferences: [
    { topic: "company_identifier_ide_uid", authority: "OFS/BFS", title: "Numéro d'identification des entreprises (IDE/UID)", url: "https://www.uid.admin.ch/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    { topic: "data_protection_authority", authority: "PFPDT/EDÖB", title: "Préposé fédéral à la protection des données (nLPD)", url: "https://www.edoeb.admin.ch/", consultedOn: CONSULTED, certainty: "OFFICIAL_ADMINISTRATIVE" },
    STD_ISO4217, STD_IANA_TZ, STD_E164,
  ],
  version: 1, effectiveFrom: "2026-07-15", status: "ARCHITECTURE_READY", fallbackPolicy: "FAIL_CLOSED_REQUIRE_SELECTION",
};

/** The central profile registry. Keyed by legal country code. */
export const COUNTRY_PROFILES: Readonly<Record<GeoCountryCode, CountryProfile>> = { FR, BE, LU, CH };

export const SUPPORTED_GEO_COUNTRIES: readonly GeoCountryCode[] = ["FR", "BE", "LU", "CH"];

export const PRICING_REGION_BY_COUNTRY: Readonly<Record<GeoCountryCode, PricingRegion>> = PRICING_REGION;
