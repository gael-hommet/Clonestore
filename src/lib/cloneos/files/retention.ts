// src/lib/cloneos/files/retention.ts
// B34 — File retention policy. Pure, no async.

import type { HrFileCategory, CloneFileRecord } from "./types";

export type FileRetentionPolicy = {
  category: HrFileCategory;
  retention_days: number;
  legal_basis: string;
};

// French HR legal retention requirements (simplified)
const RETENTION_POLICIES: Record<HrFileCategory, FileRetentionPolicy> = {
  contract:          { category: "contract",          retention_days: 365 * 5,  legal_basis: "Code du travail — 5 ans après fin de contrat" },
  amendment:         { category: "amendment",         retention_days: 365 * 5,  legal_basis: "Code du travail — 5 ans après fin de contrat" },
  payroll_export:    { category: "payroll_export",    retention_days: 365 * 5,  legal_basis: "Code du travail — 5 ans (bulletins de paie)" },
  payroll_variable:  { category: "payroll_variable",  retention_days: 365 * 5,  legal_basis: "Code du travail — 5 ans" },
  legal_sensitive:   { category: "legal_sensitive",   retention_days: 365 * 5,  legal_basis: "Prescription civile — 5 ans" },
  sick_leave:        { category: "sick_leave",        retention_days: 365 * 3,  legal_basis: "Code du travail — 3 ans" },
  absence_proof:     { category: "absence_proof",     retention_days: 365 * 3,  legal_basis: "Code du travail — 3 ans" },
  identity_document: { category: "identity_document", retention_days: 365 * 1,  legal_basis: "RGPD — durée minimale, vérification unique" },
  cv:                { category: "cv",                retention_days: 365 * 2,  legal_basis: "RGPD — 2 ans après dernier contact candidat" },
  certificate:       { category: "certificate",       retention_days: 365 * 5,  legal_basis: "Recommandation employeur — 5 ans" },
  interview_report:  { category: "interview_report",  retention_days: 365 * 2,  legal_basis: "RGPD — 2 ans après entretien" },
  training_document: { category: "training_document", retention_days: 365 * 5,  legal_basis: "Code du travail — 5 ans (formation)" },
  employee_file:     { category: "employee_file",     retention_days: 365 * 5,  legal_basis: "Code du travail — 5 ans après départ" },
  onboarding_document:  { category: "onboarding_document",  retention_days: 365 * 2, legal_basis: "Usage interne — 2 ans" },
  offboarding_document: { category: "offboarding_document", retention_days: 365 * 5, legal_basis: "Code du travail — 5 ans après départ" },
  policy:            { category: "policy",            retention_days: 365 * 3,  legal_basis: "Usage interne — 3 ans après mise à jour" },
  procedure:         { category: "procedure",         retention_days: 365 * 3,  legal_basis: "Usage interne — 3 ans après mise à jour" },
  job_description:   { category: "job_description",   retention_days: 365 * 2,  legal_basis: "Usage interne — 2 ans après mise à jour" },
  other:             { category: "other",             retention_days: 365 * 1,  legal_basis: "Par défaut — 1 an" },
};

export function getRetentionPolicy(category: HrFileCategory): FileRetentionPolicy {
  return RETENTION_POLICIES[category] ?? RETENTION_POLICIES["other"];
}

export function computeArchiveAt(createdAt: string | null, category: HrFileCategory): string | null {
  if (!createdAt) return null;
  const policy = getRetentionPolicy(category);
  const created = new Date(createdAt);
  if (isNaN(created.getTime())) return null;
  const archiveAt = new Date(created.getTime() + policy.retention_days * 24 * 60 * 60 * 1000);
  return archiveAt.toISOString();
}

export function shouldArchiveNow(file: CloneFileRecord): boolean {
  if (!file.archived_at) return false;
  return new Date(file.archived_at) <= new Date();
}

export function getRetentionSummary(file: CloneFileRecord): {
  retention_days: number;
  legal_basis: string;
  archive_at: string | null;
  should_archive: boolean;
} {
  const policy = getRetentionPolicy(file.category);
  const archive_at = computeArchiveAt(file.created_at, file.category);
  return {
    retention_days: policy.retention_days,
    legal_basis: policy.legal_basis,
    archive_at,
    should_archive: shouldArchiveNow(file),
  };
}
