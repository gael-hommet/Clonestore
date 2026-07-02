# P8.8 — Production Rollback Runbook

Reverse a Pierre Production unblock safely. Idempotent, evidence-preserving, no mass client-data deletion, no double side-effects.

## When to roll back
Post-unblock smoke failure, webhook/queue anomaly, provider incident, or any critical signal (see OBSERVABILITY runbook) within the T+5 / T+30 windows of the LAUNCH runbook.

## Rollback order (fastest containment first)
1. **Re-assert deploy-block**: set `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1` and **redeploy** (`clonestore-xcwi` / `clonestore.pro`). This is the primary, fastest rollback — it re-blocks Pierre publicly.
2. **Vercel deployment rollback**: promote the previous known-good production deployment (Vercel dashboard/CLI `promote`/alias) if the new build itself is faulty. One controlled change.
3. **Flags rollback**: restore every `PIERRE_*_BLOCK` and provider flag to its pre-unblock value per `P8_8_PRODUCTION_FLAGS_MATRIX.md` (`before` column). One flag at a time; read-only check between.
4. **Stop workers / crons**: verify no live runner; disable any scheduler tick that was enabled.
5. **Suspend providers**: revert live-mode switches (signature URL back to sandbox, unset `*_LIVE_SMOKE_ENABLED`); disable provider webhooks in dashboards if needed.
6. **Configuration restore**: revert any env change via Vercel env history; never print values.

## Data integrity during rollback (mandatory)
- **Already-received events**: keep persisted `pierre_rt_commercial_events` / `_communication_provider_events` / `_signature_events` — they are the audit trail. Do not delete.
- **Idempotency**: on resume, all provider calls resolve by idempotency key / `external_id` / provider_event_id — safe to re-drive; never re-create.
- **`submission_unknown` deliveries**: treat as ambiguous — never blind-resend; reconcile via provider `getMessage`/status, then governed transition.
- **Claimable deliveries**: drain via the governed claim→fail cycle (suppressed/dead_letter) — never direct UPDATE.
- **Open signatures**: cancel (`ongoing`) / delete (`draft`) via the adapter; verify none open.
- **Entitlements**: reconcile via governed apply; do not hand-edit.

## Rollback must NEVER
Mass-delete real client data; disable audits/triggers; break idempotence; replay payments; send duplicate communications; touch P9 / public pages / DA.

## Verify after rollback (read-only)
`node scripts/p87-preflight.mjs` (deploy-block active, zero residue) + `node scripts/p88-readiness-decision.mjs` (→ BLOCKED) + OBSERVABILITY signals clear. Record the incident + preserve `.p87-proofs/` and provider ids.
