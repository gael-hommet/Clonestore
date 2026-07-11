# P11 — Owner Approval Packet (Go-Live)

**Purpose:** give the owner everything needed to decide whether to authorize the CloneStore / Pierre launch. **Nothing here auto-approves.** Production stays OFF until the owner explicitly signs off *and* the external items below are genuinely done.

**Current machine status:** `globalStatus = NOT_READY` · `PRODUCTION_AUTHORIZED = false` · public launch **not** allowed.

---

## 1. What is verified (by code + tests)

**Product / pricing (P8–P10):**
- Pierre = authoritative AI HR employee (P8.14). CloneChat = interface/cockpit (P9.4.2/9.6). Autonomy UX (P9.5).
- Country pricing (P10): **FR/BE/LU → 449 EUR/mo**, **CH → 499 CHF/mo**; checkout server-authoritative; client price/country/currency ignored; separated Stripe price IDs; **CH cannot buy EUR** (fail-closed).

**P11 technical readiness (this phase):**
- Stripe live readiness checker (fail-closed, no cross-currency fallback, no secret exposure) + real price-verification logic (`verifyStripePrice`).
- **Billing-country reconciliation** implemented + tested (CH-billing-on-EUR → refund; conflicts → block/review; missing → review; matching → allowed).
- Legal/tax readiness **packet** (11 documents + FR/BE/LU/CH + tax questions) — structure ready.
- Provider readiness (Yousign) fail-closed.
- Final go-live command center + this packet.
- 53 production tests, 61 pricing tests, 774 non-regression + 24 durable itest, tsc 0, browser smoke `P11_SMOKE_OK` (0 Stripe sessions, 0 residue).

## 2. What is still PENDING (external — required before go-live)

| Item | Status | Owner action |
|------|--------|--------------|
| Live Stripe keys (`sk_live_`) | ❌ test mode | Configure live keys |
| EUR live price (active, monthly, 44900 eur) | ❌ | Create + verify in Stripe |
| CHF live price (active, monthly, 49900 chf) | ❌ | Create + verify in Stripe |
| Live webhook + signature | ❌ | Configure + verify delivery |
| Legal review (CGU/CGV/DPA/privacy/mentions/…) FR/BE/LU/CH | ❌ external_pending | Lawyer review |
| Tax/VAT review (EUR/CHF, CH vs EU, B2B/reverse charge, entity, Swiss-launch-while-French) | ❌ external_pending | Accountant/tax review |
| Yousign / signature LIVE | ❌ sandbox, blocked P8.7.4 | Lift P8.7.4, go live, verify |
| Billing-country reconciliation on LIVE data | ❌ | Verify against live payments |
| Monitoring + rollback + kill-switch | ❌ | Ops verification |
| Owner go-live sign-off | ❌ | This packet |
| Deployment authorization + smoke | ❌ | Final step |

## 3. Exact go-live checklist

1. ☐ Create + verify **EUR** live price (active, recurring monthly, `unit_amount` 44900, currency eur).
2. ☐ Create + verify **CHF** live price (active, recurring monthly, `unit_amount` 49900, currency chf).
3. ☐ Set `STRIPE_PRICE_PIERRE_EUR_MONTHLY`.
4. ☐ Set `STRIPE_PRICE_PIERRE_CHF_MONTHLY`.
5. ☐ Configure + verify the **live webhook** (`STRIPE_WEBHOOK_SECRET`, delivery test).
6. ☐ Set `STRIPE_COUNTRY_PRICING_ENABLED=true`.
7. ☐ Owner read-only Stripe **live dry-run** (`prices.retrieve` EUR+CHF; no checkout, no charge) → set `CLONESTORE_STRIPE_LIVE_VERIFIED`.
8. ☐ Verify public country pricing UI (FR 449 € / CH 499 CHF / unknown selector / mobile).
9. ☐ Verify checkout **FR** (EUR).
10. ☐ Verify checkout **CH** (CHF).
11. ☐ Verify **CH cannot buy EUR** (forced CHF / fail-closed).
12. ☐ Verify **billing-country mismatch** handling on live data → set `CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED`.
13. ☐ Legal docs reviewed → set `CLONESTORE_LEGAL_REVIEW_PROOF`.
14. ☐ Tax/VAT reviewed → set `CLONESTORE_TAX_REVIEW_PROOF`.
15. ☐ Provider (Yousign) live verified → set `CLONESTORE_SIGNATURE_LIVE_VERIFIED`.
16. ☐ Monitoring + rollback verified → set `CLONESTORE_MONITORING_ROLLBACK_VERIFIED`.
17. ☐ **Owner sign-off** (section 4 below) → `CLONESTORE_OWNER_GOLIVE_APPROVED` + `CLONESTORE_OWNER_GOLIVE_APPROVED_BY`.
18. ☐ Flip the P10 runtime switch (`PRODUCTION_AUTHORIZED`) deliberately in code.
19. ☐ Deploy → set `CLONESTORE_DEPLOY_PROOF`.
20. ☐ Smoke test in production.
21. ☐ Monitor.
22. ☐ Rollback plan ready.

## 4. Owner sign-off (DO NOT pre-fill — owner completes manually)

```
Signer (name):                 ____________________________
Date:                          ____________________________
Approved countries:            ☐ FR  ☐ BE  ☐ LU  ☐ CH
Approved prices:               ☐ 449 EUR/mo (FR/BE/LU)   ☐ 499 CHF/mo (CH)
Approved Stripe mode:          ☐ LIVE (sk_live_) verified
Approved legal docs:           ☐ CGU ☐ CGV ☐ DPA/RGPD ☐ Privacy ☐ Mentions ☐ Refund ☐ Payment terms
Approved tax/VAT treatment:    ☐ FR ☐ BE ☐ LU ☐ CH  (reviewed by ____________________)
Approved providers:            ☐ Yousign LIVE (P8.7.4 lifted)
Approval sentence:             "I, the owner, authorize the production launch of CloneStore / Pierre
                                for the countries and prices checked above, having verified the
                                external items in section 2."
Explicit production auth:      ☐  I authorize production (PRODUCTION_AUTHORIZED may be enabled)
```

> P11 does not, and will not, set any of these boxes. Production is authorized only by the owner's deliberate action.
