# Pierre RBAC & Permission Matrix (P8.2)

## Model
Relational + DB-driven: `pierre_rt_roles` × `pierre_rt_permissions` via
`pierre_rt_role_permissions`; a membership has many roles via
`pierre_rt_membership_roles`; `pierre_rt_custom_roles` per company. A member's
effective permissions = ∪(role_permissions for all their roles) ∪ explicit
member `permissions[]`. Resolution happens server-side in `resolveTenantContext`.

## System roles
OWNER, ADMIN, HR_DIRECTOR, HR_MANAGER, HR_OPERATOR, PAYROLL_MANAGER, SITE_MANAGER,
MANAGER, VALIDATOR, AUDITOR, EMPLOYEE, VIEWER.

## Permission families
`company.*`, `mission.*`, `employee.*` (+ `employee.sensitive.read/write`),
`document.*`, `absence.*`, `payroll_prep.*`, `validation.*`, `pierre.use`,
`audit.read`, `site.*`, `tenancy.admin`, `task.read`, `queue.admin`, `gdpr.admin`.

## Matrix (highlights, seeded in migration v3)
- OWNER / ADMIN — all permissions.
- HR_DIRECTOR — all HR + sensitive.read + validation.decide + audit.read.
- HR_MANAGER — mission/employee/document/absence/validation + pierre.use.
- HR_OPERATOR — read HR + mission.create + pierre.use.
- PAYROLL_MANAGER — employee.read + **sensitive.read** + payroll_prep.* (no employee.write).
- SITE_MANAGER / MANAGER — scoped reads.
- VALIDATOR — validation.read/decide.
- AUDITOR — audit.read + reads.
- EMPLOYEE / VIEWER — read-only (no sensitive, no write).

## Two axes of authorization
1. Role → permitted actions (above).
2. Site scope (`pierre_rt_member_sites`): empty = all sites; otherwise restricted.

## Custom roles (P8.2-C)
Company-defined roles live in `pierre_rt_custom_roles` (per-company key, `version`,
`created_by`, `archived_at`) with grants in `pierre_rt_custom_role_permissions`, and are
assigned to members via `pierre_rt_membership_custom_roles`. `resolveTenantContext`
unions a member's custom-role permissions with their system-role permissions — custom
and system roles are then indistinguishable to the rest of the runtime. Rules enforced
in `roles.ts` / `members.ts`:
- system roles are immutable (no patch, no archive) and never collide with a custom key;
- a role may only grant a permission that exists in `pierre_rt_permissions`;
- no privilege escalation: a non-admin may only assign roles whose permission set is a
  subset of their own;
- archiving a custom role detaches it from every membership (permissions revoked at the
  next context resolution);
- OWNER cannot be removed while it is the last active owner.

API: `GET/POST /roles`, `GET/PATCH /roles/:key`, `POST /roles/:key/archive`,
`POST /members/:id/roles`, `DELETE /members/:id/roles/:role`. Proven in
`p82c-operational.itest.ts` §2–3.

## Enforcement
Service (`requirePermission`), route (handlers), and **RLS / SQL** (tenant isolation
via `withTenantTransaction`). The UI only reflects permissions — it is never the
authority.
