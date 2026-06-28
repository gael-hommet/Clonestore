-- supabase/migrations/2026-06-25__pierre_v18_signature_security_closure.sql
-- PHASE 8.3-B3-R2 — signature security closure. Tenant-binds the SECURITY DEFINER worker claim
-- to the session tenant (no free p_company authority); replaces the session-GUC test-provider
-- gate with a service-only provider REGISTRY (the deployable migration declares ONLY live
-- providers); gives the evidence-artifacts ledger real composite tenant-safe FKs + a GOVERNED
-- write function (the app role can no longer raw-INSERT a proof); gives the activation-task
-- ledger real composite FKs, worker lease/concurrency columns and governed schedule/claim/
-- complete/fail functions; and adds an APPEND-ONLY structured effect-history ledger.
-- Idempotent, non-destructive, tenant-safe, applied in order v1→v18. PGlite-compatible.

-- ── R2.2 — real, tenant-safe phone numbers ────────────────────────────────────────
alter table pierre_rt_companies add column if not exists signatory_phone text;
alter table pierre_rt_signature_recipients add column if not exists phone_number text;

-- ── composite unique keys on parent tables (referenced by the new composite FKs) ──────
create unique index if not exists uq_pierre_rt_sigreq_company_id on pierre_rt_signature_requests(company_id, id);
create unique index if not exists uq_pierre_rt_sigevidence_company_id on pierre_rt_signature_evidence(company_id, id);
create unique index if not exists uq_pierre_rt_files_company_id on pierre_rt_files(company_id, id);
create unique index if not exists uq_pierre_rt_contracts_company_id on pierre_rt_employee_contracts(company_id, id);

-- ── R2.4 — tenant-bind the signature-event claim to the SESSION tenant ───────────────
-- The function NO LONGER trusts p_company as authority: it derives the tenant from
-- current_setting('app.current_company') and refuses if unset or if p_company differs. A worker
-- can therefore never claim another tenant's events, even with a forged p_company.
create or replace function pierre_rt_claim_signature_events(p_company uuid, p_limit integer, p_worker text, p_lease_seconds integer)
returns setof pierre_rt_signature_events as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode = '42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch: requested % but session is %', p_company, v_company using errcode = '42501'; end if;
  return query
  update pierre_rt_signature_events e
     set processing_status='processing', locked_at=now(), locked_by=p_worker,
         lease_expires_at=now() + make_interval(secs => greatest(p_lease_seconds, 1)), attempt_count=e.attempt_count + 1
   where e.id in (
     select id from pierre_rt_signature_events
      where company_id = v_company and application_status='pending'
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

-- ── R2.5 — service-only provider REGISTRY (replaces the session-GUC test gate) ────────
-- The DEPLOYABLE migration declares ONLY live providers. fake_provider / *_sandbox are NEVER in
-- the deployable registry; the test harness (superuser) seeds them separately. No session GUC,
-- no app/ingress write or read grant — only the SECURITY DEFINER ingress function (owner) reads it.
create table if not exists pierre_rt_signature_provider_registry (
  provider   text primary key,
  kind       text not null check (kind in ('live','sandbox','test')),
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values
  ('yousign','live',true), ('docuseal','live',true), ('dropbox_sign','live',true), ('hellosign','live',true)
on conflict (provider) do nothing;
revoke all on pierre_rt_signature_provider_registry from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'revoke all on pierre_rt_signature_provider_registry from pierre_rt_app'; end if;
  if exists (select 1 from pg_roles where rolname='pierre_rt_webhook_ingress') then execute 'revoke all on pierre_rt_signature_provider_registry from pierre_rt_webhook_ingress'; end if;
end$$;

-- ingress function now checks the registry (no GUC); everything else unchanged from v17.
create or replace function pierre_rt_ingest_signature_webhook(
  p_provider text, p_event_id text, p_event_type text, p_payload_hash text, p_payload_size integer,
  p_signature_request_id uuid, p_event_time timestamptz, p_verified boolean, p_correlation_id uuid
) returns table(webhook_id uuid, status text, company uuid) as $$
declare
  v_max_payload integer := 1048576;
  v_replay_window interval := interval '5 minutes';
  v_company uuid; v_existing pierre_rt_signature_webhooks%rowtype; v_id uuid;
begin
  if p_provider is null or not exists (select 1 from pierre_rt_signature_provider_registry r where r.provider = p_provider and r.enabled) then
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

-- ── R2.7 — evidence artifacts: composite tenant-safe FKs + governed write only ────────
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_evart_request_ct') then
    alter table pierre_rt_signature_evidence_artifacts add constraint fk_evart_request_ct
      foreign key (company_id, signature_request_id) references pierre_rt_signature_requests(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_evart_evidence_ct') then
    alter table pierre_rt_signature_evidence_artifacts add constraint fk_evart_evidence_ct
      foreign key (company_id, evidence_id) references pierre_rt_signature_evidence(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_evart_file_ct') then
    alter table pierre_rt_signature_evidence_artifacts add constraint fk_evart_file_ct
      foreign key (company_id, file_id) references pierre_rt_files(company_id, id);
  end if;
end$$;
-- the app role can no longer raw-INSERT a proof — only the governed function (as owner) may.
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'revoke insert, update, delete on pierre_rt_signature_evidence_artifacts from pierre_rt_app'; end if; end$$;

create or replace function pierre_rt_record_signature_evidence_artifact(
  p_company uuid, p_signature_request_id uuid, p_evidence_id uuid, p_artifact_type text,
  p_provider_artifact_id text, p_file_id uuid, p_mime_type text, p_sha256 text, p_size_bytes integer,
  p_provider_timestamp timestamptz
) returns table(artifact_id uuid, status text) as $$
declare
  v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
  v_req_provider_request text; v_id uuid; v_existing pierre_rt_signature_evidence_artifacts%rowtype;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_artifact_type not in ('signed_document','audit_trail','certificate','evidence_file') then raise exception 'evidence artifact type not allowed: %', p_artifact_type using errcode='22023'; end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'evidence artifact requires a sha256 digest' using errcode='22023'; end if;
  if p_mime_type is null or length(p_mime_type)=0 then raise exception 'evidence artifact requires a mime type' using errcode='22023'; end if;
  if p_size_bytes is null or p_size_bytes <= 0 then raise exception 'evidence artifact requires a positive size' using errcode='22023'; end if;
  -- the signature request must exist for this tenant, and carry a provider request id
  select provider_request_id into v_req_provider_request from pierre_rt_signature_requests where company_id=v_company and id=p_signature_request_id;
  if not found then raise exception 'evidence references an unknown signature request' using errcode='23503'; end if;
  if v_req_provider_request is null then raise exception 'evidence references a request with no provider request id' using errcode='22023'; end if;
  -- the evidence row (if provided) must belong to THIS request + tenant
  if p_evidence_id is not null and not exists (select 1 from pierre_rt_signature_evidence e where e.company_id=v_company and e.id=p_evidence_id and e.signature_request_id=p_signature_request_id) then
    raise exception 'evidence row does not belong to this request' using errcode='23503';
  end if;
  -- the file must belong to the tenant AND be clean
  if p_file_id is not null then
    if not exists (select 1 from pierre_rt_files f where f.company_id=v_company and f.id=p_file_id) then raise exception 'evidence file does not belong to this tenant' using errcode='23503'; end if;
    if not exists (select 1 from pierre_rt_files f where f.company_id=v_company and f.id=p_file_id and f.upload_status='clean' and f.scan_status='clean') then raise exception 'evidence file is not clean' using errcode='22023'; end if;
  end if;
  -- idempotency: identical duplicate → return existing; incompatible duplicate → conflict
  select * into v_existing from pierre_rt_signature_evidence_artifacts
    where company_id=v_company and signature_request_id=p_signature_request_id and artifact_type=p_artifact_type
      and coalesce(provider_artifact_id, sha256) = coalesce(p_provider_artifact_id, p_sha256);
  if found then
    if v_existing.sha256 is distinct from p_sha256 or v_existing.file_id is distinct from p_file_id then
      raise exception 'evidence artifact already recorded with a different digest/file' using errcode='23505';
    end if;
    artifact_id := v_existing.id; status := 'duplicate'; return next; return;
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_signature_evidence_artifacts
    (id, company_id, signature_request_id, evidence_id, artifact_type, provider_artifact_id, file_id, mime_type, sha256, size_bytes, provider_timestamp, verification_status)
  values (v_id, v_company, p_signature_request_id, p_evidence_id, p_artifact_type, p_provider_artifact_id, p_file_id, p_mime_type, p_sha256, p_size_bytes, p_provider_timestamp, 'verified');
  artifact_id := v_id; status := 'recorded'; return next;
end;
$$ language plpgsql security definer;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'grant execute on function pierre_rt_record_signature_evidence_artifact(uuid,uuid,uuid,text,text,uuid,text,text,integer,timestamptz) to pierre_rt_app'; end if; end$$;

-- ── R2.8/R2.9 — activation tasks: composite FKs + worker lease/concurrency columns ────
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_actask_amendment_ct') then
    alter table pierre_rt_contract_activation_tasks add constraint fk_actask_amendment_ct
      foreign key (company_id, amendment_contract_id) references pierre_rt_employee_contracts(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_actask_parent_ct') then
    alter table pierre_rt_contract_activation_tasks add constraint fk_actask_parent_ct
      foreign key (company_id, parent_contract_id) references pierre_rt_employee_contracts(company_id, id);
  end if;
end$$;
alter table pierre_rt_contract_activation_tasks add column if not exists locked_at        timestamptz;
alter table pierre_rt_contract_activation_tasks add column if not exists locked_by        text;
alter table pierre_rt_contract_activation_tasks add column if not exists lease_expires_at timestamptz;
alter table pierre_rt_contract_activation_tasks add column if not exists attempt_count    integer not null default 0;
alter table pierre_rt_contract_activation_tasks add column if not exists next_retry_at    timestamptz;
alter table pierre_rt_contract_activation_tasks add column if not exists last_error_safe  text;
alter table pierre_rt_contract_activation_tasks add column if not exists dead_lettered_at timestamptz;
-- extend the status check to include dead_letter
alter table pierre_rt_contract_activation_tasks drop constraint if exists pierre_rt_contract_activation_tasks_status_check;
alter table pierre_rt_contract_activation_tasks add constraint pierre_rt_contract_activation_tasks_status_check
  check (status in ('scheduled','applied','cancelled','failed','dead_letter'));
revoke all on pierre_rt_contract_activation_tasks from public;
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  -- the app role may READ its own tenant's tasks (RLS-bound) but writes go through governed fns only
  execute 'revoke insert, update, delete on pierre_rt_contract_activation_tasks from pierre_rt_app';
  execute 'grant select on pierre_rt_contract_activation_tasks to pierre_rt_app';
end if; end$$;

-- effects allowlist guard shared by the governed activation functions
create or replace function pierre_rt_assert_allowlisted_effects(p_effects jsonb) returns void as $$
declare k text;
begin
  for k in select jsonb_object_keys(coalesce(p_effects,'{}'::jsonb)) loop
    if k not in ('employment.role_title','employment.weekly_hours','employment.salary','employment.site_id','employment.effective_from','employment.effective_to') then
      raise exception 'amendment effect not allowlisted: %', k using errcode='22023';
    end if;
  end loop;
end;
$$ language plpgsql;

-- R2.8 — governed scheduling with full relational validation
create or replace function pierre_rt_schedule_contract_activation(
  p_company uuid, p_amendment_id uuid, p_execute_at date, p_effects jsonb
) returns table(task_id uuid, status text) as $$
declare
  v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
  v_amd record; v_parent record; v_existing pierre_rt_contract_activation_tasks%rowtype; v_eff_from date; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  perform pierre_rt_assert_allowlisted_effects(p_effects);
  select id, employee_id, parent_contract_id, workflow_status into v_amd from pierre_rt_employee_contracts where company_id=v_company and id=p_amendment_id;
  if not found then raise exception 'amendment not found for this tenant' using errcode='23503'; end if;
  if v_amd.parent_contract_id is null then raise exception 'not an amendment (no parent)' using errcode='22023'; end if;
  if v_amd.workflow_status <> 'signed' then raise exception 'amendment is not signed' using errcode='22023'; end if;
  select id, employee_id, workflow_status into v_parent from pierre_rt_employee_contracts where company_id=v_company and id=v_amd.parent_contract_id;
  if not found then raise exception 'parent contract not found' using errcode='23503'; end if;
  if v_parent.workflow_status <> 'signed' then raise exception 'parent contract is not signed' using errcode='22023'; end if;
  if v_parent.employee_id is distinct from v_amd.employee_id then raise exception 'amendment and parent belong to different employees' using errcode='22023'; end if;
  -- execute_at must equal the amendment effective_from
  select effective_from into v_eff_from from pierre_rt_employee_contract_versions where company_id=v_company and contract_id=p_amendment_id order by version desc limit 1;
  if v_eff_from is not null and p_execute_at is distinct from v_eff_from then raise exception 'execute_at (%) does not match the amendment effective_from (%)', p_execute_at, v_eff_from using errcode='22023'; end if;
  select * into v_existing from pierre_rt_contract_activation_tasks where company_id=v_company and amendment_contract_id=p_amendment_id;
  if found then task_id := v_existing.id; status := 'duplicate'; return next; return; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_contract_activation_tasks (id, company_id, amendment_contract_id, parent_contract_id, execute_at, effects, status)
  values (v_id, v_company, p_amendment_id, v_amd.parent_contract_id, p_execute_at, p_effects, 'scheduled');
  task_id := v_id; status := 'scheduled'; return next;
end;
$$ language plpgsql security definer;

-- R2.9 — governed atomic claim (FOR UPDATE SKIP LOCKED), session-tenant bound
create or replace function pierre_rt_claim_contract_activations(
  p_company uuid, p_limit integer, p_worker text, p_lease_seconds integer, p_as_of date
) returns setof pierre_rt_contract_activation_tasks as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  return query
  update pierre_rt_contract_activation_tasks t
     set locked_at=now(), locked_by=p_worker,
         lease_expires_at=now() + make_interval(secs => greatest(p_lease_seconds,1)), attempt_count=t.attempt_count + 1
   where t.id in (
     select id from pierre_rt_contract_activation_tasks
      where company_id=v_company and status='scheduled' and execute_at <= p_as_of
        and (locked_at is null or lease_expires_at < now())
        and (next_retry_at is null or next_retry_at <= now())
      order by execute_at asc
      for update skip locked
      limit greatest(p_limit,0)
   )
   returning t.*;
end;
$$ language plpgsql security definer;

-- R2.9 — governed completion / failure (retry + dead-letter), session-tenant bound
create or replace function pierre_rt_complete_contract_activation(p_company uuid, p_task_id uuid) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  update pierre_rt_contract_activation_tasks
     set status='applied', applied_at=now(), locked_at=null, locked_by=null, lease_expires_at=null, last_error_safe=null
   where company_id=v_company and id=p_task_id;
end;
$$ language plpgsql security definer;

create or replace function pierre_rt_fail_contract_activation(p_company uuid, p_task_id uuid, p_error_safe text, p_max_attempts integer) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_attempts integer;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select attempt_count into v_attempts from pierre_rt_contract_activation_tasks where company_id=v_company and id=p_task_id;
  if v_attempts is null then return; end if;
  if v_attempts >= greatest(p_max_attempts,1) then
    update pierre_rt_contract_activation_tasks
       set status='dead_letter', dead_lettered_at=now(), locked_at=null, locked_by=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'error'),200)
     where company_id=v_company and id=p_task_id;
  else
    update pierre_rt_contract_activation_tasks
       set status='scheduled', next_retry_at=now() + make_interval(secs => 300), locked_at=null, locked_by=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'error'),200)
     where company_id=v_company and id=p_task_id;
  end if;
end;
$$ language plpgsql security definer;

do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'grant execute on function pierre_rt_schedule_contract_activation(uuid,uuid,date,jsonb) to pierre_rt_app';
  execute 'grant execute on function pierre_rt_claim_contract_activations(uuid,integer,text,integer,date) to pierre_rt_app';
  execute 'grant execute on function pierre_rt_complete_contract_activation(uuid,uuid) to pierre_rt_app';
  execute 'grant execute on function pierre_rt_fail_contract_activation(uuid,uuid,text,integer) to pierre_rt_app';
end if; end$$;

-- ── R2.10 — APPEND-ONLY structured effect history ────────────────────────────────────
create table if not exists pierre_rt_contract_effect_history (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id           uuid not null,
  parent_contract_id    uuid,
  amendment_contract_id uuid not null,
  activation_task_id    uuid,
  field_key             text not null check (field_key in ('employment.role_title','employment.weekly_hours','employment.salary','employment.site_id','employment.effective_from','employment.effective_to')),
  previous_value        text,
  new_value             text,
  effective_at          date,
  applied_at            timestamptz not null default now(),
  applied_by            uuid,
  correlation_id        uuid
);
create index if not exists idx_rt_effect_history_amendment on pierre_rt_contract_effect_history(company_id, amendment_contract_id);
create index if not exists idx_rt_effect_history_employee on pierre_rt_contract_effect_history(company_id, employee_id);
do $$ begin
  execute 'alter table pierre_rt_contract_effect_history enable row level security';
  execute 'alter table pierre_rt_contract_effect_history force row level security';
  execute 'drop policy if exists rt_iso_pierre_rt_contract_effect_history on pierre_rt_contract_effect_history';
  execute 'create policy rt_iso_pierre_rt_contract_effect_history on pierre_rt_contract_effect_history using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'grant select, insert on pierre_rt_contract_effect_history to pierre_rt_app'; end if;
end$$;
-- append-only: no UPDATE / DELETE (any role)
create or replace function pierre_rt_effect_history_append_only() returns trigger as $$
begin raise exception 'pierre_rt_contract_effect_history is append-only'; end; $$ language plpgsql;
drop trigger if exists trg_effect_history_no_upd on pierre_rt_contract_effect_history;
drop trigger if exists trg_effect_history_no_del on pierre_rt_contract_effect_history;
create trigger trg_effect_history_no_upd before update on pierre_rt_contract_effect_history for each row execute function pierre_rt_effect_history_append_only();
create trigger trg_effect_history_no_del before delete on pierre_rt_contract_effect_history for each row execute function pierre_rt_effect_history_append_only();
