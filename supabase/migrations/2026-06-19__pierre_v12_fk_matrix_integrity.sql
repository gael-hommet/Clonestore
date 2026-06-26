-- supabase/migrations/2026-06-19__pierre_v12_fk_matrix_integrity.sql
-- PHASE 8.3-B2F §1 — FK MATRIX INTEGRITY. v6/v7 hardened the document/version/signature
-- spine with composite (company_id, fk) FKs. This migration closes the remaining
-- cross-tenant relational gaps for the TEMPLATE / CONTRACT / CUSTOM-FIELD / FILE-INTEGRITY
-- spine, and installs a generic fail-closed cross-tenant guard trigger for the soft
-- (ON DELETE SET NULL) references and the employee-360 satellites — where a composite FK
-- would force RESTRICT and break the intended soft-delete semantics.
--
-- Two mechanisms, by design:
--   (a) Composite FK (company_id, fk) -> parent(company_id, id): hard relational binding
--       for owned/CASCADE relations. A cross-tenant reference simply cannot be stored.
--   (b) BEFORE INSERT/UPDATE trigger `pierre_rt_assert_fk_same_company(target, col)`:
--       fail-closed same-tenant check for soft refs (kept ON DELETE SET NULL) and
--       satellite tables. Preserves delete semantics; blocks cross-tenant writes.
-- Idempotent. PostgreSQL-real + PGlite-compatible.

-- ── Parent composite unique keys (needed to reference (company_id, id)) ──────────
create unique index if not exists uq_pierre_rt_employees_company_id on pierre_rt_employees(company_id, id);
create unique index if not exists uq_pierre_rt_employee_contracts_company_id on pierre_rt_employee_contracts(company_id, id);
create unique index if not exists uq_pierre_rt_document_template_versions_company_id on pierre_rt_document_template_versions(company_id, id);
create unique index if not exists uq_pierre_rt_document_templates_company_id on pierre_rt_document_templates(company_id, id);
create unique index if not exists uq_pierre_rt_documents_company_id on pierre_rt_documents(company_id, id);
create unique index if not exists uq_pierre_rt_files_company_id on pierre_rt_files(company_id, id);

-- ── (a) Critical spine: convert simple FKs to composite (company_id, fk) ─────────
-- Each preserves its existing ON DELETE behaviour but binds the relation to ONE tenant.
do $$
declare r record;
begin
  for r in (
    select * from (values
      -- child table,                               fk column,            parent table,                          old fk constraint name,                                   on delete, composite name
      ('pierre_rt_document_template_versions',       'template_id',        'pierre_rt_document_templates',         'pierre_rt_document_template_versions_template_id_fkey',   'cascade', 'fk_tplver_template_ct'),
      ('pierre_rt_template_approvals',               'template_version_id','pierre_rt_document_template_versions', 'pierre_rt_template_approvals_template_version_id_fkey',   'cascade', 'fk_tplappr_version_ct'),
      ('pierre_rt_template_fields',                  'template_version_id','pierre_rt_document_template_versions', 'pierre_rt_template_fields_template_version_id_fkey',      'cascade', 'fk_tplfield_version_ct'),
      ('pierre_rt_employee_custom_fields',           'employee_id',        'pierre_rt_employees',                  'pierre_rt_employee_custom_fields_employee_id_fkey',       'cascade', 'fk_ecf_employee_ct'),
      ('pierre_rt_employee_contracts',               'employee_id',        'pierre_rt_employees',                  'pierre_rt_employee_contracts_employee_id_fkey',           'cascade', 'fk_contract_employee_ct'),
      ('pierre_rt_employee_contract_versions',       'contract_id',        'pierre_rt_employee_contracts',         'pierre_rt_employee_contract_versions_contract_id_fkey',   'cascade', 'fk_cv_contract_ct'),
      ('pierre_rt_document_access_log',              'document_id',        'pierre_rt_documents',                  'pierre_rt_document_access_log_document_id_fkey',          'cascade', 'fk_dal_document_ct'),
      ('pierre_rt_file_scan_results',                'file_id',            'pierre_rt_files',                      'pierre_rt_file_scan_results_file_id_fkey',                'cascade', 'fk_fsr_file_ct'),
      ('pierre_rt_file_integrity_checks',            'file_id',            'pierre_rt_files',                      'pierre_rt_file_integrity_checks_file_id_fkey',            'cascade', 'fk_fic_file_ct')
    ) as t(child, col, parent, old_fk, ondel, newname)
  ) loop
    -- drop the tenant-blind simple FK (idempotent)
    execute format('alter table %I drop constraint if exists %I', r.child, r.old_fk);
    -- add the composite, tenant-binding FK if not present
    if not exists (select 1 from pg_constraint where conname = r.newname) then
      execute format(
        'alter table %I add constraint %I foreign key (company_id, %I) references %I(company_id, id) on delete %s',
        r.child, r.newname, r.col, r.parent, r.ondel);
    end if;
  end loop;
end$$;

-- ── (b) Generic fail-closed cross-tenant guard ──────────────────────────────────
create or replace function pierre_rt_assert_fk_same_company() returns trigger as $$
declare
  j jsonb := to_jsonb(NEW);
  v_company text := j->>'company_id';
  v_target text := TG_ARGV[0];
  v_col text := TG_ARGV[1];
  v_ref text := j->>(TG_ARGV[1]);
  v_exists boolean;
begin
  if v_ref is null or v_company is null then return NEW; end if;
  execute format('select exists(select 1 from %I where id = $1 and company_id = $2)', v_target)
    into v_exists using v_ref::uuid, v_company::uuid;
  if not v_exists then
    raise exception 'cross-tenant reference blocked on %.% -> % (different company)', TG_TABLE_NAME, v_col, v_target
      using errcode = '23514';
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Attach the guard to the soft (SET NULL) references + employee-360 satellites.
-- (The owned/CASCADE satellites keep their simple FK for orphan protection; the guard
--  adds the tenant binding the simple FK lacked.)
do $$
declare r record; trg text;
begin
  for r in (
    select * from (values
      -- soft references (kept ON DELETE SET NULL — composite would force RESTRICT)
      ('pierre_rt_document_template_versions', 'source_file_id',     'pierre_rt_files'),
      ('pierre_rt_employee_contracts',         'document_id',        'pierre_rt_documents'),
      ('pierre_rt_employee_contracts',         'parent_contract_id', 'pierre_rt_employee_contracts'),
      ('pierre_rt_documents',                  'owner_membership_id','pierre_rt_members'),
      -- employee-360 satellites (employee_id -> employees)
      ('pierre_rt_employee_addresses',            'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_contact_methods',      'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_emergency_contacts',   'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_employments',          'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_notes',                'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_events',               'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_status_history',       'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_document_requirements','employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_sensitive_data',       'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_sensitive_access_log', 'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_site_assignments',     'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_manager_assignments',  'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_absences',             'employee_id', 'pierre_rt_employees'),
      ('pierre_rt_employee_tags',                 'employee_id', 'pierre_rt_employees')
    ) as t(child, col, parent)
  ) loop
    trg := 'trg_xt_' || replace(r.child, 'pierre_rt_', '') || '_' || r.col;
    execute format('drop trigger if exists %I on %I', trg, r.child);
    execute format('create trigger %I before insert or update on %I for each row execute function pierre_rt_assert_fk_same_company(%L, %L)',
      trg, r.child, r.parent, r.col);
  end loop;
end$$;
