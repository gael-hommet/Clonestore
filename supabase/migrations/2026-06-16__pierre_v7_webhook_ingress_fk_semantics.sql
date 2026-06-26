-- supabase/migrations/2026-06-16__pierre_v7_webhook_ingress_fk_semantics.sql
-- PHASE 8.3-B2 — §1 definitive webhook ingress isolation + §2/§3 corrected
-- composite-FK delete semantics (no ambiguous SET NULL on a NOT-NULL company_id).
-- Idempotent.

-- ── §1 Webhook ingress: usable ingress role, app role fully excluded ──────────
-- The deny-all policy is replaced by a single ingress-only policy. pierre_rt_app has
-- NO grant and NO applicable policy → it can neither SELECT/INSERT/UPDATE/DELETE.
-- The ingress role may SELECT/INSERT/UPDATE (NOT DELETE). Tenant resolution is done
-- server-side from (provider, provider_request_id) only — never from a payload company_id.
grant select, insert, update on pierre_rt_signature_webhooks to pierre_rt_webhook_ingress;
revoke delete on pierre_rt_signature_webhooks from pierre_rt_webhook_ingress;
drop policy if exists rt_webhook_deny_app on pierre_rt_signature_webhooks;
drop policy if exists rt_webhook_ingress_only on pierre_rt_signature_webhooks;
create policy rt_webhook_ingress_only on pierre_rt_signature_webhooks
  for all to pierre_rt_webhook_ingress using (true) with check (true);

-- Drop the v5 SINGLE-COLUMN FKs (ON DELETE SET NULL / CASCADE) that would otherwise
-- undermine the composite tenant-safe delete semantics (a SET NULL nulls the column
-- before the composite RESTRICT can fire). The composite FKs below are authoritative.
do $$
declare c text;
begin
  foreach c in array array[
    'pierre_rt_documents_employee_id_fkey','pierre_rt_documents_site_id_fkey','pierre_rt_documents_contract_id_fkey',
    'pierre_rt_documents_mission_id_fkey','pierre_rt_documents_task_id_fkey',
    'pierre_rt_document_versions_source_file_id_fkey','pierre_rt_document_versions_rendered_pdf_file_id_fkey','pierre_rt_document_versions_rendered_docx_file_id_fkey',
    'pierre_rt_document_versions_document_id_fkey',
    'pierre_rt_signature_requests_document_id_fkey','pierre_rt_signature_requests_document_version_id_fkey',
    'pierre_rt_signature_evidence_evidence_file_id_fkey',
    'pierre_rt_employee_contract_versions_document_version_id_fkey'
  ]
  loop
    if exists (select 1 from pg_constraint where conname = c) then
      execute format('alter table %s drop constraint if exists %I',
        (select conrelid::regclass from pg_constraint where conname = c limit 1), c);
    end if;
  end loop;
end$$;

-- ── §2 Correct composite-FK delete semantics ─────────────────────────────────
-- Drop the v6 "on delete set null" composite FKs (which would try to NULL the
-- NOT-NULL company_id) and recreate with explicit, intentional semantics. Created
-- VALIDATED (the P8.3 tables are new; no historical cross-tenant rows exist).
do $$
declare
  -- table, conname, columns, target, on-delete
  fks text[][] := array[
    ['pierre_rt_documents','fk_doc_employee_ct','(company_id, employee_id)','pierre_rt_employees','no action'],
    ['pierre_rt_documents','fk_doc_site_ct','(company_id, site_id)','pierre_rt_sites','no action'],
    ['pierre_rt_documents','fk_doc_contract_ct','(company_id, contract_id)','pierre_rt_employee_contracts','no action'],
    ['pierre_rt_documents','fk_doc_mission_ct','(company_id, mission_id)','pierre_rt_missions','no action'],
    ['pierre_rt_documents','fk_doc_task_ct','(company_id, task_id)','pierre_rt_tasks','no action'],
    ['pierre_rt_document_versions','fk_dv_document_ct','(company_id, document_id)','pierre_rt_documents','cascade'],
    ['pierre_rt_document_versions','fk_dv_srcfile_ct','(company_id, source_file_id)','pierre_rt_files','restrict'],
    ['pierre_rt_document_versions','fk_dv_pdffile_ct','(company_id, rendered_pdf_file_id)','pierre_rt_files','restrict'],
    ['pierre_rt_document_versions','fk_dv_docxfile_ct','(company_id, rendered_docx_file_id)','pierre_rt_files','restrict'],
    ['pierre_rt_document_versions','fk_dv_tplver_ct','(company_id, template_version_id)','pierre_rt_document_template_versions','restrict'],
    ['pierre_rt_document_links','fk_dl_document_ct','(company_id, document_id)','pierre_rt_documents','cascade'],
    ['pierre_rt_signature_requests','fk_sr_document_ct','(company_id, document_id)','pierre_rt_documents','restrict'],
    ['pierre_rt_signature_requests','fk_sr_docver_ct','(company_id, document_version_id)','pierre_rt_document_versions','restrict'],
    ['pierre_rt_signature_recipients','fk_srec_request_ct','(company_id, signature_request_id)','pierre_rt_signature_requests','cascade'],
    ['pierre_rt_signature_events','fk_sev_request_ct','(company_id, signature_request_id)','pierre_rt_signature_requests','cascade'],
    ['pierre_rt_signature_evidence','fk_sevd_request_ct','(company_id, signature_request_id)','pierre_rt_signature_requests','cascade'],
    ['pierre_rt_signature_evidence','fk_sevd_file_ct','(company_id, evidence_file_id)','pierre_rt_files','restrict'],
    ['pierre_rt_employee_contract_versions','fk_cv_docver_ct','(company_id, document_version_id)','pierre_rt_document_versions','restrict']
  ];
  i int;
begin
  for i in 1 .. array_length(fks, 1) loop
    if exists (select 1 from pg_constraint where conname = fks[i][2]) then
      execute format('alter table %s drop constraint %s', fks[i][1], fks[i][2]);
    end if;
    execute format('alter table %s add constraint %s foreign key %s references %s(company_id, id) on delete %s',
      fks[i][1], fks[i][2], fks[i][3], fks[i][4], fks[i][5]);
  end loop;
end$$;
