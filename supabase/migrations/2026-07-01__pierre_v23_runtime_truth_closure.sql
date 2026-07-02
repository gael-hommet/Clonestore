-- supabase/migrations/2026-07-01__pierre_v23_runtime_truth_closure.sql
-- PHASE 8.5-R1 — RUNTIME TRUTH CLOSURE. Removes every path by which the application role could fabricate
-- runtime truth, makes plan versions DB-immutable, gives the scheduler GOVERNED writes (no raw DML
-- incompatible with its grants), ties a resolved wait to a REAL persisted event (FK), and adds a global
-- tenant-claim so a system tick never trusts a free company_id. Idempotent, non-destructive, PGlite-OK,
-- v1→v23. NEVER applied to production by this session (operator checkpoint; membership GRANTs documented
-- in the P8.7 runbook). No login/password is ever created in a migration.

-- ── R1.2 — the application role keeps NO direct DML on runtime-truth tables (governed fns only) ──
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'revoke insert, update, delete on pierre_rt_mission_plan_versions, pierre_rt_mission_runs, pierre_rt_step_runs, pierre_rt_step_deps, pierre_rt_runtime_jobs, pierre_rt_runtime_schedules from pierre_rt_app';
end if; end$$;

-- ── R1.8 — a resolved wait references the REAL persisted runtime event (tenant-safe FK) ──
create unique index if not exists uq_pierre_rt_runtime_events_company_id on pierre_rt_runtime_events(company_id, id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_rt_wait_resolved_event_ct') then
    alter table pierre_rt_runtime_waits add constraint fk_rt_wait_resolved_event_ct foreign key (company_id, resolved_by_event_id) references pierre_rt_runtime_events(company_id, id);
  end if;
end$$;

-- ── R1.3 — mission plan versions are DB-IMMUTABLE (only status may change, via a governed fn) ──
create or replace function pierre_rt_plan_version_immutable() returns trigger as $$
begin
  if NEW.plan_json is distinct from OLD.plan_json
     or NEW.compiled_graph_json is distinct from OLD.compiled_graph_json
     or NEW.plan_fingerprint is distinct from OLD.plan_fingerprint
     or NEW.version_number is distinct from OLD.version_number
     or NEW.mission_id is distinct from OLD.mission_id
     or NEW.company_id is distinct from OLD.company_id then
    raise exception 'mission plan version is immutable' using errcode='0A000';
  end if;
  -- the only permitted transition is active → superseded
  if NEW.status is distinct from OLD.status and not (OLD.status='active' and NEW.status='superseded') then
    raise exception 'illegal plan version status transition' using errcode='0A000';
  end if;
  return NEW;
end; $$ language plpgsql;
drop trigger if exists trg_rt_plan_version_immutable on pierre_rt_mission_plan_versions;
create trigger trg_rt_plan_version_immutable before update on pierre_rt_mission_plan_versions for each row execute function pierre_rt_plan_version_immutable();
drop trigger if exists trg_rt_plan_version_no_del on pierre_rt_mission_plan_versions;
create trigger trg_rt_plan_version_no_del before delete on pierre_rt_mission_plan_versions for each row execute function pierre_rt_runtime_append_only();

-- ════════════════════════════════════════════════════════════════════════════════════
-- R1.2 — GOVERNED ATOMIC RUN CREATION (the ONLY way the app creates plan/run/steps/jobs)
-- The caller supplies the COMPILED steps + deps; the server FORCES the initial statuses
-- (steps pending/ready, jobs queued). No terminal/processing status is ever accepted.
-- ════════════════════════════════════════════════════════════════════════════════════
create or replace function pierre_rt_create_compiled_mission_run(
  p_company uuid, p_mission uuid, p_schema_version text, p_fingerprint text, p_plan_json jsonb,
  p_compiled_graph jsonb, p_steps jsonb, p_deps jsonb, p_requested_by uuid, p_correlation_id uuid, p_autonomy text
) returns table(created_mission_run_id uuid, created_plan_version_id uuid) as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
  v_pv uuid; v_run uuid; v_num int; s jsonb; d jsonb; v_sid uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if not exists (select 1 from pierre_rt_missions where company_id=v_company and id=p_mission) then raise exception 'mission not found in tenant' using errcode='23503'; end if;

  -- immutable, fingerprinted plan version (idempotent on the fingerprint)
  select id into v_pv from pierre_rt_mission_plan_versions where company_id=v_company and mission_id=p_mission and plan_fingerprint=p_fingerprint;
  if v_pv is null then
    select coalesce(max(version_number),0)+1 into v_num from pierre_rt_mission_plan_versions where company_id=v_company and mission_id=p_mission;
    v_pv := gen_random_uuid();
    insert into pierre_rt_mission_plan_versions (id, company_id, mission_id, version_number, plan_schema_version, plan_fingerprint, plan_json, compiled_graph_json, status, created_by, compiled_at)
    values (v_pv, v_company, p_mission, v_num, coalesce(p_schema_version,'1'), p_fingerprint, p_plan_json, p_compiled_graph, 'active', p_requested_by, now());
  end if;

  -- run (idempotent: one active run per plan version)
  select id into v_run from pierre_rt_mission_runs where company_id=v_company and mission_id=p_mission and plan_version_id=v_pv and status not in ('cancelled','completed','failed','dead_lettered') limit 1;
  if v_run is null then
    select coalesce(max(run_number),0)+1 into v_num from pierre_rt_mission_runs where company_id=v_company and mission_id=p_mission;
    v_run := gen_random_uuid();
    insert into pierre_rt_mission_runs (id, company_id, mission_id, plan_version_id, run_number, status, autonomy_level, requested_by, correlation_id, started_at)
    values (v_run, v_company, p_mission, v_pv, v_num, 'running', coalesce(p_autonomy,'normal'), p_requested_by, p_correlation_id, now());
    perform pierre_rt_runtime_log(v_company, v_run, null, null, 'mission.run_created', null, 'running', jsonb_build_object('plan_version_id', v_pv::text));

    -- step runs — the SERVER forces the initial status (pending/ready); a terminal status is impossible
    for s in select * from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) loop
      insert into pierre_rt_step_runs (id, company_id, mission_run_id, plan_version_id, step_key, step_ordinal, action_key, action_version, status, dependency_count, satisfied_dependency_count, input_json, input_hash)
      values (gen_random_uuid(), v_company, v_run, v_pv, s->>'step_key', coalesce((s->>'step_ordinal')::int,0), s->>'action_key', coalesce(s->>'action_version','1'),
              case when coalesce((s->>'dependency_count')::int,0)=0 then 'ready' else 'pending' end,
              coalesce((s->>'dependency_count')::int,0), 0, coalesce(s->'input','{}'::jsonb), s->>'input_hash');
    end loop;
    -- dependency edges (resolved by step_key within this run)
    for d in select * from jsonb_array_elements(coalesce(p_deps,'[]'::jsonb)) loop
      insert into pierre_rt_step_deps (company_id, step_run_id, depends_on_step_run_id)
      select v_company,
        (select id from pierre_rt_step_runs where company_id=v_company and mission_run_id=v_run and step_key=d->>'step_key'),
        (select id from pierre_rt_step_runs where company_id=v_company and mission_run_id=v_run and step_key=d->>'depends_on')
      on conflict do nothing;
    end loop;
    -- enqueue the initial ready steps (governed; jobs are queued only)
    for v_sid in select id from pierre_rt_step_runs where company_id=v_company and mission_run_id=v_run and status='ready' loop
      perform pierre_rt_runtime_enqueue_step(v_company, v_sid);
    end loop;
  end if;
  created_mission_run_id := v_run; created_plan_version_id := v_pv; return next;
end; $$ language plpgsql security definer;

-- governed schedule creation (replaces the app's raw INSERT)
create or replace function pierre_rt_create_runtime_schedule(
  p_company uuid, p_mission uuid, p_mission_run uuid, p_step_run uuid, p_kind text, p_timezone text,
  p_run_at timestamptz, p_recurrence jsonb, p_max_occurrences int, p_reason text, p_payload jsonb, p_stop_condition jsonb, p_dedup text
) returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_kind not in ('once','after_delay','recurring') then raise exception 'unknown schedule kind' using errcode='22023'; end if;
  insert into pierre_rt_runtime_schedules (id, company_id, mission_id, mission_run_id, step_run_id, schedule_kind, timezone, run_at, next_run_at, recurrence_rule, max_occurrences, status, reason, payload, stop_condition, dedup_key)
  values (gen_random_uuid(), v_company, p_mission, p_mission_run, p_step_run, p_kind, coalesce(p_timezone,'UTC'), p_run_at, p_run_at, p_recurrence::text, p_max_occurrences, 'active', p_reason, coalesce(p_payload,'{}'::jsonb), p_stop_condition, p_dedup)
  on conflict (company_id, dedup_key) do nothing;
  select id into v_id from pierre_rt_runtime_schedules where company_id=v_company and dedup_key=p_dedup;
  return v_id;
end; $$ language plpgsql security definer;

-- governed plan supersede (the only status mutation the immutability trigger allows)
create or replace function pierre_rt_supersede_plan_version(p_company uuid, p_plan_version uuid) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_mission_plan_versions set status='superseded' where company_id=v_company and id=p_plan_version and status='active';
end; $$ language plpgsql security definer;

-- ── R1.4 — governed scheduler writes (no raw UPDATE of truth from the scheduler role) ──
create or replace function pierre_rt_apply_runtime_event(p_company uuid, p_event_id uuid, p_resolved int) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_runtime_events set application_status = case when p_resolved>0 then 'applied' else 'ignored' end, applied_at=now()
   where company_id=v_company and id=p_event_id and application_status='pending';
end; $$ language plpgsql security definer;

create or replace function pierre_rt_complete_schedule(p_company uuid, p_schedule_id uuid, p_worker text) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_lock text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select locked_by into v_lock from pierre_rt_runtime_schedules where company_id=v_company and id=p_schedule_id;
  if v_lock is distinct from p_worker then raise exception 'scheduler does not own this schedule lease' using errcode='42501'; end if;
  update pierre_rt_runtime_schedules set status='completed', next_run_at=null, locked_by=null, lease_expires_at=null, updated_at=now() where company_id=v_company and id=p_schedule_id and status='active';
end; $$ language plpgsql security definer;

-- ── R1.10 — global tenant discovery: a system tick claims tenants WITH due work (no free company_id) ──
create or replace function pierre_rt_claim_runtime_tenants(p_limit int, p_now timestamptz) returns table(tenant_company_id uuid) as $$
begin
  return query
  select distinct c from (
    select company_id c from pierre_rt_runtime_jobs where status in ('queued','scheduled','retry_scheduled') and (available_at is null or available_at<=p_now) and available_at<>'infinity'
    union select company_id from pierre_rt_runtime_jobs where status='processing' and lease_expires_at<p_now
    union select company_id from pierre_rt_runtime_waits where status='pending' and wait_kind='timer' and wake_at is not null and wake_at<=p_now
    union select company_id from pierre_rt_runtime_schedules where status='active' and next_run_at is not null and next_run_at<=p_now
    union select company_id from pierre_rt_runtime_events where application_status='pending' and company_id is not null
  ) t order by 1 limit greatest(coalesce(p_limit,50),0);
end; $$ language plpgsql security definer;

-- ── grants ─────────────────────────────────────────────────────────────────────────
do $$
declare app_fns text[] := array[
  'pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text)',
  'pierre_rt_create_runtime_schedule(uuid,uuid,uuid,uuid,text,text,timestamptz,jsonb,integer,text,jsonb,jsonb,text)',
  'pierre_rt_supersede_plan_version(uuid,uuid)'
];
sched_fns text[] := array[
  'pierre_rt_apply_runtime_event(uuid,uuid,integer)',
  'pierre_rt_complete_schedule(uuid,uuid,text)',
  'pierre_rt_claim_runtime_tenants(integer,timestamptz)'
];
fn text;
begin
  foreach fn in array (app_fns || sched_fns) loop execute format('revoke all on function %s from public', fn); end loop;
  foreach fn in array app_fns loop if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('grant execute on function %s to pierre_rt_app', fn); end if; end loop;
  foreach fn in array sched_fns loop execute format('grant execute on function %s to pierre_rt_runtime_scheduler', fn); end loop;
  -- both system roles may DISCOVER tenants with due work (so a tick never trusts a free company_id)
  execute 'grant execute on function pierre_rt_claim_runtime_tenants(integer,timestamptz) to pierre_rt_runtime_worker';
  -- the scheduler discovers tenants then resolves waits + enqueues; it needs the resolve grant (already from v22)
  -- and SELECT on plan/step tables is NOT granted (it never reads business plans).
end$$;
