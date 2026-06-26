# PHASE 8.3-B3 — Governed E-Signature Core

Architecture of the Pierre e-signature runtime. **Not legal advice** — operational governance only.

## Provider-neutral architecture

| Concern | Module |
|---|---|
| Provider contract + Fake (tests) | `signature-provider.ts` |
| Concrete adapter (Yousign API v3) | `signature-providers/yousign.ts` |
| Provider resolution (env, fail-closed) | `signature-provider-config.ts` |
| Canonical event model + status mapping | `signature-events.ts` |
| Orchestration (submit/process/finalize/reconcile/cancel/activate) | `signatures.ts` |
| Webhook receipt (HMAC, governed ingress) | `signature-webhooks.ts` + `signatures.receiveSignatureWebhook` |
| Public webhook route | `app/api/webhooks/pierre/signature/route.ts` |
| Internal routes | `app/api/pierre/v1/contracts/[id]/signature/**`, `app/api/pierre/v1/signatures/**` |
| DB runtime | migration `2026-06-23__pierre_v16_signature_provider_runtime.sql` |

`SignatureProvider` is provider-neutral, typed, idempotent, has no Next.js / business-table
dependency and leaks no secrets. The `FakeSignatureProvider` drives deterministic tests and is
**never** presented as live. A live provider is built ONLY when `CLONESTORE_SIGNATURE_PROVIDER`
+ `CLONESTORE_SIGNATURE_API_URL` + `CLONESTORE_SIGNATURE_API_KEY` + `CLONESTORE_SIGNATURE_WEBHOOK_SECRET`
are present (else fail-closed).

## Target journey

`final → prepare → provider create → upload final PDF → recipients → activate → submitted →
provider events (webhook, verified) → reconciliation (safety net) → completed → download signed
document → download evidence → integrity + clean scan → private storage → signed document
version → evidence record → contract version signed → contract signed → audit/trace/outbox →
amendment/contract activation`.

## Submission (`submitContractToSignatureProvider`)

Requires `ready_for_signature` (idempotent: an existing provider request returns as-is, even
once the contract is `submitted`). Verifies the finalized + clean PDF, the recipients and their
emails, then `createRequest` (idempotent key — and a post-create timeout is recovered via
`findRequestByIdempotencyKey`, never re-created), persists `provider_request_id` immediately,
uploads the document, adds recipients, activates, and transitions the contract to `submitted`.

## Webhook + async processing

The public route HMAC-verifies through the provider, resolves the local request id via the
governed `pierre_rt_resolve_signature_request` function (the ingress role never reads business
tables), and ingests through the B2F governed function — which writes the service-only webhook
row AND enqueues a tenant-scoped `pierre_rt_signature_events` row. The app-role worker
(`processPendingSignatureEvents`) maps provider events → canonical → forward-only status, with
**monotonic** ranks so out-of-order events never regress; unknown events are kept `unknown` and
never applied.

## Finalization (`finalizeSignedContract`)

A provider `completed` NEVER signs the contract by itself. Finalization reloads provider state
(all recipients signed), downloads the signed document + evidence, **stores + scans them
(must be clean)**, creates a signed document version, writes `pierre_rt_signature_evidence`
(content hash before/after, integrity verified), and only then marks the request `completed`,
the contract version `signed`, the contract `signed` (+ `signed_at`). Any download/scan/evidence
failure leaves the contract unsigned and flags reconciliation. The signed original is immutable
(v14/v15 triggers).

## Reconciliation (`reconcileSignatureRequests`)

A safety net for missed webhooks: scans open requests, asks the provider, finalizes the
completed ones, applies terminal states — and **never creates a second provider request**.
Bounded retry → dead-letter after the threshold.

## Amendment activation (`activateSignedAmendment`)

A signed amendment activates only the amendment; the signed original is never overwritten. A
future `effective_from` is deferred; activation is idempotent (one audited activation).

## Events (B3.14)

`signature.provider_request_created / document_uploaded / recipient_created / request_activated /
evidence_downloaded / signed_document_stored / completed`, plus the contract `contract.signed`
and `contract.amendment_activated`. Deterministic dedup keys; no secrets, payloads, document
bytes or unnecessary PII in audit/outbox.

## External limits (honest)

The live provider call is exercised ONLY by the opt-in smoke (`check:p83-b3-live-signature`,
gated by `CLONESTORE_SIGNATURE_LIVE_SMOKE_ENABLED=true`). Without it, the provider runtime is
proven locally against the deterministic Fake + the real Yousign adapter's request shaping;
**the live provider is NOT executed** and is never declared validated.
