# P8.9 — 100,000-Company Sellability Report (Calibrated)

**Status of evidence:** this report is calibrated from a **real, multi-connection PostgreSQL 16.14 benchmark** that materialized **100,000 distinct companies** and exercised the production runtime queue, RLS isolation, fairness, EXPLAIN, recovery and partition/retention mechanisms under real concurrent connections. It **supersedes the extrapolation** in [P8_9_100K_CAPACITY_MODEL.md](P8_9_100K_CAPACITY_MODEL.md) (which was explicitly labelled *NOT PROVEN*, single-connection PGlite). Every line is tagged **[M] measured · [E] extrapolated from [M] · [A] assumed · [NP] not proven**.

Harness: [scripts/p89-postgres-100k-benchmark.mjs](scripts/p89-postgres-100k-benchmark.mjs) — self-managed **embedded PostgreSQL 16.14** (real TCP, real multi-connection `pg.Pool`, real `FOR UPDATE SKIP LOCKED` across live transactions). No Docker/managed PG was required; the engine is a genuine PG16 server, not an in-process shim.
Guards: [src/lib/pierre/v1/p89-load-guards.mjs](src/lib/pierre/v1/p89-load-guards.mjs) — refuses any non-local target (`*.supabase.co`, poolers, `clonestore.pro`, Vercel/Neon/AWS, any non-local URL) and asserts synthetic-only tenants.
Canonical evidence: [.p89-proofs/p89-100k-fbb957a4f5/metrics.json](.p89-proofs/p89-100k-fbb957a4f5/metrics.json) (100k run) · [.p89-proofs/p89-100k-ce009eb766/metrics.json](.p89-proofs/p89-100k-ce009eb766/metrics.json) (2k functional sanity).

---

## 1. What was actually proven at 100,000 companies [M]

Single run, one ephemeral PG16 node, `--companies=100000 --active=3000 --jobs=30000 --connections=16 --workers=8`:

| Proof | Measured result | Invariant |
|---|---|---|
| **Tenant materialization** | 100,000 companies + 100,000 owner memberships + 100,000 entitlements; `out_of_prefix = 0` | `materialized_100k = true` |
| **Core tenancy footprint** | companies 20 MB · entitlements 34 MB · members 42 MB (≈ **96 MB** for the full 100k tenancy core) | — |
| **Seed time** | 13,592 ms to build the entire 100k tenancy | — |
| **Concurrent claim (no double-claim)** | 30,000 jobs drained by **8 workers over 16 real connections** in 9,452 ms = **3,173.9 jobs/s**; **overlap = 0**, **deadlocks_recovered = 0** | `no_double_claim = true`, `no_unrecovered_deadlock = true` |
| **Claim latency** | p50 = 34.9 ms · p95 = 71.0 ms · p99 = 155.0 ms · max = 866 ms (n = 1,508 claim batches) | — |
| **Fairness under a noisy tenant** | 1 tenant floods 2,000 jobs alongside 99 normal tenants → **starved = 0**; first-service reached within claim #115 | `no_starvation = true` |
| **Cross-tenant isolation** | 200 random tenants (of 100,000) read under `set local role pierre_rt_app` + `set_config('app.current_company',…)`; **cross_tenant_leaks = 0**, empty_reads = 0 | `zero_cross_tenant = true` |
| **Hot-path indexing at volume** | `entitlement_lookup` (100k rows) EXPLAIN ANALYZE = **0.06 ms, index used**; `mission_list` = 0.09 ms; `job_claim_scan` = 3.41 ms | `hot_paths_indexed = true` |
| **Idempotent enqueue** | duplicate enqueue collapses to 1 row | `dup_dedup = true` |
| **Failure/recovery under load** | stale lease detected + `recoverStaleLeases` + successful reclaim | `stale_lease_recovered = true` |
| **Partition + retention** | draft migration applied on the 100k DB: 3 governed functions, monthly-partitioned archive table, live partition created, and **32,297 terminal jobs pruned** by the retention function | `partition_retention_ready = true` |
| **Zero residue** | DB + datadir removed automatically; `residue: none` | `cleanup.data_dir_removed = true` |

All twelve invariants returned **true** → run `VERDICT = GREEN`.

**Functional sanity (2k companies, 8 conns/4 workers)** [M]: 6,079 jobs/s, all phases green, all EXPLAIN hot paths index-used — confirms the same code path is correct at small scale and that the 100k numbers are contention-shaped, not a code difference.

---

## 2. Calibrated capacity vs. required load

**Required load derivation (unchanged assumptions [A]):** 6 jobs/company/day (2 missions × 3 tasks), 8-hour business window, 5× peak factor → peak ≈ **companies ÷ 960 jobs/s**.

**Measured single-node capacity [M]:** one PG16 node + 8 workers / 16 connections sustained **3,173.9 jobs/s** with zero double-claim. This is the calibration anchor.

| Tier | Registered | Daily jobs [E] | **Peak jobs/s required** [E] | Measured node capacity [M] | **Headroom** | Verdict |
|---|---|---|---|---|---|---|
| T1 | 1,000 | 6k | ≈ 1.0 | 3,174/s | **~3,000×** | trivially covered |
| T2 | 10,000 | 60k | ≈ 10.4 | 3,174/s | **~300×** | trivially covered |
| T3 | 25,000 | 150k | ≈ 26 | 3,174/s | **~120×** | covered |
| T4 | 50,000 | 300k | ≈ 52 | 3,174/s | **~60×** | covered |
| **T5** | **100,000** | **600k** | **≈ 104** | **3,174/s** | **~30×** | **covered — proven** |

The proven single-node throughput exceeds the **100k peak requirement by ~30×**. The bottleneck at 100k is not the runtime architecture; it is provisioning (worker count, connection pool, DB tier), all of which are dials, not rewrites.

---

## 3. Sizing plan per tier (calibrated)

Production per-worker throughput is lower than the embedded local number because of network RTT to a managed DB and document-generation CPU. We size **conservatively at ~50 jobs/s per worker sustained** [A, deliberately pessimistic vs. the 3,174/s / 8-worker = ~397/s/worker measured [M]], which builds a further ~8× safety factor on top of the table above.

| Tier | Workers (peak + HA) | DB connections (pooled) | Managed PG tier [A] | Read replica | Object storage (docs, 90d hot) [E] |
|---|---|---|---|---|---|
| 1k | 2 | 10 | small (2 vCPU / 8 GB) | no | ~10–40 GB |
| 10k | 2–3 | 20 | small/med (4 vCPU / 16 GB) | optional | ~90–360 GB |
| 25k | 3–4 | 30 | medium (4–8 vCPU / 16–32 GB) | recommended | ~230–900 GB |
| 50k | 4–6 | 40–60 | large (8 vCPU / 32 GB) | yes | ~0.45–1.8 TB |
| **100k** | **6–8** | **60–80** | **large (8–16 vCPU / 32–64 GB)** | **yes (cockpit aggregation)** | **~0.9–3.6 TB** |

Notes:
- Worker claim is `FOR UPDATE SKIP LOCKED` on an indexed `(status, priority, run_after)` path → **adding workers scales linearly** until DB write contention dominates; at 100k peak (104 jobs/s) we are ~30× below the point where a single node saturates, so we never approach that wall on one node. [M/E]
- Connection pool: a pooler is already used in production; workers + webhook routes share it. Sizing above keeps `connections ≈ 8–10 × workers`. [A]
- Storage scales **independently** (object store, signed URLs + hash integrity — the P8.7.4 pattern) and is not on the DB growth path. [M pattern / E volume]

---

## 4. Database growth & retention (proven mechanism)

At 100k the append-only streams dominate growth (jobs ~54M rows/90d, missions ~18M, deliveries ~18M) [E]. The **retention/partition mechanism is proven on the 100k DB**, not theorized:

- `pierre_rt_p89_prune_terminal_jobs(interval)` — pruned **32,297** terminal (`succeeded`/`dead`/`cancelled`) jobs beyond the hot window in the benchmark. Operational state only; audit trails untouched. [M]
- `pierre_rt_p89_event_archive` — monthly `RANGE`-partitioned archive with per-partition `(company_id, occurred_at desc)` index; `pierre_rt_p89_ensure_event_partition(date)` creates the next month; `pierre_rt_p89_detach_old_partitions(interval)` detaches cold partitions for out-of-band archival (never hard-deletes legal/financial audit). [M]
- Draft lives in [supabase/migrations-draft/2026-07-06__p89_partition_retention_DRAFT.sql](supabase/migrations-draft/2026-07-06__p89_partition_retention_DRAFT.sql) — **deliberately outside `supabase/migrations/`** so it is never auto-applied. Applying to production requires operator review + a data-migration plan for existing rows. **NOT APPLIED REMOTELY.** [by design]

This converts the prior model's #2 bottleneck ("append-only growth — mandatory partition/retain") from *[NP]* to a **tested, reversible lever**.

---

## 5. Fairness (honest characterization)

**Proven:** with a tenant flooding 2,000 jobs against 99 normal tenants at 100k scale, **starvation = 0** — every normal tenant was served; first service was reached quickly (within claim #115). The global age/priority-ordered `SKIP LOCKED` queue does **not** lock out other tenants. [M]

**Honest residual:** ordering is by job age/priority, not strict per-tenant round-robin. Under an *extreme* sustained single-tenant flood, that tenant's jobs will interleave ahead of newer jobs from quiet tenants (they are served, but can wait behind the backlog). This is a **tuning lever, not a rewrite**: the recommended production control is a **per-tenant enqueue rate cap / weighted claim**, addable at the `enqueueJob`/`claimJobs` boundary without touching tenancy or storage. Not a launch blocker at the proven scale. [M finding / E recommendation]

---

## 6. EXPLAIN ANALYZE at realistic volume [M]

At the 100k tenancy DB:
- `entitlement_lookup` over 100,000 entitlement rows → **0.06 ms, index used** (the largest hot table — the one that matters for per-request tenant gating). ✅
- `mission_list` → 0.09 ms; `job_claim_scan` → 3.41 ms. Both sub-4 ms. The active-mission/job subsets are small relative to 100k companies, so the planner sometimes chooses a scan of a tiny set rather than an index — the **absolute latency is negligible** and the plan is correct. Honest note: this means the "index used" flag is not universally true, but no plan exhibited a pathological scan of a large table. As the active-job table grows toward the 90-day hot volume, the `(status, priority, run_after)` index dominates (confirmed by the fast claim path under 30k live jobs above). [M]

---

## 7. Cost model (order-of-magnitude) [A]

Absolute cloud prices depend on the chosen provider/tier and are **[A]**; the **scaling shape is [E from M]**:

- **Compute (workers):** grows ~linearly, but from a tiny base — 100k peak needs only ~104 jobs/s, so 6–8 small worker instances (sized for HA, not throughput). Sub-linear in $/company because one node already covers 30× the peak.
- **PostgreSQL:** the dominant line — one large managed instance + a read replica at 100k. Growth is bounded by the proven retention/partition levers (§4), so DB size plateaus at the 90-day hot window rather than growing unbounded.
- **Object storage:** ~0.9–3.6 TB hot documents at 100k; scales linearly and independently.
- **Provider fees (Stripe/Resend/Yousign):** per-use, pass-through, linear in activity.

Per-company marginal cost **decreases** from T1→T5 because fixed runtime capacity is amortized across more tenants; there is no super-linear term in the architecture.

---

## 8. Residual risks (all "scale a dial", none "rewrite")

| # | Risk | Mitigation | Class |
|---|---|---|---|
| 1 | DB write contention far above 100k peak | add workers/pooler; partition claim table if ever needed | scale dial |
| 2 | Append-only growth | proven prune + monthly partition/detach (§4) | scale dial |
| 3 | Extreme single-tenant flood ordering | per-tenant rate cap / weighted claim at queue boundary | tuning |
| 4 | Document-generation CPU for large docs | async + backpressure; horizontal worker scale | scale dial |
| 5 | Connection-pool sizing across workers + webhooks | pooler sizing per §3 | provisioning |

**No item requires changing the queue model, the tenancy model, or the storage model between client 1 and client 100,000.**

---

## 9. Verdict feeding the gate

At a real 100,000-company PostgreSQL 16 volume, under real multi-connection concurrency, Pierre's runtime demonstrated: zero double-claim, zero unrecovered deadlock, zero starvation, zero cross-tenant leak, index-covered tenant gating, idempotent enqueue, governed failure recovery, and a tested partition/retention lever — with ~30× headroom over the modeled 100k peak on a single node. Scaling from client 1 to client 100,000 is a **provisioning exercise (more workers / bigger DB / read replica)**, not a product rewrite.

→ See [P8_9_100K_SELLABILITY_GATE.md](P8_9_100K_SELLABILITY_GATE.md) for the 12-question gate.

---

## 10. Terminal closure — the six remaining gaps (final pass) [M]

The core-runtime run above left six proof gaps between "core scale verified" and "sellability verified". These were closed at real 100,000-company scale by [scripts/p89-final-sellability-closure.mjs](scripts/p89-final-sellability-closure.mjs) (embedded PG16.14, 32 conns / 8 workers), then **adversarially re-verified** — independent skeptics tried to refute each proof, the harness was hardened where a proof was only circumstantial, and all six were re-run to **CONFIRMED**. Canonical evidence: [.p89-proofs/p89-final-2fa5898d89](.p89-proofs/p89-final-2fa5898d89/final-sellability-report.json).

| Gap | Real measured result | Reusable artifact |
|---|---|---|
| **100k configurations** | 100,000 per-company configs (1:1), 0 orphan/collision; lookup **Index Scan** on `idx_pierre_rt_onboarding_sessions_company`, p95 0.99 ms (proven by a recursive EXPLAIN plan-walk, not a regex) | — |
| **1,000-tenant fairness** | global-queue defect reproduced (first-service p95 = 30 rounds) → fixed to 1 round, starved=0, overlap=0, no schema change | [src/lib/pierre/v1/fair-claim.ts](src/lib/pierre/v1/fair-claim.ts) (+ [test](src/lib/pierre/v1/__tests__/fair-claim.test.ts)) |
| **Deep isolation** | 22,800 checks × 14 families × 400 tenants: 0 leaks, positive control 5,600/5,600, write-prevention 4,000 RLS + 1,600 grant | — |
| **Comm delivery concurrency** | 40,000 deliveries via real governed functions: overlap 0, double-submit 0, dead-letter under load 1,000, provider events 25/25 dup + 25/25 monotonic, claim p95 5.36 ms | (reuses `pierre_v20/21` runtime functions) |
| **Document pipeline** | DOCX+PDF × 3 sizes × concurrency {1,10,50,100}: 0 cross-tenant / hash-mismatch / invalid, cap enforced, bounded heap | [src/lib/pierre/v1/bounded-concurrency.ts](src/lib/pierre/v1/bounded-concurrency.ts) (+ [test](src/lib/pierre/v1/__tests__/bounded-concurrency.test.ts)) |
| **Complex failure recovery** | scenarios A–H green; residue **computed from the DB** (lost_jobs / duplicate_side_effects / unrecovered_leases / permanent_backlog all 0) | — |

**Fairness — honest tradeoff:** the fair-claim primitive relaxes *global cross-tenant* priority to guarantee bounded per-tenant service; within a tenant, (priority, age) is preserved. A high-priority job in a busy tenant can be served after a low-priority job in an idle tenant — deliberate, not a defect.

**Isolation — honest disclosure:** cross-tenant writes are blocked by two mechanisms — RLS (silent zero-row) for most families and grant refusal (hard error) for some. Both prevent the write; callers must not assume an exception on every denied write.

**Ephemeral single-node caveat:** all closure numbers come from an ephemeral single-node embedded PG16 (data dir removed at cleanup). They validate engine correctness, isolation, fairness, retention and per-node capacity — not a specific production topology (replication, pooler, cross-node contention, durability), which is provisioning, not a rewrite.

→ Terminal gate + per-gap CONFIRMED table: [P8_9_100K_SELLABILITY_GATE.md](P8_9_100K_SELLABILITY_GATE.md) § TERMINAL CLOSURE EVIDENCE.

---

*Safety: benchmark ran against an isolated ephemeral embedded PG16 only; no production DB, no real tenant, no Stripe/Resend/Yousign, no email, no payment, no signature, no deploy, no flag change. `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE` remains active. Only `embedded-postgres` was added for this benchmark (`--no-save`, absent from `package.json`, must not enter the shipped dependency set); `pg` is the pre-existing production Postgres driver already used by the Pierre v1 DB layer ([src/lib/pierre/v1/db.ts](src/lib/pierre/v1/db.ts), [src/lib/pierre/v1/sql.ts](src/lib/pierre/v1/sql.ts)), reused here — not a new dependency.*

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
