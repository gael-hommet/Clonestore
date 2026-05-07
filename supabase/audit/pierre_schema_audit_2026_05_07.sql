-- =========================================================
-- CloneStore / Pierre - Audit schéma Supabase
-- Date: 2026-05-07
-- Objectif:
-- Lire le vrai schéma des tables Pierre existantes dans Supabase
-- avant de créer une migration propre.
--
-- À exécuter dans Supabase SQL Editor.
-- Aucun changement en base. Lecture seule.
-- =========================================================

select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.column_default,
  c.character_maximum_length,
  c.numeric_precision,
  c.numeric_scale
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in (
    'pierre_missions',
    'pierre_tasks',
    'pierre_task_logs',
    'pierre_documents',
    'pierre_outbound_emails',
    'pierre_company_memory',
    'pierre_queue',
    'orders',
    'agent_configs',
    'audit_log',
    'documents'
  )
order by c.table_name, c.ordinal_position;

-- Contraintes principales / foreign keys / uniques
select
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.table_name in (
    'pierre_missions',
    'pierre_tasks',
    'pierre_task_logs',
    'pierre_documents',
    'pierre_outbound_emails',
    'pierre_company_memory',
    'pierre_queue',
    'orders',
    'agent_configs',
    'audit_log',
    'documents'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- Index existants
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'pierre_missions',
    'pierre_tasks',
    'pierre_task_logs',
    'pierre_documents',
    'pierre_outbound_emails',
    'pierre_company_memory',
    'pierre_queue',
    'orders',
    'agent_configs',
    'audit_log',
    'documents'
  )
order by tablename, indexname;

-- RLS activé ou non
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'pierre_missions',
    'pierre_tasks',
    'pierre_task_logs',
    'pierre_documents',
    'pierre_outbound_emails',
    'pierre_company_memory',
    'pierre_queue',
    'orders',
    'agent_configs',
    'audit_log',
    'documents'
  )
order by c.relname;

-- Policies RLS
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'pierre_missions',
    'pierre_tasks',
    'pierre_task_logs',
    'pierre_documents',
    'pierre_outbound_emails',
    'pierre_company_memory',
    'pierre_queue',
    'orders',
    'agent_configs',
    'audit_log',
    'documents'
  )
order by tablename, policyname;
