# P15 — Owner Go-Live Approval Packet

**This packet requires an explicit human owner sign-off.** No production authorization is true without it completed. Completing it does **not** by itself launch anything: the P10 production hard floor (`PRODUCTION_AUTHORIZED = false as const`) still requires a deliberate code change, and deployment is a separate explicit action.

---

## 1. Product status
- P8 verified · P9 verified · P10 verified · P11 technical-readiness verified / external go-live blocked · P12 verified · P13 verified · P14 verified (**LAUNCH VISION VERIFIED / ULTIMATE VISION ROADMAP DISCLOSED**).

## 2. Launch countries
- **France (FR)** · **Belgique (BE)** · **Luxembourg (LU)** · **Suisse (CH)**.

## 3. Pricing (P10 canon, server-authoritative)
- FR / BE / LU → **449 EUR / mois**.
- CH → **499 CHF / mois**.
- A Swiss customer cannot be billed the EUR offer; FR/BE/LU cannot be billed CHF (checkout guard + reconciliation gate, fail-closed).

## 4. Commercial truth (P14 — non-negotiable at launch)
- Pierre = **employé IA RH** (never assistant/chatbot/copilote).
- Pierre **absorbs the operational HR workload**; it does **not** replace final legal/human/disciplinary/managerial responsibility.
- **No payroll-engine / DSN** claim.
- **No legal-compliance guarantee** (FR/BE/LU/CH legal readiness is external-pending).
- **No "production live / Stripe live / Yousign live"** claim unless externally verified.

## 5. External go-live checklist (owner ticks + attests each)
| Gate | Requirement | Attestation env / artifact | Status (local) |
|---|---|---|---|
| A. Stripe live prices | EUR 44900 + CHF 49900, monthly, active | `CLONESTORE_STRIPE_LIVE_VERIFIED` after read-only dry-run | ❌ blocked (test key locally) |
| B. Stripe webhook | live secret + signature verified | `STRIPE_WEBHOOK_SECRET` (live) | ❌ blocked |
| C. Reconciliation | wired + enabled + live-verified | `STRIPE_COUNTRY_RECONCILIATION_ENABLED` + `CLONESTORE_COUNTRY_RECON_LIVE_VERIFIED` | ⏳ wired, not live-verified |
| D. Legal/tax artifacts | FR/BE/LU/CH reviewed (avocat/comptable) or owner-accepted disclosed | signed artifact registry (hash/date/source) | ❌ missing |
| E. Provider/Yousign | live verified OR fallback approved | `CLONESTORE_SIGNATURE_LIVE_VERIFIED` or `CLONESTORE_SIGNATURE_FALLBACK_APPROVED` | ❌ blocked (P8.7.4) |
| F. Monitoring/rollback | rehearsed + attested | `CLONESTORE_MONITORING_ROLLBACK_VERIFIED` | ❌ not attested |
| G. Owner approval | this packet signed | `CLONESTORE_OWNER_GOLIVE_APPROVED` + `_BY` + `_DECISION` | ❌ not signed |

## 6. Owner decision (choose ONE)
- [ ] **Approve production authorization** (`approve_production`) — all gates green or explicitly owner-accepted with disclosed risk.
- [ ] **Reject** (`reject`).
- [ ] **Approve private pilot only** (`private_pilot_only`) — payment disabled / manually controlled; legal & provider risks disclosed.
- [ ] **Approve demo-only** (`demo_only`) — product remains non-live.

## 7. Explicit statement (required)
> « Je comprends que le lancement payant en production ne doit PAS être activé tant que toutes les portes requises ne sont pas vertes ou explicitement acceptées par l'owner avec risque divulgué. »

Owner: ______________________  ·  Date: ____________  ·  Signature: ______________________

---

**Machine attestation (after signing, owner sets env — never committed):**
```
CLONESTORE_OWNER_GOLIVE_APPROVED=true
CLONESTORE_OWNER_GOLIVE_APPROVED_BY="<owner name>"
CLONESTORE_OWNER_GOLIVE_DECISION="approve_production"   # or reject / private_pilot_only / demo_only
CLONESTORE_OWNER_GOLIVE_RISK_ACK=true                    # if accepting disclosed risk
```
> Even with all of the above set, **production authorization stays false** until the P10 hard floor const is lifted by a deliberate code change. Env alone can never authorize production.
