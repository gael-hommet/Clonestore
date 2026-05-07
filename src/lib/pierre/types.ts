// src/lib/pierre/types.ts
// Source de vérité TypeScript alignée sur le schéma Supabase réel Pierre.
// Base constatée le 7 mai 2026.

export const PIERRE_AGENT_SLUG = "pierre" as const;

export type PierreAgentSlug = typeof PIERRE_AGENT_SLUG;

// =========================================================
// Enums DB Supabase réels
// =========================================================

export type PierreUnderstandingStatus =
  | "understood"
  | "partially_understood"
  | "missing_info"
  | "out_of_scope";

export type PierreRiskLevel = "low" | "medium" | "high";

export type PierreMissionStatus =
  | "draft"
  | "active"
  | "awaiting_info"
  | "awaiting_approval"
  | "scheduled"
  | "done"
  | "blocked"
  | "cancelled"
  | "error";

export type PierreTaskStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "awaiting_approval"
  | "running"
  | "done"
  | "blocked"
  | "retry"
  | "error"
  | "cancelled";

export type PierreTaskType =
  | "email.send"
  | "email.draft"
  | "doc.generate"
  | "doc.rewrite"
  | "pdf.generate"
  | "reminder.create"
  | "followup.schedule";

export type PierreEmailStatus =
  | "draft"
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

// =========================================================
// Types métier normalisés
// =========================================================

export type PierreLanguage = "fr" | "en" | "unknown";

export type PierreTone =
  | "neutral"
  | "professional"
  | "human"
  | "warm"
  | "direct"
  | "firm"
  | "formal"
  | "unknown";

export type PierreApprovalMode =
  | "none"
  | "recommended"
  | "required"
  | "blocked";

export type PierreClassification =
  | "recruitment"
  | "application"
  | "convocation"
  | "candidate_refusal"
  | "candidate_followup"
  | "onboarding"
  | "internal_hr_communication"
  | "procedure_reminder"
  | "hr_note"
  | "interview_summary"
  | "simple_hr_letter"
  | "document_request"
  | "planning"
  | "followup_mission"
  | "internal_followup"
  | "external_followup"
  | "sensitive_request"
  | "out_of_scope"
  | "unknown";

export type PierreEntityHints = {
  recipient_name?: string | null;
  recipient_email?: string | null;
  candidate_name?: string | null;
  manager_name?: string | null;
  position_title?: string | null;
  document_title?: string | null;
  company_name?: string | null;
  date?: string | null;
  time?: string | null;
  location?: string | null;
};

export type PierreMissingFieldCode =
  | "recipient_name"
  | "recipient_email"
  | "candidate_name"
  | "position_title"
  | "document_title"
  | "date"
  | "time"
  | "location"
  | "context"
  | "validation_target"
  | "document_source"
  | "company_name";

export type PierreMissingInfoItem = {
  code: PierreMissingFieldCode;
  label: string;
  required: boolean;
  reason: string;
  question: string;
};

export type PierreOutputKind =
  | "document"
  | "email"
  | "pdf"
  | "followup"
  | "reminder"
  | "plan"
  | "none";

export type PierreTaskDraft = {
  title: string;
  type: PierreTaskType;
  description?: string | null;
  status: PierreTaskStatus;
  priority: number;
  approval_required: boolean;
  risk_level: PierreRiskLevel;
  execute_at: string | null;
  depends_on_json: unknown[];
  payload_json: Record<string, unknown>;
  output_kind?: PierreOutputKind;
};

export type PierreInterpretation = {
  request_text: string;
  normalized_text: string;
  language: PierreLanguage;
  tone: PierreTone;
  classification: PierreClassification;
  secondary_classifications: PierreClassification[];
  intent: string;

  mission_summary: string;
  understanding_status: PierreUnderstandingStatus;

  risk_level: PierreRiskLevel;
  approval_mode: PierreApprovalMode;
  approval_required: boolean;

  out_of_scope: boolean;
  blocked: boolean;
  blocked_reason: string | null;

  mission_title: string;
  summary: string;

  immediate: boolean;
  planifiable: boolean;
  multi_action: boolean;

  missing_info: PierreMissingInfoItem[];
  entities: PierreEntityHints;
  tasks: PierreTaskDraft[];

  scheduled_for: string | null;
  suggested_reply: string | null;
};

// =========================================================
// Rows DB principales
// =========================================================

export type PierreMissionRow = {
  id: string;
  user_id: string;
  agent_slug: PierreAgentSlug | string;
  source: string;
  raw_input: string;
  mission_summary: string | null;
  intent: string | null;
  understanding_status: PierreUnderstandingStatus;
  risk_level: PierreRiskLevel;
  approval_required: boolean;
  status: PierreMissionStatus;
  missing_info_json: unknown[];
  brain_output_json: Record<string, unknown>;
  context_snapshot_json: Record<string, unknown>;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type PierreTaskRow = {
  id: string;
  mission_id: string;
  user_id: string;
  agent_slug: PierreAgentSlug | string;
  type: PierreTaskType;
  title: string;
  description: string | null;
  status: PierreTaskStatus;
  priority: number;
  approval_required: boolean;
  payload_json: Record<string, unknown>;
  result_json: Record<string, unknown>;
  depends_on_json: unknown[];
  execute_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  locked_by: string | null;
  locked_at: string | null;
};

export type PierreTaskLogRow = {
  id: string;
  task_id: string | null;
  mission_id: string | null;
  user_id: string;
  agent_slug: PierreAgentSlug | string;
  event_type: string;
  message: string | null;
  meta_json: Record<string, unknown>;
  created_at: string;
};

export type PierreDocumentRow = {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  user_id: string;
  agent_slug: PierreAgentSlug | string;
  doc_type: string;
  title: string;
  text_content: string | null;
  html_content: string | null;
  pdf_url: string | null;
  version_number: number;
  source_kind: string;
  tags_json: unknown[];
  created_at: string;
  updated_at: string;
};

export type PierreOutboundEmailRow = {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  user_id: string;
  agent_slug: PierreAgentSlug | string;
  to_json: unknown[];
  cc_json: unknown[];
  bcc_json: unknown[];
  subject: string;
  html_snapshot: string | null;
  text_snapshot: string | null;
  attachments_json: unknown[];
  sender_profile_json: Record<string, unknown>;
  provider_name: string | null;
  provider_message_id: string | null;
  status: PierreEmailStatus;
  scheduled_for: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type PierreCompanyMemoryRow = {
  id: string;
  user_id: string;
  agent_slug: PierreAgentSlug | string;
  company_name: string | null;
  preferred_tone: string | null;
  preferred_language: string | null;
  default_signature: string | null;
  validation_style: string | null;
  common_contacts_json: unknown[];
  document_preferences_json: Record<string, unknown>;
  email_sender_preferences_json: Record<string, unknown>;
  reusable_rh_context_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

// =========================================================
// Inserts / helpers
// =========================================================

export type PierreTaskLogInsert = {
  task_id?: string | null;
  mission_id?: string | null;
  user_id: string;
  agent_slug?: PierreAgentSlug | string;
  event_type: string;
  message?: string | null;
  meta_json?: Record<string, unknown>;
};

export type PierreCompanyMemoryLike = Partial<PierreCompanyMemoryRow> & {
  tone?: string | null;
  language?: string | null;
  rules?: string[] | null;
  preferences?: Record<string, unknown> | null;
  email_identity?: {
    sender_name?: string | null;
    sender_email?: string | null;
    reply_to?: string | null;
    provider?: string | null;
    domain_verified?: boolean | null;
    [key: string]: unknown;
  } | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type PierreInterpretInput = {
  text: string;
  companyMemory?: PierreCompanyMemoryLike | null;
  now?: Date;
};

// =========================================================
// Mappers sécurité entre ancien vocabulaire et DB réelle
// =========================================================

export function normalizePierreRiskLevel(value: unknown): PierreRiskLevel {
  if (value === "high" || value === "critical") return "high";
  if (value === "medium" || value === "sensitive") return "medium";
  return "low";
}

export function normalizePierreTaskStatus(value: unknown): PierreTaskStatus {
  if (value === "done" || value === "completed") return "done";
  if (value === "running" || value === "in_progress") return "running";
  if (value === "awaiting_approval" || value === "awaiting_validation") {
    return "awaiting_approval";
  }
  if (value === "scheduled" || value === "planned") return "scheduled";
  if (value === "ready" || value === "queued" || value === "pending") return "ready";
  if (value === "retry") return "retry";
  if (value === "blocked") return "blocked";
  if (value === "cancelled") return "cancelled";
  if (value === "error" || value === "failed") return "error";
  return "draft";
}

export function normalizePierreMissionStatus(value: unknown): PierreMissionStatus {
  if (value === "active" || value === "queued" || value === "in_progress") return "active";
  if (value === "awaiting_info") return "awaiting_info";
  if (value === "awaiting_approval" || value === "awaiting_validation") {
    return "awaiting_approval";
  }
  if (value === "scheduled" || value === "planned") return "scheduled";
  if (value === "done" || value === "completed") return "done";
  if (value === "blocked") return "blocked";
  if (value === "cancelled") return "cancelled";
  if (value === "error" || value === "failed") return "error";
  return "draft";
}