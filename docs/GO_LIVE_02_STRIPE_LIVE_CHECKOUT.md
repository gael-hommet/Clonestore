# GO-LIVE 02 — Stripe Live Checkout & Pierre 449€/mois

**Statut:** repo prêt — vérification terrain en attente
**Date:** 2026-05-30
**Proof IDs ciblés:** 9 (tous pending jusqu'à vérification manuelle)

---

## Contexte

GO-LIVE 01D/01E Supabase RLS validés. GO-LIVE 02 couvre le passage Stripe live pour Pierre.

**Prix Pierre :** 449 EUR/mois — récurrent mensuel — essai 7 jours (carte requise).

**Variables env à configurer :**

| Variable | Attendu | Dans le code |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | `src/app/api/checkout/route.ts` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | frontend Stripe.js |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | `src/app/api/webhooks/stripe/route.ts` |
| `STRIPE_PRICE_PIERRE` | `price_...` | `src/app/api/checkout/route.ts` |

**ATTENTION :** Le code utilise `STRIPE_PRICE_PIERRE`, pas `STRIPE_PIERRE_ANNUAL_PRICE_ID`. Mettre le bon nom.

---

## Architecture Stripe du repo

```
POST /api/checkout          → crée session Stripe (user_id depuis Bearer token uniquement)
POST /api/checkout/confirm  → confirme session côté serveur (fallback success page)
POST /api/webhooks/stripe   → webhook signature-vérifié (source de vérité activation)
POST /api/orders/cancel     → annule subscription Stripe + marque orders.status=canceled
GET  /api/stripe/return     → redirige vers /profile/agents
```

**Sécurité checkout :**
- `user_id` TOUJOURS depuis Bearer token JWT (jamais depuis le body)
- Price ID TOUJOURS depuis `process.env.STRIPE_PRICE_PIERRE` (jamais depuis le client)
- Webhook vérifie signature Stripe (`stripe.webhooks.constructEvent`)
- Pierre price vérifié contre `EXPECTED_PIERRE_PRICE_AMOUNT = 44900` cents

---

## Checklist Gaël — 15 étapes

### Étape 1 — Stripe Dashboard : passer en mode Live

1. Aller sur https://dashboard.stripe.com
2. Basculer le toggle "Test mode" → "Live mode" (haut droite)
3. Confirmer que vous êtes en Live

### Étape 2 — Créer le produit Pierre

```
Products → Add product
Nom         : Pierre — Employé IA RH
Description : IA RH pour PME — 449€/mois
```

### Étape 3 — Créer le prix récurrent 449€/mois

```
Prix du produit → Add price
Type           : Recurring
Montant        : 449.00
Devise         : EUR
Période        : Monthly (mensuel)
```

→ Copier le `price_...` affiché → `STRIPE_PRICE_PIERRE=price_...` dans `.env.local`

### Étape 4 — Récupérer les clés live

```
Developers → API keys
Secret key : Reveal → sk_live_...  → STRIPE_SECRET_KEY
Publishable key    : pk_live_...   → NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

### Étape 5 — Configurer le webhook

```
Developers → Webhooks → Add endpoint
URL : https://[votre-domaine]/api/webhooks/stripe

ATTENTION : /api/webhooks/stripe  (PAS /api/stripe/webhook)

Events à sélectionner :
  ✓ checkout.session.completed
  ✓ customer.subscription.created
  ✓ customer.subscription.updated
  ✓ customer.subscription.deleted
  ✓ invoice.payment_failed

→ Copier Signing secret (whsec_...) → STRIPE_WEBHOOK_SECRET=whsec_... dans .env.local
```

### Étape 6 — Vérifier la config localement

```bash
npm run check:stripe-live
# Vérifie les env vars sans contacter Stripe
# Attendu : [LIVE] sur STRIPE_SECRET_KEY et STRIPE_PUBLISHABLE_KEY
```

### Étape 7 — Déployer en production

```bash
# Ajouter en production :
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PIERRE=price_...
```

### Étape 8 — Tester le checkout

1. Ouvrir l'app en production
2. Se connecter avec un compte de test
3. Naviguer vers `/checkout?agent=pierre`
4. Vérifier que la page Stripe s'ouvre avec **449 EUR/mois**
5. Vérifier la mention de l'essai 7 jours (carte requise)
6. Screenshot de la page Checkout → `go-live-evidence/stripe/checkout-449eur.png`

### Étape 9 — Tester le paiement réel (carte test Stripe en mode Live)

> Utiliser les cartes test Stripe live si disponibles, ou utiliser une vraie carte avec remboursement immédiat après.

1. Compléter le checkout avec carte
2. Vérifier la page de succès `/paiement/success`
3. Vérifier que Pierre est accessible dans `/agents/pierre/use`
4. Vérifier le webhook dans Dashboard : Events → voir `checkout.session.completed` → statut 200 OK
5. Screenshots → `go-live-evidence/stripe/payment-success-pierre-activated.png`

### Étape 10 — Vérifier l'activation Pierre

1. Vérifier dans Supabase que `orders.status = 'active'` ou `'trialing'` pour l'utilisateur test
2. Vérifier que Pierre répond dans `/agents/pierre/use`
3. Screenshot → `go-live-evidence/stripe/pierre-access-after-payment.png`

### Étape 11 — Tester paiement échoué

1. Stripe Dashboard → Webhooks → Send test event → `invoice.payment_failed`
2. Vérifier que `orders.status` passe à `'past_due'`
3. Vérifier le comportement côté UI
4. Screenshot → `go-live-evidence/stripe/payment-failure-tested.png`

### Étape 12 — Tester l'annulation

1. Annuler la subscription depuis le Dashboard Stripe (ou via l'app)
2. Vérifier que `orders.status` passe à `'canceled'`
3. Vérifier que Pierre est bloqué (redirect vers checkout)
4. Screenshot → `go-live-evidence/stripe/pierre-blocked-after-cancel.png`

### Étape 13 — Tester l'annulation subscription

1. Vérifier le Dashboard Stripe : Subscriptions → voir `canceled`
2. Screenshot → `go-live-evidence/stripe/subscription-cancel-tested.png`

### Étape 14 — Remplir les proof IDs

Ouvrir `go-live-proofs.local.json` et remplir **uniquement** les proofs vérifiés manuellement.

**Ne jamais marquer un proof `verified` sans vraie preuve physique.**

Utiliser le template JSON généré par :
```bash
npm run check:stripe-live
# ou
node scripts/stripe-live-readiness.mjs
```

### Étape 15 — Vérifier le verdict final

```bash
npm run check:go-live
# Relit go-live-proofs.local.json et calcule si public launch est débloqué
```

---

## Proof IDs — tous pending jusqu'à vérification manuelle

| Proof ID | Condition |
|---|---|
| `STRIPE_LIVE_SECRET_SET` | `sk_live_` + `pk_live_` dans .env.local |
| `STRIPE_LIVE_PRICE_PIERRE_449_CREATED` | price_... 449 EUR/mois créé dans Dashboard live |
| `STRIPE_LIVE_WEBHOOK_CONFIGURED` | Webhook /api/webhooks/stripe actif, 200 OK |
| `STRIPE_LIVE_CHECKOUT_TESTED` | Checkout s'ouvre avec 449 EUR visible |
| `STRIPE_LIVE_PAYMENT_SUCCESS_TESTED` | Paiement réel réussi, webhook 200 OK |
| `STRIPE_LIVE_PAYMENT_FAILURE_TESTED` | Paiement échoué testé, past_due géré |
| `STRIPE_LIVE_SUBSCRIPTION_CANCEL_TESTED` | Cancel testé, accès Pierre retiré |
| `PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED` | Pierre accessible après paiement |
| `PIERRE_BLOCK_AFTER_CANCEL_VERIFIED` | Pierre bloqué après cancel |

---

## Notes sécurité

- `user_id` est TOUJOURS résolu depuis le Bearer token (jamais depuis le body)
- `price_id` vient de `process.env.STRIPE_PRICE_PIERRE` (jamais depuis le client)
- Le webhook vérifie la signature Stripe avant tout traitement
- `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` ne sont jamais affichés dans les logs
- L'essai 7 jours requiert une carte — ce n'est pas un accès open-bar

---

## Sécurité critique — ne pas faire

- Ne jamais mettre `STRIPE_SECRET_KEY` dans le code source ou les logs
- Ne jamais faire confiance à `user_id` provenant du body d'une requête
- Ne jamais permettre au client de choisir le price_id
- Ne jamais activer `payment_method_collection: 'if_required'` (open-bar trial)

---

## Public launch

`B48_PUBLIC_LAUNCH_ENABLED` reste `false` jusqu'à **tous** les 30 proof IDs requis vérifiés.

---

*GO-LIVE 02 — Stripe Live Checkout — 2026-05-30*
