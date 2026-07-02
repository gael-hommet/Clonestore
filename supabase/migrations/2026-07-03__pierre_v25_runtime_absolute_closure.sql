-- supabase/migrations/2026-07-03__pierre_v25_runtime_absolute_closure.sql
-- PHASE 8.5-R3 — runtime absolute closure (local-achievable hardening). R3.3: the v24 search_path
-- pinning (pg_catalog, public) is only SAFE if no untrusted role can create an object in `public` that
-- shadows a runtime relation/function. This migration REVOKES CREATE on schema public from PUBLIC and
-- from every non-administrative runtime role, so a SECURITY DEFINER function can never resolve a planted
-- object. Idempotent, non-destructive, PGlite-OK, v1→v25. NEVER applied to production by this session.

-- ── R3.3 — no untrusted role may CREATE in `public` (closes the search_path shadow vector) ──
do $$ declare r record; begin
  execute 'revoke create on schema public from public';
  for r in (select rolname from pg_roles where rolname in (
    'pierre_rt_app','pierre_rt_runtime_worker','pierre_rt_runtime_scheduler','pierre_rt_runtime_planner',
    'pierre_rt_communication_worker','pierre_rt_communication_webhook','pierre_rt_webhook_ingress',
    'pierre_rt_signature_worker'
  )) loop
    begin execute format('revoke create on schema public from %I', r.rolname); exception when others then null; end;
  end loop;
exception when others then
  -- PG15+ already revokes CREATE from PUBLIC by default; tolerate environments where it is already so
  null;
end$$;

-- a small forward-looking marker table so the v25 idempotency probe has a concrete object to re-check
-- (re-applying must not duplicate it). It records the closure level for observability — no secret.
create table if not exists pierre_rt_runtime_closure_markers (
  id          uuid primary key default gen_random_uuid(),
  marker      text not null,
  created_at  timestamptz not null default now(),
  unique (marker)
);
insert into pierre_rt_runtime_closure_markers (marker) values ('v25_public_schema_locked') on conflict (marker) do nothing;

-- harden any SECURITY DEFINER function added since v24 (idempotent re-pin)
do $$ declare r record; begin
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prosecdef and p.proname like 'pierre_rt_%'
  loop
    execute format('alter function %s set search_path = pg_catalog, public', r.sig);
  end loop;
end$$;
