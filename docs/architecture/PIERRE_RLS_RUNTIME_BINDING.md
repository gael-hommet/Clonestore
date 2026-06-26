# Pierre RLS Runtime Binding (P8.2)

A manual RLS test is NOT proof. The runtime binds every tenant business operation
to the tenant under the **non-superuser** application role so Postgres RLS actually
enforces isolation.

## withTenantTransaction(db, {company_id, user_id}, callback)
```
BEGIN
SET LOCAL ROLE pierre_rt_app            -- non-owner, NO BYPASSRLS
select set_config('app.current_company', <id>, true)   -- tx-local GUC
select set_config('app.current_user',    <id>, true)
<callback queries run here, under RLS>
COMMIT   (ROLLBACK on throw)
```
`SET LOCAL` and `set_config(..., true)` are transaction-scoped, so neither the role
nor the GUCs leak across reused pooled connections.

## Coverage (P8.2-C) — every tenant business path
All mission/validation handlers (`apiCreateMission`, `apiListMissions`, `apiGetMission`,
`apiGetMissionTasks`, `apiGetMissionTimeline`, `apiCancelMission`, `apiListValidations`,
`apiDecideValidation`) and the **durable worker** run inside `withTenantTransaction`.
The worker's `claimJobs` is a global scheduler op (service role, justified), but each
claimed job is *processed* bound to its own tenant — so the binding covers the entire
job lifecycle (task transitions, executor, outbox, aggregation). Members/invitations/
roles/sites/Employee-360/import/GDPR handlers are likewise RLS-bound; the only
service-role exceptions are identity resolution, invitation acceptance (token-authorized),
migrations and backfill.

## Proven (integration, real Postgres)
- callback runs as `pierre_rt_app` (not the superuser/service role);
- tenant A then tenant B on the same connection — no leak;
- GUC + role reset after the tx (no retention);
- failed tenant tx rolls back, connection still usable;
- a query that FORGETS `where company_id` still returns only the bound tenant's rows;
- a worker bound to tenant A cannot update tenant B's job (RLS → 0 rows);
- the worker processes BOTH tenants in one drain, each under its own binding, with no
  cross-tenant event contamination (`p82c-operational.itest.ts` §1).

## Role policy
- **service/superuser role** — migrations, tenant resolution (identity), explicit
  system/admin tasks only.
- **`pierre_rt_app`** — all per-tenant business reads/writes (RLS-enforced).
- Production: grant `pierre_rt_app` to the app DB user (`grant pierre_rt_app to <user>`)
  so `SET LOCAL ROLE` succeeds; the app user must not have BYPASSRLS.

## Honest limit
Proven locally against PGlite (single connection). Production RLS enforcement and
true multi-connection concurrency must be re-verified on a server Postgres (staging).
