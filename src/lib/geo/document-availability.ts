// src/lib/geo/document-availability.ts
// P18 — the server guard that decides whether a document template may be FINALIZED / DRAFTED for a
// given legal country. It reads the CountryProfile.documentTemplates availability, so France templates
// are NEVER silently served to a Belgian / Luxembourg / Swiss entity: for those, employment documents
// are DISABLED_UNTIL_VERIFIED (no verified local template exists). A document is never "ready" unless
// its availability is AVAILABLE_VERIFIED. Fail-closed for unknown country / unknown template.

import type { GeoCountryCode, DocumentTemplateAvailability, DocumentTemplateRef } from "./types";
import { resolveCountryProfile } from "./geo-resolver";

export type DocumentDecision = {
  readonly country: GeoCountryCode | null;
  readonly templateKey: string;
  readonly availability: DocumentTemplateAvailability | "COUNTRY_REQUIRED" | "COUNTRY_NOT_SUPPORTED" | "TEMPLATE_UNKNOWN";
  readonly finalAllowed: boolean;      // legal finalization permitted (only AVAILABLE_VERIFIED)
  readonly draftAllowed: boolean;      // clearly-marked draft permitted (DRAFT_ONLY / HUMAN_VALIDATION_REQUIRED)
  readonly requiresHumanValidation: boolean;
  readonly reason: string;
};

/** Look up a template's availability for a legal country. Null if country/template unknown. */
export function documentTemplateFor(legalCountry: unknown, templateKey: string): DocumentTemplateRef | null {
  const r = resolveCountryProfile(legalCountry);
  if (r.status !== "ok") return null;
  return r.profile.documentTemplates.find((t) => t.key === templateKey) ?? null;
}

/** Decide finalize/draft permission for a template in a country. Fail-closed. Pure. */
export function decideDocument(legalCountry: unknown, templateKey: string): DocumentDecision {
  const r = resolveCountryProfile(legalCountry);
  if (r.status === "country_required") {
    return { country: null, templateKey, availability: "COUNTRY_REQUIRED", finalAllowed: false, draftAllowed: false, requiresHumanValidation: true, reason: "Pays légal requis pour choisir un modèle documentaire (aucun repli France)." };
  }
  if (r.status === "unsupported") {
    return { country: null, templateKey, availability: "COUNTRY_NOT_SUPPORTED", finalAllowed: false, draftAllowed: false, requiresHumanValidation: true, reason: `Pays « ${r.country} » non supporté.` };
  }
  const profile = r.profile;
  const tpl = profile.documentTemplates.find((t) => t.key === templateKey);
  if (!tpl) {
    return { country: profile.countryCode, templateKey, availability: "TEMPLATE_UNKNOWN", finalAllowed: false, draftAllowed: false, requiresHumanValidation: true, reason: `Modèle « ${templateKey} » inconnu pour ${profile.countryCode}.` };
  }
  const finalAllowed = tpl.availability === "AVAILABLE_VERIFIED";
  const draftAllowed = tpl.availability === "DRAFT_ONLY" || tpl.availability === "HUMAN_VALIDATION_REQUIRED";
  const requiresHumanValidation = tpl.availability !== "AVAILABLE_VERIFIED";
  const reason =
    tpl.availability === "AVAILABLE_VERIFIED" ? `Modèle vérifié pour ${profile.countryCode}.`
    : tpl.availability === "DISABLED_UNTIL_VERIFIED" ? `Aucun modèle vérifié pour ${profile.countryCode} — génération finale désactivée (jamais le modèle FR).`
    : `Brouillon possible pour ${profile.countryCode} — validation humaine obligatoire avant usage.`;
  return { country: profile.countryCode, templateKey, availability: tpl.availability, finalAllowed, draftAllowed, requiresHumanValidation, reason };
}
