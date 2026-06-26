# Pierre Employee 360 Model (P8.2)

Relational (NOT a JSONB blob). Root identity `pierre_rt_employees` + satellites:

- Identity/employment fields on the root: employee_number, first/last/preferred_name,
  birth_date, nationality, professional/personal_email, phone, department, team,
  job_title, job_family, cost_center, location_mode, hire/seniority/probation/expected_end/
  termination dates, status, sensitivity, version, search_text.
- `pierre_rt_employee_employments` — employment_type, legal_employer, site, manager,
  dates, working_time_basis, weekly_hours, classification, collective/payroll_reference.
- `pierre_rt_employee_contracts` + `..._contract_versions` — contract_type
  (CDI_FULL_TIME … OTHER), per-version effective_from/to, signature_status, validated_by.
- `..._contact_methods`, `..._addresses`, `..._emergency_contacts`.
- `..._manager_assignments`, `..._site_assignments`.
- `..._documents`, `..._document_requirements` (completeness inputs).
- `..._events`, `..._notes`, `..._tags`, `..._status_history`, `..._custom_fields`.
- `..._sensitive_data` (+ `..._sensitive_access_log`) — isolated, see retention doc.
- `..._missions`, `..._tasks` — links to the governed runtime.

## Service surface (P8.2-C — `employees.ts`)
`patchEmployee` (optimistic `version`, rebuilds `search_text`, site-scope checked on
move), `archiveEmployee`/`reactivateEmployee` (writes `..._status_history`),
`employeeTimeline` (events ∪ status history), `listContracts`/`createContract`/
`addContractVersion`, `listDocuments`, `listAbsences`/`createAbsence` (date-validated),
`employeeMissions`/`employeeTasks`, `employeeAccessLog` (`audit.read`), and the
sensitive read/write (audited). Full route surface under
`/api/pierre/v1/employees/:id/*`. Proven in `p82c-operational.itest.ts` §6.

## Completeness
`computeEmployeeCompleteness` produces an explainable score from identity, site,
manager, employment, contract and mandatory-document rules → completeness_score,
missing_items, blocking_items, warnings, next_actions, last_calculated_at.

## Search (P8.2-C — typo-tolerant)
`search_text` (accent-stripped, lowercased, app-maintained, now incl. department/team/
external_ref/site/manager tokens) + index on (company_id, search_text). Two engines in
`employee-search.ts`: when `pg_trgm` is present (server Postgres), a GIN-backed `%`
similarity search (accent + typo tolerant); otherwise an order-independent token-AND
substring match ("nom prénom" == "prénom nom") plus a JS trigram re-rank that tolerates
a single-letter typo. Proven (Hélène/helene, Émard/Emard, inverted order, one-letter
typo, 10k scale) in `p82c-operational.itest.ts` §9 and the import-scale bench.

## CSV import (P8.2-C — `employee-import.ts`)
`previewImport` → `commitImport` → `rollbackImport`, staged in
`pierre_rt_employee_import_batches`/`..._rows`. Robust parser (BOM, `,`/`;`/tab,
quoted fields, embedded newlines, accents), header mapping, per-row validation,
configurable dedup (employee_number / professional_email / external_ref / name),
internal + existing duplicate detection, idempotency key (safe rerun), explicit
`allow_partial`, and full batch rollback. Routes
`POST /employees/import/preview|commit`, `GET /employees/import/:batchId`,
`POST /employees/import/:batchId/rollback`. Proven in `p82c-operational.itest.ts` §7
and `employee-import-scale.bench.ts` (10k rows).

## Status lifecycle
candidate → preboarding → active → (absent_long_term | suspended | notice_period |
leaving) → exited → archived (history in `..._status_history`).
