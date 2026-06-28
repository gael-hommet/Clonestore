# PHASE 8.4 — Communication Delivery Core

Turns governed `pierre_rt_outbox` business events into real, tenant-safe, traceable communications
(in-app messages + real provider email), with governed delivery truth, idempotency, retries,
dead-letter, provider webhooks, preferences and suppressions. **Not legal advice; operational
governance only.**

Migration: `supabase/migrations/2026-06-28__pierre_v20_communication_delivery_core.sql` (idempotent,
non-destructive, applied in order v1→v20, never applied to production by this phase).

## Pipeline

```
business event → pierre_rt_outbox
  → classify (server event registry; payload policy ignored)
  → intent (idempotent, dedup fingerprint; unknown → quarantine)
  → recipient resolution (tenant identities only; no payload address)
  → deliveries (one per feasible channel)
  → claim worker (FOR UPDATE SKIP LOCKED, lease, ownership)
  → render (safe HTML, content hash, secure link)
  → in-app message OR real email provider (idempotency key)
  → append-only attempt + governed status truth
  → provider webhook (Svix) → governed event → state machine
  → delivered / bounced / complained / failed → suppressions
  → retries (bounded backoff) → dead-letter
  → audit / CloneTrace
```

## Modules

| Concern | File |
|---|---|
| Event registry + policies | `communication-event-registry.ts` |
| Recipient resolution (tenant-safe) | `communication-recipient-resolver.ts` |
| Template registry + renderer (safe HTML, hash) | `communication-template-registry.ts`, `communication-renderer.ts` |
| Secure links | `communication-secure-links.ts` |
| Provider contract + Fake | `communication-provider.ts` |
| Resend adapter (HTTP + Svix) | `communication-providers/resend.ts` |
| Fail-closed config | `communication-provider-config.ts` |
| Orchestration (intents/worker/webhook/prefs) | `communications.ts` |
| Routes | `app/api/pierre/v1/communications/**`, `app/api/webhooks/pierre/communications/route.ts` |

## Event registry (P8.4.1)

The ONLY source of a policy is the server registry. A communicable event has an explicit policy
(category, sensitivity, allowed/required channels, recipient strategy, template, suppressibility,
attachment policy, failure policy, max attempts, priority). A known internal lifecycle event is
**non-communicable** (skipped). Anything else is **unknown** → quarantined (kept, signalled, never
dispatched, never a permissive default). A payload-supplied policy is ignored.

## Recipients (P8.4.6)

Resolved from REAL tenant identities only — the employer operator (owner/admin member) for in-app,
the company `signatory_email` for email. A free payload `email`/`company_id` is never authoritative.
A cross-tenant object is invisible (blocked). No address is ever invented.

## Templates (P8.4.8)

Versioned, typed, deterministic. Plain text + safe HTML from one canonical representation; every
variable HTML-escaped at the HTML boundary; declared variables only (unknown/missing → blocked); a
deterministic `content_hash` participates in idempotency. No raw user HTML; action paths must be
app-relative or https on the configured host.

## Secure links (P8.4.9)

Server-generated HMAC token, short-lived, tenant-bound (and recipient-bound when set). Emails never
expose a bucket / object_key / internal URL / permanent token. Sensitive documents are `secure_link_only`.

## In-app delivery (P8.4.10)

The in-app delivery creates a REAL persisted row in `pierre_rt_notifications` (extended), bound to
the recipient user, with title/body/action_path/priority/unread state and a dedup fingerprint.
`delivered` means persisted + accessible to the real recipient — not "function called".

## Provider + idempotency (P8.4.11–13)

Provider-neutral contract; the concrete `resend` adapter speaks the official Resend REST API
(POST `/emails`, Bearer, `Idempotency-Key`) and verifies Svix webhooks. The provider idempotency key
is `communication:<company>:<delivery>:<content_hash>`. An ambiguous post-send timeout is
**reconciled** (looked up by idempotency key) — never a blind resend.

## Worker, retries, dead-letter (P8.4.14–15)

`dispatchCommunicationDeliveries` claims due deliveries atomically (tenant-bound `FOR UPDATE SKIP
LOCKED`), renders, records an append-only attempt, sends, and writes status only through governed
functions that require the worker to OWN a valid lease. Errors are classified (transient/rate/
timeout/permanent/suppressed/config); retries use bounded backoff → dead-letter; permanent errors and
suppressions never retry.

## Webhook + state machine (P8.4.18–19)

`POST /api/webhooks/pierre/communications` verifies the Svix signature + replay window via a
minimal-privilege role, ingests the event idempotently (tenant derived from provider +
message id — never the payload), and the tenant worker applies it: `submitted ≠ delivered`,
`delivered`/`complained` terminal, no regression from an older event, `opened` never flips status, a
bounce/complaint records a suppression.

## Preferences + suppressions (P8.4.17)

A user can opt out of optional/operational categories; mandatory categories (security/transactional/
approval) can never be disabled. A suppressed address is respected; a mandatory communication to a
suppressed address is escalated (not falsely delivered, never looped).

## Roles (P8.4.5)

`pierre_rt_communication_worker` + `pierre_rt_communication_webhook`. The general app role can NEVER
raw-write a delivery status, an attempt, or a provider event — only governed SECURITY DEFINER
functions do. Attempts + provider events are append-only.

## P8.4 / P8.5 boundary

P8.4 supports `scheduled_at`, retry, quiet-hours hooks and dead-letter. Complex autonomous reminders,
job scheduling and continuity belong to **P8.5** and are out of scope here.

## Tests

`npm run test:phase8-4` — registry, outbox→intent, recipient isolation, templates + injection, secure
links, in-app + worker, Resend HTTP contract, retries/dead-letter, preferences/suppressions, provider
webhook + state machine, production fail-closed, DB roles, routes, migration v20, closure.

## Honest limits

PGlite single-connection → worker concurrency proven logically. The real Resend endpoint is NOT
executed (HTTP-mock contract + opt-in SKIPPED smoke). Production deliverability (SPF/DKIM/DMARC,
domain reputation) is **P8.7**. `/profile/messages` legacy-table wiring is a documented boundary (the
in-app message is persisted + readable via the authenticated API; surfacing it in the legacy
read-only page is a separate, minimal wiring task).
