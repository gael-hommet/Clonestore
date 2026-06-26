# Pierre V1 Production Cutover (P8.2 / P8.2-C)

V1 (`/api/pierre/v1/*`, pierre_rt_*) is the DEFAULT runtime
(`NEXT_PUBLIC_PIERRE_RUNTIME_V1 !== "0"`). The server derives the active company
from the user's membership (`resolveDefaultCompanyId` / `resolveActiveCompany`); the
company header is an intent, never authority. As of P8.2-C, EVERY tenant business
path — missions, validations and the durable worker — runs inside the real RLS
binding (`withTenantTransaction`: `SET LOCAL ROLE pierre_rt_app` + tx-local
`app.current_company`/`app.current_user`). The worker claims globally (a scheduler
op) but processes each job bound to that job's tenant, so a worker that picked up
tenant A can never mutate tenant B (proven: 0 rows).

## Rollout sequence
1. `db:migrate:pg` — apply v1+v2+v3+v4 migrations to Supabase (v4 adds custom-role
   permissions, multi-company preference, CSV import batches, and the `pg_trgm` GIN
   index when the extension is available).
2. `db:backfill:pg` — seed `pierre_rt_companies` + owner `pierre_rt_members` from the
   legacy per-user ownership (idempotent).
3. With memberships present, migrated accounts use v1 automatically.
4. During rollout only, set `NEXT_PUBLIC_PIERRE_ALLOW_LEGACY_EMERGENCY_FALLBACK=true`
   so not-yet-migrated accounts (`tenant_not_migrated`) keep working on legacy.
5. Once backfill covers all owners, set it back to **false** (default) — legacy is
   then forbidden in normal operation (see PIERRE_LEGACY_DECOMMISSION.md).

## Fallback policy (strict)
The cockpit falls back to legacy ONLY on the explicit `tenant_not_migrated` code AND
only when the emergency flag is on. It NEVER falls back on `tenant_access_denied`,
`forbidden`, `membership_suspended`, `company_suspended` — those are real
authorization results and must surface.

## Cockpit reads + writes (P8.2-C)
The cockpit reads AND writes through v1 only, via the single `callV1` seam:
`submitPierreMission` (write), `fetchPierreMission`, `fetchPierreHistory`,
`fetchPierreMissionTasks`, `fetchPierreMissionTimeline`, `fetchPierreMissionValidations`,
`fetchPierreWorkerState`, and the decision lifecycle
`approve/reject/requestChanges/cancelMission`. The legacy task functions are
`@deprecated` and any legacy touch emits a `pierre:legacy-fallback` metric/alert.

## Proven (headless, real Postgres)
- `cockpit-dataflow.itest.ts` drives the typed client through the route layer:
  create/read/tasks/timeline/validations/approve/double-click-no-dup/cross-tenant-403/
  refresh-preserves/worker-continues.
- `p82c-operational.itest.ts` proves the mission/validation/worker RLS binding plus
  the full operational surface (invitations, lifecycle, custom roles, multi-company,
  sites CRUD, Employee 360 services, CSV import, GDPR).

## Honest limit
Browser-level rendering of the Employee 360 UI + the cockpit panels, and Playwright
execution, are NOT run in this sandbox (no headless browser / app server / auth
session, and `@playwright/test` is not installed). The Employee 360 UI
(`src/app/agents/pierre/employees/page.tsx`) compiles and builds; the complete
Playwright spec (`e2e/pierre-employee-360.spec.ts`, 18 real steps) is delivered to run
in CI/staging. Production Supabase apply + 100k scale remain unproven (local PGlite,
single connection).
