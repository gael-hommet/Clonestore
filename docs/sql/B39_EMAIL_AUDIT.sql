-- B39 — Email audit log schema (Supabase)
-- Optional: default provider is in-memory (memory). Supabase opt-in via EMAIL_AUDIT_PROVIDER=supabase.
-- Run this SQL in Supabase SQL editor to activate persistent email audit.
-- RLS enabled — service role only for writes.

-- ── Email audit events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cloneos_email_audit_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type           TEXT NOT NULL,
  audit_ref            TEXT NOT NULL UNIQUE,
  timestamp            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_id           UUID NOT NULL,
  user_id              UUID,
  mission_id           UUID,
  mode                 TEXT NOT NULL,    -- mock | dry_run | sandbox | live
  authorization_status TEXT NOT NULL,    -- allowed | blocked_* | allowed_dry_run | ...
  recipient_count      INTEGER NOT NULL DEFAULT 0,
  -- effective_recipients are stored as a hashed count only — never raw emails
  message_type         TEXT NOT NULL,
  is_sensitive         BOOLEAN NOT NULL DEFAULT FALSE,
  provider             TEXT NOT NULL,
  provider_message_id  TEXT,
  blocked_reason       TEXT,
  error                TEXT,
  -- Metadata fields never contain body, subject, or API keys
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_email_audit_company_id
  ON cloneos_email_audit_events (company_id);

CREATE INDEX IF NOT EXISTS idx_email_audit_user_id
  ON cloneos_email_audit_events (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_audit_mission_id
  ON cloneos_email_audit_events (mission_id)
  WHERE mission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_audit_authorization_status
  ON cloneos_email_audit_events (authorization_status);

CREATE INDEX IF NOT EXISTS idx_email_audit_timestamp
  ON cloneos_email_audit_events (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_email_audit_is_sensitive
  ON cloneos_email_audit_events (is_sensitive)
  WHERE is_sensitive = TRUE;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE cloneos_email_audit_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_full_access"
  ON cloneos_email_audit_events
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- No public/anon access — audit data is internal only
-- company_id-scoped reads can be added later for DRH dashboards

-- ── Monitoring views ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_email_daily_send_by_company AS
SELECT
  company_id,
  DATE_TRUNC('day', timestamp)   AS day,
  authorization_status,
  COUNT(*)                        AS event_count,
  SUM(CASE WHEN event_type = 'send_allowed'  THEN 1 ELSE 0 END) AS sent_count,
  SUM(CASE WHEN event_type = 'send_blocked'  THEN 1 ELSE 0 END) AS blocked_count,
  SUM(CASE WHEN is_sensitive = TRUE          THEN 1 ELSE 0 END) AS sensitive_count
FROM cloneos_email_audit_events
GROUP BY company_id, day, authorization_status;

CREATE OR REPLACE VIEW v_email_blocked_events AS
SELECT *
FROM cloneos_email_audit_events
WHERE event_type IN ('send_blocked', 'rate_limit_hit', 'recipient_blocked')
ORDER BY timestamp DESC;

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON TABLE cloneos_email_audit_events IS
  'B39 — Email audit log. Never contains full subject, body, or API keys. '
  'Supabase opt-in via EMAIL_AUDIT_PROVIDER=supabase.';
