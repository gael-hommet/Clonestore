# P8.7.2 — DONE & VERIFIED on the real production database

**Status: `P8.7 STEP 2 — REAL DATABASE, RUNTIME & BILLING INFRASTRUCTURE VERIFIED` (2026-06-30).**
Executed against the authorized CloneStore/Pierre production DB `db.zdoigpfkyhilpzcsrdmc.supabase.co`.

## What was applied (additive, namespaced, non-destructive)
- A restorable backup was captured first: logical pre/post inventory + a generated `ROLLBACK.sql`
  (pg_dump is unavailable in this environment and the operation is additive onto an empty Pierre namespace).
- Migrations **v1→v28** applied, recorded in the `pierre_rt_schema_migrations` ledger (sha256, resumable).
- The **7 dedicated LOGIN least-privilege roles** were created (CSPRNG passwords) + a least-privilege
  hardening step revoked direct SELECT on the forbidden business tables (employees/documents/missions).
- Synthetic proof data (2 `p87-step2-proof-*` tenants) was produced **through the dedicated role DSNs**.
- **Integrity proven: `non_pierre_untouched=true`** — only Pierre objects (98 tables, 96 functions, 9 roles)
  and the `pg_trgm` extension were added; **no CloneStory/founder/auth/storage object was removed or altered**.
- **`npm run check:p87-runtime-billing-live --strict` → ready: true (exit 0)**: all 7 roles READY_LIVE
  (direct least-privilege bind + TLS + governed functions executable + business tables refused) and all three
  proofs (runtime / billing / isolation) READY_LIVE.

Generated credentials live ONLY in the gitignored `.env.p87-runtime.local` (0600). Redacted artifacts (no
secret values) are under `.p87-proofs/step2/<ts>/`.

## Re-verify at any time (read-only)
```powershell
npm run check:p87-runtime-billing-live      # strict; exit 0 == still green
```

## Rollback (returns the DB to its exact pre-activation state — touches ONLY Pierre objects)
Run the generated `.p87-proofs/step2/<ts>/backup/ROLLBACK.sql` as the admin role. It deletes the synthetic
`p87-step2-proof-%` rows, drops the new Pierre tables/functions/types, and neutralizes the dedicated roles
(`nologin`; with optional `drop role` lines). It never touches a non-Pierre object.

## Operational notes (real-activation gotchas, for re-runs)
- The Supabase **direct connection is IPv6-only** and intermittently unavailable on this host; the kit retries
  transient connect timeouts with backoff. If a run fails on `ETIMEDOUT`, simply re-run (everything is idempotent
  + ledger-resumable).
- Role DSNs use `sslmode=no-verify` (TLS on, cert unverified) because the pg driver now aliases
  `sslmode=require` to `verify-full`, which rejects Supabase's self-signed chain.
- To re-run the full activation: set `P87_ADMIN_DATABASE_URL` (from `.env.local` `DATABASE_URL`),
  `P87_CONFIRM_TARGET`, `P87_I_UNDERSTAND_REMOTE_WRITE=yes`, `P87_ENVIRONMENT=production`, then
  `node scripts/p87-activate-remote.mjs --apply` → `node scripts/p87-runtime-billing-proof.mjs --apply` →
  `npm run check:p87-runtime-billing-live`.

## Still deferred to P8.7.3 (NOT this step)
Resend live + verified domain/DNS, Yousign live, Stripe live webhook + a real signed handoff. **No real email,
signature, or payment was sent in P8.7.2.** The changes are **not yet committed to git** (sandbox-blocked) —
commit when ready.
