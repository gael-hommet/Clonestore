// src/lib/geo/capabilities.ts
// P18 — the per-country capability disposition map (the code form of P18_COUNTRY_CAPABILITY_MATRIX.md).
// It is NOT a parallel truth: for legally-sensitive capabilities it reads the ACTUAL verified state of
// the HR canon country pack (COUNTRY_REGISTRY) — a country-legal capability can only become
// COUNTRY_VERIFIED if its rule family carries VERIFIED rules. With 0 VERIFIED rules today, every
// country-legal capability is DISABLED_UNTIL_VERIFIED / HUMAN_VALIDATION_REQUIRED (fail-closed & honest).
// Human-only floors (final dismissal / final salary decisions) and MUST_NOT scope (full payroll) are
// hard-coded regardless of country, matching P14/P16A.

import type { GeoCountryCode } from "./types";
import { COUNTRY_REGISTRY } from "../pierre/v1/hr-canon/country-packs";
import type { Jurisdiction } from "../pierre/v1/hr-canon/country-packs/types";

export type CapabilityDisposition =
  | "SHARED_VERIFIED"            // universal, safe in all countries (mechanics, not local law)
  | "COUNTRY_VERIFIED"          // legally reviewed & VERIFIED for this country
  | "CONFIG_REQUIRED"           // needs company configuration first
  | "CONTEXT_REQUIRED"          // needs extra context (e.g. Swiss canton) before asserting
  | "HUMAN_VALIDATION_REQUIRED" // may be prepared but a human must validate before use
  | "HUMAN_ONLY"                // a human must decide — Pierre never decides
  | "DISABLED_UNTIL_VERIFIED"   // no operational reliance until sourced+reviewed
  | "OUT_OF_SCOPE";             // deliberately not a Pierre capability (MUST_NOT / external)

type CapabilityClass = "SHARED" | "COUNTRY_LEGAL" | "DOCUMENT" | "HUMAN_ONLY" | "OUT_OF_SCOPE" | "EXTERNAL_BLOCKED";

type CapabilityDef = {
  readonly key: string;
  readonly label: string;
  readonly klass: CapabilityClass;
  readonly ruleFamily?: string;        // HR-canon family gating a COUNTRY_LEGAL capability
  readonly subdivisionSensitive?: boolean; // becomes CONTEXT_REQUIRED for canton/region countries
  readonly note?: string;
};

/** The canonical Pierre capability list (matches the Phase-3 matrix rows). */
export const CAPABILITIES: readonly CapabilityDef[] = [
  { key: "company_create", label: "Création d'entreprise dans CloneStore", klass: "SHARED" },
  { key: "company_onboarding", label: "Onboarding entreprise", klass: "SHARED" },
  { key: "employee_onboarding", label: "Onboarding d'un salarié", klass: "SHARED" },
  { key: "collect_personal_data", label: "Collecte des données personnelles", klass: "SHARED", note: "RGPD (FR/BE/LU) / nLPD (CH) — la collecte avec base légale est universelle ; les spécificités locales sont des avertissements." },
  { key: "entry_documents", label: "Documents d'entrée", klass: "DOCUMENT" },
  { key: "employment_contract", label: "Contrat de travail", klass: "DOCUMENT", ruleFamily: "contract_types" },
  { key: "amendment", label: "Avenant / modification du contrat", klass: "DOCUMENT", ruleFamily: "contract_types" },
  { key: "trial_period", label: "Période d'essai", klass: "COUNTRY_LEGAL", ruleFamily: "probation_periods" },
  { key: "working_time", label: "Temps de travail", klass: "COUNTRY_LEGAL", ruleFamily: "working_time", subdivisionSensitive: true },
  { key: "leave_absence", label: "Congés et absences", klass: "COUNTRY_LEGAL", ruleFamily: "paid_leave", subdivisionSensitive: true },
  { key: "sick_leave", label: "Arrêt maladie", klass: "COUNTRY_LEGAL", ruleFamily: "sick_leave" },
  { key: "deadline_tracking", label: "Suivi d'échéances", klass: "SHARED", note: "Le suivi est universel ; toute échéance LÉGALE affirmée dépend d'une règle pays VERIFIED." },
  { key: "hr_communications", label: "Communications RH", klass: "SHARED" },
  { key: "payroll", label: "Paie et transmission de données de paie", klass: "OUT_OF_SCOPE", note: "Paie complète = MUST_NOT (P14)." },
  { key: "confidentiality", label: "Confidentialité", klass: "SHARED" },
  { key: "retention", label: "Conservation", klass: "COUNTRY_LEGAL", ruleFamily: "document_retention" },
  { key: "signature", label: "Signature", klass: "EXTERNAL_BLOCKED", note: "Prestataire de signature bloqué (comme Stripe Live)." },
  { key: "contract_end", label: "Fin de contrat", klass: "COUNTRY_LEGAL", ruleFamily: "notice_periods" },
  { key: "dismissal_decision", label: "Décision de licenciement", klass: "HUMAN_ONLY", note: "La décision finale de licenciement est HUMAN_ONLY (P14/P16A)." },
  { key: "resignation", label: "Démission (traitement)", klass: "COUNTRY_LEGAL", ruleFamily: "notice_periods" },
  { key: "exit_documents", label: "Certificats / documents de sortie", klass: "DOCUMENT", ruleFamily: "document_retention" },
  { key: "archiving", label: "Archivage", klass: "SHARED" },
  { key: "deletion", label: "Suppression", klass: "SHARED", note: "Le droit de suppression est universel ; les durées minimales de conservation sont country-legal." },
  { key: "employee_requests", label: "Demandes des salariés", klass: "SHARED" },
  { key: "human_validation", label: "Validation humaine", klass: "SHARED" },
  { key: "document_generation", label: "Génération documentaire", klass: "DOCUMENT" },
  { key: "calls_emails_future", label: "Appels et emails (futurs)", klass: "EXTERNAL_BLOCKED", note: "CloneVoice non opérationnel ; envoi email en attente d'intégration." },
  { key: "history", label: "Historique", klass: "SHARED" },
  { key: "audit", label: "Audit", klass: "SHARED" },
  { key: "permissions", label: "Permissions", klass: "SHARED" },
];

const CAPABILITY_BY_KEY: Readonly<Record<string, CapabilityDef>> =
  Object.fromEntries(CAPABILITIES.map((c) => [c.key, c]));

export type CountryCapabilityStatus = {
  readonly country: GeoCountryCode;
  readonly capabilityKey: string;
  readonly label: string;
  readonly disposition: CapabilityDisposition;
  readonly reason: string;
};

/** Does the HR-canon pack for this country carry ≥1 VERIFIED rule in a given family? */
function familyHasVerifiedRule(country: GeoCountryCode, family: string): boolean {
  const pack = COUNTRY_REGISTRY[country as Jurisdiction];
  if (!pack) return false;
  const fam = pack.families.find((f) => f.family === family);
  if (!fam) return false;
  return fam.rules.some((r) => r.status === "VERIFIED");
}

/** True when a subdivision is required to safely assert this country's rules (CH cantons, BE regions). */
function subdivisionContextRequired(country: GeoCountryCode): boolean {
  return country === "CH" || country === "BE";
}

/**
 * Resolve the disposition of a capability in a country. Reads the real HR-canon verified state for
 * country-legal capabilities, so it can never over-promise. Unknown capability → OUT_OF_SCOPE (fail-closed).
 */
export function capabilityStatusForCountry(country: GeoCountryCode, capabilityKey: string): CountryCapabilityStatus {
  const def = CAPABILITY_BY_KEY[capabilityKey];
  if (!def) {
    return { country, capabilityKey, label: capabilityKey, disposition: "OUT_OF_SCOPE", reason: "Capacité inconnue — fail-closed." };
  }
  const base = (disposition: CapabilityDisposition, reason: string): CountryCapabilityStatus =>
    ({ country, capabilityKey, label: def.label, disposition, reason });

  switch (def.klass) {
    case "SHARED":
      return base("SHARED_VERIFIED", def.note ?? "Mécanique universelle, sûre dans tous les pays.");
    case "HUMAN_ONLY":
      return base("HUMAN_ONLY", def.note ?? "Décision humaine obligatoire — Pierre ne décide jamais.");
    case "OUT_OF_SCOPE":
      return base("OUT_OF_SCOPE", def.note ?? "Hors périmètre Pierre.");
    case "EXTERNAL_BLOCKED":
      return base("DISABLED_UNTIL_VERIFIED", def.note ?? "Dépend d'un prestataire externe bloqué.");
    case "DOCUMENT":
    case "COUNTRY_LEGAL": {
      const family = def.ruleFamily;
      if (family && familyHasVerifiedRule(country, family)) {
        // even VERIFIED, a subdivision-sensitive rule needs the canton/region present to be asserted
        if (def.subdivisionSensitive && subdivisionContextRequired(country)) {
          return base("CONTEXT_REQUIRED", `Règle VERIFIED mais dépendante de la subdivision en ${country} — le canton/région est requis.`);
        }
        return base("COUNTRY_VERIFIED", `Règle(s) VERIFIED présente(s) pour « ${family} » en ${country}.`);
      }
      // no VERIFIED rules: documents may still be prepared for human validation; pure legal rules stay disabled
      if (def.klass === "DOCUMENT") {
        return base("HUMAN_VALIDATION_REQUIRED", `Aucun modèle vérifié en ${country} — brouillon possible, validation humaine obligatoire.`);
      }
      if (def.subdivisionSensitive && subdivisionContextRequired(country)) {
        return base("DISABLED_UNTIL_VERIFIED", `Règle « ${family} » non vérifiée en ${country} (et dépendante de la subdivision) — désactivée.`);
      }
      return base("DISABLED_UNTIL_VERIFIED", `Règle « ${family} » non vérifiée en ${country} — désactivée jusqu'à sourcing + revue.`);
    }
    default:
      return base("OUT_OF_SCOPE", "Classe de capacité inconnue — fail-closed.");
  }
}

/** The full capability matrix for a country (all capabilities). Pure. */
export function capabilityMatrixForCountry(country: GeoCountryCode): readonly CountryCapabilityStatus[] {
  return CAPABILITIES.map((c) => capabilityStatusForCountry(country, c.key));
}
