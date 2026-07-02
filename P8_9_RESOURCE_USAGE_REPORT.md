# P8.9 — Resource Usage Report

> **UPDATE — resource hygiene now measured at real 100k scale + document pipeline under load.** Final closure run [.p89-proofs/p89-final-2fa5898d89/documents.json](.p89-proofs/p89-final-2fa5898d89/documents.json): DOCX+PDF pipeline at concurrency up to 100 with a governed **bounded-concurrency primitive** ([src/lib/pierre/v1/bounded-concurrency.ts](src/lib/pierre/v1/bounded-concurrency.ts)) — peak-in-flight never exceeds the cap, heap bounded (unbounded burst +7 MB vs bounded −14.4 MB delta, RSS ~223 MB), 0 temp-file/handle residue after `purgeAll` + datadir/docstore removed at cleanup (`zero_residue: true`). The PGlite figures below remain the single-connection baseline.

Bounded local runs (PGlite synthetic). Measures heap growth, latency stability, and resource hygiene. Source: `p89-load.bench.ts` (memory stability test) + `scripts/p89-performance-benchmark.mjs` metrics.

## Memory (heap)
| Run | Iterations | heap start | heap end | growth | verdict |
|---|---|---|---|---|---|
| harness `--local` | 200 (enqueue/claim/complete + idempotence/isolation/failure) | 33.1 MB | 31.8 MB | **−1.2 MB** | no growth (GC reclaims) |
| bench memory test | 300 (list/enqueue/claim loop) | measured | measured | **< 150 MB ceiling asserted, no monotonic climb** | pass |

**Finding:** no reproducible monotonic heap growth over bounded loops; the heap is reclaimed by GC (end ≤ start in the harness run). No evidence of a leak in the create/list/enqueue/claim hot loop.

## Latency stability
Enqueue p95 2.47ms, claim p95 11.65ms across 200 iterations — stable, no drift/degradation over the loop (no growing tail).

## Resource hygiene (verified by design + run)
- **DB connections:** PGlite is a single in-process instance created per harness and dropped on `h.close()` — no connection pool leak in the harness. Production uses least-privilege pooled DSNs (P8.7.2); pool sizing is a capacity input (see 100k model).
- **Temp files:** document generation uses in-memory buffers + the storage provider's finalize path; no temp-file residue observed. (Full DOCX/PDF large-document profiling is a recommended follow-up; not isolated in this phase.)
- **Timers / listeners / child processes:** the runtime/queue paths use no unbounded timers; the runner is one-shot; no permanent worker. No residual child process from the benches.
- **Cleanup:** harness `--local` verified `cleanup.ok=true` (ephemeral PGlite dropped); benches close their harness in `finally`.

## Caveats (honest)
- Heap figures are for the Node process running PGlite in-process — production Node servers have a different memory profile (no PGlite; real pooled pg). These numbers show the **application code** does not leak in the measured loops, not a production memory SLO.
- Document-renderer memory under very large documents and the browser/PDF pipeline (if any) is **not** exhaustively profiled here — recommended before high-volume document workloads.

## Verdict
No reproducible resource leak in the measured hot paths → this dimension is GREEN for P8.9's local scope. Large-document + production-server memory profiling is a labeled follow-up.
