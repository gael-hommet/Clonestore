-- ============================================================================
-- PHASE 8.2 — Enterprise Tenancy, RBAC, Sites & Employee 360 — canonical model
-- ----------------------------------------------------------------------------
-- Extends the P8.1 canonical runtime (pierre_rt_*). Adds: sites, site-scoped
-- memberships (RBAC scope), Employee 360 production data model (employees +
-- events + documents metadata + absences), FKs from missions to employees/sites,
-- and an idempotent backfill function from the legacy per-user ownership model
-- (orders.status in active/trialing, agents_owned) -> companies + owner members.
--
-- Idempotent / re-runnable. Applied by scripts/db/migrate.mjs (PGlite local/test)
-- and manually/CI to Supabase. gen_random_uuid() is core PG13+.
-- ============================================================================

-- ── Sites ────────────────────────────────────────────────────────────────────
create table if not exists pierre_rt_sites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  name        text not null,
  code        text,
  timezone    text not null default 'Europe/Paris',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_id, code)
);
create index if not exists idx_rt_sites_company on pierre_rt_sites(company_id);

-- ── Site-scoped memberships (RBAC scope) ─────────────────────────────────────
-- A member with zero rows here can see ALL sites of the company; one or more
-- rows restrict the member to those sites.
create table if not exists pierre_rt_member_sites (
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  member_id  uuid not null references pierre_rt_members(id) on delete cascade,
  site_id    uuid not null references pierre_rt_sites(id) on delete cascade,
  primary key (member_id, site_id)
);
create index if not exists idx_rt_member_sites_member on pierre_rt_member_sites(member_id);

-- ── Employee 360 — core ──────────────────────────────────────────────────────
create table if not exists pierre_rt_employees (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  site_id             uuid references pierre_rt_sites(id) on delete set null,
  external_ref        text,
  first_name          text not null,
  last_name           text not null,
  email               text,
  phone               text,
  status              text not null default 'active' check (status in ('candidate','onboarding','active','suspended','offboarding','left')),
  contract_type       text not null default 'cdi' check (contract_type in ('cdi','cdd','interim','stage','alternance','freelance','other')),
  role_title          text,
  manager_employee_id uuid references pierre_rt_employees(id) on delete set null,
  sensitivity         text not null default 'normal' check (sensitivity in ('normal','sensitive','restricted')),
  hired_at            date,
  left_at             date,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  unique (company_id, external_ref)
);
create index if not exists idx_rt_employees_company on pierre_rt_employees(company_id, status);
create index if not exists idx_rt_employees_site on pierre_rt_employees(site_id);
create index if not exists idx_rt_employees_company_created on pierre_rt_employees(company_id, created_at desc, id desc);

create table if not exists pierre_rt_employee_events (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade,
  type        text not null,
  actor_type  text not null default 'system',
  actor_id    text,
  metadata    jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_rt_emp_events_emp on pierre_rt_employee_events(employee_id, occurred_at);

create table if not exists pierre_rt_employee_documents (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade,
  kind        text not null,
  title       text not null,
  storage_ref text,
  sensitivity text not null default 'normal' check (sensitivity in ('normal','sensitive','restricted')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_rt_emp_docs_emp on pierre_rt_employee_documents(employee_id);

create table if not exists pierre_rt_employee_absences (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade,
  type        text not null check (type in ('conges_payes','rtt','maladie','sans_solde','autre')),
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'requested' check (status in ('requested','approved','rejected','cancelled')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_rt_emp_absences_emp on pierre_rt_employee_absences(employee_id);

-- ── Wire missions to employees / sites (NOT VALID: safe on existing rows) ─────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_rt_missions_employee') then
    alter table pierre_rt_missions
      add constraint fk_rt_missions_employee foreign key (employee_id) references pierre_rt_employees(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_rt_missions_site') then
    alter table pierre_rt_missions
      add constraint fk_rt_missions_site foreign key (site_id) references pierre_rt_sites(id) on delete set null not valid;
  end if;
end$$;

-- ============================================================================
-- RLS — strict tenant isolation (defense-in-depth) for the new tables.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_sites','pierre_rt_member_sites','pierre_rt_employees',
    'pierre_rt_employee_events','pierre_rt_employee_documents','pierre_rt_employee_absences'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update, delete on %I to pierre_rt_app', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format(
      'create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))',
      t);
  end loop;
end$$;

-- ============================================================================
-- Idempotent backfill: legacy per-user ownership -> companies + owner members.
-- Source of truth for "owns Pierre": orders.status in ('active','trialing')
-- (matches hasPierreAccess) UNION agents_owned. Deterministic company_id = uid
-- (legacy implicit company_id == user_id), so it is 1:1 and re-runnable with no
-- duplication. Guarded with to_regclass so it is safe if a legacy table is absent.
-- ============================================================================
create or replace function pierre_rt_backfill_tenancy()
returns table (companies_created int, members_created int) language plpgsql as $$
declare
  has_orders   boolean := to_regclass('public.orders') is not null;
  has_agents   boolean := to_regclass('public.agents_owned') is not null;
  has_profiles boolean := to_regclass('public.profiles') is not null;
  v_companies  int := 0;
  v_members    int := 0;
begin
  -- Collect distinct owner user ids into a temp table.
  create temporary table _owners (uid uuid primary key) on commit drop;

  if has_orders then
    execute $q$
      insert into _owners(uid)
      select distinct user_id from public.orders
       where user_id is not null and status in ('active','trialing')
      on conflict do nothing
    $q$;
  end if;
  if has_agents then
    -- agents_owned is keyed by client_id (uuid).
    execute $q$
      insert into _owners(uid)
      select distinct client_id from public.agents_owned where client_id is not null
      on conflict do nothing
    $q$;
  end if;

  -- Companies (deterministic id = owner uid). Name from profile/order if present.
  if has_profiles then
    execute $q$
      insert into pierre_rt_companies (id, name)
      select o.uid,
             coalesce(nullif(trim(p.full_name), ''), p.email, 'Entreprise ' || substr(o.uid::text, 1, 8))
      from _owners o left join public.profiles p on p.id = o.uid
      on conflict (id) do nothing
    $q$;
  else
    insert into pierre_rt_companies (id, name)
    select uid, 'Entreprise ' || substr(uid::text, 1, 8) from _owners
    on conflict (id) do nothing;
  end if;
  get diagnostics v_companies = row_count;

  -- Owner membership (one per company, no duplication).
  insert into pierre_rt_members (id, company_id, user_id, role)
  select gen_random_uuid(), uid, uid, 'owner' from _owners
  on conflict (company_id, user_id) do nothing;
  get diagnostics v_members = row_count;

  return query select v_companies, v_members;
end$$;
