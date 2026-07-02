-- supabase/migrations/2026-07-06__pierre_v28_customer_product_access_lifecycle.sql
-- PHASE 8.6 — CUSTOMER PRODUCT & ACCESS LIFECYCLE. The governed spine that turns a recognised
-- commercial proof into a usable tenant: a fournisseur-neutral COMMERCIAL EVENT ledger (idempotent,
-- conflict-aware, never tenant-authoritative from the payload), a per-company PRODUCT ENTITLEMENT
-- state machine (pending→active→grace→suspended→cancelled→expired), an atomic company ACTIVATION
-- (provisioning_key-guarded: two concurrent activations of the same commercial proof yield ONE company),
-- server-authoritative ONBOARDING sessions+steps, reinforced membership INVITATIONS (token only ever
-- stored hashed), and an append-only company ACCESS EVENTS audit. Truth-mutation lives ONLY in
-- SECURITY DEFINER functions: the application role can request an activation, advance onboarding via
-- governed calls and manage members it is permitted to — it can NEVER mark an order paid, fabricate an
-- active entitlement, mark an activation ready, forge an accepted invitation, self-assign owner, or
-- write a verified commercial event. Two least-privilege roles (pierre_rt_billing_webhook,
-- pierre_rt_customer_activation_worker) own the commercial→entitlement and activation→provisioning paths.
-- Idempotent, non-destructive, PGlite-OK, v1→v28. NEVER applied to production by this session (operator checkpoint).

-- ── dedicated least-privilege roles ───────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname='pierre_rt_billing_webhook') then execute 'create role pierre_rt_billing_webhook nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='pierre_rt_customer_activation_worker') then execute 'create role pierre_rt_customer_activation_worker nologin'; end if;
end$$;

-- composite uniques on EXISTING parents referenced by the new tenant-safe composite FKs
create unique index if not exists uq_pierre_rt_members_company_id on pierre_rt_members(company_id, id);

-- ════════════════════════════════════════════════════════════════════════════════════
-- TABLES
-- ════════════════════════════════════════════════════════════════════════════════════

-- ── fournisseur-neutral COMMERCIAL EVENT ledger (pre-tenant; company resolved server-side) ──
create table if not exists pierre_rt_commercial_events (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null,
  provider_event_id     text not null,
  event_key             text not null,
  payload_hash          text not null,
  customer_reference    text,
  subscription_reference text,
  order_reference       text,
  product_key           text not null default 'pierre',
  company_id            uuid references pierre_rt_companies(id) on delete set null,
  occurred_at           timestamptz,
  received_at           timestamptz not null default now(),
  applied_at            timestamptz,
  application_status    text not null default 'pending'
                        check (application_status in ('pending','applied','ignored','duplicate','conflict','quarantined')),
  quarantine_reason     text,
  correlation_id        uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (provider, provider_event_id)
);
create index if not exists idx_pierre_rt_commercial_events_pending on pierre_rt_commercial_events(application_status, received_at);
create index if not exists idx_pierre_rt_commercial_events_refs on pierre_rt_commercial_events(customer_reference, subscription_reference, order_reference);
create index if not exists idx_pierre_rt_commercial_events_company on pierre_rt_commercial_events(company_id) where company_id is not null;

-- ── per-company PRODUCT ENTITLEMENT (the canonical, tenant-scoped truth of product ownership) ──
create table if not exists pierre_rt_product_entitlements (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  product_key       text not null default 'pierre',
  status            text not null default 'pending'
                    check (status in ('pending','active','grace','suspended','cancelled','expired')),
  source_type       text not null default 'operator_activation'
                    check (source_type in ('stripe_subscription','stripe_checkout','manual_invoice','operator_activation','paid_customer_test')),
  source_reference  text,
  starts_at         timestamptz,
  grace_until       timestamptz,
  suspended_at      timestamptz,
  cancelled_at      timestamptz,
  expires_at        timestamptz,
  -- commercial ORDERING authority: the last applied event's identity + occurrence time. An older event
  -- (occurred_at < last_commercial_occurred_at) is ignored as stale and never regresses a recent state.
  last_commercial_event_id   uuid,
  last_commercial_occurred_at timestamptz,
  last_commercial_event_key  text,
  version           integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- exactly ONE non-terminal entitlement per (company, product): cancelled/expired do not block a fresh one
create unique index if not exists uq_pierre_rt_entitlement_live on pierre_rt_product_entitlements(company_id, product_key)
  where status in ('pending','active','grace','suspended');
create unique index if not exists uq_pierre_rt_entitlement_company_id on pierre_rt_product_entitlements(company_id, id);
create index if not exists idx_pierre_rt_entitlement_company on pierre_rt_product_entitlements(company_id, product_key, status);

-- ── company ACTIVATION (the provisioning task; provisioning_key prevents duplicate companies) ──
create table if not exists pierre_rt_customer_activations (
  id                  uuid primary key default gen_random_uuid(),
  provisioning_key    text not null,
  company_id          uuid references pierre_rt_companies(id) on delete set null,
  product_key         text not null default 'pierre',
  commercial_reference text,
  status              text not null default 'awaiting_commercial_proof'
                      check (status in ('awaiting_commercial_proof','provisioning','onboarding_required','ready','suspended','blocked','archived')),
  requested_by        uuid,
  owner_user_id       uuid,
  company_name        text,
  source_type         text,
  source_reference    text,
  locked_by           text,
  claimed_at          timestamptz,
  lease_expires_at    timestamptz,
  fencing_token       bigint not null default 0,
  attempt_count       integer not null default 0,
  blocked_reason      text,
  started_at          timestamptz,
  completed_at        timestamptz,
  version             integer not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provisioning_key)
);
create index if not exists idx_pierre_rt_activations_claim on pierre_rt_customer_activations(status, lease_expires_at);
create index if not exists idx_pierre_rt_activations_company on pierre_rt_customer_activations(company_id) where company_id is not null;

-- ── server-authoritative ONBOARDING sessions ──────────────────────────────────────────
create table if not exists pierre_rt_onboarding_sessions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  product_key      text not null default 'pierre',
  status           text not null default 'not_started'
                   check (status in ('not_started','in_progress','blocked','completed','reopened')),
  schema_version   text not null default '1',
  started_by       uuid,
  started_at       timestamptz,
  completed_at     timestamptz,
  reopened_at      timestamptz,
  progress_percent integer not null default 0,
  current_step_key text,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_onboarding_session_company_id on pierre_rt_onboarding_sessions(company_id, id);
create unique index if not exists uq_pierre_rt_onboarding_session_live on pierre_rt_onboarding_sessions(company_id, product_key)
  where status in ('not_started','in_progress','blocked','reopened');
create index if not exists idx_pierre_rt_onboarding_sessions_company on pierre_rt_onboarding_sessions(company_id, status);

-- ── ONBOARDING steps (server decides completeness) ────────────────────────────────────
create table if not exists pierre_rt_onboarding_steps (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references pierre_rt_companies(id) on delete cascade,
  session_id       uuid not null,
  step_key         text not null,
  step_ordinal     integer not null default 0,
  status           text not null default 'pending'
                   check (status in ('pending','completed','blocked','reopened','skipped')),
  required         boolean not null default true,
  completed_by     uuid,
  completed_at     timestamptz,
  evidence_hash    text,
  blocked_reason   text,
  version          integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, session_id, step_key)
);
create index if not exists idx_pierre_rt_onboarding_steps_session on pierre_rt_onboarding_steps(company_id, session_id, step_ordinal);

-- ── reinforce EXISTING membership invitations (pierre_rt_invitations from v3) ──────────
alter table pierre_rt_invitations add column if not exists email_normalized text;
alter table pierre_rt_invitations add column if not exists accepted_by uuid;
alter table pierre_rt_invitations add column if not exists updated_at timestamptz not null default now();
alter table pierre_rt_invitations add column if not exists version integer not null default 1;
alter table pierre_rt_invitations add column if not exists superseded_at timestamptz;
-- one-time invitation tokens are unique by hash (never store the raw token; never reuse a hash)
create unique index if not exists uq_pierre_rt_invitation_token_hash on pierre_rt_invitations(token_hash);
-- backfill the normalized email for any pre-existing row (lower+trim)
update pierre_rt_invitations set email_normalized = lower(btrim(email)) where email_normalized is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_rt_invitations_status_v28') then
    -- widen the status set to include 'superseded' (resend supersedes the previous active invite)
    alter table pierre_rt_invitations drop constraint if exists pierre_rt_invitations_status_check;
    alter table pierre_rt_invitations add constraint chk_rt_invitations_status_v28
      check (status in ('pending','accepted','declined','revoked','expired','superseded'));
  end if;
end $$;
create index if not exists idx_pierre_rt_invitations_token_lookup on pierre_rt_invitations(token_hash, status);

-- ── append-only company ACCESS EVENTS (audit) ─────────────────────────────────────────
create table if not exists pierre_rt_company_access_events (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  actor_user_id   uuid,
  target_user_id  uuid,
  membership_id   uuid,
  event_kind      text not null,
  previous_state  text,
  new_state       text,
  reason_code     text,
  correlation_id  uuid,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_pierre_rt_access_events_company on pierre_rt_company_access_events(company_id, created_at desc, id desc);

-- ── active-company preference is already modelled (pierre_rt_user_company_prefs, v4). ──

-- ════════════════════════════════════════════════════════════════════════════════════
-- tenant-safe composite FKs
-- ════════════════════════════════════════════════════════════════════════════════════
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_rt_onboarding_step_session_ct') then
    alter table pierre_rt_onboarding_steps add constraint fk_rt_onboarding_step_session_ct
      foreign key (company_id, session_id) references pierre_rt_onboarding_sessions(company_id, id) on delete cascade; end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_access_event_member_ct') then
    alter table pierre_rt_company_access_events add constraint fk_rt_access_event_member_ct
      foreign key (company_id, membership_id) references pierre_rt_members(company_id, id) on delete set null; end if;
  if not exists (select 1 from pg_constraint where conname='fk_rt_activation_company') then
    -- activation.company_id is nullable until provisioned; FK to companies(id) is sufficient (id is unique)
    null; end if;
end$$;

-- ── append-only trigger for the access-events audit ───────────────────────────────────
create or replace function pierre_rt_access_event_append_only() returns trigger as $$
begin raise exception 'append-only table %', TG_TABLE_NAME using errcode='0A000'; end; $$ language plpgsql;
drop trigger if exists trg_rt_access_event_no_upd on pierre_rt_company_access_events;
drop trigger if exists trg_rt_access_event_no_del on pierre_rt_company_access_events;
create trigger trg_rt_access_event_no_upd before update on pierre_rt_company_access_events for each row execute function pierre_rt_access_event_append_only();
create trigger trg_rt_access_event_no_del before delete on pierre_rt_company_access_events for each row execute function pierre_rt_access_event_append_only();

-- ── last-owner protection: a company may never be left with zero active owners (DB invariant) ──
create or replace function pierre_rt_members_owner_guard() returns trigger as $$
declare v_company uuid; v_owner_count int; v_member_count int;
begin
  if TG_OP = 'DELETE' then v_company := OLD.company_id; else v_company := NEW.company_id; end if;
  -- skip when the company itself is gone (a cascade delete from pierre_rt_companies removes every member
  -- legitimately) — the guard only protects a still-existing, still-staffed company.
  if not exists (select 1 from pierre_rt_companies where id = v_company) then return null; end if;
  -- skip when no members remain at all (a deliberate full teardown of the company's membership): the
  -- invariant is "a company that HAS members must keep at least one ACTIVE owner", which precisely blocks
  -- demoting/suspending/removing the LAST active owner while other members still depend on it.
  select count(*) into v_member_count from pierre_rt_members where company_id = v_company;
  if v_member_count = 0 then return null; end if;
  select count(*) into v_owner_count from pierre_rt_members
    where company_id = v_company and role = 'owner' and status = 'active';
  if v_owner_count = 0 then
    raise exception 'a company with members must always have at least one active owner' using errcode='23514';
  end if;
  return null;
end; $$ language plpgsql;
drop trigger if exists trg_rt_members_owner_guard on pierre_rt_members;
create constraint trigger trg_rt_members_owner_guard
  after update or delete on pierre_rt_members
  deferrable initially immediate
  for each row execute function pierre_rt_members_owner_guard();

-- ════════════════════════════════════════════════════════════════════════════════════
-- RLS — forced; strict per-tenant.
-- ════════════════════════════════════════════════════════════════════════════════════
do $$ declare t text; begin
  foreach t in array array[
    'pierre_rt_product_entitlements','pierre_rt_customer_activations',
    'pierre_rt_onboarding_sessions','pierre_rt_onboarding_steps','pierre_rt_company_access_events'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%s on %I', t, t);
    if t = 'pierre_rt_customer_activations' then
      -- an activation may exist before its company is resolved (null company): invisible to tenant roles
      execute format('create policy rt_iso_%s on %I using (company_id is not null and company_id::text = current_setting(''app.current_company'', true)) with check (company_id is not null and company_id::text = current_setting(''app.current_company'', true))', t, t);
    else
      execute format('create policy rt_iso_%s on %I using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t, t);
    end if;
  end loop;
end$$;
-- commercial events: a pre-tenant ledger that may hold an unresolved (null-company) row; tenant roles
-- only ever see their own resolved rows.
alter table pierre_rt_commercial_events enable row level security;
alter table pierre_rt_commercial_events force row level security;
drop policy if exists rt_iso_pierre_rt_commercial_events on pierre_rt_commercial_events;
create policy rt_iso_pierre_rt_commercial_events on pierre_rt_commercial_events
  using (company_id is not null and company_id::text = current_setting('app.current_company', true))
  with check (company_id is not null and company_id::text = current_setting('app.current_company', true));

-- ── grants: the app role READS its own entitlement/activation/onboarding/audit; it may NEVER write
--    commercial/entitlement/activation truth (that lives in SECURITY DEFINER functions granted to the
--    billing-webhook / activation-worker roles). The app may insert onboarding rows only via functions. ──
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
    execute 'grant select on pierre_rt_product_entitlements, pierre_rt_customer_activations, pierre_rt_onboarding_sessions, pierre_rt_onboarding_steps, pierre_rt_company_access_events, pierre_rt_commercial_events to pierre_rt_app';
  end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_billing_webhook') then
    execute 'grant select on pierre_rt_commercial_events, pierre_rt_product_entitlements, pierre_rt_customer_activations to pierre_rt_billing_webhook';
  end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_customer_activation_worker') then
    execute 'grant select on pierre_rt_customer_activations, pierre_rt_companies, pierre_rt_members, pierre_rt_product_entitlements, pierre_rt_onboarding_sessions, pierre_rt_onboarding_steps to pierre_rt_customer_activation_worker';
  end if;
end$$;

-- ════════════════════════════════════════════════════════════════════════════════════
-- GOVERNED FUNCTIONS (SECURITY DEFINER) — invariants enforced server-side.
-- ════════════════════════════════════════════════════════════════════════════════════

-- append a PII-free access-event audit row.
create or replace function pierre_rt_log_access_event(p_company uuid, p_actor uuid, p_target uuid, p_membership uuid, p_kind text, p_prev text, p_new text, p_reason text, p_correlation uuid, p_meta jsonb)
returns void as $$
begin
  insert into pierre_rt_company_access_events (id, company_id, actor_user_id, target_user_id, membership_id, event_kind, previous_state, new_state, reason_code, correlation_id, metadata)
  values (gen_random_uuid(), p_company, p_actor, p_target, p_membership, p_kind, p_prev, p_new, p_reason, p_correlation, coalesce(p_meta,'{}'::jsonb));
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── commercial event ingress (billing-webhook role) — idempotent on (provider, provider_event_id) ──
create or replace function pierre_rt_ingest_commercial_event(
  p_provider text, p_provider_event_id text, p_event_key text, p_payload_hash text,
  p_customer_reference text, p_subscription_reference text, p_order_reference text, p_product_key text, p_occurred_at timestamptz)
returns text as $$
declare v_existing record; v_id uuid;
begin
  select id, payload_hash, application_status into v_existing from pierre_rt_commercial_events
    where provider=p_provider and provider_event_id=p_provider_event_id;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash then
      update pierre_rt_commercial_events set application_status='conflict', updated_at=now()
        where id=v_existing.id and application_status='pending';
      return 'conflict';
    end if;
    return 'duplicate';
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_commercial_events (id, provider, provider_event_id, event_key, payload_hash, customer_reference, subscription_reference, order_reference, product_key, occurred_at, application_status)
  values (v_id, p_provider, p_provider_event_id, p_event_key, p_payload_hash, p_customer_reference, p_subscription_reference, p_order_reference, coalesce(p_product_key,'pierre'), p_occurred_at, 'pending');
  return 'received';
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- resolve a pending commercial event onto a company (server resolves the company from persisted refs,
-- NEVER from the payload). Marks the event applied/ignored/quarantined.
create or replace function pierre_rt_resolve_commercial_event(p_event_id uuid, p_company uuid, p_status text, p_reason text)
returns void as $$
begin
  update pierre_rt_commercial_events
     set company_id = coalesce(p_company, company_id),
         application_status = p_status,
         applied_at = case when p_status='applied' then now() else applied_at end,
         quarantine_reason = case when p_status='quarantined' then p_reason else quarantine_reason end,
         updated_at = now()
   where id = p_event_id;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── entitlement state machine (billing-webhook + activation-worker) — never regresses, idempotent ──
-- target status by normalized commercial event key; returns the resulting status or 'ignored'.
create or replace function pierre_rt_apply_entitlement_event(
  p_company uuid, p_product_key text, p_event_key text, p_source_type text, p_source_reference text, p_grace_seconds int)
returns text as $$
declare e record; v_target text; v_id uuid; v_pk text := coalesce(p_product_key,'pierre');
begin
  if p_company is null then raise exception 'company required' using errcode='42501'; end if;
  -- map the normalized commercial event to a target entitlement status
  v_target := case p_event_key
    when 'commercial.payment_confirmed'      then 'active'
    when 'commercial.subscription_active'    then 'active'
    when 'commercial.subscription_reactivated' then 'active'
    when 'commercial.subscription_updated'   then null      -- metadata-only; no status change
    when 'commercial.payment_failed'         then 'grace'
    when 'commercial.subscription_past_due'  then 'grace'
    when 'commercial.subscription_suspended' then 'suspended'
    when 'commercial.subscription_cancelled' then 'cancelled'
    when 'commercial.refund_confirmed'       then 'cancelled'
    else null end;

  select * into e from pierre_rt_product_entitlements
    where company_id=p_company and product_key=v_pk and status in ('pending','active','grace','suspended') limit 1;

  if v_target is null then
    -- no status transition for this event; just touch the source reference when an entitlement exists
    if found and p_source_reference is not null then
      update pierre_rt_product_entitlements set source_reference=p_source_reference, updated_at=now() where id=e.id;
    end if;
    return coalesce(e.status,'ignored');
  end if;

  if not found then
    -- create the entitlement. A cancellation/refund for a non-existent live entitlement is ignored.
    if v_target in ('cancelled','expired') then return 'ignored'; end if;
    v_id := gen_random_uuid();
    insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type, source_reference, starts_at, grace_until)
    values (v_id, p_company, v_pk, v_target, coalesce(p_source_type,'stripe_subscription'), p_source_reference,
            case when v_target='active' then now() else null end,
            case when v_target='grace' then now()+make_interval(secs=>greatest(coalesce(p_grace_seconds,0),0)) else null end);
    return v_target;
  end if;

  -- transition an existing live entitlement (never resurrect a cancelled one here).
  update pierre_rt_product_entitlements
     set status = v_target,
         starts_at = case when v_target='active' and starts_at is null then now() else starts_at end,
         grace_until = case when v_target='grace' then now()+make_interval(secs=>greatest(coalesce(p_grace_seconds,0),0)) else grace_until end,
         suspended_at = case when v_target='suspended' then now() else suspended_at end,
         cancelled_at = case when v_target='cancelled' then now() else cancelled_at end,
         source_reference = coalesce(p_source_reference, source_reference),
         version = version+1, updated_at = now()
   where id = e.id;
  return v_target;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── governed commercial-event application (billing-webhook) — the SINGLE ordered entry point ──
-- It self-loads the persisted event (provider, key, occurred_at, refs, hash), resolves the company from
-- PERSISTED references only (never the payload), enforces ordering (an older event never regresses a more
-- recent state), quarantines an unresolved or future-incoherent event, transitions the entitlement and
-- records the ordering authority. The caller passes ONLY the event id — it cannot fabricate a status.
create or replace function pierre_rt_apply_commercial_event(p_event_id uuid)
returns text as $$
declare e record; v_company uuid; v_ent record; v_status text; v_now timestamptz := now(); v_refs text[];
begin
  select * into e from pierre_rt_commercial_events where id=p_event_id;
  if not found then raise exception 'commercial event not found' using errcode='23503'; end if;
  if e.application_status <> 'pending' then return e.application_status; end if; -- idempotent / already decided

  -- future-incoherent event (beyond clock-skew slack) → operator quarantine
  if e.occurred_at is not null and e.occurred_at > v_now + interval '1 day' then
    update pierre_rt_commercial_events set application_status='quarantined', quarantine_reason='future_incoherent', updated_at=now() where id=p_event_id;
    return 'quarantined';
  end if;

  -- resolve the company from PERSISTED references only (entitlement source_reference, then activation ref)
  v_refs := array(select x from unnest(array[e.subscription_reference, e.order_reference, e.customer_reference]) x where x is not null);
  if array_length(v_refs,1) is not null then
    select company_id into v_company from pierre_rt_product_entitlements where source_reference = any(v_refs) order by updated_at desc limit 1;
    if v_company is null then
      select company_id into v_company from pierre_rt_customer_activations where commercial_reference = any(v_refs) and company_id is not null order by created_at desc limit 1;
    end if;
  end if;
  if v_company is null then
    update pierre_rt_commercial_events set application_status='quarantined', quarantine_reason='unresolved_company', updated_at=now() where id=p_event_id;
    return 'quarantined';
  end if;

  -- ORDERING: an older event must never regress a more recent entitlement state.
  select * into v_ent from pierre_rt_product_entitlements where company_id=v_company and product_key=e.product_key
    order by case status when 'active' then 0 when 'grace' then 1 when 'suspended' then 2 when 'pending' then 3 when 'cancelled' then 4 else 5 end asc, updated_at desc limit 1;
  if v_ent.id is not null and v_ent.last_commercial_occurred_at is not null and e.occurred_at is not null and e.occurred_at < v_ent.last_commercial_occurred_at then
    update pierre_rt_commercial_events set company_id=v_company, application_status='ignored', quarantine_reason='stale', updated_at=now() where id=p_event_id;
    return 'ignored_stale';
  end if;

  -- transition the entitlement state machine (internal primitive)
  v_status := pierre_rt_apply_entitlement_event(v_company, e.product_key, e.event_key, e.provider, coalesce(e.subscription_reference, e.order_reference, e.customer_reference), 7*24*3600);

  -- stamp the ordering authority on the now-live/most-recent entitlement
  update pierre_rt_product_entitlements
     set last_commercial_event_id=p_event_id, last_commercial_occurred_at=coalesce(e.occurred_at, v_now), last_commercial_event_key=e.event_key, updated_at=now()
   where id = (select id from pierre_rt_product_entitlements where company_id=v_company and product_key=e.product_key order by updated_at desc limit 1);

  update pierre_rt_commercial_events set company_id=v_company, application_status='applied', applied_at=now(), updated_at=now() where id=p_event_id;
  return 'applied:'||v_status;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── activation: request (app) ─────────────────────────────────────────────────────────
-- the app may REQUEST an activation; it can never mark it ready or fabricate an entitlement.
create or replace function pierre_rt_request_customer_activation(
  p_provisioning_key text, p_commercial_reference text, p_product_key text, p_requested_by uuid, p_owner_user_id uuid, p_company_name text)
returns uuid as $$
declare v_id uuid; v_existing uuid;
begin
  select id into v_existing from pierre_rt_customer_activations where provisioning_key=p_provisioning_key;
  if found then return v_existing; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_customer_activations (id, provisioning_key, product_key, commercial_reference, status, requested_by, owner_user_id, company_name, started_at)
  values (v_id, p_provisioning_key, coalesce(p_product_key,'pierre'), p_commercial_reference, 'awaiting_commercial_proof', p_requested_by, p_owner_user_id, p_company_name, now())
  on conflict (provisioning_key) do nothing;
  return coalesce(v_id, (select id from pierre_rt_customer_activations where provisioning_key=p_provisioning_key));
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── activation: mark provisioning-ready (billing-webhook, once commercial proof confirmed) ──
create or replace function pierre_rt_mark_activation_provisioning(p_activation_id uuid, p_source_type text, p_source_reference text)
returns text as $$
declare a record;
begin
  select * into a from pierre_rt_customer_activations where id=p_activation_id;
  if not found then raise exception 'activation not found' using errcode='23503'; end if;
  if a.status='blocked' then return 'blocked'; end if;
  if a.status not in ('awaiting_commercial_proof') then return a.status; end if;  -- idempotent
  update pierre_rt_customer_activations
     set status='provisioning', source_type=coalesce(p_source_type, source_type), source_reference=coalesce(p_source_reference, source_reference), updated_at=now(), version=version+1
   where id=p_activation_id and status='awaiting_commercial_proof';
  return 'provisioning';
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── activation: claim (activation-worker) ─────────────────────────────────────────────
-- claim a provisioning-ready activation atomically (FOR UPDATE SKIP LOCKED) — BUMPS the fencing token so
-- a stale prior holder is positively rejected at provision/block time.
create or replace function pierre_rt_claim_customer_activation(p_worker text, p_lease_seconds int, p_now timestamptz)
returns setof pierre_rt_customer_activations as $$
begin
  return query
  update pierre_rt_customer_activations a
     set locked_by=p_worker, claimed_at=p_now, lease_expires_at=p_now+make_interval(secs=>greatest(p_lease_seconds,1)),
         fencing_token=a.fencing_token+1, attempt_count=a.attempt_count+1, updated_at=p_now
   where a.id in (
     select id from pierre_rt_customer_activations
      where status='provisioning' and (lease_expires_at is null or lease_expires_at < p_now)
      order by created_at asc for update skip locked limit 1
   ) returning a.*;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── atomic provisioning (activation-worker) — one company per provisioning_key; fully idempotent ──
create or replace function pierre_rt_provision_customer_company(
  p_activation_id uuid, p_worker text, p_fencing_token bigint, p_company_name text, p_owner_user_id uuid, p_product_key text,
  p_source_type text, p_source_reference text, p_steps jsonb, p_correlation uuid)
returns uuid as $$
declare a record; v_company uuid; v_member uuid; v_session uuid; v_pk text := coalesce(p_product_key,'pierre'); s record; v_ord int := 0;
begin
  select * into a from pierre_rt_customer_activations where id=p_activation_id;
  if not found then raise exception 'activation not found' using errcode='23503'; end if;
  -- idempotent: if this activation already produced a company, return it (no fencing needed for replay).
  if a.company_id is not null then return a.company_id; end if;
  if a.status not in ('provisioning') then raise exception 'activation not in provisioning state (%).', a.status using errcode='42501'; end if;
  -- claim ownership + fencing + lease must hold: a stale/unclaimed worker can NEVER provision.
  if a.locked_by is distinct from p_worker then raise exception 'worker does not own this activation lease' using errcode='42501'; end if;
  if p_fencing_token is distinct from a.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  if a.lease_expires_at is null or a.lease_expires_at <= now() then raise exception 'activation lease expired' using errcode='42501'; end if;

  -- 1) company
  v_company := gen_random_uuid();
  insert into pierre_rt_companies (id, name, display_name, status, onboarding_status, owner_user_id, activated_at)
  values (v_company, p_company_name, p_company_name, 'onboarding', 'in_progress', p_owner_user_id, now());

  -- 2) owner membership (active)
  v_member := gen_random_uuid();
  insert into pierre_rt_members (id, company_id, user_id, role, status)
  values (v_member, v_company, p_owner_user_id, 'owner', 'active');
  insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values (v_company, v_member, 'OWNER') on conflict do nothing;

  -- 3) entitlement (active — the activation worker provisions the purchased product)
  insert into pierre_rt_product_entitlements (id, company_id, product_key, status, source_type, source_reference, starts_at)
  values (gen_random_uuid(), v_company, v_pk, 'active', coalesce(p_source_type, a.source_type, 'operator_activation'), coalesce(p_source_reference, a.source_reference), now());

  -- 4) onboarding session + steps (server-authoritative)
  v_session := gen_random_uuid();
  insert into pierre_rt_onboarding_sessions (id, company_id, product_key, status, started_by, started_at, current_step_key)
  values (v_session, v_company, v_pk, 'in_progress', p_owner_user_id, now(),
          (select value->>'step_key' from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) with ordinality o(value, ord) order by ord limit 1));
  for s in select value, ord from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb)) with ordinality o(value, ord) loop
    insert into pierre_rt_onboarding_steps (id, company_id, session_id, step_key, step_ordinal, status, required)
    values (gen_random_uuid(), v_company, v_session, s.value->>'step_key', v_ord,
            'pending', coalesce((s.value->>'required')::boolean, true));
    v_ord := v_ord + 1;
  end loop;

  -- 5) activation → onboarding_required + bind company
  update pierre_rt_customer_activations
     set company_id=v_company, status='onboarding_required', locked_by=null, lease_expires_at=null, completed_at=now(), updated_at=now(), version=version+1
   where id=p_activation_id;

  -- 6) access event
  perform pierre_rt_log_access_event(v_company, p_owner_user_id, p_owner_user_id, v_member, 'customer.activation_completed', null, 'onboarding_required', null, p_correlation, jsonb_build_object('product_key', v_pk));
  return v_company;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── activation: block (activation-worker / billing-webhook) ────────────────────────────
-- billing may block an unclaimed awaiting_commercial_proof activation (pass p_worker=null); a claimed
-- (provisioning) activation may only be blocked by the lease owner with the current fencing token.
create or replace function pierre_rt_block_customer_activation(p_activation_id uuid, p_worker text, p_fencing_token bigint, p_reason text)
returns void as $$
declare a record;
begin
  select * into a from pierre_rt_customer_activations where id=p_activation_id;
  if not found then raise exception 'activation not found' using errcode='23503'; end if;
  if a.status not in ('awaiting_commercial_proof','provisioning') then return; end if; -- idempotent / terminal
  if a.status='provisioning' then
    if a.locked_by is distinct from p_worker then raise exception 'worker does not own this activation lease' using errcode='42501'; end if;
    if p_fencing_token is distinct from a.fencing_token then raise exception 'stale fencing token' using errcode='42501'; end if;
  end if;
  update pierre_rt_customer_activations set status='blocked', blocked_reason=left(coalesce(p_reason,'blocked'),300), locked_by=null, lease_expires_at=null, updated_at=now(), version=version+1
   where id=p_activation_id;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── onboarding: complete a step (app) — server recomputes progress; optimistic lock ────
create or replace function pierre_rt_complete_onboarding_step(
  p_company uuid, p_session_id uuid, p_step_key text, p_completed_by uuid, p_evidence_hash text, p_expected_version int)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; st record; v_total int; v_done int; v_pct int; v_next text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into st from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and step_key=p_step_key;
  if not found then raise exception 'step not found' using errcode='23503'; end if;
  if st.status='completed' then return 'already_completed'; end if;
  if p_expected_version is not null and p_expected_version is distinct from st.version then return 'version_conflict'; end if;
  update pierre_rt_onboarding_steps set status='completed', completed_by=p_completed_by, completed_at=now(), evidence_hash=p_evidence_hash, blocked_reason=null, version=version+1, updated_at=now()
   where company_id=v_company and session_id=p_session_id and step_key=p_step_key;
  -- recompute progress over REQUIRED steps
  select count(*) into v_total from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and required=true;
  select count(*) into v_done  from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and required=true and status='completed';
  v_pct := case when v_total=0 then 100 else (v_done*100)/v_total end;
  select step_key into v_next from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and status in ('pending','reopened','blocked') order by step_ordinal asc limit 1;
  update pierre_rt_onboarding_sessions set progress_percent=v_pct, current_step_key=v_next, status=case when status='not_started' then 'in_progress' else status end, updated_at=now(), version=version+1
   where company_id=v_company and id=p_session_id;
  perform pierre_rt_log_access_event(v_company, p_completed_by, null, null, 'onboarding.step_completed', st.status, 'completed', p_step_key, null, '{}'::jsonb);
  return 'completed';
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── onboarding: reopen a step (app / governed) ────────────────────────────────────────
create or replace function pierre_rt_reopen_onboarding_step(p_company uuid, p_session_id uuid, p_step_key text, p_reason text)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_total int; v_done int; v_pct int;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_onboarding_steps set status='reopened', completed_at=null, evidence_hash=null, blocked_reason=left(p_reason,300), version=version+1, updated_at=now()
   where company_id=v_company and session_id=p_session_id and step_key=p_step_key and status in ('completed','blocked','skipped');
  select count(*) into v_total from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and required=true;
  select count(*) into v_done  from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and required=true and status='completed';
  v_pct := case when v_total=0 then 100 else (v_done*100)/v_total end;
  update pierre_rt_onboarding_sessions set status='reopened', reopened_at=now(), progress_percent=v_pct, current_step_key=p_step_key, completed_at=null, updated_at=now(), version=version+1
   where company_id=v_company and id=p_session_id;
  -- a re-opened onboarding may revert a ready company to onboarding_required
  update pierre_rt_customer_activations set status='onboarding_required', updated_at=now() where company_id=v_company and status='ready';
  perform pierre_rt_log_access_event(v_company, null, null, null, 'onboarding.step_reopened', 'completed', 'reopened', p_step_key, null, '{}'::jsonb);
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── onboarding: complete the session (app) — only if every REQUIRED step is completed AND an
--    active entitlement + active owner exist (the READY gate). Marks the company ready. ──
create or replace function pierre_rt_complete_onboarding_session(p_company uuid, p_session_id uuid, p_actor uuid)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_pending int; v_ent int; v_owner int;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select count(*) into v_pending from pierre_rt_onboarding_steps where company_id=v_company and session_id=p_session_id and required=true and status<>'completed';
  if v_pending>0 then return 'incomplete_steps'; end if;
  select count(*) into v_ent from pierre_rt_product_entitlements where company_id=v_company and status in ('active','grace');
  if v_ent=0 then return 'no_active_entitlement'; end if;
  select count(*) into v_owner from pierre_rt_members where company_id=v_company and role='owner' and status='active';
  if v_owner=0 then return 'no_active_owner'; end if;
  update pierre_rt_onboarding_sessions set status='completed', completed_at=now(), progress_percent=100, current_step_key=null, updated_at=now(), version=version+1
   where company_id=v_company and id=p_session_id and status<>'completed';
  update pierre_rt_companies set status='active', onboarding_status='completed', updated_at=now(), version=version+1 where id=v_company;
  update pierre_rt_customer_activations set status='ready', updated_at=now(), version=version+1 where company_id=v_company and status in ('onboarding_required','suspended');
  perform pierre_rt_log_access_event(v_company, p_actor, null, null, 'onboarding.completed', 'in_progress', 'completed', null, null, '{}'::jsonb);
  return 'completed';
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── invitations: create (app) — supersedes any prior active invite for the same email ──
create or replace function pierre_rt_create_membership_invitation(
  p_company uuid, p_email text, p_email_norm text, p_roles text[], p_token_hash text, p_invited_by uuid, p_expires_at timestamptz)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_invitations set status='superseded', superseded_at=now(), updated_at=now()
   where company_id=v_company and email_normalized=p_email_norm and status='pending';
  v_id := gen_random_uuid();
  insert into pierre_rt_invitations (id, company_id, email, email_normalized, token_hash, roles, invited_by, status, expires_at)
  values (v_id, v_company, p_email, p_email_norm, p_token_hash, coalesce(p_roles, array['VIEWER']::text[]), p_invited_by, 'pending', p_expires_at);
  perform pierre_rt_log_access_event(v_company, p_invited_by, null, null, 'membership.invited', null, 'pending', null, null, jsonb_build_object('roles', to_jsonb(p_roles)));
  return v_id;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── invitations: revoke (app) ──────────────────────────────────────────────────────────
create or replace function pierre_rt_revoke_membership_invitation(p_company uuid, p_invitation_id uuid, p_actor uuid)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_invitations set status='revoked', revoked_at=now(), updated_at=now()
   where company_id=v_company and id=p_invitation_id and status='pending';
  perform pierre_rt_log_access_event(v_company, p_actor, null, null, 'membership.invitation_revoked', 'pending', 'revoked', null, null, '{}'::jsonb);
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── invitations: accept (app, identity-bound — runs BEFORE tenant context exists) ──────
-- validates token/expiry/revocation/email; creates an active membership atomically; idempotent replay.
create or replace function pierre_rt_accept_membership_invitation(p_token_hash text, p_user_id uuid, p_email_norm text, p_now timestamptz)
returns uuid as $$
declare inv record; v_member uuid; m_existing record;
begin
  select * into inv from pierre_rt_invitations where token_hash=p_token_hash;
  if not found then raise exception 'invitation not found' using errcode='23503'; end if;
  -- idempotent replay: already accepted by this user → return the existing membership
  if inv.status='accepted' then
    if inv.accepted_by is distinct from p_user_id then raise exception 'invitation already accepted' using errcode='42501'; end if;
    return (select id from pierre_rt_members where company_id=inv.company_id and user_id=p_user_id);
  end if;
  if inv.status<>'pending' then raise exception 'invitation not pending (%).', inv.status using errcode='42501'; end if;
  if inv.expires_at <= p_now then
    update pierre_rt_invitations set status='expired', updated_at=now() where id=inv.id and status='pending';
    raise exception 'invitation expired' using errcode='42501';
  end if;
  if inv.email_normalized is distinct from p_email_norm then raise exception 'invitation email mismatch' using errcode='42501'; end if;
  -- one membership per (company,user). A REVOKED (removed) or LEFT member must NOT be silently
  -- reactivated by accepting an invitation — that requires a governed reactivation, never an implicit
  -- side effect. Only a brand-new membership (or a benign re-accept of an already-active one) is allowed.
  select id, status into m_existing from pierre_rt_members where company_id=inv.company_id and user_id=p_user_id;
  if found then
    if m_existing.status in ('removed','left','suspended') then
      raise exception 'membership is % — governed reactivation required, cannot accept invitation', m_existing.status using errcode='42501';
    end if;
    v_member := m_existing.id;  -- already active: idempotent
  else
    insert into pierre_rt_members (id, company_id, user_id, role, status)
    values (gen_random_uuid(), inv.company_id, p_user_id, 'viewer', 'active') returning id into v_member;
  end if;
  -- assign the granted role-keys
  insert into pierre_rt_membership_roles (company_id, membership_id, role_key)
    select inv.company_id, v_member, unnest(inv.roles) on conflict do nothing;
  update pierre_rt_invitations set status='accepted', accepted_by=p_user_id, accepted_at=now(), updated_at=now() where id=inv.id and status='pending';
  perform pierre_rt_log_access_event(inv.company_id, p_user_id, p_user_id, v_member, 'membership.invitation_accepted', 'invited', 'active', null, null, '{}'::jsonb);
  return v_member;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── membership lifecycle (app, governed) ──────────────────────────────────────────────
create or replace function pierre_rt_set_member_status(p_company uuid, p_membership_id uuid, p_new_status text, p_actor uuid, p_reason text)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; m record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_new_status not in ('active','suspended','removed','left') then raise exception 'invalid status' using errcode='42501'; end if;
  select * into m from pierre_rt_members where company_id=v_company and id=p_membership_id;
  if not found then raise exception 'member not found' using errcode='23503'; end if;
  if m.status=p_new_status then return 'noop'; end if;
  -- last-owner protection: cannot suspend/remove/leave the last active owner (DB guard also enforces)
  if m.role='owner' and m.status='active' and p_new_status in ('suspended','removed','left') then
    if (select count(*) from pierre_rt_members where company_id=v_company and role='owner' and status='active') <= 1 then
      raise exception 'cannot remove the last active owner' using errcode='23514';
    end if;
  end if;
  update pierre_rt_members set status=p_new_status, updated_at=now() where company_id=v_company and id=p_membership_id;
  perform pierre_rt_log_access_event(v_company, p_actor, m.user_id, p_membership_id,
    case p_new_status when 'suspended' then 'membership.suspended' when 'removed' then 'membership.revoked' when 'left' then 'membership.left' else 'membership.reactivated' end,
    m.status, p_new_status, p_reason, null, '{}'::jsonb);
  return p_new_status;
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ── ownership transfer (app, governed) — target must be an active member; never zero owners ──
create or replace function pierre_rt_transfer_company_ownership(p_company uuid, p_from_membership uuid, p_to_membership uuid, p_actor uuid, p_demote_previous boolean)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; mf record; mt record;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into mf from pierre_rt_members where company_id=v_company and id=p_from_membership;
  if not found or mf.role<>'owner' or mf.status<>'active' then raise exception 'source is not an active owner' using errcode='42501'; end if;
  select * into mt from pierre_rt_members where company_id=v_company and id=p_to_membership;
  if not found then raise exception 'target member not found' using errcode='23503'; end if;
  if mt.status<>'active' then raise exception 'target is not an active member' using errcode='42501'; end if;
  if mt.id=mf.id then return 'noop'; end if;
  -- promote target to owner first (keeps >=1 owner at all times)
  update pierre_rt_members set role='owner', updated_at=now() where company_id=v_company and id=p_to_membership;
  insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values (v_company, p_to_membership, 'OWNER') on conflict do nothing;
  if coalesce(p_demote_previous, true) then
    update pierre_rt_members set role='admin', updated_at=now() where company_id=v_company and id=p_from_membership;
    delete from pierre_rt_membership_roles where company_id=v_company and membership_id=p_from_membership and role_key='OWNER';
    insert into pierre_rt_membership_roles (company_id, membership_id, role_key) values (v_company, p_from_membership, 'ADMIN') on conflict do nothing;
  end if;
  update pierre_rt_companies set owner_user_id=mt.user_id, updated_at=now() where id=v_company;
  perform pierre_rt_log_access_event(v_company, p_actor, mt.user_id, p_to_membership, 'company.ownership_transferred', mf.user_id::text, mt.user_id::text, null, null, '{}'::jsonb);
  return 'transferred';
end; $$ language plpgsql security definer set search_path = pg_catalog, public;

-- ════════════════════════════════════════════════════════════════════════════════════
-- function grants: least-privilege per role. EVERY v28 SECURITY DEFINER function has EXECUTE
-- REVOKED from PUBLIC first (CREATE FUNCTION grants EXECUTE to PUBLIC by default), then is granted
-- ONLY to the role(s) that legitimately call it. pierre_rt_log_access_event + the governed commercial
-- application are INTERNAL helpers (called from other SECURITY DEFINER bodies which run as the owner) —
-- they get NO direct role grant at all. A billing role can never become an activation worker and vice
-- versa: each gets only its own function set.
-- ════════════════════════════════════════════════════════════════════════════════════
do $$
declare
  -- internal-only: called from within other SECURITY DEFINER functions (owner context); never directly.
  internal_fns text[] := array[
    'pierre_rt_log_access_event(uuid,uuid,uuid,uuid,text,text,text,text,uuid,jsonb)'
  ];
  billing_fns text[] := array[
    'pierre_rt_ingest_commercial_event(text,text,text,text,text,text,text,text,timestamptz)',
    'pierre_rt_resolve_commercial_event(uuid,uuid,text,text)',
    'pierre_rt_apply_entitlement_event(uuid,text,text,text,text,integer)',
    'pierre_rt_apply_commercial_event(uuid)',
    'pierre_rt_mark_activation_provisioning(uuid,text,text)',
    'pierre_rt_block_customer_activation(uuid,text,bigint,text)'
  ];
  worker_fns text[] := array[
    'pierre_rt_claim_customer_activation(text,integer,timestamptz)',
    'pierre_rt_provision_customer_company(uuid,text,bigint,text,uuid,text,text,text,jsonb,uuid)',
    'pierre_rt_block_customer_activation(uuid,text,bigint,text)'
  ];
  app_fns text[] := array[
    'pierre_rt_request_customer_activation(text,text,text,uuid,uuid,text)',
    'pierre_rt_complete_onboarding_step(uuid,uuid,text,uuid,text,integer)',
    'pierre_rt_reopen_onboarding_step(uuid,uuid,text,text)',
    'pierre_rt_complete_onboarding_session(uuid,uuid,uuid)',
    'pierre_rt_create_membership_invitation(uuid,text,text,text[],text,uuid,timestamptz)',
    'pierre_rt_revoke_membership_invitation(uuid,uuid,uuid)',
    'pierre_rt_accept_membership_invitation(text,uuid,text,timestamptz)',
    'pierre_rt_set_member_status(uuid,uuid,text,uuid,text)',
    'pierre_rt_transfer_company_ownership(uuid,uuid,uuid,uuid,boolean)'
  ];
  all_fns text[] := internal_fns || billing_fns || worker_fns || app_fns;
  fn text;
begin
  -- 1) revoke EXECUTE from PUBLIC (and, defensively, from every app/runtime role) on EVERY v28 function.
  foreach fn in array all_fns loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('revoke execute on function %s from pierre_rt_app', fn); end if;
    if exists (select 1 from pg_roles where rolname='pierre_rt_billing_webhook') then execute format('revoke execute on function %s from pierre_rt_billing_webhook', fn); end if;
    if exists (select 1 from pg_roles where rolname='pierre_rt_customer_activation_worker') then execute format('revoke execute on function %s from pierre_rt_customer_activation_worker', fn); end if;
  end loop;
  -- 2) grant precisely per role.
  if exists (select 1 from pg_roles where rolname='pierre_rt_billing_webhook') then
    foreach fn in array billing_fns loop execute format('grant execute on function %s to pierre_rt_billing_webhook', fn); end loop;
  end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_customer_activation_worker') then
    foreach fn in array worker_fns loop execute format('grant execute on function %s to pierre_rt_customer_activation_worker', fn); end loop;
    -- the worker also needs the entitlement transition during provisioning (creates the active entitlement)
    execute 'grant execute on function pierre_rt_apply_entitlement_event(uuid,text,text,text,text,integer) to pierre_rt_customer_activation_worker';
  end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
    foreach fn in array app_fns loop execute format('grant execute on function %s to pierre_rt_app', fn); end loop;
  end if;
end$$;

-- ════════════════════════════════════════════════════════════════════════════════════
-- DDL lockdown: untrusted roles must NOT be able to CREATE objects in the public schema (which could
-- shadow names referenced by SECURITY DEFINER functions or plant a malicious function). PostgreSQL 15+
-- already removes CREATE from PUBLIC by default; we make it explicit and also strip it from every
-- least-privilege application/runtime role. The migration owner (superuser) is unaffected and still
-- owns/creates these objects. Idempotent and safe (revokes are no-ops when already absent).
-- ════════════════════════════════════════════════════════════════════════════════════
do $$
declare untrusted text[] := array[
  'pierre_rt_app','pierre_rt_billing_webhook','pierre_rt_customer_activation_worker',
  'pierre_rt_runtime_worker','pierre_rt_runtime_scheduler','pierre_rt_runtime_planner',
  'pierre_rt_communication_worker','pierre_rt_communication_webhook','pierre_rt_webhook_ingress',
  'pierre_rt_signature_worker'
];
r text;
begin
  execute 'revoke create on schema public from public';
  foreach r in array untrusted loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke create on schema public from %I', r);
    end if;
  end loop;
end$$;
