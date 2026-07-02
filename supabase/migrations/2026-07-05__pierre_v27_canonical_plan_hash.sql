-- supabase/migrations/2026-07-05__pierre_v27_canonical_plan_hash.sql
-- PHASE 8.5-R4 §R4.5 — NON-FORGEABLE plan identity. The plan fingerprint was client-supplied and merely
-- stored; nothing in the DB proved it actually corresponded to the compiled steps. This makes the binding
-- DB-AUTHORITATIVE: the database itself derives a CANONICAL content hash from the compiled steps (md5 —
-- the hash available in both PGlite and production Postgres core) and pins it to the fingerprint. The
-- (fingerprint → content) pair is then immutable: re-using a fingerprint with DIFFERENT steps — a forged
-- plan — is REFUSED. The canonical string is built from already-normalized primitive fields ordered by
-- the integer step ordinal, so the TS compiler (`canonicalPlanContent`) reproduces it byte-for-byte.
-- Idempotent, non-destructive, PGlite-OK, v1→v27. NEVER applied to production by this session.

-- the DB-authoritative content hash column (filled by the governed create function below)
alter table pierre_rt_mission_plan_versions add column if not exists plan_content_md5 text;

-- the CANONICAL plan content (deterministic, collation-free; identical to the TS canonicalPlanContent)
create or replace function pierre_rt_canonical_plan_content(p_schema_version text, p_steps jsonb) returns text as $$
  select 'v=' || coalesce(p_schema_version, '1') || E'\n' || coalesce(string_agg(
           (s->>'step_ordinal') || '|' || (s->>'step_key') || '|' || (s->>'action_key') || '|' ||
           coalesce(s->>'action_version', '1') || '|' || coalesce(s->>'input_hash', '') || '|' ||
           coalesce(s->>'dependency_count', '0'),
           E'\n' order by (s->>'step_ordinal')::int
         ), '')
  from jsonb_array_elements(coalesce(p_steps, '[]'::jsonb)) s;
$$ language sql immutable;

-- redefine the governed creator (SAME 11-arg signature) to derive + pin + enforce the content hash
create or replace function pierre_rt_create_compiled_mission_run(
  p_company uuid, p_mission uuid, p_schema_version text, p_fingerprint text, p_plan_json jsonb,
  p_compiled_graph jsonb, p_steps jsonb, p_deps jsonb, p_requested_by uuid, p_correlation_id uuid, p_autonomy text
) returns table(created_mission_run_id uuid, created_plan_version_id uuid) as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
  v_pv uuid; v_run uuid; v_num int; s jsonb; d jsonb; v_sid uuid;
  v_content_md5 text; v_existing_md5 text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if not exists (select 1 from pierre_rt_missions where company_id=v_company and id=p_mission) then raise exception 'mission not found in tenant' using errcode='23503'; end if;

  -- R4.5 — the DB derives the canonical content hash ITSELF (never trusts a client-supplied one)
  v_content_md5 := md5(pierre_rt_canonical_plan_content(coalesce(p_schema_version,'1'), p_steps));

  -- immutable, fingerprinted plan version (idempotent on the fingerprint)
  select id, plan_content_md5 into v_pv, v_existing_md5 from pierre_rt_mission_plan_versions where company_id=v_company and mission_id=p_mission and plan_fingerprint=p_fingerprint;
  -- R4.5 — a fingerprint may NOT be re-bound to different content (forged plan); the binding is DB-pinned
  if v_pv is not null and v_existing_md5 is not null and v_existing_md5 is distinct from v_content_md5 then
    raise exception 'plan content hash mismatch: fingerprint % reused with different steps (forged plan)', p_fingerprint using errcode='23514';
  end if;
  if v_pv is null then
    select coalesce(max(version_number),0)+1 into v_num from pierre_rt_mission_plan_versions where company_id=v_company and mission_id=p_mission;
    v_pv := gen_random_uuid();
    insert into pierre_rt_mission_plan_versions (id, company_id, mission_id, version_number, plan_schema_version, plan_fingerprint, plan_json, compiled_graph_json, plan_content_md5, status, created_by, compiled_at)
    values (v_pv, v_company, p_mission, v_num, coalesce(p_schema_version,'1'), p_fingerprint, p_plan_json, p_compiled_graph, v_content_md5, 'active', p_requested_by, now());
  end if;

  -- run (idempotent: one active run per plan version)
  select id into v_run from pierre_rt_mission_runs where company_id=v_company and mission_id=p_mission and plan_version_id=v_pv and status not in ('cancelled','completed','failed','dead_lettered') limit 1;
  if v_run is null then
    select coalesce(max(run_number),0)+1 into v_num from pierre_rt_mission_runs where company_id=v_company and mission_id=p_mission;
    v_run := gen_random_uuid();
    insert into pierre_rt_mission_runs (id, company_id, mission_id, plan_version_id, run_number, status, autonomy_level, requested_by, correlation_id, started_at)
    values (v_run, v_company, p_mission, v_pv, v_num, 'running', coalesce(p_autonomy,'normal'), p_requested_by, p_correlation_id, now());
    perform pierre_rt_runtime_log(v_company, v_run, null, null, 'mission.run_created', null, 'running', jsonb_build_object('plan_version_id', v_pv::text));

    for s in select * from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) loop
      insert into pierre_rt_step_runs (id, company_id, mission_run_id, plan_version_id, step_key, step_ordinal, action_key, action_version, status, dependency_count, satisfied_dependency_count, input_json, input_hash)
      values (gen_random_uuid(), v_company, v_run, v_pv, s->>'step_key', coalesce((s->>'step_ordinal')::int,0), s->>'action_key', coalesce(s->>'action_version','1'),
              case when coalesce((s->>'dependency_count')::int,0)=0 then 'ready' else 'pending' end,
              coalesce((s->>'dependency_count')::int,0), 0, coalesce(s->'input','{}'::jsonb), s->>'input_hash');
    end loop;
    for d in select * from jsonb_array_elements(coalesce(p_deps,'[]'::jsonb)) loop
      insert into pierre_rt_step_deps (company_id, step_run_id, depends_on_step_run_id)
      select v_company,
        (select id from pierre_rt_step_runs where company_id=v_company and mission_run_id=v_run and step_key=d->>'step_key'),
        (select id from pierre_rt_step_runs where company_id=v_company and mission_run_id=v_run and step_key=d->>'depends_on')
      on conflict do nothing;
    end loop;
    for v_sid in select id from pierre_rt_step_runs where company_id=v_company and mission_run_id=v_run and status='ready' loop
      perform pierre_rt_runtime_enqueue_step(v_company, v_sid);
    end loop;
  end if;
  created_mission_run_id := v_run; created_plan_version_id := v_pv; return next;
end; $$ language plpgsql security definer;

-- pin search_path + restore least-privilege EXECUTE (the planner only; never public/app) on the redefine
do $$ begin
  execute 'alter function pierre_rt_canonical_plan_content(text,jsonb) set search_path = pg_catalog, public';
  execute 'alter function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) set search_path = pg_catalog, public';
  execute 'revoke all on function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) from public';
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'revoke execute on function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) from pierre_rt_app'; end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_runtime_planner') then execute 'grant execute on function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) to pierre_rt_runtime_planner'; end if;
end$$;

insert into pierre_rt_runtime_closure_markers (marker) values ('v27_canonical_plan_hash') on conflict (marker) do nothing;
