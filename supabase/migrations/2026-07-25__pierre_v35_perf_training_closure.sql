-- P22 Reprise 10 — additive closure for performance + training (never destructive to v33/v34).
-- Adds: performance_action source type, proof_required gating, training plans/plan_items,
-- performance action_plans (+ action_items.plan_id), performance template sections/questions.

-- 1. training source_type must accept 'performance_action' (the bridge contract).
alter table pierre_rt_training_requirements drop constraint if exists pierre_rt_training_requirements_source_type_check;
alter table pierre_rt_training_requirements add constraint pierre_rt_training_requirements_source_type_check
  check (source_type in ('cloneadn','country_pack','company_policy','provider','human_authorized','performance_action','unsourced'));

-- 2. proof_required gating (default false — non-mandatory-proof requirements/sessions unaffected).
alter table pierre_rt_training_requirements add column if not exists proof_required boolean not null default false;
alter table pierre_rt_training_sessions add column if not exists proof_required boolean not null default false;

-- 2b. enrollments were missing created_at/updated_at (attendance + completion write updated_at). Additive.
alter table pierre_rt_training_enrollments add column if not exists created_at timestamptz not null default now();
alter table pierre_rt_training_enrollments add column if not exists updated_at timestamptz not null default now();

-- 3. training plans + plan items.
create table if not exists pierre_rt_training_plans (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id       uuid references pierre_rt_missions(id) on delete set null,
  plan_key         text not null,
  title            text not null,
  starts_on date, ends_on date,
  mode             text not null default 'copilote' check (mode in ('brouillon','copilote','autonomie')),
  status           text not null default 'draft' check (status in ('draft','preparing','awaiting_validation','approved','in_progress','completed','blocked','cancelled')),
  population_count integer not null default 0,
  validation_id    uuid references pierre_rt_validations(id) on delete set null,
  idempotency_key  text, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
  unique (company_id, idempotency_key), unique (company_id, plan_key)
);
create index if not exists idx_rt_train_plans_company on pierre_rt_training_plans(company_id);

create table if not exists pierre_rt_training_plan_items (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  plan_id         uuid not null references pierre_rt_training_plans(id) on delete cascade,
  requirement_id  uuid references pierre_rt_training_requirements(id) on delete set null,
  source_type     text not null default 'company_policy',
  source_ref      text,
  priority        text not null default 'normal' check (priority in ('low','normal','high','critical')),
  target_population integer, session_id uuid references pierre_rt_training_sessions(id) on delete set null,
  estimated_cost  numeric(14,2), currency text default 'EUR', budget_source text,
  status          text not null default 'open' check (status in ('open','in_progress','done','blocked','cancelled')),
  validation_id   uuid references pierre_rt_validations(id) on delete set null, version integer not null default 1
);
create index if not exists idx_rt_train_plan_items_plan on pierre_rt_training_plan_items(plan_id);

-- 4. performance action plans + link action_items.
create table if not exists pierre_rt_performance_action_plans (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id   uuid references pierre_rt_employees(id) on delete set null,
  interview_id  uuid references pierre_rt_performance_interviews(id) on delete set null,
  campaign_id   uuid references pierre_rt_performance_campaigns(id) on delete set null,
  title         text not null, owner text, starts_on date, ends_on date,
  status        text not null default 'draft' check (status in ('draft','awaiting_validation','validated','in_progress','completed','cancelled')),
  validation_id uuid references pierre_rt_validations(id) on delete set null,
  created_by uuid, created_at timestamptz not null default now(), version integer not null default 1
);
create index if not exists idx_rt_perf_plans_company on pierre_rt_performance_action_plans(company_id);
alter table pierre_rt_performance_action_items add column if not exists plan_id uuid references pierre_rt_performance_action_plans(id) on delete set null;

-- 5. performance template sections + questions (governed, versioned).
create table if not exists pierre_rt_performance_template_sections (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  template_id uuid not null references pierre_rt_performance_templates(id) on delete cascade,
  section_key text not null, title text not null, ordinal integer not null default 0,
  audience    text not null default 'both' check (audience in ('employee','manager','both','hr')),
  required boolean not null default true, version integer not null default 1,
  unique (company_id, template_id, section_key)
);
create table if not exists pierre_rt_performance_template_questions (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  section_id    uuid not null references pierre_rt_performance_template_sections(id) on delete cascade,
  question_key  text not null, label text not null,
  response_type text not null default 'text' check (response_type in ('text','long_text','boolean','number','choice','multi_choice','date')),
  required boolean not null default true,
  visibility text not null default 'restricted' check (visibility in ('restricted','shared')),
  ordinal integer not null default 0, status text not null default 'active' check (status in ('draft','active','archived')), version integer not null default 1,
  unique (company_id, section_id, question_key)
);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_training_plans','pierre_rt_training_plan_items','pierre_rt_performance_action_plans',
    'pierre_rt_performance_template_sections','pierre_rt_performance_template_questions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
