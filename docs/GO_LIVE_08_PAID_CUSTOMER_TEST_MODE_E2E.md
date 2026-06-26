# GO-LIVE 08 — Paid Customer E2E Test Mode Checklist

**For Gael Hommet — Manual run required.**
This checklist validates the full paid customer flow using Stripe TEST mode only.

> **NO real payments. NO live Stripe keys. NO production data.**
> Complete all steps with `sk_test_` keys and Stripe test cards only.

---

## Pré-requis

Before starting, ensure the following:

1. `.env.local` contains Stripe test keys:
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `STRIPE_PRICE_PIERRE=price_...` (test price ID, 449 EUR/month)

2. `.env.local` contains Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL=https://...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`
   - `SUPABASE_SERVICE_ROLE_KEY=eyJ...`

3. Stripe CLI installed (for local webhook forwarding):
   ```
   stripe --version
   ```
   Install: https://stripe.com/docs/stripe-cli

4. A test account exists in Supabase Auth (email/password).

5. Environment check passes:
   ```
   npm run check:paid-customer-testmode
   ```

---

## Step 1 — Launch the site

```
npm run dev
```

Site should be available at `http://localhost:3000`.

---

## Step 2 — Start Stripe CLI webhook forwarding

In a **separate terminal**, run:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret printed by the CLI:
```
> Ready! Your webhook signing secret is whsec_... (^C to quit)
```

Update `.env.local`:
```
STRIPE_WEBHOOK_SECRET=whsec_...  ← paste here
```

Then restart `npm run dev` to pick up the new secret.

---

## Step 3 — Log in with your test account

Navigate to `http://localhost:3000/login` and sign in with your test account.

Verify you are authenticated (profile accessible at `/profile`).

---

## Step 4 — Go to checkout

Navigate to:
```
http://localhost:3000/checkout?agent=pierre
```

Verify:
- [ ] Pierre is shown with price 449€/mois
- [ ] "Continuer vers le paiement" button is visible
- [ ] CGV and confidentialité links are present

---

## Step 5 — Launch checkout → Stripe

Click **"Continuer vers le paiement"**.

You should be redirected to a Stripe-hosted checkout page in **test mode** (visible in the URL or Stripe branding).

---

## Step 6 — Pay with Stripe test card

Use the official Stripe test card:

```
Card number: 4242 4242 4242 4242
Expiry:      Any future date (e.g. 12/28)
CVC:         Any 3 digits (e.g. 123)
Name:        Any name
Email:       Your test account email
```

Other test cards (for edge cases):
```
Card requiring 3DS:  4000 0025 0000 3155
Card that declines:  4000 0000 0000 9995
```

Complete the payment.

---

## Step 7 — Verify redirect to /paiement/success

After payment, you should be redirected to:
```
http://localhost:3000/paiement/success?agent=pierre&session_id=cs_test_...
```

Verify:
- [ ] Page shows "Paiement reçu" or "Activation confirmée"
- [ ] "Accéder à Pierre" CTA is visible
- [ ] No error messages

Copy the `session_id` from the URL. You will use it for verification.

---

## Step 8 — Verify in Stripe Dashboard (test mode)

Go to: https://dashboard.stripe.com/test/payments

Verify:
- [ ] A payment exists for your test account
- [ ] Status: Paid (or "Trial started" if trial is active)
- [ ] Event `checkout.session.completed` appears in Events tab

Go to: https://dashboard.stripe.com/test/subscriptions

Verify:
- [ ] Subscription exists for your test customer
- [ ] Status: Active or Trialing

---

## Step 9 — Verify webhook received (Stripe CLI)

In your Stripe CLI terminal, look for:
```
--> checkout.session.completed [evt_...]
<-- [POST /api/webhooks/stripe] [200 OK]
```

Verify:
- [ ] `checkout.session.completed` received with `200 OK`
- [ ] No errors in the webhook handler output

---

## Step 10 — Verify Supabase `orders` table

In Supabase Dashboard → Table Editor → `orders`:

Verify for your test user:
- [ ] Row exists with `agent_slug = pierre`
- [ ] `status = active` or `status = trialing`
- [ ] `stripe_subscription_id` is set
- [ ] `started_at` is recent
- [ ] `ended_at` is null

Or run (with `STRIPE_TEST_USER_EMAIL` set):
```
node scripts/paid-customer-testmode-e2e.mjs
```

---

## Step 11 — Verify Pierre access

Navigate to:
```
http://localhost:3000/agents/pierre/setup
```

Verify:
- [ ] Page loads without redirect to login/checkout
- [ ] Pierre setup form is accessible

Navigate to:
```
http://localhost:3000/agents/pierre/use
```

Verify:
- [ ] Pierre cockpit loads
- [ ] Pierre is shown as active
- [ ] No "accès requis" or redirect to checkout

---

## Step 12 — Cancel subscription (test)

Go to Stripe Dashboard test mode:
https://dashboard.stripe.com/test/subscriptions

Find the test subscription → Cancel immediately.

In your Stripe CLI terminal, look for:
```
--> customer.subscription.deleted [evt_...]
<-- [POST /api/webhooks/stripe] [200 OK]
```

Verify:
- [ ] `customer.subscription.deleted` received with `200 OK`

---

## Step 13 — Verify access revoked

In Supabase `orders` table:
- [ ] `status = canceled`
- [ ] `ended_at` is set to current timestamp

Navigate to:
```
http://localhost:3000/checkout?agent=pierre
```

Verify:
- [ ] Checkout page shows Pierre is not active (or is available for re-purchase)

---

## Step 14 — Generate evidence file

Run the verification script:
```
node scripts/paid-customer-testmode-e2e.mjs
```

This generates:
```
go-live-evidence/paid-customer-testmode/paid-customer-testmode-e2e.txt
```

Fill in any remaining fields manually.

---

## Step 15 — Copy proof templates

After all steps pass, copy proof templates from the script output into `go-live-proofs.local.json`.

**DO NOT** auto-write proofs. Copy manually after verifying each step.

Proofs to record:
- `STRIPE_TEST_CHECKOUT_E2E_STARTED`
- `STRIPE_TEST_PAYMENT_SUCCESS_E2E_VERIFIED`
- `STRIPE_TEST_WEBHOOK_RECEIVED`
- `PIERRE_ACCESS_AFTER_TEST_PAYMENT_VERIFIED`
- `PIERRE_SETUP_AFTER_TEST_PAYMENT_VERIFIED`
- `PIERRE_COCKPIT_AFTER_TEST_PAYMENT_VERIFIED`
- `STRIPE_TEST_SUBSCRIPTION_CANCEL_VERIFIED`
- `PIERRE_BLOCK_AFTER_TEST_CANCEL_VERIFIED`
- `PAID_CUSTOMER_TESTMODE_E2E_COMPLETED`

---

## Safety reminders

| Rule | Status |
|------|--------|
| No sk_live_ keys | Required |
| No real payments | Required |
| No OpenAI calls | Required |
| No Anthropic calls | Required |
| No real emails sent | Required |
| No go-live-proofs.local.json auto-modified | Required |
| No public launch flag modified | Required |
| No client data written | Required |

---

## After GO-LIVE 08

GO-LIVE 08 test mode verification does **NOT** enable public launch.

Remaining blockers before public launch:
1. Société Aurexia/CloneStore immatriculée
2. Stripe live keys configured (`sk_live_...`)
3. Stripe live price 449 EUR/month created
4. Stripe live webhook configured and tested
5. CGV/CGU/confidentialité reviewed by a lawyer
6. RLS verified in production Supabase

GO-LIVE 09 = Stripe live E2E with first real paying customer.

---

_GO-LIVE 08 — 2026-05-31_
