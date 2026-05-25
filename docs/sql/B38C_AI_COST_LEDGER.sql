-- docs/sql/B38C_AI_COST_LEDGER.sql
-- B38C — Supabase AI Cost Ledger
-- Tables: cloneos_ai_cost_events, cloneos_ai_budget_policies
-- Service role access required for inserts (bypasses RLS).
-- Anon/authenticated read is RLS-gated by company_id / user_id.
-- See: src/lib/cloneos/ai/cost-ledger/

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── cloneos_ai_cost_events ────────────────────────────────────────────────────
-- One row per AI call lifecycle event: estimated → actual | blocked | failed.
-- Never stores prompts, completions, or API keys. Metadata is redacted by default.

CREATE TABLE IF NOT EXISTS cloneos_ai_cost_events (
  id                         TEXT        PRIMARY KEY,          -- b38c_supa_<ts>_<n>
  organization_id            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id                 TEXT        NOT NULL,
  user_id                    TEXT        NOT NULL,
  agent_slug                 TEXT        NOT NULL,
  employee_slug              TEXT,
  mission_id                 TEXT,
  task_id                    TEXT,
  request_id                 TEXT,

  -- AI provider & model
  provider                   TEXT        NOT NULL,             -- openai | anthropic | mock
  model                      TEXT        NOT NULL,             -- gpt-4o | claude-3-5-sonnet | …
  model_profile              TEXT,                             -- fast | premium | …

  -- Use case & access
  use_case                   TEXT        NOT NULL,             -- hr_analysis | doc_review | …
  access_level               TEXT        NOT NULL,             -- free | starter | premium | …

  -- Shield audit
  cost_shield_decision_status TEXT,                            -- allowed | blocked | estimated_only | …

  -- Lifecycle status
  status                     TEXT        NOT NULL              -- estimated | actual | blocked | failed | refunded | adjusted
    CHECK (status IN ('estimated', 'actual', 'blocked', 'failed', 'refunded', 'adjusted')),

  -- Token counts
  input_tokens               INTEGER     NOT NULL DEFAULT 0,
  output_tokens              INTEGER     NOT NULL DEFAULT 0,
  total_tokens               INTEGER     NOT NULL DEFAULT 0,

  -- Cost (in US cents, integer)
  estimated_cost_cents       INTEGER     NOT NULL DEFAULT 0,
  actual_cost_cents          INTEGER     NOT NULL DEFAULT 0,
  currency                   TEXT        NOT NULL DEFAULT 'USD',

  -- Flags
  is_live                    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_demo                    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_public                  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_paid_customer           BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Redacted metadata (no prompts, no completions, no keys)
  metadata                   JSONB       NOT NULL DEFAULT '{}',

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_company_id
  ON cloneos_ai_cost_events (company_id);

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_user_id
  ON cloneos_ai_cost_events (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_agent_slug
  ON cloneos_ai_cost_events (agent_slug);

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_created_at
  ON cloneos_ai_cost_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_status
  ON cloneos_ai_cost_events (status);

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_provider
  ON cloneos_ai_cost_events (provider);

CREATE INDEX IF NOT EXISTS idx_ai_cost_events_company_created
  ON cloneos_ai_cost_events (company_id, created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE cloneos_ai_cost_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by server-side ledger writes)
-- Authenticated users can read their own company's events
CREATE POLICY "company_read_own_events" ON cloneos_ai_cost_events
  FOR SELECT
  TO authenticated
  USING (company_id = (auth.jwt() ->> 'company_id'));

-- Superadmin policy (optional — gate behind a custom claim)
-- CREATE POLICY "superadmin_read_all" ON cloneos_ai_cost_events
--   FOR SELECT
--   TO authenticated
--   USING ((auth.jwt() ->> 'role') = 'superadmin');

-- ── cloneos_ai_budget_policies ────────────────────────────────────────────────
-- Per-company or global budget caps. Read by the Cost Shield at eval time.

CREATE TABLE IF NOT EXISTS cloneos_ai_budget_policies (
  id                         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope                      TEXT        NOT NULL              -- global | company | user | agent
    CHECK (scope IN ('global', 'company', 'user', 'agent')),
  scope_key                  TEXT        NOT NULL,             -- "*" | company_id | user_id | agent_slug

  daily_cap_cents            INTEGER     NOT NULL DEFAULT 300,
  monthly_cap_cents          INTEGER     NOT NULL DEFAULT 1000,

  -- Which access levels this policy governs (null = all)
  access_levels              TEXT[],

  -- Enforcement
  fail_closed                BOOLEAN     NOT NULL DEFAULT FALSE,
  enabled                    BOOLEAN     NOT NULL DEFAULT TRUE,

  notes                      TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (scope, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_budget_policies_scope_key
  ON cloneos_ai_budget_policies (scope, scope_key);

ALTER TABLE cloneos_ai_budget_policies ENABLE ROW LEVEL SECURITY;

-- Only service role can write policies
CREATE POLICY "service_role_manage_policies" ON cloneos_ai_budget_policies
  FOR ALL
  TO service_role
  USING (TRUE);

-- ── Seed: default global policy ───────────────────────────────────────────────

INSERT INTO cloneos_ai_budget_policies (scope, scope_key, daily_cap_cents, monthly_cap_cents, notes)
VALUES ('global', '*', 300, 1000, 'Default global cap — B38C baseline')
ON CONFLICT (scope, scope_key) DO NOTHING;

-- ── Helper view: daily spend per company ──────────────────────────────────────

CREATE OR REPLACE VIEW v_ai_daily_spend_by_company AS
SELECT
  company_id,
  DATE(created_at) AS spend_date,
  SUM(actual_cost_cents)    AS actual_cents,
  SUM(estimated_cost_cents) AS estimated_cents,
  COUNT(*)                  AS event_count,
  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_count
FROM cloneos_ai_cost_events
GROUP BY company_id, DATE(created_at);

-- ── Helper view: monthly spend global ────────────────────────────────────────

CREATE OR REPLACE VIEW v_ai_monthly_spend_global AS
SELECT
  TO_CHAR(created_at, 'YYYY-MM') AS month,
  SUM(actual_cost_cents)          AS actual_cents,
  SUM(estimated_cost_cents)       AS estimated_cents,
  COUNT(*)                        AS event_count,
  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_count,
  COUNT(*) FILTER (WHERE is_live = TRUE)     AS live_count
FROM cloneos_ai_cost_events
GROUP BY TO_CHAR(created_at, 'YYYY-MM');
