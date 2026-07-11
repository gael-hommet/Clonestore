# P15.1 — Stripe Owner Setup Checklist (do this once the Stripe account is available)

**Do NOT deploy and do NOT lift `PRODUCTION_AUTHORIZED` during this checklist.** This only prepares + verifies the live Stripe configuration read-only. No payment is created.

## Steps

1. **Create / verify the Stripe account** (production, legal/adult account setup complete).

2. **Create the product** `Pierre` (or map to your official product).

3. **Create the EUR monthly price:**
   - amount **44900** · currency **EUR** · billing **monthly (recurring)** · **active** · attached to product Pierre.

4. **Create the CHF monthly price:**
   - amount **49900** · currency **CHF** · billing **monthly (recurring)** · **active** · attached to product Pierre.
   - (Distinct price id from the EUR one — no cross-currency fallback.)

5. **Create the webhook** endpoint `https://<your-domain>/api/webhooks/stripe` subscribed to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

6. **Copy env vars locally** (never commit; never print):
   ```
   STRIPE_SECRET_KEY=sk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…
   STRIPE_PRICE_PIERRE_EUR_MONTHLY=price_…   # 44900 EUR monthly
   STRIPE_PRICE_PIERRE_CHF_MONTHLY=price_…   # 49900 CHF monthly
   ```

7. **Run the read-only verification** (no session, no payment, secrets masked):
   ```
   node scripts/p15-verify-stripe-live-readonly.mjs
   ```
   Expect `verdict: VERIFIED` (EUR 44900/eur/month + CHF 49900/chf/month, both active, distinct). If not, fix the prices — do **not** proceed.

8. **After VERIFIED**, set the owner attestation env (still no deploy):
   ```
   CLONESTORE_STRIPE_LIVE_VERIFIED=true
   STRIPE_COUNTRY_PRICING_ENABLED=true
   STRIPE_COUNTRY_RECONCILIATION_ENABLED=true    # enable payment-time country reconciliation
   ```

9. **Do NOT deploy yet.** Complete the remaining external proofs first: legal/tax review (or owner-accept disclosed), provider live or fallback approved, monitoring/rollback rehearsed + attested, then the owner go-live approval packet.

10. **Do NOT lift `PRODUCTION_AUTHORIZED` yet.** It is a `false as const` hard floor; lifting it is the deliberate final code change, done only when every gate is green.

## Pricing reference
- FR / BE / LU → **449 EUR / month** (44900).
- CH → **499 CHF / month** (49900).

> After this checklist, re-run the P15 command center — it should advance from `TECHNICAL_READY_EXTERNAL_BLOCKED` as each external proof is provided, and only reach production authorization once the P10 floor is deliberately lifted with all gates green + owner sign-off.
