-- supabase/migrations/2026-06-16__pierre_v10_template_db_guards_permissions.sql
-- PHASE 8.3-B2E — DB-level template guards (ever-published immutability + state
-- machine + delete protection), append-only infalsifiable audit, granular sensitive
-- permissions. Idempotent.

-- ── §4 — audit keeps OLD/NEW fingerprint as separate columns (not "old→new") ──
alter table pierre_rt_template_audit add column if not exists old_fingerprint text;
alter table pierre_rt_template_audit add column if not exists new_fingerprint text;

-- ── §1/§3 — combined guard: state machine (all versions) + ever-published freeze ─
create or replace function pierre_rt_template_version_guard() returns trigger as $$
begin
  -- §3 state machine (enforced for every version, every role)
  if NEW.status is distinct from OLD.status then
    if not (
      (OLD.status='draft' and NEW.status='review_required') or
      (OLD.status='review_required' and NEW.status in ('changes_requested','approved')) or
      (OLD.status='changes_requested' and NEW.status='draft') or
      (OLD.status='approved' and NEW.status in ('published','changes_requested')) or
      (OLD.status='published' and NEW.status='deprecated') or
      (OLD.status='deprecated' and NEW.status='archived')
    ) then
      raise exception 'illegal template status transition % -> %', OLD.status, NEW.status;
    end if;
  end if;
  -- §1 EVER-PUBLISHED: once published_at is set, the content is frozen forever; the
  -- only permitted changes are the status transitions allowed above.
  if OLD.published_at is not null then
    if NEW.body is distinct from OLD.body or NEW.field_schema is distinct from OLD.field_schema
       or NEW.renderer is distinct from OLD.renderer or NEW.content_hash is distinct from OLD.content_hash
       or NEW.schema_hash is distinct from OLD.schema_hash or NEW.locale is distinct from OLD.locale
       or NEW.jurisdiction is distinct from OLD.jurisdiction or NEW.template_id is distinct from OLD.template_id
       or NEW.version_number is distinct from OLD.version_number or NEW.company_id is distinct from OLD.company_id
       or NEW.approved_fingerprint is distinct from OLD.approved_fingerprint or NEW.approved_by is distinct from OLD.approved_by
       or NEW.approved_at is distinct from OLD.approved_at or NEW.published_at is distinct from OLD.published_at
       or NEW.created_by is distinct from OLD.created_by or NEW.created_at is distinct from OLD.created_at then
      raise exception 'published template version is immutable (content frozen)';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql;
drop trigger if exists trg_template_version_immutable on pierre_rt_document_template_versions;
drop trigger if exists trg_template_version_guard on pierre_rt_document_template_versions;
create trigger trg_template_version_guard before update on pierre_rt_document_template_versions for each row execute function pierre_rt_template_version_guard();

-- ── §2 — delete protection: never hard-delete a published / referenced version ──
create or replace function pierre_rt_template_version_no_delete() returns trigger as $$
begin
  if OLD.published_at is not null then raise exception 'a published template version cannot be deleted (archive instead)'; end if;
  if exists (select 1 from pierre_rt_document_versions v where v.company_id=OLD.company_id and v.template_version_id=OLD.id) then raise exception 'template version is referenced by a document'; end if;
  if exists (select 1 from pierre_rt_employee_contract_versions cv where cv.company_id=OLD.company_id and cv.template_version_id=OLD.id) then raise exception 'template version is referenced by a contract'; end if;
  return OLD;
end;
$$ language plpgsql;
drop trigger if exists trg_template_version_no_delete on pierre_rt_document_template_versions;
create trigger trg_template_version_no_delete before delete on pierre_rt_document_template_versions for each row execute function pierre_rt_template_version_no_delete();

-- ── §5 — audit: append-only + insert ONLY via a SECURITY DEFINER function ─────
-- Append-only: block UPDATE/DELETE for everyone (incl. superuser).
create or replace function pierre_rt_template_audit_append_only() returns trigger as $$
begin raise exception 'pierre_rt_template_audit is append-only'; end;
$$ language plpgsql;
drop trigger if exists trg_template_audit_no_update on pierre_rt_template_audit;
drop trigger if exists trg_template_audit_no_delete on pierre_rt_template_audit;
create trigger trg_template_audit_no_update before update on pierre_rt_template_audit for each row execute function pierre_rt_template_audit_append_only();
create trigger trg_template_audit_no_delete before delete on pierre_rt_template_audit for each row execute function pierre_rt_template_audit_append_only();

-- §5 — tenant-safe references on the audit table. NO ACTION (not CASCADE): the audit
-- is permanent + append-only, so it must BLOCK deletion of any referenced version
-- (history is never destroyed — versions are archived, never hard-deleted).
create unique index if not exists uq_pierre_rt_document_templates_company_id on pierre_rt_document_templates(company_id, id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname='fk_taudit_template_ct') then
    alter table pierre_rt_template_audit add constraint fk_taudit_template_ct foreign key (company_id, template_id) references pierre_rt_document_templates(company_id, id) on delete no action;
  end if;
  if not exists (select 1 from pg_constraint where conname='fk_taudit_version_ct') then
    alter table pierre_rt_template_audit add constraint fk_taudit_version_ct foreign key (company_id, template_version_id) references pierre_rt_document_template_versions(company_id, id) on delete no action;
  end if;
end$$;

-- §5 — the app role may not INSERT directly; it must go through the SECURITY DEFINER
-- function (which validates the tenant binding). Reads remain allowed.
revoke insert on pierre_rt_template_audit from pierre_rt_app;
create or replace function pierre_rt_log_template_event(
  p_company uuid, p_template uuid, p_version uuid, p_actor uuid, p_event text,
  p_before text, p_after text, p_fingerprint text, p_reason text, p_correlation uuid,
  p_old_fp text, p_new_fp text
) returns void as $$
begin
  -- the binding company MUST match the active tenant GUC (no cross-tenant audit injection)
  if current_setting('app.current_company', true) is not null and current_setting('app.current_company', true) <> '' and current_setting('app.current_company', true) <> p_company::text then
    raise exception 'template audit company mismatch';
  end if;
  insert into pierre_rt_template_audit (id, company_id, template_id, template_version_id, actor_user_id, event, status_before, status_after, fingerprint, reason, correlation_id, old_fingerprint, new_fingerprint)
  values (gen_random_uuid(), p_company, p_template, p_version, p_actor, p_event, p_before, p_after, p_fingerprint, p_reason, p_correlation, p_old_fp, p_new_fp);
end;
$$ language plpgsql security definer;
grant execute on function pierre_rt_log_template_event(uuid,uuid,uuid,uuid,text,text,text,text,text,uuid,text,text) to pierre_rt_app;

-- ── §16 — granular sensitive permissions + role grants ────────────────────────
insert into pierre_rt_permissions (key, description) values
  ('document.sensitive.generate','Generate sensitive documents'),
  ('document.sensitive.approve','Approve sensitive documents'),
  ('document.sensitive.finalize','Finalize sensitive documents'),
  ('document.employee.expose','Expose documents to the employee'),
  ('document.manager.expose','Expose documents to the manager')
on conflict (key) do nothing;
do $$
begin
  insert into pierre_rt_role_permissions (role_key, permission_key)
    select r, p from (values ('OWNER'),('ADMIN')) v(r),
      unnest(array['document.sensitive.generate','document.sensitive.approve','document.sensitive.finalize','document.employee.expose','document.manager.expose']) p
    on conflict do nothing;
  insert into pierre_rt_role_permissions values
    ('HR_DIRECTOR','document.sensitive.generate'),('HR_DIRECTOR','document.sensitive.approve'),('HR_DIRECTOR','document.sensitive.finalize'),('HR_DIRECTOR','document.employee.expose'),('HR_DIRECTOR','document.manager.expose'),
    ('HR_MANAGER','document.sensitive.generate'),('HR_MANAGER','document.employee.expose'),
    ('HR_OPERATOR','document.sensitive.generate')
    on conflict do nothing;
end$$;
