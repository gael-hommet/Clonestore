// src/lib/pierre/v1/hr-canon/country-packs/source-registry.ts
// PHASE 8.12 — the register of OFFICIAL legal sources. CRITICAL: this file names WHERE each rule
// family must be sourced (the official authority + its official portal) — it never states a legal
// rule VALUE. Naming Légifrance / Moniteur belge / Légilux / Fedlex etc. is a factual pointer to the
// official channel, not an invented law. Every entry starts POINTER_ONLY (content not yet retrieved
// or archived, no content hash, no dates) — retrieval + archival + qualified legal review happen
// downstream and only then can a derived rule become VERIFIED. A model's internal knowledge is NEVER
// a legal source.

import type { Jurisdiction } from "./types";

export type OfficialSourceType =
  | "statute" | "regulation" | "administrative_guidance" | "official_portal"
  | "official_collective_agreement" | "official_provider_documentation";

// Lifecycle of the SOURCE pointer itself (distinct from a rule's verification status).
export type SourceLifecycle = "ACTIVE" | "SUPERSEDED" | "STALE" | "RETIRED";
// Whether the source CONTENT has been retrieved/archived (honesty about what actually happened).
export type SourceRetrievalStatus = "POINTER_ONLY" | "RETRIEVED" | "ARCHIVED";

export type HrOfficialLegalSource = {
  id: string;
  jurisdiction: Jurisdiction;
  subdivision: string | null;      // e.g. a Swiss canton
  authority: string;               // the official body
  title: string;
  sourceType: OfficialSourceType;
  officialUrl: string;             // the official portal (pointer, not a rule)
  language: string;
  publishedAt: string | null;      // null until actually retrieved from the official text
  effectiveFrom: string | null;
  effectiveTo: string | null;
  retrievedAt: string | null;      // null while POINTER_ONLY
  contentHash: string | null;      // null while POINTER_ONLY — never a hash of model output
  snapshotReference: string | null;
  excerptOrSummary: string;        // what to source here (NOT a legal value)
  ruleFamilies: string[];          // rule-families.ts keys this source covers
  retrievalStatus: SourceRetrievalStatus;
  lifecycle: SourceLifecycle;
};

// helper to declare an official-authority POINTER (no content retrieved, no rule value)
function ptr(id: string, jurisdiction: Jurisdiction, authority: string, title: string, sourceType: OfficialSourceType, officialUrl: string, language: string, ruleFamilies: string[], excerpt: string, subdivision: string | null = null): HrOfficialLegalSource {
  return {
    id, jurisdiction, subdivision, authority, title, sourceType, officialUrl, language,
    publishedAt: null, effectiveFrom: null, effectiveTo: null, retrievedAt: null,
    contentHash: null, snapshotReference: null, excerptOrSummary: excerpt, ruleFamilies,
    retrievalStatus: "POINTER_ONLY", lifecycle: "ACTIVE",
  };
}

// ── FRANCE ──
const FR: HrOfficialLegalSource[] = [
  ptr("fr.legifrance", "FR", "République française (DILA)", "Légifrance — Code du travail & textes officiels", "statute", "https://www.legifrance.gouv.fr", "fr-FR", ["contract_types", "working_time", "paid_leave", "notice_periods", "dismissal_procedure", "fixed_term_rules", "probation_periods", "disciplinary_procedure", "parental_leave", "sick_leave", "severance"], "Source primary labour-law provisions from the Code du travail here (retrieval + legal review pending)."),
  ptr("fr.service_public", "FR", "DILA — service-public.fr", "Service-Public — official administrative guidance", "official_portal", "https://www.service-public.fr", "fr-FR", ["public_holidays", "right_to_work", "document_retention"], "Source official administrative guidance / procedures here."),
  ptr("fr.urssaf", "FR", "URSSAF", "URSSAF — cotisations sociales & SMIC", "official_portal", "https://www.urssaf.fr", "fr-FR", ["payroll_contributions", "minimum_wage"], "Source social contributions + statutory minimum wage here + provider spec for DSN."),
  ptr("fr.cnil", "FR", "CNIL", "CNIL — RGPD & données RH", "administrative_guidance", "https://www.cnil.fr", "fr-FR", ["data_protection"], "Source national GDPR specifics for HR data + retention guidance here."),
  ptr("fr.ameli", "FR", "Assurance Maladie / Ameli", "Ameli — arrêts de travail", "official_portal", "https://www.ameli.fr", "fr-FR", ["sick_leave", "occupational_health"], "Source sick-leave + occupational-health obligations here."),
  ptr("fr.cba", "FR", "Convention collective de branche (IDCC)", "Branch collective agreement — official text", "official_collective_agreement", "https://www.legifrance.gouv.fr", "fr-FR", ["collective_agreements", "mandatory_trainings"], "Source the applicable branch CBA (IDCC) here."),
];

// ── BELGIUM ──
const BE: HrOfficialLegalSource[] = [
  ptr("be.justel", "BE", "SPF Justice — Moniteur belge / Justel", "Justel — législation consolidée", "statute", "https://www.ejustice.just.fgov.be", "fr-BE", ["contract_types", "notice_periods", "dismissal_procedure", "working_time", "fixed_term_rules", "severance"], "Source consolidated Belgian labour legislation here."),
  ptr("be.emploi", "BE", "SPF Emploi, Travail et Concertation sociale", "SPF Emploi — guidance", "administrative_guidance", "https://emploi.belgique.be", "fr-BE", ["paid_leave", "sick_leave", "parental_leave", "working_time", "probation_periods"], "Source official employment guidance here."),
  ptr("be.onss", "BE", "ONSS / RSZ", "ONSS — cotisations de sécurité sociale", "official_portal", "https://www.onss.be", "fr-BE", ["payroll_contributions", "payslip_requirements"], "Source social contributions + provider spec here."),
  ptr("be.cp", "BE", "Commission paritaire (CP) — CCT", "Joint-committee collective agreement", "official_collective_agreement", "https://www.emploi.belgique.be", "fr-BE", ["collective_agreements", "minimum_wage", "mandatory_trainings"], "Source the applicable joint-committee CBA here."),
  ptr("be.apd", "BE", "Autorité de protection des données (APD/GBA)", "APD — RGPD", "administrative_guidance", "https://www.autoriteprotectiondonnees.be", "fr-BE", ["data_protection"], "Source national GDPR specifics here."),
];

// ── LUXEMBOURG ──
const LU: HrOfficialLegalSource[] = [
  ptr("lu.legilux", "LU", "État luxembourgeois — Légilux", "Légilux — Code du travail", "statute", "https://legilux.public.lu", "fr-LU", ["contract_types", "working_time", "notice_periods", "dismissal_procedure", "fixed_term_rules", "probation_periods", "severance"], "Source primary Luxembourg labour law here."),
  ptr("lu.guichet", "LU", "Guichet.lu", "Guichet — démarches officielles", "official_portal", "https://guichet.public.lu", "fr-LU", ["paid_leave", "public_holidays", "right_to_work", "parental_leave", "sick_leave", "document_retention"], "Source official procedures + entitlements here."),
  ptr("lu.ccss", "LU", "Centre commun de la sécurité sociale (CCSS)", "CCSS — cotisations", "official_portal", "https://www.ccss.lu", "fr-LU", ["payroll_contributions", "payslip_requirements"], "Source social contributions + provider spec here."),
  ptr("lu.itm", "LU", "Inspection du travail et des mines (ITM)", "ITM — santé & sécurité", "administrative_guidance", "https://itm.public.lu", "fr-LU", ["occupational_health", "working_time", "mandatory_trainings"], "Source occupational-health + working-time obligations here."),
  ptr("lu.cnpd", "LU", "Commission nationale pour la protection des données (CNPD)", "CNPD — RGPD", "administrative_guidance", "https://cnpd.public.lu", "fr-LU", ["data_protection"], "Source national GDPR specifics here."),
];

// ── SWITZERLAND (note the cantonal dimension + non-EU nLPD data regime) ──
const CH: HrOfficialLegalSource[] = [
  ptr("ch.fedlex", "CH", "Confédération suisse — Fedlex", "Fedlex — CO & LTr", "statute", "https://www.fedlex.admin.ch", "fr-CH", ["contract_types", "working_time", "notice_periods", "probation_periods", "fixed_term_rules", "dismissal_procedure", "severance"], "Source Code des obligations (CO) + Loi sur le travail (LTr) here."),
  ptr("ch.seco", "CH", "Secrétariat d'État à l'économie (SECO)", "SECO — droit du travail", "administrative_guidance", "https://www.seco.admin.ch", "fr-CH", ["working_time", "occupational_health", "mandatory_trainings"], "Source federal labour guidance here."),
  ptr("ch.ahv", "CH", "AVS/AHV — Centre d'information", "AVS/AHV — assurances sociales", "official_portal", "https://www.ahv-iv.ch", "fr-CH", ["payroll_contributions", "payslip_requirements"], "Source social insurance contributions + provider spec here."),
  ptr("ch.edoeb", "CH", "PFPDT / FDPIC", "PFPDT — nLPD (Swiss FADP, non-EU)", "administrative_guidance", "https://www.edoeb.admin.ch", "fr-CH", ["data_protection"], "Source Swiss nLPD specifics (NOT GDPR) here."),
  ptr("ch.canton", "CH", "Autorité cantonale compétente", "Cantonal portal — minimum wage / holidays", "official_portal", "https://www.ch.ch", "fr-CH", ["minimum_wage", "public_holidays"], "Source cantonal minimum wage + public holidays here (subdivision dependent).", "CH-*"),
];

export const OFFICIAL_SOURCES: readonly HrOfficialLegalSource[] = [...FR, ...BE, ...LU, ...CH];

export function sourcesFor(jurisdiction: Jurisdiction): HrOfficialLegalSource[] {
  return OFFICIAL_SOURCES.filter((s) => s.jurisdiction === jurisdiction && s.lifecycle === "ACTIVE");
}
export function sourcesForRuleFamily(jurisdiction: Jurisdiction, family: string): HrOfficialLegalSource[] {
  return sourcesFor(jurisdiction).filter((s) => s.ruleFamilies.includes(family));
}

/** Validate the source contract: a non-null content hash REQUIRES retrievedAt + a snapshot ref, and
 *  a POINTER_ONLY source must not pretend to carry content. Returns error strings (empty = ok). */
export function validateOfficialSource(s: HrOfficialLegalSource): string[] {
  const e: string[] = [];
  if (!s.officialUrl || !/^https:\/\//.test(s.officialUrl)) e.push(`${s.id}: officialUrl must be an https official portal`);
  if (!s.authority) e.push(`${s.id}: authority required`);
  if (s.ruleFamilies.length === 0) e.push(`${s.id}: must cover ≥1 rule family`);
  if (s.retrievalStatus === "POINTER_ONLY" && (s.contentHash !== null || s.retrievedAt !== null))
    e.push(`${s.id}: POINTER_ONLY must not carry contentHash/retrievedAt (nothing was actually retrieved)`);
  if ((s.retrievalStatus === "RETRIEVED" || s.retrievalStatus === "ARCHIVED") && (!s.contentHash || !s.retrievedAt))
    e.push(`${s.id}: ${s.retrievalStatus} requires contentHash + retrievedAt`);
  return e;
}
