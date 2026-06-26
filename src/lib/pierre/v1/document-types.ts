// src/lib/pierre/v1/document-types.ts
// PHASE 8.3-B2 §6 — canonical, non-bypassable HR document type registry. A document
// type unknown to this registry is refused in production. Operational policy, NOT
// legal advice.

export type SignatureRequirement = "none" | "acknowledgement" | "simple" | "advanced";
export type VisibilityPolicy = "never" | "when_exposed" | "always";
export type SiteScopeBehavior = "tenant" | "site_scoped";

export type DocumentTypePolicy = {
  key: string;
  label: string;
  category: "contract" | "hr_record" | "certificate" | "policy" | "report" | "generic";
  default_sensitivity: "normal" | "high";
  required_fields: string[];
  optional_fields: string[];
  allowed_mime_types: string[];
  allowed_renderers: Array<"pdf" | "docx">;
  required_approvals: number;
  signature_requirement: SignatureRequirement;
  retention_policy_key: string;
  legal_hold_policy: "standard" | "extended";
  allowed_roles: string[];      // may create / generate
  read_roles: string[];          // may read
  approve_roles: string[];       // may approve
  employee_visibility: VisibilityPolicy;
  manager_visibility: VisibilityPolicy;
  site_scope_behavior: SiteScopeBehavior;
};

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const HR_WRITE = ["OWNER", "ADMIN", "HR_DIRECTOR", "HR_MANAGER", "HR_OPERATOR"];
const HR_APPROVE = ["OWNER", "ADMIN", "HR_DIRECTOR", "VALIDATOR"];
const HR_READ = ["OWNER", "ADMIN", "HR_DIRECTOR", "HR_MANAGER", "HR_OPERATOR", "VALIDATOR", "AUDITOR"];

function policy(p: Partial<DocumentTypePolicy> & { key: string; label: string; category: DocumentTypePolicy["category"] }): DocumentTypePolicy {
  return {
    default_sensitivity: "normal",
    required_fields: [],
    optional_fields: [],
    allowed_mime_types: [PDF, DOCX],
    allowed_renderers: ["pdf", "docx"],
    required_approvals: 1,
    signature_requirement: "none",
    retention_policy_key: "hr_standard_5y",
    legal_hold_policy: "standard",
    allowed_roles: HR_WRITE,
    read_roles: HR_READ,
    approve_roles: HR_APPROVE,
    employee_visibility: "when_exposed",
    manager_visibility: "when_exposed",
    site_scope_behavior: "site_scoped",
    ...p,
  };
}

export const DOCUMENT_TYPES: Record<string, DocumentTypePolicy> = {
  employment_contract: policy({ key: "employment_contract", label: "Contrat de travail", category: "contract", required_fields: ["employee_id", "employment_id", "contract_type", "start_date"], signature_requirement: "advanced", required_approvals: 1, retention_policy_key: "contract_5y_after_end", employee_visibility: "when_exposed" }),
  contract_amendment: policy({ key: "contract_amendment", label: "Avenant au contrat", category: "contract", required_fields: ["employee_id", "parent_contract_id", "changed_fields"], signature_requirement: "advanced", retention_policy_key: "contract_5y_after_end" }),
  job_offer: policy({ key: "job_offer", label: "Promesse d'embauche", category: "contract", required_fields: ["employee_id", "role_title", "start_date"], signature_requirement: "simple" }),
  onboarding_pack: policy({ key: "onboarding_pack", label: "Pack d'onboarding", category: "hr_record", required_fields: ["employee_id"], signature_requirement: "acknowledgement", required_approvals: 0 }),
  policy_acknowledgement: policy({ key: "policy_acknowledgement", label: "Acceptation de politique", category: "policy", required_fields: ["employee_id", "policy_reference"], signature_requirement: "acknowledgement", required_approvals: 0, employee_visibility: "always" }),
  absence_justification: policy({ key: "absence_justification", label: "Justificatif d'absence", category: "hr_record", required_fields: ["employee_id", "absence_reference"], required_approvals: 0, allowed_mime_types: [PDF, "image/png", "image/jpeg"], allowed_renderers: [] }),
  payroll_variable_document: policy({ key: "payroll_variable_document", label: "Élément variable de paie", category: "hr_record", default_sensitivity: "high", required_fields: ["employee_id", "period"], allowed_roles: ["OWNER", "ADMIN", "HR_DIRECTOR", "PAYROLL_MANAGER"], read_roles: ["OWNER", "ADMIN", "HR_DIRECTOR", "PAYROLL_MANAGER", "AUDITOR"], employee_visibility: "never", manager_visibility: "never" }),
  interview_report: policy({ key: "interview_report", label: "Compte-rendu d'entretien", category: "report", required_fields: ["employee_id"], default_sensitivity: "high", required_approvals: 0, employee_visibility: "never" }),
  training_certificate: policy({ key: "training_certificate", label: "Attestation de formation", category: "certificate", required_fields: ["employee_id", "training_reference"], required_approvals: 0, signature_requirement: "simple", employee_visibility: "always" }),
  disciplinary_document: policy({ key: "disciplinary_document", label: "Document disciplinaire", category: "hr_record", default_sensitivity: "high", required_fields: ["employee_id", "reason"], required_approvals: 1, signature_requirement: "simple", retention_policy_key: "disciplinary_3y", employee_visibility: "when_exposed", manager_visibility: "never", approve_roles: ["OWNER", "ADMIN", "HR_DIRECTOR"] }),
  employee_certificate: policy({ key: "employee_certificate", label: "Attestation salarié", category: "certificate", required_fields: ["employee_id"], required_approvals: 0, employee_visibility: "always" }),
  work_certificate: policy({ key: "work_certificate", label: "Certificat de travail", category: "certificate", required_fields: ["employee_id", "start_date", "end_date"], required_approvals: 0, signature_requirement: "simple", employee_visibility: "always" }),
  offboarding_document: policy({ key: "offboarding_document", label: "Document de départ", category: "hr_record", required_fields: ["employee_id"], signature_requirement: "simple" }),
  generic_hr_document: policy({ key: "generic_hr_document", label: "Document RH", category: "generic", required_fields: [], required_approvals: 0, signature_requirement: "none" }),
};

export function getDocumentTypePolicy(key: string): DocumentTypePolicy | null {
  return DOCUMENT_TYPES[key] ?? null;
}

/** Throws (validation) for an unknown type — non-bypassable in production services. */
export function validateDocumentType(key: string): DocumentTypePolicy {
  const p = getDocumentTypePolicy(key);
  if (!p) throw new Error(`unknown_document_type:${key}`);
  return p;
}

export type DocumentRequirements = {
  required_fields: string[]; required_approvals: number; signature_requirement: SignatureRequirement;
  allowed_mime_types: string[]; allowed_renderers: Array<"pdf" | "docx">; default_sensitivity: "normal" | "high"; retention_policy_key: string;
};
export function calculateDocumentRequirements(key: string): DocumentRequirements {
  const p = validateDocumentType(key);
  return { required_fields: p.required_fields, required_approvals: p.required_approvals, signature_requirement: p.signature_requirement, allowed_mime_types: p.allowed_mime_types, allowed_renderers: p.allowed_renderers, default_sensitivity: p.default_sensitivity, retention_policy_key: p.retention_policy_key };
}

export function canRoleUseDocumentType(roleKeys: string[], typeKey: string): boolean {
  const p = getDocumentTypePolicy(typeKey); if (!p) return false;
  return roleKeys.some((r) => p.allowed_roles.includes(r));
}
export function canRoleReadDocumentType(roleKeys: string[], typeKey: string): boolean {
  const p = getDocumentTypePolicy(typeKey); if (!p) return false;
  return roleKeys.some((r) => p.read_roles.includes(r) || p.allowed_roles.includes(r));
}
export function canRoleApproveDocumentType(roleKeys: string[], typeKey: string): boolean {
  const p = getDocumentTypePolicy(typeKey); if (!p) return false;
  return roleKeys.some((r) => p.approve_roles.includes(r));
}

export const ALL_DOCUMENT_TYPE_KEYS = Object.keys(DOCUMENT_TYPES);
