# P8.7.4 — External Provider Exception (Yousign Sandbox)

**Status:** P8.7.4 code remediation COMPLETE and PROVEN; final 24/24 gated solely by the external blocker `P8-YOUSIGN-SANDBOX-ORG-MEMBERSHIP`. This document records the exception; it is **not** a pass of requirements 16–18 and **does not** authorize any Production unblock.

## Final controlled run
`r55b38bf21b09` (fresh; never a reused id) — mode APPLY, env production, deploy-block active.

## Requirements validated (real, live)
| # | Requirement | Proof |
|---|---|---|
| 1–9 | governed onboarding→employee→mission→human validation→resume→document engine→private storage | run steps PASS |
| 10–12 | **Stripe TEST 449 EUR** → signed webhook → commercial event applied → **entitlement active** | `sub_1To…`, `webhook_signature_valid`, `applied:active` |
| 13–15 | **exactly one** real Resend email → signed webhook → status persisted | `real_email_send_count=1`, provider_message_id, webhook valid |
| 19–20 | duplicate webhook idempotent; bad signature rejected without mutation | PASS |
| 21 | retry/backoff → **dead_letter** terminal; `external_calls=0` | `retries:2`, `dead_lettered:true`, `dead_letter_row_confirmed:true` |
| 22 | A/B tenant isolation | PASS |
| 23 | exact cleanup — **fully automatic**, zero residue | `yousign_open_after=false`, `claimable_deliveries=0`, `synthetic_tenants_active=0` |

## Requirements NOT validated
**16, 17, 18** — Yousign Sandbox request/document/signer activation + `signature_request.activated` webhook. Blocked at `addRecipient` by the Sandbox org-membership restriction (see `P8_EXTERNAL_BLOCKERS_REGISTER.md`).

## Exact provider message
`yousign 400 {"type":"about:blank","detail":"In sandbox mode, the recipient email must belong to your organization. Contact support to remove this limitation."}`

## Investigations performed (summary)
Email byte-identity (raw + trim/lowercase hashes) confirmed owner/alias; key/URL/webhook-secret parity between `.env.local` and `loadEnvironment`; signature_level (`simple`) and auth (`no_otp`) confirmed from policy; signing_order 1/2 tested; adapter config (`aesEnabled=false`) identical; real-pipeline payload captured and diffed against a passing micro-test (no difference); `POST /users` 403 in Sandbox proven for `member`/`admin`.

## Proof the code is correct
- external_id conformance: request **created** (`request=ok`, provider_request_id present).
- Real-pipeline Yousign micro-preflight (`P87_YOUSIGN_PREFLIGHT=1`) accepts **both** signers, never activates, deletes the draft → GREEN (×2) when the Sandbox quota permits.
- Automatic cleanup: partial-failure draft auto-recovered and deleted; deliveries drained to zero — **no manual SQL** after `r55b38bf21b09`.
- Zero residue verified after the run.

## External action required to close
Provision a **2nd distinct controlled Yousign Sandbox org member** (dashboard) or have Yousign **lift the recipient restriction**; then re-run P8.7.4 → 24/24 and set the blocker `CLOSED`.

## Governance constraints (binding)
No further P8.7.4 code change is required. No new journey until the Yousign condition is really lifted. `NEXT_PUBLIC_DEPLOY_BLOCK_PIERRE` stays `1`. No "Yousign live verified" claim. This exception alone does **not** authorize a commercial Production unblock.
