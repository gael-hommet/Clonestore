# PHASE 8.5 — Governed Autonomous Runtime (locally verified)

Durable missions become replayable **runs** compiled from an **immutable plan version** into typed
**step runs**, each executed by exactly one durable **runtime job** under a claim + lease + heartbeat
worker carrying a monotonic **fencing token**. Steps wait durably (timer / approval / external event);
a scheduler fires due waits & bounded relances; a recovery sweeper reclaims expired leases. Migration
`supabase/migrations/2026-06-30__pierre_v22_governed_autonomous_runtime.sql` (v1→v22, idempotent,
non-destructive). **NOT applied to production by this work (operator checkpoint).**

## What was built (reuse-first, per the cold-audit matrix)
- **Reused**: `pierre_rt_missions`/`pierre_rt_tasks` (rollup + plan unit), `pierre_rt_validations`
  (approval waits), `pierre_rt_outbox` (wakeup bus, +`rt_processing_status`), the v20
  `communication_deliveries` lease column-set (template), `pierre_rt_events`/`pierre_rt_dead_letters`
  (extended). No duplication of mission/task semantics.
- **New tables**: `mission_plan_versions`, `mission_runs`, `step_runs` (+`step_deps`), `runtime_jobs`
  (+`fencing_token`), `runtime_job_attempts` (append-only), `runtime_waits`, `runtime_checkpoints`
  (append-only), `runtime_schedules`, `runtime_events` (idempotent ingestion ledger).
- **New roles**: `pierre_rt_runtime_scheduler`, `pierre_rt_runtime_worker` — least-privilege; the
  worker holds NO grant on a business table; truth functions are revoked from `pierre_rt_app`.
- **The decisive fix — fencing token**: no prior claim family (`pierre_rt_jobs`,
  `communication_deliveries`, `signature_events`, `contract_activation_tasks`) had one. Every runtime
  mutator asserts `fencing_token` + `locked_by` + lease, with a terminal-state idempotent early-return
  *before* any raise. The recovery sweeper bumps the generation and records the superseded one.
- **TS**: `runtime-action-registry` (closed, typed; no generic/arbitrary action), `runtime-plan-compiler`
  (DAG, fingerprint, refuses cycle/unknown/sensitive-without-gate/unbounded), `runtime-service`
  (create-run + worker loop), `runtime-scheduler` (recovery + timer/event resolution + bounded relances),
  `runtime-action-handlers` (safe-apply via governed services only), dedicated `runtime-worker-db` /
  `runtime-scheduler-db` / `runtime-system-auth` (fail-closed), system routes (`/api/internal/pierre/
  runtime/tick`, `/scheduler`) + the authenticated mission runtime route.
- **Never bypassed**: email → emit outbox + `createCommunicationIntents`/`dispatchCommunicationDeliveries`
  (P8.4); signature → P8.3 governed services; no direct provider call, no raw `UPDATE` on
  employees/contracts/signatures.

## Proven (`npm run test:phase8-5` — 12 files / 36 tests; tsc 0)
DAG → completion · plan idempotency · cycle/unknown-action refusal · **fencing** (stale generation
rejected, current finalizes, sweeper bumps + records superseded, two-worker no-double) · role isolation
(worker/scheduler refused on business tables; app cannot execute truth fns nor fabricate a job) · durable
waits + resume (timer via scheduler, external event via ingestor with exact match + replay idempotency,
approval with fingerprint gate) · P8.4 communication integration (no direct send) · bounded relances with
typed stop-condition · retry → dead-letter · reconcile (no blind retry) · pause/resume/cancel · crash
recovery (re-execute exactly once) · v22 applies + idempotent + tenant-safe FKs/RLS.

## Honest deferred items (NOT closed; follow-ups)
- **Approval→outbox bridge**: `decideValidationAction` emits a mission event, not an outbox/runtime
  event. The approval-wait resolution primitive is proven (fingerprint-gated), but a production bridge
  that auto-resolves an approval wait on a real validation decision is a follow-up.
- **`communication.delivered` wakeup**: no such outbox kind exists; a wait-for-delivery would need a
  callback/outbox kind (design decision deferred).
- **Contract-activation ownership bypass** (pre-existing P8.3 hazard: `complete/fail` take no
  `p_worker`) is flagged for a follow-up hardening; the runtime does not extend it.
- **External activation (real worker/scheduler DSNs, real Resend, real Yousign, cron)** is P8.7 — the
  fail-closed executors 503 until DSNs are provisioned; not exercised here.
- PGlite single-connection: role isolation is proven via `set local role`; true OS-parallel races are
  logical-local proofs.
