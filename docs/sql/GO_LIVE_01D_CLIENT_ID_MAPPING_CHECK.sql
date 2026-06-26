-- GO-LIVE 01D -- client_id Mapping Check
-- READ-ONLY queries. No DML, no DDL. Safe to run at any time.
-- Run in Supabase SQL Editor to verify what client_id text/uuid fields contain
-- BEFORE applying any RLS policy that uses client_id = auth.uid()::text.
--
-- CRITICAL QUESTION: Does client_id text contain Supabase auth.users UUIDs?
-- If YES: use GO_LIVE_01D_TARGETED_RLS_PACK.sql
-- If NO or MIXED: use GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql (safer)

-- ── QUERY 1: auth.users sample ────────────────────────────────────────────────
-- Used to compare client_id values against real auth user IDs

SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- ── QUERY 2: client_id text samples per table ─────────────────────────────────
-- Look at the VALUES in client_id text columns.
-- Are they UUIDs? API keys? Emails? Company names?

SELECT 'agent_configs' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.agent_configs
GROUP BY client_id
LIMIT 20;

SELECT 'audit_log' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.audit_log
GROUP BY client_id
LIMIT 20;

SELECT 'deadlines' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.deadlines
GROUP BY client_id
LIMIT 20;

SELECT 'documents' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.documents
GROUP BY client_id
LIMIT 20;

SELECT 'employees' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.employees
GROUP BY client_id
LIMIT 20;

SELECT 'hr_events' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.hr_events
GROUP BY client_id
LIMIT 20;

SELECT 'pierre_jobs' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.pierre_jobs
GROUP BY client_id
LIMIT 20;

SELECT 'pierre_queue' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.pierre_queue
GROUP BY client_id
LIMIT 20;

-- ── QUERY 3: client_id uuid samples ──────────────────────────────────────────

SELECT 'agents_owned' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.agents_owned
GROUP BY client_id
LIMIT 20;

SELECT 'api_tokens' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.api_tokens
GROUP BY client_id
LIMIT 20;

SELECT 'router_logs' AS table_name, client_id::text AS client_id, COUNT(*) AS row_count
FROM public.router_logs
GROUP BY client_id
LIMIT 20;

-- ── QUERY 4: UUID-format check and auth.users match for client_id uuid ────────

SELECT 'agents_owned' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(u.id) AS matched_auth_users,
       COUNT(*) - COUNT(u.id) AS unmatched
FROM public.agents_owned t
LEFT JOIN auth.users u ON u.id = t.client_id;

SELECT 'api_tokens' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(u.id) AS matched_auth_users,
       COUNT(*) - COUNT(u.id) AS unmatched
FROM public.api_tokens t
LEFT JOIN auth.users u ON u.id = t.client_id;

SELECT 'router_logs' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(u.id) AS matched_auth_users,
       COUNT(*) - COUNT(u.id) AS unmatched
FROM public.router_logs t
LEFT JOIN auth.users u ON u.id = t.client_id;

-- ── QUERY 5: UUID-format check for client_id text (safe regex before cast) ────
-- uuid_like = client_id looks like a UUID
-- matched_auth_users = client_id text cast to uuid matches an auth.users.id
-- INTERPRET: if uuid_like = total AND matched_auth_users = total -> safe to use auth.uid()::text

SELECT 'agent_configs' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.agent_configs t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'audit_log' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.audit_log t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'deadlines' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.deadlines t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'documents' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.documents t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'employees' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.employees t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'hr_events' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.hr_events t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'pierre_jobs' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.pierre_jobs t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

SELECT 'pierre_queue' AS table_name,
       COUNT(*) AS total_rows,
       COUNT(*) FILTER (
         WHERE client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       ) AS uuid_like,
       COUNT(u.id) AS matched_auth_users
FROM public.pierre_queue t
LEFT JOIN auth.users u
  ON t.client_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 AND u.id = t.client_id::uuid;

-- ── QUERY 6: Current rowsecurity status ──────────────────────────────────────

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ── INTERPRET RESULTS ─────────────────────────────────────────────────────────
-- For each client_id text table from Query 5:
--
--   total_rows = uuid_like AND matched_auth_users = total_rows
--     -> client_id IS a Supabase auth UUID stored as text
--     -> Safe to use: client_id = auth.uid()::text
--     -> Use GO_LIVE_01D_TARGETED_RLS_PACK.sql
--
--   uuid_like < total_rows OR matched_auth_users < uuid_like
--     -> client_id is NOT always a Supabase auth UUID
--     -> Use GO_LIVE_01D_MINIMAL_SAFE_RLS_PACK.sql (service_role only for these tables)
--
--   total_rows = 0
--     -> Table is empty, impossible to verify from data
--     -> Use minimal safe approach until confirmed
