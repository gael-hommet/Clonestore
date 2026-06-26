-- ============================================================================
-- PHASE 8.2 (completion) — Full enterprise model: company, RBAC, relational
-- Employee 360, sensitive-data isolation. Extends pierre_rt_* (v1/v2). Relational
-- (no JSONB substitute for real entities). RLS forced. Idempotent / re-runnable.
-- ============================================================================

-- ── Complete company model ───────────────────────────────────────────────────
alter table pierre_rt_companies add column if not exists legal_name text;
alter table pierre_rt_companies add column if not exists display_name text;
alter table pierre_rt_companies add column if not exists slug text;
alter table pierre_rt_companies add column if not exists legal_form text;
alter table pierre_rt_companies add column if not exists registration_country text;
alter table pierre_rt_companies add column if not exists registration_number text;
alter table pierre_rt_companies add column if not exists vat_number text;
alter table pierre_rt_companies add column if not exists sector text;
alter table pierre_rt_companies add column if not exists company_size text;
alter table pierre_rt_companies add column if not exists default_locale text not null default 'fr-FR';
alter table pierre_rt_companies add column if not exists timezone text not null default 'Europe/Paris';
alter table pierre_rt_companies add column if not exists default_currency text not null default 'EUR';
alter table pierre_rt_companies add column if not exists default_autonomy_mode text not null default 'normal';
alter table pierre_rt_companies add column if not exists status text not null default 'active';
alter table pierre_rt_companies add column if not exists onboarding_status text not null default 'pending';
alter table pierre_rt_companies add column if not exists owner_user_id uuid;
alter table pierre_rt_companies add column if not exists activated_at timestamptz;
alter table pierre_rt_companies add column if not exists suspended_at timestamptz;
alter table pierre_rt_companies add column if not exists cancelled_at timestamptz;
alter table pierre_rt_companies add column if not exists version integer not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_rt_companies_status') then
    alter table pierre_rt_companies add constraint chk_rt_companies_status
      check (status in ('onboarding','active','suspended','cancellation_pending','cancelled','archived'));
  end if;
end $$;
create unique index if not exists idx_rt_companies_slug on pierre_rt_companies(slug) where slug is not null;

-- ── RBAC — real relational model ─────────────────────────────────────────────
create table if not exists pierre_rt_roles (
  key        text primary key,
  label      text not null,
  is_system  boolean not null default true
);
create table if not exists pierre_rt_permissions (
  key         text primary key,
  description text not null
);
create table if not exists pierre_rt_role_permissions (
  role_key       text not null references pierre_rt_roles(key) on delete cascade,
  permission_key text not null references pierre_rt_permissions(key) on delete cascade,
  primary key (role_key, permission_key)
);
create table if not exists pierre_rt_membership_roles (
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  membership_id uuid not null references pierre_rt_members(id) on delete cascade,
  role_key      text not null references pierre_rt_roles(key) on delete cascade,
  primary key (membership_id, role_key)
);
create index if not exists idx_rt_membership_roles_member on pierre_rt_membership_roles(membership_id);
create table if not exists pierre_rt_custom_roles (
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  key        text not null,
  label      text not null,
  primary key (company_id, key)
);

-- System roles
insert into pierre_rt_roles (key,label,is_system) values
  ('OWNER','Owner',true),('ADMIN','Admin',true),('HR_DIRECTOR','HR Director',true),
  ('HR_MANAGER','HR Manager',true),('HR_OPERATOR','HR Operator',true),('PAYROLL_MANAGER','Payroll Manager',true),
  ('SITE_MANAGER','Site Manager',true),('MANAGER','Manager',true),('VALIDATOR','Validator',true),
  ('AUDITOR','Auditor',true),('EMPLOYEE','Employee',true),('VIEWER','Viewer',true)
on conflict (key) do nothing;

-- Permission matrix
insert into pierre_rt_permissions (key,description) values
  ('company.read','Read company'),('company.write','Edit company'),('company.admin','Administer company'),
  ('mission.create','Create mission'),('mission.read','Read mission'),('mission.cancel','Cancel mission'),
  ('employee.read','Read employees'),('employee.write','Write employees'),('employee.archive','Archive employees'),
  ('employee.sensitive.read','Read sensitive employee data'),('employee.sensitive.write','Write sensitive employee data'),
  ('document.read','Read documents'),('document.write','Write documents'),
  ('absence.read','Read absences'),('absence.write','Write absences'),
  ('payroll_prep.read','Read payroll prep'),('payroll_prep.write','Write payroll prep'),
  ('validation.read','Read validations'),('validation.decide','Decide validations'),
  ('pierre.use','Use Pierre runtime'),('audit.read','Read audit log'),
  ('site.read','Read sites'),('site.write','Write sites'),('tenancy.admin','Administer tenancy'),
  ('task.read','Read tasks'),('queue.admin','Administer queue'),('gdpr.admin','GDPR operations')
on conflict (key) do nothing;

-- Role -> permissions (system matrix)
do $$
declare
  all_perms text[] := array(select key from pierre_rt_permissions);
begin
  -- OWNER / ADMIN: everything
  insert into pierre_rt_role_permissions (role_key, permission_key)
    select r, p from (values ('OWNER'),('ADMIN')) v(r), unnest(all_perms) p on conflict do nothing;
  -- HR_DIRECTOR: all HR + read company/audit
  insert into pierre_rt_role_permissions values
    ('HR_DIRECTOR','company.read'),('HR_DIRECTOR','mission.create'),('HR_DIRECTOR','mission.read'),('HR_DIRECTOR','mission.cancel'),
    ('HR_DIRECTOR','employee.read'),('HR_DIRECTOR','employee.write'),('HR_DIRECTOR','employee.archive'),
    ('HR_DIRECTOR','employee.sensitive.read'),('HR_DIRECTOR','document.read'),('HR_DIRECTOR','document.write'),
    ('HR_DIRECTOR','absence.read'),('HR_DIRECTOR','absence.write'),('HR_DIRECTOR','validation.read'),('HR_DIRECTOR','validation.decide'),
    ('HR_DIRECTOR','pierre.use'),('HR_DIRECTOR','audit.read'),('HR_DIRECTOR','site.read'),('HR_DIRECTOR','site.write'),('HR_DIRECTOR','task.read')
    on conflict do nothing;
  -- HR_MANAGER
  insert into pierre_rt_role_permissions values
    ('HR_MANAGER','company.read'),('HR_MANAGER','mission.create'),('HR_MANAGER','mission.read'),('HR_MANAGER','mission.cancel'),
    ('HR_MANAGER','employee.read'),('HR_MANAGER','employee.write'),('HR_MANAGER','document.read'),('HR_MANAGER','document.write'),
    ('HR_MANAGER','absence.read'),('HR_MANAGER','absence.write'),('HR_MANAGER','validation.read'),('HR_MANAGER','validation.decide'),
    ('HR_MANAGER','pierre.use'),('HR_MANAGER','site.read'),('HR_MANAGER','task.read')
    on conflict do nothing;
  -- HR_OPERATOR
  insert into pierre_rt_role_permissions values
    ('HR_OPERATOR','company.read'),('HR_OPERATOR','mission.create'),('HR_OPERATOR','mission.read'),
    ('HR_OPERATOR','employee.read'),('HR_OPERATOR','document.read'),('HR_OPERATOR','absence.read'),
    ('HR_OPERATOR','site.read'),('HR_OPERATOR','task.read'),('HR_OPERATOR','pierre.use')
    on conflict do nothing;
  -- PAYROLL_MANAGER
  insert into pierre_rt_role_permissions values
    ('PAYROLL_MANAGER','company.read'),('PAYROLL_MANAGER','employee.read'),('PAYROLL_MANAGER','employee.sensitive.read'),
    ('PAYROLL_MANAGER','payroll_prep.read'),('PAYROLL_MANAGER','payroll_prep.write'),('PAYROLL_MANAGER','absence.read'),('PAYROLL_MANAGER','site.read')
    on conflict do nothing;
  -- SITE_MANAGER
  insert into pierre_rt_role_permissions values
    ('SITE_MANAGER','company.read'),('SITE_MANAGER','employee.read'),('SITE_MANAGER','mission.read'),
    ('SITE_MANAGER','absence.read'),('SITE_MANAGER','site.read'),('SITE_MANAGER','task.read')
    on conflict do nothing;
  -- MANAGER
  insert into pierre_rt_role_permissions values
    ('MANAGER','employee.read'),('MANAGER','mission.read'),('MANAGER','absence.read'),('MANAGER','task.read'),('MANAGER','site.read')
    on conflict do nothing;
  -- VALIDATOR
  insert into pierre_rt_role_permissions values
    ('VALIDATOR','validation.read'),('VALIDATOR','validation.decide'),('VALIDATOR','mission.read'),('VALIDATOR','employee.read')
    on conflict do nothing;
  -- AUDITOR
  insert into pierre_rt_role_permissions values
    ('AUDITOR','audit.read'),('AUDITOR','company.read'),('AUDITOR','employee.read'),('AUDITOR','mission.read'),('AUDITOR','site.read')
    on conflict do nothing;
  -- EMPLOYEE / VIEWER
  insert into pierre_rt_role_permissions values
    ('EMPLOYEE','employee.read'),('VIEWER','company.read'),('VIEWER','employee.read'),('VIEWER','mission.read'),('VIEWER','site.read'),('VIEWER','task.read')
    on conflict do nothing;
end $$;

-- ── Member lifecycle: status + invitations ───────────────────────────────────
alter table pierre_rt_members add column if not exists status text not null default 'active';
do $$ begin
  if not exists (select 1 from pg_constraint where conname='chk_rt_members_status') then
    alter table pierre_rt_members add constraint chk_rt_members_status check (status in ('active','suspended','removed','left'));
  end if;
end $$;

create table if not exists pierre_rt_invitations (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references pierre_rt_companies(id) on delete cascade,
  email         text not null,
  token_hash    text not null,
  roles         text[] not null default array['VIEWER']::text[],
  site_ids      uuid[] not null default array[]::uuid[],
  invited_by    uuid,
  status        text not null default 'pending' check (status in ('pending','accepted','declined','revoked','expired')),
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (company_id, email, status)
);
create index if not exists idx_rt_invitations_company on pierre_rt_invitations(company_id, status);

-- ── Sites — complete ─────────────────────────────────────────────────────────
alter table pierre_rt_sites add column if not exists type text not null default 'office';
alter table pierre_rt_sites add column if not exists address text;
alter table pierre_rt_sites add column if not exists postal_code text;
alter table pierre_rt_sites add column if not exists city text;
alter table pierre_rt_sites add column if not exists country text;
alter table pierre_rt_sites add column if not exists phone text;
alter table pierre_rt_sites add column if not exists email text;
alter table pierre_rt_sites add column if not exists manager_membership_id uuid references pierre_rt_members(id) on delete set null;
alter table pierre_rt_sites add column if not exists legal_establishment_number text;
alter table pierre_rt_sites add column if not exists active boolean not null default true;
alter table pierre_rt_sites add column if not exists version integer not null default 1;

-- ── Employee identity — extended ─────────────────────────────────────────────
alter table pierre_rt_employees add column if not exists employee_number text;
alter table pierre_rt_employees add column if not exists preferred_name text;
alter table pierre_rt_employees add column if not exists professional_email text;
alter table pierre_rt_employees add column if not exists personal_email text;
alter table pierre_rt_employees add column if not exists preferred_language text;
alter table pierre_rt_employees add column if not exists department text;
alter table pierre_rt_employees add column if not exists team text;
alter table pierre_rt_employees add column if not exists job_family text;
alter table pierre_rt_employees add column if not exists cost_center text;
alter table pierre_rt_employees add column if not exists location_mode text;
alter table pierre_rt_employees add column if not exists seniority_date date;
alter table pierre_rt_employees add column if not exists probation_end_date date;
alter table pierre_rt_employees add column if not exists expected_end_date date;
alter table pierre_rt_employees add column if not exists termination_date date;
alter table pierre_rt_employees add column if not exists version integer not null default 1;
-- normalized search text (accent-insensitive; app-maintained; prod adds pg_trgm GIN)
alter table pierre_rt_employees add column if not exists search_text text;
create index if not exists idx_rt_employees_search on pierre_rt_employees(company_id, search_text);

-- ── Relational Employee 360 (no JSONB substitute for real entities) ──────────
create table if not exists pierre_rt_employee_employments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade,
  employment_type text not null, legal_employer text, site_id uuid references pierre_rt_sites(id) on delete set null,
  manager_employee_id uuid references pierre_rt_employees(id) on delete set null,
  start_date date, end_date date, status text not null default 'active',
  working_time_basis text, weekly_hours numeric, classification text, collective_reference text, payroll_reference text,
  created_at timestamptz not null default now());
create index if not exists idx_rt_employments_emp on pierre_rt_employee_employments(employee_id);

create table if not exists pierre_rt_employee_contracts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade,
  contract_type text not null check (contract_type in ('CDI_FULL_TIME','CDI_PART_TIME','CDD','CDD_REPLACEMENT','CDD_TEMPORARY_INCREASE','APPRENTICESHIP','PROFESSIONAL_TRAINING','INTERNSHIP','SEASONAL','TEMPORARY','OTHER')),
  status text not null default 'draft', current_version integer not null default 1, created_at timestamptz not null default now());
create index if not exists idx_rt_contracts_emp on pierre_rt_employee_contracts(employee_id);

create table if not exists pierre_rt_employee_contract_versions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  contract_id uuid not null references pierre_rt_employee_contracts(id) on delete cascade,
  version integer not null, effective_from date, effective_to date, status text not null default 'draft',
  source_template_id uuid, document_id uuid, signature_status text not null default 'unsigned',
  validated_by uuid, approved_at timestamptz, signed_at timestamptz, archived_at timestamptz, created_at timestamptz not null default now(),
  unique (contract_id, version));

create table if not exists pierre_rt_employee_contact_methods (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, kind text not null, value text not null, is_primary boolean not null default false, created_at timestamptz not null default now());
create index if not exists idx_rt_contact_emp on pierre_rt_employee_contact_methods(employee_id);

create table if not exists pierre_rt_employee_addresses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, type text not null default 'home', line1 text, line2 text, postal_code text, city text, country text, created_at timestamptz not null default now());

create table if not exists pierre_rt_employee_emergency_contacts (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, name text not null, relationship text, phone text, created_at timestamptz not null default now());

create table if not exists pierre_rt_employee_manager_assignments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, manager_employee_id uuid references pierre_rt_employees(id) on delete set null, start_date date, end_date date, created_at timestamptz not null default now());

create table if not exists pierre_rt_employee_site_assignments (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, site_id uuid not null references pierre_rt_sites(id) on delete cascade, start_date date, end_date date, created_at timestamptz not null default now());

create table if not exists pierre_rt_employee_document_requirements (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, kind text not null, mandatory boolean not null default true, satisfied boolean not null default false, due_date date, created_at timestamptz not null default now());
create index if not exists idx_rt_doc_req_emp on pierre_rt_employee_document_requirements(employee_id);

create table if not exists pierre_rt_employee_notes (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, author_user_id uuid, body text not null, sensitivity text not null default 'normal', created_at timestamptz not null default now());

create table if not exists pierre_rt_employee_tags (
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, tag text not null, primary key (employee_id, tag));

create table if not exists pierre_rt_employee_status_history (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, prev_status text, new_status text not null, actor_user_id uuid, occurred_at timestamptz not null default now());
create index if not exists idx_rt_emp_status_hist on pierre_rt_employee_status_history(employee_id, occurred_at);

create table if not exists pierre_rt_employee_sensitive_data (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade,
  category text not null check (category in ('compensation','medical','disability','disciplinary','conflict','report','official_id','bank_details','protected_note')),
  -- value is encrypted-at-rest in production (KMS/pgcrypto); stored opaque here.
  value_encrypted text, encryption_strategy text not null default 'app_kms', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists idx_rt_emp_sensitive on pierre_rt_employee_sensitive_data(employee_id, category);

create table if not exists pierre_rt_employee_sensitive_access_log (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, category text not null, actor_user_id uuid, accessed_at timestamptz not null default now());
create index if not exists idx_rt_emp_sensitive_log on pierre_rt_employee_sensitive_access_log(employee_id, accessed_at);

create table if not exists pierre_rt_employee_custom_fields (
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, field_key text not null, field_value text, primary key (employee_id, field_key));

create table if not exists pierre_rt_employee_missions (
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, mission_id uuid not null references pierre_rt_missions(id) on delete cascade, primary key (employee_id, mission_id));

create table if not exists pierre_rt_employee_tasks (
  company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  employee_id uuid not null references pierre_rt_employees(id) on delete cascade, task_id uuid not null references pierre_rt_tasks(id) on delete cascade, primary key (employee_id, task_id));

-- ── GDPR / retention ─────────────────────────────────────────────────────────
alter table pierre_rt_employees add column if not exists retention_until date;
alter table pierre_rt_employees add column if not exists legal_hold boolean not null default false;
alter table pierre_rt_employees add column if not exists anonymized_at timestamptz;

create table if not exists pierre_rt_data_access_log (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references pierre_rt_companies(id) on delete cascade,
  subject_type text not null, subject_id uuid, actor_user_id uuid, action text not null, occurred_at timestamptz not null default now());
create index if not exists idx_rt_data_access on pierre_rt_data_access_log(company_id, occurred_at desc);

-- ============================================================================
-- RLS — force on every new tenant table.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'pierre_rt_membership_roles','pierre_rt_custom_roles','pierre_rt_invitations',
    'pierre_rt_employee_employments','pierre_rt_employee_contracts','pierre_rt_employee_contract_versions',
    'pierre_rt_employee_contact_methods','pierre_rt_employee_addresses','pierre_rt_employee_emergency_contacts',
    'pierre_rt_employee_manager_assignments','pierre_rt_employee_site_assignments','pierre_rt_employee_document_requirements',
    'pierre_rt_employee_notes','pierre_rt_employee_tags','pierre_rt_employee_status_history',
    'pierre_rt_employee_sensitive_data','pierre_rt_employee_sensitive_access_log','pierre_rt_employee_custom_fields',
    'pierre_rt_employee_missions','pierre_rt_employee_tasks','pierre_rt_data_access_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('grant select, insert, update, delete on %I to pierre_rt_app', t);
    execute format('drop policy if exists rt_iso_%1$s on %1$s', t);
    execute format('create policy rt_iso_%1$s on %1$s using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))', t);
  end loop;
end$$;
-- global RBAC catalog tables are readable by the app role (not tenant-scoped)
grant select on pierre_rt_roles, pierre_rt_permissions, pierre_rt_role_permissions to pierre_rt_app;
