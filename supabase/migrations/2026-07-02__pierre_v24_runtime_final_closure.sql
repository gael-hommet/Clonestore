-- supabase/migrations/2026-07-02__pierre_v24_runtime_final_closure.sql
-- PHASE 8.5-R2 — runtime final closure (local-achievable hardening). (1) R2.3: every runtime
-- SECURITY DEFINER function gets a FIXED, SAFE search_path (pg_catalog, public) so it can never resolve
-- a table/function from a caller-controlled schema. (2) R2.4: a dedicated NOLOGIN planner role owns
-- plan/run creation — the application role can no longer execute pierre_rt_create_compiled_mission_run,
-- so a run can only be created by the server-side planner (which compiles + fingerprints the plan).
-- Idempotent, non-destructive, PGlite-OK, v1→v24. NEVER applied to production by this session; the
-- LOGIN identities + role memberships are created out-of-repo (P8.7 runbook). No password in Git.

-- ── R2.4 — dedicated planner role (NOLOGIN) ─────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname='pierre_rt_runtime_planner') then execute 'create role pierre_rt_runtime_planner nologin'; end if;
end$$;

-- the application role can NO LONGER create a compiled run; only the planner role may.
do $$ begin
  execute 'revoke all on function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) from public';
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'revoke execute on function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) from pierre_rt_app'; end if;
  execute 'grant execute on function pierre_rt_create_compiled_mission_run(uuid,uuid,text,text,jsonb,jsonb,jsonb,jsonb,uuid,uuid,text) to pierre_rt_runtime_planner';
end$$;

-- R2.4 note: a structurally falsified plan is already refused by the existing constraints — a
-- dependency naming a non-existent step violates the step_deps composite FK to pierre_rt_step_runs,
-- and a duplicate step_key violates the unique (company_id, mission_run_id, step_key) index. The
-- planner role (above) is the authoritative gate: only the server-side planner that compiled the plan
-- can create the run, so the app role can never inject a forged plan/run/step/job.

-- ── R2.3 — harden EVERY pierre_rt SECURITY DEFINER function with a fixed, safe search_path ──
-- (Idempotent: ALTER FUNCTION ... SET is a no-op when already set to the same value.) A definer
-- function with no fixed search_path can be tricked into resolving an object from a malicious schema
-- placed earlier in the caller's search_path; pinning pg_catalog, public removes that vector.
do $$ declare r record; begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef and p.proname like 'pierre_rt_%'
  loop
    execute format('alter function %s set search_path = pg_catalog, public', r.sig);
  end loop;
end$$;

-- ── grant the planner role the same SELECTs it needs to compile-check (mission existence) ──
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_runtime_planner') then
    -- the planner reads ONLY the mission (to verify tenant ownership) + the runtime plan/run/step tables
    -- it creates; it gets NO business-table grant (employees/contracts/documents).
    execute 'grant select on pierre_rt_missions to pierre_rt_runtime_planner';
    execute 'grant select on pierre_rt_mission_plan_versions, pierre_rt_mission_runs, pierre_rt_step_runs to pierre_rt_runtime_planner';
  end if;
end$$;
