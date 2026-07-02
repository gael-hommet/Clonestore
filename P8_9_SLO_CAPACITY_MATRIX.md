# P8.9 — SLO & Capacity Matrix

> **UPDATE — multi-connection p95 at 100k IS now measured** on a real multi-connection PostgreSQL 16.14. Canonical: job claim p95 **71 ms** at 3,174 jobs/s (8 workers/16 conns, [.p89-proofs/p89-100k-fbb957a4f5](.p89-proofs/p89-100k-fbb957a4f5/metrics.json)); final closure ([.p89-proofs/p89-final-2fa5898d89](.p89-proofs/p89-final-2fa5898d89/metrics.json)): config lookup p95 **0.99 ms**, comm-delivery claim p95 **5.36 ms** (32 conns/8 workers), fairness first-service ≤ 1 round with the fair-claim primitive. These are single-node ephemeral figures (lower bounds under ideal cache conditions), not a production-topology SLA. The PGlite baseline below remains valid for per-operation shape.

Targets per operation, with **measured** LOCAL figures (PGlite, real PG16, single in-process connection — NOT production) vs **target** budgets.

Measurement sources: `runtime-core.bench.ts` (create/list/claim/throughput), `tenancy-employee360.bench.ts` + `employee-360-scale.bench.ts` (resolution/list/search at 1k–10k), `p89-load.bench.ts` + `scripts/p89-performance-benchmark.mjs` (enqueue/claim/throughput/idempotence/isolation/failure/memory).

| Operation | Local measured (p95) | Launch target p95 | 1k target | 10k target | 100k target | max err | timeout | degradation | Blocking |
|---|---|---|---|---|---|---|---|---|---|
| API simple read | ~ (sub-list) | <150ms | <150ms | <200ms | <300ms | 0.1% | 5s | cache/read-replica | yes |
| Cockpit aggregated | list p95 <100ms (local) | <400ms | <500ms | <800ms | <1200ms | 0.5% | 8s | precompute/materialize | yes |
| Mission create | create p95 <200ms (local, asserted) | <300ms | <300ms | <400ms | <500ms | 0.1% | 8s | queue-buffer | yes |
| Validation decision | — | <300ms | <300ms | <400ms | <500ms | 0.1% | 8s | retry | yes |
| Job claim | **11.65ms (measured)** | <50ms | <60ms | <100ms | <150ms | 0.5% | 5s | batch tuning | yes |
| Delivery claim | — (same claim family) | <50ms | <60ms | <100ms | <150ms | 0.5% | 5s | batch tuning | yes |
| Job enqueue | **2.47ms (measured)** | <30ms | <30ms | <50ms | <80ms | 0.1% | 5s | — | yes |
| Retry transition | governed (measured green) | <50ms | <50ms | <80ms | <120ms | — | 5s | backoff | yes |
| Dead-letter | governed (measured green) | <50ms | <50ms | <80ms | <120ms | — | 5s | terminal | yes |
| Queue throughput | **591 jobs/s (1 conn, measured)** | (scales with workers×conns) | — | — | — | — | — | horizontal workers | yes |
| DOCX generation | not isolated here | <2s | <2s | <2.5s | <3s | 1% | 30s | async/backpressure | yes |
| PDF generation | not isolated here | <2s | <2s | <2.5s | <3s | 1% | 30s | async/backpressure | yes |
| Storage upload+hash | integrity-gated (P8.7.4) | <1.5s | <1.5s | <2s | <2.5s | 0.5% | 30s | retry | yes |
| Employee search | 1k/10k measured (scale bench) | <200ms | <200ms | <300ms | <500ms | 0.5% | 5s | index/search_text | yes |
| Timeline (Employee360) | 1k/10k measured (scale bench) | <300ms | <400ms | <600ms | <900ms | 0.5% | 8s | pagination | non-blocking |
| Scheduler tick | one-shot governed | <2s | <2s | <3s | <5s | 0.5% | 30s | shard schedules | yes |

## Targets by scale (companies)
- **Launch (private pilot):** measured local budgets hold; single worker sufficient.
- **1k:** 1–2 workers; batch 25; scheduler per-minute. Feasible from measured per-op latency.
- **10k:** N workers (horizontal); read paths need index discipline (all hot indexes present); see DB report.
- **100k:** horizontal workers + connection pool + possible read replica + partitioning of append-only event tables — **modeled, not proven** (see `P8_9_100K_CAPACITY_MODEL.md`).

## Honesty
Only the "Local measured" column is measured. All target columns are **budgets**. No level ≥ 1k is asserted as *proven*; proof requires real multi-connection Postgres + distributed load, out of scope for this local phase.
