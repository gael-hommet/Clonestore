-- =========================================================
-- Pierre / RLS v1
-- Objectif: accès user strict à ses propres données
-- Service role garde son bypass natif Supabase
-- =========================================================

-- -------------------------
-- Enable RLS
-- -------------------------
alter table if exists public.pierre_company_memory enable row level security;
alter table if exists public.pierre_missions enable row level security;
alter table if exists public.pierre_tasks enable row level security;
alter table if exists public.pierre_task_logs enable row level security;
alter table if exists public.pierre_documents enable row level security;
alter table if exists public.pierre_outbound_emails enable row level security;

-- -------------------------
-- Drop existing Pierre policies to keep script idempotent
-- -------------------------
drop policy if exists "pierre_company_memory_select_own" on public.pierre_company_memory;
drop policy if exists "pierre_company_memory_insert_own" on public.pierre_company_memory;
drop policy if exists "pierre_company_memory_update_own" on public.pierre_company_memory;
drop policy if exists "pierre_company_memory_delete_own" on public.pierre_company_memory;

drop policy if exists "pierre_missions_select_own" on public.pierre_missions;
drop policy if exists "pierre_missions_insert_own" on public.pierre_missions;
drop policy if exists "pierre_missions_update_own" on public.pierre_missions;
drop policy if exists "pierre_missions_delete_own" on public.pierre_missions;

drop policy if exists "pierre_tasks_select_own" on public.pierre_tasks;
drop policy if exists "pierre_tasks_insert_own" on public.pierre_tasks;
drop policy if exists "pierre_tasks_update_own" on public.pierre_tasks;
drop policy if exists "pierre_tasks_delete_own" on public.pierre_tasks;

drop policy if exists "pierre_task_logs_select_own" on public.pierre_task_logs;
drop policy if exists "pierre_task_logs_insert_own" on public.pierre_task_logs;
drop policy if exists "pierre_task_logs_update_own" on public.pierre_task_logs;
drop policy if exists "pierre_task_logs_delete_own" on public.pierre_task_logs;

drop policy if exists "pierre_documents_select_own" on public.pierre_documents;
drop policy if exists "pierre_documents_insert_own" on public.pierre_documents;
drop policy if exists "pierre_documents_update_own" on public.pierre_documents;
drop policy if exists "pierre_documents_delete_own" on public.pierre_documents;

drop policy if exists "pierre_outbound_emails_select_own" on public.pierre_outbound_emails;
drop policy if exists "pierre_outbound_emails_insert_own" on public.pierre_outbound_emails;
drop policy if exists "pierre_outbound_emails_update_own" on public.pierre_outbound_emails;
drop policy if exists "pierre_outbound_emails_delete_own" on public.pierre_outbound_emails;

-- -------------------------
-- pierre_company_memory
-- -------------------------
create policy "pierre_company_memory_select_own"
on public.pierre_company_memory
for select
to authenticated
using (auth.uid() = user_id);

create policy "pierre_company_memory_insert_own"
on public.pierre_company_memory
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pierre_company_memory_update_own"
on public.pierre_company_memory
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pierre_company_memory_delete_own"
on public.pierre_company_memory
for delete
to authenticated
using (auth.uid() = user_id);

-- -------------------------
-- pierre_missions
-- -------------------------
create policy "pierre_missions_select_own"
on public.pierre_missions
for select
to authenticated
using (auth.uid() = user_id);

create policy "pierre_missions_insert_own"
on public.pierre_missions
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pierre_missions_update_own"
on public.pierre_missions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pierre_missions_delete_own"
on public.pierre_missions
for delete
to authenticated
using (auth.uid() = user_id);

-- -------------------------
-- pierre_tasks
-- -------------------------
create policy "pierre_tasks_select_own"
on public.pierre_tasks
for select
to authenticated
using (auth.uid() = user_id);

create policy "pierre_tasks_insert_own"
on public.pierre_tasks
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pierre_tasks_update_own"
on public.pierre_tasks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pierre_tasks_delete_own"
on public.pierre_tasks
for delete
to authenticated
using (auth.uid() = user_id);

-- -------------------------
-- pierre_task_logs
-- -------------------------
create policy "pierre_task_logs_select_own"
on public.pierre_task_logs
for select
to authenticated
using (auth.uid() = user_id);

create policy "pierre_task_logs_insert_own"
on public.pierre_task_logs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pierre_task_logs_update_own"
on public.pierre_task_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pierre_task_logs_delete_own"
on public.pierre_task_logs
for delete
to authenticated
using (auth.uid() = user_id);

-- -------------------------
-- pierre_documents
-- -------------------------
create policy "pierre_documents_select_own"
on public.pierre_documents
for select
to authenticated
using (auth.uid() = user_id);

create policy "pierre_documents_insert_own"
on public.pierre_documents
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pierre_documents_update_own"
on public.pierre_documents
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pierre_documents_delete_own"
on public.pierre_documents
for delete
to authenticated
using (auth.uid() = user_id);

-- -------------------------
-- pierre_outbound_emails
-- -------------------------
create policy "pierre_outbound_emails_select_own"
on public.pierre_outbound_emails
for select
to authenticated
using (auth.uid() = user_id);

create policy "pierre_outbound_emails_insert_own"
on public.pierre_outbound_emails
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "pierre_outbound_emails_update_own"
on public.pierre_outbound_emails
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "pierre_outbound_emails_delete_own"
on public.pierre_outbound_emails
for delete
to authenticated
using (auth.uid() = user_id);