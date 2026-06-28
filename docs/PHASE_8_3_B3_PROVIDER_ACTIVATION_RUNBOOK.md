# PHASE 8.3-B3 — Provider Activation Runbook (operations)

**Not legal advice.** Operational runbook for enabling the live e-signature provider.

## 1. Configuration (never commit secrets; never edit .env.local from code)
Set in the deployment secret store:
- `CLONESTORE_SIGNATURE_PROVIDER=yousign`
- `CLONESTORE_SIGNATURE_API_URL` (provider base URL)
- `CLONESTORE_SIGNATURE_API_KEY` (provider API key — secret)
- `CLONESTORE_SIGNATURE_WEBHOOK_SECRET` (HMAC secret — secret)
- `CLONESTORE_PIERRE_WEBHOOK_DATABASE_URL` (DSN bound to the minimal `pierre_rt_webhook_ingress` role)

Fail-closed: missing credentials → the provider resolver throws; the webhook route returns 503.

## 2. Webhook endpoint
Register the provider webhook to `POST /api/webhooks/pierre/signature`. The route:
- HMAC-verifies the raw body via the provider adapter;
- resolves the tenant server-side from `(provider, provider_request_id)`;
- ingests via the governed SECURITY DEFINER functions using the **ingress role only** (no
  service role, no general app role, no raw business writes);
- responds fast; the app-role worker applies events asynchronously.

## 3. Workers
- `processPendingSignatureEvents` — drains the tenant event queue (monotonic, idempotent).
- `reconcileSignatureRequests` — recovers missed webhooks; bounded retry → dead-letter; never
  creates a second provider request. Schedule both per tenant.

## 4. Finalization guarantees
A provider `completed` only signs after the signed document + evidence are downloaded, scanned
clean and integrity-checked. An infected/empty artifact → quarantine, contract stays unsigned,
`reconcile_status` flags it.

## 5. Secret rotation
Rotate `CLONESTORE_SIGNATURE_API_KEY` / `CLONESTORE_SIGNATURE_WEBHOOK_SECRET` in the secret store
and the provider console together; deploy; verify with the opt-in smoke. No secret is logged.

## 6. Incident response
- Webhook 401 spike → check the webhook secret rotation alignment.
- Requests stuck `submitted/in_progress` → run reconciliation; inspect `dead_letter_reason`.
- `signed_doc_unclean` → the provider artifact failed the scan; do NOT mark signed; investigate.
- Never mark a contract signed manually without the signed document + evidence.

## 7. Live smoke
`CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED=true` + credentials + `CLONESTORE_SIGNATURE_TEST_SIGNER_EMAIL`
→ `npm run check:p83-b3-live-signature`. It creates + cancels a draft request with a consented
test signer; it never activates/emails a real person and never prints secrets.

## 8. Signature security (B3-R2)
- Default tier is **SES** (`electronic_signature`) — no phone/OTP/capability needed.
- **AES** needs `CLONESTORE_SIGNATURE_AES_ENABLED=true` + `otp_sms` + a real signer phone.
- **QES** needs `CLONESTORE_SIGNATURE_QES_ENABLED=true` + NO OTP mode; never mixed with SES/AES.
- Both capability flags default **false**; a policy requesting AES/QES without the flag fails
  before any HTTP call. Phones come from `employees.phone` / `companies.signatory_phone`
  (tenant-safe, E.164-normalized, never invented).

## 9. Provider boundary (B3-R2)
The accepted providers are the rows of `pierre_rt_signature_provider_registry` (live-only in the
deployable migration). To add a real provider, INSERT a `kind='live'` row **as a migration**
(superuser) — the app and webhook-ingress roles cannot write it, and there is no session-GUC
override. Under `NODE_ENV=production` the Fake/sandbox is never resolvable.

## 10. Amendment activation worker (B3-R2)
- `activateSignedAmendment` — past/now → apply atomically; future → governed schedule
  (`pierre_rt_schedule_contract_activation`, full relational validation).
- `runDueContractActivations` — governed claim (`FOR UPDATE SKIP LOCKED`, tenant-bound), atomic
  apply per task, governed complete/fail. Bounded retry (`attempt_count`, `next_retry_at`) →
  `dead_letter` after the bound; the stored `last_error_safe` is redacted.
- Each applied change writes one append-only `pierre_rt_contract_effect_history` row
  (allowlisted fields only). The signed parent is never overwritten.
- Incident: tasks stuck `scheduled` → check `next_retry_at` / `last_error_safe`; `dead_letter`
  tasks need manual review (never silently re-applied).
