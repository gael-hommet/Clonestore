# P15.1 — Pre-Stripe Go-Live Prep / Demo-Only Safe Launch Mode

**Date:** 2026-07-09 · **Nature:** prepare everything that can be prepared **without** Stripe live. **Not** a paid launch, **not** production authorization, **not** a live Stripe closure. A safe demo / private-pilot / no-payment preparation mode. No payment created, no production enabled, `PRODUCTION_AUTHORIZED` untouched, no deploy, no secrets printed.

> **Verdict: P15.1 — PRE-STRIPE GO-LIVE PREP VERIFIED / STRIPE LIVE STILL BLOCKED.**

---

## Answers to the 8 questions

**1. Can we launch paid publicly without Stripe live?** **No.** `resolvePaymentMode` never returns `"live"` while `PRODUCTION_AUTHORIZED` (P10 const) is `false` — even with live keys it resolves to `"disabled"` (fail-closed). The command center reports `publicPaidLaunchAllowed=false`, `productionAuthorizationAllowed=false`.

**2. Can we demo without Stripe live?** **Yes.** `/demo` and the founder-access flow work with no payment. `paymentModeStatus.allowedActions` = see pricing, request a demo, request founder access, be notified of launch, prepare onboarding.

**3. Can we collect demo/founder requests without Stripe live?** **Yes** — the existing `/reserver/pierre` reservation + founder-access flow collects requests with **no Stripe checkout, no subscription, no fake activation** (`prelaunchStatus.noneOfTheActionsActivatePaidAccess=true`).

**4. Is paid activation blocked?** **Yes.** In `disabled` mode `canCreateCheckoutSession=false`; the checkout route short-circuits via `paymentExplicitlyBlocked()` **before any Stripe interaction** (returns a friendly "payment not open — request a demo/founder access" 200, no session). And no paid access can activate without webhook-verified activation + reconciliation (P15). CH/EUR and FR/BE/LU/CHF mismatches remain blocked in the reconciliation logic (test-mode rehearsal proof).

**5. Is production still off?** **Yes** — `PRODUCTION_AUTHORIZED = false as const` (untouched). Owner approval alone cannot authorize production or a paid launch (unit-tested).

**6. Is Stripe live still blocked?** **Yes** — the local key is `sk_test_`; the read-only verifier returns `TEST_MODE_BLOCKED`. Nothing fakes Stripe live readiness.

**7. What exactly must the owner do once Stripe is available?** Follow [P15_1_STRIPE_OWNER_SETUP_CHECKLIST.md](P15_1_STRIPE_OWNER_SETUP_CHECKLIST.md): create the account → product Pierre → EUR 44900/month + CHF 49900/month (active, distinct) → webhook (5 events) → copy env vars locally (no commit) → `node scripts/p15-verify-stripe-live-readonly.mjs` → attest — **do not deploy, do not lift `PRODUCTION_AUTHORIZED`**.

**8. What remains blocked?** Live Stripe prices + webhook (external), reconciliation live-verification (owner enable + attest), legal/tax external review ([P15_1_LEGAL_TAX_REVIEW_PACKET.md](P15_1_LEGAL_TAX_REVIEW_PACKET.md)), signature live or approved fallback ([P15_1_SIGNATURE_FALLBACK_PACKET.md](P15_1_SIGNATURE_FALLBACK_PACKET.md)), monitoring/rollback attestation, owner go-live sign-off, and the deliberate lift of the P10 hard floor. Command center: `TECHNICAL_READY_EXTERNAL_BLOCKED`.

## What P15.1 built (additive, safe)
- **[p15-1-payment-mode.ts](src/lib/clonestore/production/p15-1-payment-mode.ts)** — `PaymentMode = "disabled" | "test" | "live"`; `resolvePaymentMode` (never `"live"` while P10 floor is false), `canCreateCheckoutSession`, `paidAccessPossible`, `paymentExplicitlyBlocked`, `paymentModeStatus`.
- **[p15-1-prelaunch.ts](src/lib/clonestore/production/p15-1-prelaunch.ts)** — pre-launch notice ("Le paiement en ligne n'est pas encore ouvert."), demo/founder actions (all non-paid), safe signature copy + `verifyNoLiveClaim` (forbids "Yousign live" / "signature automatique" / "Stripe live" / "production live").
- **Checkout guard** — additive `paymentExplicitlyBlocked()` short-circuit in `src/app/api/checkout/route.ts` (fires only on explicit disable or live-keys-without-authorization; the existing no-key 503 and test-mode flow are untouched).
- Packets: legal/tax review, signature fallback, owner Stripe checklist. Monitoring/rollback packet already exists (P15).

## Adversarial review (safety)
[adversarial-review.json](.p15-proofs/p15-1-prestripe/adversarial-review.json) — focused attacker on "does anything enable payment/paid access": **8 claims → 7 HOLDS / 1 PARTIAL / 0 REFUTED, no unsafe payment path.** The PARTIAL was a copy-hygiene defect (the guard error copy contained "Stripe live") — **fixed** (reworded + a test that runs the guard copy through the project's own `verifyNoLiveClaim`). Everything else HOLDS: payment never `live`, guard additive, demo non-paid, reconciliation blocking, owner-alone can't authorize, production off, additive perimeter.

## Gates
- **P15.1 tests 15/15** (13 safety incl. the copy-linter lock + 2 computed-proof) · production/pricing/checkout/webhook **173/173** · **tsc 0 source errors** · non-regression **6831/6831**.
- **Command center**: `demoOnlyAllowed=true`, `publicPaidLaunchAllowed=false`, `productionAuthorizationAllowed=false`, `stripeLiveReady=false`, `ownerApprovalPresent=false`, `paymentMode=disabled`, `nextStep="Wait for live Stripe account, then run the P15 owner external proof run."`
- **Read-only Stripe run** → `TEST_MODE_BLOCKED` (no session/payment/customer, secrets masked).
- **No payment created · no production enabled · `PRODUCTION_AUTHORIZED` untouched (false) · no deploy · no live claim in copy** · P8–P15 + Pierre V1 untouched (only the additive checkout guard + new p15-1 modules) · no second HR brain.

Proofs: [.p15-proofs/p15-1-prestripe/](.p15-proofs/p15-1-prestripe/) (payment-disabled-mode · demo-founder-flow · stripe-test-rehearsal · legal-tax-packet-prepared · signature-fallback-prepared · monitoring-rollback-prepared · stripe-owner-checklist · final-command-center).
