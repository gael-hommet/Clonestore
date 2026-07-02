# P8.8 — Final Production Gates Matrix

Single matrix of every gate for the final Pierre Production unblock. Aggregated by `scripts/p88-readiness-decision.mjs` (read-only). Status legend: ✅ green · ⛔ blocking-open · ⏳ pending human.

`B` = blocking the final Production unblock. The **Yousign** gate is `B` for the final unblock but **NOT blocking P8.8 engineering work**.

| ID | Gate | Required proof | Command / control (source of truth) | Status | Blocking | Owner | Corrective action |
|---|---|---|---|---|---|---|---|
| G01 | Code syntax | all scripts parse | `node --check scripts/p87-step4-controlled-journey.mjs scripts/p87-preflight.mjs scripts/p88-readiness-decision.mjs` | ✅ | B | eng | fix syntax |
| G02 | Types | no TS errors | `npx tsc --noEmit` | ✅ | B | eng | fix types |
| G03 | Targeted tests | all green | vitest p87/p88 suites (63+13) | ✅ | B | eng | fix tests |
| G04 | Clean build | exit 0 | `rm -rf .next && npm run build` | ✅ | B | eng | fix build |
| G05 | DB roles | 7 least-privilege DSNs bind correct role | `scripts/p87-preflight.mjs` (db_roles_available) | ✅ | B | eng | re-run P8.7.2 activation |
| G06 | Migrations/tables | v20/v28 tables + governed fns present | preflight (to_regclass + fns) | ✅ | B | eng | apply migrations |
| G07 | Secrets present | required env present, formats valid, never printed | preflight (required_env_present) | ✅ | B | eng | populate Vercel env |
| G08 | Stripe mode | `sk_test_` (TEST) | preflight (stripe_test_mode) | ✅ | B | eng | correct key |
| G09 | Resend | provider=resend + re_ key + verified sender | preflight (resend_configured) | ✅ | B | eng | configure Resend |
| G10 | Yousign mode | Sandbox recognized | preflight (yousign_sandbox) | ✅ | B | eng | point to sandbox |
| G11 | Public URL/TLS | HTTPS `clonestore.pro`, 200 | preflight (public_url_https_production, production_root_reachable) | ✅ | B | eng | fix domain/env |
| G12 | Webhook routes fail-closed | bad-sig → 4xx (stripe 400, signature 401, communications 401) | preflight (invalid_webhook_rejected) + manual bad-sig | ✅ | B | eng | fix route |
| G13 | Billing bridge | wired + gated on `pierre_synthetic` | preflight (billing_bridge_configured) | ✅ | B | eng | wire bridge |
| G14 | Queues/workers | no permanent worker; one-shot runner; single-run lock | runner design + lock file | ✅ | NB | eng | — |
| G15 | Cron | no synthetic cron; scheduler one-shot | code review | ✅ | NB | eng | — |
| G16 | Storage | private bucket; public read refused; signed URL + hash | P8.7.4 storage-proof (steps 9,13,14) | ✅ | B | eng | fix storage |
| G17 | Tenancy/permissions | A/B isolation, no cross-tenant leak | P8.7.4 req 22 | ✅ | B | eng | fix RLS/ctx |
| G18 | Onboarding/entitlement | canonical activation → entitlement active | P8.7.4 req 1,12 | ✅ | B | eng | — |
| G19 | Communications | exactly one real email + signed webhook | P8.7.4 req 13–15 (`real_email_send_count=1`) | ✅ | B | eng | — |
| G20 | **Signatures (Yousign two-signer activation)** | req 16–18 (request/signer/activation/webhook) | P8.7.4 journey | ⛔ | **B (final)** / NB (P8.8) | **yousign owner/support** | resolve `P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP` |
| G21 | Retry/dead-letter | governed → dead_letter, external_calls=0 | P8.7.4 req 21 | ✅ | B | eng | — |
| G22 | Observability | signals mapped + verified | `P8_8_OBSERVABILITY_RUNBOOK.md` | ✅ | B | eng/ops | — |
| G23 | Rollback | runbook + capability | `P8_8_PRODUCTION_ROLLBACK_RUNBOOK.md` | ✅ | B | ops | — |
| G24 | Emergency stop | fail-closed containment proven | `P8_8_EMERGENCY_STOP_RUNBOOK.md` | ✅ | B | ops | — |
| G25 | Zero residue | 0 synthetic tenant/entitlement/claimable-delivery/Stripe/Yousign | preflight residue checks | ✅ | B | eng | run cleanup |
| G26 | **P8.7.4 final report** | `ok:true` + 24/24 (checker re-read from disk) | `.p87-proofs/step4/final/<run>/final-report.json` | ⛔ | **B** | eng+yousign | close G20 then re-run |
| G27 | Deploy-block active | `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE=1` until owner unblock | env / Vercel | ✅ (active) | B | security | keep active |
| G28 | Owner approval | explicit final unblock approval | human | ⏳ | B | owner | owner decides post-24/24 |

## Current aggregate
`scripts/p88-readiness-decision.mjs` → **BLOCKED** — open: G20, G26 (Yousign), G28 (owner approval pending). All engineering-controllable gates (G01–G19, G21–G25, G27) are green.
