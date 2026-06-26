-- GO-LIVE 01D -- Targeted RLS Pack (Full Schema)
-- Based on real introspection results from Gael's Supabase project.
-- PREREQUISITE: Run GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql first.
-- Only use this pack if client_id text columns are confirmed to contain
-- Supabase auth.users UUIDs (uuid_like = total AND matched_auth_users = total).
-- If client_id text is NOT confirmed: use GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql.
--
-- Schema summary from introspection:
--   user_id uuid:    agent_onboarding_pierre, agent_runs, orders, pierre_company_memory,
--                    pierre_documents, pierre_missions, pierre_outbound_emails,
--                    pierre_task_logs, pierre_tasks
--   client_id uuid:  agents_owned, api_tokens, router_logs
--   client_id text:  agent_configs, audit_log, deadlines, documents, employees,
--                    hr_events, pierre_jobs, pierre_queue
--   id only:         clients, profiles
--   VIEW (skip):     pierre_queue_view
--
-- Execute in a transaction: BEGIN; ... COMMIT; (ROLLBACK on any error)

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP A: user_id uuid tables
-- Policy: user_id = auth.uid()
-- ══════════════════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────────────────────
-- profiles.id IS the auth user id (convention: id = auth.uid())
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE '[SKIP] public.profiles: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_profiles_select ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_profiles_update ON public.profiles';
  EXECUTE 'CREATE POLICY rls01d_profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  RAISE NOTICE '[OK] public.profiles: SELECT/UPDATE by id = auth.uid()';
END $$;

-- ── orders ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE '[SKIP] public.orders: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_orders_select ON public.orders';
  EXECUTE 'CREATE POLICY rls01d_orders_select ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.orders: SELECT by user_id (INSERT/UPDATE via service_role only)';
END $$;

-- ── pierre_missions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_missions') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_missions: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_missions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_missions_select ON public.pierre_missions';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_missions_insert ON public.pierre_missions';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_missions_update ON public.pierre_missions';
  EXECUTE 'CREATE POLICY rls01d_pierre_missions_select ON public.pierre_missions FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_missions_insert ON public.pierre_missions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_missions_update ON public.pierre_missions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_missions: SELECT/INSERT/UPDATE by user_id';
END $$;

-- ── pierre_tasks ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_tasks') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_tasks: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_tasks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_tasks_select ON public.pierre_tasks';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_tasks_insert ON public.pierre_tasks';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_tasks_update ON public.pierre_tasks';
  EXECUTE 'CREATE POLICY rls01d_pierre_tasks_select ON public.pierre_tasks FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_tasks_insert ON public.pierre_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_tasks_update ON public.pierre_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_tasks: SELECT/INSERT/UPDATE by user_id';
END $$;

-- ── pierre_task_logs ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_task_logs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_task_logs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_task_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_task_logs_select ON public.pierre_task_logs';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_task_logs_insert ON public.pierre_task_logs';
  EXECUTE 'CREATE POLICY rls01d_pierre_task_logs_select ON public.pierre_task_logs FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_task_logs_insert ON public.pierre_task_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_task_logs: SELECT/INSERT by user_id';
END $$;

-- ── pierre_documents ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_documents') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_documents: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_documents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_documents_select ON public.pierre_documents';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_documents_insert ON public.pierre_documents';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_documents_update ON public.pierre_documents';
  EXECUTE 'CREATE POLICY rls01d_pierre_documents_select ON public.pierre_documents FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_documents_insert ON public.pierre_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_documents_update ON public.pierre_documents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_documents: SELECT/INSERT/UPDATE by user_id';
END $$;

-- ── pierre_company_memory ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_company_memory') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_company_memory: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_company_memory ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_company_memory_select ON public.pierre_company_memory';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_company_memory_insert ON public.pierre_company_memory';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_company_memory_update ON public.pierre_company_memory';
  EXECUTE 'CREATE POLICY rls01d_pierre_company_memory_select ON public.pierre_company_memory FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_company_memory_insert ON public.pierre_company_memory FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_company_memory_update ON public.pierre_company_memory FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_company_memory: SELECT/INSERT/UPDATE by user_id';
END $$;

-- ── pierre_outbound_emails ────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_outbound_emails') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_outbound_emails: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_outbound_emails ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_outbound_emails_select ON public.pierre_outbound_emails';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_outbound_emails_insert ON public.pierre_outbound_emails';
  EXECUTE 'CREATE POLICY rls01d_pierre_outbound_emails_select ON public.pierre_outbound_emails FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_pierre_outbound_emails_insert ON public.pierre_outbound_emails FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_outbound_emails: SELECT/INSERT by user_id';
END $$;

-- ── agent_onboarding_pierre ───────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agent_onboarding_pierre') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_onboarding_pierre: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.agent_onboarding_pierre ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agent_onboarding_select ON public.agent_onboarding_pierre';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agent_onboarding_insert ON public.agent_onboarding_pierre';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agent_onboarding_update ON public.agent_onboarding_pierre';
  EXECUTE 'CREATE POLICY rls01d_agent_onboarding_select ON public.agent_onboarding_pierre FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_agent_onboarding_insert ON public.agent_onboarding_pierre FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_agent_onboarding_update ON public.agent_onboarding_pierre FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.agent_onboarding_pierre: SELECT/INSERT/UPDATE by user_id';
END $$;

-- ── agent_runs ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agent_runs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_runs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agent_runs_select ON public.agent_runs';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agent_runs_insert ON public.agent_runs';
  EXECUTE 'CREATE POLICY rls01d_agent_runs_select ON public.agent_runs FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_agent_runs_insert ON public.agent_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.agent_runs: SELECT/INSERT by user_id';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP B: client_id uuid tables
-- Policy: client_id = auth.uid()
-- PREREQUISITE: GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql must confirm match
-- ══════════════════════════════════════════════════════════════════════════════

-- ── agents_owned ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agents_owned') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agents_owned: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.agents_owned ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agents_owned_select ON public.agents_owned';
  EXECUTE 'CREATE POLICY rls01d_agents_owned_select ON public.agents_owned FOR SELECT TO authenticated USING (client_id = auth.uid())';
  RAISE NOTICE '[OK] public.agents_owned: SELECT by client_id = auth.uid() (uuid)';
END $$;

-- ── api_tokens ────────────────────────────────────────────────────────────────
-- api_tokens are sensitive auth credentials.
-- Only enable RLS with no client SELECT policy (service_role only).
-- Fetching tokens must happen server-side only via service_role.
DO $$
BEGIN
  IF to_regclass('public.api_tokens') IS NULL THEN
    RAISE NOTICE '[SKIP] public.api_tokens: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_api_tokens_select ON public.api_tokens';
  RAISE NOTICE '[OK] public.api_tokens: RLS enabled, no client SELECT policy (service_role only -- tokens are sensitive)';
END $$;

-- ── router_logs ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.router_logs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.router_logs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.router_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_router_logs_select ON public.router_logs';
  EXECUTE 'CREATE POLICY rls01d_router_logs_select ON public.router_logs FOR SELECT TO authenticated USING (client_id = auth.uid())';
  RAISE NOTICE '[OK] public.router_logs: SELECT by client_id = auth.uid() (uuid)';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP C: client_id text tables
-- Policy: client_id = auth.uid()::text
-- ONLY USE IF GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK confirms:
--   uuid_like = total_rows AND matched_auth_users = total_rows
-- ══════════════════════════════════════════════════════════════════════════════

-- ── employees ─────────────────────────────────────────────────────────────────
-- Note: Pierre does NOT use this table directly (uses pierre_company_memory).
-- This appears to be a legacy or external HR integration table.
-- Policy applies only if client_id text = auth.uid() confirmed.
DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE NOTICE '[SKIP] public.employees: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_employees_select ON public.employees';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_employees_insert ON public.employees';
  -- client_id text: ONLY apply if GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK confirms UUID match
  EXECUTE 'CREATE POLICY rls01d_employees_select ON public.employees FOR SELECT TO authenticated USING (client_id = auth.uid()::text)';
  EXECUTE 'CREATE POLICY rls01d_employees_insert ON public.employees FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid()::text)';
  RAISE NOTICE '[OK] public.employees: SELECT/INSERT by client_id = auth.uid()::text -- CONFIRM mapping check first';
END $$;

-- ── documents ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE NOTICE '[SKIP] public.documents: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_documents_select ON public.documents';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_documents_insert ON public.documents';
  EXECUTE 'CREATE POLICY rls01d_documents_select ON public.documents FOR SELECT TO authenticated USING (client_id = auth.uid()::text)';
  EXECUTE 'CREATE POLICY rls01d_documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid()::text)';
  RAISE NOTICE '[OK] public.documents: SELECT/INSERT by client_id = auth.uid()::text -- CONFIRM mapping check first';
END $$;

-- ── deadlines ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.deadlines') IS NULL THEN
    RAISE NOTICE '[SKIP] public.deadlines: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_deadlines_select ON public.deadlines';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_deadlines_insert ON public.deadlines';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_deadlines_update ON public.deadlines';
  EXECUTE 'CREATE POLICY rls01d_deadlines_select ON public.deadlines FOR SELECT TO authenticated USING (client_id = auth.uid()::text)';
  EXECUTE 'CREATE POLICY rls01d_deadlines_insert ON public.deadlines FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid()::text)';
  EXECUTE 'CREATE POLICY rls01d_deadlines_update ON public.deadlines FOR UPDATE TO authenticated USING (client_id = auth.uid()::text) WITH CHECK (client_id = auth.uid()::text)';
  RAISE NOTICE '[OK] public.deadlines: SELECT/INSERT/UPDATE by client_id = auth.uid()::text -- CONFIRM mapping check first';
END $$;

-- ── hr_events ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.hr_events') IS NULL THEN
    RAISE NOTICE '[SKIP] public.hr_events: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hr_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_hr_events_select ON public.hr_events';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_hr_events_insert ON public.hr_events';
  EXECUTE 'CREATE POLICY rls01d_hr_events_select ON public.hr_events FOR SELECT TO authenticated USING (client_id = auth.uid()::text)';
  EXECUTE 'CREATE POLICY rls01d_hr_events_insert ON public.hr_events FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid()::text)';
  RAISE NOTICE '[OK] public.hr_events: SELECT/INSERT by client_id = auth.uid()::text -- CONFIRM mapping check first';
END $$;

-- ── agent_configs ─────────────────────────────────────────────────────────────
-- Sensitive: agent configuration data.
-- client_id text may be an API key, not a UUID.
-- Service-role only until mapping check confirms otherwise.
DO $$
BEGIN
  IF to_regclass('public.agent_configs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_configs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_agent_configs_select ON public.agent_configs';
  RAISE NOTICE '[OK] public.agent_configs: RLS enabled, no client SELECT policy (service_role only -- client_id may not be auth UUID -- verify mapping check)';
END $$;

-- ── pierre_jobs ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_jobs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_jobs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_jobs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_jobs_select ON public.pierre_jobs';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_jobs_insert ON public.pierre_jobs';
  EXECUTE 'CREATE POLICY rls01d_pierre_jobs_select ON public.pierre_jobs FOR SELECT TO authenticated USING (client_id = auth.uid()::text)';
  EXECUTE 'CREATE POLICY rls01d_pierre_jobs_insert ON public.pierre_jobs FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid()::text)';
  RAISE NOTICE '[OK] public.pierre_jobs: SELECT/INSERT by client_id = auth.uid()::text -- CONFIRM mapping check first';
END $$;

-- ── pierre_queue ──────────────────────────────────────────────────────────────
-- Queue table: typically written/read by worker processes (service_role).
-- No permissive client policy. RLS enabled, service_role only.
DO $$
BEGIN
  IF to_regclass('public.pierre_queue') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_queue: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_queue ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_pierre_queue_select ON public.pierre_queue';
  RAISE NOTICE '[OK] public.pierre_queue: RLS enabled, service_role only (queue worker pattern)';
END $$;

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Immutable audit trail. INSERT/DELETE blocked for authenticated users.
-- SELECT by client_id if confirmed UUID, otherwise service_role only.
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE NOTICE '[SKIP] public.audit_log: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_audit_log_select ON public.audit_log';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_audit_log_no_insert ON public.audit_log';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_audit_log_no_delete ON public.audit_log';
  -- SELECT: only if client_id text = auth.uid() confirmed
  EXECUTE 'CREATE POLICY rls01d_audit_log_select ON public.audit_log FOR SELECT TO authenticated USING (client_id = auth.uid()::text)';
  -- INSERT and DELETE: blocked for all authenticated users
  EXECUTE 'CREATE POLICY rls01d_audit_log_no_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (false)';
  EXECUTE 'CREATE POLICY rls01d_audit_log_no_delete ON public.audit_log FOR DELETE TO authenticated USING (false)';
  RAISE NOTICE '[OK] public.audit_log: SELECT by client_id, INSERT/DELETE blocked (service_role only for writes)';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP D: Tables without direct owner (id-only or no tenancy)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── clients ───────────────────────────────────────────────────────────────────
-- Only id uuid column. No owner reference. Service_role only.
DO $$
BEGIN
  IF to_regclass('public.clients') IS NULL THEN
    RAISE NOTICE '[SKIP] public.clients: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY';
  RAISE NOTICE '[OK] public.clients: RLS enabled, no client policy (service_role only -- no owner column)';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP E: Views -- DO NOT create policies on views
-- ══════════════════════════════════════════════════════════════════════════════
-- pierre_queue_view: this is a VIEW, not a BASE TABLE.
-- Views inherit security from base tables.
-- security_barrier views may need separate handling.
-- Do NOT attempt ALTER TABLE or CREATE POLICY on a view.
-- Verified in introspection: pierre_queue_view is a VIEW (table_type = 'VIEW').

DO $$
BEGIN
  RAISE NOTICE '[INFO] public.pierre_queue_view: VIEW -- no policy created -- inherits base table RLS from pierre_queue';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run after COMMIT)
-- ══════════════════════════════════════════════════════════════════════════════

-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND policyname LIKE 'rls01d%'
-- ORDER BY tablename, policyname;

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- DO NOT create public.companies -- it does not exist in this schema.
-- Tenancy is user_id (uuid) or client_id (uuid/text), not company_id.
-- ══════════════════════════════════════════════════════════════════════════════
