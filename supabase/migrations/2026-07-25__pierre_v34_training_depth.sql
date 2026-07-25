-- P22 depth — TRAINING / certifications. Pierre NEVER invents a legal obligation, duration, periodicity,
-- accreditation or an obtained certification. A mandatory requirement without a verified source is
-- CONFIGURATION_REQUIRED. No certification without a proof. Idempotent, PGlite + Postgres 16, RLS.

create table if not exists pierre_rt_training_requirements (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id       uuid references pierre_rt_missions(id) on delete set null,
  requirement_key  text not null,
  title            text not null, description text,
  source_type      text not null default 'unsourced' check (source_type in ('cloneadn','country_pack','company_policy','provider','human_authorized','unsourced')),
  source_ref       text,
  applies_to       text not null default 'all',
  mandatory        boolean not null default false,
  recurrence_rule  text, validity_months integer,
  -- mandatory + unsourced => configuration_required (never a fabricated legal obligation)
  status           text not null default 'active' check (status in ('draft','active','configuration_required','archived')),
  validation_id    uuid references pierre_rt_validations(id) on delete set null,
  version integer not null default 1, created_at timestamptz not null default now(),
  unique (company_id, requirement_key)
);
create index if not exists idx_rt_train_req_company on pierre_rt_training_requirements(company_id);

create table if not exists pierre_rt_training_sessions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  requirement_id uuid references pierre_rt_training_requirements(id) on delete set null,
  title          text not null, provider text, delivery_mode text default 'onsite',
  starts_at timestamptz, ends_at timestamptz, location text, capacity integer,
  status         text not null default 'draft' check (status in ('draft','scheduled','completed','cancelled')),
  validation_id  uuid references pierre_rt_validations(id) on delete set null,
  version integer not null default 1, created_at timestamptz not null default now()
);
create index if not exists idx_rt_train_sess_company on pierre_rt_training_sessions(company_id);

create table if not exists pierre_rt_training_enrollments (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  session_id          uuid not null references pierre_rt_training_sessions(id) on delete cascade,
  employee_id         uuid not null references pierre_rt_employees(id) on delete cascade,
  requirement_id      uuid references pierre_rt_training_requirements(id) on delete set null,
  status              text not null default 'draft' check (status in ('draft','invited','confirmed','attended','absent','completed','cancelled','blocked')),
  invited_at timestamptz, confirmed_at timestamptz, completed_at timestamptz, cancellation_reason text,
  idempotency_key text, version integer not null default 1,
  unique (company_id, session_id, employee_id)
);
create index if not exists idx_rt_train_enr_session on pierre_rt_training_enrollments(session_id);
create index if not exists idx_rt_train_enr_emp on pierre_rt_training_enrollments(employee_id);

create table if not exists pierre_rt_training_attendance (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  enrollment_id     uuid not null references pierre_rt_training_enrollments(id) on delete cascade,
  employee_id       uuid references pierre_rt_employees(id) on delete set null,
  attendance_status text not null check (attendance_status in ('present','absent','partial','excused')),
  recorded_by uuid, recorded_at timestamptz not null default now(), evidence_ref text, version integer not null default 1,
  unique (company_id, enrollment_id)
);

create table if not exists pierre_rt_training_proofs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  enrollment_id  uuid references pierre_rt_training_enrollments(id) on delete cascade,
  employee_id    uuid references pierre_rt_employees(id) on delete set null,
  requirement_id uuid references pierre_rt_training_requirements(id) on delete set null,
  proof_type     text not null, file_id uuid references pierre_rt_files(id) on delete set null,
  issued_on date, verified_on date,
  status         text not null default 'received' check (status in ('missing','received','verified','rejected')),
  version integer not null default 1, created_at timestamptz not null default now()
);
create index if not exists idx_rt_train_proof_enr on pierre_rt_training_proofs(enrollment_id);

create table if not exists pierre_rt_training_certifications (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id       uuid not null references pierre_rt_employees(id) on delete cascade,
  requirement_id    uuid references pierre_rt_training_requirements(id) on delete set null,
  proof_id          uuid references pierre_rt_training_proofs(id) on delete set null,
  certification_key text not null,
  issued_on date, expires_on date,
  status            text not null default 'pending' check (status in ('pending','valid','expiring','expired','revoked','unverified')),
  provider_ref text, version integer not null default 1, created_at timestamptz not null default now(),
  unique (company_id, employee_id, certification_key)
);
create index if not exists idx_rt_train_cert_emp on pierre_rt_training_certifications(employee_id);

create table if not exists pierre_rt_training_renewals (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  certification_id uuid not null references pierre_rt_training_certifications(id) on delete cascade,
  employee_id      uuid references pierre_rt_employees(id) on delete set null,
  due_on date,
  status           text not null default 'scheduled' check (status in ('scheduled','in_progress','completed','cancelled','overdue')),
  session_id uuid references pierre_rt_training_sessions(id) on delete set null, blocking_reason text,
  version integer not null default 1, created_at timestamptz not null default now(),
  unique (company_id, certification_id)
);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_training_requirements','pierre_rt_training_sessions','pierre_rt_training_enrollments',
    'pierre_rt_training_attendance','pierre_rt_training_proofs','pierre_rt_training_certifications','pierre_rt_training_renewals'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
