# PHASE 8.1 — Pierre Production Runtime Core

Real persistent, governed, multi-tenant execution runtime. This is the foundation
of the final product — not a read-only gate, not a localStorage simulation.

## What is real and proven (locally)

The canonical runtime lives in `src/lib/pierre/v1/**` and is backed by Postgres
(namespace `pierre_rt_*`). It is **integration-tested against a real in-process
PostgreSQL 16 (PGlite)** — 23 integration tests + a benchmark, all green.

- **Real persistent missions & tasks** — `pierre_rt_missions`, `pierre_rt_tasks`
  (+ dependencies), not localStorage, not in-memory arrays.
- **Real multi-tenancy** — canonical `TenantContext` resolved server-side from
  `pierre_rt_members`; cross-tenant access denied; **RLS enabled + forced** and
  proven via a restricted role in tests.
- **Real governed state machine** — single source (`state-machine.ts`); no route
  changes a status with a bare UPDATE; optimistic concurrency (version) enforced.
- **Real human validations** — `pierre_rt_validations`; approve unlocks + queues,
  reject cancels, idempotent decisions.
- **Real durable queue** — `pierre_rt_jobs` with `FOR UPDATE SKIP LOCKED` claim,
  leases + heartbeats, exponential backoff + jitter, dead-letter, stale-lease
  recovery, per-tenant concurrency caps.
- **Real worker** — `worker.ts` (+ `/api/pierre/v1/worker/tick`): claims, runs the
  governed executor lifecycle, persists results/attempts/trace, retries / dead-
  letters / aggregates. Survives crashes (lease expiry → recovery). No browser.
- **Real idempotency** — `pierre_rt_idempotency` + unique keys; duplicate create /
  retry / double-claim never double-execute.
- **Real CloneGuard in-path** — evaluated at plan time and at execution; black-level
  HR actions hard-blocked/escalated, never executed.
- **Real CloneTrace** — `pierre_rt_events` persistent timeline.
- **Real transactional outbox** — `pierre_rt_outbox`; integration-pending executors
  (email/document/file) return `awaiting_integration`, **never `succeeded`**.
- **Real API** — `/api/pierre/v1/missions`, `/:id`, `/:id/tasks`, `/:id/timeline`,
  `/:id/cancel`, `/:id/validations`, `/validations/:id/{approve|reject|request-changes}`,
  `/worker/tick`, `/health`.

## What is NOT proven (honest limits)

- **production Supabase verified: false** — the migration is applied to a local
  PGlite test DB (and is ready to apply to Supabase via `npm run db:migrate:pg`),
  but it has NOT been applied to a real Supabase project here.
- **production RLS verified: false** — RLS isolation is proven locally with a
  restricted role; production enforcement must be verified on the real project.
- **production p95 proven: false** — benchmark numbers are LOCAL (PGlite, single
  in-process connection), not production figures.
- **100k scale proven: false** — architecture is built for horizontal workers,
  partitioning, quotas and fairness, but scale requires real load tests.
- **true OS-parallel worker race** — PGlite is single-connection; SKIP LOCKED claim
  *correctness* (disjoint claims, no double-claim, cap) is proven, but multi-
  connection parallel racing must be re-verified on a server Postgres (staging).
- No AI provider is called in P8.1 (analysis is deterministic/rule-based by design).

## Commands

```
npm run db:test:reset                  # build the local PGlite test DB
npm run test:phase8-1                  # 23 integration tests vs real Postgres
npm run bench:pierre-runtime-core      # local p50/p95/p99 + throughput
npm run check:pierre-production-runtime-core
npm run db:migrate:pg                  # apply to DATABASE_URL (staging/prod, manual)
```

## Local benchmark (NOT production)

win32 · node v22 · PGlite (in-process PG16) · single connection:
create mission p95 ≈ 47ms, list paginated p95 ≈ 4ms, queue claim p95 ≈ 5ms,
throughput ≈ 38 tasks/s, error rate 0%.

## Migration map (reuse / replace / deprecate / intact)

- **Reuse:** existing `pierre_*` tables and submit path remain intact; CloneGuard
  concepts; service-role pattern.
- **New canonical runtime:** `pierre_rt_*` + `src/lib/pierre/v1/**` is the single
  governed runtime going forward.
- **Deprecate as source of truth:** Phase 5–7 localStorage "controlled missions"
  and read-only gates (kept for governance/demo only).
- **Intact:** all existing routes, billing/checkout, CloneOS/AI/cost-ledger, and the
  Phase 5–7.6 modules.

## Next block

PHASE 8.2 — Enterprise Tenancy, RBAC, Sites & Employee 360 Production Data Model.
