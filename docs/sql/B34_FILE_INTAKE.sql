-- B34 — Files & Document Intake Layer — Proposed DB Schema
-- DO NOT EXECUTE: documentation only. Run manually after review.
-- All tables are company_id-scoped (multi-tenant).

-- ── cloneos_files ─────────────────────────────────────────────────────────────
-- One row = one received file, any source.

CREATE TABLE IF NOT EXISTS cloneos_files (
  id                        TEXT PRIMARY KEY,               -- file_...
  company_id                TEXT NOT NULL REFERENCES companies(id),
  agent_slug                TEXT NOT NULL,                  -- "pierre"
  source                    TEXT NOT NULL,                  -- upload|email_attachment|channel_attachment|generated_artifact|imported_template|manual_record|api|other
  kind                      TEXT NOT NULL,                  -- pdf|docx|doc|xlsx|csv|image|text|email_attachment|unknown
  original_filename         TEXT NOT NULL,
  safe_filename             TEXT NOT NULL,
  mime_type                 TEXT NOT NULL,
  size_bytes                BIGINT NOT NULL,
  storage_bucket            TEXT,
  storage_path              TEXT,
  checksum_sha256           TEXT,
  status                    TEXT NOT NULL DEFAULT 'received', -- received|validating|rejected|accepted|extracting|extracted|classified|attached|ready|failed|archived
  risk_level                TEXT NOT NULL DEFAULT 'low',    -- low|medium|high|sensitive|blocked
  visibility                TEXT NOT NULL DEFAULT 'internal', -- internal|employee_related|manager_visible|client_visible|restricted
  uploaded_by_user_id       TEXT,
  channel_identity_id       TEXT REFERENCES channel_identities(id),
  envelope_id               TEXT REFERENCES message_envelopes(id),
  related_mission_id        TEXT,
  related_task_id           TEXT,
  related_employee_id       TEXT,
  site_id                   TEXT,
  category                  TEXT NOT NULL DEFAULT 'other',  -- HrFileCategory
  title                     TEXT,
  -- Extracted text NOT stored by default (privacy/RGPD). Only when FILE_LOG_EXTRACTED_TEXT=true.
  extracted_text_preview    TEXT,
  extraction_status         TEXT NOT NULL DEFAULT 'pending', -- pending|processing|done|failed|not_supported
  extraction_error          TEXT,
  classification_confidence FLOAT NOT NULL DEFAULT 0,
  metadata                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at               TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_files_company       ON cloneos_files(company_id);
CREATE INDEX IF NOT EXISTS idx_files_agent         ON cloneos_files(agent_slug);
CREATE INDEX IF NOT EXISTS idx_files_status        ON cloneos_files(status);
CREATE INDEX IF NOT EXISTS idx_files_category      ON cloneos_files(category, risk_level);
CREATE INDEX IF NOT EXISTS idx_files_mission       ON cloneos_files(related_mission_id) WHERE related_mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_employee      ON cloneos_files(related_employee_id) WHERE related_employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_envelope      ON cloneos_files(envelope_id) WHERE envelope_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_checksum      ON cloneos_files(checksum_sha256) WHERE checksum_sha256 IS NOT NULL;

-- ── cloneos_file_events ───────────────────────────────────────────────────────
-- Immutable audit trail for every file operation.

CREATE TABLE IF NOT EXISTS cloneos_file_events (
  id              TEXT PRIMARY KEY,   -- fevt_...
  file_id         TEXT NOT NULL REFERENCES cloneos_files(id),
  company_id      TEXT NOT NULL,
  event_type      TEXT NOT NULL,      -- file_received|file_rejected|file_accepted|file_extraction_started|file_extracted|file_extraction_failed|file_classified|file_attached|file_sensitive_detected|file_blocked|file_archived
  message         TEXT NOT NULL,
  meta            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_events_file    ON cloneos_file_events(file_id);
CREATE INDEX IF NOT EXISTS idx_file_events_company ON cloneos_file_events(company_id);
CREATE INDEX IF NOT EXISTS idx_file_events_type    ON cloneos_file_events(event_type);

-- ── cloneos_file_links ────────────────────────────────────────────────────────
-- Many-to-many links between files and Pierre entities (missions, tasks, employees).

CREATE TABLE IF NOT EXISTS cloneos_file_links (
  id              TEXT PRIMARY KEY,
  file_id         TEXT NOT NULL REFERENCES cloneos_files(id),
  company_id      TEXT NOT NULL,
  link_type       TEXT NOT NULL,      -- mission|task|employee|template|channel
  linked_id       TEXT NOT NULL,      -- ID of the linked entity
  linked_label    TEXT,               -- Human-readable label for the link
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_links_file     ON cloneos_file_links(file_id);
CREATE INDEX IF NOT EXISTS idx_file_links_linked   ON cloneos_file_links(link_type, linked_id);
CREATE INDEX IF NOT EXISTS idx_file_links_company  ON cloneos_file_links(company_id);
