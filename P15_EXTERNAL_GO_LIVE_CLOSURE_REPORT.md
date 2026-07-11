# P15 — External Go-Live Closure / Live Stripe Webhook Reconciliation / Owner Authorization

**Date:** 2026-07-09 · **Nature:** the real-world go-live **closure** phase — build + wire + test the closure layer honestly, fail-closed on every missing external proof. **No live payment created, no production enabled, no deployment, no faking.**

> **Verdict: P15 — TECHNICAL GO-LIVE CLOSURE READY / EXTERNAL PROOFS STILL BLOCKED.**

The technical closure layer is built, wired and tested: the P11 billing-country reconciliation is now **wired into the real Stripe webhook activation path** (additive, flag-gated), the read-only Stripe verifier + owner dry-run script exist, and the legal/provider/monitoring/owner gates are structured and fail-closed. **All external proofs are absent locally** (test Stripe key, no external legal review, Yousign not live, no owner sign-off), so the command center reports `TECHNICAL_READY_EXTERNAL_BLOCKED` with all seven gates blocked and **production authorization false** (P10 hard floor).

---

## Answers to the 16 questions

**1. Are live Stripe EUR/CHF prices verified?** **No.** The local key is `sk_test_…` → the read-only verifier returns `TEST_MODE_BLOCKED`. The verification *logic* (EUR 44900/eur/month, CHF 49900/chf/month, active, no cross-currency) is unit-tested (`verifyStripePrice`), and `scripts/p15-verify-stripe-live-readonly.mjs` performs a masked, `prices.retrieve`-only owner dry-run — but with no live key it is honestly blocked.

**2. Is live webhook verified?** **No** locally (no live `STRIPE_WEBHOOK_SECRET` in the test env). The route `/api/webhooks/stripe` already verifies the signature via `stripe.webhooks.constructEvent` **before any effect**, is idempotent (orders upsert `onConflict user_id,agent_slug`), and never returns 200 without verification. Readiness needs the live secret + owner attestation.

**3. Is country reconciliation wired into activation?** **Yes — wired into ALL FOUR activation paths** (fixed after the adversarial review, which correctly found the first pass covered only one path). The gate now runs on: (a) `checkout.session.completed`, (b) `customer.subscription.created`, (c) `customer.subscription.updated` (so an update can't overwrite a block), and (d) `POST /api/checkout/confirm` (the `/paiement/success` auto-POST path). The checkout route **propagates the server-resolved country + expected currency into the Stripe session + subscription metadata**, and the subscription handlers **best-effort fetch the customer's billing country**. The gate uses the Stripe **billing address** as the authoritative signal (with a **currency-consistency** cross-check that catches CH/EUR even without an address). **Honest disclosure:** enforcement is **flag-gated** by `STRIPE_COUNTRY_RECONCILIATION_ENABLED` (default **OFF** → today's behavior unchanged, conflicts audited); with the flag **ON**, a hard conflict writes a **review status (no paid access)**. Gate C therefore requires *wired + enabled + live-verified* — enforcement must be turned on and verified on live payments before public launch.

**4. Can a CH/EUR mismatch activate?** **No (when enforced), on any path.** A Swiss customer billed in EUR → `refund_required` → `shouldActivate=false` → order status `review_required`/`payment_country_conflict`, no paid access — on checkout.session.completed, confirm, and subscription events. Critically, the gate no longer over-blocks legitimate customers: a FR customer billed FR in EUR → `allowed` (the billing address is the reference, and the currency matches).

**5. Can FR/BE/LU/CHF mismatch activate?** **No (when enforced), on any path.** FR/BE/LU billed in CHF → currency mismatch / not `allowed` → no activation. A forged client `selected_country` cannot force activation because the Stripe **billing address (server truth)** is the reference; without a billing address the gate never auto-activates (review), so nothing activates on a weak/forged signal alone.

**6. Are legal/tax artifacts externally reviewed?** **No.** The artifact registry (15 items: legal FR/BE/LU/CH, VAT FR/BE/LU/CH, CGU/CGV/DPA/privacy/mentions/HR-claims/AI-sensitive) is **empty** locally → all missing → `legalTaxReady=false`. Readiness is never a bare boolean: it requires external lawyer/accountant `reviewed|approved` + hash + not-expired; owner attestation is allowed but **disclosed as owner-attested (not external legal proof)**; internal draft alone never counts.

**7. Is Yousign/provider live or fallback approved?** **Neither locally.** `evaluateProviderClosure` → `MISSING`/`BLOCKED` (Yousign P8.7.4 open). Provider readiness is never a bare boolean — `LIVE_VERIFIED` derives from the P11 live attestation (owner-attested + non-sandbox + keys + webhook). An official **fallback** exists ("Pierre prepares the document; human review/signature outside CloneStore; **no live-signature claim**"), approvable by the owner via `CLONESTORE_SIGNATURE_FALLBACK_APPROVED`.

**8. Is monitoring/rollback ready?** **Not attested.** Structural invariants exist (checkout/webhook/reconciliation-conflict logging, emergency disable switches, P10 hard floor); full readiness requires the owner to rehearse the plan + deploy the health route + attest `CLONESTORE_MONITORING_ROLLBACK_VERIFIED`. See [P15_MONITORING_ROLLBACK_PACKET.md](P15_MONITORING_ROLLBACK_PACKET.md).

**9. Is owner approval present?** **No.** [P15_OWNER_GO_LIVE_APPROVAL_PACKET.md](P15_OWNER_GO_LIVE_APPROVAL_PACKET.md) is un-signed; the owner gate is false. No implicit launch from env.

**10. Is public paid launch allowed?** **No** (`publicPaidLaunchAllowed=false`).

**11. Is private pilot allowed?** Only if the owner explicitly chooses `private_pilot_only` **and** no live payment (production off). Not enabled locally.

**12. Is demo-only allowed?** **Yes** — the product remains fully demonstrable without anything live.

**13. Is production authorized?** **No.** `productionAuthorizationAllowed=false`. Even a *full* owner-approved + all-gates-green input yields `READY_FOR_PRODUCTION_AUTHORIZATION` (not authorized): the **P10 hard floor** `PRODUCTION_AUTHORIZED = false as const` requires a deliberate code change — env alone can never authorize.

**14. What blockers remain?** 7: `STRIPE_LIVE_NOT_VERIFIED`, `WEBHOOK_NOT_VERIFIED`, `RECONCILIATION_NOT_LIVE_VERIFIED` (wired, enforcement not enabled/verified), `LEGAL_TAX_ARTIFACTS_MISSING`, `PROVIDER_OR_FALLBACK_MISSING`, `MONITORING_ROLLBACK_NOT_READY`, `OWNER_APPROVAL_MISSING` — plus the P10 hard floor.

**15. Did P15 touch P8–P14 or Pierre runtime?** **No** — except the **justified additive, flag-gated** reconciliation adapter in the pre-existing checkout/webhook activation paths: `src/app/api/webhooks/stripe/route.ts` (B31.7), `src/app/api/checkout/confirm/route.ts`, and additive metadata propagation in `src/app/api/checkout/route.ts` (no pricing/guard logic changed). These are the proven go-live integration gap. No file under `src/lib/pierre/v1`, `src/app/api/pierre/v1`, `pricing` (canon), or the P12/P13/P14 modules was modified; P10/P11 are reused read-only. No second HR brain.

**16. Exact next action:** provide the external proofs (configure live Stripe prices + webhook → owner read-only dry-run → attest; enable + live-verify reconciliation; obtain external legal/tax review or owner-accept disclosed; Yousign live or approve fallback; rehearse + attest monitoring), then complete the owner packet. The **technical layer is ready**; only external/owner items remain.

## Closure layer (new, additive)
Modules under `src/lib/clonestore/production/`: [p15-external-golive-contract.ts](src/lib/clonestore/production/p15-external-golive-contract.ts) (gates A–G, statuses, `evaluateP15ExternalGoLive`/`computeP15LaunchStatus`/`canAuthorizeProduction`/`explainP15Blockers`) · [p15-stripe-live-verification.ts](src/lib/clonestore/production/p15-stripe-live-verification.ts) · [p15-checkout-reconciliation-gate.ts](src/lib/clonestore/production/p15-checkout-reconciliation-gate.ts) · [p15-legal-tax-artifact-registry.ts](src/lib/clonestore/production/p15-legal-tax-artifact-registry.ts) · [p15-provider-closure.ts](src/lib/clonestore/production/p15-provider-closure.ts) · [p15-monitoring-rollback.ts](src/lib/clonestore/production/p15-monitoring-rollback.ts) · [p15-final-command-center.ts](src/lib/clonestore/production/p15-final-command-center.ts). Proofs computed from the real evaluators.

## Gates
- **P15 tests 37/37** (35 closure incl. the reconciliation-fix coverage + 2 computed-proof) · production/webhook/checkout/conversion **213/213** · **tsc 0 source errors** · non-regression **7448/7448** (incl. all of `src/app/api`).
- **Read-only Stripe run** → `TEST_MODE_BLOCKED` (no session/payment/customer created, secrets masked).
- **Command center** `TECHNICAL_READY_EXTERNAL_BLOCKED`; all 7 gates fail-closed; `publicPaidLaunchAllowed=false`; `productionAuthorizationAllowed=false`; `p10HardFloorRespected=true`.
- **No overclaim** (no legal/tax compliance, no Yousign live, no production live) · **P10/P11/P14 guardrails intact** · **Pierre V1 + P8–P14 untouched** (bar the additive flag-gated webhook adapter) · no migration · nothing staged/committed/pushed/deployed.

Proofs: [.p15-proofs/p15-run1/](.p15-proofs/p15-run1/) (stripe-live-readiness · webhook-readiness · billing-country-reconciliation · legal-tax-artifact-registry · provider-closure · monitoring-rollback · owner-approval-packet · final-command-center · tests · perimeter · adversarial-review · final-verdict).
