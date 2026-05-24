// src/lib/cloneos/files/types.ts
// B34 — File & Document Intake Layer — all shared types.

export type FileKind =
  | "pdf"
  | "docx"
  | "doc"
  | "xlsx"
  | "csv"
  | "image"
  | "text"
  | "email_attachment"
  | "unknown";

export type FileSource =
  | "upload"
  | "email_attachment"
  | "channel_attachment"
  | "generated_artifact"
  | "imported_template"
  | "manual_record"
  | "api"
  | "other";

export type FileStatus =
  | "received"
  | "validating"
  | "rejected"
  | "accepted"
  | "extracting"
  | "extracted"
  | "classified"
  | "attached"
  | "ready"
  | "failed"
  | "archived";

export type FileRiskLevel = "low" | "medium" | "high" | "sensitive" | "blocked";

export type FileVisibility =
  | "internal"
  | "employee_related"
  | "manager_visible"
  | "client_visible"
  | "restricted";

export type HrFileCategory =
  | "cv"
  | "contract"
  | "amendment"
  | "absence_proof"
  | "sick_leave"
  | "identity_document"
  | "certificate"
  | "policy"
  | "procedure"
  | "job_description"
  | "interview_report"
  | "training_document"
  | "payroll_export"
  | "payroll_variable"
  | "onboarding_document"
  | "offboarding_document"
  | "employee_file"
  | "legal_sensitive"
  | "other";

export type FileExtractionStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "not_supported";

export type FileRuntimeMode = "mock" | "disabled" | "local" | "production";

export type FileEventType =
  | "file_received"
  | "file_rejected"
  | "file_accepted"
  | "file_extraction_started"
  | "file_extracted"
  | "file_extraction_failed"
  | "file_classified"
  | "file_attached"
  | "file_sensitive_detected"
  | "file_blocked"
  | "file_archived";

export type FileAttachAction =
  | "attach_to_mission"
  | "attach_to_task"
  | "attach_to_employee"
  | "create_new_mission"
  | "ask_for_more_info"
  | "block_sensitive"
  | "archive_only";

// ── Core record ───────────────────────────────────────────────────────────────

export type CloneFileRecord = {
  id: string;
  company_id: string;
  agent_slug: string;
  source: FileSource;
  kind: FileKind;
  original_filename: string;
  safe_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_bucket: string | null;
  storage_path: string | null;
  checksum_sha256: string | null;
  status: FileStatus;
  risk_level: FileRiskLevel;
  visibility: FileVisibility;
  uploaded_by_user_id: string | null;
  channel_identity_id: string | null;
  envelope_id: string | null;
  related_mission_id: string | null;
  related_task_id: string | null;
  related_employee_id: string | null;
  site_id: string | null;
  category: HrFileCategory;
  title: string | null;
  extracted_text_preview: string | null;
  extraction_status: FileExtractionStatus;
  extraction_error: string | null;
  classification_confidence: number;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
};

// ── Extraction result ─────────────────────────────────────────────────────────

export type FileExtractionResult = {
  ok: boolean;
  text: string | null;
  preview: string | null;
  page_count: number | null;
  word_count: number | null;
  table_count: number | null;
  detected_dates: string[];
  detected_people: string[];
  detected_companies: string[];
  detected_amounts: string[];
  warnings: string[];
  error: string | null;
};

// ── Classification result ─────────────────────────────────────────────────────

export type FileClassificationResult = {
  category: HrFileCategory;
  confidence: number;
  risk_level: FileRiskLevel;
  visibility: FileVisibility;
  suggested_links: { type: "mission" | "task" | "employee" | "template"; reason: string }[];
  missing_info: string[];
  warnings: string[];
  reason: string;
};

// ── Attach decision ───────────────────────────────────────────────────────────

export type FileAttachDecision = {
  action: FileAttachAction;
  related_mission_id: string | null;
  related_task_id: string | null;
  related_employee_id: string | null;
  reason: string;
  approval_required: boolean;
};

// ── Trace event ───────────────────────────────────────────────────────────────

export type CloneFileEvent = {
  id: string;
  file_id: string;
  company_id: string;
  event_type: FileEventType;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
};

// ── Intake validation ─────────────────────────────────────────────────────────

export type FileSecurityDecision = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  risk_level: FileRiskLevel;
};

// ── Intake result ─────────────────────────────────────────────────────────────

export type FileIntakeResult = {
  ok: boolean;
  file: CloneFileRecord;
  extraction: FileExtractionResult | null;
  classification: FileClassificationResult | null;
  attach_decision: FileAttachDecision | null;
  trace_events: CloneFileEvent[];
  blocked_reason: string | null;
  warnings: string[];
  error: string | null;
};
