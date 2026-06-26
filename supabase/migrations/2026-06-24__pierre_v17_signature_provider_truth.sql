-- supabase/migrations/2026-06-24__pierre_v17_signature_provider_truth.sql
-- PHASE 8.3-B3-R1 — provider truth + worker concurrency + evidence artifacts + activation.
-- Adds: provisioning state + provider document id; worker lease/claim columns + an atomic
-- claim function (FOR UPDATE SKIP LOCKED); a normalized append-only evidence-artifacts table;
-- a contract activation-task ledger; production-safe webhook ingress (the Fake provider is
-- refused unless an explicit test GUC is set); least-privilege event writes (the app role can
-- no longer raw-INSERT events — only the governed ingress function does). Idempotent,
-- non-destructive, tenant-safe, PGlite-compatible.

-- ── R1.14 — structured amendment effects (allowlisted, captured at amendment creation so
-- activation applies a STRUCTURED effect set, never a free-text clause interpretation) ──
alter table pierre_rt_employee_contracts add column if not exists amendment_effects jsonb not null default '{}'::jsonb;

-- ── R1.2/R1.5 — provisioning state + provider document id ────────────────────────
alter table pierre_rt_signature_requests add column if not exists provisioning_step text not null default 'local_ready';
alter table pierre_rt_signature_requests add column if not exists provider_document_id text;
alter table pierre_rt_signature_requests add column if not exists external_id text;
create unique index if not exists uq_pierre_rt_sigreq_external_id on pierre_rt_signature_requests(company_id, external_id) where external_id is not null;

-- ── R1.10 — worker lease / claim columns ────────────────────────────────────────
alter table pierre_rt_signature_events add column if not exists processing_status text not null default 'pending' check (processing_status in ('pending','processing','done','failed'));
alter table pierre_rt_signature_events add column if not exists locked_at        timestamptz;
alter table pierre_rt_signature_events add column if not exists locked_by        text;
alter table pierre_rt_signature_events add column if not exists lease_expires_at timestamptz;
alter table pierre_rt_signature_events add column if not exists attempt_count    integer not null default 0;

-- R1.10 — least-privilege: the app role can no longer raw-INSERT events (only the governed
-- ingress function inserts). The worker still SELECTs + UPDATEs (claim/apply).
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'revoke insert on pierre_rt_signature_events from pierre_rt_app';
end if; end$$;

-- Atomic claim: FOR UPDATE SKIP LOCKED. Returns the events this worker now owns (lease-bound).
create or replace function pierre_rt_claim_signature_events(p_company uuid, p_limit integer, p_worker text, p_lease_seconds integer)
returns setof pierre_rt_signature_events as $$
begin
  return query
  update pierre_rt_signature_events e
     set processing_status='processing', locked_at=now(), locked_by=p_worker,
         lease_expires_at=now() + make_interval(secs => greatest(p_lease_seconds, 1)), attempt_count=e.attempt_count + 1
   where e.id in (
     select id from pierre_rt_signature_events
      where company_id = p_company and application_status='pending'
        and (processing_status='pending' or (processing_status='processing' and lease_expires_at < now()))
      order by occurred_at asc
      for update skip locked
      limit greatest(p_limit, 0)
   )
   returning e.*;
end;
$$ language plpgsql security definer;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'grant execute on function pierre_rt_claim_signature_events(uuid,integer,text,integer) to pierre_rt_app'; end if; end$$;

-- ── R1.13 — normalized, append-only evidence artifacts ──────────────────────────
create table if not exists pierre_rt_signature_evidence_artifacts (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references pierre_rt_companies(id) on delete cascade,
  signature_request_id uuid not null,
  evidence_id          uuid,
  artifact_type        text not null,
  provider_artifact_id text,
  file_id              uuid,
  mime_type            text,
  sha256               text not null,
  size_bytes           integer,
  provider_timestamp   timestamptz,
  retrieved_at         timestamptz not null default now(),
  verification_status  text not null default 'verified' check (verification_status in ('verified','unverified','failed'))
);
create unique index if not exists uq_pierre_rt_sig_evidence_artifact on pierre_rt_signature_evidence_artifacts(company_id, signature_request_id, artifact_type, coalesce(provider_artifact_id, sha256));
create index if not exists idx_rt_sig_evidence_artifact_req on pierre_rt_signature_evidence_artifacts(company_id, signature_request_id);

-- ── R1.14 — contract activation task ledger (future-dated amendment effects) ─────
create table if not exists pierre_rt_contract_activation_tasks (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references pierre_rt_companies(id) on delete cascade,
  amendment_contract_id uuid not null,
  parent_contract_id    uuid,
  execute_at            date not null,
  status                text not null default 'scheduled' check (status in ('scheduled','applied','cancelled','failed')),
  effects               jsonb not null default '{}'::jsonb,
  attempts              integer not null default 0,
  applied_at            timestamptz,
  created_at            timestamptz not null default now()
);
create unique index if not exists uq_pierre_rt_activation_task on pierre_rt_contract_activation_tasks(company_id, amendment_contract_id);

do $$ declare t text; begin
  foreach t in array array['pierre_rt_signature_evidence_artifacts','pierre_rt_contract_activation_tasks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update on %I to pierre_rt_app', t);
    execute format('drop policy if exists rt_iso_%s on %I', t, t);
    execute format('create policy rt_iso_%s on %I using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t, t);
  end loop;
end$$;
-- evidence artifacts are append-only
create or replace function pierre_rt_evidence_artifact_append_only() returns trigger as $$
begin raise exception 'pierre_rt_signature_evidence_artifacts is append-only'; end; $$ language plpgsql;
drop trigger if exists trg_evidence_artifact_no_upd on pierre_rt_signature_evidence_artifacts;
drop trigger if exists trg_evidence_artifact_no_del on pierre_rt_signature_evidence_artifacts;
create trigger trg_evidence_artifact_no_upd before update on pierre_rt_signature_evidence_artifacts for each row execute function pierre_rt_evidence_artifact_append_only();
create trigger trg_evidence_artifact_no_del before delete on pierre_rt_signature_evidence_artifacts for each row execute function pierre_rt_evidence_artifact_append_only();

-- ── R1.8 — production-safe webhook ingress: the Fake/sandbox provider is refused unless an
-- explicit test GUC (app.allow_test_provider='true') is set. Production never sets it. ──
create or replace function pierre_rt_ingest_signature_webhook(
  p_provider text, p_event_id text, p_event_type text, p_payload_hash text, p_payload_size integer,
  p_signature_request_id uuid, p_event_time timestamptz, p_verified boolean, p_correlation_id uuid
) returns table(webhook_id uuid, status text, company uuid) as $$
declare
  -- production-accepted providers (the TS layer additionally fail-closes non-live in prod).
  v_allowed text[] := array['docuseal','dropbox_sign','yousign','hellosign','internal_sandbox','local_sandbox'];
  v_max_payload integer := 1048576;
  v_replay_window interval := interval '5 minutes';
  v_company uuid; v_existing pierre_rt_signature_webhooks%rowtype; v_id uuid;
  -- the FAKE provider is refused unless an explicit test GUC is set (production never sets it).
  v_allow_fake boolean := coalesce(current_setting('app.allow_test_provider', true) = 'true', false);
begin
  if p_provider is null or not (p_provider = any(v_allowed) or (v_allow_fake and p_provider = 'fake_provider')) then
    raise exception 'webhook provider not allowed: %', coalesce(p_provider,'<null>') using errcode = '22023';
  end if;
  if p_event_id is null or length(p_event_id) = 0 then raise exception 'webhook event id is required' using errcode = '22023'; end if;
  if p_verified is distinct from true then raise exception 'webhook signature not verified' using errcode = '22023'; end if;
  if p_payload_size is null or p_payload_size <= 0 or p_payload_size > v_max_payload then raise exception 'webhook payload size invalid: %', coalesce(p_payload_size, -1) using errcode = '22023'; end if;
  if p_event_type is null or length(p_event_type) = 0 then raise exception 'webhook event type is required' using errcode = '22023'; end if;
  if p_event_time is not null and p_event_time < now() - v_replay_window then raise exception 'webhook event outside the replay window' using errcode = '22023'; end if;
  if p_signature_request_id is not null then select company_id into v_company from pierre_rt_signature_requests where id = p_signature_request_id; end if;
  select * into v_existing from pierre_rt_signature_webhooks where provider = p_provider and provider_event_id = p_event_id;
  if found then
    if v_existing.payload_hash is distinct from p_payload_hash then raise exception 'webhook replay with a different payload for event %', p_event_id using errcode = '23505'; end if;
    webhook_id := v_existing.id; status := 'duplicate'; company := v_existing.company_id; return next; return;
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_signature_webhooks (id, company_id, provider, provider_event_id, signature_request_id, verified, status, payload_hash, event_type, correlation_id, ingested_via, received_at)
  values (v_id, v_company, p_provider, p_event_id, p_signature_request_id, true, 'received', p_payload_hash, p_event_type, p_correlation_id, 'governed_function', now());
  if v_company is not null and p_signature_request_id is not null then
    insert into pierre_rt_signature_events (id, company_id, signature_request_id, event_type, provider_event_id, payload_hash, application_status, provider_event_time, occurred_at, received_at)
    values (gen_random_uuid(), v_company, p_signature_request_id, p_event_type, p_event_id, p_payload_hash, 'pending', p_event_time, coalesce(p_event_time, now()), now())
    on conflict (company_id, signature_request_id, provider_event_id) do nothing;
  end if;
  webhook_id := v_id; status := 'received'; company := v_company; return next;
end;
$$ language plpgsql security definer;
grant execute on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) to pierre_rt_webhook_ingress;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'revoke execute on function pierre_rt_ingest_signature_webhook(text,text,text,text,integer,uuid,timestamptz,boolean,uuid) from pierre_rt_app'; end if; end$$;
