// src/lib/pierre/v1/contract-policies.ts
// PHASE 8.3-B2G §1 — canonical CONTRACT policy registry. Operational requirements per
// contract family present in the real schema (pierre_rt_employee_contracts.contract_type
// CHECK). NOT legal advice. A contract type unknown to this registry is refused; an
// incompatible template or renderer is refused; a weaker policy supplied by a caller is
// ignored — the policy comes from HERE.

import { getDocumentTypePolicy, type DocumentTypePolicy } from "./document-types";

export type ContractTypeKey =
  | "CDI_FULL_TIME" | "CDI_PART_TIME" | "CDD" | "CDD_REPLACEMENT" | "CDD_TEMPORARY_INCREASE"
  | "APPRENTICESHIP" | "PROFESSIONAL_TRAINING" | "INTERNSHIP" | "SEASONAL" | "TEMPORARY" | "OTHER";

export type ContractPolicy = {
  key: ContractTypeKey;
  label: string;
  document_type: string;              // maps to the document-type registry
  amendment_document_type: string;
  requires_template: boolean;
  required_fields: string[];          // canonical generation-context paths
  conditional_fields: string[];       // required only when applicable (e.g. fixed-term end date)
  allowed_renderers: Array<"pdf" | "docx">;
  required_approvals: number;
  create_roles: string[];
  approve_roles: string[];
  sensitivity: "normal" | "high";
  signature_level: "none" | "acknowledgement" | "simple" | "advanced" | "qualified";
  employee_visibility: "never" | "when_exposed" | "always";
  manager_visibility: "never" | "when_exposed" | "always";
  fixed_term: boolean;                // requires an end date, end > start
  requires_end_date: boolean;
  amendment_allowed: boolean;
  amendment_allowed_after_signature: boolean;
  required_provenance: Record<string, string>; // field path → required provenance
  auto_execution_allowed: false;      // contracts are NEVER auto-executed
};

const HR_WRITE = ["OWNER", "ADMIN", "HR_DIRECTOR", "HR_MANAGER", "HR_OPERATOR"];
const HR_APPROVE = ["OWNER", "ADMIN", "HR_DIRECTOR", "VALIDATOR"];
const BASE_FIELDS = ["company.legal_name", "employee.first_name", "employee.last_name", "employee.role_title", "employment.start_date"];

function policy(p: Partial<ContractPolicy> & { key: ContractTypeKey; label: string }): ContractPolicy {
  return {
    document_type: "employment_contract",
    amendment_document_type: "contract_amendment",
    requires_template: true,
    required_fields: BASE_FIELDS,
    conditional_fields: [],
    allowed_renderers: ["pdf", "docx"],
    required_approvals: 1,
    create_roles: HR_WRITE,
    approve_roles: HR_APPROVE,
    sensitivity: "high",
    // R3.1 — explicit business decision (Choice B): standard employment contracts require a
    // Simple Electronic Signature (SES / eIDAS electronic_signature) — legally binding, no ID
    // verification. This is the REAL requirement; the previous "advanced" default was an
    // over-specification that the adapter silently downgraded. AES/QES are now opt-in per-policy
    // (e.g. APPRENTICESHIP) and the adapter NEVER downgrades a stronger requirement.
    signature_level: "simple",
    employee_visibility: "when_exposed",
    manager_visibility: "never",
    fixed_term: false,
    requires_end_date: false,
    amendment_allowed: true,
    amendment_allowed_after_signature: true,
    required_provenance: {},
    auto_execution_allowed: false,
    ...p,
  };
}

const FIXED_TERM = { fixed_term: true, requires_end_date: true, conditional_fields: ["employment.end_date"] };

export const CONTRACT_POLICIES: Record<ContractTypeKey, ContractPolicy> = {
  CDI_FULL_TIME: policy({ key: "CDI_FULL_TIME", label: "CDI temps plein", required_fields: [...BASE_FIELDS, "employment.weekly_hours"] }),
  CDI_PART_TIME: policy({ key: "CDI_PART_TIME", label: "CDI temps partiel", required_fields: [...BASE_FIELDS, "employment.weekly_hours"] }),
  CDD: policy({ key: "CDD", label: "CDD", ...FIXED_TERM, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  CDD_REPLACEMENT: policy({ key: "CDD_REPLACEMENT", label: "CDD de remplacement", ...FIXED_TERM, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  CDD_TEMPORARY_INCREASE: policy({ key: "CDD_TEMPORARY_INCREASE", label: "CDD accroissement temporaire", ...FIXED_TERM, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  // R3.1 — Choice A: this regulated contract carries a stronger signature requirement (AES). The
  // signing flow blocks CLEANLY (readiness blocked, submission refused, no provider HTTP) until the
  // AES capability + signer phones are provisioned in the environment — it is NEVER executed as SES.
  APPRENTICESHIP: policy({ key: "APPRENTICESHIP", label: "Contrat d'apprentissage", ...FIXED_TERM, signature_level: "advanced", required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  PROFESSIONAL_TRAINING: policy({ key: "PROFESSIONAL_TRAINING", label: "Contrat de professionnalisation", ...FIXED_TERM, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  INTERNSHIP: policy({ key: "INTERNSHIP", label: "Convention de stage", ...FIXED_TERM, signature_level: "simple", required_approvals: 1, amendment_allowed_after_signature: false, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  SEASONAL: policy({ key: "SEASONAL", label: "Contrat saisonnier", ...FIXED_TERM, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  TEMPORARY: policy({ key: "TEMPORARY", label: "Contrat temporaire / intérim", ...FIXED_TERM, required_fields: [...BASE_FIELDS, "employment.end_date"] }),
  OTHER: policy({ key: "OTHER", label: "Autre contrat", requires_template: true, required_approvals: 1, signature_level: "simple" }),
};

export const ALL_CONTRACT_TYPE_KEYS = Object.keys(CONTRACT_POLICIES) as ContractTypeKey[];

export function getContractPolicy(key: string): ContractPolicy | null {
  return (CONTRACT_POLICIES as Record<string, ContractPolicy>)[key] ?? null;
}

/** Throws for an unknown contract type — non-bypassable in production services. */
export function validateContractType(key: string): ContractPolicy {
  const p = getContractPolicy(key);
  if (!p) throw new Error(`unknown_contract_type:${key}`);
  return p;
}

/** The document-type policy a contract type resolves to (for renderer/role/visibility reuse). */
export function contractDocumentTypePolicy(key: string): DocumentTypePolicy | null {
  const p = getContractPolicy(key);
  return p ? getDocumentTypePolicy(p.document_type) : null;
}

// FAIL-CLOSED: an empty / unknown role set is NEVER permitted (R1.2).
export function canRoleCreateContract(roleKeys: readonly string[], type: string): boolean {
  const p = getContractPolicy(type); if (!p) return false;
  return roleKeys.length > 0 && roleKeys.some((r) => p.create_roles.includes(r));
}
export function canRoleApproveContract(roleKeys: readonly string[], type: string): boolean {
  const p = getContractPolicy(type); if (!p) return false;
  return roleKeys.length > 0 && roleKeys.some((r) => p.approve_roles.includes(r));
}

/** A renderer is allowed only if BOTH the contract policy and the document-type policy permit it. */
export function isRendererAllowedForContract(type: string, renderer: "pdf" | "docx"): boolean {
  const p = getContractPolicy(type); if (!p) return false;
  if (!p.allowed_renderers.includes(renderer)) return false;
  const dt = getDocumentTypePolicy(p.document_type);
  return !dt || dt.allowed_renderers.includes(renderer);
}
