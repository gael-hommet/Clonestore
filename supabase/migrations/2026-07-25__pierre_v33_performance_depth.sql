-- P22 depth — PERFORMANCE / interviews. Pierre prepares/organizes/tracks; it NEVER auto-decides a
-- score, promotion, sanction or ranking. Idempotent, PGlite + Postgres 16, RLS tenant-iso. Reuses
-- employees / sites / missions / validations / documents.

create table if not exists pierre_rt_performance_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id         uuid references pierre_rt_missions(id) on delete set null,
  campaign_key       text not null,
  title              text not null,
  campaign_type      text not null default 'annual_review' check (campaign_type in ('annual_review','professional_review','probation_review','return_to_work','manager_followup','feedback_campaign','career_review','other')),
  starts_on          date, ends_on date,
  mode               text not null default 'copilote' check (mode in ('brouillon','copilote','autonomie')),
  status             text not null default 'draft' check (status in ('draft','preparing','in_progress','under_review','completed','blocked','cancelled')),
  population_count    integer not null default 0,
  completion_percent  integer not null default 0,
  validation_id      uuid references pierre_rt_validations(id) on delete set null,
  idempotency_key    text,
  created_by         uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
  unique (company_id, idempotency_key), unique (company_id, campaign_key)
);
create index if not exists idx_rt_perf_camp_company on pierre_rt_performance_campaigns(company_id);

create table if not exists pierre_rt_performance_campaign_participants (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  campaign_id         uuid not null references pierre_rt_performance_campaigns(id) on delete cascade,
  employee_id         uuid not null references pierre_rt_employees(id) on delete cascade,
  manager_employee_id uuid references pierre_rt_employees(id) on delete set null,
  site_id             uuid references pierre_rt_sites(id) on delete set null,
  status              text not null default 'pending' check (status in ('pending','invited','in_progress','completed','blocked','cancelled')),
  due_at              timestamptz, invited_at timestamptz, completed_at timestamptz, blocking_reason text,
  version integer not null default 1,
  unique (company_id, campaign_id, employee_id)
);
create index if not exists idx_rt_perf_part_campaign on pierre_rt_performance_campaign_participants(campaign_id);

create table if not exists pierre_rt_performance_templates (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  template_key  text not null,
  title         text not null,
  template_type text not null default 'annual_review',
  structure     jsonb not null default '{"sections":[]}'::jsonb,   -- sections + questions (versioned)
  status        text not null default 'active' check (status in ('draft','active','archived')),
  version integer not null default 1, created_at timestamptz not null default now(),
  unique (company_id, template_key)
);

create table if not exists pierre_rt_performance_interviews (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references pierre_rt_companies(id) on delete cascade,
  campaign_id        uuid references pierre_rt_performance_campaigns(id) on delete cascade,
  participant_id     uuid references pierre_rt_performance_campaign_participants(id) on delete cascade,
  employee_id        uuid not null references pierre_rt_employees(id) on delete cascade,
  manager_employee_id uuid references pierre_rt_employees(id) on delete set null,
  interview_type     text not null default 'annual_review',
  template_id        uuid references pierre_rt_performance_templates(id) on delete set null,
  scheduled_at       timestamptz,
  status             text not null default 'draft' check (status in ('draft','prepared','scheduled','awaiting_employee','awaiting_manager','under_review','awaiting_validation','completed','blocked','cancelled')),
  validation_id      uuid references pierre_rt_validations(id) on delete set null,
  completed_at       timestamptz, version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_rt_perf_iv_campaign on pierre_rt_performance_interviews(campaign_id);
create index if not exists idx_rt_perf_iv_emp on pierre_rt_performance_interviews(employee_id);

create table if not exists pierre_rt_performance_responses (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  interview_id   uuid not null references pierre_rt_performance_interviews(id) on delete cascade,
  respondent_type text not null check (respondent_type in ('employee','manager','hr')),
  respondent_id  uuid,
  question_key   text not null,
  response       text,
  visibility     text not null default 'restricted' check (visibility in ('restricted','shared')),
  submitted_at   timestamptz not null default now(), version integer not null default 1,
  unique (company_id, interview_id, respondent_type, question_key)
);
create index if not exists idx_rt_perf_resp_iv on pierre_rt_performance_responses(interview_id);

create table if not exists pierre_rt_performance_summaries (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references pierre_rt_companies(id) on delete cascade,
  interview_id       uuid not null references pierre_rt_performance_interviews(id) on delete cascade,
  structured_summary jsonb not null default '{}'::jsonb,
  status             text not null default 'draft' check (status in ('draft','awaiting_validation','validated','superseded')),
  validation_id      uuid references pierre_rt_validations(id) on delete set null,
  document_id        uuid references pierre_rt_documents(id) on delete set null,
  version integer not null default 1, created_at timestamptz not null default now(),
  unique (company_id, interview_id)
);

create table if not exists pierre_rt_performance_objectives (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id      uuid not null references pierre_rt_employees(id) on delete cascade,
  interview_id     uuid references pierre_rt_performance_interviews(id) on delete set null,
  campaign_id      uuid references pierre_rt_performance_campaigns(id) on delete set null,
  title            text not null, description text, success_criteria text,
  starts_on date, due_on date, owner text,
  status           text not null default 'open' check (status in ('open','in_progress','achieved','partially_achieved','cancelled')),
  progress integer not null default 0, validation_id uuid references pierre_rt_validations(id) on delete set null,
  version integer not null default 1, created_at timestamptz not null default now()
);
create index if not exists idx_rt_perf_obj_emp on pierre_rt_performance_objectives(employee_id);

create table if not exists pierre_rt_performance_action_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id   uuid references pierre_rt_employees(id) on delete set null,
  interview_id  uuid references pierre_rt_performance_interviews(id) on delete set null,
  campaign_id   uuid references pierre_rt_performance_campaigns(id) on delete set null,
  plan_key      text,
  action        text not null, owner text, due_on date,
  status        text not null default 'open' check (status in ('open','in_progress','done','overdue','cancelled')),
  proof_ref     text, result text, version integer not null default 1, created_at timestamptz not null default now()
);
create index if not exists idx_rt_perf_action_emp on pierre_rt_performance_action_items(employee_id);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_performance_campaigns','pierre_rt_performance_campaign_participants','pierre_rt_performance_templates',
    'pierre_rt_performance_interviews','pierre_rt_performance_responses','pierre_rt_performance_summaries',
    'pierre_rt_performance_objectives','pierre_rt_performance_action_items'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
