-- ── Pierre Audit Trail — Indexes v1 ─────────────────────────────────────────
-- Supports Bloc 16 audit trail queries.
-- Run after pierre_governance_indexes_v1.sql.

-- pierre_task_logs — full audit trail (user + agent + date)
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_audit_user
  ON pierre_task_logs (user_id, agent_slug, created_at DESC);

-- pierre_task_logs — audit by event_type + user
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_audit_event
  ON pierre_task_logs (user_id, agent_slug, event_type, created_at DESC);

-- pierre_task_logs — audit by mission
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_audit_mission
  ON pierre_task_logs (mission_id, created_at DESC);

-- pierre_task_logs — audit by task
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_audit_task
  ON pierre_task_logs (task_id, created_at DESC);

-- pierre_tasks — status audit (user + agent + status + date)
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_audit_status
  ON pierre_tasks (user_id, agent_slug, status, created_at DESC);

-- pierre_tasks — mission audit (user + agent + mission)
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_audit_mission
  ON pierre_tasks (user_id, agent_slug, mission_id, created_at DESC);

-- pierre_missions — status audit
CREATE INDEX IF NOT EXISTS idx_pierre_missions_audit_status
  ON pierre_missions (user_id, agent_slug, status, created_at DESC);

-- pierre_documents — mission audit
CREATE INDEX IF NOT EXISTS idx_pierre_documents_audit_mission
  ON pierre_documents (user_id, agent_slug, mission_id, created_at DESC);
