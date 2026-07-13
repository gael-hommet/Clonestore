# E1 — Stripe External Setup Plan (no live activation)

**Nature:** the exact owner actions to make Stripe live‑ready **without** enabling live mode in E1. Recovers the real P15.1 state. Uses **test mode only**; creates no live product/customer/checkout, processes no payment, enables no live mode, infers nothing "live" from code, bypasses no business/identity/banking requirement. Sources: `p15-1-payment-mode.ts`, `p15-stripe-live-verification.ts`, `p15-checkout-reconciliation-gate.ts`, `country-pricing.ts`, `P15_1_STRIPE_OWNER_SETUP_CHECKLIST.md`.

## What is already coded + test‑ready (local)
- **Product/price mapping:** one Pierre offer, monthly; FR/BE/LU → 449 EUR, CH → 499 CHF; **no cross‑currency fallback** (CH never EUR, FR/BE/LU never CHF).
- **Checkout construction:** server‑authoritative country/currency resolution + metadata propagation; success/cancel URLs from `NEXT_PUBLIC_APP_URL`.
- **Reconciliation gate:** wired into all 4 activation paths (checkout.session.completed, subscription.created/updated, /api/checkout/confirm); Stripe billing address authoritative; currency‑consistency cross‑check catches CH/EUR even without an address.
- **Webhook:** `/api/webhooks/stripe` verifies the signature via `constructEvent` **before any effect**; idempotent activation (orders upsert `onConflict user_id,agent_slug`); 5 events handled.
- **Payment mode:** `resolvePaymentMode` never returns `live` while the P10 floor is false — even with live keys → `disabled`.
- **Tax/VAT:** disclosed as pending external review (see legal owner actions); no tax claim in code.

## Owner actions (exact, in order)
1. **Authorized Stripe account** — create the account with a **verified business/legal identity** and a **bank account**. (Requires the legal authority to do so; not bypassable.)
2. **Product + test prices first** — create the Pierre product; create **test** prices `sk_test_` EUR 44900/month + CHF 49900/month (active, distinct) to rehearse.
3. **Live prices later** — create **live** prices EUR 44900/month + CHF 49900/month; copy the ids to `STRIPE_PRICE_PIERRE_EUR_MONTHLY` / `STRIPE_PRICE_PIERRE_CHF_MONTHLY` (host secret manager, never committed).
4. **Webhook endpoint registration** — register `https://<domain>/api/webhooks/stripe`; enable `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
5. **Webhook secret placement** — copy the `whsec_…` secret to `STRIPE_WEBHOOK_SECRET` (server‑only).
6. **Production domain URLs** — set `NEXT_PUBLIC_APP_URL=https://<domain>` so return/success URLs are correct.
7. **Country + reconciliation flags** — `STRIPE_COUNTRY_PRICING_ENABLED=true`; `STRIPE_COUNTRY_RECONCILIATION_ENABLED=true`, then live‑verify and attest `CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED`.
8. **Tax/commercial configuration** — configure VAT/tax per the legal/tax review (external).
9. **Owner read‑only verification** — run `node scripts/p15-verify-stripe-live-readonly.mjs` (prices.retrieve only; secrets masked; no session/payment) → attest `CLONESTORE_STRIPE_LIVE_VERIFIED`.
10. **Final owner authorization** — complete the go‑live packet; then a deliberate code change lifts the P10 hard floor. **Do not deploy or lift the floor during setup.**

## What must stay true (command center invariants)
- `paymentMode` **≠ live** · Stripe live **blocked** · `productionAuthorized` **false** · `readyForProductionActivation` **false**.
- The read‑only verifier returns `TEST_MODE_BLOCKED`/`EXTERNAL_BLOCKED` until live keys + owner dry‑run exist — never fake‑ready.
- CH/EUR and FR·BE·LU/CHF mismatches remain blocked in the reconciliation logic.

## Forbidden claims
Do not claim "Stripe live configured", "live prices exist", "webhook registered", or process a live payment — from code or env names.
