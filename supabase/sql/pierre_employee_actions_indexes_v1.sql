-- Pierre HR Engine — Employee Actions Indexes (Bloc 17)
-- Safe to run multiple times: all indexes use IF NOT EXISTS

-- Tasks by action_type in payload_json (for employee action queries)
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_action_type
  ON pierre_tasks USING gin (payload_json jsonb_path_ops);

-- Tasks by employee_id in payload_json
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_employee_payload
  ON pierre_tasks USING gin ((payload_json -> 'employee_id'));

-- Tasks by employee_context.employee_id in payload_json
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_employee_context_payload
  ON pierre_tasks USING gin ((payload_json -> 'employee_context'));

-- Tasks by user + agent + status (for employee actions filtering)
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_employee_actions_status
  ON pierre_tasks (user_id, agent_slug, status, created_at DESC);

-- Logs for employee_action events
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_employee_action
  ON pierre_task_logs USING gin ((meta_json -> 'employee_id'));

-- Logs by event_type for action-specific queries
CREATE INDEX IF NOT EXISTS idx_pierre_task_logs_action_event
  ON pierre_task_logs (user_id, agent_slug, event_type, created_at DESC);

-- Company memory for employee lookups
CREATE INDEX IF NOT EXISTS idx_pierre_company_memory_user
  ON pierre_company_memory (user_id, agent_slug);

-- Tasks with action_domain tag
CREATE INDEX IF NOT EXISTS idx_pierre_tasks_action_domain
  ON pierre_tasks USING gin ((payload_json -> 'action_domain'));
