# P-FINAL 02 — Vérification Stripe live

**Lire aussi:** `docs/PFINAL01_STRIPE_LIVE_SETUP.md` pour le guide complet.

---

## Checklist Stripe live

- [ ] `STRIPE_SECRET_KEY=sk_live_...` configuré en production
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` configuré en production
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` configuré en production
- [ ] `STRIPE_PIERRE_ANNUAL_PRICE_ID=price_...` configuré en production
- [ ] Produit Pierre 449€/an créé dans Dashboard Stripe (mode Live)
- [ ] Webhook endpoint actif avec les bons événements
- [ ] Checkout Stripe s'ouvre avec montant 449€
- [ ] Paiement test réussi de bout en bout
- [ ] Webhook delivery confirmé (200 OK) dans Dashboard

---

## Proof IDs à valider

| Proof ID | Quand |
|----------|-------|
| STRIPE_LIVE_SECRET_SET | Après config clés live |
| STRIPE_LIVE_PRICE_PIERRE_449_CREATED | Après création produit |
| STRIPE_LIVE_WEBHOOK_CONFIGURED | Après config webhook |
| STRIPE_LIVE_CHECKOUT_TESTED | Après test checkout |
| STRIPE_LIVE_PAYMENT_SUCCESS_TESTED | Après paiement test |

---

## Vérification sans appel API

Lancer : `npm run check:stripe-live`

Ce script lit les variables d'environnement et détecte le mode (test/live) sans contacter Stripe.

---

*P-FINAL 02 — Guide de vérification Stripe live*
