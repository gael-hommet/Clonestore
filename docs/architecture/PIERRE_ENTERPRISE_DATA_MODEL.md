# Pierre Enterprise Data Model (P8.2)

Canonical multi-tenant model in `pierre_rt_*` (migrations v1→v3). Relational, not
JSONB-as-a-database.

## Tenancy
- `pierre_rt_companies` — full company: legal_name, display_name, slug, legal_form,
  registration_country/number, vat_number, sector, company_size, default_locale,
  timezone, default_currency, default_autonomy_mode, **status** (onboarding/active/
  suspended/cancellation_pending/cancelled/archived), onboarding_status, owner_user_id,
  activated/suspended/cancelled_at, **version** (optimistic concurrency).
- `pierre_rt_members` — (company, user, role, permissions[], **status** active/suspended/
  removed/left).
- `pierre_rt_member_sites` — RBAC site scope.
- `pierre_rt_invitations` — token-hashed invitations (roles, site_ids, status, expiry).

## RBAC (relational)
`pierre_rt_roles`, `pierre_rt_permissions`, `pierre_rt_role_permissions`,
`pierre_rt_membership_roles` (multi-role), `pierre_rt_custom_roles`. See
PIERRE_RBAC_PERMISSION_MATRIX.md.

## Sites
`pierre_rt_sites` — type, address, postal_code, city, country, phone, email,
manager_membership_id, legal_establishment_number, active, version.

## Employee 360
Root `pierre_rt_employees` (identity) + relational satellites — see
PIERRE_EMPLOYEE_360_MODEL.md.

## Cross-references
Missions/tasks link to employees/sites: `pierre_rt_missions.employee_id/site_id` (FK
NOT VALID, safe on existing rows), `pierre_rt_employee_missions`,
`pierre_rt_employee_tasks`.

## P8.2-C additions (migration v4)
- `pierre_rt_custom_role_permissions`, `pierre_rt_membership_custom_roles` — custom-role
  grants + assignment (see PIERRE_RBAC_PERMISSION_MATRIX.md).
- `pierre_rt_user_company_prefs` — identity-scoped active-company preference (not
  tenant-RLS-scoped; resolved by the service role at identity time).
- `pierre_rt_employee_import_batches` + `pierre_rt_employee_import_rows` — CSV import
  staging (idempotent, rollback-able; see PIERRE_EMPLOYEE_360_MODEL.md).
- `pg_trgm` GIN index on `pierre_rt_employees.search_text` when the extension is present
  (guarded; PGlite falls back to the normalized token/trigram search engine).

## RLS
Every tenant table: RLS **enabled + forced**, keyed on
`company_id = current_setting('app.current_company')`, granted to non-superuser
`pierre_rt_app`. See PIERRE_RLS_RUNTIME_BINDING.md.
