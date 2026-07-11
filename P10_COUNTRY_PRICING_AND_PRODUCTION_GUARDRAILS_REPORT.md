# P10 — Country Pricing & Production Guardrails

**Date:** 2026-07-08 · **Scope:** launch-country pricing (FR/BE/LU/CH), Stripe guardrails, billing-country consistency, production-readiness gate, anti-abuse. **Pierre is not rebuilt** — this is pricing + guardrails only.

---

## Exact country pricing rules

| Countries | Currency | Price / month | Stripe price key | Group |
|-----------|----------|---------------|------------------|-------|
| France, Belgique, Luxembourg | EUR | **449 € / mois** (44900 minor) | `STRIPE_PRICE_PIERRE_EUR_MONTHLY` (legacy `STRIPE_PRICE_PIERRE` accepted as EUR alias) | `EUR_LAUNCH` |
| Suisse | CHF | **499 CHF / mois** (49900 minor) | `STRIPE_PRICE_PIERRE_CHF_MONTHLY` (no alias) | `CHF_LAUNCH` |

Canon: [country-pricing.ts](src/lib/clonestore/pricing/country-pricing.ts) — pure, no Stripe/IO. Unknown country → `country_required` (NEVER the cheapest offer). Valid-but-out-of-perimeter (e.g. US) → `unsupported` (waitlist), never priced.

## What public visitors see (no account needed)

Server-resolved via [`/api/pricing/public`](src/app/api/pricing/public/route.ts) ([resolver](src/lib/clonestore/pricing/public-pricing-resolver.ts)), rendered by [CountryPricingCard](src/components/pricing/CountryPricingCard.tsx) on `/agents/pierre`:
- **FR/BE/LU** confidently → **449 € / mois**.
- **CH** confidently → **499 CHF / mois**.
- **Unknown** → *"Choisissez votre pays de facturation pour afficher le prix exact."* (selector, no price).
- **Weak hint** (Accept-Language) → suggested country, but explicit selection required before checkout.
- **Unsupported** → waitlist/contact message, no checkout.
- Both launch offers are always shown honestly (EUR 449 + CHF 499). Signal precedence: verified company > explicit selection > geo (suggested, revalidated) > Accept-Language (weak) > unknown.

Proven in-browser (`ui-proof.json`, `P10_PRICING_OK`): desktop shows FR 449 € and CH 499 CHF; mobile 390 no horizontal overflow; API returns `requiresCountrySelection:true`+`price:null` for unknown and `supported:false`+`price:null` for US; **0 console errors**.

## How checkout prevents a Swiss customer buying the EUR offer

Checkout is **server-authoritative** ([checkout route P10 branch](src/app/api/checkout/route.ts), [guard](src/lib/clonestore/pricing/checkout-country-guard.ts), [orchestration](src/lib/clonestore/pricing/checkout-pricing-server.ts)):
1. The authoritative billing country is derived server-side: **verified company > billing > selection** (geo/tax are corroboration/log only).
2. The Stripe price is **always derived from that country via the canon** (`resolveStripePriceIdForCountry`) — CH → `STRIPE_PRICE_PIERRE_CHF_MONTHLY`, never the EUR key/alias.
3. A verified/billing **Swiss** country forces the CHF offer (`COMPANY_COUNTRY_CONFLICT` / `BILLING_COUNTRY_CONFLICT` → review + CHF price) even if the client selected FR.
4. If the CHF Stripe price is not configured, CH checkout **fails closed** (`STRIPE_PRICE_NOT_CONFIGURED`, 503) — it never silently uses EUR.

**Live authenticated proof** (`ui-proof.json` auth matrix): a Swiss checkout — *even when the client forges `price_key=EUR`, `price_id=price_hacked`, `currency=EUR`* — returns `STRIPE_PRICE_NOT_CONFIGURED` (CHF unconfigured locally), i.e. it is fail-closed and **never** produces an EUR checkout. A French checkout — even forging `price_key=CHF` — always produces the EUR checkout.

## How client price manipulation is ignored

The client may send `country`, `price_key`, `price_id`, `currency` — the server **ignores** price/currency/id (logged as `ignoredClientPrice`) and derives the price solely from the resolved country + canon. Country is revalidated server-side. Proven: `checkout-country-guard.test.ts` (client priceId/currency ignored) + `checkout-pricing-server.test.ts` (CH+forged EUR → CHF price id) + the live auth matrix.

## How conflicts are handled

- **Strong evidence** (verified company/billing ≠ selection) → **review** state with the correct (forced) price + honest message (e.g. *"Votre pays de facturation indique la Suisse. L'offre applicable est 499 CHF / mois."*).
- **Cheap-direction IP conflict** (IP=CH but resolved to a cheaper EUR country, no verified company) → **review/confirm** (`GEO_WEAK_CONFLICT`, not a silent EUR checkout): *"Votre localisation suggère la Suisse. Confirmez votre pays de facturation."* This closes the revenue-abuse direction while letting a genuine FR traveller confirm (not a permanent hard-block).
- **Same-currency / more-expensive IP conflict** → **allowed + logged** (no revenue abuse; a legitimate user is never hard-blocked — rule 6).
- **Residual (disclosed):** IP is never proof. A fully-anonymous Swiss buyer who both spoofs an FR IP *and* self-selects FR is not caught pre-payment; the backstop is Stripe's card/billing/tax country at payment (the webhook already captures currency). A hard pre-payment guarantee for unverified buyers would need a Stripe billing-country restriction / post-payment reconciliation — listed as a go-live consideration in the production gate.

## Stripe environment required

- `STRIPE_SECRET_KEY` (mode inferred: `sk_test_`→test, `sk_live_`→live), `STRIPE_WEBHOOK_SECRET`.
- `STRIPE_PRICE_PIERRE_EUR_MONTHLY` (or legacy `STRIPE_PRICE_PIERRE`) — EUR.
- `STRIPE_PRICE_PIERRE_CHF_MONTHLY` — CHF (no alias; required for CH checkout).
- `STRIPE_COUNTRY_PRICING_ENABLED` — opt-in flag (default **off**).
- Validator [stripe-pricing-config.ts](src/lib/clonestore/pricing/stripe-pricing-config.ts): fail-closed, **no cross-currency fallback** (EUR↔CHF never), never emits secret values, production requires LIVE mode.

## Audit trail

[pricing-audit.ts](src/lib/clonestore/pricing/pricing-audit.ts): every decision records user/anon id, selected/resolved/geo/company/billing/tax country, requested + resolved price key, currency, decision (`allowed|blocked|review_required|country_required`), reason code, request id, timestamp — and a **salted, truncated IP hash** (`CLONESTORE_IP_HASH_SALT`); **the raw IP is never stored**. Default sink = structured server log (`[p10-pricing-audit]`). No production DB table applied.

## What is still legally / externally pending (disclosed)

- **Country legal review (FR/BE/LU/CH)** NOT finalised — 0/4 launch-grade (per P8.13 DIM B, WITHHELD).
- **VAT/tax treatment** (CH vs EU, CHF vs EUR) NOT externally reviewed. **No final legal/tax advice is made by P10.**
- **Providers** (signature/Yousign) not live (P8.7.4 OPEN).
- **Stripe LIVE** not verified; local is `sk_test_`. CHF price not configured locally.

## Production is NOT enabled

[p10-production-gate.ts](src/lib/clonestore/production/p10-production-gate.ts): `export const PRODUCTION_AUTHORIZED = false`. `evaluateP10ProductionGate` is fail-closed — even with a *perfect* Stripe env it stays CLOSED (legal + provider + owner blockers). The checkout's country path passes `productionReady = isP10ProductionAuthorized()` (false), so enabling the flag in production without owner authorization → `PRODUCTION_DISABLED`. **P10 makes the system launch-ready; it does not launch.**

## Gates

| Gate | Result |
|------|--------|
| tsc | **0 errors** |
| Pricing + production unit tests | **65/65** |
| Non-regression (checkout/founder/go-live/billing/legal/production-readiness) | **747/747** |
| Non-regression (P9 journey/autonomy/assistant/clonechat) | **183/183** |
| Browser + authenticated E2E | **P10_PRICING_OK** (ZERO RESIDUE, 0 console errors) |
| Adversarial review (4 agents, 15 claims) | 0 refuted; 12 held; 3 PARTIAL → **hardened** (see below) |
| P8 / Pierre-V1 | **untouched** |
| Production | **NOT authorized** (`PRODUCTION_AUTHORIZED=false`) · no migration · test Stripe only |

## Adversarial review & hardening (§12)
An independent 4-agent review (opus, high effort) attacked all 15 claims: **0 refuted, 12 held, 3 PARTIAL**. The PARTIALs were addressed in code (not merely disclosed):
1. **Cheap-direction geo abuse** — a Swiss-IP visitor self-selecting FR previously got a silent EUR checkout. Now → **review/confirm** (`GEO_WEAK_CONFLICT`); verified Swiss companies were already forced to CHF.
2. **PRODUCTION_DISABLED / NODE_ENV coupling** — now `requireProduction = isProd OR live-Stripe-keys`, so a misconfigured non-production host with live keys still fails closed.
3. **E2E unknown-state capture** — fixed a loading-race so the "unknown → selector, no price" visible state is truthfully captured and asserted.
Re-run after hardening: 69/69 P10 tests, tsc 0, E2E `P10_PRICING_OK`, non-regression green. Details: `.p10-proofs/p10-run1/adversarial-review.json`.

## No deployment happened
Nothing staged, committed, pushed, or deployed. No production migration applied. Country-aware checkout is opt-in and off by default; the legacy single-EUR-price flow is untouched when the flag is off.

Proofs: [.p10-proofs/p10-run1/](.p10-proofs/p10-run1/) — pricing-canon, public-pricing-resolver, checkout-guard, stripe-config, audit-log-proof, production-gate, ui-proof, tests, perimeter, adversarial-review.
