# Pierre Tenancy & RBAC (P8.2)

## Entities

- `pierre_rt_companies` — the tenant.
- `pierre_rt_members` — (company, user, role, permissions[]). One owner per company
  after backfill.
- `pierre_rt_sites` — physical/organizational sites of a company.
- `pierre_rt_member_sites` — restricts a member to specific sites (RBAC scope).
- `pierre_rt_employees` (+ events, documents, absences) — Employee 360.

## Ownership model & backfill

Legacy ownership was **per-user**: a user with an `orders` row in status
`active`/`trialing` (the `hasPierreAccess` rule) — and/or `agents_owned` — owns
Pierre. The backfill (`pierre_rt_backfill_tenancy()`):

1. collects distinct owner user ids (active/trialing orders ∪ agents_owned),
2. creates one company per owner (deterministic `id = user_id`, so legacy `pierre_*`
   rows keyed by `user_id` map cleanly later),
3. creates one `owner` membership per company.

Idempotent (`on conflict do nothing`, deterministic ids), safe when legacy tables
are absent (`to_regclass`), re-runnable with zero duplication.

## Authorization (two axes)

1. **Role → actions** (`Permission`): owner/admin (all), hr_manager (mission +
   validation + employee write + site read), hr_operator (mission create/read +
   employee/site read), viewer (read-only). Per-member `permissions[]` can extend.
2. **Site scope** (`pierre_rt_member_sites`): no rows → all company sites; one+ rows
   → restricted to those sites. Enforced in repos (`site_id = any(scope)`) and at the
   service layer (`canAccessSite`).

`TenantContext` carries `role`, `permissions`, and `site_ids` (null = all sites),
resolved server-side from membership. Workers/routes never trust a client company id;
`resolveDefaultCompanyId` derives the active company from a single membership.

## RLS (defense-in-depth)

Every tenant table has RLS **enabled + forced**, keyed on
`company_id = current_setting('app.current_company')`. The service role bypasses RLS
(as in Supabase); the restricted `pierre_rt_app` role is isolated. Site-level scoping
is enforced at the app layer (the GUC carries the company; site scope is per-member).

## Cockpit default

v1 is the default write path (`NEXT_PUBLIC_PIERRE_RUNTIME_V1 !== "0"`). Migrated
accounts (with a membership) write only to `pierre_rt_*`; not-yet-migrated accounts
fall back to the deprecated legacy path until the production backfill runs.
