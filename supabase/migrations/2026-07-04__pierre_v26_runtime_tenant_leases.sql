-- supabase/migrations/2026-07-04__pierre_v26_runtime_tenant_leases.sql
-- PHASE 8.5-R4 §R4.6 — ATOMIC TENANT LEASES. Tenant discovery (which tenants have due runtime work) was a
-- non-atomic `select distinct` (v23): two overlapping ticks both received the SAME tenants and processed
-- them concurrently — wasted work, no fairness, no coordination. This replaces it with a real per-tenant
-- LEASE: a holder atomically claims a tenant (FOR UPDATE SKIP LOCKED), bumps a monotonic LEASE FENCING
-- token, and holds it for a bounded lease; a second holder is handed only the tenants the first did NOT
-- claim. Heartbeat extends the lease; complete/fail release it; an expired lease is reclaimable; a stale
-- holder (older fencing) is refused. Fairness: tenants are served least-recently-claimed first so a
-- high-volume tenant never starves the others. Idempotent, non-destructive, PGlite-OK, v1→v26.
-- NEVER applied to production by this session (operator checkpoint).

-- ── the per-tenant, per-scope runtime lease (one row per (company, scope)) ─────────────
create table if not exists pierre_rt_runtime_tenant_leases (
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  lease_scope       text not null check (lease_scope in ('worker','scheduler','recovery')),
  lease_holder      text,                                   -- null ⇒ free
  lease_fencing     bigint not null default 0,              -- monotonic; bumped on every claim (fences a stale holder)
  claimed_at        timestamptz,
  heartbeat_at      timestamptz,
  lease_expires_at  timestamptz,
  last_claimed_at   timestamptz,                            -- fairness key: least-recently-served first
  last_completed_at timestamptz,
  last_outcome      text,
  claim_count       bigint not null default 0,
  fail_count        bigint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (company_id, lease_scope)
);
create index if not exists idx_pierre_rt_tenant_leases_fair on pierre_rt_runtime_tenant_leases(lease_scope, last_claimed_at asc nulls first);
create index if not exists idx_pierre_rt_tenant_leases_holder on pierre_rt_runtime_tenant_leases(lease_scope, lease_holder);

-- forced per-tenant RLS: under a tenant role the lease is visible only for that tenant; the governed
-- (SECURITY DEFINER, owner-run) functions manage it cross-tenant for system discovery. No role gets DML.
do $$ begin
  execute 'alter table pierre_rt_runtime_tenant_leases enable row level security';
  execute 'alter table pierre_rt_runtime_tenant_leases force row level security';
  execute 'drop policy if exists rt_iso_pierre_rt_runtime_tenant_leases on pierre_rt_runtime_tenant_leases';
  execute 'create policy rt_iso_pierre_rt_runtime_tenant_leases on pierre_rt_runtime_tenant_leases using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
end$$;

-- ── atomic, FAIR tenant claim — the system discovery primitive (replaces v23 select-distinct) ──
-- Cross-tenant by design (it PRECEDES per-tenant binding); runs as the owner (definer) so it sees all
-- tenants. It (1) ensures a lease row exists for every tenant with due work, then (2) atomically claims
-- the free/expired ones — least-recently-claimed first — under FOR UPDATE SKIP LOCKED so concurrent
-- holders never receive the same tenant. Returns the claimed tenants + the lease fencing they now hold.
create or replace function pierre_rt_claim_runtime_tenant_leases(
  p_scope text, p_holder text, p_limit int, p_lease_seconds int, p_now timestamptz
) returns table(tenant_company_id uuid, lease_fencing bigint) as $$
begin
  if p_scope is null or p_scope not in ('worker','scheduler','recovery') then raise exception 'invalid lease scope %', p_scope using errcode='22023'; end if;
  if p_holder is null or length(p_holder)=0 then raise exception 'lease holder required' using errcode='22023'; end if;

  -- (1) make every tenant-with-due-work claimable (idempotent)
  insert into pierre_rt_runtime_tenant_leases (company_id, lease_scope)
  select c, p_scope from (
    select company_id c from pierre_rt_runtime_jobs where status in ('queued','scheduled','retry_scheduled') and (available_at is null or available_at<=p_now) and available_at<>'infinity'
    union select company_id from pierre_rt_runtime_jobs where status='processing' and lease_expires_at<p_now
    union select company_id from pierre_rt_runtime_waits where status='pending' and wait_kind='timer' and wake_at is not null and wake_at<=p_now
    union select company_id from pierre_rt_runtime_schedules where status='active' and next_run_at is not null and next_run_at<=p_now
    union select company_id from pierre_rt_runtime_events where application_status='pending' and company_id is not null
  ) d where c is not null
  on conflict (company_id, lease_scope) do nothing;

  -- (2) atomically claim the free/expired ones, fairest (least-recently-claimed) first
  return query
  update pierre_rt_runtime_tenant_leases l
     set lease_holder=p_holder,
         lease_fencing=l.lease_fencing+1,
         claimed_at=p_now, heartbeat_at=p_now, last_claimed_at=p_now,
         lease_expires_at=p_now + make_interval(secs=>greatest(p_lease_seconds,1)),
         claim_count=l.claim_count+1, updated_at=p_now
   where (l.company_id, l.lease_scope) in (
     select s.company_id, s.lease_scope from pierre_rt_runtime_tenant_leases s
      where s.lease_scope=p_scope
        and (s.lease_holder is null or s.lease_expires_at is null or s.lease_expires_at < p_now)
        and exists (
          select 1 from pierre_rt_runtime_jobs j where j.company_id=s.company_id and (
                (j.status in ('queued','scheduled','retry_scheduled') and (j.available_at is null or j.available_at<=p_now) and j.available_at<>'infinity')
             or (j.status='processing' and j.lease_expires_at<p_now))
          union all select 1 from pierre_rt_runtime_waits w where w.company_id=s.company_id and w.status='pending' and w.wait_kind='timer' and w.wake_at is not null and w.wake_at<=p_now
          union all select 1 from pierre_rt_runtime_schedules sc where sc.company_id=s.company_id and sc.status='active' and sc.next_run_at is not null and sc.next_run_at<=p_now
          union all select 1 from pierre_rt_runtime_events e where e.company_id=s.company_id and e.application_status='pending'
        )
      order by s.last_claimed_at asc nulls first, s.company_id asc
      for update skip locked
      limit greatest(coalesce(p_limit,50),0)
   )
   returning l.company_id, l.lease_fencing;
end; $$ language plpgsql security definer;

-- ── heartbeat: extend the lease — only the current holder with the current fencing may ─
create or replace function pierre_rt_heartbeat_tenant_lease(
  p_company uuid, p_scope text, p_holder text, p_fencing bigint, p_lease_seconds int, p_now timestamptz
) returns boolean as $$
declare l record;
begin
  select * into l from pierre_rt_runtime_tenant_leases where company_id=p_company and lease_scope=p_scope for update;
  if not found then return false; end if;
  if l.lease_holder is null then return false; end if;                                   -- already released (idempotent)
  if l.lease_holder is distinct from p_holder or l.lease_fencing is distinct from p_fencing then
    raise exception 'stale tenant lease' using errcode='42501';                          -- a newer holder owns it
  end if;
  update pierre_rt_runtime_tenant_leases
     set heartbeat_at=p_now, lease_expires_at=p_now + make_interval(secs=>greatest(p_lease_seconds,1)), updated_at=p_now
   where company_id=p_company and lease_scope=p_scope;
  return true;
end; $$ language plpgsql security definer;

-- ── complete: release the lease cleanly (idempotent on an already-released/fenced lease) ─
create or replace function pierre_rt_complete_tenant_lease(
  p_company uuid, p_scope text, p_holder text, p_fencing bigint, p_now timestamptz
) returns boolean as $$
declare l record;
begin
  select * into l from pierre_rt_runtime_tenant_leases where company_id=p_company and lease_scope=p_scope for update;
  if not found then return false; end if;
  if l.lease_holder is null then return false; end if;                                   -- terminal-idempotent BEFORE the raise
  if l.lease_holder is distinct from p_holder or l.lease_fencing is distinct from p_fencing then
    raise exception 'stale tenant lease' using errcode='42501';
  end if;
  update pierre_rt_runtime_tenant_leases
     set lease_holder=null, lease_expires_at=null, heartbeat_at=null,
         last_completed_at=p_now, last_outcome='completed', updated_at=p_now
   where company_id=p_company and lease_scope=p_scope;
  return true;
end; $$ language plpgsql security definer;

-- ── fail: release with a recorded failure (+ fail_count) — same fencing discipline ─────
create or replace function pierre_rt_fail_tenant_lease(
  p_company uuid, p_scope text, p_holder text, p_fencing bigint, p_now timestamptz, p_error text
) returns boolean as $$
declare l record;
begin
  select * into l from pierre_rt_runtime_tenant_leases where company_id=p_company and lease_scope=p_scope for update;
  if not found then return false; end if;
  if l.lease_holder is null then return false; end if;
  if l.lease_holder is distinct from p_holder or l.lease_fencing is distinct from p_fencing then
    raise exception 'stale tenant lease' using errcode='42501';
  end if;
  update pierre_rt_runtime_tenant_leases
     set lease_holder=null, lease_expires_at=null, heartbeat_at=null,
         last_completed_at=p_now, last_outcome=left(coalesce(p_error,'failed'),120), fail_count=l.fail_count+1, updated_at=p_now
   where company_id=p_company and lease_scope=p_scope;
  return true;
end; $$ language plpgsql security definer;

-- pin search_path on the new SECURITY DEFINER functions (R2 discipline) + least-privilege EXECUTE grants.
-- A SECURITY DEFINER function is EXECUTE-able by PUBLIC by default — REVOKE it (and the app role) FIRST so
-- only the worker/scheduler roles can drive tenant discovery + lease lifecycle (fail-closed).
do $$ declare fn text; begin
  foreach fn in array array[
    'pierre_rt_claim_runtime_tenant_leases(text,text,integer,integer,timestamptz)',
    'pierre_rt_heartbeat_tenant_lease(uuid,text,text,bigint,integer,timestamptz)',
    'pierre_rt_complete_tenant_lease(uuid,text,text,bigint,timestamptz)',
    'pierre_rt_fail_tenant_lease(uuid,text,text,bigint,timestamptz,text)'
  ] loop
    execute format('alter function %s set search_path = pg_catalog, public', fn);
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('revoke execute on function %s from pierre_rt_app', fn); end if;
  end loop;
  -- discovery + lease lifecycle are callable by the worker, scheduler and recovery roles; NO direct DML
  if exists (select 1 from pg_roles where rolname='pierre_rt_runtime_worker') then
    execute 'grant execute on function pierre_rt_claim_runtime_tenant_leases(text,text,integer,integer,timestamptz) to pierre_rt_runtime_worker';
    execute 'grant execute on function pierre_rt_heartbeat_tenant_lease(uuid,text,text,bigint,integer,timestamptz) to pierre_rt_runtime_worker';
    execute 'grant execute on function pierre_rt_complete_tenant_lease(uuid,text,text,bigint,timestamptz) to pierre_rt_runtime_worker';
    execute 'grant execute on function pierre_rt_fail_tenant_lease(uuid,text,text,bigint,timestamptz,text) to pierre_rt_runtime_worker';
  end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_runtime_scheduler') then
    execute 'grant execute on function pierre_rt_claim_runtime_tenant_leases(text,text,integer,integer,timestamptz) to pierre_rt_runtime_scheduler';
    execute 'grant execute on function pierre_rt_heartbeat_tenant_lease(uuid,text,text,bigint,integer,timestamptz) to pierre_rt_runtime_scheduler';
    execute 'grant execute on function pierre_rt_complete_tenant_lease(uuid,text,text,bigint,timestamptz) to pierre_rt_runtime_scheduler';
    execute 'grant execute on function pierre_rt_fail_tenant_lease(uuid,text,text,bigint,timestamptz,text) to pierre_rt_runtime_scheduler';
  end if;
end$$;

-- closure marker (idempotency probe; mirrors v25)
insert into pierre_rt_runtime_closure_markers (marker) values ('v26_tenant_leases') on conflict (marker) do nothing;
