# P8.9 — Database Performance Report

> **UPDATE — EXPLAIN ANALYZE at 100k IS now performed** against a real multi-connection PostgreSQL 16.14 (embedded, ephemeral). See the canonical run [.p89-proofs/p89-final-2fa5898d89/metrics.json](.p89-proofs/p89-final-2fa5898d89/metrics.json): at a 100,000-tenant volume the config lookup uses a real **Index Scan** on `idx_pierre_rt_onboarding_sessions_company` (exec 0.029 ms, 4 shared-hit / 0 read blocks, tenant lookup p95 0.99 ms), proven by a recursive EXPLAIN plan-walk (not a regex). Earlier canonical run [.p89-proofs/p89-100k-fbb957a4f5](.p89-proofs/p89-100k-fbb957a4f5/metrics.json) showed entitlement lookup index-used at 100k (0.06 ms). The static analysis below remains valid as the query-shape/index-coverage baseline.

Static index-coverage analysis of the hot paths (from `supabase/migrations`) + local behavior notes.

## Hot-path index coverage (verified present in migrations)
| Hot query | Table | Index | Verdict |
|---|---|---|---|
| Job claim (`status in (ready,retry) and run_after<=now order by priority,run_after,created`) | pierre_rt_jobs / runtime_jobs | `idx_pierre_rt_runtime_jobs_claim(status, available_at, priority desc)` | covered |
| Stale-lease recovery (`status=leased and lease_expires_at<now`) | runtime_jobs | `idx_pierre_rt_runtime_jobs_lease(status, lease_expires_at)` | covered |
| Delivery due (`company_id,status,scheduled_at`) | communication_deliveries | `idx_pierre_rt_comm_delivery_due(company_id, status, scheduled_at)` | covered |
| Mission list/paginate (`company_id order by created_at desc,id desc`) | missions | `idx_rt_missions_company_created(company_id, created_at desc, id desc)` | covered |
| Mission by status | missions | `idx_rt_missions_company_status(company_id, status)` | covered |
| Commercial event resolve (pending / by ref / by company) | commercial_events | `_pending(application_status,received_at)`, `_refs(...)`, `_company` | covered |
| Entitlement lookup | product_entitlements | `idx_pierre_rt_entitlement_company(company_id, product_key, status)` | covered |
| Employee search | employees | `search_text` + company_id | covered (scale bench 1k/10k) |

## Findings
1. **Claim/queue loop is indexed** — the highest-frequency path (`claimJobs` with `FOR UPDATE SKIP LOCKED` ordered by priority/run_after/created) is backed by `..._jobs_claim`. No sequential scan expected on the claim loop.
2. **Per-tenant scoping is indexed** — mission list, delivery due, entitlement lookup all lead with `company_id`, so tenant-scoped reads use the index prefix (isolation + performance).
3. **Append-only event tables** (events, dead_letters, signature_events, commercial_events) grow unbounded — at 100k scale these need a **retention/partition** strategy (see capacity model). No index gap, but a growth concern.
4. **Idempotency via unique constraints** (`pierre_rt_jobs unique(company_id, dedup_key)`, delivery dedup_fingerprint, commercial provider_event_id) — enforced at the DB, proven by the P8.9 idempotence bench (dup enqueue → 1 row).

## Local measured signals
Job enqueue p95 **2.47ms**, claim p95 **11.65ms**, throughput **591 jobs/s** on a single PGlite connection — consistent with index-backed access (no pathological scan). These are LOCAL; real-Postgres multi-connection contention is not measured.

## Recommendations (NOT applied — no "just-in-case" index)
- Before 100k: run EXPLAIN ANALYZE on real Postgres for the claim loop + cockpit aggregations under representative row counts; add partitioning/retention for append-only event tables; validate connection-pool sizing.
- No new index is added in P8.9 (existing coverage is adequate for the measured paths). Any future index would ship as a **draft migration** with tests + rollback, **not applied remotely**, flagged separately for approval.
