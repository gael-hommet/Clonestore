# E1.2 — REMOTE DATABASE STATE REPORT

**Phase:** E1.2 — Remote Database State Verification / Migration Authorization Gate
**Updated:** 2026-07-12T02:57:00 (local) — authorized read-only inspection complete
**Proofs:** `.e1-2-proofs/remote-database-state/` (historical blocked + prepared + verified evidence)
**Matrix:** `E1_2_REMOTE_MIGRATION_STATE_MATRIX.md`

---

## CURRENT VERDICT

```
E1.2 — REMOTE DATABASE STATE VERIFIED / MIGRATION APPLICATION AUTHORIZATION REQUIRED
```

**The owner authorized a read-only preflight. It connected to the managed Supabase remote (PostgreSQL 17), enforced and
server-verified a read-only session, and ran 26 catalog-metadata queries. It read 0 customer rows, executed 0 mutations,
applied 0 migrations, made 0 provider calls, and rolled back. The single-use authorization was consumed and removed.**

**Findings:** P9.4.1 is **`NOT_APPLIED`** (the `clonechat_app` role and all 10 durable tables are absent). The partner
payout migration is **`FULLY_APPLIED`** (every column/index/constraint present; test/live separation intact). Remote
schema is therefore **`REMOTE_SCHEMA_INCOMPLETE`**. **Nothing was mutated or deployed; production remains unauthorized.**

### The 30 answers (authorized inspection)

| # | Question | Answer |
|---|---|---|
| 1 | Read-only authorization received? | **Yes** — exact sentence, this session. |
| 2 | Connection attempted? | **Yes**, and it succeeded (managed Supabase, PostgreSQL 17, TLS active). |
| 3 | Target classified safely? | **Yes.** `DATABASE_URL` → `managed_supabase_remote`, production-suspected; fingerprint `sha256:c049738d18e8`. No host/URL/credentials printed. |
| 4 | Session genuinely read-only? | **Yes** — `begin read only`, statement/lock/idle timeouts, `search_path=pg_catalog,information_schema`, all **asserted back from the server** before any inspection, and rolled back. |
| 5 | Any customer rows accessed? | **No. 0.** Only pg_catalog / information_schema / the migration ledger. |
| 6 | Any mutations executed? | **No. 0.** |
| 7 | Any migration applied? | **No. 0.** |
| 8 | Exact remote state of P9.4.1? | **`NOT_APPLIED`.** Role `clonechat_app` absent; 0 of 10 canonical tables; 0 budget functions. |
| 9 | Does `clonechat_app` exist? | **No.** |
| 10 | Is it least privilege? | **N/A** — it does not exist. |
| 11 | Can it bypass RLS? | **N/A** — it does not exist. (The *connecting* admin role has BYPASSRLS, as is normal for a Supabase service connection; irrelevant to catalog reads.) |
| 12 | CloneChat durable tables complete? | **No** — none present. |
| 13 | CloneChat functions complete? | **No** — none present. |
| 14 | RLS correctly configured (P9.4.1)? | **N/A** — no P9.4.1 tables exist to carry RLS. |
| 15 | Grants correct (P9.4.1)? | **N/A** — no role, no grants. |
| 16 | Exact remote state of the partner payout migration? | **`FULLY_APPLIED`.** Every added column, index and CHECK vocabulary present. |
| 17 | Payout idempotency constraints present? | **Yes** — run-key unique, transfer idempotency-key unique, `uq_pp_item_entry_live` (single live batch), and `uq_pp_transfer_partner_period` with the correct **wide** predicate. |
| 18 | Test/live separation present? | **Yes** — `stripe_mode` defaults to `'test'` on both money tables and is CHECK-constrained to `test\|live`; payout runs default to `dry_run=true`. |
| 19 | Any remote payout automation active? | **Not proven, and not claimed.** `partnerPayoutRemoteExecutionEnabled=false`. ⚠️ **`pg_cron` and `pg_net` are installed**, so DB-side scheduling/HTTP is *technically possible* — but no payout cron job or outbound-effect trigger was found (only immutability guards). The P10 live-payout floor is a compile-time constant in app code that no SQL can reach. |
| 20 | Migration history agrees with objects? | **No ledger tracks either migration.** The only remote ledger, `public.pierre_rt_schema_migrations` (28 entries), records solely `pierre_v*`. So history can neither confirm nor refute — object state is the only admissible evidence, and it was used. |
| 21 | Schema drift? | **Yes, one benign signal:** partner payout objects are complete but unrecorded in any ledger (`OBJECTS_WITHOUT_LEDGER_MECHANISM`) — expected, since the partner applier writes no history. Surfaced, not hidden. |
| 22 | Canonical migration required? | **Yes — P9.4.1 must be applied** (it is entirely absent). |
| 23 | Repair migration required? | **No.** No incompatible/drifted objects; nothing to repair. |
| 24 | Backup required? | **Yes** — production-suspected target + a pending migration application. Take a backup before applying P9.4.1. |
| 25 | Application compatible with the remote schema? | **`REMOTE_SCHEMA_INCOMPLETE`** — CloneChat durable storage (P9.4.1) is missing, so the CloneChat durable path would fail closed until it is applied. Partner payout schema is compatible. |
| 26 | Deployment still blocked? | **Yes.** |
| 27 | Any remote database modified? | **No.** `remoteDatabaseMutated=false`. |
| 28 | Anything deployed? | **No.** Nothing pushed/staged/committed either. |
| 29 | Production authorized? | **No.** `PRODUCTION_AUTHORIZED=false`, `paymentMode=disabled`, `partnerPayoutLiveAuthorized=false`. |
| 30 | Exact next safe operator action? | **`APPLY_CANONICAL_MIGRATION`** — see "Next action" below. |

### Next action (the exact safe operator step)

`APPLY_CANONICAL_MIGRATION` — **apply P9.4.1** (`supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql`) to
the remote, as a deliberate operator step, **after taking a backup** (the target is production-suspected). The migration
is idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) and additive; it creates the `clonechat_app` NOLOGIN role, the 10
durable tables with RLS, and the 3 budget functions. **Nothing else needs applying** — the partner payout migration is
already fully applied.

This remains a **migration-application authorization gate**, not an instruction to apply: E1.2 is read-only and does not
apply, deploy, or authorize production. Applying P9.4.1 is a separate, owner-authorized step (E1.3 or an operator run of
the existing applier). Before enabling any *live* partner payout, separately re-confirm that no `pg_cron`/`pg_net`-based
automation exists — their mere installation makes DB-side effects *possible*.

The two sections below (the "PREPARED" continuation and the original halt at §1) are retained as history.

### CONTINUATION — what changed since the block

1. **Repository is single-writer.** The concurrent Stripe-recette agent (PID 2224) went idle on its own — owner confirms
   that session is finished and closed. A 185-second freeze window produced three **byte-identical** full-tree snapshots
   (A = B = C, same tree hash, 7779 files, zero writes). Both foreign `claude` processes flat-lined on CPU. **No agent
   was terminated.** (`writer-resolution.json`, `repository-freeze.json`, `stripe-recipe-closure.json`.)

2. **The preflight tool was rebuilt and hardened.** One canonical tool (`scripts/e1-2-remote-state-preflight.mjs`) over a
   shared pure core (`e1-2-preflight-core.mjs`), superseding the E1.1 preflight. It now has: statement/lock/idle timeouts;
   a pinned `search_path`; an **enforced query registry** (21 metadata-only queries — the executor takes a query *ID*,
   never SQL); full P9.4.1 + partner-payout coverage; migration-history reconciliation; deep object/column/index/
   constraint/policy/function inspection; SECURITY DEFINER checks; independent credential-substring leak guards; and a
   **short-lived, single-use, atomically-claimed** authorization file (not an env var). (`preflight-hardening.json`,
   `query-registry.json`, `timeout-contract.json`, `leak-prevention.json`, `authorization-contract.json`.)

3. **It was adversarially audited before being trusted near production.** A 6-lens / 3-verifier fleet (36 agents) raised
   10 candidate findings; **9 real defects were fixed** — including two serious ones: the partner-payout migration would
   have been *permanently* misclassified `PARTIALLY_APPLIED` (two canonical indexes live on tables the tool never
   queried), and a mid-inspection query failure would have produced a confident false classification instead of
   `UNVERIFIABLE`. Also fixed: authorization replay (now atomic claim-before-connect), a SQL-comment strip-order hole, a
   comma-join / quoted-identifier validator escape, a short-password leak gap, and P9.4.1 blaming partner-table RLS gaps.

4. **Local verification is green.** E1 suite 115/115, `tsc` exit 0, affected regression 457/457, broad regression
   12153/12153, and the runtime refusal paths are proven (default opens no socket; `--connect` without authorization is
   refused; a wrong sentence mints nothing). (`preflight-local-tests.json`.)

5. **Still no connection.** `p941RemoteState` and `partnerPayoutRemoteState` remain `UNVERIFIABLE`; the command center's
   verdict is `READ-ONLY PREFLIGHT PREPARED / OWNER AUTHORIZATION REQUIRED`; all hard values (production/payment/
   deployment/mutation) are off. The next step is the owner's authorization sentence.

---

## HISTORICAL — the original halt at §1 (preserved)

```
E1.2 — REMOTE PREFLIGHT BLOCKED / REPOSITORY WRITER STILL ACTIVE
```

**Nothing was connected to. Nothing was mutated. Nothing was applied. Nothing was deployed.**

---

## What blocked it

E1.2 §1 requires a provably sole-writer repository before any remote work. The repository is **not** frozen.

A 96-second full-tree stability watch (8 samples × 12 s, 7,755 → 7,758 files) caught a **foreign agent writing to the
repository while E1.2 was running**:

- `T+48s` — `.recette-client.json` modified
- `T+48s` — `.playwright-mcp/console-…log` + `.playwright-mcp/page-…yml` created (a **live browser session**)
- `T+96s` — `checkout.png` created

Attributed to **`claude` PID 2224** (started 2026-07-11T23:59:59):

- accumulated CPU across **all 8 samples** (+3.8 s over the window) — it is working, not idle;
- holds live MCP children: `@playwright/mcp`, `@upstash/context7-mcp`, `sequential-thinking`;
- **spawned chrome PID 2348 at 00:45:29 — during the watch**;
- owns a Stripe **Connect onboarding + checkout** artifact set at the repo root: `.connect-3-link.cjs`,
  `.connect-4-link-url.cjs`, `.connect-5-express.cjs`, `.connect-6-verify.cjs`, `.connect-webhook-secret`,
  `.connect-onboarding-url`, `.recette-client-1.cjs`, `.recette-client.json`.

(The second foreign process, `claude` PID 24352, is **idle** — +0.2 s CPU over the same window, no writes. Most
plausibly the completed E1.1 session.)

It was **not terminated.** §1 forbids terminating another agent without explicit owner authorization.

### Re-checked at report time — still active, and escalating

At **00:56:09** (9 minutes after the initial watch) PID 2224 was still alive, still accumulating CPU (+0.44 s over
15 s), and had just written **`.recette-payout-2.cjs` at 00:56:01**. Its scope has widened from Connect onboarding and
checkout into **payout** scripting. It is not winding down.

> The P10 floor accepted from E1.1 — `Boolean(PRODUCTION_AUTHORIZED) && isPartnerLivePayoutAuthorized()`, enforced in
> application code and not bypassable by environment variables — means **no live payout can occur while
> `PRODUCTION_AUTHORIZED=false`**, regardless of what that agent scripts. E1.2 carries this forward as an *accepted*
> E1.1 fact; it did **not** re-verify it, because re-verification means running the suite against a repository that is
> being concurrently rewritten.

### The second, independent reason to block

The configured target is a **managed Supabase remote, `productionSuspected = true`**. The foreign agent is driving
Stripe Connect onboarding and checkout flows against that same stack **right now**. A read-only snapshot taken under
those conditions would be **non-reproducible**: any classification of P9.4.1 or the payout migration could be
invalidated seconds after being recorded. Even *with* owner authorization, connecting now would produce an
untrustworthy answer — so the §2 gate was deliberately **not** opened.

---

## The 30 answers

| # | Question | Answer |
|---|---|---|
| 1 | Was explicit read-only authorization received? | **No** — and it was **not requested**. E1.2 halted at §1, before the §2 gate. Requesting it under a live concurrent writer would have solicited authorization for a snapshot that could not be trusted. |
| 2 | Was a connection attempted? | **No.** Zero connections, zero pools, zero sessions. |
| 3 | Was the target classified safely? | **Yes** — without connecting. Source variable `DATABASE_URL`; category `managed_supabase_remote`; `productionSuspected = true`; SSL mode `unspecified`; fingerprint `sha256:c049738d18e8` (truncated, non-reversible). No host, URL, username, password or token was printed. |
| 4 | Was the session genuinely read-only? | **N/A — no session existed.** |
| 5 | Were any customer rows accessed? | **No. 0.** Structurally — there was no connection. |
| 6 | Were any mutations executed? | **No. 0.** |
| 7 | Was any migration applied? | **No. 0.** |
| 8 | Exact remote state of P9.4.1? | **`UNVERIFIABLE`.** Local file present (294 lines, `sha256:4a879e8c…`). Per §7, that proves nothing about remote application. |
| 9 | Does `clonechat_app` exist? | **`UNVERIFIABLE`.** |
| 10 | Is it least privilege? | **`UNVERIFIABLE`.** |
| 11 | Can it bypass RLS? | **`UNVERIFIABLE`.** |
| 12 | Are CloneChat durable tables complete? | **`UNVERIFIABLE`.** |
| 13 | Are CloneChat functions complete? | **`UNVERIFIABLE`.** |
| 14 | Is RLS correctly configured? | **`UNVERIFIABLE`.** |
| 15 | Are grants correct? | **`UNVERIFIABLE`.** |
| 16 | Exact remote state of the partner payout migration? | **`UNVERIFIABLE`.** Local file present (64 lines, `sha256:d2e16a38…`). |
| 17 | Are payout idempotency constraints present? | **`UNVERIFIABLE`** *remotely*. |
| 18 | Is test/live separation present? | **`UNVERIFIABLE`** *at schema level*. |
| 19 | Is any remote payout automation active? | **Not proven active — and held `false`.** `partnerPayoutRemoteExecutionEnabled = false`, because §12 requires it to stay false unless *independently and safely proven* otherwise. It was not proven either way. Table presence alone would never be sufficient evidence of a live cron. |
| 20 | Does migration history agree with actual objects? | **`UNVERIFIABLE`** — the history mechanism was never read. |
| 21 | Is there schema drift? | **`UNVERIFIABLE`.** |
| 22 | Is a canonical migration required? | **`UNVERIFIABLE`.** |
| 23 | Is a repair migration required? | **`UNVERIFIABLE`.** (None was created — §10 forbids it in E1.2 regardless.) |
| 24 | Is a backup required? | **`UNVERIFIABLE`.** |
| 25 | Is the current application compatible with the remote schema? | **`REMOTE_SCHEMA_UNVERIFIABLE`.** |
| 26 | Is deployment still blocked? | **Yes.** |
| 27 | Was any remote database modified? | **No.** `remoteDatabaseMutated = false`. |
| 28 | Was anything deployed? | **No.** Nothing pushed, staged, or committed either. |
| 29 | Is production authorized? | **No.** `PRODUCTION_AUTHORIZED = false`, `paymentMode = disabled`, `partnerPayoutLiveAuthorized = false`. |
| 30 | Exact next safe operator action? | **See below.** |

---

## §3 — Preflight tool audit (performed; read-only; the tool was never executed)

`scripts/e1-1-clonechat-remote-preflight.mjs` (159 lines) was read and audited against the §3 checklist.

**Confirmed present:** never prints the DB URL (`emit()` re-serializes and hard-`exit(3)`s if the DSN leaks); never
prints credentials (catch prints only `e.code`, never `e.message`); no customer rows (only `pg_roles`, `pg_class`,
`pg_proc`, `information_schema.role_table_grants`); no DDL; no DML; no mutating function calls; requires `--connect`;
defaults to no connection; `mutationsExecuted = 0`; classifies local/managed/unknown; enforces
`set session characteristics as transaction read only` + `begin read only` + `rollback`.

**Missing — must be closed before this tool touches a production Supabase target:**

1. **No `statement_timeout`, `lock_timeout`, or `idle_in_transaction_session_timeout`** (§4 requires all three).
2. **No enforced query whitelist** — queries are hardcoded, not validated. Nothing structurally blocks a future edit
   from adding a mutating or customer-row statement.
3. `search_path` not pinned (§4: "no search-path trust").
4. **No partner-payout coverage at all** — the tool only knows P9.4.1.
5. **Never reads the migration-history table** — so the §7 reconciliation is impossible with it as-is.
6. Object inspection is shallow (table names + RLS booleans): no columns, types, defaults, PKs, unique constraints, FKs,
   indexes, ownership, or policy *expressions*.
7. Function inspection is name-only: no `prosecdef` (SECURITY DEFINER) or `proconfig`/`search_path` check.
8. No PG version, current-role category, SSL-mode category, or fingerprint.
9. `migrationState` lacks `INCOMPATIBLE_EXISTING_STATE` and `UNVERIFIABLE`.

**The tool was deliberately NOT strengthened, and local tests were deliberately NOT run.** Both mean writing code and
measuring `tsc`/`vitest` against a repository that a foreign agent is actively rewriting — a volatile green, which is
exactly what E1.1 refused to certify. Deferred to the unblocked run, where it can be measured honestly.

---

## Hard values (§12)

`customerRowsRead = 0` · `mutationsExecuted = 0` · `migrationsApplied = 0` ·
`partnerPayoutRemoteExecutionEnabled = false` · `productionAuthorized = false` ·
`partnerPayoutLiveAuthorized = false` · `remoteDatabaseMutated = false` · `deploymentPerformed = false` ·
live provider calls `= 0`.

Every zero is **structural** — no connection was ever opened — not merely asserted.

The `src/lib/clonestore/external-enablement/e1/e1-2-remote-state-command-center.ts` module was **not** created: it is
runtime-adjacent source that would require `tsc` + `vitest` to be trustworthy, and neither can be trusted while the
repository is being concurrently rewritten. Its full computed field set is recorded instead as data in
`.e1-2-proofs/remote-database-state/command-center.json`, and it will be materialized as a typed module in the
unblocked run.

---

## What E1.1 said, and what changed

E1.1 was accepted without rebuilding, per instruction, and is **not** reopened. But one accepted fact is **no longer
true at E1.2 measurement time**:

> *"all foreign writing agents were terminated"*

They were, at E1.1's measurement time. A partner-program agent is active again now (PID 2224, started 23:59:59 — after
E1.1's proofs stopped at 00:35). This is not a regression in E1.1's code findings; it is a change in the environment.
Every code-level fact E1.1 established (P10 floor, green suites, clean build) stands untouched.

---

## NEXT SAFE OPERATOR ACTION

**1. Resolve the concurrent writer.** `claude` PID 2224 is mid-flight on a Stripe Connect onboarding + checkout
"recette client" run with a live browser. Either let it finish, or terminate it — **your call**. E1.2 did not touch it.

> ⚠️ Before terminating: that session appears to be exercising **Stripe Connect and checkout** flows. Killing it
> mid-flight could leave a partially-created Connect account or an orphaned checkout session on the Stripe side. Letting
> it finish is likely the cleaner option.

**2. Confirm the repository is frozen** — no `claude` process other than the E1.2 session accumulating CPU, no writes
across a stability window.

**3. Then re-run E1.2.** It will resume at §1, strengthen the preflight tool (timeouts, enforced whitelist, migration
history, deep object/RLS/grant/function inspection, partner-payout coverage), run its local tests, and present the §2
authorization sentence for you to approve:

```
I AUTHORIZE READ-ONLY REMOTE DATABASE PREFLIGHT
```

**Do not send that sentence yet.** It would authorize a read-only snapshot of a production-suspected Supabase database
while another agent is concurrently driving Stripe flows against the same stack — the result would not be reproducible,
and E1.2 would have to discard it.
