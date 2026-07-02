# P8.8 — Emergency Stop Runbook (fail-closed containment)

Contain a Pierre incident **without a risky deploy**. Every step is reversible and governed. Do NOT run any of these against a healthy environment — this runbook is verified via pure functions / read-only checks / synthetic tenants only. Preserve all audit/evidence; never disable a trigger or an audit.

## Golden rule
The master containment is already active: `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1` keeps Pierre publicly blocked. Most incidents are contained by keeping it `1` (or restoring it) — no deploy needed.

## Read-only assessment FIRST (always)
1. `node scripts/p87-preflight.mjs` — residue, deploy-block, provider modes.
2. Query (count/hashed only): active synthetic tenants, claimable deliveries, open Yousign requests, active Stripe synthetic subs, runtime jobs. (Same queries used by the preflight.)
3. Record run_id(s) and scope before acting.

## Containment order (least → most invasive)
1. **Confirm deploy-block** `=1` (restore + redeploy only if it was disabled).
2. **Stop scheduler / workers**: the runner is one-shot with a single-run lock — verify no live `p87-step4` process; a lock in `running` with a live PID blocks new runs. There is **no permanent worker** to kill in normal operation.
3. **Freeze communications**: set `PIERRE_EMAIL_BLOCK` (and/or `PIERRE_BLOCK`) to stop the email path; neutralize claimable deliveries via the **governed** `pierre_rt_claim_communication_deliveries` → `pierre_rt_fail_communication_delivery('suppressed'|'permanent')` cycle (never a direct status UPDATE).
4. **Freeze signatures**: cancel/delete open Yousign requests via the adapter (`draft`→DELETE, `ongoing`→cancel); verify none open.
5. **Disable a provider**: point the provider to a non-live config or unset its live-smoke flag (see FLAGS matrix); never delete secrets.
6. **Suspend a tenant**: tombstone `pierre_rt_companies.status='cancelled'` (append-only safe) — never hard-delete; owner member preserved.
7. **Suspend an entitlement**: `pierre_rt_product_entitlements.status='cancelled'` via governed path.
8. **Disable a webhook**: disable the Yousign/Resend/Stripe endpoint in the provider dashboard (routes remain fail-closed on bad sig regardless).
9. **Duplicate protection**: idempotency keys + `duplicate` handling are already enforced; do not replay events manually.

## Do NOT
Fake a webhook; direct-UPDATE `status/attempt_count/next_retry_at/dead_lettered_at`; mass-delete real client data; disable audits/triggers; replay payments; send duplicate communications; touch P9 / public pages / DA.

## Resume conditions
Root cause identified; residue zero (preflight); providers healthy; blockers register updated; then relax the specific flags that were set, one at a time, with a read-only check after each.

## Data to preserve
All `pierre_rt_*` audit rows, proof bundles under `.p87-proofs/`, provider event ids, correlation ids. Cleanup **tombstones**, it does not erase evidence.
