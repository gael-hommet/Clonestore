-- supabase/migrations/2026-06-22__pierre_v15_contract_truth_closure.sql
-- PHASE 8.3-B2G-R1 — contract truth & bypass closure at the DB level. Adds the columns and
-- triggers that must NOT depend on TypeScript: parent integrity + immutability (R1.1/R1.11),
-- amendment reason/idempotency (R1.8), employer-signatory config (R1.5), final-contract-version
-- requires a finalized document version + signature-request tenant coherence (R1.11). No trigger
-- silently repairs data — every incoherence is REFUSED. Idempotent, non-destructive, PGlite-safe.

-- ── R1.8 — amendment reason (human) + idempotency key (technical), tenant-scoped unique ──
alter table pierre_rt_employee_contracts add column if not exists amendment_reason text;
alter table pierre_rt_employee_contracts add column if not exists amendment_idempotency_key text;
create unique index if not exists uq_pierre_rt_contract_amendment_idem
  on pierre_rt_employee_contracts(company_id, parent_contract_id, amendment_idempotency_key)
  where parent_contract_id is not null and amendment_idempotency_key is not null;

-- ── R1.5 — employer signatory configuration (employer signer email/name) ──────────
alter table pierre_rt_companies add column if not exists signatory_email text;
alter table pierre_rt_companies add column if not exists signatory_name text;

-- ── R1.1/R1.11 — parent integrity + immutability ──────────────────────────────────
create or replace function pierre_rt_contract_parent_guard() returns trigger as $$
declare p record;
begin
  if TG_OP = 'UPDATE' and NEW.parent_contract_id is distinct from OLD.parent_contract_id then
    raise exception 'parent_contract_id is immutable after creation';
  end if;
  if NEW.parent_contract_id is not null then
    if NEW.parent_contract_id = NEW.id then raise exception 'a contract cannot be its own parent'; end if;
    select id, company_id, employee_id, parent_contract_id, workflow_status into p
      from pierre_rt_employee_contracts where id = NEW.parent_contract_id;
    if not found then raise exception 'parent contract not found'; end if;
    if p.company_id is distinct from NEW.company_id then raise exception 'parent contract belongs to another tenant'; end if;
    if p.employee_id is distinct from NEW.employee_id then raise exception 'parent contract belongs to another employee'; end if;
    if p.parent_contract_id is not null then raise exception 'amendment chains are not allowed'; end if;
    if p.workflow_status = 'cancelled' then raise exception 'cannot amend a cancelled contract'; end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_contract_parent_guard on pierre_rt_employee_contracts;
create trigger trg_contract_parent_guard before insert or update on pierre_rt_employee_contracts for each row execute function pierre_rt_contract_parent_guard();

-- ── R1.11 — a final contract version requires a finalized document version ──────────
-- (extends the v14 version guard; keeps its immutability + version transition checks.)
create or replace function pierre_rt_contract_version_guard() returns trigger as $$
begin
  if OLD.workflow_status in ('final','signed') then
    if NEW.template_version_id is distinct from OLD.template_version_id
       or NEW.document_version_id is distinct from OLD.document_version_id
       or NEW.content_hash is distinct from OLD.content_hash
       or NEW.canonical_hash is distinct from OLD.canonical_hash
       or NEW.template_fingerprint is distinct from OLD.template_fingerprint
       or NEW.effective_from is distinct from OLD.effective_from
       or NEW.effective_to is distinct from OLD.effective_to
       or NEW.contract_id is distinct from OLD.contract_id
       or NEW.version is distinct from OLD.version then
      raise exception 'a finalized/signed contract version is immutable (content frozen)';
    end if;
  end if;
  if NEW.workflow_status is distinct from OLD.workflow_status then
    if not (
      (OLD.workflow_status='draft' and NEW.workflow_status in ('final','superseded')) or
      (OLD.workflow_status='final' and NEW.workflow_status in ('signed','superseded')) or
      (OLD.workflow_status='signed' and NEW.workflow_status in ('superseded','archived')) or
      (OLD.workflow_status='superseded' and NEW.workflow_status='archived')
    ) then
      raise exception 'illegal contract version transition % -> %', OLD.workflow_status, NEW.workflow_status;
    end if;
    -- becoming final requires a really-finalized document version
    if NEW.workflow_status = 'final' then
      if NEW.document_version_id is null then raise exception 'a final contract version requires a document version'; end if;
      if not exists (select 1 from pierre_rt_document_versions dv where dv.id = NEW.document_version_id and dv.company_id = NEW.company_id and dv.status in ('final','signed')) then
        raise exception 'a final contract version requires a finalized document version';
      end if;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
-- (the v14 trigger already binds this function; CREATE OR REPLACE updates the body in place.)

-- ── R1.11 — signature request tenant/document/version coherence ─────────────────────
create or replace function pierre_rt_signature_request_guard() returns trigger as $$
begin
  if not exists (select 1 from pierre_rt_documents d where d.id = NEW.document_id and d.company_id = NEW.company_id) then
    raise exception 'signature request document is cross-tenant or missing';
  end if;
  if not exists (select 1 from pierre_rt_document_versions dv where dv.id = NEW.document_version_id and dv.company_id = NEW.company_id and dv.document_id = NEW.document_id) then
    raise exception 'signature request document version does not match its document/tenant';
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_signature_request_guard on pierre_rt_signature_requests;
create trigger trg_signature_request_guard before insert or update on pierre_rt_signature_requests for each row execute function pierre_rt_signature_request_guard();

-- ── R1.11 — a signature recipient must belong to its request's tenant (defence in depth) ──
drop trigger if exists trg_xt_signature_recipients_request on pierre_rt_signature_recipients;
create trigger trg_xt_signature_recipients_request before insert or update on pierre_rt_signature_recipients
  for each row execute function pierre_rt_assert_fk_same_company('pierre_rt_signature_requests', 'signature_request_id');
