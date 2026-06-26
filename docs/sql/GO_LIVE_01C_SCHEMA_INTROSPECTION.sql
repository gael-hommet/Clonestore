-- GO-LIVE 01C -- Schema Introspection
-- READ-ONLY queries. No DML, no DDL. Safe to run at any time.
-- Run these in Supabase SQL Editor to discover the real schema before applying RLS.
-- Copy results and share with Claude to generate the targeted adaptive RLS pack.

-- ── QUERY 1: List all tables in public schema ─────────────────────────────────

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ── QUERY 2: Detailed columns for all public tables ──────────────────────────

SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- ── QUERY 3: RLS enabled status per table ────────────────────────────────────

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ── QUERY 4: Existing policies ───────────────────────────────────────────────

SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ── QUERY 5: Tables related to Pierre / billing / missions ───────────────────

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%pierre%'
    OR table_name ILIKE '%agent%'
    OR table_name ILIKE '%task%'
    OR table_name ILIKE '%mission%'
    OR table_name ILIKE '%email%'
    OR table_name ILIKE '%document%'
    OR table_name ILIKE '%memory%'
    OR table_name ILIKE '%billing%'
    OR table_name ILIKE '%order%'
    OR table_name ILIKE '%subscription%'
  )
ORDER BY table_name;

-- ── QUERY 6: Tenancy columns per table ───────────────────────────────────────
-- Identifies which column to use for RLS isolation (user_id, company_id, etc.)

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN (
    'id',
    'user_id',
    'company_id',
    'organization_id',
    'owner_id',
    'profile_id',
    'client_id',
    'agent_slug',
    'created_by'
  )
ORDER BY table_name, column_name;
