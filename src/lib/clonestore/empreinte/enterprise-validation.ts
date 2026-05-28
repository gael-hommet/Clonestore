// B44 — EnterpriseEmpreinte validation
// Pure: no async, no Supabase, no Next.js, no side effects.

import type {
  EnterpriseEmpreinte,
  EnterpriseEmpreintePatch,
  EmpreinteValidationResult,
  EmpreinteValidationIssue,
  CompanyIdentity,
  CommunicationProfile,
  AutonomyPolicy,
  DataGovernance,
  DocumentPreferences,
} from "./types";

const VALID_TONES = ["formal","warm","direct","executive","neutral","legal_careful","candidate_friendly","internal_concise"];
const VALID_LENGTHS = ["concise","standard","detailed","comprehensive"];
const VALID_AUTONOMY_LEVELS = ["manual","assist","supervised","trusted","restricted"];
const VALID_RISK_THRESHOLDS = ["low","medium","high","critical"];
const VALID_DOC_FORMATS = ["text","markdown","html","pdf_ready_html"];
const VALID_DATA_REGIONS = ["eu","fr","us","other"];
const VALID_SIZE_RANGES = ["1-10","11-50","51-200","201-500","501-1000","1000+"];

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{3,6}$/.test(v);
}

function isValidUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

function validateCompanyIdentity(ci: CompanyIdentity): EmpreinteValidationIssue[] {
  const issues: EmpreinteValidationIssue[] = [];

  if (ci.hr_contact_email && !isValidEmail(ci.hr_contact_email)) {
    issues.push({ field: "company_identity.hr_contact_email", message: "Format email invalide.", severity: "error" });
  }
  if (ci.website_url && !isValidUrl(ci.website_url)) {
    issues.push({ field: "company_identity.website_url", message: "URL invalide.", severity: "warning" });
  }
  if (ci.size_range && !VALID_SIZE_RANGES.includes(ci.size_range)) {
    issues.push({ field: "company_identity.size_range", message: "Plage d'effectif invalide.", severity: "error" });
  }
  if (ci.main_language && ci.main_language.length !== 2) {
    issues.push({ field: "company_identity.main_language", message: "Code langue invalide (ex: fr, en).", severity: "error" });
  }
  if (ci.founded_year !== null && (ci.founded_year < 1800 || ci.founded_year > new Date().getFullYear())) {
    issues.push({ field: "company_identity.founded_year", message: "Année de fondation invalide.", severity: "warning" });
  }

  return issues;
}

function validateCommunication(c: CommunicationProfile): EmpreinteValidationIssue[] {
  const issues: EmpreinteValidationIssue[] = [];

  if (!VALID_TONES.includes(c.default_tone)) {
    issues.push({ field: "communication.default_tone", message: "Ton invalide.", severity: "error" });
  }
  if (!VALID_LENGTHS.includes(c.preferred_length)) {
    issues.push({ field: "communication.preferred_length", message: "Longueur invalide.", severity: "error" });
  }
  if (c.language_code && c.language_code.length !== 2) {
    issues.push({ field: "communication.language_code", message: "Code langue invalide.", severity: "error" });
  }

  return issues;
}

function validateAutonomy(a: AutonomyPolicy): EmpreinteValidationIssue[] {
  const issues: EmpreinteValidationIssue[] = [];

  if (!VALID_AUTONOMY_LEVELS.includes(a.default_level)) {
    issues.push({ field: "autonomy.default_level", message: "Niveau d'autonomie invalide.", severity: "error" });
  }
  if (!VALID_RISK_THRESHOLDS.includes(a.require_approval_above_risk)) {
    issues.push({ field: "autonomy.require_approval_above_risk", message: "Seuil de risque invalide.", severity: "error" });
  }
  if (a.max_auto_tasks_per_mission < 0 || a.max_auto_tasks_per_mission > 100) {
    issues.push({ field: "autonomy.max_auto_tasks_per_mission", message: "Valeur entre 0 et 100.", severity: "warning" });
  }

  return issues;
}

function validateDataGovernance(dg: DataGovernance): EmpreinteValidationIssue[] {
  const issues: EmpreinteValidationIssue[] = [];

  if (dg.gdpr_dpo_email && !isValidEmail(dg.gdpr_dpo_email)) {
    issues.push({ field: "data_governance.gdpr_dpo_email", message: "Format email DPO invalide.", severity: "error" });
  }
  if (dg.data_processing_region && !VALID_DATA_REGIONS.includes(dg.data_processing_region)) {
    issues.push({ field: "data_governance.data_processing_region", message: "Région invalide.", severity: "error" });
  }
  if (dg.data_retention_days < 30 || dg.data_retention_days > 3650) {
    issues.push({ field: "data_governance.data_retention_days", message: "Rétention entre 30 et 3650 jours.", severity: "warning" });
  }

  return issues;
}

function validateDocumentPreferences(dp: DocumentPreferences): EmpreinteValidationIssue[] {
  const issues: EmpreinteValidationIssue[] = [];

  if (!VALID_DOC_FORMATS.includes(dp.preferred_format)) {
    issues.push({ field: "document_preferences.preferred_format", message: "Format document invalide.", severity: "error" });
  }

  return issues;
}

export function validateEnterpriseEmpreinte(
  empreinte: EnterpriseEmpreinte,
): EmpreinteValidationResult {
  const issues: EmpreinteValidationIssue[] = [
    ...validateCompanyIdentity(empreinte.company_identity),
    ...validateCommunication(empreinte.communication),
    ...validateAutonomy(empreinte.autonomy),
    ...validateDataGovernance(empreinte.data_governance),
    ...validateDocumentPreferences(empreinte.document_preferences),
  ];

  // Validate channels
  for (const ch of empreinte.channels) {
    if (ch.from_address && !isValidEmail(ch.from_address)) {
      issues.push({ field: `channels.${ch.channel}.from_address`, message: "Email d'expédition invalide.", severity: "error" });
    }
    if (ch.brand_color_hex && !isValidHex(ch.brand_color_hex)) {
      issues.push({ field: `channels.${ch.channel}.brand_color_hex`, message: "Couleur hex invalide (ex: #FF5733).", severity: "warning" });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: errorCount === 0,
    issues,
    error_count: errorCount,
    warning_count: warningCount,
  };
}

export function validateEnterpriseEmpreintePatch(
  patch: EnterpriseEmpreintePatch,
): EmpreinteValidationResult {
  const issues: EmpreinteValidationIssue[] = [];

  if (patch.company_identity) {
    // Build a minimal identity to validate
    const ci = patch.company_identity as CompanyIdentity;
    issues.push(...validateCompanyIdentity(ci));
  }
  if (patch.communication) {
    issues.push(...validateCommunication(patch.communication as CommunicationProfile));
  }
  if (patch.autonomy) {
    issues.push(...validateAutonomy(patch.autonomy as AutonomyPolicy));
  }
  if (patch.data_governance) {
    issues.push(...validateDataGovernance(patch.data_governance as DataGovernance));
  }
  if (patch.document_preferences) {
    issues.push(...validateDocumentPreferences(patch.document_preferences as DocumentPreferences));
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    valid: errorCount === 0,
    issues,
    error_count: errorCount,
    warning_count: warningCount,
  };
}
