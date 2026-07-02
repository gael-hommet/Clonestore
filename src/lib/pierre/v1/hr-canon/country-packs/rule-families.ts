// src/lib/pierre/v1/hr-canon/country-packs/rule-families.ts
// PHASE 8.10 — the canonical catalogue of HR rule families that vary by jurisdiction. Every
// country pack (FR/BE/LU/CH) must declare an instance for each REQUIRED family. Capabilities in
// the registry reference these family keys via countryRuleDependencies. This file lists WHICH
// families exist and WHAT source is needed — it never states a country's actual rule value.

import type { RequiredSourceType } from "./types";

export type RuleFamily = {
  key: string;
  label: string;
  description: string;
  requiredSourceTypes: RequiredSourceType[];
  requiredInPack: boolean; // must every country pack declare it?
};

export const RULE_FAMILIES: readonly RuleFamily[] = [
  { key: "contract_types", label: "Permitted contract types", description: "Which employment contract types are legally permitted and their constraints.", requiredSourceTypes: ["primary_legislation"], requiredInPack: true },
  { key: "probation_periods", label: "Probation periods", description: "Maximum probation duration + renewal rules by contract/category.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "working_time", label: "Working time", description: "Legal weekly/daily max, rest periods, overtime treatment.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "minimum_wage", label: "Minimum wage", description: "Statutory minimum wage / sector minima.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "paid_leave", label: "Paid annual leave", description: "Annual paid leave entitlement + accrual rules.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "public_holidays", label: "Public holidays", description: "Statutory public holidays + treatment.", requiredSourceTypes: ["primary_legislation"], requiredInPack: true },
  { key: "sick_leave", label: "Sick leave", description: "Sick-leave entitlement, waiting period, employer top-up, certificates.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "parental_leave", label: "Maternity / paternity / parental leave", description: "Entitlements, durations, protections.", requiredSourceTypes: ["primary_legislation"], requiredInPack: true },
  { key: "notice_periods", label: "Notice periods", description: "Notice for resignation and dismissal by seniority/category.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "dismissal_procedure", label: "Dismissal procedure", description: "Grounds, procedure, mandatory steps, protected categories.", requiredSourceTypes: ["primary_legislation", "case_law"], requiredInPack: true },
  { key: "severance", label: "Severance / termination indemnities", description: "Statutory/contractual severance computation.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "fixed_term_rules", label: "Fixed-term contract rules", description: "Permitted uses, max duration, renewals, conversion.", requiredSourceTypes: ["primary_legislation"], requiredInPack: true },
  { key: "collective_agreements", label: "Collective agreement applicability", description: "How to determine the applicable CBA and its precedence.", requiredSourceTypes: ["collective_agreement", "official_guidance"], requiredInPack: true },
  { key: "payroll_contributions", label: "Payroll & social contributions", description: "Employer/employee social contributions, bases, rates.", requiredSourceTypes: ["primary_legislation", "provider_spec"], requiredInPack: true },
  { key: "payslip_requirements", label: "Payslip mandatory content", description: "Legally required payslip mentions + format + retention.", requiredSourceTypes: ["primary_legislation", "secondary_legislation"], requiredInPack: true },
  { key: "employee_representation", label: "Employee representation", description: "Works-council / staff-representation thresholds & obligations.", requiredSourceTypes: ["primary_legislation"], requiredInPack: true },
  { key: "occupational_health", label: "Occupational health", description: "Mandatory medical visits & occupational-health obligations.", requiredSourceTypes: ["primary_legislation"], requiredInPack: true },
  { key: "mandatory_trainings", label: "Mandatory trainings", description: "Legally mandatory trainings (safety, etc.) + periodicity.", requiredSourceTypes: ["primary_legislation", "collective_agreement"], requiredInPack: true },
  { key: "document_retention", label: "Legal document retention", description: "Statutory retention periods for HR/payroll records.", requiredSourceTypes: ["primary_legislation", "official_guidance"], requiredInPack: true },
  { key: "right_to_work", label: "Right to work / immigration", description: "Work-authorization checks & obligations.", requiredSourceTypes: ["primary_legislation", "official_guidance"], requiredInPack: true },
  { key: "data_protection", label: "Data protection specifics", description: "National GDPR specifics, HR data, works-council consultation.", requiredSourceTypes: ["primary_legislation", "official_guidance"], requiredInPack: true },
  { key: "disciplinary_procedure", label: "Disciplinary procedure", description: "Procedure, deadlines, sanctions scale, appeal rights.", requiredSourceTypes: ["primary_legislation", "collective_agreement", "case_law"], requiredInPack: true },
  { key: "non_compete", label: "Non-compete / restrictive covenants", description: "Validity conditions, compensation, duration limits.", requiredSourceTypes: ["primary_legislation", "case_law"], requiredInPack: false },
] as const;

export const RULE_FAMILY_KEYS: readonly string[] = RULE_FAMILIES.map((f) => f.key);
export const REQUIRED_RULE_FAMILY_KEYS: readonly string[] = RULE_FAMILIES.filter((f) => f.requiredInPack).map((f) => f.key);
export function getRuleFamily(key: string): RuleFamily | undefined { return RULE_FAMILIES.find((f) => f.key === key); }
