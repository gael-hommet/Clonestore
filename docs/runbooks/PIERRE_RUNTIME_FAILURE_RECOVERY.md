# Runbook — Pierre Runtime Failure & Recovery (P8.1)

Every failure is typed, logged, traced, recoverable, and never loses the mission.

## Worker crash (mid-execution)

- Symptom: jobs stuck in `leased` with an expired `lease_expires_at`.
- Recovery: `recoverStaleLeases()` (also run by `/api/pierre/v1/worker/tick`) returns
  them to `retry`/`ready` → reclaimed by any worker. No task stays leased forever.
- Verify: `select status, count(*) from pierre_rt_jobs group by status;` — `leased`
  with past `lease_expires_at` should drop to 0 after recovery.

## Repeated execution failure

- Backoff retries (exponential + jitter) up to `max_attempts`, then dead-letter
  (`pierre_rt_dead_letters`) and task → `failed`/`escalated`.
- Inspect: `select reason, count(*) from pierre_rt_dead_letters group by reason;`

## Duplicate request / double click

- Idempotency keys make create/decide/enqueue safe. No duplicate mission/effect.

## Validation expired

- A `pierre_rt_validations` row past `expires_at` should be treated as `expired`;
  the task remains gated (never auto-approved).

## Stuck task

- No task should remain `in_progress`/`leased` indefinitely: lease expiry + recovery
  + `max_attempts` + aggregation guarantee progress to a terminal/blocked/escalated
  state. If one is stuck, check its latest `pierre_rt_events` and execution attempts.

## Partial mission failure

- Aggregation sets the mission to `partially_completed` when some tasks succeeded and
  some failed; the mission is preserved for manual follow-up, not lost.

## Tenant isolation incident

- RLS is forced. If a non-service path can read another tenant's rows, treat as a
  Sev-1: confirm the connection role is `pierre_rt_app` (not service) and that
  `app.current_company` GUC is bound per transaction.

## Backpressure / overload (future)

- Per-tenant concurrency caps + priority limit one tenant's footprint. Load shedding,
  circuit breakers and queue partitioning are planned for scale phases; not yet load-
  tested. Do not declare scale-ready without load tests.
