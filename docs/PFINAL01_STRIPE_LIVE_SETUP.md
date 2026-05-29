# P-FINAL 01 — Guide de configuration Stripe live

**Phase: 9 — Public Launch Closure**
**Audience: Développeur + fondateur**
**CRITIQUE: Ne jamais utiliser des clés live en développement local**

---

## Vue d'ensemble

Ce guide couvre la configuration de Stripe en mode production (live) pour le lancement public de Pierre. Le produit est un abonnement annuel Pierre à **449€ TTC**.

---

## Clés nécessaires

| Variable | Format | Où trouver |
|----------|--------|------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Dashboard → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Dashboard → Webhooks → Endpoint |
| `STRIPE_PIERRE_ANNUAL_PRICE_ID` | `price_...` | Dashboard → Products → Pierre Annual |

**Jamais de clés live dans `.env.local` ou dans git.**

---

## Étape 1 — Créer les clés API live

1. Se connecter au [Dashboard Stripe](https://dashboard.stripe.com)
2. S'assurer d'être en mode **Live** (pas Test) — toggle en haut à droite
3. `Developers → API keys → Reveal live key`
4. Copier `Secret key` (sk_live_...) et `Publishable key` (pk_live_...)

---

## Étape 2 — Créer le produit et le prix

Dans le Dashboard Stripe en mode **Live** :

```
Products → Add product

Nom: Pierre — Assistant RH Annual
Description: Accès complet à Pierre, assistant RH IA, pendant 12 mois.
             Renouvellement automatique. Annulation possible à tout moment.

Prix:
  - Montant: 449,00 €
  - Devise: EUR
  - Récurrence: Annuel (every 1 year)
  - Type: Recurring

→ Save → Copier le Price ID (price_...)
```

---

## Étape 3 — Configurer le webhook

Dans le Dashboard Stripe en mode **Live** :

```
Developers → Webhooks → Add endpoint

URL: https://[votre-domaine-production]/api/stripe/webhook
Description: Pierre production webhook

Événements à écouter:
  ✅ checkout.session.completed
  ✅ customer.subscription.created
  ✅ customer.subscription.updated
  ✅ customer.subscription.deleted
  ✅ invoice.payment_succeeded
  ✅ invoice.payment_failed

→ Add endpoint → Reveal signing secret → Copier (whsec_...)
```

---

## Étape 4 — Configurer les variables d'environnement production

Dans votre hébergeur (Vercel / Railway / etc.) en environnement **Production** :

```bash
STRIPE_SECRET_KEY=sk_live_[...copier depuis Dashboard...]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_[...copier depuis Dashboard...]
STRIPE_WEBHOOK_SECRET=whsec_[...copier depuis Dashboard...]
STRIPE_PIERRE_ANNUAL_PRICE_ID=price_[...copier depuis Dashboard...]
```

**Ne jamais setter ces variables dans `.env.local`.**

---

## Étape 5 — Vérification programmatique

```typescript
import { analyzeStripeEnv } from "@/lib/production-readiness/stripe/stripe-env-analyzer";
import { buildStripeReadinessReport } from "@/lib/production-readiness/stripe/stripe-readiness-verdict";

// Analyse de l'environnement actuel
const analysis = analyzeStripeEnv({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PIERRE_ANNUAL_PRICE_ID: process.env.STRIPE_PIERRE_ANNUAL_PRICE_ID,
});

console.log("Environment:", analysis.environment); // doit être "live"
console.log("All live keys:", analysis.all_live_keys); // doit être true
console.log("Key mismatch:", analysis.key_mismatch); // doit être false
```

---

## Étape 6 — Test du flux de paiement complet

**Test recommandé: Paiement de bout en bout avec une vraie carte**

1. Créer un compte de test dans l'application (email de test)
2. Aller sur `/checkout` ou la page de souscription
3. Entrer une vraie carte (remboursée immédiatement après test)
4. Vérifier:
   - ✅ Checkout Stripe s'ouvre avec le bon montant (449€)
   - ✅ Paiement accepté
   - ✅ Webhook reçu par l'application (`checkout.session.completed`)
   - ✅ Compte activé automatiquement
   - ✅ Accès à Pierre disponible
   - ✅ Email de confirmation envoyé

**Alternative: Stripe test clock en mode live test**

```bash
# Créer un test clock dans le Dashboard Stripe pour simuler le renouvellement
# Dashboard → Billing → Test clocks → Create
```

---

## Vérification du webhook (sanity check)

Dans le Dashboard Stripe après le test :

```
Developers → Webhooks → [votre endpoint] → Recent events

Chercher: checkout.session.completed
Status: doit être ✅ 200 (delivered)
```

Si le webhook échoue (4xx/5xx) :
1. Vérifier que `STRIPE_WEBHOOK_SECRET` est correct
2. Vérifier que l'URL webhook est accessible depuis internet
3. Vérifier les logs de l'application

---

## Checklist finale Stripe

- [ ] Clés live configurées (sk_live_, pk_live_)
- [ ] Webhook configuré avec les bons événements
- [ ] Price ID live créé (449€/an)
- [ ] Test de paiement end-to-end réussi
- [ ] Webhook delivery confirmé dans le Dashboard
- [ ] Email de confirmation reçu après paiement test
- [ ] Accès Pierre activé après paiement

---

## Preuves requises

Ces preuves débloquent les proof IDs dans le système :

| Proof ID | Preuve |
|----------|--------|
| `proof_stripe_live_keys_configured` | Confirmation des variables d'env (sans exposer les clés) |
| `proof_stripe_payment_flow_tested` | Documentation du test de paiement |
| `proof_stripe_webhook_live` | Screenshot webhook actif dans Dashboard |

Et le flag B48: `B48_STRIPE_PRODUCTION_VERIFIED=true`

---

## Monitoring post-lancement

Surveiller dans le Dashboard Stripe :
- **Payments** — Volume et taux de succès
- **Webhooks** — Taux de livraison (objectif: 100%)
- **Disputes** — Zéro litige
- **Failed payments** — Taux d'échec (objectif: < 2%)

Alerte à configurer: email automatique si taux d'échec > 5%.

---

*P-FINAL 01 — Phase 9 — Guide de configuration Stripe live*
