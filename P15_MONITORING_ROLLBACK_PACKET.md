# P15 — Monitoring / Rollback / Incident Packet

**Purpose:** operational readiness for a paid go-live. This packet documents logging, the emergency disable switches, the rollback procedure, and the incident/support templates. **Readiness is fail-closed:** the code invariants below exist, but the owner must rehearse the plan in ops and attest `CLONESTORE_MONITORING_ROLLBACK_VERIFIED` before public paid launch. Nothing here enables production.

## 1. Logging paths (code invariants — present)
- **Checkout errors** — `/api/checkout` returns non-200 on failure; errors logged.
- **Webhook errors** — `/api/webhooks/stripe` returns `400` (invalid signature), `503` (dedicated DB not ready → Stripe retries), `500` (error); **never `200` without signature verification**.
- **Reconciliation conflicts** — the P15 reconciliation gate logs a structured audit line `[webhook][p15-reconciliation] {…}` for every checkout (allowed / review_required / refund_required / payment_country_conflict). This is the persisted audit in production logs.

## 2. Emergency disable switches (present)
| Switch | Effect | How |
|---|---|---|
| `STRIPE_COUNTRY_PRICING_ENABLED` = (unset) | Country pricing OFF → legacy path | Remove env var |
| `STRIPE_COUNTRY_RECONCILIATION_ENABLED` = (unset) | Reconciliation gate reverts to preserve-existing (audit still logged) | Remove env var |
| `PRODUCTION_AUTHORIZED` (P10 const) | **Hard floor** — production never authorized | `false as const` in `p10-production-gate.ts`; deliberate code change required to lift |
| Feature-flag kill-switches (CloneChat, CloneStory, etc.) | Disable surfaces | Existing flag infra |

## 3. Rollback procedure (public paid launch)
1. **Stop new activations** — remove `STRIPE_COUNTRY_PRICING_ENABLED` (checkout falls back to legacy/blocked).
2. **Disable the live webhook** — in the Stripe Dashboard, disable the live webhook endpoint (or rotate `STRIPE_WEBHOOK_SECRET`); Stripe stops delivering; the handler rejects unverified events.
3. **Disable the production gate** — ensure `PRODUCTION_AUTHORIZED` stays `false` (it is a const; no env can flip it).
4. **Freeze pricing** — the P10 canon (`country-pricing.ts`) is server-authoritative; no client change can alter price.
5. **Handle in-flight conflicts** — orders flagged `review_required` / `payment_country_conflict` are NOT active (no paid access); process refunds/re-invoicing per the reconciliation audit.
6. **Revert deploy** if needed (deploy is an explicit, separate owner action; not performed by P15).

## 4. Production health / status
- Pattern precedent: `/api/internal/clonestory/health`. Before public launch, deploy a production health/status route + external uptime monitor (owner ops step — part of the attestation).

## 5. Owner alert / incident procedure
- **Alert path:** payment/webhook error rate + reconciliation-conflict rate → owner alert (email/Slack) — configure in ops.
- **Incident log template:**
  ```
  INCIDENT <id> | <UTC timestamp>
  Trigger: <webhook error | reconciliation conflict | payment failure | outage>
  Impact: <accounts affected, countries>
  Action: <disable switch used, rollback step>
  Owner notified: <who / when>
  Resolution: <what fixed it>
  Follow-up: <refunds / re-invoicing / code fix>
  ```

## 6. Customer support message templates
- **Country/currency conflict (review):** « Votre paiement a bien été reçu. Une vérification de votre pays de facturation est en cours avant l'activation ; nous revenons vers vous sous 24 h. »
- **Refund required (CH billed EUR):** « Nous avons détecté une facturation suisse sur une offre EUR. Nous procédons à un remboursement / une re-facturation en CHF (499 CHF/mois). »
- **Signature (fallback mode):** « Votre document RH est **préparé**. Il doit être **relu et signé** de votre côté ; la signature n'est pas exécutée dans CloneStore. »

## 7. Owner attestation (required before public paid launch)
- [ ] Health/status route deployed + external monitor.
- [ ] Alerting configured (payment/webhook/reconciliation).
- [ ] Rollback rehearsed (disable switches tested in staging).
- [ ] Incident + support templates in place.
- [ ] Set `CLONESTORE_MONITORING_ROLLBACK_VERIFIED=true` **after** the above.

> Until this attestation, `evaluateMonitoringRollback()` reports **not ready** (fail-closed). Production remains OFF regardless.
