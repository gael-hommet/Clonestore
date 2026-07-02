# P8.9 — Performance & Load Architecture

Scope: prove/harden Pierre under load, **local/synthetic only**. No Production, no providers, no journey, deploy-block stays `1`. Reminder: **P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN — FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED.**

## Synthetic environment
- **PGlite** (real PostgreSQL 16 in WASM, single in-process connection) via `src/lib/pierre/v1/__integration__/harness.ts::createHarness()` — applies the real `supabase/migrations`, seeds 2 tenants (`companyA`/`companyB`). Devtime-only.
- External providers are simulated at the boundary (injected adapters / Fake providers) — no Resend/Stripe/Yousign contact.
- Single-connection caveat: raw multi-connection contention (two OS processes racing) is not reproducible on one PGlite instance; concurrency correctness is proven via **atomic primitives** (`FOR UPDATE SKIP LOCKED`, unique/dedup keys, lease fencing) exercised by sequential double-calls — the Postgres locking guarantees themselves are engine-level. Throughput/latency at scale are LOCAL indicators, explicitly labeled, extrapolated in the capacity model.

## Critical paths (audited)

| # | Path | Key code | Tables | RPC / primitive | Index | Idempotency | Concurrency risk |
|---|---|---|---|---|---|---|---|
| 1 | Mission create | `mission-service.ts` | pierre_rt_missions, _tasks, _step_deps | createMissionRunFromPlan | idx_rt_missions_company_status/_created | plan hash / dedup | dup create |
| 2 | Planning | `runtime-planner-db.ts`, planner role | runtime_jobs, step_runs | enqueueJob | idx_pierre_rt_runtime_jobs_claim | dedup_key unique | dup enqueue |
| 3 | Human validation | `validations` | pierre_rt_validations | decideValidationAction | company_id | one decision | double decide |
| 4 | Resume | worker/scheduler | runtime_jobs | claimJobs→runWorkerOnce | claim/lease idx | lease fencing | double resume |
| 5 | Document gen | `contracts.ts`, `documents.ts`, renderers | documents, _versions, files | generateContract | company_id | version hash | dup doc |
| 6 | Artifact storage | `file-storage.ts` | pierre_rt_files | finalizeUpload (integrity) | company_id | sha256 gate | temp-file leak |
| 7 | Comm intent | `communications.ts` | outbox, _intents, _recipients, _deliveries | createCommunicationIntents | dedup_fingerprint | dedup fingerprint | dup intent |
| 8 | Delivery claim | `communication-worker-db.ts` | _deliveries | pierre_rt_claim_communication_deliveries | idx_pierre_rt_comm_delivery_due | lease + skip locked | double claim |
| 9 | Retry/dead-letter | `queue.ts::failJob`, comm fail RPC | runtime_jobs, _deliveries, dead_letters | failJob / pierre_rt_fail_communication_delivery | jobs_lease idx | attempt_count/max | premature DL |
| 10 | Entitlement | bridge + `pierre_rt_apply_*` | commercial_events, product_entitlements | apply_commercial_event | commercial_events_pending/refs, entitlement_company | provider_event_id | double apply |
| 11 | Employee 360 | `employees.ts` | employees, _events, _documents | getEmployee360 | company_id + search_text | — | read-heavy |
| 12 | Cockpit list/search | `employee-search.ts`, cockpit | employees, missions | listEmployees / search | idx_rt_missions_company_created, search_text | — | agg leak |
| 13 | Scheduler | `runtime-scheduler.ts` | runtime_schedules, jobs | scheduler tick | jobs_claim idx | one-shot | concurrent tick |
| 14 | Runtime jobs | `queue.ts`, `worker.ts` | runtime_jobs, _job_attempts | claim/heartbeat/complete/fail | claim/lease idx | lease fencing | stale lease |
| 15 | Audit/events | append-only tables | events, company_access_events | emit* | company_id | append-only | — |

## Hot-path index coverage (verified in migrations)
`idx_pierre_rt_runtime_jobs_claim(status, available_at, priority desc)`, `_lease(status, lease_expires_at)`, `idx_pierre_rt_comm_delivery_due(company_id, status, scheduled_at)`, `idx_rt_missions_company_status/_created`, `idx_pierre_rt_commercial_events_pending/refs/company`, `idx_pierre_rt_entitlement_company(company_id, product_key, status)`. → The claim/queue/entitlement hot paths are indexed (no obvious seq-scan on the critical loops). Full report: `P8_9_DATABASE_PERFORMANCE_REPORT.md`.

## Critical zones (highest risk under load)
1. Queue claim fairness (one noisy tenant starving others). 2. Delivery retry→dead-letter correctness under bursts. 3. Document generation CPU/memory (renderers). 4. Tenant isolation in aggregations. 5. Stale-lease recovery. 6. Idempotency under duplicate events/webhooks.

## Benchmark strategy
- Reuse existing benches (`runtime-core.bench.ts`, `tenancy-employee360.bench.ts`, `employee-360-scale.bench.ts`) for baseline create/list/claim/throughput + tenant-resolution/list at 1k–10k.
- Add `p89-load.bench.ts`: idempotence/concurrency collisions, queue fairness/backpressure, multi-tenant isolation under load, failure injection (retry→dead-letter, stale-lease recovery), memory stability over bounded iterations.
- Standalone guarded harness `scripts/p89-performance-benchmark.mjs`: anti-Production, run_id, JSON proofs under `.p89-proofs/<run_id>/`, auto-cleanup, refuses a green verdict if cleanup fails.

## Capacity assumptions (to be modeled, not asserted)
Targets separated: launch / 1k / 10k / 100k companies — see `P8_9_SLO_CAPACITY_MATRIX.md` + `P8_9_100K_CAPACITY_MODEL.md`. Every number labeled **measured / extrapolated / assumed**.

## Success criteria
Reproducible benches; SLOs documented; concurrency+idempotence green; fairness/backpressure green; multi-tenant isolation green (a single cross-tenant leak → NOT VERIFIED); failure injection green; no reproducible memory growth; total cleanup; 100k modeled honestly; tests/tsc/build green; no provider contacted; P8.7.4/P8.8 non-regressed; P9 untouched; deploy-block active.
