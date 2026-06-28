-- supabase/migrations/2026-06-28__pierre_v20_communication_delivery_core.sql
-- PHASE 8.4 — REAL COMMUNICATION DELIVERY CORE. Turns governed pierre_rt_outbox business events
-- into real, tenant-safe, traceable communications: intents → recipients → deliveries → attempts
-- → provider events, with preferences + suppressions. The general app role can NEVER fabricate a
-- 'sent'/'delivered'/'bounced'/'complained' status; only the specialized worker/webhook roles,
-- through SECURITY DEFINER governed functions, write delivery truth. Append-only attempts +
-- provider events. Composite tenant-safe FKs everywhere. Idempotent, non-destructive, applied in
-- order v1→v20, PGlite-compatible. NEVER applied to production by this session.

-- ── specialized roles (least privilege) ─────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname='pierre_rt_communication_worker') then execute 'create role pierre_rt_communication_worker nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='pierre_rt_communication_webhook') then execute 'create role pierre_rt_communication_webhook nologin'; end if;
end$$;

-- composite unique keys on parents referenced by composite FKs (mirrors v18/v19 pattern)
create unique index if not exists uq_pierre_rt_outbox_company_id on pierre_rt_outbox(company_id, id);

-- ── intents: the governed boundary between a business event and a communication ──────
create table if not exists pierre_rt_communication_intents (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  source_outbox_id  uuid,
  event_kind        text not null,
  object_type       text not null,
  object_id         uuid,
  template_key      text not null,
  template_version  text not null,
  locale            text not null default 'fr',
  category          text not null,
  sensitivity       text not null,
  priority          text not null default 'normal',
  scheduled_at      timestamptz,
  status            text not null default 'pending' check (status in ('pending','resolved','dispatched','cancelled','unknown_event','blocked')),
  dedup_fingerprint text not null,
  correlation_id    uuid,
  created_at        timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_comm_intent_dedup on pierre_rt_communication_intents(company_id, dedup_fingerprint);
create unique index if not exists uq_pierre_rt_comm_intent_company_id on pierre_rt_communication_intents(company_id, id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_intent_outbox_ct') then
    alter table pierre_rt_communication_intents add constraint fk_comm_intent_outbox_ct foreign key (company_id, source_outbox_id) references pierre_rt_outbox(company_id, id);
  end if;
end$$;

-- ── recipients: resolved from REAL tenant identities (never a free payload address) ──
create table if not exists pierre_rt_communication_recipients (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  intent_id           uuid not null,
  recipient_type      text not null,
  recipient_role      text,
  resolved_user_id    uuid,
  resolved_employee_id uuid,
  resolved_membership_id uuid,
  resolved_email      text,
  resolution_source   text not null,
  resolution_status   text not null default 'resolved' check (resolution_status in ('resolved','blocked')),
  created_at          timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_comm_recipient_company_id on pierre_rt_communication_recipients(company_id, id);
create index if not exists idx_pierre_rt_comm_recipient_intent on pierre_rt_communication_recipients(company_id, intent_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_recipient_intent_ct') then
    alter table pierre_rt_communication_recipients add constraint fk_comm_recipient_intent_ct foreign key (company_id, intent_id) references pierre_rt_communication_intents(company_id, id);
  end if;
end$$;

-- ── deliveries: one intent × one recipient × one channel; governed status truth ─────
create table if not exists pierre_rt_communication_deliveries (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references pierre_rt_companies(id) on delete cascade,
  intent_id         uuid not null,
  recipient_id      uuid not null,
  channel           text not null check (channel in ('in_app','email')),
  status            text not null default 'queued' check (status in ('queued','scheduled','processing','submitted','delivered','suppressed','cancelled','retry_scheduled','failed','dead_letter','bounced','complained','submission_unknown')),
  provider          text,
  provider_message_id text,
  idempotency_key   text not null,
  content_hash      text,
  internal_message_id uuid,
  scheduled_at      timestamptz,
  claimed_at        timestamptz,
  locked_by         text,
  lease_expires_at  timestamptz,
  attempt_count     integer not null default 0,
  next_retry_at     timestamptz,
  submitted_at      timestamptz,
  delivered_at      timestamptz,
  failed_at         timestamptz,
  dead_lettered_at  timestamptz,
  last_error_safe   text,
  created_at        timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_comm_delivery_idem on pierre_rt_communication_deliveries(company_id, idempotency_key);
create unique index if not exists uq_pierre_rt_comm_delivery_company_id on pierre_rt_communication_deliveries(company_id, id);
create index if not exists idx_pierre_rt_comm_delivery_due on pierre_rt_communication_deliveries(company_id, status, scheduled_at);
create unique index if not exists uq_pierre_rt_comm_delivery_provmsg on pierre_rt_communication_deliveries(provider, provider_message_id) where provider_message_id is not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_delivery_intent_ct') then
    alter table pierre_rt_communication_deliveries add constraint fk_comm_delivery_intent_ct foreign key (company_id, intent_id) references pierre_rt_communication_intents(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_comm_delivery_recipient_ct') then
    alter table pierre_rt_communication_deliveries add constraint fk_comm_delivery_recipient_ct foreign key (company_id, recipient_id) references pierre_rt_communication_recipients(company_id, id);
  end if;
end$$;

-- ── attempts: APPEND-ONLY proof of every provider/internal attempt ──────────────────
create table if not exists pierre_rt_communication_attempts (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  delivery_id         uuid not null,
  attempt_number      integer not null,
  provider            text,
  provider_message_id text,
  request_fingerprint text,
  result_status       text not null,
  http_status         integer,
  error_code_safe     text,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);
create index if not exists idx_pierre_rt_comm_attempt_delivery on pierre_rt_communication_attempts(company_id, delivery_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_attempt_delivery_ct') then
    alter table pierre_rt_communication_attempts add constraint fk_comm_attempt_delivery_ct foreign key (company_id, delivery_id) references pierre_rt_communication_deliveries(company_id, id);
  end if;
end$$;

-- ── provider events: APPEND-ONLY + idempotent (webhook truth) ───────────────────────
create table if not exists pierre_rt_communication_provider_events (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid,
  provider            text not null,
  provider_event_id   text not null,
  provider_message_id text,
  delivery_id         uuid,
  event_type          text not null,
  payload_hash        text not null,
  occurred_at         timestamptz,
  received_at         timestamptz not null default now(),
  applied_at          timestamptz,
  application_status  text not null default 'pending' check (application_status in ('pending','applied','ignored','unknown','failed'))
);
create unique index if not exists uq_pierre_rt_comm_provevent_dedup on pierre_rt_communication_provider_events(provider, provider_event_id);
create index if not exists idx_pierre_rt_comm_provevent_pending on pierre_rt_communication_provider_events(company_id, application_status) where application_status='pending';

-- ── preferences: category-level opt-outs (mandatory categories can NEVER be disabled) ──
create table if not exists pierre_rt_communication_preferences (
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  user_id     uuid not null,
  category    text not null,
  channel     text not null check (channel in ('in_app','email')),
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (company_id, user_id, category, channel)
);

-- ── suppressions: hard bounce / complaint / manual / invalid ────────────────────────
create table if not exists pierre_rt_communication_suppressions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references pierre_rt_companies(id) on delete cascade,
  email_lower text not null,
  reason      text not null check (reason in ('hard_bounce','complaint','manual','invalid_address')),
  provider    text,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_comm_suppression on pierre_rt_communication_suppressions(company_id, email_lower);

-- ── in-app message store: extend the existing (unused) pierre_rt_notifications ───────
alter table pierre_rt_notifications add column if not exists recipient_user_id uuid;
alter table pierre_rt_notifications add column if not exists title             text;
alter table pierre_rt_notifications add column if not exists body_text         text;
alter table pierre_rt_notifications add column if not exists action_path       text;
alter table pierre_rt_notifications add column if not exists object_type       text;
alter table pierre_rt_notifications add column if not exists object_id         uuid;
alter table pierre_rt_notifications add column if not exists priority          text;
alter table pierre_rt_notifications add column if not exists archived_at       timestamptz;
alter table pierre_rt_notifications add column if not exists dedup_fingerprint text;
alter table pierre_rt_notifications add column if not exists delivery_id       uuid;
create unique index if not exists uq_pierre_rt_notif_dedup on pierre_rt_notifications(company_id, dedup_fingerprint) where dedup_fingerprint is not null;
create index if not exists idx_pierre_rt_notif_recipient on pierre_rt_notifications(company_id, recipient_user_id, created_at desc);

-- ── RLS + grants (tenant isolation; governed-write tables revoke direct DML) ─────────
do $$ declare t text; begin
  foreach t in array array[
    'pierre_rt_communication_intents','pierre_rt_communication_recipients','pierre_rt_communication_deliveries',
    'pierre_rt_communication_attempts','pierre_rt_communication_provider_events','pierre_rt_communication_preferences',
    'pierre_rt_communication_suppressions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists rt_iso_%s on %I', t, t);
    if t = 'pierre_rt_communication_provider_events' then
      -- provider events may be inserted with a null company (resolved later); policy tolerates null
      execute format('create policy rt_iso_%s on %I using (company_id is null or company_id::text = current_setting(''app.current_company'', true)) with check (company_id is null or company_id::text = current_setting(''app.current_company'', true))', t, t);
    else
      execute format('create policy rt_iso_%s on %I using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t, t);
    end if;
    if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('grant select on %I to pierre_rt_app', t); end if;
  end loop;
  -- the app role MAY directly write intents/recipients/preferences (governed at the service layer
  -- by app.current_company RLS); it may NEVER write delivery truth, attempts, or provider events.
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
    execute 'grant insert, update on pierre_rt_communication_intents to pierre_rt_app';
    execute 'grant insert, update on pierre_rt_communication_recipients to pierre_rt_app';
    execute 'grant insert, update, delete on pierre_rt_communication_preferences to pierre_rt_app';
  end if;
end$$;

-- append-only triggers for attempts + provider events
create or replace function pierre_rt_comm_append_only() returns trigger as $$
begin raise exception 'append-only table %', TG_TABLE_NAME using errcode='0A000'; end; $$ language plpgsql;
drop trigger if exists trg_comm_attempt_no_upd on pierre_rt_communication_attempts;
drop trigger if exists trg_comm_attempt_no_del on pierre_rt_communication_attempts;
create trigger trg_comm_attempt_no_upd before update on pierre_rt_communication_attempts for each row execute function pierre_rt_comm_append_only();
create trigger trg_comm_attempt_no_del before delete on pierre_rt_communication_attempts for each row execute function pierre_rt_comm_append_only();

-- ── governed functions ──────────────────────────────────────────────────────────────
-- helper: tenant guard
-- (inlined in each function to stay PGlite-simple)

-- claim due deliveries atomically (FOR UPDATE SKIP LOCKED), session-tenant bound.
create or replace function pierre_rt_claim_communication_deliveries(p_company uuid, p_limit integer, p_worker text, p_lease_seconds integer, p_now timestamptz)
returns setof pierre_rt_communication_deliveries as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  return query
  update pierre_rt_communication_deliveries d
     set status='processing', claimed_at=p_now, locked_by=p_worker,
         lease_expires_at=p_now + make_interval(secs => greatest(p_lease_seconds,1)), attempt_count=d.attempt_count + 1
   where d.id in (
     select id from pierre_rt_communication_deliveries
      where company_id=v_company
        and ( (status in ('queued','scheduled') and (scheduled_at is null or scheduled_at <= p_now))
              or (status='retry_scheduled' and (next_retry_at is null or next_retry_at <= p_now))
              or (status='processing' and lease_expires_at < p_now) )
      order by coalesce(scheduled_at, created_at) asc
      for update skip locked
      limit greatest(p_limit,0)
   )
   returning d.*;
end;
$$ language plpgsql security definer;

-- append a governed attempt (worker must own a valid lease)
create or replace function pierre_rt_record_communication_attempt(
  p_company uuid, p_delivery_id uuid, p_worker text, p_provider text, p_provider_message_id text,
  p_request_fingerprint text, p_result_status text, p_http_status integer, p_error_code_safe text
) returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_locked_by text; v_lease timestamptz; v_attempt integer; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select locked_by, lease_expires_at, attempt_count into v_locked_by, v_lease, v_attempt from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_locked_by is distinct from p_worker then raise exception 'worker does not own this delivery lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'delivery lease has expired' using errcode='42501'; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_communication_attempts (id, company_id, delivery_id, attempt_number, provider, provider_message_id, request_fingerprint, result_status, http_status, error_code_safe, finished_at)
  values (v_id, v_company, p_delivery_id, coalesce(v_attempt,1), p_provider, p_provider_message_id, p_request_fingerprint, p_result_status, p_http_status, p_error_code_safe, now());
  return v_id;
end;
$$ language plpgsql security definer;

-- mark a delivery submitted (email) — worker owns lease; idempotent on an already-submitted delivery
create or replace function pierre_rt_submit_communication_delivery(p_company uuid, p_delivery_id uuid, p_worker text, p_provider text, p_provider_message_id text, p_content_hash text)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text; v_locked_by text; v_lease timestamptz;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status, locked_by, lease_expires_at into v_status, v_locked_by, v_lease from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_status in ('submitted','delivered') then return; end if; -- idempotent / no regression
  if v_locked_by is distinct from p_worker then raise exception 'worker does not own this delivery lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'delivery lease has expired' using errcode='42501'; end if;
  update pierre_rt_communication_deliveries
     set status='submitted', provider=p_provider, provider_message_id=p_provider_message_id, content_hash=coalesce(content_hash,p_content_hash),
         submitted_at=now(), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=null
   where company_id=v_company and id=p_delivery_id;
end;
$$ language plpgsql security definer;

-- mark an in-app delivery delivered, atomically with its internal message id (worker owns lease)
create or replace function pierre_rt_complete_internal_delivery(p_company uuid, p_delivery_id uuid, p_worker text, p_internal_message_id uuid, p_content_hash text)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text; v_locked_by text; v_lease timestamptz;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status, locked_by, lease_expires_at into v_status, v_locked_by, v_lease from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_status='delivered' then return; end if;
  if v_locked_by is distinct from p_worker then raise exception 'worker does not own this delivery lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'delivery lease has expired' using errcode='42501'; end if;
  update pierre_rt_communication_deliveries
     set status='delivered', delivered_at=now(), internal_message_id=p_internal_message_id, content_hash=coalesce(content_hash,p_content_hash),
         locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=null
   where company_id=v_company and id=p_delivery_id;
end;
$$ language plpgsql security definer;

-- governed failure: retry (bounded) / permanent fail / dead-letter / suppressed (worker owns lease)
create or replace function pierre_rt_fail_communication_delivery(
  p_company uuid, p_delivery_id uuid, p_worker text, p_error_safe text, p_disposition text, p_retry_after_seconds integer, p_max_attempts integer
) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text; v_locked_by text; v_lease timestamptz; v_attempts integer;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_disposition not in ('retry','permanent','suppressed','submission_unknown') then raise exception 'invalid disposition: %', p_disposition using errcode='22023'; end if;
  select status, locked_by, lease_expires_at, attempt_count into v_status, v_locked_by, v_lease, v_attempts from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_status in ('delivered','complained') then return; end if; -- terminal: never regress
  if v_locked_by is distinct from p_worker then raise exception 'worker does not own this delivery lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'delivery lease has expired' using errcode='42501'; end if;
  if p_disposition='suppressed' then
    update pierre_rt_communication_deliveries set status='suppressed', failed_at=now(), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'suppressed'),200) where company_id=v_company and id=p_delivery_id;
  elsif p_disposition='submission_unknown' then
    update pierre_rt_communication_deliveries set status='submission_unknown', next_retry_at=now() + make_interval(secs => greatest(coalesce(p_retry_after_seconds,60),1)), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'submission_unknown'),200) where company_id=v_company and id=p_delivery_id;
  elsif p_disposition='permanent' then
    update pierre_rt_communication_deliveries set status='failed', failed_at=now(), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'permanent'),200) where company_id=v_company and id=p_delivery_id;
  elsif v_attempts >= greatest(p_max_attempts,1) then
    update pierre_rt_communication_deliveries set status='dead_letter', dead_lettered_at=now(), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'dead_letter'),200) where company_id=v_company and id=p_delivery_id;
  else
    update pierre_rt_communication_deliveries set status='retry_scheduled', next_retry_at=now() + make_interval(secs => greatest(coalesce(p_retry_after_seconds,60),1)), locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'retry'),200) where company_id=v_company and id=p_delivery_id;
  end if;
end;
$$ language plpgsql security definer;

-- governed in-app message creation (worker only) — the in_app delivery's real persisted message
create or replace function pierre_rt_create_internal_message(
  p_company uuid, p_recipient_user_id uuid, p_delivery_id uuid, p_kind text, p_title text, p_body_text text,
  p_action_path text, p_object_type text, p_object_id uuid, p_priority text, p_dedup_fingerprint text
) returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_id uuid; v_existing uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_recipient_user_id is null then raise exception 'internal message requires a real recipient' using errcode='22023'; end if;
  -- idempotent on the dedup fingerprint
  select id into v_existing from pierre_rt_notifications where company_id=v_company and dedup_fingerprint=p_dedup_fingerprint;
  if found then return v_existing; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_notifications (id, company_id, recipient_user_id, delivery_id, kind, title, body_text, action_path, object_type, object_id, priority, dedup_fingerprint, body)
  values (v_id, v_company, p_recipient_user_id, p_delivery_id, p_kind, p_title, p_body_text, p_action_path, p_object_type, p_object_id, p_priority, p_dedup_fingerprint, '{}'::jsonb);
  return v_id;
end;
$$ language plpgsql security definer;

-- webhook resolver: provider + provider_message_id → (delivery_id, company). NEVER trusts a payload company.
create or replace function pierre_rt_resolve_communication_delivery(p_provider text, p_provider_message_id text)
returns table(delivery_id uuid, company uuid) as $$
begin
  return query select d.id, d.company_id from pierre_rt_communication_deliveries d
    where d.provider = p_provider and d.provider_message_id = p_provider_message_id limit 1;
end;
$$ language plpgsql security definer;

-- webhook ingest: idempotent append of a provider event, tenant derived from the delivery.
create or replace function pierre_rt_ingest_communication_provider_event(
  p_provider text, p_event_id text, p_provider_message_id text, p_event_type text, p_payload_hash text, p_payload_size integer, p_occurred_at timestamptz, p_verified boolean
) returns table(event_row uuid, status text, company uuid, delivery uuid) as $$
declare v_max_payload integer := 1048576; v_company uuid; v_delivery uuid; v_existing pierre_rt_communication_provider_events%rowtype; v_id uuid;
begin
  if p_provider is null or p_provider <> 'resend' then raise exception 'communication webhook provider not allowed: %', coalesce(p_provider,'<null>') using errcode='22023'; end if;
  if p_event_id is null or length(p_event_id)=0 then raise exception 'webhook event id is required' using errcode='22023'; end if;
  if p_verified is distinct from true then raise exception 'webhook signature not verified' using errcode='22023'; end if;
  if p_payload_size is null or p_payload_size <= 0 or p_payload_size > v_max_payload then raise exception 'webhook payload size invalid' using errcode='22023'; end if;
  if p_event_type is null or length(p_event_type)=0 then raise exception 'webhook event type is required' using errcode='22023'; end if;
  if p_provider_message_id is not null then
    select d.id, d.company_id into v_delivery, v_company from pierre_rt_communication_deliveries d where d.provider=p_provider and d.provider_message_id=p_provider_message_id limit 1;
  end if;
  select * into v_existing from pierre_rt_communication_provider_events where provider=p_provider and provider_event_id=p_event_id;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash then raise exception 'webhook replay with a different payload for event %', p_event_id using errcode='23505'; end if;
    event_row := v_existing.id; status := 'duplicate'; company := v_existing.company_id; delivery := v_existing.delivery_id; return next; return;
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_communication_provider_events (id, company_id, provider, provider_event_id, provider_message_id, delivery_id, event_type, payload_hash, occurred_at, application_status)
  values (v_id, v_company, p_provider, p_event_id, p_provider_message_id, v_delivery, p_event_type, p_payload_hash, p_occurred_at, 'pending');
  event_row := v_id; status := 'received'; company := v_company; delivery := v_delivery; return next;
end;
$$ language plpgsql security definer;

-- apply a provider event to its delivery (state machine, monotonic) — worker/app may call (tenant-bound).
create or replace function pierre_rt_apply_communication_provider_event(p_company uuid, p_event_row uuid)
returns text as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_evt pierre_rt_communication_provider_events%rowtype; v_status text; v_new text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select * into v_evt from pierre_rt_communication_provider_events where id=p_event_row and (company_id=v_company);
  if not found then raise exception 'provider event not found' using errcode='23503'; end if;
  if v_evt.application_status <> 'pending' then return v_evt.application_status; end if;
  if v_evt.delivery_id is null then update pierre_rt_communication_provider_events set application_status='unknown', applied_at=now() where id=p_event_row; return 'unknown'; end if;
  select status into v_status from pierre_rt_communication_deliveries where company_id=v_company and id=v_evt.delivery_id;
  -- map provider event_type → delivery status, fail-closed + monotonic
  v_new := case v_evt.event_type
    when 'email.sent' then 'submitted'
    when 'email.delivered' then 'delivered'
    when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained'
    when 'email.delivery_delayed' then null
    when 'email.failed' then 'failed'
    else null end;
  if v_new is null then update pierre_rt_communication_provider_events set application_status='ignored', applied_at=now() where id=p_event_row; return 'ignored'; end if;
  -- never regress a terminal/forward state: delivered & complained are terminal; opened/clicked never change status
  if v_status in ('delivered','complained') and v_new in ('submitted','bounced','failed') then
    update pierre_rt_communication_provider_events set application_status='ignored', applied_at=now() where id=p_event_row; return 'ignored';
  end if;
  if v_status='submitted' and v_new='submitted' then
    update pierre_rt_communication_provider_events set application_status='applied', applied_at=now() where id=p_event_row; return 'applied';
  end if;
  update pierre_rt_communication_deliveries
     set status=v_new,
         delivered_at=case when v_new='delivered' then now() else delivered_at end,
         failed_at=case when v_new in ('bounced','failed') then now() else failed_at end
   where company_id=v_company and id=v_evt.delivery_id;
  update pierre_rt_communication_provider_events set application_status='applied', applied_at=now() where id=p_event_row;
  return 'applied';
end;
$$ language plpgsql security definer;

-- governed suppression insert (worker, on hard bounce/complaint)
create or replace function pierre_rt_record_communication_suppression(p_company uuid, p_email text, p_reason text, p_provider text)
returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_id uuid; v_existing uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select id into v_existing from pierre_rt_communication_suppressions where company_id=v_company and email_lower=lower(p_email);
  if found then return v_existing; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_communication_suppressions (id, company_id, email_lower, reason, provider) values (v_id, v_company, lower(p_email), p_reason, p_provider);
  return v_id;
end;
$$ language plpgsql security definer;

-- ── grants on governed functions: worker + webhook roles only (NOT the general app role) ──
do $$
declare fn text;
declare fns text[] := array[
  'pierre_rt_claim_communication_deliveries(uuid,integer,text,integer,timestamptz)',
  'pierre_rt_record_communication_attempt(uuid,uuid,text,text,text,text,text,integer,text)',
  'pierre_rt_submit_communication_delivery(uuid,uuid,text,text,text,text)',
  'pierre_rt_complete_internal_delivery(uuid,uuid,text,uuid,text)',
  'pierre_rt_fail_communication_delivery(uuid,uuid,text,text,text,integer,integer)',
  'pierre_rt_create_internal_message(uuid,uuid,uuid,text,text,text,text,text,uuid,text,text)',
  'pierre_rt_record_communication_suppression(uuid,text,text,text)',
  'pierre_rt_apply_communication_provider_event(uuid,uuid)'
];
begin
  foreach fn in array fns loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute format('revoke execute on function %s from pierre_rt_app', fn); end if;
    execute format('grant execute on function %s to pierre_rt_communication_worker', fn);
  end loop;
end$$;
-- webhook role: only the resolver + the idempotent ingest (also granted to the existing production
-- webhook DSN role pierre_rt_webhook_ingress so the deployed route works without a new DSN).
do $$ begin
  execute 'revoke all on function pierre_rt_resolve_communication_delivery(text,text) from public';
  execute 'revoke all on function pierre_rt_ingest_communication_provider_event(text,text,text,text,text,integer,timestamptz,boolean) from public';
  execute 'grant execute on function pierre_rt_resolve_communication_delivery(text,text) to pierre_rt_communication_webhook';
  execute 'grant execute on function pierre_rt_ingest_communication_provider_event(text,text,text,text,text,integer,timestamptz,boolean) to pierre_rt_communication_webhook';
  if exists (select 1 from pg_roles where rolname='pierre_rt_webhook_ingress') then
    execute 'grant execute on function pierre_rt_resolve_communication_delivery(text,text) to pierre_rt_webhook_ingress';
    execute 'grant execute on function pierre_rt_ingest_communication_provider_event(text,text,text,text,text,integer,timestamptz,boolean) to pierre_rt_webhook_ingress';
  end if;
  -- apply is also callable by the worker (already granted) so the app worker can drain pending events
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
    execute 'grant execute on function pierre_rt_apply_communication_provider_event(uuid,uuid) to pierre_rt_app';
  end if;
end$$;

-- ── P8.4.20 — governed operator actions (retry / cancel) — app role may request, tenant-bound ──
create or replace function pierre_rt_retry_communication_delivery(p_company uuid, p_delivery_id uuid) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status into v_status from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_status not in ('failed','dead_letter','submission_unknown') then raise exception 'delivery is not in a retryable state (%).', v_status using errcode='22023'; end if;
  update pierre_rt_communication_deliveries set status='queued', next_retry_at=null, dead_lettered_at=null, failed_at=null, locked_by=null, claimed_at=null, lease_expires_at=null where company_id=v_company and id=p_delivery_id;
end;
$$ language plpgsql security definer;
create or replace function pierre_rt_cancel_communication_delivery(p_company uuid, p_delivery_id uuid) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status into v_status from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_status in ('delivered','complained','submitted') then raise exception 'a sent/delivered communication cannot be cancelled' using errcode='22023'; end if;
  update pierre_rt_communication_deliveries set status='cancelled', locked_by=null, claimed_at=null, lease_expires_at=null where company_id=v_company and id=p_delivery_id;
end;
$$ language plpgsql security definer;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'grant execute on function pierre_rt_retry_communication_delivery(uuid,uuid) to pierre_rt_app';
  execute 'grant execute on function pierre_rt_cancel_communication_delivery(uuid,uuid) to pierre_rt_app';
end if; end$$;
