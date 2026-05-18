-- =========================================================
-- Pierre / Mission Control — Indexes v1 (Bloc 13.1)
-- Objectif: requêtes Mission Control, run-safe, briefing
-- Cible: 100 000+ entreprises actives (non load-testé)
-- Compatible IF NOT EXISTS — idempotent
-- =========================================================

-- -------------------------
-- pierre_tasks — safe execution queue
-- -------------------------

-- Run-safe: filter status=ready/retry, no approval, per user+agent
create index if not exists idx_pierre_tasks_user_agent_status_approval
on public.pierre_tasks (user_id, agent_slug, status, approval_required);

-- Mission Control: sort by priority + created_at for queue building
create index if not exists idx_pierre_tasks_user_agent_priority_created_desc
on public.pierre_tasks (user_id, agent_slug, priority desc nulls last, created_at desc);

-- Schedule gate: tasks with execute_at set
create index if not exists idx_pierre_tasks_user_agent_execute_at
on public.pierre_tasks (user_id, agent_slug, execute_at)
where execute_at is not null;

-- Error investigation queue
create index if not exists idx_pierre_tasks_user_agent_status_error
on public.pierre_tasks (user_id, agent_slug, status)
where status in ('error', 'blocked');

-- Approval queue
create index if not exists idx_pierre_tasks_user_agent_approval_pending
on public.pierre_tasks (user_id, agent_slug, approval_required, status)
where approval_required = true;

-- -------------------------
-- pierre_missions — Mission Control card building
-- -------------------------

-- Risk level filter (sensitive cases)
create index if not exists idx_pierre_missions_user_agent_risk_level
on public.pierre_missions (user_id, agent_slug, risk_level);

-- Understanding status (missing info queue)
create index if not exists idx_pierre_missions_user_agent_understanding
on public.pierre_missions (user_id, agent_slug, understanding_status);

-- Active missions only (excludes terminal states)
create index if not exists idx_pierre_missions_user_agent_active
on public.pierre_missions (user_id, agent_slug, created_at desc)
where status not in ('cancelled', 'done');

-- -------------------------
-- pierre_task_logs — Mission Control briefing generation
-- -------------------------

-- Briefing log fetch: most recent per user+agent
create index if not exists idx_pierre_task_logs_user_agent_event_created_desc
on public.pierre_task_logs (user_id, agent_slug, event_type, created_at desc);

-- Mission log grouping for continuity dashboard
create index if not exists idx_pierre_task_logs_mission_created_desc
on public.pierre_task_logs (mission_id, created_at desc)
where mission_id is not null;

-- -------------------------
-- pierre_documents — delivery queue
-- -------------------------

-- Document status filter for delivery queue
create index if not exists idx_pierre_documents_user_agent_status_type
on public.pierre_documents (user_id, agent_slug, status, doc_type);

-- Mission documents grouping
create index if not exists idx_pierre_documents_mission_created_desc
on public.pierre_documents (mission_id, created_at desc)
where mission_id is not null;

-- -------------------------
-- pierre_company_memory — employee snapshot fetch
-- -------------------------

-- Single row fetch per user+agent (memory lookup for run-safe)
create index if not exists idx_pierre_company_memory_user_agent_updated
on public.pierre_company_memory (user_id, agent_slug, updated_at desc);
