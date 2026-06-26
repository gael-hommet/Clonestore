-- supabase/migrations/2026-06-15__pierre_v4_operational_closure.sql
-- PHASE 8.2-C — Final operational closure.
-- Custom-role permissions + metadata, multi-company preference, CSV import
-- batches/rows, and production fuzzy search (pg_trgm) with a PGlite-safe guard.
-- Idempotent. No data loss. RLS forced on every new tenant table.

-- ── Custom roles: metadata + their own permission grants ─────────────────────
alter table pierre_rt_custom_roles add column if not exists created_by uuid;
alter table pierre_rt_custom_roles add column if not exists archived_at timestamptz;
alter table pierre_rt_custom_roles add column if not exists version integer not null default 1;

create table if not exists pierre_rt_custom_role_permissions (
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  role_key       text not null,
  permission_key text not null references pierre_rt_permissions(key) on delete cascade,
  primary key (company_id, role_key, permission_key)
);

-- Custom-role membership assignment (membership_roles.role_key FKs to the system
-- catalog, so custom roles are assigned through their own join table).
create table if not exists pierre_rt_membership_custom_roles (
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  membership_id uuid not null references pierre_rt_members(id) on delete cascade,
  role_key      text not null,
  primary key (membership_id, role_key)
);
create index if not exists idx_rt_membership_custom_roles_member on pierre_rt_membership_custom_roles(membership_id);

-- ── Multi-company: persistent active-company preference (identity-scoped) ─────
-- Resolved by the service role at identity time; never touched by pierre_rt_app,
-- so it is deliberately NOT tenant-RLS-scoped (it spans the user's companies).
create table if not exists pierre_rt_user_company_prefs (
  user_id         uuid primary key,
  last_company_id uuid,
  updated_at      timestamptz not null default now()
);

-- ── CSV import: batches + per-row staging (idempotent, rollback-able) ─────────
create table if not exists pierre_rt_employee_import_batches (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  idempotency_key text,
  status          text not null default 'preview' check (status in ('preview','committed','rolled_back','failed')),
  dedup_keys      text[] not null default array['employee_number','professional_email']::text[],
  allow_partial   boolean not null default false,
  total_rows      integer not null default 0,
  valid_rows      integer not null default 0,
  error_rows      integer not null default 0,
  duplicate_rows  integer not null default 0,
  inserted_rows   integer not null default 0,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  committed_at    timestamptz,
  rolled_back_at  timestamptz,
  unique (company_id, idempotency_key)
);

create table if not exists pierre_rt_employee_import_rows (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  batch_id        uuid not null references pierre_rt_employee_import_batches(id) on delete cascade,
  row_number      integer not null,
  raw             jsonb not null default '{}'::jsonb,
  normalized      jsonb,
  outcome         text not null default 'pending' check (outcome in ('pending','valid','error','duplicate','inserted')),
  employee_id     uuid,
  dedup_signature text,
  errors          text[] not null default array[]::text[]
);
create index if not exists idx_rt_import_rows_batch on pierre_rt_employee_import_rows(batch_id, row_number);

-- ── RLS — force on every new tenant table ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_custom_role_permissions',
    'pierre_rt_membership_custom_roles',
    'pierre_rt_employee_import_batches',
    'pierre_rt_employee_import_rows'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update, delete on %I to pierre_rt_app', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end$$;

-- ── Production fuzzy search: pg_trgm GIN index on search_text ─────────────────
-- On a server Postgres (Supabase) this enables accent/typo-tolerant trigram
-- search. PGlite has no pg_trgm; the runtime detects this and falls back to a
-- normalized prefix/substring search on the same `search_text` column. The
-- guarded block must never abort the migration when the extension is absent.
do $$
begin
  begin
    create extension if not exists pg_trgm;
    execute 'create index if not exists idx_rt_employees_search_trgm on pierre_rt_employees using gin (search_text gin_trgm_ops)';
  exception when others then
    raise notice 'pg_trgm unavailable — fuzzy search falls back to normalized prefix/substring (search_text). %', sqlerrm;
  end;
end$$;
