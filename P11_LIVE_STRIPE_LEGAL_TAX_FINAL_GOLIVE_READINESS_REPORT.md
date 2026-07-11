# P11 — Live Stripe / Legal-Tax / Final Go-Live Readiness

**Date:** 2026-07-08 · **Scope:** the final external readiness layer before launch. P11 is **not** product construction and it does **not** launch. It produces a verified launch-readiness dossier + owner approval packet, fail-closed, production OFF.

> **Verdict: P11 — TECHNICAL READINESS VERIFIED / EXTERNAL GO-LIVE BLOCKED.**
> The P11 readiness machinery is implemented, tested (53 production tests) and honest. Live Stripe, legal/tax, provider (Yousign), monitoring, and owner sign-off are **external-pending**. Production remains disabled (`PRODUCTION_AUTHORIZED = false`, command center `globalStatus = NOT_READY`).

---

## What P11 verified (technical readiness)

| Module | File | Verified |
|--------|------|----------|
| Stripe live readiness | [p11-stripe-live-readiness.ts](src/lib/clonestore/production/p11-stripe-live-readiness.ts) | Env-shape, fail-closed: test key blocks, missing EUR/CHF/webhook/flag blocks, **no cross-currency fallback**, never exposes secrets. Real price-verification logic (`verifyStripePrice`: active + currency + 44900/49900 + monthly + no accidental trial) — unit-tested. |
| Country reconciliation | [p11-stripe-country-reconciliation.ts](src/lib/clonestore/production/p11-stripe-country-reconciliation.ts) | **Implemented + tested** pure module: CH billing on EUR → `refund_required`; company/billing conflict → blocked/review; billing missing → `review_required`; matching → allowed; weak geo alone → warning (not proof); tax/payment-method conflicts → review. |
| Legal/tax readiness | [p11-legal-tax-readiness.ts](src/lib/clonestore/production/p11-legal-tax-readiness.ts) | 11 required documents + FR/BE/LU/CH country checklist + cross-border tax questions (EUR/CHF, reverse charge, entity, Swiss-launch-while-French). Cannot self-verify. |
| Provider readiness | [p11-provider-readiness.ts](src/lib/clonestore/production/p11-provider-readiness.ts) | Yousign sandbox detection + fail-closed `PROVIDER_SIGNATURE_NOT_LIVE`; owner live-attestation required; reuses the P8.13 provider certification. |
| Final readiness | [p11-final-golive-readiness.ts](src/lib/clonestore/production/p11-final-golive-readiness.ts) | Aggregates all dimensions; `productionAuthorized` **derived** (external-technical ready ∧ owner artifact), never hardcoded. |
| Command center | [p11-final-golive-command-center.ts](src/lib/clonestore/production/p11-final-golive-command-center.ts) | `globalStatus` NOT_READY → READY_FOR_OWNER_REVIEW → OWNER_APPROVED_READY_TO_LAUNCH → LAUNCHED (only with an explicit deploy proof). |

**Browser smoke** (`browser-smoke.json`, `P11_SMOKE_OK`): public card FR **449 €** / CH **499 CHF** / unknown → selector / mobile 390 no overflow, 0 console errors; authenticated `no country → COUNTRY_REQUIRED`, `CH → STRIPE_PRICE_NOT_CONFIGURED` (fail-closed **even when forging the EUR price**). **Zero Stripe sessions created; ZERO RESIDUE.**

## What P11 could NOT verify (requires external / live access) — EXTERNAL PENDING

- **Live Stripe: NOT verified.** Local is `sk_test_`; no CHF price; country-pricing flag off. `liveApiVerified = false`. A read-only owner dry-run against live keys (`prices.retrieve` EUR+CHF; no checkout, no payment) is required, then `CLONESTORE_STRIPE_LIVE_VERIFIED`.
- **Legal/tax: NOT externally verified.** All documents + countries are `external_pending`. `LEGAL_TAX_READY = false`. Requires an external legal review (CGU/CGV/DPA/…) and a tax/VAT review (EUR/CHF, CH vs EU, B2B/reverse charge, entity) for FR/BE/LU/CH.
- **Provider (Yousign): NOT live.** Sandbox (`api-sandbox.yousign.app`), blocked by **P8.7.4**. `PROVIDER_SIGNATURE_NOT_LIVE`.
- **Webhook live: NOT verified** (secret present in shape only; live delivery unverified).
- **Monitoring / rollback: NOT verified.**
- **Owner go-live approval: ABSENT** (no `CLONESTORE_OWNER_GOLIVE_APPROVED` + signer artifact).
- **Deployment: none** (P11 does not deploy).

## Country pricing (unchanged from P10, confirmed by smoke)
FR / BE / LU → **449 EUR / month** · CH → **499 CHF / month**. Checkout server-authoritative; client price/country/currency ignored; Stripe price IDs separated; **CH can never buy EUR** (fail-closed when CHF unconfigured; forced CHF for verified Swiss companies; P11 reconciliation adds a payment-time backstop for the billing/card/tax country).

## Go-live status (computed)
`globalStatus = NOT_READY` · `productionAuthorized = false` · `publicLaunchAllowed = false` · `privatePilotAllowed = false` · `paidCustomerAllowed = false` · `ownerApprovalRequired = true` · 7 missing proofs. `runtimeProductionAuthorizedConst` (P10) = **false** (defense in depth).

## Gates
- tsc **0** · production tests **53/53** · pricing **61/61** · non-regression **774/774** + durable itest **24/24** · browser smoke **P11_SMOKE_OK**.
- P8 / Pierre-V1 **untouched**; P9 proofs intact; P10 pricing/checkout/gate **not modified** (P11 only consumes them read-only).
- **No live Stripe used · no live payment · no Stripe session created in smoke · no migration applied · no secrets printed · nothing staged/committed/pushed/deployed.**

## Adversarial review (§11) & hardening
Independent 3-agent review (opus, high effort) attacked 13 claims: **0 refuted, 9 held, 4 PARTIAL**. Two concrete code fixes applied (not just disclosed):
1. **Reconciliation currency gap CLOSED** — `reconcileStripeCountry` now validates `chargedCurrency` against the expected country's currency **unconditionally** (even when the billing country matches): CH-billed-EUR / FR-billed-CHF → `refund_required`.
2. **P10 const made a real hard floor** — `productionAuthorized = externalTechnicalReady ∧ ownerApproved ∧ P10_PRODUCTION_AUTHORIZED(const)`; `LAUNCHED` requires it, so both are **unreachable via env flags** while the const is false (a deliberate code change is required).

**Honest attestation-model disclosure:** each go-live dimension (stripe-live, legal, tax, provider, country-recon-live, monitoring, owner, deploy) is gated by an **owner-attestation env flag** — trust-based, not artifact/signature-bound. This is inherent to an owner-approval dossier (P11 cannot verify the external world); it is **fail-closed and honest** in the real environment (all flags absent → `NOT_READY`, `productionAuthorized=false`). A recommended future hardening binds each flag to a signed artifact (like the go-live proof registry). The billing-country reconciliation is a **tested library not yet wired into the live webhook** — disclosed (`countryReconciliation.ready=false`); it must be integrated before go-live. Details: `.p11-proofs/p11-run1/adversarial-review.json`.

## Explicit statements (per §12)
- FR/BE/LU → **449 EUR**; CH → **499 CHF**.
- Live Stripe readiness: **NOT verified** (test mode; owner dry-run required).
- Billing-country reconciliation: **implemented + tested** (payment-time; not a legal-finality claim).
- Legal/tax: **external pending** (not verified) for FR/BE/LU/CH.
- Provider/Yousign: **sandbox / blocked (P8.7.4)** — not live.
- Final go-live gate: **present** (`p11-final-golive-command-center.ts`).
- `PRODUCTION_AUTHORIZED` = **false**; owner approval **required**.
- P8/P9/P10 **untouched**; **no deployment; no live payment; no secrets exposed.**

Proofs: [.p11-proofs/p11-run1/](.p11-proofs/p11-run1/). Owner packet: [P11_OWNER_APPROVAL_PACKET.md](P11_OWNER_APPROVAL_PACKET.md).
