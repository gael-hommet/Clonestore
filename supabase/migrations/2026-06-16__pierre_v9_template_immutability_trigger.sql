-- supabase/migrations/2026-06-16__pierre_v9_template_immutability_trigger.sql
-- PHASE 8.3-B2D §2 — DB-level immutability of PUBLISHED template versions. Even the
-- application role pierre_rt_app cannot mutate a published version's content; the only
-- permitted change is the status transition published → deprecated. Idempotent.

-- The template state machine uses 'changes_requested'; extend the version status check.
alter table pierre_rt_document_template_versions drop constraint if exists pierre_rt_document_template_versions_status_check;
alter table pierre_rt_document_template_versions add constraint pierre_rt_document_template_versions_status_check
  check (status in ('draft','review_required','changes_requested','approved','published','deprecated','archived'));

create or replace function pierre_rt_template_version_immutable() returns trigger as $$
begin
  if OLD.status = 'published' then
    if NEW.body is distinct from OLD.body
       or NEW.field_schema is distinct from OLD.field_schema
       or NEW.renderer is distinct from OLD.renderer
       or NEW.content_hash is distinct from OLD.content_hash
       or NEW.schema_hash is distinct from OLD.schema_hash
       or NEW.locale is distinct from OLD.locale
       or NEW.jurisdiction is distinct from OLD.jurisdiction
       or NEW.template_id is distinct from OLD.template_id
       or NEW.version_number is distinct from OLD.version_number then
      raise exception 'published template version is immutable (content frozen)';
    end if;
    if NEW.status is distinct from OLD.status and NEW.status <> 'deprecated' then
      raise exception 'a published version may only transition to deprecated (got %)', NEW.status;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_template_version_immutable on pierre_rt_document_template_versions;
create trigger trg_template_version_immutable
  before update on pierre_rt_document_template_versions
  for each row execute function pierre_rt_template_version_immutable();

-- Template-scoped audit trail (actor / before→after / fingerprint / reason).
create table if not exists pierre_rt_template_audit (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references pierre_rt_companies(id) on delete cascade,
  template_id     uuid,
  template_version_id uuid,
  actor_user_id   uuid,
  event           text not null,
  status_before   text,
  status_after    text,
  fingerprint     text,
  reason          text,
  correlation_id  uuid,
  occurred_at     timestamptz not null default now()
);
create index if not exists idx_rt_template_audit_company on pierre_rt_template_audit(company_id, occurred_at desc);
create index if not exists idx_rt_template_audit_tpl on pierre_rt_template_audit(template_id);

do $$ begin
  execute 'alter table pierre_rt_template_audit enable row level security';
  execute 'alter table pierre_rt_template_audit force row level security';
  execute 'grant select, insert on pierre_rt_template_audit to pierre_rt_app';
  execute 'drop policy if exists rt_iso_pierre_rt_template_audit on pierre_rt_template_audit';
  execute 'create policy rt_iso_pierre_rt_template_audit on pierre_rt_template_audit using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
end$$;
