-- supabase/migrations/2026-06-16__pierre_v6_hardening_fks_webhook_ingress.sql
-- PHASE 8.3-B — foundation hardening: webhook ingress isolation, tenant-safe
-- composite foreign keys, real-integrity + signed-upload columns. Idempotent.

-- ── §1 Webhook RLS leak fix ──────────────────────────────────────────────────
-- The v5 permissive "company_id is null OR ..." policy is removed. The webhook
-- ingestion table is service-role ONLY: pierre_rt_app gets NO grant and a deny
-- policy, so a tenant can never read/modify/delete a webhook row (resolved or not).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'pierre_rt_webhook_ingress') then
    create role pierre_rt_webhook_ingress nologin;
  end if;
end $$;
revoke all on pierre_rt_signature_webhooks from pierre_rt_app;
grant select, insert, update on pierre_rt_signature_webhooks to pierre_rt_webhook_ingress;
drop policy if exists rt_iso_pierre_rt_signature_webhooks on pierre_rt_signature_webhooks;
drop policy if exists rt_webhook_service_only on pierre_rt_signature_webhooks;
-- Forced RLS + a deny-all policy → the app role (pierre_rt_app) sees nothing; the
-- service/superuser connection bypasses RLS for verified server-side ingestion.
create policy rt_webhook_deny_app on pierre_rt_signature_webhooks using (false) with check (false);

-- ── §2/§7 Real integrity + signed-upload columns ─────────────────────────────
alter table pierre_rt_files add column if not exists declared_sha256 text;
alter table pierre_rt_files add column if not exists declared_size_bytes bigint;
alter table pierre_rt_files add column if not exists upload_token text;
alter table pierre_rt_files add column if not exists upload_expires_at timestamptz;

-- ── §8 Tenant-safe references: unique(company_id, id) on referenced tables ────
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_employees','pierre_rt_sites','pierre_rt_employee_contracts','pierre_rt_missions','pierre_rt_tasks',
    'pierre_rt_files','pierre_rt_documents','pierre_rt_document_versions','pierre_rt_document_template_versions','pierre_rt_signature_requests'
  ]
  loop
    execute format('create unique index if not exists uq_%1$s_company_id on %1$s(company_id, id)', t);
  end loop;
end$$;

-- Composite FKs (MATCH SIMPLE: a NULL referencing column skips the check, so nullable
-- links are fine; a non-null id MUST match within the SAME company → cross-tenant
-- references are impossible even with a known UUID). NOT VALID: enforced on new rows,
-- existing rows not scanned.
do $$
declare
  fks text[][] := array[
    ['pierre_rt_documents','fk_doc_employee_ct','(company_id, employee_id)','pierre_rt_employees'],
    ['pierre_rt_documents','fk_doc_site_ct','(company_id, site_id)','pierre_rt_sites'],
    ['pierre_rt_documents','fk_doc_contract_ct','(company_id, contract_id)','pierre_rt_employee_contracts'],
    ['pierre_rt_documents','fk_doc_mission_ct','(company_id, mission_id)','pierre_rt_missions'],
    ['pierre_rt_documents','fk_doc_task_ct','(company_id, task_id)','pierre_rt_tasks'],
    ['pierre_rt_document_versions','fk_dv_document_ct','(company_id, document_id)','pierre_rt_documents'],
    ['pierre_rt_document_versions','fk_dv_srcfile_ct','(company_id, source_file_id)','pierre_rt_files'],
    ['pierre_rt_document_versions','fk_dv_pdffile_ct','(company_id, rendered_pdf_file_id)','pierre_rt_files'],
    ['pierre_rt_document_versions','fk_dv_docxfile_ct','(company_id, rendered_docx_file_id)','pierre_rt_files'],
    ['pierre_rt_document_versions','fk_dv_tplver_ct','(company_id, template_version_id)','pierre_rt_document_template_versions'],
    ['pierre_rt_document_links','fk_dl_document_ct','(company_id, document_id)','pierre_rt_documents'],
    ['pierre_rt_signature_requests','fk_sr_document_ct','(company_id, document_id)','pierre_rt_documents'],
    ['pierre_rt_signature_requests','fk_sr_docver_ct','(company_id, document_version_id)','pierre_rt_document_versions'],
    ['pierre_rt_signature_recipients','fk_srec_request_ct','(company_id, signature_request_id)','pierre_rt_signature_requests'],
    ['pierre_rt_signature_events','fk_sev_request_ct','(company_id, signature_request_id)','pierre_rt_signature_requests'],
    ['pierre_rt_signature_evidence','fk_sevd_request_ct','(company_id, signature_request_id)','pierre_rt_signature_requests'],
    ['pierre_rt_signature_evidence','fk_sevd_file_ct','(company_id, evidence_file_id)','pierre_rt_files'],
    ['pierre_rt_employee_contract_versions','fk_cv_docver_ct','(company_id, document_version_id)','pierre_rt_document_versions']
  ];
  i int;
begin
  for i in 1 .. array_length(fks, 1) loop
    if not exists (select 1 from pg_constraint where conname = fks[i][2]) then
      execute format('alter table %s add constraint %s foreign key %s references %s(company_id, id) on delete set null not valid',
        fks[i][1], fks[i][2], fks[i][3], fks[i][4]);
    end if;
  end loop;
end$$;
