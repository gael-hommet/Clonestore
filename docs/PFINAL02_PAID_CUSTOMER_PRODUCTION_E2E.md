# P-FINAL 02 — Paid Customer Production E2E

**Lancer le script guidé :** `npm run check:paid-customer`

---

## Checklist E2E

- [ ] Compte test production créé
- [ ] Checkout `/checkout?agent=pierre` → 449€ affiché
- [ ] Paiement réussi (vraie carte ou test clock)
- [ ] Success page affichée correctement
- [ ] Order en DB : `status = active`
- [ ] Webhook `checkout.session.completed` → 200 OK dans Dashboard Stripe
- [ ] Accès `/agents/pierre/use` confirmé
- [ ] Empreinte minimale configurée
- [ ] Mission simple créée avec brouillon produit
- [ ] Cas sensible (licenciement) → bloqué par Pierre
- [ ] (Optionnel) Annulation → accès révoqué

---

## Proof IDs à valider

| Proof ID | Quand |
|----------|-------|
| PAID_CUSTOMER_PRODUCTION_E2E_VERIFIED | Checklist complète |
| PIERRE_ACCESS_AFTER_PAYMENT_VERIFIED | Accès cockpit confirmé |
| PIERRE_BLOCK_AFTER_CANCEL_VERIFIED | Annulation testée (optionnel) |

---

*P-FINAL 02 — Paid Customer Production E2E*
