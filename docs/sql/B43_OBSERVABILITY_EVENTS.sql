-- B43 — Observability events: SQL schema for persistent storage
-- Currently Pierre uses in-memory sinks.
-- This schema can be used to add Supabase persistence later.

-- ── Observable events table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pierre_observable_events (
  id                TEXT        PRIMARY KEY,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id    TEXT        NOT NULL,
  causation_id      TEXT,
  company_id        UUID,
  user_id           UUID,
  agent_slug        TEXT        NOT NULL DEFAULT 'pierre',
  mission_id        UUID,
  task_id           UUID,
  domain            TEXT        NOT NULL,
  event_type        TEXT        NOT NULL,
  status            TEXT        NOT NULL,
  severity          TEXT        NOT NULL,
  message           TEXT        NOT NULL,
  safe_user_message TEXT,
  error_code        TEXT,
  retry_count       INTEGER     NOT NULL DEFAULT 0,
  max_retries       INTEGER     NOT NULL DEFAULT 0,
  metadata_redacted JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indices ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_observable_events_correlation_id
  ON pierre_observable_events (correlation_id);

CREATE INDEX IF NOT EXISTS idx_observable_events_company_id
  ON pierre_observable_events (company_id);

CREATE INDEX IF NOT EXISTS idx_observable_events_domain_severity
  ON pierre_observable_events (domain, severity);

CREATE INDEX IF NOT EXISTS idx_observable_events_created_at
  ON pierre_observable_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_observable_events_status
  ON pierre_observable_events (status);

-- ── Dead letter table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pierre_dead_letters (
  id               TEXT        PRIMARY KEY,
  correlation_id   TEXT        NOT NULL,
  domain           TEXT        NOT NULL,
  resource_type    TEXT        NOT NULL,
  resource_id      TEXT,
  error_code       TEXT        NOT NULL,
  severity         TEXT        NOT NULL,
  retry_count      INTEGER     NOT NULL DEFAULT 0,
  payload_redacted JSONB       NOT NULL DEFAULT '{}',
  reason           TEXT        NOT NULL,
  resolved         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dead_letters_unresolved
  ON pierre_dead_letters (resolved, created_at DESC)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_dead_letters_domain
  ON pierre_dead_letters (domain);

CREATE INDEX IF NOT EXISTS idx_dead_letters_error_code
  ON pierre_dead_letters (error_code);

-- ── RLS policies ──────────────────────────────────────────────────────────────

-- Events: accessible only via service role (never from client)
ALTER TABLE pierre_observable_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_direct_access_observable_events"
  ON pierre_observable_events
  FOR ALL
  USING (FALSE);

-- Dead letters: accessible only via service role
ALTER TABLE pierre_dead_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_direct_access_dead_letters"
  ON pierre_dead_letters
  FOR ALL
  USING (FALSE);

-- ── Retention: auto-delete events older than 90 days ─────────────────────────
-- To be run as a scheduled job / Supabase cron:
-- DELETE FROM pierre_observable_events WHERE created_at < NOW() - INTERVAL '90 days';
-- DELETE FROM pierre_dead_letters WHERE resolved = TRUE AND resolved_at < NOW() - INTERVAL '30 days';

-- ── Notes ─────────────────────────────────────────────────────────────────────
-- 1. company_id is UUID to match the existing companies table.
-- 2. metadata_redacted is JSONB — never store raw prompts, API keys, or email bodies.
-- 3. severity values: debug | info | warning | error | critical
-- 4. status values: started | succeeded | failed | blocked | retried | degraded | skipped | dead_lettered
-- 5. domain values: ai | email | workflow | task | mission | cockpit | security | rgpd | billing | document | pdf | memory | channel | system
