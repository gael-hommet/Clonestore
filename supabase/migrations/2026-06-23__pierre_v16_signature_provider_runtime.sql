-- supabase/migrations/2026-06-23__pierre_v16_signature_provider_runtime.sql
-- PHASE 8.3-B3 — live e-signature provider runtime. Adds provider status / correlation /
-- reconciliation / dead-letter columns, a tenant-scoped event-application queue, the signed
-- artifact linkage, and extends the governed webhook ingress function to ALSO enqueue a
-- tenant-readable signature_events row (the webhook table stays service-only; the app-role
-- worker processes the queue). No silent data repair; every incoherence is refused.
-- Idempotent, non-destructive, tenant-safe, PGlite-compatible.

-- ── signature_requests: provider runtime + reconciliation + signed artifact ─────────
alter table pierre_rt_signature_requests add column if not exists provider_status        text;
alter table pierre_rt_signature_requests add column if not exists provider_correlation_id text;
alter table pierre_rt_signature_requests add column if not exists provider_payload_hash   text;
alter table pierre_rt_signature_requests add column if not exists last_provider_event_at  timestamptz;
alter table pierre_rt_signature_requests add column if not exists reconcile_status        text not null default 'idle';
alter table pierre_rt_signature_requests add column if not exists retry_count             integer not null default 0;
alter table pierre_rt_signature_requests add column if not exists next_retry_at           timestamptz;
alter table pierre_rt_signature_requests add column if not exists dead_letter_reason      text;
alter table pierre_rt_signature_requests add column if not exists signed_document_version_id uuid;
-- one local request per (provider, provider_request_id) — guards against a double submit
create unique index if not exists uq_pierre_rt_sigreq_provider_request
  on pierre_rt_signature_requests(provider, provider_request_id) where provider_request_id is not null;

-- ── signature_events: tenant-scoped application queue ───────────────────────────────
alter table pierre_rt_signature_events add column if not exists canonical_event    text;
alter table pierre_rt_signature_events add column if not exists application_status  text not null default 'pending' check (application_status in ('pending','applied','ignored','unknown','failed'));
alter table pierre_rt_signature_events add column if not exists applied_at          timestamptz;
alter table pierre_rt_signature_events add column if not exists event_rank          integer;
alter table pierre_rt_signature_events add column if not exists provider_event_time timestamptz;
-- full (non-partial) so ON CONFLICT inference works; NULL provider_event_id rows stay distinct.
create unique index if not exists uq_pierre_rt_sigevent_dedup
  on pierre_rt_signature_events(company_id, signature_request_id, provider_event_id);
create index if not exists idx_rt_sigevent_pending on pierre_rt_signature_events(company_id, application_status) where application_status = 'pending';

do $$ begin
  execute 'alter table pierre_rt_signature_events enable row level security';
  execute 'alter table pierre_rt_signature_events force row level security';
  execute 'grant select, insert, update on pierre_rt_signature_events to pierre_rt_app';
  execute 'drop policy if exists rt_iso_pierre_rt_signature_events on pierre_rt_signature_events';
  execute 'create policy rt_iso_pierre_rt_signature_events on pierre_rt_signature_events using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
end$$;

-- ── B3.11 — signed artifact linkage must be a finalized doc version of the same tenant+document ──
create or replace function pierre_rt_signature_request_signed_guard() returns trigger as $$
begin
  if NEW.signed_document_version_id is not null then
    if not exists (
      select 1 from pierre_rt_document_versions dv
      where dv.id = NEW.signed_document_version_id and dv.company_id = NEW.company_id and dv.document_id = NEW.document_id
    ) then
      raise exception 'signed_document_version_id must be a document version of the same tenant + document';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_sigreq_signed_guard on pierre_rt_signature_requests;
create trigger trg_sigreq_signed_guard before insert or update on pierre_rt_signature_requests for each row execute function pierre_rt_signature_request_signed_guard();

-- ── Extend the governed ingress function to ALSO enqueue a tenant-scoped event ──────
-- The webhook table remains service-only; the app-role worker drains pierre_rt_signature_events.
create or replace function pierre_rt_ingest_signature_webhook(
  p_provider text, p_event_id text, p_event_type text, p_payload_hash text, p_payload_size integer,
  p_signature_request_id uuid, p_event_time timestamptz, p_verified boolean, p_correlation_id uuid
) returns table(webhook_id uuid, status text, company uuid) as $$
declare
  v_allowed text[] := array['docuseal','dropbox_sign','yousign','hellosign','internal_sandbox','local_sandbox','fake_provider'];
  v_max_payload integer := 1048576;
  v_replay_window interval := interval '5 minutes';
  v_company uuid;
  v_existing pierre_rt_signature_webhooks%rowtype;
  v_id uuid;
begin
  if p_provider is null or not (p_provider = any(v_allowed)) then raise exception 'webhook provider not allowed: %', coalesce(p_provider,'<null>') using errcode = '22023'; end if;
  if p_event_id is null or length(p_event_id) = 0 then raise exception 'webhook event id is required' using errcode = '22023'; end if;
  if p_verified is distinct from true then raise exception 'webhook signature not verified' using errcode = '22023'; end if;
  if p_payload_size is null or p_payload_size <= 0 or p_payload_size > v_max_payload then raise exception 'webhook payload size invalid: %', coalesce(p_payload_size, -1) using errcode = '22023'; end if;
  if p_event_type is null or length(p_event_type) = 0 then raise exception 'webhook event type is required' using errcode = '22023'; end if;
  if p_event_time is not null and p_event_time < now() - v_replay_window then raise exception 'webhook event outside the replay window' using errcode = '22023'; end if;
  if p_signature_request_id is not null then
    select company_id into v_company from pierre_rt_signature_requests where id = p_signature_request_id;
  end if;
  select * into v_existing from pierre_rt_signature_webhooks where provider = p_provider and provider_event_id = p_event_id;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash then raise exception 'webhook replay with a different payload for event %', p_event_id using errcode = '23505'; end if;
    webhook_id := v_existing.id; status := 'duplicate'; company := v_existing.company_id; return next; return;
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_signature_webhooks
    (id, company_id, provider, provider_event_id, signature_request_id, verified, status, payload_hash, event_type, correlation_id, ingested_via, received_at)
  values (v_id, v_company, p_provider, p_event_id, p_signature_request_id, true, 'received', p_payload_hash, p_event_type, p_correlation_id, 'governed_function', now());
  -- enqueue a tenant-scoped event row for the app-role worker (only when the tenant resolved)
  if v_company is not null and p_signature_request_id is not null then
    insert into pierre_rt_signature_events
      (id, company_id, signature_request_id, event_type, provider_event_id, payload_hash, application_status, provider_event_time, occurred_at, received_at)
    values (gen_random_uuid(), v_company, p_signature_request_id, p_event_type, p_event_id, p_payload_hash, 'pending', p_event_time, coalesce(p_event_time, now()), now())
    on conflict (company_id, signature_request_id, provider_event_id) do nothing;
  end if;
  webhook_id := v_id; status := 'received'; company := v_company; return next;
end;
$$ language plpgsql security definer;
grant execute on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) to pierre_rt_webhook_ingress;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'revoke execute on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) from pierre_rt_app'; end if; end$$;

-- ── Governed resolver: map (provider, provider_request_id) → local request id + tenant ──
-- The webhook route (ingress role) calls this to translate the provider's id to the local
-- signature request WITHOUT directly reading the business table.
create or replace function pierre_rt_resolve_signature_request(p_provider text, p_provider_request_id text)
returns table(signature_request_id uuid, company uuid) as $$
begin
  return query select sr.id, sr.company_id from pierre_rt_signature_requests sr
    where sr.provider = p_provider and sr.provider_request_id = p_provider_request_id limit 1;
end;
$$ language plpgsql security definer;
revoke all on function pierre_rt_resolve_signature_request(text,text) from public;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_webhook_ingress') then
  execute 'grant execute on function pierre_rt_resolve_signature_request(text,text) to pierre_rt_webhook_ingress'; end if; end$$;
