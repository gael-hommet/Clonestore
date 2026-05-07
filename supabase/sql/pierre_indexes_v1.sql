-- =========================================================
-- Pierre / Indexes v1
-- Objectif: requêtes fréquentes, queue, historique, lecture ciblée
-- Compatible montée en charge / éviter full scans inutiles
-- =========================================================

-- -------------------------
-- pierre_missions
-- -------------------------
create index if not exists idx_pierre_missions_user_agent_created_desc
on public.pierre_missions (user_id, agent_slug, created_at desc);

create index if not exists idx_pierre_missions_user_agent_status_created_desc
on public.pierre_missions (user_id, agent_slug, status, created_at desc);

create index if not exists idx_pierre_missions_user_agent_source_created_desc
on public.pierre_missions (user_id, agent_slug, source, created_at desc);

create index if not exists idx_pierre_missions_agent_created_desc
on public.pierre_missions (agent_slug, created_at desc);

-- -------------------------
-- pierre_tasks
-- -------------------------
create index if not exists idx_pierre_tasks_mission_created_asc
on public.pierre_tasks (mission_id, created_at asc);

create index if not exists idx_pierre_tasks_user_agent_created_desc
on public.pierre_tasks (user_id, agent_slug, created_at desc);

create index if not exists idx_pierre_tasks_user_agent_status_created_desc
on public.pierre_tasks (user_id, agent_slug, status, created_at desc);

create index if not exists idx_pierre_tasks_agent_status_priority_created
on public.pierre_tasks (agent_slug, status, priority desc, created_at asc);

create index if not exists idx_pierre_tasks_agent_scheduled_due
on public.pierre_tasks (agent_slug, status, execute_at asc, priority desc)
where status = 'scheduled';

create index if not exists idx_pierre_tasks_agent_ready_retry
on public.pierre_tasks (agent_slug, status, priority desc, created_at asc)
where status in ('ready', 'retry');

create index if not exists idx_pierre_tasks_agent_running_updated
on public.pierre_tasks (agent_slug, status, updated_at asc)
where status = 'running';

create index if not exists idx_pierre_tasks_user_agent_mission_status
on public.pierre_tasks (user_id, agent_slug, mission_id, status);

-- -------------------------
-- pierre_task_logs
-- -------------------------
create index if not exists idx_pierre_task_logs_mission_created_asc
on public.pierre_task_logs (mission_id, created_at asc);

create index if not exists idx_pierre_task_logs_task_created_asc
on public.pierre_task_logs (task_id, created_at asc);

create index if not exists idx_pierre_task_logs_user_agent_created_desc
on public.pierre_task_logs (user_id, agent_slug, created_at desc);

-- -------------------------
-- pierre_documents
-- -------------------------
create index if not exists idx_pierre_documents_user_agent_created_desc
on public.pierre_documents (user_id, agent_slug, created_at desc);

create index if not exists idx_pierre_documents_mission_created_desc
on public.pierre_documents (mission_id, created_at desc);

create index if not exists idx_pierre_documents_task_created_desc
on public.pierre_documents (task_id, created_at desc);

-- -------------------------
-- pierre_outbound_emails
-- -------------------------
create index if not exists idx_pierre_outbound_emails_user_agent_created_desc
on public.pierre_outbound_emails (user_id, agent_slug, created_at desc);

create index if not exists idx_pierre_outbound_emails_task_created_desc
on public.pierre_outbound_emails (task_id, created_at desc);

create index if not exists idx_pierre_outbound_emails_status_created_desc
on public.pierre_outbound_emails (status, created_at desc);

create index if not exists idx_pierre_outbound_emails_provider_message_id
on public.pierre_outbound_emails (provider_message_id);

-- -------------------------
-- pierre_company_memory
-- -------------------------
create unique index if not exists idx_pierre_company_memory_user_agent_unique
on public.pierre_company_memory (user_id, agent_slug);

create index if not exists idx_pierre_company_memory_agent_updated_desc
on public.pierre_company_memory (agent_slug, updated_at desc);