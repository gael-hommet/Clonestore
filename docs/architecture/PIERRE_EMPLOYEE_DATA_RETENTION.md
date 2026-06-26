# Pierre Employee Data & Retention (GDPR) (P8.2)

## Sensitive data isolation
Sensitive categories (compensation, medical, disability, disciplinary, conflict,
report, official_id, bank_details, protected_note) live in a dedicated table
`pierre_rt_employee_sensitive_data`, behind a dedicated permission
(`employee.sensitive.read/write`). Ordinary managers are excluded.

- Every read is audited in `pierre_rt_employee_sensitive_access_log` (category + actor,
  NEVER the value).
- Values are opaque (`value_encrypted`); production encrypts at rest (KMS/pgcrypto).
- Sensitive values must never appear in general logs or the timeline
  (`assertNoSensitiveInLogPayload` defends against accidental leakage).

## Retention / GDPR fields
On `pierre_rt_employees`: `retention_until`, `legal_hold`, `anonymized_at`.
Tenant-wide access journal: `pierre_rt_data_access_log`.

## Operations (P8.2-C — implemented in `src/lib/pierre/v1/gdpr.ts`)
- `exportEmployee` (subject access; sensitive VALUES gated by `employee.sensitive.read`,
  otherwise only categories) and `exportCompany` (`gdpr.admin`).
- `setLegalHold` — `legal_hold = true` blocks BOTH anonymization and purge.
- `anonymizeEmployee` — pseudonymizes identity (`Anonymisé #<id8>`), nulls emails/
  phone/number/external_ref, erases contact methods / addresses / emergency contacts /
  sensitive data / custom fields, redacts notes; keeps legally-required aggregates
  (employments, contracts, status history). Idempotent.
- `deleteDocument` — single-document erasure (blocked under legal hold).
- `purgeEmployee` — physical delete; refused before `retention_until` unless an
  explicit `legal_reason` is supplied; audited BEFORE the delete.
- `dataAccessAudit` — the tenant-wide GDPR access journal (`audit.read`).

Routes: `POST /employees/:id/export|anonymize|legal-hold`,
`DELETE /employees/:id/documents/:documentId`, `POST /company/export`,
`GET /audit/data-access`. Each operation writes to `pierre_rt_data_access_log`;
no sensitive value is ever written to a log. Proven in
`src/lib/pierre/v1/__integration__/p82c-operational.itest.ts` (§8).

## Honest limit
The services + routes are implemented and locally integration-tested against real
Postgres. A scheduled background retention job (cron that purges past
`retention_until`) is operationally a thin wrapper over `purgeEmployee` and is the
one piece not wired to a scheduler here; production encryption-at-rest of
`value_encrypted` (KMS) is a deployment concern, not proven in this sandbox.
