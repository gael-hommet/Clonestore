-- P-FINAL 01 — Phase 3 — CloneStore RLS Production Pack
-- REVIEW-READY DRAFT — Do NOT apply without human review and staging test first.
-- Apply in a transaction: BEGIN; ... COMMIT; (or ROLLBACK; on any error)
-- Tables covered: companies, profiles, employees, tasks, documents, emails,
--                 pierre_task_artifacts, cloneos_ai_cost_events, absences, audit_logs
-- Prerequisite: All tables must have RLS enabled first (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
-- See: docs/B41_PIERRE_SECURITY_RLS.sql for prior RLS context (B41)
-- CRITICAL: Service-role API key bypasses RLS — use it for all server-side routes.
-- CRITICAL: Anon key must NEVER be used in server-side routes after RLS activation.

-- ────────────────────────────────────────────────────────────────────────────────
-- 0. ENABLE ROW LEVEL SECURITY on all target tables
-- Run this BEFORE any policy creation.
-- ────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pierre_task_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloneos_ai_cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. companies
-- Policy: users can only see and update their own company
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS companies_select_own ON public.companies;
CREATE POLICY companies_select_own
  ON public.companies FOR SELECT
  TO authenticated
  USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS companies_update_own ON public.companies;
CREATE POLICY companies_update_own
  ON public.companies FOR UPDATE
  TO authenticated
  USING (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. profiles
-- Policy: users can see all profiles within their company; update only their own
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_select_own_company ON public.profiles;
CREATE POLICY profiles_select_own_company
  ON public.profiles FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────────
-- 3. employees
-- Policy: full CRUD isolation by company_id
-- CRITICAL: company_id must never come from client input — derived from auth.uid()
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS employees_select_own_company ON public.employees;
CREATE POLICY employees_select_own_company
  ON public.employees FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS employees_insert_own_company ON public.employees;
CREATE POLICY employees_insert_own_company
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS employees_update_own_company ON public.employees;
CREATE POLICY employees_update_own_company
  ON public.employees FOR UPDATE
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS employees_delete_own_company ON public.employees;
CREATE POLICY employees_delete_own_company
  ON public.employees FOR DELETE
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 4. tasks
-- Policy: SELECT + INSERT + UPDATE by company_id (no DELETE policy → forbidden)
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS tasks_select_own_company ON public.tasks;
CREATE POLICY tasks_select_own_company
  ON public.tasks FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS tasks_insert_own_company ON public.tasks;
CREATE POLICY tasks_insert_own_company
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS tasks_update_own_company ON public.tasks;
CREATE POLICY tasks_update_own_company
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 5. documents
-- Policy: SELECT + INSERT by company_id (UPDATE via service_role only)
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS documents_select_own_company ON public.documents;
CREATE POLICY documents_select_own_company
  ON public.documents FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS documents_insert_own_company ON public.documents;
CREATE POLICY documents_insert_own_company
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 6. emails
-- Policy: SELECT + INSERT by company_id
-- Note: emails are DRAFT only — sending handled by service_role
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS emails_select_own_company ON public.emails;
CREATE POLICY emails_select_own_company
  ON public.emails FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS emails_insert_own_company ON public.emails;
CREATE POLICY emails_insert_own_company
  ON public.emails FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 7. pierre_task_artifacts
-- Policy: SELECT + INSERT by company_id
-- Note: B41 covers pierre_task_artifacts — this supersedes if B41 not yet applied
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS pierre_task_artifacts_select_own_company ON public.pierre_task_artifacts;
CREATE POLICY pierre_task_artifacts_select_own_company
  ON public.pierre_task_artifacts FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS pierre_task_artifacts_insert_own_company ON public.pierre_task_artifacts;
CREATE POLICY pierre_task_artifacts_insert_own_company
  ON public.pierre_task_artifacts FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 8. cloneos_ai_cost_events
-- Policy: SELECT by company_id; INSERT forbidden for authenticated (service_role only)
-- Note: B41 covers cloneos_ai_cost_events — this supersedes if B41 not yet applied
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ai_cost_events_select_own_company ON public.cloneos_ai_cost_events;
CREATE POLICY ai_cost_events_select_own_company
  ON public.cloneos_ai_cost_events FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS ai_cost_events_insert_own_company ON public.cloneos_ai_cost_events;
CREATE POLICY ai_cost_events_insert_own_company
  ON public.cloneos_ai_cost_events FOR INSERT
  TO authenticated
  WITH CHECK (false);  -- Only service_role can insert AI cost events

-- ────────────────────────────────────────────────────────────────────────────────
-- 9. absences
-- Policy: SELECT + INSERT by company_id
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS absences_select_own_company ON public.absences;
CREATE POLICY absences_select_own_company
  ON public.absences FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS absences_insert_own_company ON public.absences;
CREATE POLICY absences_insert_own_company
  ON public.absences FOR INSERT
  TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────────
-- 10. audit_logs
-- Policy: SELECT by company_id; DELETE forbidden for all authenticated users
-- Audit logs are immutable — no DELETE, no UPDATE allowed
-- ────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS audit_logs_select_own_company ON public.audit_logs;
CREATE POLICY audit_logs_select_own_company
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE POLICY audit_logs_no_delete
  ON public.audit_logs FOR DELETE
  TO authenticated
  USING (false);  -- Audit logs cannot be deleted by any authenticated user

-- ────────────────────────────────────────────────────────────────────────────────
-- 11. VERIFICATION QUERIES (run after COMMIT to confirm policies are active)
-- ────────────────────────────────────────────────────────────────────────────────

-- List all active RLS policies (expected: ~22 policies):
-- SELECT schemaname, tablename, policyname, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Verify RLS is enabled on all tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- ────────────────────────────────────────────────────────────────────────────────
-- END OF PFINAL01_RLS_PRODUCTION_PACK.sql
-- Review by: _________________ Date: _________________
-- Staging tested: YES / NO
-- Production applied by: _________________ Date: _________________
-- ────────────────────────────────────────────────────────────────────────────────
