# PHASE 8.3-B2F — Foreign-Key & Cross-Tenant Integrity Matrix

Authoritative inventory of the cross-table relations in the `pierre_rt_*` schema, the
tenant-safety decision for each, and the DB-level mechanism that enforces it. Generated from
the **real** post-migration schema (PGlite, `pg_constraint`/`pg_index` introspection), not
from source reading. This document records decisions; the behavioural proof lives in
`test:phase8-3-b2f` and `scripts/check-p83-b2f-historical-data-preflight.mjs`.

## Mechanisms

A relation `child(fk) → parent(id)` between two tenant tables (both carry `company_id`) is a
**cross-tenant gap** if the FK is on `id` alone: nothing stops a child in company A from
pointing at a parent in company B. Three mechanisms close such gaps:

| Mechanism | When used | Effect |
|---|---|---|
| **(a) Composite FK** `(company_id, fk) → parent(company_id, id)` | owned / `CASCADE` relations on the document·template·contract·custom-field·file spine | a cross-tenant reference simply cannot be stored; orphan + tenant safety in one constraint |
| **(b) Cross-tenant guard trigger** `pierre_rt_assert_fk_same_company(target, col)` | soft `ON DELETE SET NULL` references and employee-360 satellites, where a composite FK would force `RESTRICT` and break the intended soft-delete semantics | fail-closed same-tenant check on `INSERT`/`UPDATE`; delete semantics unchanged |
| **(c) Pre-existing composite FK** (v6/v7) | document/version/signature spine | already tenant-bound before B2F |

Prior work: **v6/v7** added composite FKs `(company_id, fk)` for `documents → employee/site/contract/mission/task`, `document_versions → document/files/template_version`, `signature_* → request/file`, `document_links → document`, `contract_versions → document_version`. B2F closes the remainder.

## B2F migration `2026-06-19__pierre_v12_fk_matrix_integrity.sql`

### (a) Composite FKs added — critical spine (CASCADE preserved, now tenant-bound)

| Child (fk) | Parent | ON DELETE | Constraint |
|---|---|---|---|
| `document_template_versions(company_id, template_id)` | `document_templates` | CASCADE | `fk_tplver_template_ct` |
| `template_approvals(company_id, template_version_id)` | `document_template_versions` | CASCADE | `fk_tplappr_version_ct` |
| `template_fields(company_id, template_version_id)` | `document_template_versions` | CASCADE | `fk_tplfield_version_ct` |
| `employee_custom_fields(company_id, employee_id)` | `employees` | CASCADE | `fk_ecf_employee_ct` |
| `employee_contracts(company_id, employee_id)` | `employees` | CASCADE | `fk_contract_employee_ct` |
| `employee_contract_versions(company_id, contract_id)` | `employee_contracts` | CASCADE | `fk_cv_contract_ct` |
| `document_access_log(company_id, document_id)` | `documents` | CASCADE | `fk_dal_document_ct` |
| `file_scan_results(company_id, file_id)` | `files` | CASCADE | `fk_fsr_file_ct` |
| `file_integrity_checks(company_id, file_id)` | `files` | CASCADE | `fk_fic_file_ct` |

Parent composite unique keys added where missing: `employees(company_id,id)`,
`employee_contracts(company_id,id)` (the others already had a unique index from v6/v10).

### (b) Cross-tenant guard trigger — soft refs + employee-360 satellites

Soft references kept `ON DELETE SET NULL` (a composite FK would force `RESTRICT`):
`document_template_versions.source_file_id → files`, `employee_contracts.document_id → documents`,
`employee_contracts.parent_contract_id → employee_contracts`, `documents.owner_membership_id → members`.

Employee-360 satellites guarded (`employee_id → employees`, keep `CASCADE` FK for orphan
protection, trigger adds the tenant binding): `addresses, contact_methods, emergency_contacts,
employments, notes, events, status_history, document_requirements, sensitive_data,
sensitive_access_log, site_assignments, manager_assignments, absences`.

## Relations intentionally left as-is

| Relation class | Decision | Rationale |
|---|---|---|
| `child(company_id) → companies(id)` | keep simple CASCADE | the tenant root; `company_id` is the tenant itself — no cross-tenant notion |
| `role_permissions / membership_roles → roles/permissions(key)` | keep simple CASCADE | global reference tables (not tenant-scoped) |
| Runtime tables `events/jobs/execution_attempts/validations/task_deps → missions/tasks` | RLS + worker-bound tenant context | written only by the tenant-bound worker/service; cross-tenant is RLS-impossible; guarded uniformly by `withTenantTransaction`. High write-volume — left off the per-row trigger to protect worker throughput. Tracked, not a B2F blocker. |
| `member_sites / membership_*_roles → members/sites/roles` | RLS-guarded | membership graph, P8.2 domain |

These are **documented decisions**, not omissions: each is tenant-safe under RLS + the
service layer today; the historical preflight (below) covers them if they ever drift.

## Delete-semantics guarantees (never a blind cascade on evidence)

- **Audit / trace / approval / outbox** are never cascade-deleted by a tenant action. The
  template audit is append-only with `ON DELETE NO ACTION` FKs (v10); a published or
  document/contract-referenced template version **cannot** be hard-deleted (v10 triggers).
- **Finalized / signed** document versions and the files behind them are `RESTRICT`-protected
  (v6/v7) and legal-hold guarded in the service.
- **Signatures / evidence** cascade only within their own request aggregate; the evidence
  *file* is `RESTRICT`.

## Historical-data preflight

`src/lib/pierre/v1/data-integrity-preflight.ts` (runner: `check:p83-b2f-preflight`) is a
read-only scan that verifies these invariants on real data BEFORE the constraints are trusted:
cross-tenant custom-field / contract / template-version / document-version / document-file,
orphan signature request, duplicate object key, finalized-artifact-not-clean,
clean-file-without-hash, published-template-without-timestamp (blockers); custom-field
without/with-mismatched definition, webhook-request cross-company, signed-without-timestamp
(warnings). It mutates nothing and exits non-zero on any blocker.
