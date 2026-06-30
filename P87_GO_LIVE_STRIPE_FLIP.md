# P8.7 — STRIPE LIVE FLIP (run just before commercial go-live)

Stripe is intentionally **TEST** during pre-launch. This is the explicit gate that must flip before charging
real customers. No secret value appears in this file.

## Pre-flip state (proven, test mode)
- Test secret + publishable keys valid; price **44900 EUR/month active**.
- Webhook endpoint `https://www.clonestore.pro/api/webhooks/stripe` enabled with the **5 required events**:
  `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.
- Test signing secret installed; route deployed (POST → 400 on unsigned, 405 on GET — fail-closed).

## Flip procedure (owner)
1. In Stripe → **toggle to Live mode**; copy `sk_live_…` + `pk_live_…`.
2. Create/confirm the **live** price = **449 €/month** (44900 EUR), recurring, active, on an active product.
3. Create the **live** webhook endpoint → `https://www.clonestore.pro/api/webhooks/stripe` with the same 5 events;
   copy its **live signing secret**.
4. Set production env on Vercel `clonestore-xcwi` (values never logged):
   `STRIPE_SECRET_KEY=sk_live_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`,
   live `STRIPE_PRICE_PIERRE`, live `STRIPE_WEBHOOK_SECRET`.
5. Redeploy.
6. Run the strict gate — it must now pass with Stripe live:
   ```powershell
   npm run check:p87-external-providers-live   # expect ready:true once Stripe is live
   ```
7. Run the full final battery (glob, npm test, pfinal01/02, build) before announcing commercial go-live.

Until this flip: Stripe stays **READY_SANDBOX**; the strict live gate intentionally fails on Stripe; the
pre-launch gate may pass for everything else.
