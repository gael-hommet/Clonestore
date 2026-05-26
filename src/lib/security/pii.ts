// src/lib/security/pii.ts
// B41 — PII classification. Pure, no async, no side effects.

import type { SecurityDataSensitivity } from "./types";

// ── Field name classifiers ────────────────────────────────────────────────────

const SECRET_FIELDS = new Set([
  "api_key", "apikey", "api_secret", "secret_key", "service_role_key",
  "private_key", "jwt_secret", "webhook_secret", "stripe_secret",
  "resend_api_key", "openai_api_key", "anthropic_api_key", "provider_key",
  "password", "hashed_password", "token", "access_token", "refresh_token",
  "bearer_token", "auth_token",
]);

const PAYROLL_FIELDS = new Set([
  "salary", "salaire", "paie", "payroll", "remuneration", "brut", "net",
  "hourly_rate", "taux_horaire", "bonus", "prime", "indemnite",
  "iban", "bank_account", "compte_bancaire", "rib",
]);

const HEALTH_FIELDS = new Set([
  "health", "medical", "maladie", "arret", "arret_maladie",
  "disability", "handicap", "pregnancy", "grossesse",
  "sick_leave", "accident_travail", "medical_certificate",
]);

const LEGAL_HR_FIELDS = new Set([
  "disciplinary", "sanction", "licenciement", "dismissal",
  "harassment", "harcelement", "discrimination",
  "complaint", "plainte", "procedure", "litigation",
  "termination_reason", "motif_licenciement",
]);

const HR_SENSITIVE_FIELDS = new Set([
  "contract", "contrat", "amendment", "avenant",
  "offboarding", "onboarding_data", "performance_review",
  "evaluation", "appraisal", "sensitive_case_note",
  "employee_file", "dossier_salarie",
]);

const PERSONAL_FIELDS = new Set([
  "email", "phone", "telephone", "mobile",
  "address", "adresse", "postal_code", "code_postal",
  "ssn", "nir", "numero_securite_sociale", "social_security",
  "date_of_birth", "date_naissance", "birth_date",
  "first_name", "last_name", "prenom", "nom",
  "full_name", "nom_complet", "gender", "genre",
  "nationality", "nationalite",
  "cv", "resume", "candidate_data", "employee_data",
]);

export function isSecretFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return SECRET_FIELDS.has(normalized);
}

export function isPayrollSensitiveFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return PAYROLL_FIELDS.has(normalized);
}

export function isHealthSensitiveFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return HEALTH_FIELDS.has(normalized);
}

export function isLegalHrSensitiveFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return LEGAL_HR_FIELDS.has(normalized);
}

export function isHrSensitiveFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return (
    HR_SENSITIVE_FIELDS.has(normalized) ||
    isLegalHrSensitiveFieldName(fieldName) ||
    isHealthSensitiveFieldName(fieldName)
  );
}

export function isPersonalFieldName(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  return PERSONAL_FIELDS.has(normalized);
}

export function isSensitiveFieldName(fieldName: string): boolean {
  return (
    isSecretFieldName(fieldName) ||
    isPayrollSensitiveFieldName(fieldName) ||
    isHealthSensitiveFieldName(fieldName) ||
    isLegalHrSensitiveFieldName(fieldName) ||
    isHrSensitiveFieldName(fieldName) ||
    isPersonalFieldName(fieldName)
  );
}

// ── Value classifier ──────────────────────────────────────────────────────────

export function classifyDataSensitivity(
  fieldNameOrContext: string,
): SecurityDataSensitivity {
  if (isSecretFieldName(fieldNameOrContext)) return "secret";
  if (isPayrollSensitiveFieldName(fieldNameOrContext)) return "payroll_sensitive";
  if (isHealthSensitiveFieldName(fieldNameOrContext)) return "health_sensitive";
  if (isLegalHrSensitiveFieldName(fieldNameOrContext)) return "legal_sensitive";
  if (isHrSensitiveFieldName(fieldNameOrContext)) return "hr_sensitive";
  if (isPersonalFieldName(fieldNameOrContext)) return "personal";
  return "internal";
}

// ── Route default sensitivity ─────────────────────────────────────────────────

const ROUTE_SENSITIVITY_MAP: Record<string, SecurityDataSensitivity> = {
  "pierre.cockpit.snapshot": "hr_sensitive",
  "pierre.use.submit": "hr_sensitive",
  "pierre.use.mission": "hr_sensitive",
  "pierre.use.task": "hr_sensitive",
  "pierre.use.employees": "hr_sensitive",
  "pierre.use.cloneadn": "hr_sensitive",
  "pierre.use.email": "personal",
  "pierre.use.doc": "hr_sensitive",
  "pierre.use.pdf": "hr_sensitive",
  "pierre.use.audit-trail": "internal",
  "pierre.security.export": "hr_sensitive",
  "pierre.security.purge": "hr_sensitive",
  "pierre.security.audit": "internal",
  "pierre.cron": "internal",
  "billing.activate": "internal",
  "checkout": "personal",
};

export function getDefaultSensitivityForRoute(routeId: string): SecurityDataSensitivity {
  for (const [key, sensitivity] of Object.entries(ROUTE_SENSITIVITY_MAP)) {
    if (routeId.startsWith(key) || routeId === key) return sensitivity;
  }
  return "internal";
}
