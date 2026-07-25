-- P22 depth — PRE-PAYROLL (collect/verify/reconcile/structure/export). Pierre is NOT a legal payroll
-- engine and NEVER emits a DSN. Idempotent, PGlite + Postgres 16, RLS tenant-iso. Reuses employees /
-- absences / missions / files / documents / validations. Variables keep their source (source_type+id)
-- so a real absence maps to exactly one payroll variable (no blind copy, no double collection).

create table if not exists pierre_rt_payroll_periods (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id       uuid references pierre_rt_missions(id) on delete set null,
  period_key       text not null,
  starts_on        date not null,
  ends_on          date not null,
  population_count integer not null default 0,
  status           text not null default 'draft'
                   check (status in ('draft','collecting','awaiting_information','under_review','awaiting_validation','ready_to_export','exported','transmission_prepared','transmitted','reconciling','completed','blocked','cancelled')),
  mode             text not null default 'copilote' check (mode in ('brouillon','copilote','autonomie')),
  opened_by        uuid,
  closed_by        uuid,
  validation_id    uuid references pierre_rt_validations(id) on delete set null,
  provider_ref     text,
  idempotency_key  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  version          integer not null default 1,
  unique (company_id, idempotency_key),
  unique (company_id, period_key)
);
create index if not exists idx_rt_pay_periods_company on pierre_rt_payroll_periods(company_id);

create table if not exists pierre_rt_payroll_variables (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  period_id           uuid not null references pierre_rt_payroll_periods(id) on delete cascade,
  employee_id         uuid references pierre_rt_employees(id) on delete set null,
  mission_id          uuid references pierre_rt_missions(id) on delete set null,
  variable_type       text not null check (variable_type in ('entry','exit','contract_change','absence','paid_leave','sick_leave','lateness','regular_hours','overtime','additional_hours','bonus','advance','benefit','meal','indemnity','expense','adjustment','other')),
  source_type         text not null default 'manual',
  source_id           uuid,
  quantity            numeric(12,2),
  amount              numeric(14,2),
  currency            text not null default 'EUR',
  starts_on           date,
  ends_on             date,
  status              text not null default 'draft' check (status in ('draft','needs_evidence','collected','validated','rejected','excluded')),
  validation_required boolean not null default false,
  validation_id       uuid references pierre_rt_validations(id) on delete set null,
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  -- Idempotence of collection: one variable per (period, employee, type, source).
  unique (company_id, period_id, employee_id, variable_type, source_id)
);
create index if not exists idx_rt_pay_vars_period on pierre_rt_payroll_variables(period_id);
create index if not exists idx_rt_pay_vars_emp on pierre_rt_payroll_variables(employee_id);

create table if not exists pierre_rt_payroll_variable_evidence (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  period_id     uuid not null references pierre_rt_payroll_periods(id) on delete cascade,
  variable_id   uuid not null references pierre_rt_payroll_variables(id) on delete cascade,
  employee_id   uuid references pierre_rt_employees(id) on delete set null,
  file_id       uuid references pierre_rt_files(id) on delete set null,
  evidence_type text not null,
  required      boolean not null default true,
  status        text not null default 'missing' check (status in ('missing','requested','received','verified','waived')),
  requested_at  timestamptz,
  received_at   timestamptz,
  verified_at   timestamptz,
  version       integer not null default 1
);
create index if not exists idx_rt_pay_evidence_var on pierre_rt_payroll_variable_evidence(variable_id);

create table if not exists pierre_rt_payroll_anomalies (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  period_id     uuid not null references pierre_rt_payroll_periods(id) on delete cascade,
  employee_id   uuid references pierre_rt_employees(id) on delete set null,
  variable_id   uuid references pierre_rt_payroll_variables(id) on delete set null,
  anomaly_type  text not null check (anomaly_type in ('missing_evidence','duplicate_variable','overlapping_period','invalid_date_range','unexpected_amount','absence_without_variable','variable_without_employee','contract_period_mismatch','entry_exit_inconsistency','unresolved_previous_period','provider_rejection','other')),
  severity      text not null default 'warning' check (severity in ('info','warning','high','critical')),
  description   text,
  detected_from text,
  status        text not null default 'open' check (status in ('open','acknowledged','resolved','waived')),
  owner         text,
  validation_id uuid references pierre_rt_validations(id) on delete set null,
  resolution    text,
  dedup_key     text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  version       integer not null default 1,
  unique (company_id, period_id, dedup_key)
);
create index if not exists idx_rt_pay_anom_period on pierre_rt_payroll_anomalies(period_id);

create table if not exists pierre_rt_payroll_exports (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  period_id      uuid not null references pierre_rt_payroll_periods(id) on delete cascade,
  format         text not null default 'csv' check (format in ('csv','xlsx','canonical_json')),
  schema_version text not null default '1',
  status         text not null default 'draft' check (status in ('draft','awaiting_validation','validated','transmission_prepared','transmitted','integration_unavailable','superseded')),
  row_count      integer not null default 0,
  hash           text,
  validation_id  uuid references pierre_rt_validations(id) on delete set null,
  file_id        uuid references pierre_rt_files(id) on delete set null,
  document_id    uuid references pierre_rt_documents(id) on delete set null,
  provider_ref   text,
  generated_by   uuid,
  generated_at   timestamptz not null default now(),
  version        integer not null default 1
);
create index if not exists idx_rt_pay_exports_period on pierre_rt_payroll_exports(period_id);

create table if not exists pierre_rt_payroll_export_rows (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  export_id   uuid not null references pierre_rt_payroll_exports(id) on delete cascade,
  employee_id uuid references pierre_rt_employees(id) on delete set null,
  payload     jsonb not null default '{}'::jsonb,
  row_ordinal integer not null default 0,
  version     integer not null default 1
);
create index if not exists idx_rt_pay_export_rows_export on pierre_rt_payroll_export_rows(export_id);

create table if not exists pierre_rt_payroll_reconciliations (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  period_id         uuid not null references pierre_rt_payroll_periods(id) on delete cascade,
  export_id         uuid references pierre_rt_payroll_exports(id) on delete set null,
  provider          text not null,
  provider_event_id text,
  result_status     text not null default 'received' check (result_status in ('received','accepted','partially_rejected','rejected')),
  accepted_rows     integer not null default 0,
  rejected_rows     integer not null default 0,
  errors            jsonb not null default '[]'::jsonb,
  received_at       timestamptz not null default now(),
  applied_at        timestamptz,
  version           integer not null default 1,
  -- No double webhook: one reconciliation per (period, provider_event_id).
  unique (company_id, period_id, provider_event_id)
);
create index if not exists idx_rt_pay_recon_period on pierre_rt_payroll_reconciliations(period_id);

do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_payroll_periods','pierre_rt_payroll_variables','pierre_rt_payroll_variable_evidence',
    'pierre_rt_payroll_anomalies','pierre_rt_payroll_exports','pierre_rt_payroll_export_rows',
    'pierre_rt_payroll_reconciliations'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end $$;
