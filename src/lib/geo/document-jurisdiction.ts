// src/lib/geo/document-jurisdiction.ts
// P19 — CONVERGENCE: the single bridge between a Pierre document type and the P18 country authority.
//
// Before P19 the document-generation routes never consulted the geo authority: a Belgian / Luxembourg /
// Swiss entity received a French-framed HR document presented as a valid `generated` artifact (defect D6).
// The correct fail-closed guard `decideDocument(country, templateKey)` already existed in
// `document-availability.ts` but was wired ONLY into the geo *preview* route — never into generation.
//
// This module closes that gap. It:
//   1. classifies a Pierre document type as JURISDICTIONAL (a country-specific legal template exists in the
//      geo profiles: employment_contract / amendment / exit_certificate) or NON_JURISDICTIONAL (generic HR
//      correspondence: offer, convocation, refusal, follow-up, note, briefing…);
//   2. for jurisdictional types, delegates to the P18 authority `decideDocument` — the SOLE source of truth
//      for whether a template may be finalized / drafted / is disabled for that country;
//   3. returns a canonical, honest document STATUS + a user-facing country NOTICE.
//
// Invariants (fail-closed, never France for the unknown):
//   • A jurisdictional document is NEVER finalizable unless the country's template is AVAILABLE_VERIFIED.
//   • For BE/LU/CH (all DISABLED_UNTIL_VERIFIED) a jurisdictional document is BLOCKED from final generation —
//     never the FR model, never a silent French fallback.
//   • Unknown / missing country on a jurisdictional document → COUNTRY_REQUIRED (blocked, human validation).
//   • Non-jurisdictional correspondence is allowed everywhere, but still carries the resolved jurisdiction and,
//     outside FR, a "generic — local legal framing not verified" notice (no over-claim).
// Pure: no async, no I/O. The country MUST be resolved server-side (registration_country) by the caller.

import type { GeoCountryCode } from "./types";
import { decideDocument, type DocumentDecision } from "./document-availability";
import { resolveCountryProfile } from "./geo-resolver";

/** The three jurisdictional template families the geo profiles actually model. */
export type JurisdictionalTemplateKey = "employment_contract" | "amendment" | "exit_certificate";

/** The honest lifecycle status a generated document may carry after the jurisdiction gate. */
export type DocumentJurisdictionStatus =
  | "generated"                          // non-jurisdictional correspondence, or FR verified template
  | "draft_human_validation_required"    // jurisdictional, draftable but a human must validate (e.g. FR HUMAN_VALIDATION_REQUIRED)
  | "blocked_no_local_template"          // jurisdictional, DISABLED_UNTIL_VERIFIED (BE/LU/CH) — never the FR model
  | "blocked_country_required"           // jurisdictional but the entity has no resolved legal country
  | "blocked_country_unsupported";       // jurisdictional but the country is outside the supported set

export type DocumentJurisdictionDecision = {
  readonly pierreDocType: string;
  readonly jurisdictional: boolean;
  readonly templateKey: JurisdictionalTemplateKey | null;
  readonly country: GeoCountryCode | null;
  readonly finalizationAllowed: boolean;      // legal finalization permitted (AVAILABLE_VERIFIED only)
  readonly draftAllowed: boolean;             // a clearly-marked draft may be produced
  readonly requiresHumanValidation: boolean;
  readonly status: DocumentJurisdictionStatus;
  readonly notice: string | null;             // user-facing country notice to embed in the document
  readonly reason: string;
};

/**
 * Map a Pierre document type (legacy normalized docTypes, premium families, or template registry
 * document_types) to a geo jurisdictional template key, or null when the type is generic correspondence.
 * Substring-based so both "contrat de travail" and the family "contract" resolve. Pure.
 */
export function jurisdictionalTemplateKeyForDocType(docType: unknown): JurisdictionalTemplateKey | null {
  const t = (typeof docType === "string" ? docType : "").trim().toLowerCase();
  if (!t) return null;

  // exit / offboarding / work certificate — checked first ("certificat de travail" also matches "contrat"-free).
  // NOTE: match only the EMPLOYMENT/WORK certificate families — never a bare "certificate"/"certificat",
  // which would wrongly gate a training attestation (that is not a country-specific legal exit document).
  if (
    t.includes("offboarding") || t.includes("exit_certificate") || t.includes("exit") ||
    t.includes("sortie") || t.includes("depart") || t.includes("départ") ||
    t.includes("solde de tout compte") || t.includes("certificat de travail") ||
    t.includes("work_certificate") || t.includes("employment_certificate") || t.includes("employment certificate")
  ) {
    return "exit_certificate";
  }
  // amendment / avenant / contract modification
  if (t.includes("amendment") || t.includes("avenant") || t.includes("modification du contrat")) {
    return "amendment";
  }
  // employment contract (CDI/CDD/CO…)
  if (t.includes("contract") || t.includes("contrat") || t.includes("cdi") || t.includes("cdd") || t.includes("embauche_contrat")) {
    return "employment_contract";
  }
  return null;
}

/** True when the Pierre document type carries a country-specific legal template in the geo profiles. */
export function isJurisdictionalDocType(docType: unknown): boolean {
  return jurisdictionalTemplateKeyForDocType(docType) !== null;
}

/**
 * Resolve the canonical, fail-closed jurisdiction decision for generating a Pierre document.
 * `legalCountry` MUST come from the server record (pierre_rt_companies.registration_country) — never the client.
 * Pure.
 */
export function resolveDocumentJurisdiction(legalCountry: unknown, pierreDocType: string): DocumentJurisdictionDecision {
  const templateKey = jurisdictionalTemplateKeyForDocType(pierreDocType);

  // ── Non-jurisdictional correspondence (offer, convocation, refusal, note, briefing, notification…) ──
  if (!templateKey) {
    const r = resolveCountryProfile(legalCountry);
    const country = r.status === "ok" ? r.profile.countryCode : null;
    // Allowed everywhere, but do not over-claim local legal framing outside a resolved FR context.
    const notice =
      country === "FR" || country === null
        ? null
        : `Document générique — le cadre légal ${country} n'est pas vérifié pour ce type ; relire avant usage officiel.`;
    return {
      pierreDocType,
      jurisdictional: false,
      templateKey: null,
      country,
      finalizationAllowed: true,        // correspondence is not a legal template — no legal finalization concept
      draftAllowed: true,
      requiresHumanValidation: false,
      status: "generated",
      notice,
      reason: country
        ? `Correspondance RH générique (non liée à un modèle juridique national) — ${country}.`
        : "Correspondance RH générique (non liée à un modèle juridique national).",
    };
  }

  // ── Jurisdictional document: the P18 authority decides. Fail-closed. ──
  const d: DocumentDecision = decideDocument(legalCountry, templateKey);

  if (d.availability === "COUNTRY_REQUIRED") {
    return {
      pierreDocType, jurisdictional: true, templateKey, country: null,
      finalizationAllowed: false, draftAllowed: false, requiresHumanValidation: true,
      status: "blocked_country_required", notice: d.reason, reason: d.reason,
    };
  }
  if (d.availability === "COUNTRY_NOT_SUPPORTED") {
    return {
      pierreDocType, jurisdictional: true, templateKey, country: null,
      finalizationAllowed: false, draftAllowed: false, requiresHumanValidation: true,
      status: "blocked_country_unsupported", notice: d.reason, reason: d.reason,
    };
  }

  // Country resolved. AVAILABLE_VERIFIED → final; DRAFT_ONLY/HUMAN_VALIDATION_REQUIRED → draft; DISABLED → blocked.
  const country = d.country;
  if (d.availability === "AVAILABLE_VERIFIED") {
    return {
      pierreDocType, jurisdictional: true, templateKey, country,
      finalizationAllowed: true, draftAllowed: true, requiresHumanValidation: false,
      status: "generated", notice: null, reason: d.reason,
    };
  }
  if (d.availability === "DRAFT_ONLY" || d.availability === "HUMAN_VALIDATION_REQUIRED") {
    return {
      pierreDocType, jurisdictional: true, templateKey, country,
      finalizationAllowed: false, draftAllowed: true, requiresHumanValidation: true,
      status: "draft_human_validation_required",
      notice: `Brouillon ${country} — validation humaine obligatoire avant tout usage officiel (aucune finalisation légale automatique).`,
      reason: d.reason,
    };
  }
  // DISABLED_UNTIL_VERIFIED (BE/LU/CH) or TEMPLATE_UNKNOWN → blocked, NEVER the FR model.
  return {
    pierreDocType, jurisdictional: true, templateKey, country,
    finalizationAllowed: false, draftAllowed: false, requiresHumanValidation: true,
    status: "blocked_no_local_template",
    notice: country
      ? `Aucun modèle vérifié pour ${country} — génération de ce document désactivée (jamais le modèle français).`
      : d.reason,
    reason: d.reason,
  };
}
