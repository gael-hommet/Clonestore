# PHASE 8.4 — Communication Provider Activation Runbook

**Not legal advice.** Operational runbook for enabling the live email provider (Resend).

## 1. Configuration (never commit secrets; never edit .env.local from code)
Set in the deployment secret store:
- `CLONESTORE_COMMUNICATION_PROVIDER=resend`
- `RESEND_API_KEY` (secret; format `re_...`)
- `CLONESTORE_EMAIL_FROM` (or reuse `CLONESTORE_FOUNDER_EMAIL_FROM`) — a verified sending identity
- `CLONESTORE_EMAIL_REPLY_TO` (optional)
- `CLONESTORE_EMAIL_WEBHOOK_SECRET` (Svix `whsec_...` from the Resend webhook config)
- `CLONESTORE_PUBLIC_APP_URL` (for absolute links)
- `CLONESTORE_COMMUNICATION_LINK_SECRET` (or reuse the signature webhook secret) for secure links

**Fail-closed:** under `NODE_ENV=production` a missing provider/key/from/public-url throws; the Fake
is never available. The webhook route returns 503 without a secret.

## 2. Webhook endpoint
Register the Resend webhook to `POST /api/webhooks/pierre/communications`. The route verifies the
Svix signature + timestamp via the minimal-privilege webhook role and ingests idempotently; the
tenant is derived from `(provider, provider_message_id)`. The tenant worker applies the state machine.

## 3. Workers
- `createCommunicationIntents` — drains pending `pierre_rt_outbox` into governed intents + deliveries.
- `dispatchCommunicationDeliveries` — claims due deliveries (lease), sends, records truth.
- `applyPendingCommunicationEvents` — applies ingested provider events to the delivery state machine.
Schedule all three per tenant (a thin loop; full autonomy is P8.5).

## 4. Idempotency
The provider idempotency key is `communication:<company>:<delivery>:<content_hash>`. An ambiguous
post-send timeout is reconciled by that key — never a blind resend. Two workers never double-send
(claim is `FOR UPDATE SKIP LOCKED`; complete/fail require lease ownership).

## 5. Secret rotation
Rotate `RESEND_API_KEY` / `CLONESTORE_EMAIL_WEBHOOK_SECRET` in the store and the Resend console
together; redeploy; verify with the opt-in smoke. No secret is ever logged (keys are redacted).

## 6. Live smoke
`CLONESTORE_COMMUNICATION_LIVE_SMOKE_ENABLED=true` + credentials + `CLONESTORE_COMMUNICATION_TEST_RECIPIENT`
+ `CLONESTORE_COMMUNICATION_TEST_CONSENT=true` → `npm run check:p84-live-communications`. It sends ONE
clearly-marked TEST email to the consented address and captures the message id; never to a real
customer; never prints secrets. Without opt-in → SKIPPED (never a false PASS).
