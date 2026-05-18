-- ── Pierre Governance Runtime — Indexes v1 ───────────────────────────────────
-- Supports ClonePolicy, CloneTrust, and Governance audit trail queries.
-- Run after pierre_cloneguard_indexes_v1.sql.

-- pierre_task_logs — governance event_type lookup
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_gov_event
  ON pierre_task_logs (user_id, agent_slug, event_type, created_at DESC)
  WHERE event_type IN (
    'governance_evaluation',
    'governance_execution_blocked',
    'governance_auto_allowed',
    'governance_continuity_blocked',
    'clonepolicy_evaluation',
    'clonepolicy_blocked',
    'clonetrust_evaluation',
    'clonetrust_hard_block',
    'clonetrust_auto_allowed',
    'mission_control_briefing_generated',
    'mission_control_run_safe_started',
    'mission_control_run_safe_completed'
  );

-- pierre_task_logs — governance audit trail (recent events per user)
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_gov_user_recent
  ON pierre_task_logs (user_id, agent_slug, created_at DESC);

-- pierre_tasks — governance gate: approval_required flag + status
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_gov_approval
  ON pierre_tasks (user_id, agent_slug, approval_required, status, created_at DESC);

-- pierre_tasks — governance gate: type + status for auto-execution eligibility
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_gov_type_status
  ON pierre_tasks (user_id, agent_slug, type, status, created_at DESC);

-- pierre_missions — governance risk level lookup
CREATE INDEX IF NOT EXISTS idx_pierre_missions_gov_risk
  ON pierre_missions (user_id, agent_slug, risk_level, status, created_at DESC);

-- pierre_missions — governance: approval_required flag
CREATE INDEX IF NOT EXISTS idx_pierre_missions_gov_approval
  ON pierre_missions (user_id, agent_slug, approval_required, status, created_at DESC);

-- pierre_company_memory — governance context lookup (singleton per user)
CREATE INDEX IF NOT EXISTS idx_pierre_company_memory_gov_user
  ON pierre_company_memory (user_id, agent_slug, updated_at DESC);
