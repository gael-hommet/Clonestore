-- supabase/migrations/2026-06-21__pierre_v14_contract_workflow_guards.sql
-- PHASE 8.3-B2G — CONTRACT workflow governance at the DB level. Adds: fingerprint/hash
-- columns on contract versions; an append-only contract audit (SECURITY DEFINER logger,
-- GUC-bound, no raw INSERT for the app role); an append-only contract approvals ledger; a
-- workflow_status STATE MACHINE trigger on contracts; and an immutability trigger that
-- freezes a final/signed contract version's content + a signed contract's identity. Mirrors
-- the proven v10 template guards. Idempotent, non-destructive, PGlite-compatible.

-- ── Fingerprint / hash columns on the contract VERSION ──────────────────────────
alter table pierre_rt_employee_contract_versions add column if not exists template_fingerprint text;
alter table pierre_rt_employee_contract_versions add column if not exists approved_fingerprint text;
alter table pierre_rt_employee_contract_versions add column if not exists canonical_hash text;   -- business content (format-independent)
alter table pierre_rt_employee_contract_versions add column if not exists pdf_hash text;          -- the rendered PDF bytes
alter table pierre_rt_employee_contract_versions add column if not exists docx_hash text;         -- the rendered DOCX bytes
alter table pierre_rt_employee_contract_versions add column if not exists workflow_status text not null default 'draft';
alter table pierre_rt_employee_contract_versions add column if not exists superseded_at timestamptz;

-- ── Append-only contract audit ──────────────────────────────────────────────────
create table if not exists pierre_rt_contract_audit (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  contract_id         uuid,
  contract_version_id uuid,
  actor_user_id       uuid,
  event               text not null,
  status_before       text,
  status_after        text,
  fingerprint         text,
  reason              text,
  correlation_id      uuid,
  occurred_at         timestamptz not null default now()
);
create index if not exists idx_rt_contract_audit_company on pierre_rt_contract_audit(company_id, occurred_at desc);
create index if not exists idx_rt_contract_audit_contract on pierre_rt_contract_audit(contract_id);

-- ── Append-only contract approvals ledger ───────────────────────────────────────
create table if not exists pierre_rt_contract_approvals (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  contract_id         uuid not null,
  contract_version_id uuid not null,
  document_version_id uuid,
  approver_user_id    uuid,
  decision            text not null check (decision in ('approved','rejected')),
  reason              text,
  template_fingerprint text,
  content_hash        text,
  correlation_id      uuid,
  created_at          timestamptz not null default now()
);
create index if not exists idx_rt_contract_approvals_version on pierre_rt_contract_approvals(company_id, contract_version_id);

do $$ begin
  execute 'alter table pierre_rt_contract_audit enable row level security';
  execute 'alter table pierre_rt_contract_audit force row level security';
  execute 'alter table pierre_rt_contract_approvals enable row level security';
  execute 'alter table pierre_rt_contract_approvals force row level security';
  execute 'grant select on pierre_rt_contract_audit to pierre_rt_app';          -- writes ONLY via the SECURITY DEFINER fn
  execute 'grant select, insert on pierre_rt_contract_approvals to pierre_rt_app';
  execute 'drop policy if exists rt_iso_pierre_rt_contract_audit on pierre_rt_contract_audit';
  execute 'create policy rt_iso_pierre_rt_contract_audit on pierre_rt_contract_audit using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
  execute 'drop policy if exists rt_iso_pierre_rt_contract_approvals on pierre_rt_contract_approvals';
  execute 'create policy rt_iso_pierre_rt_contract_approvals on pierre_rt_contract_approvals using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
end$$;

-- Append-only: block UPDATE/DELETE on both ledgers (incl. superuser).
create or replace function pierre_rt_contract_ledger_append_only() returns trigger as $$
begin raise exception '% is append-only', TG_TABLE_NAME; end;
$$ language plpgsql;
drop trigger if exists trg_contract_audit_no_upd on pierre_rt_contract_audit;
drop trigger if exists trg_contract_audit_no_del on pierre_rt_contract_audit;
create trigger trg_contract_audit_no_upd before update on pierre_rt_contract_audit for each row execute function pierre_rt_contract_ledger_append_only();
create trigger trg_contract_audit_no_del before delete on pierre_rt_contract_audit for each row execute function pierre_rt_contract_ledger_append_only();
drop trigger if exists trg_contract_appr_no_upd on pierre_rt_contract_approvals;
drop trigger if exists trg_contract_appr_no_del on pierre_rt_contract_approvals;
create trigger trg_contract_appr_no_upd before update on pierre_rt_contract_approvals for each row execute function pierre_rt_contract_ledger_append_only();
create trigger trg_contract_appr_no_del before delete on pierre_rt_contract_approvals for each row execute function pierre_rt_contract_ledger_append_only();

-- SECURITY DEFINER audit logger: tenant-bound, the only write path for the app role.
revoke insert on pierre_rt_contract_audit from pierre_rt_app;
create or replace function pierre_rt_log_contract_event(
  p_company uuid, p_contract uuid, p_version uuid, p_actor uuid, p_event text,
  p_before text, p_after text, p_fingerprint text, p_reason text, p_correlation uuid
) returns void as $$
begin
  if current_setting('app.current_company', true) is not null and current_setting('app.current_company', true) <> '' and current_setting('app.current_company', true) <> p_company::text then
    raise exception 'contract audit company mismatch';
  end if;
  insert into pierre_rt_contract_audit (id, company_id, contract_id, contract_version_id, actor_user_id, event, status_before, status_after, fingerprint, reason, correlation_id)
  values (gen_random_uuid(), p_company, p_contract, p_version, p_actor, p_event, p_before, p_after, p_fingerprint, p_reason, p_correlation);
end;
$$ language plpgsql security definer;
grant execute on function pierre_rt_log_contract_event(uuid,uuid,uuid,uuid,text,text,text,text,text,uuid) to pierre_rt_app;

-- ── Contract workflow_status STATE MACHINE (trigger) ────────────────────────────
create or replace function pierre_rt_contract_workflow_guard() returns trigger as $$
begin
  if NEW.workflow_status is distinct from OLD.workflow_status then
    if not (
      (OLD.workflow_status='draft' and NEW.workflow_status in ('under_review','cancelled')) or
      (OLD.workflow_status='under_review' and NEW.workflow_status in ('changes_requested','approved','cancelled')) or
      (OLD.workflow_status='changes_requested' and NEW.workflow_status in ('draft','cancelled')) or
      (OLD.workflow_status='approved' and NEW.workflow_status in ('final','changes_requested','cancelled')) or
      (OLD.workflow_status='final' and NEW.workflow_status in ('ready_for_signature','superseded','cancelled')) or
      (OLD.workflow_status='ready_for_signature' and NEW.workflow_status in ('submitted','cancelled','final')) or
      (OLD.workflow_status='submitted' and NEW.workflow_status in ('in_progress','declined','expired','cancelled','failed')) or
      (OLD.workflow_status='in_progress' and NEW.workflow_status in ('signed','declined','expired','failed')) or
      (OLD.workflow_status='signed' and NEW.workflow_status in ('superseded','archived')) or
      (OLD.workflow_status='superseded' and NEW.workflow_status='archived') or
      (OLD.workflow_status in ('declined','expired','cancelled','failed') and NEW.workflow_status in ('draft','archived'))
    ) then
      raise exception 'illegal contract workflow transition % -> %', OLD.workflow_status, NEW.workflow_status;
    end if;
  end if;
  -- a SIGNED contract's identity is frozen (only workflow_status may move to superseded/archived)
  if OLD.workflow_status='signed' then
    if NEW.employee_id is distinct from OLD.employee_id or NEW.contract_type is distinct from OLD.contract_type
       or NEW.document_id is distinct from OLD.document_id or NEW.parent_contract_id is distinct from OLD.parent_contract_id then
      raise exception 'a signed contract is immutable';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_contract_workflow_guard on pierre_rt_employee_contracts;
create trigger trg_contract_workflow_guard before update on pierre_rt_employee_contracts for each row execute function pierre_rt_contract_workflow_guard();

-- ── Contract VERSION immutability (final/signed content frozen) ──────────────────
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
  -- version workflow: draft -> final -> signed -> superseded (+ archived); back to draft only from draft
  if NEW.workflow_status is distinct from OLD.workflow_status then
    if not (
      (OLD.workflow_status='draft' and NEW.workflow_status in ('final','superseded')) or
      (OLD.workflow_status='final' and NEW.workflow_status in ('signed','superseded')) or
      (OLD.workflow_status='signed' and NEW.workflow_status in ('superseded','archived')) or
      (OLD.workflow_status='superseded' and NEW.workflow_status='archived')
    ) then
      raise exception 'illegal contract version transition % -> %', OLD.workflow_status, NEW.workflow_status;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_contract_version_guard on pierre_rt_employee_contract_versions;
create trigger trg_contract_version_guard before update on pierre_rt_employee_contract_versions for each row execute function pierre_rt_contract_version_guard();
