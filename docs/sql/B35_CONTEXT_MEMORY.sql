-- B35 — Pierre Memory & Context Layer — Proposed DB Schema
-- DO NOT EXECUTE: documentation only. Run manually after review.
-- Context packs are ephemeral by design — built on demand, not stored long-term.
-- Only signals flagged for persistence (e.g. persistent validation gates) should be stored.

-- ── pierre_context_signals ────────────────────────────────────────────────────
-- Optional persistence for signals that outlive a single request.
-- Most signals are built in-memory and never stored (ephemeral).

CREATE TABLE IF NOT EXISTS pierre_context_signals (
  id                      TEXT PRIMARY KEY,               -- sig_...
  company_id              TEXT NOT NULL REFERENCES companies(id),
  agent_slug              TEXT NOT NULL DEFAULT 'pierre',
  scope                   TEXT NOT NULL,                  -- company|employee|mission|task|file|channel|history|rules|validation|risk|preference|adn
  source                  TEXT NOT NULL,                  -- company_memory|clone_adn|employee_profile|mission_record|task_record|file_record|channel_identity|audit_log|inferred|heuristic|default
  type                    TEXT NOT NULL,                  -- identity|status|risk_flag|preference|rule|validation_gate|history_event|missing_info|recommendation|constraint|capability|relationship
  priority                TEXT NOT NULL DEFAULT 'medium', -- critical|high|medium|low|informational
  risk                    TEXT NOT NULL DEFAULT 'none',   -- blocked|sensitive|high|medium|low|none
  title                   TEXT NOT NULL,
  content                 TEXT NOT NULL,
  confidence              FLOAT NOT NULL DEFAULT 0.8,
  relevance_score         FLOAT NOT NULL DEFAULT 0.5,
  freshness_score         FLOAT NOT NULL DEFAULT 1.0,
  related_employee_id     TEXT,
  related_mission_id      TEXT,
  related_task_id         TEXT,
  related_file_id         TEXT,
  related_channel_id      TEXT,
  related_document_id     TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ctx_signals_company   ON pierre_context_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_ctx_signals_scope     ON pierre_context_signals(scope, company_id);
CREATE INDEX IF NOT EXISTS idx_ctx_signals_type      ON pierre_context_signals(type);
CREATE INDEX IF NOT EXISTS idx_ctx_signals_risk      ON pierre_context_signals(risk) WHERE risk != 'none';
CREATE INDEX IF NOT EXISTS idx_ctx_signals_employee  ON pierre_context_signals(related_employee_id) WHERE related_employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ctx_signals_mission   ON pierre_context_signals(related_mission_id) WHERE related_mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ctx_signals_expires   ON pierre_context_signals(expires_at) WHERE expires_at IS NOT NULL;

-- ── pierre_context_packs ──────────────────────────────────────────────────────
-- Optional: store context pack snapshots for audit trail / replay.
-- In most deployments, packs are built on-demand and NOT stored.

CREATE TABLE IF NOT EXISTS pierre_context_packs (
  id                        TEXT PRIMARY KEY,             -- ctx_...
  company_id                TEXT NOT NULL REFERENCES companies(id),
  agent_slug                TEXT NOT NULL DEFAULT 'pierre',
  built_for                 TEXT NOT NULL,                -- "pierre_brain", "task_runner", etc.
  employee_id               TEXT,
  mission_id                TEXT,
  task_id                   TEXT,
  file_id                   TEXT,
  channel_identity_id       TEXT,
  signal_count              INT NOT NULL DEFAULT 0,
  risk_summary              TEXT,
  validation_summary        TEXT,
  recommended_next_action   TEXT,
  should_require_validation BOOLEAN NOT NULL DEFAULT false,
  missing_info              JSONB NOT NULL DEFAULT '[]',
  metadata                  JSONB NOT NULL DEFAULT '{}',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctx_packs_company    ON pierre_context_packs(company_id);
CREATE INDEX IF NOT EXISTS idx_ctx_packs_employee   ON pierre_context_packs(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ctx_packs_mission    ON pierre_context_packs(mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ctx_packs_created    ON pierre_context_packs(created_at DESC);
