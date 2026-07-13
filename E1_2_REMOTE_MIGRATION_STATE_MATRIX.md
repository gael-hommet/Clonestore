# E1.2 — REMOTE MIGRATION STATE MATRIX

**Phase:** E1.2 — Remote Database State Verification / Migration Authorization Gate
**Updated:** 2026-07-12T02:57:00 (local) — authorized read-only inspection complete
**Verdict:** `E1.2 — REMOTE DATABASE STATE VERIFIED / MIGRATION APPLICATION AUTHORIZATION REQUIRED`
**Target:** managed Supabase remote, **PostgreSQL 17**, TLS active, production-suspected · fingerprint `sha256:c049738d18e8`

> **VERIFIED.** The owner authorized a read-only preflight. It connected, server-verified a read-only session, and ran
> **26 catalog-metadata queries**: **0 customer rows, 0 mutations, 0 migrations, 0 provider calls**, rolled back, auth
> consumed. Remote state is now established from **object metadata** (the only admissible evidence — no ledger tracks
> either migration).

| Migration | Remote state | Next action |
|---|---|---|
| **P9.4.1** (`migrations-p941/2026-07-07__p941_clonechat_durable.sql`, sha `4a879e8c…`) | **`NOT_APPLIED`** — role `clonechat_app` absent, 0/10 tables, 0/3 functions | **`APPLY_CANONICAL_MIGRATION`** (backup first) |
| **Partner payout** (`migrations/2026-07-11_05__…payout_automation.sql`, sha `d2e16a38…`) | **`FULLY_APPLIED`** — all columns/indexes/constraints present; test/live separation intact | `NO_ACTION_REQUIRED` (benign unrecorded-in-ledger drift) |

**Remote schema compatibility:** `REMOTE_SCHEMA_INCOMPLETE` (P9.4.1 missing). **Drift:** one benign signal (partner
objects complete but unrecorded in any ledger). **Backup required:** yes (prod-suspected + pending application).
**Repair migration required:** no. **Deployment / production:** still blocked.

> ⚠️ **Instance note:** `pg_cron` and `pg_net` are installed on this database, so DB-side scheduling and outbound HTTP
> are *technically possible*. No payout cron job or outbound-effect trigger was found (only immutability guards), and the
> P10 live-payout floor is a compile-time constant no SQL can reach — but this should be re-confirmed before any live
> payout enablement.

---

## Per-migration detail (verified 2026-07-12)

## Why every remote column is UNVERIFIABLE

E1.2 §1 requires a provably sole-writer repository before anything else. It is not.

A 96-second full-tree stability watch (8 samples × 12s) observed a **foreign agent actively mutating the repository**:

| Sample | Path | Change |
|---|---|---|
| T+48s | `.recette-client.json` | modified |
| T+48s | `.playwright-mcp/console-2026-07-11T22-45-16-050Z.log` | created |
| T+48s | `.playwright-mcp/page-2026-07-11T22-45-18-245Z.yml` | created |
| T+96s | `checkout.png` | created |

Attributed to `claude` **PID 2224** (started 2026-07-11T23:59:59), which accumulated CPU across all 8 samples, holds a
live `@playwright/mcp` browser (chrome PID 2348 spawned at 00:45:29 — *during* the watch), and owns a Stripe Connect
onboarding + checkout "recette client" artifact set at the repo root (`.connect-3-link.cjs` … `.connect-6-verify.cjs`,
`.connect-webhook-secret`, `.recette-client-1.cjs`).

The configured database target is a **managed Supabase remote with `productionSuspected = true`**. A read-only snapshot
of that target, taken while another agent is driving Stripe Connect and checkout flows against the same stack, would be
**non-reproducible** — the classification could be invalidated seconds after it was recorded. This is a second,
independent reason to block, beyond the repository-writer rule itself.

---

## Migration 1 — P9.4.1 (CloneChat durable)

| Field | Value |
|---|---|
| Migration ID | `P9.4.1` |
| Local file | `supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql` |
| Local file present | **yes** (294 lines) |
| Local SHA-256 | `4a879e8cbfa260e8bebdbef5203213f3086015b3a8c77c8748c2b7325d15dc7b` |
| Migration-history state | `UNVERIFIABLE` — no connection |
| Object-state result | `UNVERIFIABLE` — no connection |
| Role/grant state (`clonechat_app`) | `UNVERIFIABLE` — no connection |
| RLS state | `UNVERIFIABLE` — no connection |
| Constraint/index state | `UNVERIFIABLE` — no connection |
| Drift detected | `UNVERIFIABLE` |
| Compatibility risk | `UNVERIFIABLE` |
| Application required | `UNVERIFIABLE` |
| Repair migration required | `UNVERIFIABLE` |
| Backup required | `UNVERIFIABLE` |
| Maintenance window required | `UNVERIFIABLE` |
| Rollback feasibility | `UNVERIFIABLE` |
| **Next safe action** | `MANUAL_REVIEW_REQUIRED` |
| **Final state** | **`UNVERIFIABLE`** |

Prior sessions recorded conflicting expectations for this migration (P9.4.1 memory: "migration exists"; C1.4 memory:
"the `clonechat_app` DB role migration existed but was **never applied**; remote DB = `managed_supabase_remote` ⇒
untouched"). **E1.2 resolves neither.** Only an authorized read-only connection can.

---

## Migration 2 — Partner payout automation

| Field | Value |
|---|---|
| Migration ID | `CLONESTORE_PP_PAYOUT_AUTOMATION (2026-07-11_05)` |
| Local file | `supabase/migrations/2026-07-11_05__clonestore_pp_payout_automation.sql` |
| Local file present | **yes** (64 lines) |
| Local SHA-256 | `d2e16a3832cfc232e1eac22ee9ac49d3a7c399dc83ca3670cdb8f25f4990a7f1` |
| Migration-history state | `UNVERIFIABLE` — no connection |
| Object-state result | `UNVERIFIABLE` — no connection |
| Role/grant state | `UNVERIFIABLE` — no connection |
| RLS state | `UNVERIFIABLE` — no connection |
| Constraint/index state (run-key uniqueness, single-live-batch, idempotency) | `UNVERIFIABLE` — no connection |
| Test/live separation at schema level | `UNVERIFIABLE` — no connection |
| Drift detected | `UNVERIFIABLE` |
| Compatibility risk | `UNVERIFIABLE` |
| Application required | `UNVERIFIABLE` |
| Repair migration required | `UNVERIFIABLE` |
| Backup required | `UNVERIFIABLE` |
| Maintenance window required | `UNVERIFIABLE` |
| Rollback feasibility | `UNVERIFIABLE` |
| **Next safe action** | `MANUAL_REVIEW_REQUIRED` |
| **Final state** | **`UNVERIFIABLE`** |

**Standing application-side guarantee (unchanged, and independent of this inspection):** E1.1 established that the P10
floor `Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized()` is enforced in application code and cannot be
bypassed by environment variables. No live payout can occur while `PRODUCTION_AUTHORIZED=false`, **whatever** the remote
schema turns out to contain. E1.2 changes nothing about that.

`partnerPayoutRemoteExecutionEnabled = false` — held false because it was **not independently and safely proven
otherwise**, exactly as §12 requires.

---

## Preflight tool readiness (§3 audit — read-only, tool never executed)

`scripts/e1-1-clonechat-remote-preflight.mjs` was read and audited. It is **safe enough not to mutate**, but **not
sufficient** for the E1.2 mandate.

**Protections confirmed present:** never prints the DSN (hard `exit(3)` leak guard in `emit()`); never prints
credentials (catch prints only `e.code`); catalog-only queries; no DDL/DML; no mutating function calls; requires an
explicit `--connect`; defaults to no connection; `mutationsExecuted = 0`; classifies the target;
`set session characteristics as transaction read only` + `begin read only` + `rollback`.

**Gaps that must be closed before it is pointed at a production Supabase target:**

1. **No statement timeout**, no lock timeout, no idle-in-transaction timeout (§4 requires all three).
2. **No enforced query whitelist** — the queries are merely hardcoded; nothing structurally prevents a future edit from
   introducing a mutating or customer-row statement.
3. `search_path` is not pinned (§4: "no search-path trust").
4. **Zero partner-payout coverage** — the tool only knows about P9.4.1.
5. **No migration-history read** — so it cannot perform the §7 reconciliation at all.
6. Object inspection is shallow (table names + RLS flags): no columns, types, defaults, PKs, unique constraints, FKs,
   indexes, ownership, or policy *expressions* (§5B/5C).
7. Function inspection is name-only: no `prosecdef` (SECURITY DEFINER) check, no `proconfig`/`search_path` check (§5E).
8. No PostgreSQL version, current-role category, SSL-mode category, or target fingerprint (§8).
9. `migrationState` has only 4 classes and lacks `INCOMPATIBLE_EXISTING_STATE` / `UNVERIFIABLE` (§5 requires 5).

**Strengthening was deliberately NOT performed.** Writing that code and running `tsc`/`vitest` against a repository a
foreign agent is concurrently rewriting would produce a volatile, uncertifiable green — the precise failure mode E1.1
refused to certify. It is deferred to the unblocked run.

---

## Deployment compatibility (§11)

| Field | Value |
|---|---|
| Classification | **`REMOTE_SCHEMA_UNVERIFIABLE`** |
| Remote schema observed | no |
| Deployment authorized | **no** |
| Production authorized | **no** |

---

## Hard values held during E1.2

| Field | Value |
|---|---|
| `customerRowsRead` | **0** |
| `mutationsExecuted` | **0** |
| `migrationsApplied` | **0** |
| `remoteDatabaseMutated` | **false** |
| `deploymentPerformed` | **false** |
| `productionAuthorized` | **false** |
| `partnerPayoutLiveAuthorized` | **false** |
| `partnerPayoutRemoteExecutionEnabled` | **false** |
| `paymentMode` | **disabled** |
| live provider calls | **0** |

All zeros are **structural** (no connection was ever opened), not asserted.

---

## Next safe action

`MANUAL_REVIEW_REQUIRED` — the owner must resolve the concurrent writer (`claude` PID 2224) before E1.2 can re-run §1
and reach the §2 read-only authorization gate. E1.2 did **not** terminate it; §1 forbids terminating another agent
without explicit owner authorization.
