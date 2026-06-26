# PHASE 8.2 — Enterprise Tenancy, RBAC, Sites & Employee 360 Production Data Model

Builds the real multi-tenant ownership model on top of the P8.1 runtime, migrates
legacy per-user ownership into it, and flips the cockpit to v1 by default.

## What is real and proven (locally, vs real PostgreSQL 16 via PGlite)

`test:phase8-2` (+ the full `test:phase8-1` suite, now 52 integration tests) prove:

- **Canonical tenancy backfill** — `pierre_rt_backfill_tenancy()` maps the legacy
  per-user ownership (orders `status in ('active','trialing')` — same rule as the
  legacy `hasPierreAccess` — ∪ `agents_owned`) into **one company + one owner
  membership per historical owner** (deterministic `company_id = user_id`).
  **Idempotent** (re-run creates 0, no duplication), **safe when legacy tables are
  absent** (`to_regclass` guards).
- **Default active company** — `resolveDefaultCompanyId` returns the user's single
  membership, so a migrated single-tenant user needs no explicit company header;
  un-migrated users resolve to `null` (cockpit falls back to legacy — nobody broken).
- **RBAC, two axes** — role → permitted actions (owner/admin/hr_manager/hr_operator/
  viewer, now incl. `employee.*`/`site.*`/`tenancy.admin`) **and** site scope
  (`pierre_rt_member_sites`): a site-scoped member only sees their sites' employees.
  Proven (scoped list returns only in-scope; viewer cannot write).
- **Sites** — `pierre_rt_sites` + repo/service (tenant + scope gated).
- **Employee 360** — `pierre_rt_employees` (+ events, documents-metadata, absences);
  `getEmployee360` aggregates the employee with recent events/documents/absences.
  Missions reference employees/sites via FKs (`not valid`, safe on existing rows).
- **RLS isolation** — forced on every new table; tenant A cannot read tenant B's
  employees/sites under the restricted `pierre_rt_app` role (proven).
- **Single canonical write path** — a new mission persists only to `pierre_rt_*`
  (proven); cockpit `submitPierreMission` now defaults to v1 (`/api/pierre/v1/missions`)
  with a migration-safe legacy fallback only for not-yet-backfilled accounts.

## Routes added

`/api/pierre/v1/sites` (GET/POST) · `/api/pierre/v1/employees` (GET/POST) ·
`/api/pierre/v1/employees/[id]` (360) · `/api/pierre/v1/admin/backfill` (token).

## Local benchmark (NOT production)

`bench:pierre-runtime-core` (now includes the P8.2 bench): backfill throughput
(owners/s), tenant-resolution p95, employee-list p95 — local PGlite single
connection, not production figures.

## Commands

```
npm run db:test:reset                       # apply v1 + v2 migrations to local PGlite
npm run test:phase8-2                        # tenancy/RBAC/Employee360 vs real Postgres
npm run check:pierre-tenancy-rbac-employee360
npm run db:backfill                          # local backfill (no-op without legacy tables)
DATABASE_URL=... npm run db:backfill:pg      # production backfill (operator action)
```

## Cockpit flip

`NEXT_PUBLIC_PIERRE_RUNTIME_V1` now defaults **ON** (set `"0"` to force legacy).
Rollout: apply v2 migration → run `db:backfill:pg` (seeds `pierre_rt_members`) →
migrated accounts use v1; not-yet-migrated accounts transparently fall back to the
deprecated legacy path. Once backfill covers all owners, the legacy path is dead.

## Honest limits (not faked)

- production Supabase application of v2 + backfill: **not done here** (no live DB);
  the migration + backfill are idempotent and ready (`db:migrate:pg` + `db:backfill:pg`).
- production RLS / p95 / 100k scale: **not proven** (local PGlite, single connection).
- true OS-parallel concurrency must be re-verified on a server Postgres (staging).

## Next

PHASE 8.3 — connect real channels/executors (email, documents, files, calendar)
to the governed runtime, replacing the `awaiting_integration` executors with real
providers behind CloneGuard + outbox.
