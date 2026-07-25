-- P22 depth — EMPLOYEE onboarding (a salaried arrival), distinct from product onboarding
-- (pierre_rt_onboarding_sessions = company→Pierre). Idempotent, PGlite + Postgres 16, RLS tenant-iso.
-- Reuses pierre_rt_companies/_missions/_employees/_sites/_validations/_files/_documents.

-- A. onboarding case (the arrival dossier)
create table if not exists pierre_rt_employee_onboarding_cases (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id          uuid references pierre_rt_missions(id) on delete set null,
  employee_id         uuid references pierre_rt_employees(id) on delete set null,
  site_id             uuid references pierre_rt_sites(id) on delete set null,
  manager_employee_id uuid references pierre_rt_employees(id) on delete set null,
  job_title           text,
  start_date          date,
  mode                text not null default 'copilote' check (mode in ('brouillon','copilote','autonomie')),
  status              text not null default 'draft'
                      check (status in ('draft','preparing','awaiting_information','awaiting_validation','ready','in_progress','blocked','completed','cancelled')),
  progress_percent    integer not null default 0,
  blocking_reason     text,
  validation_id       uuid references pierre_rt_validations(id) on delete set null,
  idempotency_key     text,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (company_id, idempotency_key)
);
create index if not exists idx_rt_onb_cases_company on pierre_rt_employee_onboarding_cases(company_id);
create index if not exists idx_rt_onb_cases_employee on pierre_rt_employee_onboarding_cases(employee_id);

-- B. onboarding steps
create table if not exists pierre_rt_employee_onboarding_steps (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id             uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  step_key            text not null,
  category            text not null check (category in ('identity','contract','documents','equipment','access','communication','calendar','manager','team','day_one','week_one','month_one','probation','other')),
  label               text not null,
  step_ordinal        integer not null default 0,
  owner_type          text not null default 'pierre' check (owner_type in ('pierre','manager','hr','employee','it')),
  due_at              timestamptz,
  status              text not null default 'pending' check (status in ('pending','ready','in_progress','completed','blocked','skipped')),
  required            boolean not null default true,
  validation_required boolean not null default false,
  validation_id       uuid references pierre_rt_validations(id) on delete set null,
  completed_at        timestamptz,
  proof_ref           text,
  version             integer not null default 1,
  unique (company_id, case_id, step_key)
);
create index if not exists idx_rt_onb_steps_case on pierre_rt_employee_onboarding_steps(case_id);

-- C. required documents / conditions
create table if not exists pierre_rt_employee_onboarding_requirements (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id          uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  requirement_type text not null,
  label            text not null,
  required         boolean not null default true,
  blocking         boolean not null default false,
  status           text not null default 'missing' check (status in ('missing','requested','received','verified','waived')),
  requested_at     timestamptz,
  received_at      timestamptz,
  file_id          uuid references pierre_rt_files(id) on delete set null,
  version          integer not null default 1,
  unique (company_id, case_id, requirement_type)
);
create index if not exists idx_rt_onb_reqs_case on pierre_rt_employee_onboarding_requirements(case_id);

-- D. equipment / assets
create table if not exists pierre_rt_employee_onboarding_assets (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id      uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  asset_type   text not null,
  label        text not null,
  owner        text,
  required_by  date,
  status       text not null default 'planned' check (status in ('planned','ordered','prepared','delivered','blocked')),
  provider_ref text,
  notes        text,
  version      integer not null default 1
);
create index if not exists idx_rt_onb_assets_case on pierre_rt_employee_onboarding_assets(case_id);

-- E. access intents (never a fake provisioning — an intent until a provider is configured)
create table if not exists pierre_rt_employee_onboarding_access_intents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id         uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  system_key      text not null,
  access_level    text,
  requested_for   date,
  status          text not null default 'prepared' check (status in ('prepared','requested','provisioned','integration_unavailable','revoked','blocked')),
  provider_ref    text,
  blocking_reason text,
  version         integer not null default 1
);
create index if not exists idx_rt_onb_access_case on pierre_rt_employee_onboarding_access_intents(case_id);

-- F. communications (draft until validated + provider available)
create table if not exists pierre_rt_employee_onboarding_communications (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id            uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  communication_type text not null,
  recipient          text,
  subject            text,
  document_id        uuid references pierre_rt_documents(id) on delete set null,
  scheduled_at       timestamptz,
  status             text not null default 'draft' check (status in ('draft','awaiting_validation','ready','sent','integration_unavailable','cancelled')),
  provider_ref       text,
  version            integer not null default 1
);
create index if not exists idx_rt_onb_comms_case on pierre_rt_employee_onboarding_communications(case_id);

-- G. calendar intents
create table if not exists pierre_rt_employee_onboarding_calendar_intents (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id      uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  event_type   text not null,
  title        text not null,
  participants jsonb not null default '[]'::jsonb,
  starts_at    timestamptz,
  ends_at      timestamptz,
  location     text,
  status       text not null default 'prepared' check (status in ('prepared','awaiting_validation','ready','created','integration_unavailable','cancelled')),
  provider_ref text,
  version      integer not null default 1
);
create index if not exists idx_rt_onb_cal_case on pierre_rt_employee_onboarding_calendar_intents(case_id);

-- H. follow-ups (day1/week1/month1/probation)
create table if not exists pierre_rt_employee_onboarding_followups (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  case_id       uuid not null references pierre_rt_employee_onboarding_cases(id) on delete cascade,
  followup_type text not null check (followup_type in ('day_one','week_one','month_one','probation_end','custom')),
  due_at        timestamptz,
  owner         text,
  status        text not null default 'scheduled' check (status in ('scheduled','done','cancelled','overdue')),
  result        text,
  version       integer not null default 1
);
create index if not exists idx_rt_onb_followups_case on pierre_rt_employee_onboarding_followups(case_id);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_employee_onboarding_cases','pierre_rt_employee_onboarding_steps',
    'pierre_rt_employee_onboarding_requirements','pierre_rt_employee_onboarding_assets',
    'pierre_rt_employee_onboarding_access_intents','pierre_rt_employee_onboarding_communications',
    'pierre_rt_employee_onboarding_calendar_intents','pierre_rt_employee_onboarding_followups'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
