# Analytics Stripe Webhook Wiring Report

Le webhook Stripe reste **la seule source de vérité du paiement**. Les événements analytiques sont
émis via `emitCanonicalPaymentEvent` (module `stripe-webhook-analytics.ts`), **auto-avalant** :
ne jette jamais → ne peut jamais transformer un webhook en 500 (ce qui déclencherait un rejeu
Stripe). Tous après signature vérifiée + métier écrit.

| Événement | Branche webhook | Point | Trust | Clé idempotence |
|---|---|---|---|---|
| `payment_succeeded` | `checkout.session.completed` | après ponts founder/BLOC3, si `isAccessGranted(activationStatus)` | `PAYMENT_PROVIDER_CONFIRMED` | `payment_succeeded:<event.id>` |
| `payment_failed` | `invoice.payment_failed` | après écriture `past_due` + pont BLOC3 | `PAYMENT_PROVIDER_CONFIRMED` | `payment_failed:<event.id>` |
| `payment_refunded` | `charge.refunded` (nouvelle branche additive) | branche dédiée avant le return terminal | `PAYMENT_PROVIDER_CONFIRMED` | `payment_refunded:<event.id>` |

## Ordre respecté (jamais l'inverse)

1. `stripe.webhooks.constructEvent` (signature) →
2. event validé (`if (!event) 400`) →
3. idempotence webhook (`guardOrdersEvent`/ledger) →
4. métier paiement exécuté (`orders.upsert`/`updateBySubId`) →
5. **puis** émission analytique additive.

## Gates

- **Webhook non signé** → `constructEvent` échoue → 400 → **zéro événement analytique** (le code
  d'émission n'est jamais atteint).
- **Rejeu** (double webhook) → même `event.id` → même event_id déterministe → une seule ligne.
- **Skip** (`checkout.session.completed` invalide) → `return` avant l'émission → aucun
  `payment_succeeded` sur un skip.
- **`payment_succeeded` uniquement si accès octroyé** (`isAccessGranted`) — jamais sur un statut
  non-octroyant.
- **Aucun secret Stripe / montant client / URL** dans l'événement — seulement tranche + devise +
  attribution Partner résolue serveur.
- **Analytics indisponible** → `emitCanonicalPaymentEvent` retourne `{ok:false, reason}`, le
  webhook renvoie quand même 200 (métier réussi).
- **Échec métier** → `return`/`throw` avant l'émission → aucun faux `payment_succeeded`.

## Attribution Partner

`emitCanonicalPaymentEvent` résout l'attribution via `resolvePartnerAttributionForUser(subjectUserId)`
en lecture seule (jamais un partner_id client). `subjectUserId` provient de la metadata
d'abonnement Stripe (`validation.user_id` / `meta.user_id`), jamais du corps client. Voir
`ANALYTICS_PARTNER_ATTRIBUTION_WIRING_REPORT.md`.
