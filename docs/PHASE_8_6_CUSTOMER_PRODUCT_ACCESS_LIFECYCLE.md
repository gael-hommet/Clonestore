# PHASE 8.6 — Customer Product & Access Lifecycle

This document describes the P8.6 customer product & access lifecycle: the governed spine that turns a
recognised commercial proof into a usable tenant, and the access lifecycle that governs it thereafter. It
reflects the code as built in migration `supabase/migrations/2026-07-06__pierre_v28_customer_product_access_lifecycle.sql`
and the `src/lib/pierre/v1/*` services. **No live external service is activated by P8.6** (Stripe, Resend,
Yousign, DNS, production Supabase, cloud workers belong to P8.7).

## Canonical model

The system distinguishes, explicitly and separately:

1. **identity** — the authenticated user (Supabase Auth; reused, not rebuilt).
2. **company / tenant** — `pierre_rt_companies` (status: `onboarding|active|suspended|cancellation_pending|cancelled|archived`).
3. **membership** — `pierre_rt_members` (`active|suspended|removed|left`) + role-keys in `pierre_rt_membership_roles`.
4. **commercial proof** — `pierre_rt_commercial_events` (provider-neutral, idempotent, ordered ledger).
5. **product entitlement** — `pierre_rt_product_entitlements` (per-company, the canonical truth of product ownership).
6. **activation** — `pierre_rt_customer_activations` (the provisioning task; `provisioning_key`-guarded; fenced).
7. **onboarding** — `pierre_rt_onboarding_sessions` + `pierre_rt_onboarding_steps` (server-authoritative).
8. **access audit** — `pierre_rt_company_access_events` (append-only).

An authenticated user does **not** automatically have Pierre. An existing company does not automatically
have an entitlement. An active entitlement does not automatically grant the owner role. Each relation is explicit.

## Data model (new in v28)

| Table | Purpose |
|---|---|
| `pierre_rt_commercial_events` | Provider-neutral commercial ledger. Unique `(provider, provider_event_id)`; `occurred_at` is authoritative for ordering. |
| `pierre_rt_product_entitlements` | Per-company entitlement state machine. One live entitlement per `(company, product)` (partial unique index). Carries `last_commercial_event_id/occurred_at/event_key`. |
| `pierre_rt_customer_activations` | Provisioning task. `provisioning_key` unique; `locked_by/claimed_at/lease_expires_at/fencing_token/attempt_count` for governed claim. |
| `pierre_rt_onboarding_sessions` | Onboarding session per company+product; server-computed `progress_percent`. |
| `pierre_rt_onboarding_steps` | One row per registry step; server-computed `evidence_hash`. |
| `pierre_rt_company_access_events` | Append-only access/audit trail (UPDATE/DELETE refused by trigger). |

Reused, not duplicated: `pierre_rt_companies`, `pierre_rt_members`, `pierre_rt_membership_roles`,
`pierre_rt_invitations` (reinforced with `email_normalized/accepted_by/updated_at/version/superseded_at` +
a unique `token_hash` index), `pierre_rt_user_company_prefs`.

## Governed roles (least privilege)

- `pierre_rt_app` — the application role. Reads its own entitlement/activation/onboarding/audit; executes
  onboarding/invitation/membership/ownership/request-activation functions. It can **never** mint an
  entitlement, ingest/resolve a commercial event, mark/claim/provision/block an activation, or self-assign owner.
- `pierre_rt_billing_webhook` — commercial path only: `ingest/resolve/apply_commercial_event`,
  `apply_entitlement_event`, `mark_activation_provisioning`, `block_customer_activation`.
- `pierre_rt_customer_activation_worker` — activation path only: `claim/provision/block`.

Every v28 `SECURITY DEFINER` function pins `search_path = pg_catalog, public` and has `EXECUTE` **revoked
from PUBLIC**, then granted only to the role(s) that need it. The internal audit helper
`pierre_rt_log_access_event` is granted to no external role (it runs inside other definer bodies). Proven
by `p86-security-definer-grants.itest.ts`.

## Commercial events: ordered, atomic application

`ingestCommercialEvent` persists a normalized event (idempotent on `(provider, provider_event_id)`;
conflict on hash mismatch). `pierre_rt_apply_commercial_event(event_id)` is the **single ordered entry
point**: it self-loads the event, resolves the company from **persisted references only** (never the
payload), quarantines an unresolved or future-incoherent event, ignores a **stale** event
(`occurred_at < last_commercial_occurred_at`), transitions the entitlement, and stamps the ordering
authority. Proven by `p86-commercial-ordering.itest.ts`.

Entitlement transitions: `payment_confirmed|subscription_active|subscription_reactivated → active`;
`payment_failed|subscription_past_due → grace`; `subscription_suspended → suspended`;
`subscription_cancelled|refund_confirmed → cancelled`; `subscription_updated → no change`. A
cancel/refund with no live entitlement is ignored.

## Non-forgeable activation

`requestCustomerActivation` derives the owner/requestor from the **session** (`POST /api/pierre/v1/activation`
uses `withUser`; the body never carries `owner_user_id`, a paid status, or a `company_id`). The commercial
proof comes from a **signed handoff token** (HMAC, short TTL, carrying only a commercial reference — no
paid/owner/company authority) or, **non-production only**, Paid-Customer-Test mode (`NODE_ENV=test`, or
non-prod + `PIERRE_PAID_CUSTOMER_TEST_MODE=1`). Proven by `p86-commercial-handoff.itest.ts`.

Provisioning is **claim + fenced**: `claim_customer_activation` bumps the fencing token and takes a lease;
`provision_customer_company` verifies lease ownership + current fencing + live lease + `provisioning`
status before atomically creating company + owner membership + active entitlement + onboarding session +
steps + access event. `provisioning_key` makes two concurrent activations of the same proof yield one
company. Proven by `p86-activation-lease-fencing.itest.ts` and `p86-provisioning-concurrency.itest.ts`.

## Server-authoritative onboarding

`onboarding-completion-rules.ts` defines a real verification per step against persisted tenant data; the
server enforces dependencies, runs the rule, and **computes the evidence hash itself** (the client never
supplies `completed`, `progress_percent`, or an authoritative `evidence_hash`). An unknown product is
refused (never defaults to the Pierre registry). The READY gate (`complete_onboarding_session`) requires
every required step completed + an active/grace entitlement + an active owner; reopening a step reverts a
`ready` activation to `onboarding_required`. Proven by `p86-onboarding-completion-rules.itest.ts`,
`p86-onboarding-server-progress.itest.ts`, `p86-onboarding-ready-gate-reopen.itest.ts`.

## Memberships, invitations, ownership

Invitation tokens are stored only hashed (unique), one-time, TTL-bounded; acceptance is identity-bound
(verified email match) and atomic. Accepting an invitation **never** silently reactivates a
`removed`/`left`/`suspended` membership — that requires a governed reactivation
(`p86-invitation-no-silent-reactivation.itest.ts`). Ownership transfer promotes an active member and never
leaves a staffed company without an active owner (DB constraint trigger `pierre_rt_members_owner_guard` +
the governed transfer function).

## Active tenant + product gate

`withTenant` resolves the active company server-side from the persisted preference
(`resolveActiveCompany` → `pierre_rt_user_company_prefs`) validated against active memberships, then a
single membership. `withProductAccess(req, requirement, handler)` combines `withTenant` +
`resolveProductAccess` and enforces the §19 policy (read / onboarding / write_standard / write_costly /
admin) against the entitlement decision (`allowed|grace|onboarding_required|suspended|read_only|denied`).
It is applied to the onboarding routes; see the closure status for the scope applied so far.

## Frontier with P8.7

P8.6 proves the architecture **locally** (governed roles, idempotency, ordering, fencing, fail-closed
executors) on real in-process Postgres (PGlite). P8.7 activates the **live** integrations: Stripe webhook
signing + real dedicated DSNs/role logins in Supabase, email delivery, DNS, and the cloud workers. The
dedicated executors (`billing-webhook-db.ts`, `customer-activation-db.ts`) are fail-closed: absent their
DSNs they throw, never falling back to a broader role. The opt-in infrastructure smoke
(`check:p86-billing-infrastructure`) is `SKIPPED` until P8.7.
