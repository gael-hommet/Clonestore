-- P22 — canonical HR domain business objects for the 4 remaining semantic gaps.
-- Minimal-but-real, idempotent, PGlite + Postgres 16 compatible. Reuses existing FKs
-- (pierre_rt_companies / _missions / _employees / _sites / _validations). RLS: tenant isolation
-- via current_setting('app.current_company') — the same pattern as pierre_v2. No legal rules invented.

-- ── A. Workforce planning ────────────────────────────────────────────────────────────────
create table if not exists pierre_rt_workforce_plans (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id        uuid references pierre_rt_missions(id) on delete set null,
  site_id           uuid references pierre_rt_sites(id) on delete set null,
  period            text not null,
  current_headcount integer not null default 0,
  target_headcount  integer not null default 0,
  proposed_positions jsonb not null default '[]'::jsonb,
  assumptions       jsonb not null default '{}'::jsonb,
  estimated_budget  numeric(14,2),
  status            text not null default 'draft' check (status in ('draft','proposed','approved','rejected','archived')),
  validation_id     uuid references pierre_rt_validations(id) on delete set null,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  version           integer not null default 1
);
create index if not exists idx_rt_workforce_plans_company on pierre_rt_workforce_plans(company_id);
create index if not exists idx_rt_workforce_plans_mission on pierre_rt_workforce_plans(mission_id);

-- ── B. Recruitment (requisition + candidate with pipeline state) ─────────────────────────
create table if not exists pierre_rt_recruitment_requisitions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id    uuid references pierre_rt_missions(id) on delete set null,
  site_id       uuid references pierre_rt_sites(id) on delete set null,
  role_title    text not null,
  headcount     integer not null default 1,
  contract_type text,
  status        text not null default 'open' check (status in ('open','on_hold','filled','closed','cancelled')),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
create index if not exists idx_rt_requisitions_company on pierre_rt_recruitment_requisitions(company_id);

create table if not exists pierre_rt_recruitment_candidates (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  requisition_id  uuid references pierre_rt_recruitment_requisitions(id) on delete cascade,
  mission_id      uuid references pierre_rt_missions(id) on delete set null,
  full_name       text not null,
  source          text,
  pipeline_stage  text not null default 'new' check (pipeline_stage in ('new','screening','interview','reference','offer','hired','rejected','withdrawn')),
  status          text not null default 'active' check (status in ('active','on_hold','closed')),
  metadata        jsonb not null default '{}'::jsonb,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);
create index if not exists idx_rt_candidates_company on pierre_rt_recruitment_candidates(company_id);
create index if not exists idx_rt_candidates_req on pierre_rt_recruitment_candidates(requisition_id);

-- ── C. HR helpdesk requests (tickets) ────────────────────────────────────────────────────
create table if not exists pierre_rt_hr_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id    uuid references pierre_rt_missions(id) on delete set null,
  employee_id   uuid references pierre_rt_employees(id) on delete set null,
  category      text not null default 'general' check (category in ('general','payroll','absence','contract','onboarding','sensitive','other')),
  subject       text not null,
  body          text,
  status        text not null default 'open' check (status in ('open','in_progress','awaiting_info','escalated','resolved','closed')),
  priority      text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  owner_user_id uuid,
  sla_due_at    timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1
);
create index if not exists idx_rt_hr_requests_company on pierre_rt_hr_requests(company_id);
create index if not exists idx_rt_hr_requests_status on pierre_rt_hr_requests(company_id, status);

-- ── D. Country configuration + pack bindings ─────────────────────────────────────────────
create table if not exists pierre_rt_country_configs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  country_code  text not null check (country_code in ('FR','BE','LU','CH')),
  pack_key      text not null,
  config        jsonb not null default '{}'::jsonb,
  status        text not null default 'draft' check (status in ('draft','active','suspended')),
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  version       integer not null default 1,
  unique (company_id, country_code)
);
create index if not exists idx_rt_country_configs_company on pierre_rt_country_configs(company_id);

-- ── RLS: tenant isolation (same pattern as pierre_v2) ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_workforce_plans','pierre_rt_recruitment_requisitions','pierre_rt_recruitment_candidates',
    'pierre_rt_hr_requests','pierre_rt_country_configs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format(
      'drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format(
      'create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
