-- supabase/migrations/2026-06-18__pierre_v11_custom_field_definitions.sql
-- PHASE 8.3-B2E §12 — canonical CUSTOM FIELD DEFINITIONS store. This is the company
-- HR configuration that decides, per custom field, its data type, its sensitivity,
-- its provenance requirement and the document types it may appear in. A template
-- author can REFERENCE a custom field (`validated_custom_fields.<key>`) but can never
-- set its sensitivity — that comes from HERE. Distinct from the per-employee VALUES
-- table (pierre_rt_employee_custom_fields). Idempotent.

create table if not exists pierre_rt_custom_field_definitions (
  company_id            uuid not null references pierre_rt_companies(id) on delete cascade,
  field_key             text not null,
  label                 text not null,
  data_type             text not null default 'string' check (data_type in ('string','date','number','email')),
  sensitivity           text not null default 'normal' check (sensitivity in ('normal','sensitive','restricted')),
  active                boolean not null default true,
  allowed_document_types text[] not null default '{}',
  required_provenance   text,                       -- e.g. 'hr_validated', 'payroll_system'
  created_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  primary key (company_id, field_key)
);
create index if not exists idx_rt_custom_field_defs_company on pierre_rt_custom_field_definitions(company_id);

do $$ begin
  execute 'alter table pierre_rt_custom_field_definitions enable row level security';
  execute 'alter table pierre_rt_custom_field_definitions force row level security';
  execute 'grant select, insert, update on pierre_rt_custom_field_definitions to pierre_rt_app';
  execute 'drop policy if exists rt_iso_pierre_rt_custom_field_definitions on pierre_rt_custom_field_definitions';
  execute 'create policy rt_iso_pierre_rt_custom_field_definitions on pierre_rt_custom_field_definitions using (company_id::text = current_setting(''app.current_company'', true)) with check (company_id::text = current_setting(''app.current_company'', true))';
end$$;
