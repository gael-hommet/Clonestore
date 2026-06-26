-- supabase/migrations/2026-06-16__pierre_v5_files_documents_contracts_signatures.sql
-- PHASE 8.3 — Files, Documents, Versions, Templates, Contracts, E-signature.
-- Idempotent. No data loss. FILE ≠ DOCUMENT ≠ VERSION ≠ TEMPLATE ≠ SIGNATURE.
-- RLS enabled + forced on every tenant table; granted to non-superuser pierre_rt_app.
-- No file bytes stored in Postgres (only metadata + small structured artifacts).

-- ── 3.1 Files (physical objects in private storage) ──────────────────────────
create table if not exists pierre_rt_files (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references pierre_rt_companies(id) on delete cascade,
  storage_provider   text not null default 'local',
  bucket             text not null,
  object_key         text not null,
  original_filename  text,
  safe_filename      text,
  extension          text,
  declared_mime_type text,
  detected_mime_type text,
  size_bytes         bigint not null default 0,
  sha256             text,
  encryption_status  text not null default 'provider_managed',
  upload_status      text not null default 'initialized' check (upload_status in ('initialized','uploading','uploaded','verifying','quarantined','clean','rejected','deleted')),
  scan_status        text not null default 'pending' check (scan_status in ('pending','clean','infected','suspicious','unsupported','failed')),
  quarantine_reason  text,
  uploaded_by_user_id uuid,
  created_at         timestamptz not null default now(),
  uploaded_at        timestamptz,
  scanned_at         timestamptz,
  deleted_at         timestamptz,
  version            integer not null default 1
);
create unique index if not exists idx_rt_files_object_key on pierre_rt_files(object_key);
create index if not exists idx_rt_files_company on pierre_rt_files(company_id, created_at desc);
create index if not exists idx_rt_files_sha on pierre_rt_files(company_id, sha256);
create index if not exists idx_rt_files_status on pierre_rt_files(company_id, upload_status, scan_status);

create table if not exists pierre_rt_file_scan_results (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references pierre_rt_companies(id) on delete cascade,
  file_id      uuid not null references pierre_rt_files(id) on delete cascade,
  scanner      text not null,
  scan_status  text not null,
  signature    text,
  detail       jsonb not null default '{}'::jsonb,
  scanned_at   timestamptz not null default now()
);
create index if not exists idx_rt_file_scan_file on pierre_rt_file_scan_results(file_id, scanned_at desc);

create table if not exists pierre_rt_file_integrity_checks (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  file_id       uuid not null references pierre_rt_files(id) on delete cascade,
  expected_sha256 text,
  actual_sha256   text,
  size_bytes    bigint,
  ok            boolean not null default false,
  checked_at    timestamptz not null default now()
);
create index if not exists idx_rt_file_integrity_file on pierre_rt_file_integrity_checks(file_id, checked_at desc);

-- ── 3.2 Documents (business objects) ─────────────────────────────────────────
create table if not exists pierre_rt_documents (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  document_type       text not null,
  title               text not null,
  description         text,
  sensitivity         text not null default 'normal',
  status              text not null default 'draft' check (status in ('draft','under_review','changes_requested','approved','published','superseded','signed','voided','archived','deleted')),
  employee_id         uuid references pierre_rt_employees(id) on delete set null,
  site_id             uuid references pierre_rt_sites(id) on delete set null,
  contract_id         uuid references pierre_rt_employee_contracts(id) on delete set null,
  mission_id          uuid references pierre_rt_missions(id) on delete set null,
  task_id             uuid references pierre_rt_tasks(id) on delete set null,
  owner_membership_id uuid references pierre_rt_members(id) on delete set null,
  current_version     integer not null default 0,
  retention_policy_key text,
  retention_until     date,
  legal_hold          boolean not null default false,
  created_by          uuid,
  approved_by         uuid,
  approved_at         timestamptz,
  archived_at         timestamptz,
  deleted_at          timestamptz,
  search_text         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1
);
create index if not exists idx_rt_documents_company on pierre_rt_documents(company_id, created_at desc);
create index if not exists idx_rt_documents_employee on pierre_rt_documents(company_id, employee_id);
create index if not exists idx_rt_documents_status on pierre_rt_documents(company_id, status);
create index if not exists idx_rt_documents_search on pierre_rt_documents(company_id, search_text);
create index if not exists idx_rt_documents_type on pierre_rt_documents(company_id, document_type);

-- ── 3.3 Document versions (immutable when finalized/signed) ───────────────────
create table if not exists pierre_rt_document_versions (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references pierre_rt_companies(id) on delete cascade,
  document_id            uuid not null references pierre_rt_documents(id) on delete cascade,
  version_number         integer not null,
  source_file_id         uuid references pierre_rt_files(id) on delete set null,
  rendered_pdf_file_id   uuid references pierre_rt_files(id) on delete set null,
  rendered_docx_file_id  uuid references pierre_rt_files(id) on delete set null,
  content_hash           text,
  template_version_id    uuid,
  generation_context_hash text,
  status                 text not null default 'draft' check (status in ('draft','under_review','changes_requested','approved','final','signed','superseded')),
  change_summary         text,
  created_by             uuid,
  reviewed_by            uuid,
  approved_by            uuid,
  created_at             timestamptz not null default now(),
  finalized_at           timestamptz,
  signed_at              timestamptz,
  superseded_at          timestamptz,
  unique (document_id, version_number)
);
create index if not exists idx_rt_doc_versions_doc on pierre_rt_document_versions(document_id, version_number desc);

-- ── 3.4 Document links (relational, not nullable-column soup) ─────────────────
create table if not exists pierre_rt_document_links (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references pierre_rt_companies(id) on delete cascade,
  document_id  uuid not null references pierre_rt_documents(id) on delete cascade,
  link_type    text not null check (link_type in ('employee','company','site','contract','mission','task','absence','onboarding','offboarding','validation')),
  target_id    uuid,
  created_at   timestamptz not null default now(),
  unique (document_id, link_type, target_id)
);
create index if not exists idx_rt_doc_links_doc on pierre_rt_document_links(document_id);
create index if not exists idx_rt_doc_links_target on pierre_rt_document_links(company_id, link_type, target_id);

-- ── 3.5 Document access log ──────────────────────────────────────────────────
create table if not exists pierre_rt_document_access_log (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references pierre_rt_companies(id) on delete cascade,
  document_id  uuid references pierre_rt_documents(id) on delete cascade,
  version_id   uuid,
  file_id      uuid,
  actor_user_id uuid,
  action       text not null,
  detail       jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now()
);
create index if not exists idx_rt_doc_access_doc on pierre_rt_document_access_log(document_id, occurred_at desc);
create index if not exists idx_rt_doc_access_company on pierre_rt_document_access_log(company_id, occurred_at desc);

-- ── 3.6 Templates ────────────────────────────────────────────────────────────
create table if not exists pierre_rt_document_templates (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  key            text not null,
  name           text not null,
  document_type  text not null,
  locale         text not null default 'fr-FR',
  jurisdiction   text not null default 'FR',
  status         text not null default 'draft' check (status in ('draft','review_required','approved','published','deprecated','archived')),
  sensitivity    text not null default 'normal',
  active_version integer,
  created_by     uuid,
  archived_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  version        integer not null default 1,
  unique (company_id, key)
);
create index if not exists idx_rt_templates_company on pierre_rt_document_templates(company_id, document_type);

create table if not exists pierre_rt_document_template_versions (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references pierre_rt_companies(id) on delete cascade,
  template_id    uuid not null references pierre_rt_document_templates(id) on delete cascade,
  version_number integer not null,
  source_file_id uuid references pierre_rt_files(id) on delete set null,
  body           text,
  renderer       text not null default 'pdf' check (renderer in ('pdf','docx','both')),
  schema_version text not null default 'v1',
  field_schema   jsonb not null default '[]'::jsonb,
  status         text not null default 'draft' check (status in ('draft','review_required','approved','published','deprecated','archived')),
  content_hash   text,
  approved_by    uuid,
  approved_at    timestamptz,
  published_at   timestamptz,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  unique (template_id, version_number)
);
create index if not exists idx_rt_template_versions_t on pierre_rt_document_template_versions(template_id, version_number desc);

create table if not exists pierre_rt_template_fields (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  template_version_id uuid not null references pierre_rt_document_template_versions(id) on delete cascade,
  field_key           text not null,
  label               text,
  data_type           text not null default 'string',
  required            boolean not null default true,
  sensitive           boolean not null default false,
  source_path         text,
  unique (template_version_id, field_key)
);

create table if not exists pierre_rt_template_approvals (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  template_version_id uuid not null references pierre_rt_document_template_versions(id) on delete cascade,
  approver_user_id    uuid,
  decision            text not null check (decision in ('requested','approved','rejected')),
  note                text,
  decided_at          timestamptz not null default now()
);

-- ── 3.7 Signatures ───────────────────────────────────────────────────────────
create table if not exists pierre_rt_signature_requests (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references pierre_rt_companies(id) on delete cascade,
  document_id         uuid not null references pierre_rt_documents(id) on delete cascade,
  document_version_id uuid not null references pierre_rt_document_versions(id) on delete cascade,
  provider            text not null default 'local_sandbox',
  provider_request_id text,
  signature_level     text not null default 'simple' check (signature_level in ('acknowledgement','simple','advanced_provider_managed','qualified_provider_managed')),
  status              text not null default 'draft' check (status in ('draft','preparing','awaiting_approval','ready','submitted','in_progress','partially_signed','completed','declined','expired','cancelled','failed')),
  approval_status     text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_content_hash text,
  expires_at          timestamptz,
  submitted_at        timestamptz,
  completed_at        timestamptz,
  declined_at         timestamptz,
  cancelled_at        timestamptz,
  idempotency_key     text,
  created_by          uuid,
  approved_by         uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  version             integer not null default 1,
  unique (company_id, idempotency_key)
);
create index if not exists idx_rt_sig_requests_company on pierre_rt_signature_requests(company_id, status);
create index if not exists idx_rt_sig_requests_doc on pierre_rt_signature_requests(document_id);
create unique index if not exists idx_rt_sig_provider_req on pierre_rt_signature_requests(provider, provider_request_id) where provider_request_id is not null;

create table if not exists pierre_rt_signature_recipients (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references pierre_rt_companies(id) on delete cascade,
  signature_request_id uuid not null references pierre_rt_signature_requests(id) on delete cascade,
  name                 text not null,
  email                text not null,
  role                 text not null default 'employee',
  signing_order        integer not null default 1,
  status               text not null default 'pending' check (status in ('pending','sent','delivered','viewed','signed','declined','expired')),
  provider_recipient_id text,
  authentication_method text not null default 'email',
  signed_at            timestamptz,
  declined_at          timestamptz,
  created_at           timestamptz not null default now()
);
create index if not exists idx_rt_sig_recipients_req on pierre_rt_signature_recipients(signature_request_id, signing_order);

create table if not exists pierre_rt_signature_events (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references pierre_rt_companies(id) on delete cascade,
  signature_request_id uuid not null references pierre_rt_signature_requests(id) on delete cascade,
  event_type           text not null,
  provider_event_id    text,
  recipient_id         uuid,
  payload_hash         text,
  occurred_at          timestamptz not null default now(),
  received_at          timestamptz not null default now()
);
create index if not exists idx_rt_sig_events_req on pierre_rt_signature_events(signature_request_id, received_at);

create table if not exists pierre_rt_signature_webhooks (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid,
  provider             text not null,
  provider_event_id    text not null,
  signature_request_id uuid,
  verified             boolean not null default false,
  status               text not null default 'received' check (status in ('received','processed','rejected','duplicate')),
  payload_hash         text,
  received_at          timestamptz not null default now(),
  processed_at         timestamptz,
  unique (provider, provider_event_id)
);
create index if not exists idx_rt_sig_webhooks_req on pierre_rt_signature_webhooks(signature_request_id);

create table if not exists pierre_rt_signature_evidence (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references pierre_rt_companies(id) on delete cascade,
  signature_request_id uuid not null references pierre_rt_signature_requests(id) on delete cascade,
  provider             text not null,
  provider_request_id  text,
  provider_document_id text,
  signature_level      text,
  content_hash_before  text,
  content_hash_signed  text,
  evidence_file_id     uuid references pierre_rt_files(id) on delete set null,
  recipients           jsonb not null default '[]'::jsonb,
  events               jsonb not null default '[]'::jsonb,
  integrity_verified   boolean not null default false,
  retrieved_at         timestamptz not null default now(),
  unique (signature_request_id)
);

-- ── Contract workflow extension (extend P8.2 contracts, do not duplicate) ─────
alter table pierre_rt_employee_contracts add column if not exists workflow_status text not null default 'draft';
alter table pierre_rt_employee_contracts add column if not exists document_id uuid references pierre_rt_documents(id) on delete set null;
alter table pierre_rt_employee_contracts add column if not exists approved_by uuid;
alter table pierre_rt_employee_contracts add column if not exists approved_at timestamptz;
alter table pierre_rt_employee_contracts add column if not exists signed_at timestamptz;
alter table pierre_rt_employee_contracts add column if not exists parent_contract_id uuid references pierre_rt_employee_contracts(id) on delete set null;
alter table pierre_rt_employee_contract_versions add column if not exists document_version_id uuid references pierre_rt_document_versions(id) on delete set null;
alter table pierre_rt_employee_contract_versions add column if not exists template_version_id uuid;
alter table pierre_rt_employee_contract_versions add column if not exists content_hash text;

-- ── RLS — force on every new tenant table ────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_files','pierre_rt_file_scan_results','pierre_rt_file_integrity_checks',
    'pierre_rt_documents','pierre_rt_document_versions','pierre_rt_document_links','pierre_rt_document_access_log',
    'pierre_rt_document_templates','pierre_rt_document_template_versions','pierre_rt_template_fields','pierre_rt_template_approvals',
    'pierre_rt_signature_requests','pierre_rt_signature_recipients','pierre_rt_signature_events','pierre_rt_signature_evidence'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update, delete on %I to pierre_rt_app', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end$$;

-- Webhooks: company_id is resolved server-side (may be null on first receipt), so a
-- nullable-tolerant policy (a webhook row is visible to its resolved company, or to
-- the service role pre-resolution). Forced RLS + grant for the app role.
alter table pierre_rt_signature_webhooks enable row level security;
alter table pierre_rt_signature_webhooks force row level security;
grant select, insert, update, delete on pierre_rt_signature_webhooks to pierre_rt_app;
drop policy if exists rt_iso_pierre_rt_signature_webhooks on pierre_rt_signature_webhooks;
create policy rt_iso_pierre_rt_signature_webhooks on pierre_rt_signature_webhooks
  using (company_id is null or company_id::text = current_setting('app.current_company', true))
  with check (company_id is null or company_id::text = current_setting('app.current_company', true));

-- ── Permissions (P8.3) + role grants ─────────────────────────────────────────
insert into pierre_rt_permissions (key, description) values
  ('file.upload','Upload files'),('file.read','Read files'),('file.delete','Delete files'),('file.quarantine.manage','Manage file quarantine'),
  ('document.approve','Approve documents'),('document.archive','Archive documents'),
  ('document.sensitive.read','Read sensitive documents'),('document.sensitive.write','Write sensitive documents'),
  ('template.read','Read templates'),('template.write','Write templates'),('template.approve','Approve/publish templates'),
  ('contract.read','Read contracts'),('contract.write','Write contracts'),('contract.approve','Approve contracts'),
  ('signature.read','Read signature requests'),('signature.create','Create signature requests'),('signature.submit','Submit signature requests'),
  ('signature.cancel','Cancel signature requests'),('signature.evidence.read','Read signature evidence')
on conflict (key) do nothing;

do $$
declare allperms text[] := array(select key from pierre_rt_permissions where key like 'file.%' or key like 'document.%' or key like 'template.%' or key like 'contract.%' or key like 'signature.%');
begin
  -- OWNER / ADMIN: every P8.3 permission
  insert into pierre_rt_role_permissions (role_key, permission_key)
    select r, p from (values ('OWNER'),('ADMIN')) v(r), unnest(allperms) p on conflict do nothing;
  -- HR_DIRECTOR: documents/contracts/templates/signature/sensitive
  insert into pierre_rt_role_permissions values
    ('HR_DIRECTOR','file.upload'),('HR_DIRECTOR','file.read'),('HR_DIRECTOR','file.delete'),
    ('HR_DIRECTOR','document.approve'),('HR_DIRECTOR','document.archive'),('HR_DIRECTOR','document.sensitive.read'),('HR_DIRECTOR','document.sensitive.write'),
    ('HR_DIRECTOR','template.read'),('HR_DIRECTOR','template.write'),('HR_DIRECTOR','template.approve'),
    ('HR_DIRECTOR','contract.read'),('HR_DIRECTOR','contract.write'),('HR_DIRECTOR','contract.approve'),
    ('HR_DIRECTOR','signature.read'),('HR_DIRECTOR','signature.create'),('HR_DIRECTOR','signature.submit'),('HR_DIRECTOR','signature.cancel'),('HR_DIRECTOR','signature.evidence.read')
    on conflict do nothing;
  -- HR_MANAGER: documents + contracts + signature (submit gated by approval flow)
  insert into pierre_rt_role_permissions values
    ('HR_MANAGER','file.upload'),('HR_MANAGER','file.read'),
    ('HR_MANAGER','document.approve'),('HR_MANAGER','template.read'),
    ('HR_MANAGER','contract.read'),('HR_MANAGER','contract.write'),
    ('HR_MANAGER','signature.read'),('HR_MANAGER','signature.create'),('HR_MANAGER','signature.submit'),('HR_MANAGER','signature.cancel')
    on conflict do nothing;
  -- HR_OPERATOR: upload/generate/read, NO final legal approval
  insert into pierre_rt_role_permissions values
    ('HR_OPERATOR','file.upload'),('HR_OPERATOR','file.read'),
    ('HR_OPERATOR','template.read'),('HR_OPERATOR','contract.read'),('HR_OPERATOR','signature.read')
    on conflict do nothing;
  -- VALIDATOR: review/approve
  insert into pierre_rt_role_permissions values
    ('VALIDATOR','file.read'),('VALIDATOR','document.approve'),('VALIDATOR','contract.approve'),('VALIDATOR','template.approve'),('VALIDATOR','signature.read')
    on conflict do nothing;
  -- AUDITOR: read metadata, evidence, audits — no modification
  insert into pierre_rt_role_permissions values
    ('AUDITOR','file.read'),('AUDITOR','template.read'),('AUDITOR','contract.read'),('AUDITOR','signature.read'),('AUDITOR','signature.evidence.read')
    on conflict do nothing;
  -- MANAGER: authorized employees, non-sensitive docs only
  insert into pierre_rt_role_permissions values
    ('MANAGER','file.read'),('MANAGER','contract.read'),('MANAGER','signature.read')
    on conflict do nothing;
  -- EMPLOYEE: only explicitly exposed documents (read)
  insert into pierre_rt_role_permissions values
    ('EMPLOYEE','file.read')
    on conflict do nothing;
end $$;
