-- GO-LIVE 01D -- Minimal Safe RLS Pack
-- Use this pack when client_id text mapping is NOT confirmed.
-- Safe approach: only apply permissive policies on tables where tenancy is certain.
-- All legacy client_id text tables: RLS enabled, service_role only (no client policy).
--
-- This pack is less permissive than GO_LIVE_01D_TARGETED_RLS_PACK.sql but SAFER.
-- After GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql confirms client_id text = auth UUID,
-- upgrade to the targeted pack.
--
-- Execute in a transaction: BEGIN; ... COMMIT; (ROLLBACK on any error)

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- CONFIRMED SAFE: user_id uuid tables
-- These are safe regardless of client_id findings.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── profiles (id = auth.uid()) ────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE '[SKIP] public.profiles: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_profiles_select ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_profiles_update ON public.profiles';
  EXECUTE 'CREATE POLICY rls01d_min_profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_profiles_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  RAISE NOTICE '[OK] public.profiles: id = auth.uid()';
END $$;

-- ── orders ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE '[SKIP] public.orders: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_orders_select ON public.orders';
  EXECUTE 'CREATE POLICY rls01d_min_orders_select ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.orders: user_id = auth.uid()';
END $$;

-- ── pierre_missions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_missions') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_missions: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_missions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_missions_select ON public.pierre_missions';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_missions_insert ON public.pierre_missions';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_missions_update ON public.pierre_missions';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_missions_select ON public.pierre_missions FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_missions_insert ON public.pierre_missions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_missions_update ON public.pierre_missions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_missions: user_id = auth.uid()';
END $$;

-- ── pierre_tasks ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_tasks') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_tasks: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_tasks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_tasks_select ON public.pierre_tasks';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_tasks_insert ON public.pierre_tasks';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_tasks_update ON public.pierre_tasks';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_tasks_select ON public.pierre_tasks FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_tasks_insert ON public.pierre_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_tasks_update ON public.pierre_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_tasks: user_id = auth.uid()';
END $$;

-- ── pierre_task_logs ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_task_logs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_task_logs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_task_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_task_logs_select ON public.pierre_task_logs';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_task_logs_insert ON public.pierre_task_logs';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_task_logs_select ON public.pierre_task_logs FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_task_logs_insert ON public.pierre_task_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_task_logs: user_id = auth.uid()';
END $$;

-- ── pierre_documents ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_documents') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_documents: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_documents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_documents_select ON public.pierre_documents';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_documents_insert ON public.pierre_documents';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_documents_update ON public.pierre_documents';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_documents_select ON public.pierre_documents FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_documents_insert ON public.pierre_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_documents_update ON public.pierre_documents FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_documents: user_id = auth.uid()';
END $$;

-- ── pierre_company_memory ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_company_memory') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_company_memory: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_company_memory ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_company_memory_select ON public.pierre_company_memory';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_company_memory_insert ON public.pierre_company_memory';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_company_memory_update ON public.pierre_company_memory';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_company_memory_select ON public.pierre_company_memory FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_company_memory_insert ON public.pierre_company_memory FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_company_memory_update ON public.pierre_company_memory FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_company_memory: user_id = auth.uid()';
END $$;

-- ── pierre_outbound_emails ────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.pierre_outbound_emails') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_outbound_emails: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.pierre_outbound_emails ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_outbound_emails_select ON public.pierre_outbound_emails';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_pierre_outbound_emails_insert ON public.pierre_outbound_emails';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_outbound_emails_select ON public.pierre_outbound_emails FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_pierre_outbound_emails_insert ON public.pierre_outbound_emails FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.pierre_outbound_emails: user_id = auth.uid()';
END $$;

-- ── agent_onboarding_pierre ───────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agent_onboarding_pierre') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_onboarding_pierre: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.agent_onboarding_pierre ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_agent_onboarding_select ON public.agent_onboarding_pierre';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_agent_onboarding_insert ON public.agent_onboarding_pierre';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_agent_onboarding_update ON public.agent_onboarding_pierre';
  EXECUTE 'CREATE POLICY rls01d_min_agent_onboarding_select ON public.agent_onboarding_pierre FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_agent_onboarding_insert ON public.agent_onboarding_pierre FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_agent_onboarding_update ON public.agent_onboarding_pierre FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.agent_onboarding_pierre: user_id = auth.uid()';
END $$;

-- ── agent_runs ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agent_runs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_runs: not found';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_agent_runs_select ON public.agent_runs';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_agent_runs_insert ON public.agent_runs';
  EXECUTE 'CREATE POLICY rls01d_min_agent_runs_select ON public.agent_runs FOR SELECT TO authenticated USING (user_id = auth.uid())';
  EXECUTE 'CREATE POLICY rls01d_min_agent_runs_insert ON public.agent_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
  RAISE NOTICE '[OK] public.agent_runs: user_id = auth.uid()';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- LEGACY TABLES: client_id text -- RLS enabled, NO permissive client policy
-- Service_role only until GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK confirms UUID match
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl text;
  tbl_list text[] := ARRAY[
    'agent_configs',
    'audit_log',
    'deadlines',
    'documents',
    'employees',
    'hr_events',
    'pierre_jobs',
    'pierre_queue'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE '[SKIP] public.%: not found', tbl;
      CONTINUE;
    END IF;
    EXECUTE 'ALTER TABLE public.' || tbl || ' ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '[OK] public.%: RLS enabled -- NO permissive client policy -- service_role only until client_id mapping confirmed', tbl;
  END LOOP;
END $$;

-- ── audit_log: always block INSERT and DELETE for authenticated ───────────────
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_audit_log_no_insert ON public.audit_log';
  EXECUTE 'DROP POLICY IF EXISTS rls01d_min_audit_log_no_delete ON public.audit_log';
  EXECUTE 'CREATE POLICY rls01d_min_audit_log_no_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (false)';
  EXECUTE 'CREATE POLICY rls01d_min_audit_log_no_delete ON public.audit_log FOR DELETE TO authenticated USING (false)';
  RAISE NOTICE '[OK] public.audit_log: INSERT/DELETE blocked for authenticated (immutable audit trail)';
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- client_id uuid tables: RLS enabled, service_role only (safe default)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tbl text;
  tbl_list text[] := ARRAY['agents_owned', 'api_tokens', 'router_logs', 'clients'];
BEGIN
  FOREACH tbl IN ARRAY tbl_list LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE '[SKIP] public.%: not found', tbl;
      CONTINUE;
    END IF;
    EXECUTE 'ALTER TABLE public.' || tbl || ' ENABLE ROW LEVEL SECURITY';
    RAISE NOTICE '[OK] public.%: RLS enabled -- service_role only (no permissive policy in minimal pack)', tbl;
  END LOOP;
END $$;

-- ── pierre_queue_view: VIEW -- no policy ─────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '[INFO] public.pierre_queue_view: VIEW -- no RLS policy applied -- inherits pierre_queue base table';
END $$;

COMMIT;

-- ══════════════════════════════════════════════════════════════════════════════
-- NEXT STEP after minimal safe pack:
-- 1. Run GO_LIVE_01D_CLIENT_ID_MAPPING_CHECK.sql
-- 2. If client_id text = auth UUID confirmed: apply GO_LIVE_01D_TARGETED_RLS_PACK.sql
-- 3. Test anon access: SELECT * FROM pierre_missions LIMIT 5 -> 0 rows
-- 4. Test user isolation
-- 5. Update go-live-proofs.local.json with SUPABASE_RLS_STAGING_APPLIED
-- ══════════════════════════════════════════════════════════════════════════════
