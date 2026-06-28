# PHASE 8.4 — Delivery Incident Runbook

**Not legal advice.** Operational incident response for communication delivery.

## Surfaces
- `GET /api/pierre/v1/communications` — deliveries + status (no html/secret/address).
- `GET /api/pierre/v1/communications/dead-letter` — dead-lettered deliveries for review.
- `POST /api/pierre/v1/communications/:id/retry` — governed manual retry (failed/dead_letter/submission_unknown only).
- `POST /api/pierre/v1/communications/:id/cancel` — governed cancel (never a sent/delivered one).

## Symptoms → action
- **Webhook 401 spike** → check the Svix `CLONESTORE_EMAIL_WEBHOOK_SECRET` rotation alignment.
- **Deliveries stuck `submission_unknown`** → reconciliation pass; the send may have succeeded — do
  NOT blind resend (the worker reconciles by idempotency key).
- **`retry_scheduled` not progressing** → check `next_retry_at` + `last_error_safe`; the backoff is bounded.
- **`dead_letter`** → operator review; retry manually after fixing the root cause; never raw-update.
- **`bounced` / `complained`** → a suppression is recorded; the address receives no further optional
  email. A mandatory communication to a suppressed address is escalated (operator), never falsely delivered.
- **Mandatory communication blocked (no operator / no email)** → escalate; never mark delivered.

## Invariants (never violate)
- The app role can never fabricate `delivered`/an attempt/a provider event.
- `submitted ≠ delivered`; `delivered`/`complained` are terminal; `opened` ≠ read proof.
- No object key / bucket / secret in an email or a log.
- The tenant is derived from the delivery, never from a webhook payload.
