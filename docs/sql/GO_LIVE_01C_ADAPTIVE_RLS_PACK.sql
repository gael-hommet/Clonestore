-- GO-LIVE 01C -- Adaptive RLS Pack
-- Applies RLS only on tables that actually exist in the database.
-- Each block is guarded by to_regclass() and column existence checks.
-- SAFE: can be run multiple times (DROP POLICY IF EXISTS before CREATE).
-- IMPORTANT: Run GO_LIVE_01C_SCHEMA_INTROSPECTION.sql FIRST and verify results.
--
-- Tenancy model discovered from code audit:
--   Real tenancy column: user_id = auth.uid()
--   NOT company_id (public.companies does not exist in this schema)
--
-- After running GO_LIVE_01C_SCHEMA_INTROSPECTION.sql, adjust column names if
-- any table uses a different tenancy column (client_id, owner_id, etc.).
--
-- Execute in a transaction: BEGIN; ... COMMIT; (ROLLBACK on any error)

BEGIN;

-- ── GROUP A: Pierre tables with user_id tenancy ───────────────────────────────

-- ── profiles ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE NOTICE '[SKIP] public.profiles: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_profiles_select_own ON public.profiles';
  EXECUTE 'DROP POLICY IF EXISTS rls_profiles_update_own ON public.profiles';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.profiles: SELECT/UPDATE policies applied (user_id = auth.uid())';
  ELSE
    RAISE NOTICE '[WARN] public.profiles: user_id column not found -- RLS enabled, no policy applied -- manual review required';
  END IF;
END $$;

-- ── orders ────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE NOTICE '[SKIP] public.orders: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_orders_select_own ON public.orders';
  EXECUTE 'DROP POLICY IF EXISTS rls_orders_insert_own ON public.orders';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_orders_select_own ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_orders_insert_own ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.orders: SELECT/INSERT policies applied (user_id = auth.uid())';
  ELSE
    RAISE NOTICE '[WARN] public.orders: user_id column not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_missions ───────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_missions') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_missions: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_missions' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_missions ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_missions_select ON public.pierre_missions';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_missions_insert ON public.pierre_missions';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_missions_update ON public.pierre_missions';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_missions_select ON public.pierre_missions FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_missions_insert ON public.pierre_missions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_missions_update ON public.pierre_missions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_missions: SELECT/INSERT/UPDATE policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_missions: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_tasks ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_tasks') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_tasks: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_tasks' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_tasks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_tasks_select ON public.pierre_tasks';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_tasks_insert ON public.pierre_tasks';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_tasks_update ON public.pierre_tasks';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_tasks_select ON public.pierre_tasks FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_tasks_insert ON public.pierre_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_tasks_update ON public.pierre_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_tasks: SELECT/INSERT/UPDATE policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_tasks: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_documents ──────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_documents') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_documents: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_documents' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_documents ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_documents_select ON public.pierre_documents';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_documents_insert ON public.pierre_documents';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_documents_select ON public.pierre_documents FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_documents_insert ON public.pierre_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_documents: SELECT/INSERT policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_documents: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_task_logs ──────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_task_logs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_task_logs: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_task_logs' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_task_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_task_logs_select ON public.pierre_task_logs';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_task_logs_insert ON public.pierre_task_logs';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_task_logs_select ON public.pierre_task_logs FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_task_logs_insert ON public.pierre_task_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_task_logs: SELECT/INSERT policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_task_logs: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_task_artifacts ─────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_task_artifacts') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_task_artifacts: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_task_artifacts' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_task_artifacts ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_task_artifacts_select ON public.pierre_task_artifacts';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_task_artifacts_insert ON public.pierre_task_artifacts';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_task_artifacts_select ON public.pierre_task_artifacts FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_task_artifacts_insert ON public.pierre_task_artifacts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_task_artifacts: SELECT/INSERT policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_task_artifacts: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_company_memory ─────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_company_memory') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_company_memory: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_company_memory' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_company_memory ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_company_memory_select ON public.pierre_company_memory';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_company_memory_insert ON public.pierre_company_memory';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_company_memory_update ON public.pierre_company_memory';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_company_memory_select ON public.pierre_company_memory FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_company_memory_insert ON public.pierre_company_memory FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_company_memory_update ON public.pierre_company_memory FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_company_memory: SELECT/INSERT/UPDATE policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_company_memory: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_outbound_emails ────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_outbound_emails') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_outbound_emails: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_outbound_emails' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_outbound_emails ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_outbound_emails_select ON public.pierre_outbound_emails';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_outbound_emails_insert ON public.pierre_outbound_emails';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_outbound_emails_select ON public.pierre_outbound_emails FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_outbound_emails_insert ON public.pierre_outbound_emails FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_outbound_emails: SELECT/INSERT policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_outbound_emails: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_empreinte ──────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_empreinte') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_empreinte: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_empreinte' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_empreinte ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_empreinte_select ON public.pierre_empreinte';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_empreinte_insert ON public.pierre_empreinte';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_empreinte_update ON public.pierre_empreinte';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_empreinte_select ON public.pierre_empreinte FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_empreinte_insert ON public.pierre_empreinte FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_empreinte_update ON public.pierre_empreinte FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_empreinte: SELECT/INSERT/UPDATE policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_empreinte: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── pierre_enterprise_empreinte ───────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.pierre_enterprise_empreinte') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_enterprise_empreinte: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pierre_enterprise_empreinte' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.pierre_enterprise_empreinte ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_enterprise_empreinte_select ON public.pierre_enterprise_empreinte';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_enterprise_empreinte_insert ON public.pierre_enterprise_empreinte';
  EXECUTE 'DROP POLICY IF EXISTS rls_pierre_enterprise_empreinte_update ON public.pierre_enterprise_empreinte';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_pierre_enterprise_empreinte_select ON public.pierre_enterprise_empreinte FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_enterprise_empreinte_insert ON public.pierre_enterprise_empreinte FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_pierre_enterprise_empreinte_update ON public.pierre_enterprise_empreinte FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.pierre_enterprise_empreinte: policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.pierre_enterprise_empreinte: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── agent_onboarding_pierre ───────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.agent_onboarding_pierre') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_onboarding_pierre: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_onboarding_pierre' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.agent_onboarding_pierre ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_agent_onboarding_pierre_select ON public.agent_onboarding_pierre';
  EXECUTE 'DROP POLICY IF EXISTS rls_agent_onboarding_pierre_insert ON public.agent_onboarding_pierre';
  EXECUTE 'DROP POLICY IF EXISTS rls_agent_onboarding_pierre_update ON public.agent_onboarding_pierre';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_agent_onboarding_pierre_select ON public.agent_onboarding_pierre FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_agent_onboarding_pierre_insert ON public.agent_onboarding_pierre FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_agent_onboarding_pierre_update ON public.agent_onboarding_pierre FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.agent_onboarding_pierre: policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.agent_onboarding_pierre: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── agent_history ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.agent_history') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_history: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agent_history' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.agent_history ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_agent_history_select ON public.agent_history';
  EXECUTE 'DROP POLICY IF EXISTS rls_agent_history_insert ON public.agent_history';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_agent_history_select ON public.agent_history FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_agent_history_insert ON public.agent_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.agent_history: SELECT/INSERT policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.agent_history: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── clonestore_company_technologies ───────────────────────────────────────────
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.clonestore_company_technologies') IS NULL THEN
    RAISE NOTICE '[SKIP] public.clonestore_company_technologies: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clonestore_company_technologies' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.clonestore_company_technologies ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_clonestore_co_tech_select ON public.clonestore_company_technologies';
  EXECUTE 'DROP POLICY IF EXISTS rls_clonestore_co_tech_insert ON public.clonestore_company_technologies';
  EXECUTE 'DROP POLICY IF EXISTS rls_clonestore_co_tech_update ON public.clonestore_company_technologies';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_clonestore_co_tech_select ON public.clonestore_company_technologies FOR SELECT TO authenticated USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_clonestore_co_tech_insert ON public.clonestore_company_technologies FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY rls_clonestore_co_tech_update ON public.clonestore_company_technologies FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.clonestore_company_technologies: policies applied';
  ELSE
    RAISE NOTICE '[WARN] public.clonestore_company_technologies: user_id not found -- RLS enabled, service_role only';
  END IF;
END $$;

-- ── GROUP B: Audit / security tables (restricted access) ─────────────────────

-- ── audit_log (singular -- not audit_logs) ────────────────────────────────────
-- SELECT limited by user_id; INSERT service_role only; DELETE forbidden
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE NOTICE '[SKIP] public.audit_log: table does not exist (note: PFINAL01 assumed audit_logs plural)';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_audit_log_select ON public.audit_log';
  EXECUTE 'DROP POLICY IF EXISTS rls_audit_log_no_insert ON public.audit_log';
  EXECUTE 'DROP POLICY IF EXISTS rls_audit_log_no_delete ON public.audit_log';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_audit_log_select ON public.audit_log FOR SELECT TO authenticated USING (user_id = auth.uid())';
  ELSE
    RAISE NOTICE '[WARN] public.audit_log: user_id not found -- SELECT policy not applied';
  END IF;

  EXECUTE 'CREATE POLICY rls_audit_log_no_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (false)';
  EXECUTE 'CREATE POLICY rls_audit_log_no_delete ON public.audit_log FOR DELETE TO authenticated USING (false)';
  RAISE NOTICE '[OK] public.audit_log: RLS applied -- INSERT/DELETE blocked for authenticated users (service_role only)';
END $$;

-- ── cloneos_ai_cost_events ────────────────────────────────────────────────────
-- SELECT limited; INSERT service_role only; DELETE forbidden
DO $$
DECLARE
  has_user_id boolean;
BEGIN
  IF to_regclass('public.cloneos_ai_cost_events') IS NULL THEN
    RAISE NOTICE '[SKIP] public.cloneos_ai_cost_events: table does not exist';
    RETURN;
  END IF;

  has_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cloneos_ai_cost_events' AND column_name = 'user_id'
  );

  EXECUTE 'ALTER TABLE public.cloneos_ai_cost_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS rls_ai_cost_events_select ON public.cloneos_ai_cost_events';
  EXECUTE 'DROP POLICY IF EXISTS rls_ai_cost_events_no_insert ON public.cloneos_ai_cost_events';

  IF has_user_id THEN
    EXECUTE 'CREATE POLICY rls_ai_cost_events_select ON public.cloneos_ai_cost_events FOR SELECT TO authenticated USING (user_id = auth.uid())';
    RAISE NOTICE '[OK] public.cloneos_ai_cost_events: SELECT by user_id applied';
  ELSE
    RAISE NOTICE '[WARN] public.cloneos_ai_cost_events: user_id not found -- checking company_id';
    -- Fallback: check company_id (used in PFINAL01)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cloneos_ai_cost_events' AND column_name='company_id') THEN
      EXECUTE 'CREATE POLICY rls_ai_cost_events_select ON public.cloneos_ai_cost_events FOR SELECT TO authenticated USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))';
      RAISE NOTICE '[OK] public.cloneos_ai_cost_events: SELECT by company_id applied (fallback)';
    END IF;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS rls_ai_cost_events_no_insert ON public.cloneos_ai_cost_events';
  EXECUTE 'CREATE POLICY rls_ai_cost_events_no_insert ON public.cloneos_ai_cost_events FOR INSERT TO authenticated WITH CHECK (false)';
  RAISE NOTICE '[OK] public.cloneos_ai_cost_events: INSERT blocked for authenticated users (service_role only)';
END $$;

-- ── GROUP C: Service-role-only tables (no permissive client policy) ───────────

-- ── pierre_queue ──────────────────────────────────────────────────────────────
-- No user_id detected in code audit -- enable RLS, no client policy
DO $$
BEGIN
  IF to_regclass('public.pierre_queue') IS NULL THEN
    RAISE NOTICE '[SKIP] public.pierre_queue: table does not exist';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.pierre_queue ENABLE ROW LEVEL SECURITY';
  RAISE NOTICE '[OK] public.pierre_queue: RLS enabled -- no client policy (service_role only) -- verify tenancy column via introspection';
END $$;

-- ── agent_configs ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agent_configs') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agent_configs: table does not exist';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY';
  RAISE NOTICE '[OK] public.agent_configs: RLS enabled -- no client policy (service_role only) -- uses client_id/agent_key, not user_id';
END $$;

-- ── agents_owned ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.agents_owned') IS NULL THEN
    RAISE NOTICE '[SKIP] public.agents_owned: table does not exist';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.agents_owned ENABLE ROW LEVEL SECURITY';
  RAISE NOTICE '[OK] public.agents_owned: RLS enabled -- no client policy (service_role only)';
END $$;

-- ── GROUP D: PFINAL01-assumed tables that do not exist -- NOTICE only ─────────
-- DO NOT create these tables. They are not used by this codebase.

DO $$
BEGIN
  -- public.companies: NOT in this schema. Tenancy is user_id-based, not company_id-based.
  -- Do NOT create this table. The RLS model does not require it.
  IF to_regclass('public.companies') IS NOT NULL THEN
    RAISE NOTICE '[INFO] public.companies: table EXISTS -- apply companies policy manually if needed';
  ELSE
    RAISE NOTICE '[INFO] public.companies: does not exist -- this is expected -- do NOT create it';
  END IF;

  IF to_regclass('public.employees') IS NOT NULL THEN
    RAISE NOTICE '[INFO] public.employees: table EXISTS -- apply employees policy manually -- not in adaptive pack';
  ELSE
    RAISE NOTICE '[INFO] public.employees: does not exist -- HR data is in pierre_missions/tasks (not employees)';
  END IF;

  IF to_regclass('public.absences') IS NOT NULL THEN
    RAISE NOTICE '[INFO] public.absences: table EXISTS -- apply absences policy manually -- not in adaptive pack';
  ELSE
    RAISE NOTICE '[INFO] public.absences: does not exist -- skipped';
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    RAISE NOTICE '[INFO] public.audit_logs (plural): table EXISTS -- note: adaptive pack targets audit_log (singular)';
  ELSE
    RAISE NOTICE '[INFO] public.audit_logs (plural): does not exist -- adaptive pack uses audit_log (singular)';
  END IF;
END $$;

-- ── VERIFICATION QUERY (run after COMMIT) ─────────────────────────────────────

-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- SELECT schemaname, tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

COMMIT;

-- ── NEXT STEP ─────────────────────────────────────────────────────────────────
-- After running this pack:
-- 1. Verify NOTICE output -- confirm which tables got policies applied
-- 2. Run GO_LIVE_01C_SCHEMA_INTROSPECTION.sql to see all policies now active
-- 3. Test: anon key -> 0 rows on sensitive tables
-- 4. Test: user isolation (if multiple users exist in staging)
-- 5. Only then: update go-live-proofs.local.json with SUPABASE_RLS_STAGING_APPLIED
