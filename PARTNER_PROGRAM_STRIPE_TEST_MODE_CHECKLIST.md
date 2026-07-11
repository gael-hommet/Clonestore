# Cabinets Fondateurs — Checklist opérateur Stripe (Test Mode) & Test → Live

Ce programme est **entièrement construit côté code** et prouvé en **Stripe Test Mode**.
Aucune action Live n'a été effectuée. Les étapes ci-dessous sont les actions **opérateur**
qui ne peuvent pas être faites depuis le code.

## 0. Prérequis (déjà en place côté code)
- Migrations `clonestore_pp_*` (3 fichiers) — voir « Migrations » plus bas.
- Flags **OFF par défaut** : `PARTNER_PROGRAM_ENABLED`, `PARTNER_PAYOUTS_ENABLED`, `PARTNER_PAYOUT_DRY_RUN=true`.
- Le webhook canonique `/api/webhooks/stripe` porte déjà le 5ᵉ pont (commissions), flag-gated.

## 1. Appliquer les migrations à Supabase (Test/Staging d'abord)
```
MIGRATIONS_FILTER=clonestore_pp DATABASE_URL="<staging>" npm run db:migrate:pg
```
Applique aussi le ledger d'événements du flux orders (Bloc 4) :
```
# coller supabase/migrations/2026-07-10_10__clonestore_orders_stripe_events.sql dans le SQL Editor Supabase
```

## 2. Stripe Connect (Dashboard, TEST MODE)
1. Dashboard Stripe → **Connect** → activer Connect en test mode.
2. Régler la plateforme : **CloneStore reste le vendeur** ; les cabinets reçoivent des **transferts séparés** (Express accounts, capability `transfers`). Aucune destination charge.
3. (Aucune clé Connect distincte n'est requise : les comptes Express sont créés via `stripe.accounts.create` avec la clé secrète test existante.)

## 3. Webhook (Dashboard → Developers → Webhooks)
Endpoint : `https://<domaine>/api/webhooks/stripe` (route canonique — **PAS** `/api/stripe/webhook`).
Événements requis (couvre orders + commissions partenaires + Connect) :
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`,
`charge.dispute.created`, `charge.dispute.closed`, `account.updated`, `transfer.created`, `transfer.failed`.
Copier le **Signing Secret** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.

## 4. Variables d'environnement (staging)
```
PARTNER_PROGRAM_ENABLED=true
PARTNER_PAYOUTS_ENABLED=true
PARTNER_PAYOUT_DRY_RUN=true          # garder true pour la démo ; "false" = transferts Test Mode réels
CLONESTORE_PP_COOKIE_SECRET=<secret HMAC>
PARTNER_PAYOUT_CRON_SECRET=<secret>  # ou réutiliser CRON_SECRET
PARTNER_EMAIL_CRON_SECRET=<secret>   # ou réutiliser CRON_SECRET
# déjà présents : STRIPE_SECRET_KEY(sk_test_), RESEND_API_KEY, CLONESTORE_FOUNDER_EMAIL_FROM, NEXT_PUBLIC_SITE_URL
```

## 5. Crons Supabase
Coller `supabase/sql/partner_program_supabase_cron.sql` dans le SQL Editor Supabase Pro
(secrets via Vault). Emails toutes les 5 min ; versements le 5 du mois.

## 6. Scénario de démonstration Test Mode
1. Admin accepte une candidature (`/partenaires/admin`) → récupère le **code + slug** (montré une seule fois).
2. Cabinet ouvre son espace `/partenaires/espace`, lance l'onboarding Connect (`Terminer l'onboarding Stripe`) → complète le formulaire Stripe test → `account.updated` passe `payouts_enabled=true`.
3. Un prospect clique le lien `…/api/partners/click?partner=<slug>` (cookie signé posé), s'inscrit, achète Pierre (carte test `4242 4242 4242 4242`).
4. `invoice.paid` → **commission 89,80 €** enregistrée (statut « en réserve »).
5. Passé le délai de réserve, la commission devient « disponible ».
6. Admin lance un **dry-run de versement** depuis la console → lot calculé, aucun transfert réel.
7. (Optionnel Test Mode réel) `PARTNER_PAYOUT_DRY_RUN=false` → le cron crée un **transfert Stripe test** vers le compte connecté, idempotent.

## 7. Checklist Test → Live (NE PAS franchir sans GO explicite)
- [ ] Revue légale du contrat partenaire + mentions RGPD.
- [ ] Vérification fiscale (TVA, factures, statut des commissions).
- [ ] Le **plancher production P10** doit être levé par le propriétaire (le code refuse tout transfert live tant qu'il ne l'est pas — `productionAuthorized()` renvoie `false`).
- [ ] Basculer les clés Stripe en `sk_live_` **uniquement** après validation humaine.
- [ ] Repointer le webhook Live vers `/api/webhooks/stripe`.
- [ ] Appliquer les migrations `clonestore_pp_*` à la base Supabase de production.
- [ ] `PARTNER_PAYOUT_DRY_RUN=false` **en dernier**, après un premier cycle observé.

## Preuve « aucune action Live »
- `PARTNER_PAYOUT_DRY_RUN` défaut `true` → aucun `stripe.transfers.create` réel.
- Garde anti-Live dans `runMonthlyPayouts` : si clé live + production non autorisée → `skipped: "live_not_authorized"`.
- Tous les tests utilisent PGlite + Stripe simulé ou signatures de test locales ; aucun appel réseau Stripe.
