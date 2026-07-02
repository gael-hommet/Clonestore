// src/lib/pierre/v1/hr-country-execution/document-binding.ts
// PHASE 8.12 — which country rule families gate the MANDATORY content of a document. A document whose
// mandatory mentions depend on an unVERIFIED rule cannot be produced as final (only draft/manual).
import type { HrMissionPackDefinition } from "../hr-mission-packs/types";

// document kind → rule families that govern its mandatory content
const DOC_RULE_FAMILIES: Record<string, string[]> = {
  contract: ["contract_types", "working_time", "probation_periods", "notice_periods"],
  letter: ["contract_types", "notice_periods"],
  payslip: ["payslip_requirements", "payroll_contributions"],
  certificate: ["document_retention"],
  attestation: ["document_retention"],
};

export type DocumentBinding = { kind: string; ruleFamilies: string[]; gatedByCountryRules: boolean };

export function documentBindings(pack: HrMissionPackDefinition): DocumentBinding[] {
  return pack.expectedArtifacts.map((a) => {
    const fams = DOC_RULE_FAMILIES[a.kind] ?? [];
    return { kind: a.kind, ruleFamilies: fams, gatedByCountryRules: fams.length > 0 };
  });
}
