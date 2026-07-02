// src/lib/pierre/v1/hr-canon/country-packs/registry.ts
// PHASE 8.10 — the scaffolder + registry for country packs. `scaffoldPack` builds a complete pack
// for a jurisdiction where every REQUIRED rule family is present and every sub-rule is authored
// SOURCE_REQUIRED with a null value (nothing invented). P8.12 replaces SOURCE_REQUIRED with
// sourced+reviewed values. The registry aggregates the four supported packs.

import type { CountryPack, CountryRuleFamilyInstance, Jurisdiction } from "./types";
import { RULE_FAMILIES, REQUIRED_RULE_FAMILY_KEYS, getRuleFamily } from "./rule-families";
import { sourceRequired } from "./source-contract";

// Standard sub-rule keys each family should source (kept generic + universal, not country values).
export const FAMILY_SUBRULES: Record<string, string[]> = {
  contract_types: ["permitted_types", "type_specific_constraints"],
  probation_periods: ["max_duration_by_category", "renewal_allowed", "renewal_max_duration"],
  working_time: ["weekly_max_hours", "daily_max_hours", "daily_rest_hours", "weekly_rest", "overtime_treatment"],
  minimum_wage: ["statutory_minimum", "sector_minimum_reference"],
  paid_leave: ["annual_entitlement", "accrual_rule", "carryover_rule"],
  public_holidays: ["holiday_calendar", "worked_holiday_treatment"],
  sick_leave: ["waiting_period", "employer_topup", "certificate_deadline", "job_protection"],
  parental_leave: ["maternity", "paternity", "parental", "protections"],
  notice_periods: ["resignation_notice", "dismissal_notice_by_seniority"],
  dismissal_procedure: ["valid_grounds", "procedure_steps", "protected_categories", "deadlines"],
  severance: ["eligibility", "computation_formula", "minimum"],
  fixed_term_rules: ["permitted_uses", "max_duration", "max_renewals", "conversion_rule"],
  collective_agreements: ["applicability_determination", "precedence_rule", "favourability_applies"],
  payroll_contributions: ["employer_contributions", "employee_contributions", "bases_and_ceilings"],
  payslip_requirements: ["mandatory_mentions", "format", "retention_period"],
  employee_representation: ["thresholds", "obligations", "consultation_cases"],
  occupational_health: ["mandatory_visits", "periodicity", "special_categories"],
  mandatory_trainings: ["required_trainings", "periodicity", "proof_requirements"],
  document_retention: ["retention_by_document_type"],
  right_to_work: ["authorization_checks", "employer_obligations"],
  data_protection: ["hr_data_specifics", "works_council_consultation", "sensitive_data_rules"],
  disciplinary_procedure: ["procedure_steps", "deadlines", "sanction_scale", "appeal_rights"],
  non_compete: ["validity_conditions", "compensation_requirement", "max_duration"],
};

/** Build a fully-scaffolded pack: every required family present, all sub-rules SOURCE_REQUIRED. */
export function scaffoldPack(meta: { jurisdiction: Jurisdiction; name: string; currency: string; language: string; notes?: Record<string, string> }): CountryPack {
  const families: CountryRuleFamilyInstance[] = RULE_FAMILIES
    .filter((f) => f.requiredInPack || FAMILY_SUBRULES[f.key])
    .map((f) => {
      const subs = FAMILY_SUBRULES[f.key] ?? ["value"];
      return {
        family: f.key,
        notes: meta.notes?.[f.key],
        rules: subs.map((sub) => sourceRequired(`${f.key}.${sub}`, `${f.label} — ${sub.replace(/_/g, " ")}`, getRuleFamily(f.key)?.requiredSourceTypes ?? ["primary_legislation"])),
      };
    });
  return {
    jurisdiction: meta.jurisdiction,
    name: meta.name,
    currency: meta.currency,
    language: meta.language,
    version: 1,
    status: "SCAFFOLD",
    families,
    disclaimer:
      "SCAFFOLD ONLY — every rule is SOURCE_REQUIRED with a null value. No legal rule value has been asserted. " +
      "Values must be sourced from authoritative references and legally reviewed in P8.12 before any operational reliance.",
  };
}

// The four supported packs are assembled in index.ts from their manifests.
export const REQUIRED_FAMILIES = REQUIRED_RULE_FAMILY_KEYS;
export type CountryRegistry = Record<Jurisdiction, CountryPack>;
