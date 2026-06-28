-- supabase/migrations/2026-06-27__pierre_v19_signature_semantic_integrity.sql
-- PHASE 8.3-B3-R3 — signature semantic integrity closure. Removes the five remaining bypasses:
--  R3.2 production registry = ONLY the implemented provider (yousign);
--  R3.3 evidence proofs require a REAL file and DERIVE their verified truth from it (never caller
--       metadata); a specialized worker role records them (the general app role cannot);
--  R3.4 complete/fail require the caller to OWN a valid lease (worker ownership);
--  R3.5 the effect-history ledger is written ONLY through a governed function (no app INSERT),
--       with composite tenant-safe FKs + a per-amendment/field uniqueness.
-- Idempotent, non-destructive (no silent data repair), applied in order v1→v19, PGlite-compatible.

-- ── specialized worker role (records proofs + effect history; the app role cannot) ──────────
do $$ begin
  if not exists (select 1 from pg_roles where rolname='pierre_rt_signature_worker') then
    execute 'create role pierre_rt_signature_worker nologin';
  end if;
end$$;

-- ── R3.2 — production registry: ONLY the implemented provider (yousign) ─────────────────────
-- docuseal / dropbox_sign / hellosign had no concrete adapter, webhook verify, contract tests or
-- smoke — they must not sit in a security boundary as "forecast" providers. Removed (config rows,
-- not user data). The harness re-seeds the deterministic test providers separately.
delete from pierre_rt_signature_provider_registry where provider in ('docuseal','dropbox_sign','hellosign');
insert into pierre_rt_signature_provider_registry (provider, kind, enabled) values ('yousign','live',true)
on conflict (provider) do nothing;

-- ── R3.3 — evidence proof: file-derived truth, file mandatory, specialized worker only ──────
drop function if exists pierre_rt_record_signature_evidence_artifact(uuid,uuid,uuid,text,text,uuid,text,text,integer,timestamptz);
create or replace function pierre_rt_record_signature_evidence_artifact(
  p_company uuid, p_signature_request_id uuid, p_evidence_id uuid, p_artifact_type text,
  p_provider_artifact_id text, p_file_id uuid, p_provider_timestamp timestamptz
) returns table(artifact_id uuid, status text) as $$
declare
  v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
  v_req_provider_request text; v_req_document uuid;
  v_file_company uuid; v_file_sha text; v_file_mime text; v_file_size bigint; v_file_upload text; v_file_scan text;
  v_linked boolean; v_id uuid; v_existing pierre_rt_signature_evidence_artifacts%rowtype;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_artifact_type not in ('signed_document','audit_trail','certificate','evidence_file') then raise exception 'evidence artifact type not allowed: %', p_artifact_type using errcode='22023'; end if;
  -- R3.3 — a MATERIAL proof requires a REAL file. No file → refuse (never a verified proof on caller metadata).
  if p_file_id is null then raise exception 'evidence artifact requires a real file_id' using errcode='22023'; end if;
  -- the signature request must exist for this tenant and carry a provider request id
  select provider_request_id, document_id into v_req_provider_request, v_req_document from pierre_rt_signature_requests where company_id=v_company and id=p_signature_request_id;
  if not found then raise exception 'evidence references an unknown signature request' using errcode='23503'; end if;
  if v_req_provider_request is null then raise exception 'evidence references a request with no provider request id' using errcode='22023'; end if;
  -- the evidence row (if provided) must belong to THIS request + tenant
  if p_evidence_id is not null and not exists (select 1 from pierre_rt_signature_evidence e where e.company_id=v_company and e.id=p_evidence_id and e.signature_request_id=p_signature_request_id) then
    raise exception 'evidence row does not belong to this request' using errcode='23503';
  end if;
  -- DERIVE the verified truth from the actual file row (never trust caller-supplied metadata)
  select company_id, sha256, detected_mime_type, size_bytes, upload_status, scan_status
    into v_file_company, v_file_sha, v_file_mime, v_file_size, v_file_upload, v_file_scan
    from pierre_rt_files where id=p_file_id;
  if not found or v_file_company is distinct from v_company then raise exception 'evidence file does not belong to this tenant' using errcode='23503'; end if;
  if v_file_upload <> 'clean' or v_file_scan <> 'clean' then raise exception 'evidence file is not clean' using errcode='22023'; end if;
  if v_file_sha is null or v_file_sha !~ '^[0-9a-f]{64}$' then raise exception 'evidence file has no real digest' using errcode='22023'; end if;
  if v_file_size is null or v_file_size <= 0 then raise exception 'evidence file has no real size' using errcode='22023'; end if;
  if v_file_mime is null or length(v_file_mime)=0 then raise exception 'evidence file has no detected mime type' using errcode='22023'; end if;
  -- the file must be LINKED to THIS request: either a rendered version of the request's document,
  -- or the evidence_file of this request's evidence row.
  v_linked := exists (select 1 from pierre_rt_document_versions dv where dv.company_id=v_company and dv.document_id=v_req_document and dv.rendered_pdf_file_id=p_file_id)
           or exists (select 1 from pierre_rt_signature_evidence e where e.company_id=v_company and e.signature_request_id=p_signature_request_id and e.evidence_file_id=p_file_id);
  if not v_linked then raise exception 'evidence file is not linked to this signature request' using errcode='22023'; end if;
  -- idempotency / conflict (keyed on the DERIVED sha or the provider artifact id)
  select * into v_existing from pierre_rt_signature_evidence_artifacts
    where company_id=v_company and signature_request_id=p_signature_request_id and artifact_type=p_artifact_type
      and coalesce(provider_artifact_id, sha256) = coalesce(p_provider_artifact_id, v_file_sha);
  if found then
    if v_existing.sha256 is distinct from v_file_sha or v_existing.file_id is distinct from p_file_id then
      raise exception 'evidence artifact already recorded with a different digest/file' using errcode='23505';
    end if;
    artifact_id := v_existing.id; status := 'duplicate'; return next; return;
  end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_signature_evidence_artifacts
    (id, company_id, signature_request_id, evidence_id, artifact_type, provider_artifact_id, file_id, mime_type, sha256, size_bytes, provider_timestamp, verification_status)
  values (v_id, v_company, p_signature_request_id, p_evidence_id, p_artifact_type, p_provider_artifact_id, p_file_id, v_file_mime, v_file_sha, v_file_size, p_provider_timestamp, 'verified');
  artifact_id := v_id; status := 'recorded'; return next;
end;
$$ language plpgsql security definer;
-- only the specialized worker role may record a proof; the general app role NEVER can.
revoke all on function pierre_rt_record_signature_evidence_artifact(uuid,uuid,uuid,text,text,uuid,timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'revoke execute on function pierre_rt_record_signature_evidence_artifact(uuid,uuid,uuid,text,text,uuid,timestamptz) from pierre_rt_app'; end if;
  execute 'grant execute on function pierre_rt_record_signature_evidence_artifact(uuid,uuid,uuid,text,text,uuid,timestamptz) to pierre_rt_signature_worker';
end$$;

-- ── R3.4 — activation lease ownership (claim → processing; complete/fail require the lease) ──
alter table pierre_rt_contract_activation_tasks drop constraint if exists pierre_rt_contract_activation_tasks_status_check;
alter table pierre_rt_contract_activation_tasks add constraint pierre_rt_contract_activation_tasks_status_check
  check (status in ('scheduled','processing','applied','cancelled','failed','dead_letter'));
create unique index if not exists uq_pierre_rt_activation_task_company_id on pierre_rt_contract_activation_tasks(company_id, id);

create or replace function pierre_rt_claim_contract_activations(
  p_company uuid, p_limit integer, p_worker text, p_lease_seconds integer, p_as_of date
) returns setof pierre_rt_contract_activation_tasks as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  return query
  update pierre_rt_contract_activation_tasks t
     set status='processing', locked_at=now(), locked_by=p_worker,
         lease_expires_at=now() + make_interval(secs => greatest(p_lease_seconds,1)), attempt_count=t.attempt_count + 1
   where t.id in (
     select id from pierre_rt_contract_activation_tasks
      where company_id=v_company
        and ( (status='scheduled' and execute_at <= p_as_of and (next_retry_at is null or next_retry_at <= now()))
              or (status='processing' and lease_expires_at < now()) )
      order by execute_at asc
      for update skip locked
      limit greatest(p_limit,0)
   )
   returning t.*;
end;
$$ language plpgsql security definer;

drop function if exists pierre_rt_complete_contract_activation(uuid,uuid);
create or replace function pierre_rt_complete_contract_activation(p_company uuid, p_task_id uuid, p_worker text) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text; v_locked_by text; v_locked_at timestamptz; v_lease timestamptz;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status, locked_by, locked_at, lease_expires_at into v_status, v_locked_by, v_locked_at, v_lease from pierre_rt_contract_activation_tasks where company_id=v_company and id=p_task_id;
  if not found then raise exception 'activation task not found' using errcode='23503'; end if;
  if v_status='applied' then return; end if; -- idempotent
  if v_locked_at is null or v_locked_by is distinct from p_worker then raise exception 'worker does not own this task lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'task lease has expired' using errcode='42501'; end if;
  if v_status <> 'processing' then raise exception 'task is not in processing' using errcode='22023'; end if;
  update pierre_rt_contract_activation_tasks set status='applied', applied_at=now(), locked_at=null, locked_by=null, lease_expires_at=null, last_error_safe=null where company_id=v_company and id=p_task_id;
end;
$$ language plpgsql security definer;

drop function if exists pierre_rt_fail_contract_activation(uuid,uuid,text,integer);
create or replace function pierre_rt_fail_contract_activation(p_company uuid, p_task_id uuid, p_worker text, p_error_safe text, p_max_attempts integer) returns void as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_status text; v_locked_by text; v_locked_at timestamptz; v_lease timestamptz; v_attempts integer;
begin
  if v_company is null then raise exception 'tenant not bound' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  select status, locked_by, locked_at, lease_expires_at, attempt_count into v_status, v_locked_by, v_locked_at, v_lease, v_attempts from pierre_rt_contract_activation_tasks where company_id=v_company and id=p_task_id;
  if not found then raise exception 'activation task not found' using errcode='23503'; end if;
  if v_locked_at is null or v_locked_by is distinct from p_worker then raise exception 'worker does not own this task lease' using errcode='42501'; end if;
  if v_lease is null or v_lease <= now() then raise exception 'task lease has expired' using errcode='42501'; end if;
  if v_status <> 'processing' then raise exception 'task is not in processing' using errcode='22023'; end if;
  if v_attempts >= greatest(p_max_attempts,1) then
    update pierre_rt_contract_activation_tasks set status='dead_letter', dead_lettered_at=now(), locked_at=null, locked_by=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'error'),200) where company_id=v_company and id=p_task_id;
  else
    update pierre_rt_contract_activation_tasks set status='scheduled', next_retry_at=now() + make_interval(secs => 300), locked_at=null, locked_by=null, lease_expires_at=null, last_error_safe=left(coalesce(p_error_safe,'error'),200) where company_id=v_company and id=p_task_id;
  end if;
end;
$$ language plpgsql security definer;

do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'grant execute on function pierre_rt_complete_contract_activation(uuid,uuid,text) to pierre_rt_app';
  execute 'grant execute on function pierre_rt_fail_contract_activation(uuid,uuid,text,text,integer) to pierre_rt_app';
end if; end$$;
do $$ begin
  execute 'grant execute on function pierre_rt_complete_contract_activation(uuid,uuid,text) to pierre_rt_signature_worker';
  execute 'grant execute on function pierre_rt_fail_contract_activation(uuid,uuid,text,text,integer) to pierre_rt_signature_worker';
end$$;

-- ── R3.5 — effect history: governed write only + composite tenant-safe FKs + uniqueness ─────
-- the app role can no longer raw-INSERT a (forged) employment history.
do $$ begin if exists (select 1 from pg_roles where rolname='pierre_rt_app') then
  execute 'revoke insert, update, delete on pierre_rt_contract_effect_history from pierre_rt_app';
end if; end$$;
-- composite tenant-safe foreign keys (added validated — fresh chain; a real deployment with
-- incompatible rows would fail loudly here rather than silently repairing).
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_effhist_employee_ct') then
    alter table pierre_rt_contract_effect_history add constraint fk_effhist_employee_ct
      foreign key (company_id, employee_id) references pierre_rt_employees(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_effhist_parent_ct') then
    alter table pierre_rt_contract_effect_history add constraint fk_effhist_parent_ct
      foreign key (company_id, parent_contract_id) references pierre_rt_employee_contracts(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_effhist_amendment_ct') then
    alter table pierre_rt_contract_effect_history add constraint fk_effhist_amendment_ct
      foreign key (company_id, amendment_contract_id) references pierre_rt_employee_contracts(company_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_effhist_task_ct') then
    alter table pierre_rt_contract_effect_history add constraint fk_effhist_task_ct
      foreign key (company_id, activation_task_id) references pierre_rt_contract_activation_tasks(company_id, id);
  end if;
end$$;
-- one history row per amendment + field (no duplicate forged change)
create unique index if not exists uq_pierre_rt_effect_history_amendment_field on pierre_rt_contract_effect_history(company_id, amendment_contract_id, field_key);

-- governed insert (the ONLY write path): tenant-bound, relational invariants, allowlisted field.
create or replace function pierre_rt_record_contract_effect(
  p_company uuid, p_employee_id uuid, p_parent_contract_id uuid, p_amendment_contract_id uuid,
  p_activation_task_id uuid, p_field_key text, p_previous_value text, p_new_value text,
  p_effective_at date, p_applied_by uuid, p_correlation_id uuid
) returns uuid as $$
declare v_company uuid := nullif(current_setting('app.current_company', true), '')::uuid; v_parent uuid; v_emp uuid; v_id uuid;
begin
  if v_company is null then raise exception 'tenant not bound (app.current_company is unset)' using errcode='42501'; end if;
  if p_company is distinct from v_company then raise exception 'tenant mismatch' using errcode='42501'; end if;
  if p_field_key not in ('employment.role_title','employment.weekly_hours','employment.salary','employment.site_id','employment.effective_from','employment.effective_to') then
    raise exception 'effect not allowlisted: %', p_field_key using errcode='22023';
  end if;
  -- the amendment must belong to this tenant; the parent + employee must match the amendment
  select parent_contract_id, employee_id into v_parent, v_emp from pierre_rt_employee_contracts where company_id=v_company and id=p_amendment_contract_id;
  if not found then raise exception 'amendment not found for this tenant' using errcode='23503'; end if;
  if v_parent is distinct from p_parent_contract_id then raise exception 'parent does not match the amendment' using errcode='22023'; end if;
  if v_emp is distinct from p_employee_id then raise exception 'employee does not match the amendment' using errcode='22023'; end if;
  -- the task (if provided) must belong to this amendment and be in activation
  if p_activation_task_id is not null and not exists (
    select 1 from pierre_rt_contract_activation_tasks t where t.company_id=v_company and t.id=p_activation_task_id and t.amendment_contract_id=p_amendment_contract_id and t.status='processing'
  ) then raise exception 'activation task does not match the amendment / is not in activation' using errcode='22023'; end if;
  v_id := gen_random_uuid();
  insert into pierre_rt_contract_effect_history (id, company_id, employee_id, parent_contract_id, amendment_contract_id, activation_task_id, field_key, previous_value, new_value, effective_at, applied_by, correlation_id)
  values (v_id, v_company, p_employee_id, p_parent_contract_id, p_amendment_contract_id, p_activation_task_id, p_field_key, p_previous_value, p_new_value, p_effective_at, p_applied_by, p_correlation_id);
  return v_id;
end;
$$ language plpgsql security definer;
revoke all on function pierre_rt_record_contract_effect(uuid,uuid,uuid,uuid,uuid,text,text,text,date,uuid,uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname='pierre_rt_app') then execute 'revoke execute on function pierre_rt_record_contract_effect(uuid,uuid,uuid,uuid,uuid,text,text,text,date,uuid,uuid) from pierre_rt_app'; end if;
  execute 'grant execute on function pierre_rt_record_contract_effect(uuid,uuid,uuid,uuid,uuid,text,text,text,date,uuid,uuid) to pierre_rt_signature_worker';
end$$;
