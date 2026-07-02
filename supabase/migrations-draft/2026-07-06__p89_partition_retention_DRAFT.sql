-- ============================================================================
-- P8.9 DRAFT — high-growth table partition + retention (NOT APPLIED REMOTELY)
-- ----------------------------------------------------------------------------
-- Location: supabase/migrations-draft/ — deliberately OUTSIDE supabase/migrations/
-- so it is NEVER auto-applied by the runner/harness (which read pierre_v*.sql in
-- supabase/migrations/). Validated only on the local ephemeral benchmark DB by
-- scripts/p89-postgres-100k-benchmark.mjs (--partition-test). Apply to Production
-- ONLY after operator review + a data-migration plan for existing rows.
--
-- Growth model (see P8_9_100K_SELLABILITY_REPORT.md): at 100k companies the
-- append-only streams dominate growth. Classify:
--   PRUNABLE (operational state, NOT legal audit): terminal runtime jobs
--     (pierre_rt_jobs status in succeeded/dead beyond hot window), resolved
--     communication provider events.
--   ARCHIVE (legal/financial audit — never hard-deleted): pierre_rt_dead_letters,
--     pierre_rt_signature_events, pierre_rt_commercial_events, audit events.
--   The two mechanisms below are the OPERATIONAL levers so critical tables do not
--   grow unbounded without a plan.
-- ============================================================================

begin;

-- 1) Governed retention for PRUNABLE terminal runtime jobs (operational, not audit).
--    Dead-letters + events retain the audit trail; terminal jobs are safe to prune
--    beyond the hot window. Returns the number pruned. Idempotent; bounded by window.
create or replace function pierre_rt_p89_prune_terminal_jobs(p_hot_window interval default interval '90 days')
returns integer as $$
declare v_n integer;
begin
  with del as (
    delete from pierre_rt_jobs
     where status in ('succeeded','dead','cancelled')
       and updated_at < now() - p_hot_window
     returning 1)
  select count(*)::int into v_n from del;
  return v_n;
end;
$$ language plpgsql;

-- 2) Monthly-partitioned ARCHIVE stream template for the highest-growth event flow.
--    New writes can be routed here (RANGE by month); old partitions are DETACHED and
--    moved to cold storage rather than deleted (preserves legal audit).
create table if not exists pierre_rt_p89_event_archive (
  id           uuid not null default gen_random_uuid(),
  company_id   uuid not null,
  event_kind   text not null,
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  primary key (id, occurred_at)
) partition by range (occurred_at);

-- create-next-partition helper (+ per-partition index on the tenant scope)
create or replace function pierre_rt_p89_ensure_event_partition(p_month date)
returns text as $$
declare v_start date := date_trunc('month', p_month)::date;
        v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
        v_name  text := 'pierre_rt_p89_event_archive_' || to_char(v_start,'YYYY_MM');
begin
  if not exists (select 1 from pg_class where relname = v_name) then
    execute format('create table %I partition of pierre_rt_p89_event_archive for values from (%L) to (%L)', v_name, v_start, v_end);
    execute format('create index if not exists %I on %I (company_id, occurred_at desc)', v_name || '_company', v_name);
  end if;
  return v_name;
end;
$$ language plpgsql;

-- retention: detach partitions older than a cold window (caller archives them out-of-band, then drops)
create or replace function pierre_rt_p89_detach_old_partitions(p_cold_window interval default interval '180 days')
returns integer as $$
declare r record; v_n integer := 0;
begin
  for r in
    select c.relname from pg_inherits i join pg_class c on c.oid=i.inhrelid
    join pg_class p on p.oid=i.inhparent
    where p.relname='pierre_rt_p89_event_archive'
      and to_date(right(c.relname,7),'YYYY_MM') < date_trunc('month', now() - p_cold_window)
  loop
    execute format('alter table pierre_rt_p89_event_archive detach partition %I', r.relname);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$ language plpgsql;

commit;

-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- begin;
--   drop function if exists pierre_rt_p89_detach_old_partitions(interval);
--   drop function if exists pierre_rt_p89_ensure_event_partition(date);
--   drop function if exists pierre_rt_p89_prune_terminal_jobs(interval);
--   drop table if exists pierre_rt_p89_event_archive cascade;
-- commit;
