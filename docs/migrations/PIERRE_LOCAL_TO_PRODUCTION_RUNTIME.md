# Migration — Local → Production Runtime (P8.1)

## Principle

P8.1 introduces ONE canonical governed runtime (`pierre_rt_*` + `src/lib/pierre/v1`).
The legacy localStorage "controlled missions" model (Phase 5–7) is **deprecated as a
source of truth** and must not be used by new runtime code. The existing `pierre_*`
tables and the current `submit` path remain **intact** and will be migrated onto the
v1 runtime in a later block.

## Reuse / replace / deprecate / migrate / intact

| Decision | Items |
|---|---|
| Reuse | `pierre_*` legacy tables (unchanged), CloneGuard concepts, service-role pattern |
| New canonical | `pierre_rt_*` schema + `src/lib/pierre/v1/**` |
| Deprecate (source of truth) | `clonestore.runtimeControlledMissions.local.v1` (localStorage), Phase 5–7 read-only gates (kept for governance/demo) |
| Migrate later | legacy `submit` → v1 `createMission`; legacy `pierre_missions/tasks` → `pierre_rt_*` (out of P8.1 scope) |
| Intact | all existing routes, billing/checkout, CloneOS/AI/cost-ledger, P5–P7.6 modules |

## Applying the schema

### Local / test (PGlite, programmatic, real Postgres 16)
```
npm run db:test:reset        # fresh DB + migration at ./.pglite-data
npm run db:test:migrate      # idempotent re-apply
npm run test:phase8-1        # 23 integration tests vs that DB (in-memory per test)
```

### Staging / production (Supabase, operator action)
```
DATABASE_URL=postgres://...  npm run db:migrate:pg
```
or paste `supabase/migrations/2026-06-15__pierre_v1_runtime.sql` into the Supabase
SQL Editor (the legacy manual flow). The migration is idempotent
(`create table if not exists`, `do $$` guards, `drop policy if exists`).

> **Honesty:** applying to your real Supabase project is a deliberate operator step.
> Production application / RLS enforcement / p95 / 100k scale are **not proven** by
> this repo and must be verified on the real project with load + isolation tests.

## Cockpit cutover (P8.1 completion pass)

- **Production `pg` adapter** is now a real `dependency` (`pg@^8`, `@types/pg`),
  static-imported in `src/lib/pierre/v1/db.ts` with a singleton pool, SSL, and
  connection/statement timeouts. No dynamic-import masking. Build resolves it.
  Adapter error handling (invalid URL → fast typed error, no secret leak, no
  reconnect loop) is tested.
- **Canonical write seam** — `src/lib/pierre/cockpit/v1-bridge.ts` + the cockpit
  `submitPierreMission` now writes through `/api/pierre/v1/missions` (idempotent)
  when `NEXT_PUBLIC_PIERRE_RUNTIME_V1=1`. The legacy `/api/pierre/use/submit` is
  `@deprecated` (fallback only). The full cockpit data flow (create / read / tasks
  / timeline / validations / approve / double-click no-duplicate / cross-tenant
  denied / refresh-preserves / worker-continues) is **proven against real Postgres**
  in `src/lib/pierre/v1/__integration__/cockpit-dataflow.itest.ts`.
- **PRODUCTION FLIP DEPENDENCY (honest):** the v1 runtime resolves tenants from
  `pierre_rt_members`, which is **populated by PHASE 8.2** (Enterprise Tenancy/RBAC).
  Until then the flag defaults **OFF** so the live cockpit is not broken (a flip with
  no membership rows would 403 every user). The cutover is code-complete and one flag
  away; the production flip belongs with P8.2.

## Guardrails added

- The check script (`check:pierre-production-runtime-core`) fails if the v1 runtime
  references `localStorage` or an in-memory queue, if routes/migration are missing,
  or if an integration-pending executor could report `succeeded`.
- `.pglite-data/` is git-ignored.
