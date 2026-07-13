# E1.3 — P9.4.1 ROLLBACK & RECOVERY RUNBOOK

**Phase:** E1.3 — Controlled remote application of the canonical P9.4.1 CloneChat durable migration
**Target (fingerprint, not address):** `sha256:c049738d18e8` — managed Supabase remote, PostgreSQL 17, production-suspected
**Canonical migration:** `supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql`
**Migration checksum:** `sha256:4a879e8cbfa260e8bebdbef5203213f3086015b3a8c77c8748c2b7325d15dc7b`
**No deployment occurs in E1.3.** Applying the schema does **not** authorize deployment, production, payments, or partner payouts.

---

## 1. Prerequisite — backup / recovery

The migration is **additive and idempotent** (`IF NOT EXISTS` / `CREATE OR REPLACE`; the only `DROP`s are
`DROP POLICY IF EXISTS` immediately before re-creating the same policy). It creates **only new** objects and touches
**no existing table, no existing data, and no other perimeter** (Pierre HR, partner payout, auth, payments). The realistic
data-loss risk is therefore near zero.

Even so, because the target is production-suspected, E1.3 will **not** apply without confirmed backup/recovery. Confirm
**one** of:

- **A.** a recent managed Supabase backup exists;
- **B.** point-in-time recovery (PITR) is active and the recovery window is known;
- **C.** an authorized operator created a pre-migration snapshot.

Record only the mechanism **category** and evidence **timestamp** — never a project id, URL, or credential
(`scripts/e1-3-apply-p941-remote.mjs --attest-backup --mechanism <cat> --at <iso>`). **Do not** create a customer-data
dump or `pg_dump` of customer rows as a substitute.

---

## 2. Expected object inventory (what a correct application creates)

- **1 role:** `clonechat_app` — `NOLOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`.
- **10 tables** (schema `public`): `clonechat_conversations`, `clonechat_messages`, `clonechat_bug_occurrences`,
  `clonechat_support_cases`, `clonechat_bug_cases`, `clonechat_action_executions`, `clonechat_proposals`,
  `clonechat_commands`, `clonechat_budget_counters`, `clonechat_usage_events` — with the canonical columns, defaults,
  primary keys, foreign keys, indexes, and the **exactly-once** unique on `clonechat_commands.fingerprint`.
- **RLS:** enabled **and forced** on every canonical table; tenant tables scoped by
  `company_id::text = current_setting('app.current_company', true)`; global neutralized tables per the canonical policy.
- **3 functions:** `clonechat_budget_try_reserve`, `clonechat_budget_commit`, `clonechat_budget_release` — plpgsql,
  **not** `SECURITY DEFINER`.
- **Grants:** `SELECT/INSERT/UPDATE/DELETE` on the canonical tables and `EXECUTE` on the 3 functions to `clonechat_app`,
  and **nothing** outside the `clonechat_*` perimeter.

---

## 3. Execution contract (transactional, all-or-nothing)

The runner executes inside **one** transaction:

```
BEGIN;
  set local lock_timeout, statement_timeout, idle_in_transaction_session_timeout;
  set local search_path = public;              -- new objects land in public
  recheck P9.4.1 still absent;                 -- belt
  <exact canonical migration bytes>;           -- the ONLY mutation
  run role/table/column/index/RLS/policy/function/grant assertions;
  assert the partner payout schema is still FULLY_APPLIED (unrelated schema preserved);
COMMIT   -- only if EVERY assertion passes
| ROLLBACK  -- on any failed assertion or any SQL error
```

**No partial success is possible.** A commit happens only when the post-apply metadata sweep classifies P9.4.1 as
`FULLY_APPLIED` **and** the partner schema as still `FULLY_APPLIED`. Every statement in P9.4.1 is transactional
(verified: no `CREATE INDEX CONCURRENTLY`, no `VACUUM`, no `CREATE EXTENSION`, no `CREATE DATABASE`), so a `ROLLBACK`
leaves the remote **byte-for-byte unchanged**.

---

## 4. Automatic rollback — BEFORE COMMIT

Any failed assertion or any SQL error triggers an automatic `ROLLBACK`. Because the migration had not committed, the
remote state is unchanged and **P9.4.1 remains `NOT_APPLIED`**. No repair is attempted inside the transaction. The
verdict becomes `E1.3 — P9.4.1 MIGRATION ROLLED BACK / REMOTE STATE UNCHANGED`, and the failing assertions are recorded.

---

## 5. Emergency recovery — AFTER COMMIT

Once committed, the schema exists. **Do not** automatically `DROP` the tables or the role. The doctrine is:

1. **The schema is additive and unused until deployment.** If an unexpected issue appears before the application is
   deployed, **leave the additive, unused schema in place and block deployment.** An unused `clonechat_*` schema harms
   nothing — no application traffic reads or writes it until CloneChat is deployed and enabled.
2. **Reviewed repair/rollback only with separate authorization.** If the schema must genuinely be removed or corrected,
   author a **reviewed** repair migration (its own authorization gate). A destructive rollback is never invented merely
   to look symmetric.
3. **Managed backup restore only for severe database-level failure.** Restore from the confirmed backup/PITR
   (section 1) only if the database itself is damaged — not for an additive-schema concern.

### Why no automatic destructive rollback

An automatic `DROP TABLE clonechat_* CASCADE` / `DROP ROLE clonechat_app` would be a **destructive** operation on a
production-suspected database, and would itself risk data loss the moment any CloneChat data existed. E1.3 refuses to
carry a destructive rollback it would never safely run. The additive schema is safe to leave; removing it is a
deliberate, separately-authorized act.

### Rollback impact on CloneChat data created after deployment

**In E1.3 there is none** — nothing is deployed, so no CloneChat conversation, message, budget row, or command can
exist yet. **After** a future deployment, a destructive rollback would delete real customer CloneChat data and MUST be
treated as a data-loss operation requiring backup, owner authorization, and a maintenance window. This is one more
reason the default post-commit posture is "leave the schema, block deployment," not "drop it."

---

## 6. Hard reminders

- E1.3 mutates **only** P9.4.1. It never touches the partner payout schema, Pierre HR tables, auth, or payments.
- `pg_cron` and `pg_net` are installed on this instance (DB-side scheduling/HTTP is *possible*); this migration adds no
  cron job and no outbound-effect trigger, and the P10 live-payout floor is a compile-time application constant no SQL
  can reach. Re-confirm no payout automation before any live payout enablement — separately from E1.3.
- A committed migration **does not** authorize deployment or production. That remains a distinct, still-closed gate.
