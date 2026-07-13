# E1.3 — P9.4.1 REMOTE MIGRATION REPORT

**Phase:** E1.3 — Controlled remote application of the canonical P9.4.1 CloneChat durable migration
**Status (this continuation):** `E1.3 — MIGRATION APPLICATION PREPARED / BACKUP CONFIRMATION REQUIRED`
**Updated:** 2026-07-12T12:38:00 (local)
**Proofs:** `.e1-3-proofs/p941-remote-migration/` (16 pre-authorization proofs)
**Runbook:** `E1_3_P941_ROLLBACK_AND_RECOVERY_RUNBOOK.md`

---

## CURRENT VERDICT

```
E1.3 — MIGRATION APPLICATION PREPARED / BACKUP CONFIRMATION REQUIRED
```

**Everything that can be prepared and proven locally is done and green. Nothing has been applied, connected, or
mutated. The one thing missing is a truthful backup/recovery confirmation, which only you can supply.**

Migration authorization has **not** been requested and will not be until backup is confirmed.

---

## What this continuation completed

1. **Recovered the adversarial audit** (workflow `wf_a9a13cf0-6ff`) and, because the session-limit interruption killed
   the `wrong-commit` and `false-green` lens agents, **re-audited those two lenses manually** read-only.
   `.e1-3-proofs/.../adversarial-review.json`.

2. **Fixed all 4 confirmed defects the audit found** — the happy-path tests had missed the two functional ones:
   - **(high)** the post-migration certification read `Result[0]` instead of `.rows[0]`, so the safety row was always
     `undefined` and **every committed run would have mis-certified as failed**. Fixed to `.rows[0]`.
   - **(medium)** a committed run reported `p941RemoteStateAfter = FULLY_APPLIED` even when the postcheck was
     blocked/absent — a false green. Now a commit without a *completed* postcheck yields `UNVERIFIABLE` and the
     `COMMITTED / POSTCHECK BLOCKED` verdict; a safety-failed postcheck maps to BLOCKED, not a false "inconsistent".
   - **(high)** the backup attestation was never bound to the target or to freshness (only `backupConfirmed === true`
     was checked; `--at` accepted `2026-99-99`). Now `validateBackup` requires the attestation's `targetFingerprint`
     to equal the verified target, the record to be < 24 h old, and `--at` to be a real, recent, non-future calendar
     date — wired into both `--authorize` and `--apply`; the command center derives `backupConfirmed` from it.
   - **(medium)** the repository-freeze gate was a bare `existsSync`. Now `validateFreezeProof` requires `frozen`,
     matching A/B/C hashes, a < 24 h record, the migration checksum, **and re-hashes the runner/core/command-center/
     migration files** — rejecting any post-freeze source drift.
   Plus a fail-closed hardening of the commit gate (`p941_detail_present` / `partner_detail_present`).

3. **Re-ran local gates after the fixes:** E1 suite **150/150**, `tsc` **exit 0**, affected CloneChat + partner
   regression **342/342**. No remote connection during tests.

4. **Performed the definitive clean freeze** — a 158-second no-edit window with **byte-identical** A = B = C
   (tree hash `f38885d6`, content hash `541b7b71`, 7800 files, zero added/removed/modified/touched). Both foreign
   `claude` processes idle (+0.48 s / +0.38 s over 135 s). Unlike the earlier interrupted window, **no file was edited
   during this one.** The freeze proof records per-file source hashes; the runner re-validates them before applying.

5. **Verified the runner's refusal paths:** default opens no socket; `--authorize` refuses without a bound backup;
   a wrong sentence mints nothing; `--apply` refuses without authorization. No backup or auth file exists on disk.

---

## The 34 answers

Preparation questions are answered; execution questions are **PENDING** (no migration has run).

| # | Question | Answer |
|---|---|---|
| 1 | Repository single-writer? | **Yes** — clean freeze A = B = C over 158 s, foreign agents idle, no DB/build/Stripe scripts. |
| 2 | Target fingerprint match E1.2? | **Yes** — `c049738d18e8` (compared without connecting). |
| 3 | Migration checksum match? | **Yes** — `sha256:4a879e8c…`, exact. |
| 4 | Fully transactional? | **Yes** — 0 CONCURRENTLY/VACUUM/CREATE EXTENSION/CREATE DATABASE; `CREATE ROLE` in a DO block rolls back cleanly on PG17. |
| 5 | Backup/recovery confirmed? | **NO — this is the blocking gate.** I cannot verify Supabase backup/PITR from SQL metadata; it requires your truthful attestation. |
| 6 | Owner migration authorization received? | **No** — not requested (blocked on backup). |
| 7 | Authorization session-bound & single-use? | **Designed yes** — file-based, TTL 15 min, atomically claimed before connect, bound to fingerprint + checksum + backup; not yet minted. |
| 8 | Migration executed exactly once? | **PENDING** — the runner executes the exact canonical bytes exactly once; not yet run. |
| 9 | Executed inside one transaction? | **PENDING** — `BEGIN … COMMIT/ROLLBACK`, all-or-nothing. |
| 10 | Every in-transaction assertion passed? | **PENDING**. |
| 11 | Committed or rolled back? | **Neither yet.** |
| 12 | How many migrations applied? | **0.** |
| 13 | Only P9.4.1 mutated? | **Nothing mutated yet;** the runner can only ever execute the one hard-coded path. |
| 14 | `clonechat_app` created? | **PENDING**. |
| 15 | NOLOGIN & least privilege? | **PENDING** — asserted as a commit gate. |
| 16 | Can it bypass RLS? | **PENDING** — `NOBYPASSRLS` asserted; commit blocked otherwise. |
| 17 | All 10 durable tables present? | **PENDING** — asserted. |
| 18 | Columns/indexes/constraints correct? | **PENDING** — deep-asserted. |
| 19 | Exactly-once command uniqueness? | **PENDING** — `clonechat_commands.fingerprint` UNIQUE asserted. |
| 20 | All 3 budget functions present? | **PENDING** — asserted. |
| 21 | Any canonical function SECURITY DEFINER? | **PENDING** — a SECDEF function blocks commit. |
| 22 | RLS enabled and forced? | **PENDING** — asserted. |
| 23 | Tenant policies correctly scoped? | **PENDING** — `company_id` + `app.current_company` asserted. |
| 24 | Grants restricted to CloneChat objects? | **PENDING** — perimeter asserted. |
| 25 | Partner payout schema unchanged? | **PENDING** — `partner_preserved` (partner still FULLY_APPLIED) is a commit gate. |
| 26 | Partner payout still FULLY_APPLIED? | **Yes at E1.2;** re-asserted in-transaction before any commit. |
| 27 | Post-migration read-only verification complete? | **PENDING** — runs on a fresh read-only connection after COMMIT. |
| 28 | Remote schema now compatible? | **PENDING** — becomes `REMOTE_SCHEMA_COMPATIBLE` only after certified. |
| 29 | Any customer rows read? | **No. 0.** (No connection this continuation.) |
| 30 | Any provider called? | **No. 0.** |
| 31 | Anything deployed? | **No.** |
| 32 | Production authorized? | **No.** |
| 33 | Payments & partner payouts still off? | **Yes** — `paymentMode=disabled`, `partnerPayoutLiveAuthorized=false`. |
| 34 | Exact action remaining before controlled deployment? | **Confirm backup → authorize → apply P9.4.1 → certify.** See below. |

---

## The exact next steps

1. **You confirm a real recovery mechanism** for the configured Supabase database (see the stop message).
2. I record it via `--attest-backup` (category + timestamp only, bound to the target — no secrets).
3. I request the exact authorization sentence.
4. On your authorization, the runner mints a single-use grant, reconfirms the target + `NOT_APPLIED` live, applies
   P9.4.1 in one transaction, commits only if every assertion passes, and runs the read-only certification.

**Deployment remains a separate, still-closed gate.** Applying the schema does not deploy or activate production.

> **Preserved for the deployment phase (not touched here):** CloneChat production still blocks an authenticated account
> without an active company. That belongs to the controlled deployment QA after E1.3 (public question must work,
> composer enabled, no fake company/tenant data, operational HR request still blocked, anonymous still 401).
