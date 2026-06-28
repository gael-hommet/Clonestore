-- supabase/migrations/2026-06-29__pierre_v21_communication_runtime_truth.sql
-- PHASE 8.4-R1 — communication RUNTIME TRUTH. Closes the gaps between the local tests and the real
-- executable runtime: tenant-safe recipient FKs + identity-consistency, exact event idempotency
-- (source key + payload hash + object version), real outbox quarantine state, frozen rendered
-- content before the first send, worker-owned internal-message creation, non-leaking provider
-- events, membership-bound preferences, and the exact least-privilege grants for the worker/webhook
-- roles. Idempotent, non-destructive (no silent data repair), applied in order v1→v21. PGlite-OK.

-- composite uniques on parents referenced by the new composite FKs
create unique index if not exists uq_pierre_rt_members_company_id on pierre_rt_members(company_id, id);
create unique index if not exists uq_pierre_rt_members_company_user on pierre_rt_members(company_id, user_id);

-- ── R1.5 — recipient FKs + identity consistency ─────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_recipient_membership_ct') then
    alter table pierre_rt_communication_recipients add constraint fk_comm_recipient_membership_ct foreign key (company_id, resolved_membership_id) references pierre_rt_members(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_comm_recipient_employee_ct') then
    alter table pierre_rt_communication_recipients add constraint fk_comm_recipient_employee_ct foreign key (company_id, resolved_employee_id) references pierre_rt_employees(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='ck_comm_recipient_identity') then
    alter table pierre_rt_communication_recipients add constraint ck_comm_recipient_identity check (
      (recipient_type = 'employer_operator' and resolved_membership_id is not null and resolved_user_id is not null)
      or (recipient_type = 'employee' and resolved_employee_id is not null)
      or (recipient_type = 'external_recipient' and resolved_email is not null)
    );
  end if;
end$$;

-- ── R1.6 — exact event idempotency: source key + payload hash + object version ───────
alter table pierre_rt_communication_intents add column if not exists source_event_key  text;
alter table pierre_rt_communication_intents add column if not exists source_payload_hash text;
alter table pierre_rt_communication_intents add column if not exists object_version     text;
create unique index if not exists uq_pierre_rt_comm_intent_source_key on pierre_rt_communication_intents(company_id, source_event_key) where source_event_key is not null;

-- ── R1.7 — real outbox quarantine state (separate from the legacy status) ────────────
alter table pierre_rt_outbox add column if not exists comm_processing_status text;
alter table pierre_rt_outbox add column if not exists comm_quarantine_reason text;
alter table pierre_rt_outbox add column if not exists comm_processed_at      timestamptz;
create index if not exists idx_rt_outbox_comm_pending on pierre_rt_outbox(company_id, comm_processing_status) where comm_processing_status is null or comm_processing_status='pending';

-- ── R1.8 — frozen rendered content on the delivery (reproducible / privately stored) ──
alter table pierre_rt_communication_deliveries add column if not exists template_key      text;
alter table pierre_rt_communication_deliveries add column if not exists template_version  text;
alter table pierre_rt_communication_deliveries add column if not exists locale            text;
alter table pierre_rt_communication_deliveries add column if not exists canonical_variables jsonb;
alter table pierre_rt_communication_deliveries add column if not exists canonical_variables_hash text;
alter table pierre_rt_communication_deliveries add column if not exists frozen_subject    text;
alter table pierre_rt_communication_deliveries add column if not exists frozen_plain_text text;
alter table pierre_rt_communication_deliveries add column if not exists frozen_html       text;
alter table pierre_rt_communication_deliveries add column if not exists subject_hash      text;
alter table pierre_rt_communication_deliveries add column if not exists plain_text_hash   text;
alter table pierre_rt_communication_deliveries add column if not exists html_hash         text;
alter table pierre_rt_communication_deliveries add column if not exists provider_idempotency_key text;
alter table pierre_rt_communication_deliveries add column if not exists rendered_at       timestamptz;

-- the app role may CREATE a queued delivery (with its frozen content) but NEVER set delivery truth.
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'grant insert on pierre_rt_communication_deliveries to pierre_rt_app';
end if; end$$;
-- guard: the app role can only insert a queued/scheduled delivery (never submitted/delivered/etc.)
create or replace function pierre_rt_comm_delivery_app_insert_guard() returns trigger as $$
begin
  if current_user = 'pierre_rt_app' and NEW.status not in ('queued','scheduled') then
    raise exception 'the app role may only create queued/scheduled deliveries' using errcode='42501';
  end if;
  return NEW;
end; $$ language plpgsql;
drop trigger if exists trg_comm_delivery_app_insert on pierre_rt_communication_deliveries;
create trigger trg_comm_delivery_app_insert before insert on pierre_rt_communication_deliveries for each row execute function pierre_rt_comm_delivery_app_insert_guard();

-- ── R1.12 — internal-message governance: worker ownership + FK + match ───────────────
alter table pierre_rt_notifications add column if not exists intent_id uuid;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_notif_delivery_ct') then
    alter table pierre_rt_notifications add constraint fk_notif_delivery_ct foreign key (company_id, delivery_id) references pierre_rt_communication_deliveries(company_id, id);
  end if;
end$$;
-- redefine: worker must own the delivery lease; the delivery must be in_app/processing; recipient + tenant must match.
drop function if exists pierre_rt_create_internal_message(uuid,uuid,uuid,text,text,text,text,text,uuid,text,text);
create or replace function pierre_rt_create_internal_message(
  p_company uuid, p_recipient_user_id uuid, p_delivery_id uuid, p_worker text, p_kind text, p_title text, p_body_text text,
  p_action_path text, p_object_type text, p_object_id uuid, p_priority text, p_dedup_fingerprint text
) returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_id uuid; v_existing uuid;
  v_channel text; v_status text; v_locked_by text; v_lease timestamptz; v_intent uuid; v_recipient uuid; v_rec_user uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_recipient_user_id is null then raise exception 'internal message requires a real recipient' using errcode='22023'; end if;
  -- the delivery must be this tenant's, in_app, claimed-and-processing by THIS worker, lease valid.
  select channel, status, locked_by, lease_expires_at, intent_id, recipient_id into v_channel, v_status, v_locked_by, v_lease, v_intent, v_recipient
    from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_channel <> 'in_app' then raise exception 'internal message only for an in_app delivery' using errcode='22023'; end if;
  if v_status <> 'processing' then raise exception 'delivery is not in processing' using errcode='22023'; end if;
  if v_locked_by is distinct from p_worker then raise exception 'worker does not own this delivery lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'delivery lease has expired' using errcode='42501'; end if;
  -- the recipient user must EXACTLY match the delivery's recipient row.
  select resolved_user_id into v_rec_user from pierre_rt_communication_recipients where company_id=v_company and id=v_recipient;
  if v_rec_user is distinct from p_recipient_user_id then raise exception 'recipient does not match the delivery recipient' using errcode='22023'; end if;
  -- idempotent on the dedup fingerprint
  select id into v_existing from pierre_rt_notifications where company_id=v_company and dedup_fingerprint=p_dedup_fingerprint;
  if found then return v_existing; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_notifications (id, company_id, recipient_user_id, delivery_id, intent_id, kind, title, body_text, action_path, object_type, object_id, priority, dedup_fingerprint, body)
  values (v_id, v_company, p_recipient_user_id, p_delivery_id, v_intent, p_kind, p_title, p_body_text, p_action_path, p_object_type, p_object_id, p_priority, p_dedup_fingerprint, '{}'::jsonb);
  return v_id;
end;
$$ language plpgsql security definer;
-- complete_internal must verify the message belongs to this delivery + recipient + tenant.
create or replace function pierre_rt_complete_internal_delivery(p_company uuid, p_delivery_id uuid, p_worker text, p_internal_message_id uuid, p_content_hash text)
returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text; v_locked_by text; v_lease timestamptz; v_recipient uuid; v_rec_user uuid;
  v_msg_delivery uuid; v_msg_recipient uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status, locked_by, lease_expires_at, recipient_id into v_status, v_locked_by, v_lease, v_recipient from pierre_rt_communication_deliveries where company_id=v_company and id=p_delivery_id;
  if not found then raise exception 'delivery not found' using errcode='23503'; end if;
  if v_status='delivered' then return; end if;
  if v_locked_by is distinct from p_worker then raise exception 'worker does not own this delivery lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'delivery lease has expired' using errcode='42501'; end if;
  -- the message must belong to THIS delivery, tenant, and the delivery's recipient.
  select delivery_id, recipient_user_id into v_msg_delivery, v_msg_recipient from pierre_rt_notifications where company_id=v_company and id=p_internal_message_id;
  if v_msg_delivery is distinct from p_delivery_id then raise exception 'internal message does not belong to this delivery' using errcode='22023'; end if;
  select resolved_user_id into v_rec_user from pierre_rt_communication_recipients where company_id=v_company and id=v_recipient;
  if v_msg_recipient is distinct from v_rec_user then raise exception 'internal message recipient mismatch' using errcode='22023'; end if;
  update pierre_rt_communication_deliveries
     set status='delivered', delivered_at=now(), internal_message_id=p_internal_message_id, content_hash=coalesce(content_hash,p_content_hash),
         locked_by=null, claimed_at=null, lease_expires_at=null, last_error_safe=null
   where company_id=v_company and id=p_delivery_id;
end;
$$ language plpgsql security definer;

-- ── R1.3 — the communication webhook role is DISTINCT from the signature ingress role. The comm
-- resolver + ingest functions are revoked from pierre_rt_webhook_ingress (the signature role): the
-- communication webhook is served ONLY by pierre_rt_communication_webhook (granted in v20).
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_webhook_ingress') then
    execute 'revoke execute on function pierre_rt_resolve_communication_delivery(text,text) from pierre_rt_webhook_ingress';
    execute 'revoke execute on function pierre_rt_ingest_communication_provider_event(text,text,text,text,text,integer,timestamptz,boolean) from pierre_rt_webhook_ingress';
  end if;
end$$;

-- ── R1.13 — provider events do NOT leak across tenants (no null-OR policy) ───────────
do $$ begin
  execute 'drop policy if exists rt_iso_pierre_rt_communication_provider_events on pierre_rt_communication_provider_events';
  -- a tenant role sees ONLY its own resolved events; null-company (unresolved) rows are invisible to
  -- every tenant role (only the SECURITY DEFINER webhook/apply functions, run as owner, touch them).
  execute 'create policy rt_iso_pierre_rt_communication_provider_events on pierre_rt_communication_provider_events using (company_id is not null and company_id::text = current_setting(''app.current_company'', true)) with check (company_id is not null and company_id::text = current_setting(''app.current_company'', true))';
end$$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_provevent_delivery_ct') then
    alter table pierre_rt_communication_provider_events add constraint fk_comm_provevent_delivery_ct foreign key (company_id, delivery_id) references pierre_rt_communication_deliveries(company_id, id);
  end if;
end$$;

-- ── R1.14 — preferences bound to a real membership of the tenant ─────────────────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_comm_pref_member_ct') then
    alter table pierre_rt_communication_preferences add constraint fk_comm_pref_member_ct foreign key (company_id, user_id) references pierre_rt_members(company_id, user_id);
  end if;
end$$;

-- ── grant the worker the new governed internal-message function (12-arg, worker-owned) ──
do $$ begin
  execute 'revoke all on function pierre_rt_create_internal_message(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text) from public';
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'revoke execute on function pierre_rt_create_internal_message(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text) from pierre_rt_app'; end if;
  execute 'grant execute on function pierre_rt_create_internal_message(uuid,uuid,uuid,text,text,text,text,text,text,uuid,text,text) to pierre_rt_communication_worker';
end$$;

-- ── R1.1 — the dispatch worker role may SELECT (tenant-bound, RLS-enforced) ONLY the communication
-- tables it needs (deliveries/intents/recipients for the frozen content, preferences/suppressions for
-- gating). It is NEVER granted a business table (contracts/employees/documents) — a worker that tries
-- to read a contract or an employee is refused. Delivery TRUTH stays governed-only (no insert/update).
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_communication_worker') then
    execute 'grant select on pierre_rt_communication_deliveries to pierre_rt_communication_worker';
    execute 'grant select on pierre_rt_communication_intents to pierre_rt_communication_worker';
    execute 'grant select on pierre_rt_communication_recipients to pierre_rt_communication_worker';
    execute 'grant select on pierre_rt_communication_preferences to pierre_rt_communication_worker';
    execute 'grant select on pierre_rt_communication_suppressions to pierre_rt_communication_worker';
  end if;
end$$;
