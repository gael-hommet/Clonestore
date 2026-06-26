# Pierre Queue & Idempotency (P8.1)

## Durable queue (`pierre_rt_jobs`, `queue.ts`)

A PostgreSQL-backed durable queue. No in-memory queue, no browser dependency.

- **Claim** — `FOR UPDATE SKIP LOCKED` over runnable jobs, then lease only those
  within the per-tenant concurrency cap (window function over locked rows +
  currently-leased count). Concurrent workers never claim the same job.
- **Lease + heartbeat** — `lease_owner` + `lease_expires_at`; `heartbeat()` extends
  a lease the worker still holds.
- **Retry** — on failure, `attempts++`; if attempts remain → `status='retry'` with
  `run_after = now() + backoff(attempts)` (exponential + jitter); else dead-letter.
- **Dead-letter** — `pierre_rt_dead_letters`; the task is failed/escalated.
- **Stale-lease recovery** — `recoverStaleLeases()` returns expired leases to
  `retry`/`ready`. Guarantees no task stays leased forever (a crashed worker's job
  is reclaimed). Proven in tests.
- **Fairness** — per-tenant concurrency cap; global batch cap; priority ordering.

## Idempotency (everywhere)

- **Mission create** — deterministic `idempotency_key` (or caller-supplied); a
  unique `(company_id, idempotency_key)` index + an idempotency store
  (`pierre_rt_idempotency`) make duplicate creates return the same mission, never a
  second one. Proven under concurrent `Promise.all` duplicates.
- **Enqueue** — `(company_id, dedup_key)` unique → re-enqueue is a no-op.
- **Validation decisions** — deciding an already-decided validation returns its
  state, never re-applies.
- **Worker execution** — claim is atomic; completion/fail check `lease_owner`;
  re-running a job after lease recovery does not double-execute business effects.
- **Outbox** — `(company_id, dedup_key)` unique; an external effect is prepared once.

## Anti-double-execution checklist (tested)

double create · repeated request · retry · worker relaunch · expired lease ·
two concurrent workers · per-tenant cap. Result: zero double business execution in
the local integration suite.

## Honest limits

PGlite is single-connection: SKIP LOCKED *correctness* (disjoint claims, no
re-claim of leased rows, cap enforcement) is proven; true OS-level parallel racing
must be re-verified on a multi-connection server Postgres (staging).
