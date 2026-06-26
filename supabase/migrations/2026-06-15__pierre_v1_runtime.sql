-- ============================================================================
-- PHASE 8.1 — Pierre Production Runtime Core — canonical runtime schema
-- ----------------------------------------------------------------------------
-- This is the SINGLE canonical governed runtime (namespace pierre_rt_*).
-- It does NOT alter the legacy pierre_missions/pierre_tasks tables used by the
-- existing submit path (left intact); the legacy localStorage "controlled
-- missions" store is deprecated as a source of truth (see docs/migrations).
--
-- Multi-tenant, RLS-enforced, governed, durable-queue ready. Applied by the
-- programmatic runner (scripts/db/migrate.mjs) against a local/test Postgres
-- and (manually, by an operator) against Supabase. Idempotent: re-runnable.
-- ============================================================================

-- gen_random_uuid() is in core Postgres 13+ (no pgcrypto extension required).

-- ── App role used by the runtime for non-service (RLS-enforced) access ──────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_app') then
    create role pierre_rt_app nologin;
  end if;
end$$;

-- ── Tenancy ─────────────────────────────────────────────────────────────────
create table if not exists pierre_rt_companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists pierre_rt_members (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  user_id     uuid not null,
  role        text not null check (role in ('owner','admin','hr_manager','hr_operator','viewer')),
  permissions jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, user_id)
);
create index if not exists idx_rt_members_user on pierre_rt_members(user_id);
create index if not exists idx_rt_members_company on pierre_rt_members(company_id);

-- ── Missions ────────────────────────────────────────────────────────────────
create table if not exists pierre_rt_missions (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  requester_user_id uuid not null,
  employee_id       uuid,
  site_id           uuid,
  parent_mission_id uuid references pierre_rt_missions(id) on delete set null,
  source            text not null default 'cockpit',
  instruction       text not null,
  status            text not null default 'draft' check (status in (
                      'draft','analyzing','awaiting_info','planned','awaiting_validation','ready',
                      'queued','in_progress','partially_completed','done','blocked','failed',
                      'retry_scheduled','cancelled','escalated','archived')),
  risk              text not null default 'low'  check (risk in ('low','medium','high','critical')),
  sensitivity       text not null default 'normal' check (sensitivity in ('normal','sensitive','restricted')),
  autonomy_mode     text not null default 'normal' check (autonomy_mode in ('draft','normal','high_autonomy','enterprise_autonomous')),
  approval_policy   text not null default 'auto_execute',
  summary           text,
  next_action       text,
  correlation_id    uuid not null,
  request_id        uuid not null,
  idempotency_key   text not null,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  archived_at       timestamptz,
  unique (company_id, idempotency_key)
);
create index if not exists idx_rt_missions_company_status on pierre_rt_missions(company_id, status);
create index if not exists idx_rt_missions_company_created on pierre_rt_missions(company_id, created_at desc, id desc);
create index if not exists idx_rt_missions_correlation on pierre_rt_missions(correlation_id);

-- ── Tasks ───────────────────────────────────────────────────────────────────
create table if not exists pierre_rt_tasks (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id        uuid not null references pierre_rt_missions(id) on delete cascade,
  type              text not null,
  objective         text not null,
  status            text not null default 'draft' check (status in (
                      'draft','planned','awaiting_info','awaiting_validation','ready','queued','leased',
                      'in_progress','succeeded','failed','retry_scheduled','blocked','cancelled','escalated','archived')),
  priority          integer not null default 100,
  domain            text not null default 'hr_ops',
  risk              text not null default 'low'  check (risk in ('low','medium','high','critical')),
  sensitivity       text not null default 'normal' check (sensitivity in ('normal','sensitive','restricted')),
  channel           text not null default 'internal',
  approval_required boolean not null default false,
  expected_output   text,
  owner             text not null default 'pierre',
  attempts          integer not null default 0,
  max_attempts      integer not null default 5,
  timeout_ms        integer not null default 30000,
  scheduled_at      timestamptz,
  due_at            timestamptz,
  idempotency_key   text not null,
  version           integer not null default 1,
  result            jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_id, idempotency_key)
);
create index if not exists idx_rt_tasks_mission on pierre_rt_tasks(mission_id);
create index if not exists idx_rt_tasks_company_status on pierre_rt_tasks(company_id, status);

create table if not exists pierre_rt_task_deps (
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  task_id             uuid not null references pierre_rt_tasks(id) on delete cascade,
  depends_on_task_id  uuid not null references pierre_rt_tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id)
);
create index if not exists idx_rt_task_deps_dep on pierre_rt_task_deps(depends_on_task_id);

-- ── Validations (human approval workflow) ───────────────────────────────────
create table if not exists pierre_rt_validations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id     uuid not null references pierre_rt_missions(id) on delete cascade,
  task_id        uuid references pierre_rt_tasks(id) on delete cascade,
  validator_role text not null default 'hr_manager',
  required_count integer not null default 1,
  status         text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested','expired','escalated')),
  reason         text not null,
  risk_context   jsonb not null default '{}'::jsonb,
  decided_by     uuid,
  decided_at     timestamptz,
  expires_at     timestamptz,
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_rt_validations_mission on pierre_rt_validations(mission_id);
create index if not exists idx_rt_validations_company_status on pierre_rt_validations(company_id, status);

-- ── CloneTrace events (persistent timeline) ─────────────────────────────────
create table if not exists pierre_rt_events (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id     uuid references pierre_rt_missions(id) on delete cascade,
  task_id        uuid references pierre_rt_tasks(id) on delete cascade,
  type           text not null,
  actor_type     text not null default 'system',
  actor_id       text,
  request_id     uuid,
  correlation_id uuid,
  prev_state     text,
  new_state      text,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists idx_rt_events_mission on pierre_rt_events(mission_id, created_at);
create index if not exists idx_rt_events_company on pierre_rt_events(company_id, created_at desc, id desc);

-- ── Execution attempts ──────────────────────────────────────────────────────
create table if not exists pierre_rt_execution_attempts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  task_id     uuid not null references pierre_rt_tasks(id) on delete cascade,
  attempt_no  integer not null,
  outcome     text not null check (outcome in ('succeeded','failed','unsupported','blocked','awaiting_integration')),
  detail      jsonb not null default '{}'::jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_rt_attempts_task on pierre_rt_execution_attempts(task_id);

-- ── Durable job queue ───────────────────────────────────────────────────────
create table if not exists pierre_rt_jobs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  task_id          uuid not null references pierre_rt_tasks(id) on delete cascade,
  mission_id       uuid not null references pierre_rt_missions(id) on delete cascade,
  status           text not null default 'ready' check (status in ('ready','retry','leased','succeeded','failed','dead','cancelled')),
  priority         integer not null default 100,
  run_after        timestamptz not null default now(),
  attempts         integer not null default 0,
  max_attempts     integer not null default 5,
  lease_owner      text,
  lease_expires_at timestamptz,
  last_error       text,
  dedup_key        text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, dedup_key)
);
create index if not exists idx_rt_jobs_claim on pierre_rt_jobs(status, run_after, priority desc);
create index if not exists idx_rt_jobs_lease on pierre_rt_jobs(status, lease_expires_at);
create index if not exists idx_rt_jobs_company on pierre_rt_jobs(company_id, status);

create table if not exists pierre_rt_dead_letters (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  job_id     uuid,
  task_id    uuid,
  mission_id uuid,
  reason     text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_rt_dead_company on pierre_rt_dead_letters(company_id, created_at desc);

-- ── Transactional outbox ────────────────────────────────────────────────────
create table if not exists pierre_rt_outbox (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id   uuid,
  task_id      uuid,
  kind         text not null,
  status       text not null default 'pending' check (status in ('pending','dispatched','awaiting_integration','failed')),
  payload      jsonb not null default '{}'::jsonb,
  attempts     integer not null default 0,
  dedup_key    text not null,
  created_at   timestamptz not null default now(),
  dispatched_at timestamptz,
  unique (company_id, dedup_key)
);
create index if not exists idx_rt_outbox_pending on pierre_rt_outbox(status, created_at);

-- ── Idempotency keys ────────────────────────────────────────────────────────
create table if not exists pierre_rt_idempotency (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  scope      text not null,
  key        text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  unique (company_id, scope, key)
);

-- ── Notifications / schedules ───────────────────────────────────────────────
create table if not exists pierre_rt_notifications (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id uuid,
  task_id    uuid,
  kind       text not null,
  body       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_rt_notif_company on pierre_rt_notifications(company_id, created_at desc);

-- ============================================================================
-- Row Level Security — strict tenant isolation (defense-in-depth).
-- The service-role/owner connection bypasses RLS (as in Supabase); any
-- non-superuser app connection (role pierre_rt_app) is restricted to the
-- company bound to GUC app.current_company.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_companies','pierre_rt_members','pierre_rt_missions','pierre_rt_tasks',
    'pierre_rt_task_deps','pierre_rt_validations','pierre_rt_events','pierre_rt_execution_attempts',
    'pierre_rt_jobs','pierre_rt_dead_letters','pierre_rt_outbox','pierre_rt_idempotency',
    'pierre_rt_notifications'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update, delete on %I to pierre_rt_app', t);
  end loop;
end$$;

-- companies: a tenant may only see its own company row
drop policy if exists rt_iso_companies on pierre_rt_companies;
create policy rt_iso_companies on pierre_rt_companies
  using (id::text = current_setting('app.current_company', true))
  with check (id::text = current_setting('app.current_company', true));

-- every other tenant table keys on company_id
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_members','pierre_rt_missions','pierre_rt_tasks','pierre_rt_task_deps',
    'pierre_rt_validations','pierre_rt_events','pierre_rt_execution_attempts','pierre_rt_jobs',
    'pierre_rt_dead_letters','pierre_rt_outbox','pierre_rt_idempotency','pierre_rt_notifications'
  ]
  loop
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format(
      'create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))',
      t);
  end loop;
end$$;
