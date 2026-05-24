-- B33 — Channel Identity Layer — Proposed DB Schema
-- DO NOT EXECUTE: documentation only. Run manually after review.
-- All tables are company_id-scoped (multi-tenant).

-- ── channel_identities ────────────────────────────────────────────────────────
-- Each row = one authorized contact point for one agent in one company.
-- Example: Pierre's email inbox for Acme Corp = one row.

CREATE TABLE IF NOT EXISTS channel_identities (
  id                              TEXT PRIMARY KEY,                        -- cid_...
  company_id                      TEXT NOT NULL REFERENCES companies(id),
  agent_slug                      TEXT NOT NULL,                           -- "pierre"
  channel_kind                    TEXT NOT NULL,                           -- email|phone|sms|voice|whatsapp|teams|slack|web_form|internal_inbox|other
  direction                       TEXT NOT NULL DEFAULT 'bidirectional',   -- inbound|outbound|bidirectional
  label                           TEXT NOT NULL,                           -- human-readable name
  address_or_identifier           TEXT NOT NULL,                           -- email address, phone number, webhook URL, etc.
  display_name                    TEXT,
  reply_to                        TEXT,
  signature                       TEXT,
  status                          TEXT NOT NULL DEFAULT 'draft',           -- draft|pending_verification|active|suspended|revoked|failed|archived
  verification_status             TEXT NOT NULL DEFAULT 'not_started',     -- not_started|pending|verified|failed|expired|revoked
  provider                        TEXT,                                    -- postmark|twilio|sendgrid|mock|etc.
  external_ref                    TEXT,                                    -- provider-side ID
  site_id                         TEXT,
  manager_id                      TEXT,                                    -- user who owns this channel
  allowed_sender_user_ids         JSONB NOT NULL DEFAULT '[]',             -- user IDs allowed to send from this channel
  allowed_recipient_patterns      JSONB NOT NULL DEFAULT '[]',             -- e.g. ["*@company.com"]
  forbidden_recipient_patterns    JSONB NOT NULL DEFAULT '[]',
  allowed_message_types           JSONB NOT NULL DEFAULT '[]',
  blocked_message_types           JSONB NOT NULL DEFAULT '[]',
  autonomy_level                  TEXT NOT NULL DEFAULT 'draft_only',      -- draft_only|low_risk_auto|validation_required|advanced_governed|custom_enterprise
  requires_human_validation_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  max_daily_sends                 INTEGER,
  max_hourly_sends                INTEGER,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at                     TIMESTAMPTZ,
  revoked_at                      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_channel_identities_company     ON channel_identities(company_id);
CREATE INDEX IF NOT EXISTS idx_channel_identities_agent       ON channel_identities(agent_slug);
CREATE INDEX IF NOT EXISTS idx_channel_identities_kind_status ON channel_identities(channel_kind, status);

-- ── message_envelopes ─────────────────────────────────────────────────────────
-- One row per message attempt (inbound or outbound).

CREATE TABLE IF NOT EXISTS message_envelopes (
  id                    TEXT PRIMARY KEY,                -- env_...
  company_id            TEXT NOT NULL REFERENCES companies(id),
  agent_slug            TEXT NOT NULL,
  channel_identity_id   TEXT NOT NULL REFERENCES channel_identities(id),
  direction             TEXT NOT NULL,                   -- inbound|outbound
  channel_kind          TEXT NOT NULL,
  "from"                TEXT NOT NULL,
  "to"                  JSONB NOT NULL DEFAULT '[]',
  cc                    JSONB NOT NULL DEFAULT '[]',
  bcc                   JSONB NOT NULL DEFAULT '[]',
  subject               TEXT,
  -- body_text and body_html are NULL unless CHANNEL_LOG_BODY=true (privacy guard)
  body_text             TEXT,
  body_html             TEXT,
  attachments           JSONB NOT NULL DEFAULT '[]',
  received_at           TIMESTAMPTZ,
  sent_at               TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'pending', -- pending|approved|sent|delivered|failed|blocked|draft|received
  risk_level            TEXT NOT NULL DEFAULT 'low',     -- low|medium|high|sensitive|blocked
  approval_required     BOOLEAN NOT NULL DEFAULT FALSE,
  related_mission_id    TEXT,
  related_task_id       TEXT,
  related_employee_id   TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_envelopes_company     ON message_envelopes(company_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_channel     ON message_envelopes(channel_identity_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_direction   ON message_envelopes(direction, status);
CREATE INDEX IF NOT EXISTS idx_envelopes_mission     ON message_envelopes(related_mission_id);

-- ── channel_trace_events ──────────────────────────────────────────────────────
-- Immutable audit log for every channel operation.

CREATE TABLE IF NOT EXISTS channel_trace_events (
  id                    TEXT PRIMARY KEY,                -- evt_...
  channel_identity_id   TEXT NOT NULL REFERENCES channel_identities(id),
  envelope_id           TEXT REFERENCES message_envelopes(id),
  event_type            TEXT NOT NULL,                   -- send_blocked|send_attempt|send_success|send_failed|approval_required|inbound_received
  message               TEXT NOT NULL,
  meta                  JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trace_events_channel  ON channel_trace_events(channel_identity_id);
CREATE INDEX IF NOT EXISTS idx_trace_events_envelope ON channel_trace_events(envelope_id);
CREATE INDEX IF NOT EXISTS idx_trace_events_type     ON channel_trace_events(event_type);
