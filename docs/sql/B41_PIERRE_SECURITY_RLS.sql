-- =============================================================================
-- B41 — Pierre Security RLS Extension
-- Objectif : étendre la protection RLS au-delà de pierre_rls_v1.sql
-- Status   : À APPLIQUER MANUELLEMENT en production Supabase
--            Vérifier l'existence des tables avant exécution.
-- =============================================================================

-- NOTE IMPORTANTE :
-- Ce script est un complément à supabase/sql/pierre_rls_v1.sql
-- Il couvre les tables manquantes de v1 :
--   - pierre_task_artifacts
--   - cloneos_ai_cost_events
--   - security_audit_events (future)
-- Et ajoute des index de performance supplémentaires.
-- Adapter selon le schéma réel avant application.

-- =============================================================================
-- 1. ENABLE RLS — tables manquantes de v1
-- =============================================================================

-- pierre_task_artifacts
alter table if exists public.pierre_task_artifacts enable row level security;

-- cloneos_ai_cost_events
alter table if exists public.cloneos_ai_cost_events enable row level security;

-- security_audit_events (future table)
-- alter table if exists public.security_audit_events enable row level security;

-- =============================================================================
-- 2. DROP EXISTING B41 POLICIES (idempotent)
-- =============================================================================

drop policy if exists "pierre_task_artifacts_select_own" on public.pierre_task_artifacts;
drop policy if exists "pierre_task_artifacts_insert_own" on public.pierre_task_artifacts;
drop policy if exists "pierre_task_artifacts_update_own" on public.pierre_task_artifacts;
drop policy if exists "pierre_task_artifacts_delete_own" on public.pierre_task_artifacts;

drop policy if exists "cloneos_ai_cost_events_select_own" on public.cloneos_ai_cost_events;
drop policy if exists "cloneos_ai_cost_events_insert_own" on public.cloneos_ai_cost_events;
drop policy if exists "cloneos_ai_cost_events_delete_own" on public.cloneos_ai_cost_events;

-- =============================================================================
-- 3. PIERRE_TASK_ARTIFACTS — RLS
-- Tenant column : user_id (via pierre_tasks join) OR user_id direct if present
-- Adapt column name to actual schema.
-- =============================================================================

do $$
begin
  -- Select: user can only read their own artifacts
  if not exists (
    select 1 from pg_policies
    where tablename = 'pierre_task_artifacts'
    and policyname = 'pierre_task_artifacts_select_own'
  ) then
    execute $policy$
      create policy "pierre_task_artifacts_select_own"
      on public.pierre_task_artifacts
      for select
      to authenticated
      using (
        exists (
          select 1 from public.pierre_tasks t
          where t.id = pierre_task_artifacts.task_id
          and t.user_id = auth.uid()
        )
      )
    $policy$;
  end if;

  -- Insert: user can only insert artifacts for their tasks
  if not exists (
    select 1 from pg_policies
    where tablename = 'pierre_task_artifacts'
    and policyname = 'pierre_task_artifacts_insert_own'
  ) then
    execute $policy$
      create policy "pierre_task_artifacts_insert_own"
      on public.pierre_task_artifacts
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.pierre_tasks t
          where t.id = pierre_task_artifacts.task_id
          and t.user_id = auth.uid()
        )
      )
    $policy$;
  end if;

  -- Delete: user can only delete their artifacts
  if not exists (
    select 1 from pg_policies
    where tablename = 'pierre_task_artifacts'
    and policyname = 'pierre_task_artifacts_delete_own'
  ) then
    execute $policy$
      create policy "pierre_task_artifacts_delete_own"
      on public.pierre_task_artifacts
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.pierre_tasks t
          where t.id = pierre_task_artifacts.task_id
          and t.user_id = auth.uid()
        )
      )
    $policy$;
  end if;
end $$;

-- =============================================================================
-- 4. CLONEOS_AI_COST_EVENTS — RLS
-- Tenant column: user_id
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cloneos_ai_cost_events'
    and policyname = 'cloneos_ai_cost_events_select_own'
  ) then
    execute $policy$
      create policy "cloneos_ai_cost_events_select_own"
      on public.cloneos_ai_cost_events
      for select
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'cloneos_ai_cost_events'
    and policyname = 'cloneos_ai_cost_events_insert_own'
  ) then
    execute $policy$
      create policy "cloneos_ai_cost_events_insert_own"
      on public.cloneos_ai_cost_events
      for insert
      to authenticated
      with check (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'cloneos_ai_cost_events'
    and policyname = 'cloneos_ai_cost_events_delete_own'
  ) then
    execute $policy$
      create policy "cloneos_ai_cost_events_delete_own"
      on public.cloneos_ai_cost_events
      for delete
      to authenticated
      using (auth.uid() = user_id)
    $policy$;
  end if;
end $$;

-- =============================================================================
-- 5. SERVICE ROLE BYPASS (documentation)
-- Le service_role Supabase bypasse nativement le RLS.
-- Les routes server-side (cron, worker, snapshot) utilisent service_role_key.
-- Elles doivent appliquer WHERE user_id = $1 MANUELLEMENT.
-- =============================================================================

-- IMPORTANT: Server-side service_role queries MUST include:
--   .eq("user_id", userId) -- for tenant isolation
-- The RLS does NOT protect service_role queries.

-- =============================================================================
-- 6. FUTURE — SECURITY_AUDIT_EVENTS TABLE
-- =============================================================================

-- Uncomment when table is created in migration:
/*
alter table if exists public.security_audit_events enable row level security;

create policy "security_audit_events_select_own"
on public.security_audit_events
for select
to authenticated
using (auth.uid() = actor_user_id);

create policy "security_audit_events_insert_service"
on public.security_audit_events
for insert
to service_role
with check (true);
*/

-- =============================================================================
-- 7. PERFORMANCE INDEXES — B41
-- =============================================================================

-- pierre_task_artifacts — task_id lookup
create index if not exists idx_pierre_task_artifacts_task_id
  on public.pierre_task_artifacts(task_id);

-- cloneos_ai_cost_events — user_id + created_at for retention queries
create index if not exists idx_cloneos_ai_cost_events_user_id
  on public.cloneos_ai_cost_events(user_id);

create index if not exists idx_cloneos_ai_cost_events_created_at
  on public.cloneos_ai_cost_events(created_at);

-- pierre_task_logs — user_id for tenant scoping
create index if not exists idx_pierre_task_logs_user_id
  on public.pierre_task_logs(user_id);

-- pierre_outbound_emails — user_id for tenant + retention
create index if not exists idx_pierre_outbound_emails_user_id
  on public.pierre_outbound_emails(user_id);

-- =============================================================================
-- 8. FUTURE — COMPANY_MEMBERS TABLE (B42+)
-- When company_id != user_id (multi-user tenancy)
-- =============================================================================

-- Future schema for multi-user company support:
/*
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  user_id uuid not null references auth.users(id),
  role text not null default 'member', -- 'owner', 'admin', 'member'
  created_at timestamptz default now(),
  unique(company_id, user_id)
);

alter table public.company_members enable row level security;

-- Users can read members of their company
create policy "company_members_select_own"
on public.company_members
for select
to authenticated
using (user_id = auth.uid());
*/

-- =============================================================================
-- 9. ANTI-SPOOFING DOCUMENTATION
-- =============================================================================

-- Rule: company_id from client = NEVER trusted.
-- All API routes resolve user_id server-side via:
--   supabase.auth.getUser(bearerToken) → userId
-- Then set company_id = userId (current single-tenant model).
-- sanitizeActionPayload() strips company_id/user_id from all client payloads.

-- =============================================================================
-- END B41_PIERRE_SECURITY_RLS.sql
-- Apply to Supabase via: Project Settings → SQL Editor
-- Verify table existence before each block.
-- =============================================================================
