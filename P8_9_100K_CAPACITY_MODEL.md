# P8.9 — 100 000 Companies Capacity Model

> **⚠️ SUPERSEDED (retained for history).** This was the *pre-proof* extrapolation (PGlite, single connection, explicitly *NOT PROVEN*). It is now superseded by the **calibrated, measured** proof in [P8_9_100K_SELLABILITY_REPORT.md](P8_9_100K_SELLABILITY_REPORT.md) + [P8_9_100K_SELLABILITY_GATE.md](P8_9_100K_SELLABILITY_GATE.md), which ran a real multi-connection PostgreSQL 16 benchmark against 100,000 real companies. Every "next step" listed at the bottom of this file has since been **proven**. Read the report for the authoritative numbers.

Extrapolation from **local** measurements (PGlite, single in-process connection). Every line is tagged **[M] measured · [E] extrapolated · [A] assumed · [NP] not proven**. This model does **not** claim "100k ready".

## Workload assumptions [A]
- 100 000 active companies. [A]
- 2 missions / company / business day → 200k missions/day. [A]
- 3 tasks / mission → 600k jobs/day. [A]
- 1 document / mission → 200k documents/day. [A]
- 1 communication / mission → 200k emails/day. [A]
- 10% retry rate; ~1% dead-letter. [A]
- Peak factor 5× over a business-hours window (~8h) → peak ≈ (600k/8h)×5. [A]
- Retention: hot data 90d; append-only events archived thereafter. [A]

## Derived throughput
- Daily jobs: 600k. [E from A]
- Average job rate: 600k / 8h ≈ **20.8 jobs/s**. [E]
- Peak job rate ≈ 20.8 × 5 ≈ **104 jobs/s**. [E]
- Measured single-connection throughput: **591 jobs/s** [M] (local PGlite). Real Postgres multi-connection throughput is higher per-core but network/latency-bound [NP].

## Worker sizing
- Required peak ≈ 104 jobs/s. [E]
- Per-worker sustained (conservative, real Postgres w/ network) assume ~50–100 jobs/s [A] (local 591/s is optimistic single-process, no network).
- → **2–4 workers** at peak with headroom; batch 25; scheduler per-minute. [E]
- Horizontal scaling: `FOR UPDATE SKIP LOCKED` claim + per-`company_id` indexing supports adding workers linearly until DB write contention dominates. [E, NP at 100k]

## Database sizing [E/A]
- Missions 90d: 200k/day × 90 ≈ 18M rows. [E]
- Jobs 90d: 600k/day × 90 ≈ 54M rows (terminal jobs archivable). [E]
- Deliveries 90d: 200k/day × 90 ≈ 18M rows. [E]
- Append-only events: largest growth — **must partition/retain** (dead_letters, events, signature_events, commercial_events). [E]
- All hot reads are index-covered (see DB report) — index maintenance cost at 54M rows is the main write-amplification concern. [E, NP]

## Storage [E/A]
- 200k docs/day × ~50–200 KB avg × 90d ≈ **0.9–3.6 TB** hot document storage (private bucket). [E from A]
- Signed-URL + hash integrity per artifact (measured pattern in P8.7.4). [M pattern]

## Main bottlenecks (ranked) [E]
1. DB write contention on the claim loop + append-only inserts at peak (needs pooling + possibly partitioning). [E, NP]
2. Append-only event table growth (retention/partitioning mandatory). [E]
3. Document generation CPU/memory for large docs (async + backpressure). [A/NP]
4. Per-tenant fairness under a noisy tenant — current claim is global priority/age ordered; if one tenant floods, ordering is by age not tenant-fair. **Finding:** for 100k with heterogeneous load, consider a per-tenant fairness/round-robin or per-tenant rate cap. [E, recommendation — not a proven defect at launch scale]
5. Connection pool sizing across workers + webhook routes. [A]

## Horizontal strategy [E]
Stateless workers scaled horizontally (claim is contention-safe); read replicas for cockpit aggregations; partition append-only events by month; connection pooler (already used in prod). Scaling thresholds: add a worker per ~50 jobs/s sustained; add a read replica when cockpit p95 breaches target.

## Cost (order-of-magnitude) [A]
Dominated by (a) Postgres (54M+ hot rows, replicas), (b) object storage (~1–4 TB), (c) worker compute (2–8 instances), (d) provider fees (Stripe/Resend/Yousign per-use). Precise costing requires the chosen infra tiers. [A]

## Honest verdict on 100k
**NOT PROVEN.** Measured facts: single-connection **591 jobs/s [M]**, index-covered hot paths [M], no heap leak [M], governed idempotence/isolation/retry-dead-letter [M]. Everything at ≥1k companies is **[E]/[A]/[NP]**. To PROVE 100k: real multi-connection Postgres load test + EXPLAIN ANALYZE at representative row counts + event-table partitioning + per-tenant fairness decision + document-pipeline load test. These are the concrete next steps, none blocking the (Yousign-gated) launch.
