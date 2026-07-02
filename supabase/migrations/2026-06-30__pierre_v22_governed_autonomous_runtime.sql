-- supabase/migrations/2026-06-30__pierre_v22_governed_autonomous_runtime.sql
-- PHASE 8.5 — GOVERNED AUTONOMOUS RUNTIME. Durable missions become replayable RUNS compiled from an
-- IMMUTABLE plan version into typed STEP RUNS, each executed by exactly one durable RUNTIME JOB under a
-- claim+lease+heartbeat worker with a monotonic FENCING TOKEN (the decisive gap: no prior claim family
-- had one — a stale re-claiming worker could finalize someone else's work). Steps can WAIT durably on a
-- timer, an approval (pierre_rt_validations), or an external event; a SCHEDULER fires due waits/schedules
-- and a RECOVERY sweeper reclaims expired leases (bumping the fencing generation). Delivery truth is
-- governed-only: every mutator is SECURITY DEFINER, derives the tenant from app.current_company, asserts
-- ownership+fencing+lease, returns idempotently on a terminal state BEFORE raising. The runtime NEVER
-- sends email or calls a signature provider directly — it emits governed outbox events + calls the P8.4
-- communication pipeline and the P8.3 signature services. Idempotent, non-destructive, PGlite-OK, v1→v22.
-- NEVER applied to production by this session (operator checkpoint).

-- ── dedicated least-privilege runtime roles ─────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname='pierre_rt_runtime_scheduler') then execute 'create role pierre_rt_runtime_scheduler nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='pierre_rt_runtime_worker') then execute 'create role pierre_rt_runtime_worker nologin'; end if;
end$$;

-- composite uniques on the EXISTING parents referenced by the new tenant-safe composite FKs
create unique index if not exists uq_pierre_rt_missions_company_id on pierre_rt_missions(company_id, id);
create unique index if not exists uq_pierre_rt_tasks_company_id on pierre_rt_tasks(company_id, id);
create unique index if not exists uq_pierre_rt_validations_company_id on pierre_rt_validations(company_id, id);

-- ── R: immutable, fingerprinted mission PLAN VERSIONS ────────────────────────────────
create table if not exists pierre_rt_mission_plan_versions (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id         uuid not null,
  version_number     integer not null,
  plan_schema_version text not null default '1',
  plan_fingerprint   text not null,
  plan_json          jsonb not null,
  compiled_graph_json jsonb,
  status             text not null default 'active' check (status in ('active','superseded')),
  supersedes_version_id uuid,
  created_by         uuid,
  compiled_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (company_id, mission_id, version_number)
);
create unique index if not exists uq_pierre_rt_plan_version_company_id on pierre_rt_mission_plan_versions(company_id, id);
create unique index if not exists uq_pierre_rt_plan_version_fingerprint on pierre_rt_mission_plan_versions(company_id, mission_id, plan_fingerprint);

-- ── mission RUNS (a replayable execution of a plan version; mission stays the rollup) ──
create table if not exists pierre_rt_mission_runs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id       uuid not null,
  plan_version_id  uuid not null,
  run_number       integer not null,
  status           text not null default 'queued' check (status in (
                     'queued','running','waiting','paused','blocked','cancelling','cancelled','completed','failed','dead_lettered')),
  autonomy_level   text not null default 'normal',
  current_blocker_code text,
  requested_by     uuid,
  correlation_id   uuid,
  version          integer not null default 1,
  started_at       timestamptz,
  waiting_since    timestamptz,
  paused_at        timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  failed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, mission_id, run_number)
);
create unique index if not exists uq_pierre_rt_mission_run_company_id on pierre_rt_mission_runs(company_id, id);
create index if not exists idx_pierre_rt_mission_runs_status on pierre_rt_mission_runs(company_id, status);

-- ── STEP RUNS (typed action units beneath tasks; one runtime job per step) ────────────
create table if not exists pierre_rt_step_runs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_run_id   uuid not null,
  task_id          uuid,
  plan_version_id  uuid not null,
  step_key         text not null,
  step_ordinal     integer not null default 0,
  action_key       text not null,
  action_version   text not null default '1',
  status           text not null default 'pending' check (status in (
                     'pending','ready','queued','processing','waiting','succeeded','skipped','blocked','failed','dead_lettered','cancelled')),
  dependency_count integer not null default 0,
  satisfied_dependency_count integer not null default 0,
  input_json       jsonb not null default '{}'::jsonb,
  input_hash       text,
  output_json      jsonb,
  output_hash      text,
  waiting_reason   text,
  blocker_code     text,
  version          integer not null default 1,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, mission_run_id, step_key)
);
create unique index if not exists uq_pierre_rt_step_run_company_id on pierre_rt_step_runs(company_id, id);
create index if not exists idx_pierre_rt_step_runs_run on pierre_rt_step_runs(company_id, mission_run_id, status);

create table if not exists pierre_rt_step_deps (
  company_id           uuid not null references pierre_rt_companies(id) on delete cascade,
  step_run_id          uuid not null,
  depends_on_step_run_id uuid not null,
  primary key (step_run_id, depends_on_step_run_id)
);

-- ── durable RUNTIME JOBS (one per step) — v20 lease column-set + FENCING TOKEN ────────
create table if not exists pierre_rt_runtime_jobs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id       uuid not null,
  mission_run_id   uuid not null,
  step_run_id      uuid not null,
  action_key       text not null,
  action_version   text not null default '1',
  status           text not null default 'queued' check (status in (
                     'queued','scheduled','processing','waiting_reconciliation','retry_scheduled','succeeded','failed','dead_letter','cancelled')),
  priority         integer not null default 100,
  scheduled_at     timestamptz,
  available_at     timestamptz not null default now(),
  claimed_at       timestamptz,
  locked_by        text,
  lease_expires_at timestamptz,
  heartbeat_at     timestamptz,
  fencing_token    bigint not null default 0,
  attempt_count    integer not null default 0,
  max_attempts     integer not null default 5,
  next_retry_at    timestamptz,
  idempotency_key  text,
  input_hash       text,
  output_hash      text,
  last_error_code  text,
  last_error_safe  text,
  completed_at     timestamptz,
  dead_lettered_at timestamptz,
  correlation_id   uuid,
  dedup_key        text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, dedup_key)
);
create unique index if not exists uq_pierre_rt_runtime_job_company_id on pierre_rt_runtime_jobs(company_id, id);
create index if not exists idx_pierre_rt_runtime_jobs_claim on pierre_rt_runtime_jobs(status, available_at, priority desc);
create index if not exists idx_pierre_rt_runtime_jobs_lease on pierre_rt_runtime_jobs(status, lease_expires_at);

-- ── append-only RUNTIME JOB ATTEMPTS (single source of attempt truth, records fencing) ─
create table if not exists pierre_rt_runtime_job_attempts (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  job_id           uuid not null,
  attempt_number   integer not null,
  worker_id        text not null,
  fencing_token    bigint not null,
  result_status    text not null,
  error_code_safe  text,
  error_class      text,
  input_hash       text,
  output_hash      text,
  external_effect_reference text,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_pierre_rt_runtime_attempts_job on pierre_rt_runtime_job_attempts(company_id, job_id);

-- ── durable WAITS (timer / approval / external event) ─────────────────────────────────
create table if not exists pierre_rt_runtime_waits (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_run_id   uuid not null,
  step_run_id      uuid not null,
  wait_kind        text not null check (wait_kind in ('timer','approval','external_event')),
  event_kind       text,
  object_type      text,
  object_id        uuid,
  expected_fingerprint text,
  validation_id    uuid,
  wake_at          timestamptz,
  status           text not null default 'pending' check (status in ('pending','satisfied','expired','cancelled')),
  resolved_by_event_id uuid,
  resolved_at      timestamptz,
  expires_at       timestamptz,
  timeout_policy   text not null default 'block',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_runtime_wait_company_id on pierre_rt_runtime_waits(company_id, id);
create unique index if not exists uq_pierre_rt_runtime_wait_step_open on pierre_rt_runtime_waits(company_id, step_run_id) where status='pending';
create index if not exists idx_pierre_rt_runtime_waits_due on pierre_rt_runtime_waits(status, wake_at);
create index if not exists idx_pierre_rt_runtime_waits_match on pierre_rt_runtime_waits(company_id, status, event_kind, object_type, object_id);

-- ── append-only CHECKPOINTS (resumable, PII-free state hashes) ────────────────────────
create table if not exists pierre_rt_runtime_checkpoints (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_run_id   uuid not null,
  step_run_id      uuid not null,
  job_id           uuid,
  checkpoint_kind  text not null,
  checkpoint_sequence integer not null default 0,
  state_hash       text,
  external_reference text,
  checkpoint_json  jsonb not null default '{}'::jsonb,
  fencing_token    bigint,
  created_at       timestamptz not null default now()
);
create index if not exists idx_pierre_rt_runtime_checkpoints_step on pierre_rt_runtime_checkpoints(company_id, step_run_id);

-- ── durable SCHEDULES (timers / bounded recurrence / follow-up relances) ──────────────
create table if not exists pierre_rt_runtime_schedules (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  mission_id       uuid,
  mission_run_id   uuid,
  step_run_id      uuid,
  schedule_kind    text not null check (schedule_kind in ('once','after_delay','recurring')),
  timezone         text not null default 'UTC',
  run_at           timestamptz,
  recurrence_rule  text,
  max_occurrences  integer,
  occurrence_count integer not null default 0,
  next_run_at      timestamptz,
  status           text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  reason           text,
  payload          jsonb not null default '{}'::jsonb,
  stop_condition   jsonb,
  locked_by        text,
  lease_expires_at timestamptz,
  dedup_key        text not null,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  updated_at       timestamptz not null default now(),
  unique (company_id, dedup_key)
);
create index if not exists idx_pierre_rt_runtime_schedules_due on pierre_rt_runtime_schedules(status, next_run_at);

-- ── runtime EVENT ingestion ledger (append-only, idempotent wakeup feed) ──────────────
create table if not exists pierre_rt_runtime_events (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid,
  mission_run_id   uuid,
  step_run_id      uuid,
  job_id           uuid,
  source           text not null,
  event_key        text not null,
  kind             text not null,
  object_type      text,
  object_id        uuid,
  payload_hash     text not null,
  occurred_at      timestamptz,
  received_at      timestamptz not null default now(),
  applied_at       timestamptz,
  application_status text not null default 'pending' check (application_status in ('pending','applied','ignored','duplicate','conflict')),
  correlation_id   uuid
);
create unique index if not exists uq_pierre_rt_runtime_events_dedup on pierre_rt_runtime_events(source, event_key);
create index if not exists idx_pierre_rt_runtime_events_pending on pierre_rt_runtime_events(company_id, application_status) where application_status='pending';

-- ── EXTEND existing surfaces (one unified timeline + one dead-letter concept) ─────────
alter table pierre_rt_events add column if not exists mission_run_id uuid;
alter table pierre_rt_events add column if not exists step_run_id uuid;
alter table pierre_rt_events add column if not exists runtime_job_id uuid;

alter table pierre_rt_dead_letters add column if not exists mission_run_id uuid;
alter table pierre_rt_dead_letters add column if not exists step_run_id uuid;
alter table pierre_rt_dead_letters add column if not exists runtime_job_id uuid;
alter table pierre_rt_dead_letters add column if not exists fencing_token bigint;
alter table pierre_rt_dead_letters add column if not exists reason_code text;
alter table pierre_rt_dead_letters add column if not exists review_status text;

-- the runtime is a SEPARATE consumer of the outbox wakeup bus (never overload status / comm_*)
alter table pierre_rt_outbox add column if not exists rt_processing_status text;
alter table pierre_rt_outbox add column if not exists rt_processed_at timestamptz;
create index if not exists idx_pierre_rt_outbox_rt_pending on pierre_rt_outbox(company_id, rt_processing_status) where rt_processing_status is null or rt_processing_status='pending';

-- ── tenant-safe composite FKs ─────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_rt_plan_mission_ct') then alter table pierre_rt_mission_plan_versions add constraint fk_rt_plan_mission_ct foreign key (company_id, mission_id) references pierre_rt_missions(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_run_mission_ct') then alter table pierre_rt_mission_runs add constraint fk_rt_run_mission_ct foreign key (company_id, mission_id) references pierre_rt_missions(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_run_plan_ct') then alter table pierre_rt_mission_runs add constraint fk_rt_run_plan_ct foreign key (company_id, plan_version_id) references pierre_rt_mission_plan_versions(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_step_run_ct') then alter table pierre_rt_step_runs add constraint fk_rt_step_run_ct foreign key (company_id, mission_run_id) references pierre_rt_mission_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_step_task_ct') then alter table pierre_rt_step_runs add constraint fk_rt_step_task_ct foreign key (company_id, task_id) references pierre_rt_tasks(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_stepdep_step_ct') then alter table pierre_rt_step_deps add constraint fk_rt_stepdep_step_ct foreign key (company_id, step_run_id) references pierre_rt_step_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_stepdep_dep_ct') then alter table pierre_rt_step_deps add constraint fk_rt_stepdep_dep_ct foreign key (company_id, depends_on_step_run_id) references pierre_rt_step_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_job_run_ct') then alter table pierre_rt_runtime_jobs add constraint fk_rt_job_run_ct foreign key (company_id, mission_run_id) references pierre_rt_mission_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_job_step_ct') then alter table pierre_rt_runtime_jobs add constraint fk_rt_job_step_ct foreign key (company_id, step_run_id) references pierre_rt_step_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_attempt_job_ct') then alter table pierre_rt_runtime_job_attempts add constraint fk_rt_attempt_job_ct foreign key (company_id, job_id) references pierre_rt_runtime_jobs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_wait_run_ct') then alter table pierre_rt_runtime_waits add constraint fk_rt_wait_run_ct foreign key (company_id, mission_run_id) references pierre_rt_mission_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_wait_step_ct') then alter table pierre_rt_runtime_waits add constraint fk_rt_wait_step_ct foreign key (company_id, step_run_id) references pierre_rt_step_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_wait_validation_ct') then alter table pierre_rt_runtime_waits add constraint fk_rt_wait_validation_ct foreign key (company_id, validation_id) references pierre_rt_validations(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_ckpt_run_ct') then alter table pierre_rt_runtime_checkpoints add constraint fk_rt_ckpt_run_ct foreign key (company_id, mission_run_id) references pierre_rt_mission_runs(company_id, id); end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_ckpt_step_ct') then alter table pierre_rt_runtime_checkpoints add constraint fk_rt_ckpt_step_ct foreign key (company_id, step_run_id) references pierre_rt_step_runs(company_id, id); end if;
end$$;

-- ── append-only triggers (attempts + checkpoints) ─────────────────────────────────────
create or replace function pierre_rt_runtime_append_only() returns trigger as $$
begin raise exception 'append-only table %', TG_TABLE_NAME using errcode='0A000'; end; $$ language plpgsql;
drop trigger if exists trg_rt_attempt_no_upd on pierre_rt_runtime_job_attempts;
drop trigger if exists trg_rt_attempt_no_del on pierre_rt_runtime_job_attempts;
create trigger trg_rt_attempt_no_upd before update on pierre_rt_runtime_job_attempts for each row execute function pierre_rt_runtime_append_only();
create trigger trg_rt_attempt_no_del before delete on pierre_rt_runtime_job_attempts for each row execute function pierre_rt_runtime_append_only();
drop trigger if exists trg_rt_ckpt_no_upd on pierre_rt_runtime_checkpoints;
drop trigger if exists trg_rt_ckpt_no_del on pierre_rt_runtime_checkpoints;
create trigger trg_rt_ckpt_no_upd before update on pierre_rt_runtime_checkpoints for each row execute function pierre_rt_runtime_append_only();
create trigger trg_rt_ckpt_no_del before delete on pierre_rt_runtime_checkpoints for each row execute function pierre_rt_runtime_append_only();

-- ── RLS (forced; strict per-tenant; NO `company_id is null OR …` leak) ────────────────
do $$ declare t text; begin
  foreach t in array array[
    'pierre_rt_mission_plan_versions','pierre_rt_mission_runs','pierre_rt_step_runs','pierre_rt_step_deps',
    'pierre_rt_runtime_jobs','pierre_rt_runtime_job_attempts','pierre_rt_runtime_waits',
    'pierre_rt_runtime_checkpoints','pierre_rt_runtime_schedules','pierre_rt_runtime_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%s on %I', t, t);
    if t = 'pierre_rt_runtime_events' then
      -- the ingestion ledger may hold an unresolved (null-company) row; it is invisible to tenant roles
      execute format('create policy rt_iso_%s on %I using (company_id is not null and company_id::text = current_setting(''app.current_company'', true)) with check (company_id is not null and company_id::text = current_setting(''app.current_company'', true))', t, t);
    else
      execute format('create policy rt_iso_%s on %I using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t, t);
    end if;
  end loop;
end$$;

-- ── grants: app reads runtime state; the runtime worker/scheduler are least-privilege ─
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
    execute 'grant select on pierre_rt_mission_plan_versions, pierre_rt_mission_runs, pierre_rt_step_runs, pierre_rt_runtime_jobs, pierre_rt_runtime_waits, pierre_rt_runtime_checkpoints, pierre_rt_runtime_schedules, pierre_rt_runtime_events to pierre_rt_app';
    -- the app may create a plan version + a queued run/step/job via governed functions (SECURITY DEFINER);
    -- it may directly INSERT a plan/run/step/job only in the queued/initial state (guard below), never truth.
    execute 'grant insert on pierre_rt_mission_plan_versions, pierre_rt_mission_runs, pierre_rt_step_runs, pierre_rt_step_deps, pierre_rt_runtime_jobs, pierre_rt_runtime_schedules to pierre_rt_app';
  end if;
  -- the WORKER role may read only the runtime tables it needs (never a business table)
  if exists (select 1 from pg_roles where rolname='pierre_rt_runtime_worker') then
    execute 'grant select on pierre_rt_mission_runs, pierre_rt_step_runs, pierre_rt_runtime_jobs, pierre_rt_runtime_waits, pierre_rt_runtime_checkpoints to pierre_rt_runtime_worker';
  end if;
  -- the SCHEDULER role may read jobs/schedules/waits/runs (never a business table)
  if exists (select 1 from pg_roles where rolname='pierre_rt_runtime_scheduler') then
    execute 'grant select on pierre_rt_runtime_jobs, pierre_rt_runtime_schedules, pierre_rt_runtime_waits, pierre_rt_mission_runs, pierre_rt_runtime_events to pierre_rt_runtime_scheduler';
  end if;
end$$;

-- guard: the app role may only INSERT a queued/initial runtime job (never a fabricated terminal/processing truth)
create or replace function pierre_rt_runtime_job_app_insert_guard() returns trigger as $$
begin
  if current_user = 'pierre_rt_app' and NEW.status not in ('queued','scheduled') then
    raise exception 'the app role may only create queued/scheduled runtime jobs' using errcode='42501';
  end if;
  return NEW;
end; $$ language plpgsql;
drop trigger if exists trg_rt_job_app_insert on pierre_rt_runtime_jobs;
create trigger trg_rt_job_app_insert before insert on pierre_rt_runtime_jobs for each row execute function pierre_rt_runtime_job_app_insert_guard();

-- ════════════════════════════════════════════════════════════════════════════════════
-- GOVERNED FUNCTIONS — tenant derived from app.current_company; ownership + FENCING + lease
-- asserted on every mutation; terminal-state idempotent early-return BEFORE any raise.
-- ════════════════════════════════════════════════════════════════════════════════════

-- PII-free CloneTrace row on the unified timeline.
create or replace function pierre_rt_runtime_log(p_company uuid, p_mission_run uuid, p_step_run uuid, p_job uuid, p_type text, p_prev text, p_new text, p_meta jsonb)
returns void as $$
declare v_mission uuid;
begin
  if p_mission_run is not null then select mission_id into v_mission from pierre_rt_mission_runs where company_id=p_company and id=p_mission_run; end if;
  insert into pierre_rt_events (id, company_id, mission_id, mission_run_id, step_run_id, runtime_job_id, type, actor_type, prev_state, new_state, metadata)
  values (gen_random_uuid(), p_company, v_mission, p_mission_run, p_step_run, p_job, p_type, 'runtime', p_prev, p_new, coalesce(p_meta,'{}'::jsonb));
end; $$ language plpgsql security definer;

-- enqueue one runtime job for a READY step (idempotent on dedup_key); flips the step to queued.
create or replace function pierre_rt_runtime_enqueue_step(p_company uuid, p_step_run_id uuid)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; s record; v_job uuid; v_dedup text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into s from pierre_rt_step_runs where company_id=v_company and id=p_step_run_id;
  if not found then raise exception 'step not found' using errcode='23503'; end if;
  if s.status not in ('ready') then return null; end if;
  v_dedup := 'step:'||p_step_run_id::text;
  select mr.mission_id into v_job from pierre_rt_mission_runs mr where mr.company_id=v_company and mr.id=s.mission_run_id; -- reuse var for mission id
  v_job := gen_random_uuid();
  insert into pierre_rt_runtime_jobs (id, company_id, mission_id, mission_run_id, step_run_id, action_key, action_version, status, idempotency_key, input_hash, dedup_key)
  select v_job, v_company, mr.mission_id, s.mission_run_id, p_step_run_id, s.action_key, s.action_version, 'queued', 'step:'||p_step_run_id::text, s.input_hash, v_dedup
    from pierre_rt_mission_runs mr where mr.company_id=v_company and mr.id=s.mission_run_id
  on conflict (company_id, dedup_key) do nothing;
  update pierre_rt_step_runs set status='queued', updated_at=now() where company_id=v_company and id=p_step_run_id and status='ready';
  return (select id from pierre_rt_runtime_jobs where company_id=v_company and dedup_key=v_dedup);
end; $$ language plpgsql security definer;

-- promote the dependents of a just-succeeded step, then enqueue every newly-ready step of the run.
create or replace function pierre_rt_runtime_cascade(p_company uuid, p_mission_run_id uuid, p_succeeded_step uuid)
returns void as $$
declare r record;
begin
  if p_succeeded_step is not null then
    update pierre_rt_step_runs s set satisfied_dependency_count=satisfied_dependency_count+1, updated_at=now()
     where s.company_id=p_company and s.status='pending'
       and s.id in (select step_run_id from pierre_rt_step_deps where company_id=p_company and depends_on_step_run_id=p_succeeded_step);
  end if;
  update pierre_rt_step_runs s set status='ready', updated_at=now()
   where s.company_id=p_company and s.mission_run_id=p_mission_run_id and s.status='pending' and s.satisfied_dependency_count >= s.dependency_count;
  for r in select id from pierre_rt_step_runs where company_id=p_company and mission_run_id=p_mission_run_id and status='ready' loop
    perform pierre_rt_runtime_enqueue_step(p_company, r.id);
  end loop;
end; $$ language plpgsql security definer;

-- mark the run completed if no step remains active and none failed/blocked.
create or replace function pierre_rt_runtime_maybe_complete_run(p_company uuid, p_mission_run_id uuid)
returns void as $$
declare v_active int; v_bad int;
begin
  select count(*) into v_active from pierre_rt_step_runs where company_id=p_company and mission_run_id=p_mission_run_id and status in ('pending','ready','queued','processing','waiting');
  select count(*) into v_bad from pierre_rt_step_runs where company_id=p_company and mission_run_id=p_mission_run_id and status in ('blocked','failed','dead_lettered');
  if v_active=0 and v_bad=0 then
    update pierre_rt_mission_runs set status='completed', completed_at=now(), updated_at=now(), version=version+1
     where company_id=p_company and id=p_mission_run_id and status in ('running','waiting');
    perform pierre_rt_runtime_log(p_company, p_mission_run_id, null, null, 'mission.completed', 'running', 'completed', '{}'::jsonb);
  end if;
end; $$ language plpgsql security definer;

-- create a mission run from a compiled plan version (idempotent: one active run per plan version).
create or replace function pierre_rt_create_mission_run(p_company uuid, p_mission_id uuid, p_plan_version_id uuid, p_requested_by uuid, p_correlation_id uuid, p_autonomy text)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_existing uuid; v_id uuid; v_num int;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select id into v_existing from pierre_rt_mission_runs where company_id=v_company and mission_id=p_mission_id and plan_version_id=p_plan_version_id and status not in ('cancelled','completed','failed','dead_lettered') limit 1;
  if found then return v_existing; end if;
  select coalesce(max(run_number),0)+1 into v_num from pierre_rt_mission_runs where company_id=v_company and mission_id=p_mission_id;
  v_id := gen_random_uuid();
  insert into pierre_rt_mission_runs (id, company_id, mission_id, plan_version_id, run_number, status, autonomy_level, requested_by, correlation_id, started_at)
  values (v_id, v_company, p_mission_id, p_plan_version_id, v_num, 'running', coalesce(p_autonomy,'normal'), p_requested_by, p_correlation_id, now());
  perform pierre_rt_runtime_log(v_company, v_id, null, null, 'mission.run_created', null, 'running', jsonb_build_object('plan_version_id', p_plan_version_id::text));
  -- enqueue the initial ready steps (steps with no dependency)
  perform pierre_rt_runtime_cascade(v_company, v_id, null);
  return v_id;
end; $$ language plpgsql security definer;

-- claim due runtime jobs atomically (FOR UPDATE SKIP LOCKED) — BUMPS the fencing token.
create or replace function pierre_rt_runtime_claim(p_company uuid, p_limit int, p_worker text, p_lease_seconds int, p_now timestamptz)
returns setof pierre_rt_runtime_jobs as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  return query
  update pierre_rt_runtime_jobs j
     set status='processing', claimed_at=p_now, locked_by=p_worker, heartbeat_at=p_now,
         lease_expires_at=p_now + make_interval(secs=>greatest(p_lease_seconds,1)),
         attempt_count=j.attempt_count+1, fencing_token=j.fencing_token+1, updated_at=p_now
   where j.id in (
     select id from pierre_rt_runtime_jobs
      where company_id=v_company
        and ( (status in ('queued','scheduled') and (available_at is null or available_at<=p_now))
              or (status='retry_scheduled' and (next_retry_at is null or next_retry_at<=p_now))
              or (status='processing' and lease_expires_at < p_now) )
      order by priority desc, coalesce(available_at, created_at) asc
      for update skip locked
      limit greatest(p_limit,0)
   )
   returning j.*;
end; $$ language plpgsql security definer;

-- mark the step processing-started (worker owns the lease + fencing).
create or replace function pierre_rt_runtime_start_step(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  if j.lease_expires_at is null or j.lease_expires_at <= now() then raise exception 'job lease expired' using errcode='42501'; end if;
  update pierre_rt_step_runs set status='processing', started_at=coalesce(started_at, now()), updated_at=now()
   where company_id=v_company and id=j.step_run_id and status in ('queued','ready','processing');
  update pierre_rt_mission_runs set status='running', updated_at=now() where company_id=v_company and id=j.mission_run_id and status in ('queued','waiting');
end; $$ language plpgsql security definer;

-- heartbeat a long-running job (extends the lease) — ownership + fencing + lease asserted.
create or replace function pierre_rt_runtime_heartbeat(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint, p_lease_seconds int)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.status in ('succeeded','failed','dead_letter','cancelled') then return; end if;
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  if j.lease_expires_at is null or j.lease_expires_at <= now() then raise exception 'job lease expired' using errcode='42501'; end if;
  update pierre_rt_runtime_jobs set heartbeat_at=now(), lease_expires_at=now()+make_interval(secs=>greatest(p_lease_seconds,1)), updated_at=now()
   where company_id=v_company and id=p_job_id;
end; $$ language plpgsql security definer;

-- append an attempt row (append-only; records the fencing generation for forensics).
create or replace function pierre_rt_runtime_record_attempt(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint, p_result_status text, p_error_code text, p_error_class text, p_input_hash text, p_output_hash text, p_external_ref text)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_runtime_job_attempts (id, company_id, job_id, attempt_number, worker_id, fencing_token, result_status, error_code_safe, error_class, input_hash, output_hash, external_effect_reference, finished_at)
  values (v_id, v_company, p_job_id, coalesce(j.attempt_count,1), p_worker, p_fencing_token, p_result_status, p_error_code, p_error_class, p_input_hash, p_output_hash, p_external_ref, now());
  return v_id;
end; $$ language plpgsql security definer;

-- a worker-written checkpoint (append-only).
create or replace function pierre_rt_runtime_checkpoint(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint, p_kind text, p_sequence int, p_state_hash text, p_external_ref text, p_json jsonb)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_runtime_checkpoints (id, company_id, mission_run_id, step_run_id, job_id, checkpoint_kind, checkpoint_sequence, state_hash, external_reference, checkpoint_json, fencing_token)
  values (v_id, v_company, j.mission_run_id, j.step_run_id, p_job_id, p_kind, coalesce(p_sequence,0), p_state_hash, p_external_ref, coalesce(p_json,'{}'::jsonb), p_fencing_token);
  return v_id;
end; $$ language plpgsql security definer;

-- complete a job: the step SUCCEEDS → cascade dependents; or the step is blocked/skipped.
create or replace function pierre_rt_runtime_complete_job(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint, p_step_status text, p_output_hash text, p_output_json jsonb)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.status='succeeded' then return; end if; -- idempotent
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  if j.lease_expires_at is null or j.lease_expires_at <= now() then raise exception 'job lease expired' using errcode='42501'; end if;
  update pierre_rt_runtime_jobs set status='succeeded', completed_at=now(), output_hash=p_output_hash, locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=null, updated_at=now()
   where company_id=v_company and id=p_job_id;
  update pierre_rt_step_runs set status=p_step_status, output_hash=p_output_hash, output_json=coalesce(p_output_json, output_json), completed_at=now(), updated_at=now(), version=version+1
   where company_id=v_company and id=j.step_run_id;
  perform pierre_rt_runtime_log(v_company, j.mission_run_id, j.step_run_id, p_job_id, 'runtime.step_'||p_step_status, 'processing', p_step_status, '{}'::jsonb);
  if p_step_status='succeeded' then
    perform pierre_rt_runtime_cascade(v_company, j.mission_run_id, j.step_run_id);
    perform pierre_rt_runtime_maybe_complete_run(v_company, j.mission_run_id);
  elsif p_step_status='blocked' then
    update pierre_rt_mission_runs set status='blocked', current_blocker_code='step_blocked', updated_at=now() where company_id=v_company and id=j.mission_run_id and status in ('running','waiting');
  elsif p_step_status='skipped' then
    perform pierre_rt_runtime_cascade(v_company, j.mission_run_id, j.step_run_id);
    perform pierre_rt_runtime_maybe_complete_run(v_company, j.mission_run_id);
  end if;
end; $$ language plpgsql security definer;

-- a step needs to WAIT: the job succeeds (it registered the wait), the step waits, a durable wait row is created.
create or replace function pierre_rt_runtime_wait_job(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint, p_wait_kind text, p_event_kind text, p_object_type text, p_object_id uuid, p_expected_fingerprint text, p_validation_id uuid, p_wake_at timestamptz, p_expires_at timestamptz)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record; v_wait uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.status='succeeded' then return (select id from pierre_rt_runtime_waits where company_id=v_company and step_run_id=j.step_run_id and status='pending' limit 1); end if;
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  if j.lease_expires_at is null or j.lease_expires_at <= now() then raise exception 'job lease expired' using errcode='42501'; end if;
  v_wait := gen_random_uuid();
  insert into pierre_rt_runtime_waits (id, company_id, mission_run_id, step_run_id, wait_kind, event_kind, object_type, object_id, expected_fingerprint, validation_id, wake_at, expires_at, status)
  values (v_wait, v_company, j.mission_run_id, j.step_run_id, p_wait_kind, p_event_kind, p_object_type, p_object_id, p_expected_fingerprint, p_validation_id, p_wake_at, p_expires_at, 'pending');
  update pierre_rt_runtime_jobs set status='succeeded', completed_at=now(), locked_by=null, claimed_at=null, lease_expires_at=null, updated_at=now() where company_id=v_company and id=p_job_id;
  update pierre_rt_step_runs set status='waiting', waiting_reason=p_wait_kind, updated_at=now() where company_id=v_company and id=j.step_run_id;
  update pierre_rt_mission_runs set status='waiting', waiting_since=now(), updated_at=now() where company_id=v_company and id=j.mission_run_id and status='running';
  perform pierre_rt_runtime_log(v_company, j.mission_run_id, j.step_run_id, p_job_id, 'runtime.wait_created', 'processing', 'waiting', jsonb_build_object('wait_kind', p_wait_kind));
  return v_wait;
end; $$ language plpgsql security definer;

-- resolve a wait → the waiting step SUCCEEDS and the run advances. Idempotent + match-checked.
create or replace function pierre_rt_resolve_runtime_wait(p_company uuid, p_wait_id uuid, p_event_id uuid, p_event_kind text, p_object_type text, p_object_id uuid, p_fingerprint text)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; w record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into w from pierre_rt_runtime_waits where company_id=v_company and id=p_wait_id;
  if not found then raise exception 'wait not found' using errcode='23503'; end if;
  if w.status<>'pending' then return 'already_'||w.status; end if; -- idempotent: never resolve twice
  -- match the event to the wait (kind/object/fingerprint when declared)
  if w.event_kind is not null and p_event_kind is distinct from w.event_kind then return 'ignored_kind'; end if;
  if w.object_type is not null and p_object_type is distinct from w.object_type then return 'ignored_object_type'; end if;
  if w.object_id is not null and p_object_id is distinct from w.object_id then return 'ignored_object_id'; end if;
  if w.expected_fingerprint is not null and p_fingerprint is distinct from w.expected_fingerprint then return 'ignored_fingerprint'; end if;
  -- mission cancelled/paused → do not resume
  if exists (select 1 from pierre_rt_mission_runs where company_id=v_company and id=w.mission_run_id and status in ('cancelled','cancelling','paused')) then return 'ignored_run_inactive'; end if;
  update pierre_rt_runtime_waits set status='satisfied', resolved_by_event_id=p_event_id, resolved_at=now(), updated_at=now() where company_id=v_company and id=p_wait_id;
  update pierre_rt_step_runs set status='succeeded', completed_at=now(), updated_at=now(), version=version+1 where company_id=v_company and id=w.step_run_id and status='waiting';
  update pierre_rt_mission_runs set status='running', waiting_since=null, updated_at=now() where company_id=v_company and id=w.mission_run_id and status='waiting';
  perform pierre_rt_runtime_log(v_company, w.mission_run_id, w.step_run_id, null, 'runtime.wait_resolved', 'waiting', 'succeeded', jsonb_build_object('event_kind', p_event_kind));
  perform pierre_rt_runtime_cascade(v_company, w.mission_run_id, w.step_run_id);
  perform pierre_rt_runtime_maybe_complete_run(v_company, w.mission_run_id);
  return 'resolved';
end; $$ language plpgsql security definer;

-- fail a job: retry (bounded backoff) → reconcile (submission ambiguous) → dead-letter / block.
create or replace function pierre_rt_runtime_fail_job(p_company uuid, p_job_id uuid, p_worker text, p_fencing_token bigint, p_error_code text, p_error_safe text, p_disposition text, p_retry_after_seconds int, p_max_attempts int)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; j record; v_final text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into j from pierre_rt_runtime_jobs where company_id=v_company and id=p_job_id;
  if not found then raise exception 'job not found' using errcode='23503'; end if;
  if j.status in ('succeeded','dead_letter','cancelled') then return j.status; end if; -- idempotent
  if j.locked_by is distinct from p_worker then raise exception 'worker does not own this job lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from j.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  if p_disposition='reconcile' then
    update pierre_rt_runtime_jobs set status='waiting_reconciliation', next_retry_at=now()+make_interval(secs=>greatest(coalesce(p_retry_after_seconds,60),1)), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_code=p_error_code, last_error_safe=left(coalesce(p_error_safe,'submission_unknown'),200), updated_at=now() where company_id=v_company and id=p_job_id;
    update pierre_rt_step_runs set status='waiting', waiting_reason='submission_unknown', updated_at=now() where company_id=v_company and id=j.step_run_id;
    v_final := 'waiting_reconciliation';
  elsif p_disposition='block' then
    update pierre_rt_runtime_jobs set status='failed', locked_by=null, claimed_at=null, lease_expires_at=null, last_error_code=p_error_code, last_error_safe=left(coalesce(p_error_safe,'blocked'),200), updated_at=now() where company_id=v_company and id=p_job_id;
    update pierre_rt_step_runs set status='blocked', blocker_code=p_error_code, updated_at=now() where company_id=v_company and id=j.step_run_id;
    update pierre_rt_mission_runs set status='blocked', current_blocker_code=p_error_code, updated_at=now() where company_id=v_company and id=j.mission_run_id and status in ('running','waiting');
    v_final := 'blocked';
  elsif p_disposition='permanent' or j.attempt_count >= coalesce(p_max_attempts, j.max_attempts) then
    update pierre_rt_runtime_jobs set status='dead_letter', dead_lettered_at=now(), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_code=p_error_code, last_error_safe=left(coalesce(p_error_safe,'dead_letter'),200), updated_at=now() where company_id=v_company and id=p_job_id;
    update pierre_rt_step_runs set status='dead_lettered', blocker_code=p_error_code, updated_at=now() where company_id=v_company and id=j.step_run_id;
    update pierre_rt_mission_runs set status='blocked', current_blocker_code='dead_letter', updated_at=now() where company_id=v_company and id=j.mission_run_id and status in ('running','waiting');
    insert into pierre_rt_dead_letters (id, company_id, job_id, task_id, mission_id, mission_run_id, step_run_id, runtime_job_id, fencing_token, reason, reason_code, review_status, payload)
    values (gen_random_uuid(), v_company, p_job_id, null, j.mission_id, j.mission_run_id, j.step_run_id, p_job_id, j.fencing_token, left(coalesce(p_error_safe,'dead_letter'),200), p_error_code, 'pending', '{}'::jsonb);
    v_final := 'dead_letter';
  else
    update pierre_rt_runtime_jobs set status='retry_scheduled', next_retry_at=now()+make_interval(secs=>greatest(coalesce(p_retry_after_seconds,60),1)), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_code=p_error_code, last_error_safe=left(coalesce(p_error_safe,'retry'),200), updated_at=now() where company_id=v_company and id=p_job_id;
    v_final := 'retry_scheduled';
  end if;
  perform pierre_rt_runtime_log(v_company, j.mission_run_id, j.step_run_id, p_job_id, 'runtime.job_'||v_final, 'processing', v_final, jsonb_build_object('error_code', p_error_code));
  return v_final;
end; $$ language plpgsql security definer;

-- recover expired-lease processing jobs (sweeper) — reclaims to retry, BUMPS the fencing generation,
-- and records the superseded generation so a stale worker is positively rejected.
create or replace function pierre_rt_recover_runtime_leases(p_company uuid, p_now timestamptz, p_limit int)
returns integer as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; r record; v_count int := 0;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  for r in
    update pierre_rt_runtime_jobs j
       set status='retry_scheduled', next_retry_at=p_now, locked_by=null, claimed_at=null, lease_expires_at=null,
           fencing_token=j.fencing_token+1, updated_at=p_now
     where j.id in (
       select id from pierre_rt_runtime_jobs where company_id=v_company and status='processing' and lease_expires_at < p_now
       order by lease_expires_at asc for update skip locked limit greatest(coalesce(p_limit,100),0)
     )
     returning j.id, j.mission_run_id, j.step_run_id, j.fencing_token
  loop
    perform pierre_rt_runtime_log(v_company, r.mission_run_id, r.step_run_id, r.id, 'runtime.job_recovered', 'processing', 'retry_scheduled', jsonb_build_object('superseded_generation', (r.fencing_token-1)::text, 'new_generation', r.fencing_token::text));
    v_count := v_count + 1;
  end loop;
  return v_count;
end; $$ language plpgsql security definer;

-- claim due schedules (scheduler) atomically; the scheduler only makes work available.
create or replace function pierre_rt_claim_due_schedules(p_company uuid, p_limit int, p_worker text, p_lease_seconds int, p_now timestamptz)
returns setof pierre_rt_runtime_schedules as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  return query
  update pierre_rt_runtime_schedules s set locked_by=p_worker, lease_expires_at=p_now+make_interval(secs=>greatest(p_lease_seconds,1)), updated_at=p_now
   where s.id in (
     select id from pierre_rt_runtime_schedules where company_id=v_company and status='active' and next_run_at is not null and next_run_at<=p_now
       and (lease_expires_at is null or lease_expires_at<p_now)
     order by next_run_at asc for update skip locked limit greatest(p_limit,0)
   ) returning s.*;
end; $$ language plpgsql security definer;

-- advance a fired schedule occurrence (bounded recurrence) — the scheduler does NOT execute the action.
create or replace function pierre_rt_fire_schedule(p_company uuid, p_schedule_id uuid, p_worker text, p_next_run_at timestamptz)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; s record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into s from pierre_rt_runtime_schedules where company_id=v_company and id=p_schedule_id;
  if not found then raise exception 'schedule not found' using errcode='23503'; end if;
  if s.locked_by is distinct from p_worker then raise exception 'scheduler does not own this schedule lease' using errcode='42501'; end if;
  if s.status<>'active' then return s.status; end if;
  if s.schedule_kind in ('once','after_delay') then
    update pierre_rt_runtime_schedules set status='completed', occurrence_count=occurrence_count+1, next_run_at=null, locked_by=null, lease_expires_at=null, updated_at=now() where company_id=v_company and id=p_schedule_id;
    perform pierre_rt_runtime_log(v_company, s.mission_run_id, s.step_run_id, null, 'runtime.schedule_fired', 'active', 'completed', '{}'::jsonb);
    return 'completed';
  else
    if s.max_occurrences is not null and (s.occurrence_count+1) >= s.max_occurrences then
      update pierre_rt_runtime_schedules set status='completed', occurrence_count=occurrence_count+1, next_run_at=null, locked_by=null, lease_expires_at=null, updated_at=now() where company_id=v_company and id=p_schedule_id;
      perform pierre_rt_runtime_log(v_company, s.mission_run_id, s.step_run_id, null, 'runtime.schedule_fired', 'active', 'completed', jsonb_build_object('reason','max_occurrences'));
      return 'completed';
    end if;
    update pierre_rt_runtime_schedules set occurrence_count=occurrence_count+1, next_run_at=p_next_run_at, locked_by=null, lease_expires_at=null, updated_at=now() where company_id=v_company and id=p_schedule_id;
    perform pierre_rt_runtime_log(v_company, s.mission_run_id, s.step_run_id, null, 'runtime.schedule_fired', 'active', 'active', '{}'::jsonb);
    return 'rescheduled';
  end if;
end; $$ language plpgsql security definer;

-- ingest a runtime event into the append-only ledger (idempotent on source+event_key).
create or replace function pierre_rt_ingest_runtime_event(p_company uuid, p_source text, p_event_key text, p_kind text, p_object_type text, p_object_id uuid, p_payload_hash text, p_occurred_at timestamptz)
returns text as $$
declare v_existing record; v_id uuid;
begin
  select id, payload_hash into v_existing from pierre_rt_runtime_events where source=p_source and event_key=p_event_key;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash then return 'conflict'; end if;
    return 'duplicate';
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_runtime_events (id, company_id, source, event_key, kind, object_type, object_id, payload_hash, occurred_at, application_status)
  values (v_id, p_company, p_source, p_event_key, p_kind, p_object_type, p_object_id, p_payload_hash, p_occurred_at, 'pending');
  return 'received';
end; $$ language plpgsql security definer;

-- mission run pause / resume / cancel (app-operator state machine).
create or replace function pierre_rt_pause_mission_run(p_company uuid, p_mission_run_id uuid)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_mission_runs set status='paused', paused_at=now(), updated_at=now(), version=version+1 where company_id=v_company and id=p_mission_run_id and status in ('running','waiting','queued');
  -- prevent new claims: queued jobs are held by flipping to scheduled-far-future
  update pierre_rt_runtime_jobs set status='scheduled', available_at='infinity', updated_at=now() where company_id=v_company and mission_run_id=p_mission_run_id and status in ('queued','retry_scheduled');
  perform pierre_rt_runtime_log(v_company, p_mission_run_id, null, null, 'mission.paused', null, 'paused', '{}'::jsonb);
end; $$ language plpgsql security definer;

create or replace function pierre_rt_resume_mission_run(p_company uuid, p_mission_run_id uuid)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_mission_runs set status='running', paused_at=null, updated_at=now(), version=version+1 where company_id=v_company and id=p_mission_run_id and status='paused';
  update pierre_rt_runtime_jobs set status='queued', available_at=now(), updated_at=now() where company_id=v_company and mission_run_id=p_mission_run_id and status='scheduled' and available_at='infinity';
  perform pierre_rt_runtime_log(v_company, p_mission_run_id, null, null, 'mission.resumed', 'paused', 'running', '{}'::jsonb);
end; $$ language plpgsql security definer;

create or replace function pierre_rt_request_cancel_mission_run(p_company uuid, p_mission_run_id uuid)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_mission_runs set status='cancelling', updated_at=now(), version=version+1 where company_id=v_company and id=p_mission_run_id and status in ('running','waiting','paused','queued','blocked');
  -- cancel queued/scheduled/retry jobs + pending waits + active schedules (NOT processing jobs / external effects)
  update pierre_rt_runtime_jobs set status='cancelled', updated_at=now() where company_id=v_company and mission_run_id=p_mission_run_id and status in ('queued','scheduled','retry_scheduled','waiting_reconciliation');
  update pierre_rt_runtime_waits set status='cancelled', updated_at=now() where company_id=v_company and mission_run_id=p_mission_run_id and status='pending';
  update pierre_rt_runtime_schedules set status='cancelled', cancelled_at=now(), next_run_at=null, updated_at=now() where company_id=v_company and mission_run_id=p_mission_run_id and status='active';
  perform pierre_rt_runtime_log(v_company, p_mission_run_id, null, null, 'mission.cancel_requested', null, 'cancelling', '{}'::jsonb);
end; $$ language plpgsql security definer;

create or replace function pierre_rt_finalize_cancel_mission_run(p_company uuid, p_mission_run_id uuid)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_proc int;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select count(*) into v_proc from pierre_rt_runtime_jobs where company_id=v_company and mission_run_id=p_mission_run_id and status='processing';
  if v_proc>0 then return; end if; -- a processing job must finish/expire first
  update pierre_rt_step_runs set status='cancelled', updated_at=now() where company_id=v_company and mission_run_id=p_mission_run_id and status in ('pending','ready','queued','waiting');
  update pierre_rt_mission_runs set status='cancelled', cancelled_at=now(), updated_at=now(), version=version+1 where company_id=v_company and id=p_mission_run_id and status='cancelling';
  perform pierre_rt_runtime_log(v_company, p_mission_run_id, null, null, 'mission.cancelled', 'cancelling', 'cancelled', '{}'::jsonb);
end; $$ language plpgsql security definer;

-- ── function grants: least-privilege per role (revoke from public/app first) ──────────
do $$
declare worker_fns text[] := array[
  'pierre_rt_runtime_start_step(uuid,uuid,text,bigint)',
  'pierre_rt_runtime_heartbeat(uuid,uuid,text,bigint,integer)',
  'pierre_rt_runtime_record_attempt(uuid,uuid,text,bigint,text,text,text,text,text,text)',
  'pierre_rt_runtime_checkpoint(uuid,uuid,text,bigint,text,integer,text,text,jsonb)',
  'pierre_rt_runtime_complete_job(uuid,uuid,text,bigint,text,text,jsonb)',
  'pierre_rt_runtime_wait_job(uuid,uuid,text,bigint,text,text,text,uuid,text,uuid,timestamptz,timestamptz)',
  'pierre_rt_runtime_fail_job(uuid,uuid,text,bigint,text,text,text,integer,integer)'
];
scheduler_fns text[] := array[
  'pierre_rt_runtime_claim(uuid,integer,text,integer,timestamptz)',
  'pierre_rt_recover_runtime_leases(uuid,timestamptz,integer)',
  'pierre_rt_claim_due_schedules(uuid,integer,text,integer,timestamptz)',
  'pierre_rt_fire_schedule(uuid,uuid,text,timestamptz)',
  'pierre_rt_resolve_runtime_wait(uuid,uuid,uuid,text,text,uuid,text)',
  'pierre_rt_ingest_runtime_event(uuid,text,text,text,text,uuid,text,timestamptz)'
];
app_fns text[] := array[
  'pierre_rt_create_mission_run(uuid,uuid,uuid,uuid,uuid,text)',
  'pierre_rt_runtime_enqueue_step(uuid,uuid)',
  'pierre_rt_pause_mission_run(uuid,uuid)',
  'pierre_rt_resume_mission_run(uuid,uuid)',
  'pierre_rt_request_cancel_mission_run(uuid,uuid)',
  'pierre_rt_finalize_cancel_mission_run(uuid,uuid)'
];
fn text;
begin
  foreach fn in array (worker_fns || scheduler_fns) loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('revoke execute on function %s from pierre_rt_app', fn); end if;
  end loop;
  foreach fn in array worker_fns loop execute format('grant execute on function %s to pierre_rt_runtime_worker', fn); end loop;
  -- the worker also claims its own jobs
  execute 'grant execute on function pierre_rt_runtime_claim(uuid,integer,text,integer,timestamptz) to pierre_rt_runtime_worker';
  foreach fn in array scheduler_fns loop execute format('grant execute on function %s to pierre_rt_runtime_scheduler', fn); end loop;
  -- the app (operator) may create runs + pause/resume/cancel + enqueue a ready step
  foreach fn in array app_fns loop
    if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('grant execute on function %s to pierre_rt_app', fn); end if;
  end loop;
end$$;
