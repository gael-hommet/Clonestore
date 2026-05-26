// src/lib/pierre/email/pierre-email-policy.ts
// B39 — Pierre email authorization policy.
// Maps Pierre use-cases and access levels to EmailSendContext decisions.
// Pure: no async, no DB, no AI calls, no env reads.

import type { EmailSendContext, EmailAccessLevel, EmailMessageType } from "@/lib/cloneos/channels/email-production/types";

// ── Pierre email use-cases ────────────────────────────────────────────────────

export type PierreEmailUseCase =
  | "hr_notification"           // routine notification (paie, congé confirmé)
  | "hr_communication"          // communication RH (avenant, plan d'intégration)
  | "onboarding_email"          // mail d'accueil nouveau collaborateur
  | "document_delivery"         // livraison de document (contrat, attestation)
  | "candidate_update"          // mise à jour candidat
  | "absence_followup"          // suivi absence / arrêt maladie
  | "prepayroll_alert"          // alerte pré-paie
  | "sensitive_hr"              // licenciement, discipline, contentieux
  | "internal_alert"            // alerte interne équipe RH
  | "executive_report_delivery" // livraison rapport dirigeant
  | "demo_static";              // démo publique — jamais de vrai email

// ── Use-case → message type mapping ──────────────────────────────────────────

const USE_CASE_MESSAGE_TYPE: Record<PierreEmailUseCase, EmailMessageType> = {
  hr_notification:           "notification",
  hr_communication:          "hr_communication",
  onboarding_email:          "hr_communication",
  document_delivery:         "document",
  candidate_update:          "notification",
  absence_followup:          "hr_communication",
  prepayroll_alert:          "internal_alert",
  sensitive_hr:              "sensitive",
  internal_alert:            "internal_alert",
  executive_report_delivery: "document",
  demo_static:               "other",
};

// ── Access level mapping ──────────────────────────────────────────────────────

const PIERRE_ACCESS_LEVEL_MAP: Record<string, EmailAccessLevel> = {
  anonymous:      "anonymous",
  logged_unpaid:  "logged_unpaid",
  trial:          "trial",
  paid_customer:  "paid_customer",
  internal_admin: "internal_admin",
};

// ── Always-sensitive use cases ────────────────────────────────────────────────

const ALWAYS_SENSITIVE_USE_CASES: Set<PierreEmailUseCase> = new Set([
  "sensitive_hr",
]);

// ── Always-requires-approval use cases ───────────────────────────────────────

const ALWAYS_REQUIRES_APPROVAL: Set<PierreEmailUseCase> = new Set([
  "sensitive_hr",
  "document_delivery",
  "executive_report_delivery",
]);

// ── Official document use cases ───────────────────────────────────────────────

const OFFICIAL_DOCUMENT_USE_CASES: Set<PierreEmailUseCase> = new Set([
  "document_delivery",
  "executive_report_delivery",
]);

// ── Main context builder ──────────────────────────────────────────────────────

export type BuildPierreEmailContextParams = {
  company_id: string;
  user_id: string | null;
  access_level: string;
  use_case: PierreEmailUseCase;
  mission_id?: string | null;
  task_id?: string | null;
  employee_id?: string | null;
  override_sensitive?: boolean;
  override_approval_required?: boolean;
};

export function buildPierreEmailContext(
  params: BuildPierreEmailContextParams,
): EmailSendContext {
  const {
    company_id,
    user_id,
    access_level,
    use_case,
    mission_id = null,
    task_id = null,
    employee_id = null,
    override_sensitive,
    override_approval_required,
  } = params;

  const message_type = USE_CASE_MESSAGE_TYPE[use_case] ?? "other";
  const is_sensitive = override_sensitive ?? ALWAYS_SENSITIVE_USE_CASES.has(use_case);
  const is_official_document = OFFICIAL_DOCUMENT_USE_CASES.has(use_case);
  const approval_required =
    override_approval_required ?? ALWAYS_REQUIRES_APPROVAL.has(use_case) ?? is_sensitive;

  const mapped_access_level: EmailAccessLevel =
    PIERRE_ACCESS_LEVEL_MAP[access_level] ?? "logged_unpaid";

  return {
    company_id,
    user_id,
    access_level: mapped_access_level,
    mission_id,
    task_id,
    employee_id,
    message_type,
    is_sensitive,
    is_official_document,
    approval_required,
  };
}

// ── Guards ────────────────────────────────────────────────────────────────────

export function isPierreEmailUseCase(value: string): value is PierreEmailUseCase {
  return value in USE_CASE_MESSAGE_TYPE;
}

export function pierreEmailRequiresApproval(use_case: PierreEmailUseCase): boolean {
  return ALWAYS_REQUIRES_APPROVAL.has(use_case);
}

export function pierreEmailIsSensitive(use_case: PierreEmailUseCase): boolean {
  return ALWAYS_SENSITIVE_USE_CASES.has(use_case);
}

export function pierreEmailIsAllowedForAccessLevel(
  use_case: PierreEmailUseCase,
  access_level: string,
): boolean {
  if (use_case === "demo_static") return false; // never a real email
  const blocked = new Set(["anonymous", "logged_unpaid", "trial"]);
  return !blocked.has(access_level);
}

// ── All use cases list ────────────────────────────────────────────────────────

export function listPierreEmailUseCases(): PierreEmailUseCase[] {
  return Object.keys(USE_CASE_MESSAGE_TYPE) as PierreEmailUseCase[];
}
