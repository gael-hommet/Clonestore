-- supabase/migrations/2026-06-20__pierre_v13_webhook_ingress_function.sql
-- PHASE 8.3-B2F §3 — WEBHOOK RUNTIME-ROLE PATH. v6/v7 isolated pierre_rt_signature_webhooks
-- (app role fully excluded; a dedicated minimal-privilege `pierre_rt_webhook_ingress` role).
-- This migration makes the ingress role go through ONE governed SECURITY DEFINER function:
-- the role can no longer raw-write the table — it may only call the function, which
-- validates provider / event id / payload size / signature-verified / replay window,
-- DERIVES the tenant from the referenced signature request (never from the caller), and
-- enforces idempotency (same event id + same payload → duplicate; different payload → reject).
-- A public webhook therefore never holds the powers of the general application role, and the
-- ingress role cannot raw-write any business table. Idempotent.

-- Extra columns the governed function records (no raw payload is ever stored — only a hash).
alter table pierre_rt_signature_webhooks add column if not exists event_type     text;
alter table pierre_rt_signature_webhooks add column if not exists correlation_id uuid;
alter table pierre_rt_signature_webhooks add column if not exists ingested_via   text;

-- The ingress role may no longer raw INSERT/UPDATE/DELETE the table: the ONLY write path is
-- the governed function. (It keeps SELECT for read-back/diagnostics.)
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_webhook_ingress') then
    execute 'revoke insert, update, delete on pierre_rt_signature_webhooks from pierre_rt_webhook_ingress';
    execute 'grant select on pierre_rt_signature_webhooks to pierre_rt_webhook_ingress';
  end if;
end$$;

-- ── Governed ingress function (SECURITY DEFINER) ────────────────────────────────
create or replace function pierre_rt_ingest_signature_webhook(
  p_provider             text,
  p_event_id             text,
  p_event_type           text,
  p_payload_hash         text,
  p_payload_size         integer,
  p_signature_request_id uuid,
  p_event_time           timestamptz,
  p_verified             boolean,
  p_correlation_id       uuid
) returns table(webhook_id uuid, status text, company uuid) as $$
declare
  v_allowed text[] := array['docuseal','dropbox_sign','yousign','hellosign','internal_sandbox','local_sandbox'];
  v_max_payload integer := 1048576;            -- 1 MiB hard cap
  v_replay_window interval := interval '5 minutes';
  v_company uuid;
  v_existing pierre_rt_signature_webhooks%rowtype;
  v_id uuid;
begin
  -- 1. provider allow-list
  if p_provider is null or not (p_provider = any(v_allowed)) then
    raise exception 'webhook provider not allowed: %', coalesce(p_provider,'<null>') using errcode = '22023';
  end if;
  -- 2. event id present
  if p_event_id is null or length(p_event_id) = 0 then
    raise exception 'webhook event id is required' using errcode = '22023';
  end if;
  -- 3. signature must have been verified by the caller (HMAC) before reaching the DB
  if p_verified is distinct from true then
    raise exception 'webhook signature not verified' using errcode = '22023';
  end if;
  -- 4. payload size bound
  if p_payload_size is null or p_payload_size <= 0 or p_payload_size > v_max_payload then
    raise exception 'webhook payload size invalid: %', coalesce(p_payload_size, -1) using errcode = '22023';
  end if;
  -- 5. event type present (governed list is enforced at the service layer per provider)
  if p_event_type is null or length(p_event_type) = 0 then
    raise exception 'webhook event type is required' using errcode = '22023';
  end if;
  -- 6. replay window (when a provider timestamp is supplied)
  if p_event_time is not null and p_event_time < now() - v_replay_window then
    raise exception 'webhook event outside the replay window' using errcode = '22023';
  end if;
  -- 7. tenant DERIVED from the referenced signature request — never from the caller/payload
  if p_signature_request_id is not null then
    select company_id into v_company from pierre_rt_signature_requests where id = p_signature_request_id;
  end if;
  -- 8. idempotency on (provider, event_id)
  select * into v_existing from pierre_rt_signature_webhooks where provider = p_provider and provider_event_id = p_event_id;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash then
      raise exception 'webhook replay with a different payload for event %', p_event_id using errcode = '23505';
    end if;
    webhook_id := v_existing.id; status := 'duplicate'; company := v_existing.company_id; return next; return;
  end if;
  -- 9. governed insert (only a payload HASH is stored — never the raw payload/secret)
  v_id := gen_random_uuid();
  insert into pierre_rt_signature_webhooks
    (id, company_id, provider, provider_event_id, signature_request_id, verified, status, payload_hash, event_type, correlation_id, ingested_via, received_at)
  values
    (v_id, v_company, p_provider, p_event_id, p_signature_request_id, true, 'received', p_payload_hash, p_event_type, p_correlation_id, 'governed_function', now());
  webhook_id := v_id; status := 'received'; company := v_company; return next;
end;
$$ language plpgsql security definer;

revoke all on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_webhook_ingress') then
    execute 'grant execute on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) to pierre_rt_webhook_ingress';
  end if;
end$$;
-- The general application role must NOT gain this power.
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
    execute 'revoke execute on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) from pierre_rt_app';
  end if;
end$$;
