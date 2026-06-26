# Pierre Legacy Decommission Plan (P8.2)

## Status (P8.2-C)
- `/api/pierre/use/submit` (legacy mission write to `pierre_*`) is `@deprecated`.
- Cockpit **writes AND reads** route to v1: `submitPierreMission` (write),
  `fetchPierreMission`, `fetchPierreHistory`, `fetchPierreMissionTasks`,
  `fetchPierreMissionTimeline`, `fetchPierreMissionValidations`, `fetchPierreWorkerState`,
  and the decision lifecycle `approve/reject/requestChanges/cancelMission` — all through
  the single `callV1` seam onto `/api/pierre/v1/*`.
- Legacy is an emergency-only fallback (default OFF), permitted solely on the explicit
  `tenant_not_migrated` code — never on 403 / suspended / cross-tenant.
- Any legacy touch fires a metric/alert: `recordLegacyFallbackUsed` logs a warning and
  dispatches a `pierre:legacy-fallback` window event for dashboards/alerting.

## Steps
1. Apply migrations + backfill in production (`db:migrate:pg`, `db:backfill:pg`).
2. Keep `NEXT_PUBLIC_PIERRE_ALLOW_LEGACY_EMERGENCY_FALLBACK=true` only until backfill
   covers every owner; monitor `pierre:legacy-fallback` (it should trend to zero).
3. Set the flag to **false** (default). Legacy is now forbidden in normal operation.
4. Cockpit READS repointed to v1 (mission list/detail/tasks/validations/timeline). ✅ Done.
5. Migrate legacy `pierre_missions`/`pierre_tasks` history into `pierre_rt_*` (or expose
   read-only, clearly labelled). [planned — data backfill, not a code gap]
6. Remove the legacy `submit` route + legacy cockpit task functions once usage is zero
   and history is migrated.

## Guards (tests)
- cockpit hook/page never POST the legacy submit directly;
- fallback only on `tenant_not_migrated` + explicit flag;
- no fallback on 403 / suspended / cross-tenant;
- new missions write only to `pierre_rt_*`.

## Honest limit
The code-level decommission is complete: reads + writes route to v1, the metric/alert
hook is wired, and the legacy task functions are `@deprecated` + alerted. What remains
is operational, not code: applying the migration/backfill to production Supabase,
watching the `pierre:legacy-fallback` signal trend to zero, then physically removing the
legacy route + functions and migrating historical `pierre_*` rows. Browser-level
rendering of the repointed cockpit is not executed in this sandbox (no headless browser).
