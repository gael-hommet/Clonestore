# Founder Access — Activation & vérité Stripe

Réutilise l'infrastructure Stripe **existante** (pas de système de facturation parallèle) :
`/api/checkout`, `/api/webhooks/stripe`, `src/lib/billing/*`, `src/lib/stripe.ts`.

## Parcours `/activate/pierre`

Verrouillé par phase commerciale :

- **avant le 05/08** → activation bloquée proprement (réservation possible) ;
- **05/08 → 31/08** → activation disponible ;
- **après fermeture** → conditions fondatrices non disponibles.

Le composant `ActivatePierre` réutilise le checkout existant (session Supabase → Bearer →
`/api/checkout`). Le client ne fixe jamais le prix.

## Liaison réservation ↔ compte (côté serveur uniquement)

`/api/checkout` accepte `founder_reservation_id` et ne le retient que si, **côté serveur** :

- l'id est un UUID valide ;
- la réservation existe et est **confirmée** ;
- la phase est `launched` ;
- l'email de la réservation == email du compte Supabase authentifié ;
- l'agent est `pierre`.

Sinon la liaison est ignorée silencieusement (le checkout standard n'est jamais bloqué).
Le `founder_reservation_id` validé est inscrit dans `session.metadata` **et**
`subscription_data.metadata`.

## Webhook = source de vérité

`bridgeFounderEvent` n'agit que si la metadata Stripe porte `founder_reservation_id`
(sinon no-op : les flux marketplace existants restent inchangés). Sur :

- `checkout.session.completed` (paid/trial) → réservation `active_client`,
  `activated_at`, `subscription_amount_cents=44900`, `currency=EUR`, ids Stripe,
  `subscription_status`, événements `founder_payment_completed` + `founder_subscription_active` ;
- `customer.subscription.updated` → met à jour `subscription_status` (active/trialing/past_due…) ;
- `customer.subscription.deleted` → `subscription_status=canceled` (l'historique
  `activated_at` est conservé).

**Idempotence** : journal append-only `clonestore_founder_stripe_events` avec
`stripe_event_id` unique ; un rejeu est détecté (`duplicate`) et ne recompte rien.
La signature Stripe est vérifiée (`constructEvent`) avant tout traitement. Aucune
activation sur simple retour navigateur / page de succès / paramètre d'URL.

## Revenus réels (`founderRevenueMetrics`)

Calculés **uniquement** depuis les abonnements réellement `active`/`trialing` :
`mrr_active_cents = somme des montants`, `arr = mrr × 12`. Un abonnement annulé sort du
MRR (churn). Une réservation non payée n'est **jamais** comptée comme revenu.
`stripe_connected = STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET` : sinon le cockpit affiche
« Source non connectée » (jamais un faux zéro). Étiquette cockpit : « Source : Stripe webhook ».

## Variables

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PIERRE` (prix immuable côté
Stripe ; le serveur vérifie le montant attendu 44900). Test webhook : Stripe CLI
(`stripe listen --forward-to /api/webhooks/stripe`).

## E-R2 — durcissements de fermeture

- **Preuve commerciale STRICTE** (`stripe-proof.ts` `validateFounderStripeCommercialProof`) :
  pour un événement qui accorde l'accès, AUCUNE preuve n'est optionnelle — Price ID exact,
  `productMatches === true`, montant 44900, devise EUR, intervalle `month`, subscription/
  customer/reservation présents, `livemode` présent et cohérent avec l'environnement.
  Toute preuve absente/divergente ⇒ journal `proof_failed`, **aucune activation**. Le webhook
  récupère la preuve via `subscriptions.retrieve` (price/produit) avant de valider.
- **Statut inconnu FAIL-CLOSED** : `mapStripeSubscriptionStatusStrict` renvoie
  `{ ok:false, unsupported_stripe_status }` (jamais `none`) ⇒ journal `unsupported`, aucune
  mutation, anomalie remontée au cockpit (`stripeAnomalyCount`).
- **Ordre total déterministe** (`compareStripeEventOrder`/`decideStripeApplication`) : tri
  `created` puis `event_id` ; à `created` égal, **précédence terminale** (un événement qui
  accorde l'accès ne réactive jamais un état terminal/défavorable).
- **Journal non falsifiable** (§3) : `clonestore_record_founder_stripe_event(jsonb)`
  SECURITY DEFINER + search_path fixe + **validation du payload** (event_id non vide, type &
  processing_result allowlistés). EXECUTE **retiré** à `pierre_rt_app` et PUBLIC ; accordé au
  seul rôle `clonestore_stripe_webhook_writer`. INSERT/UPDATE/DELETE bruts refusés à
  `pierre_rt_app` (testé avec `SET ROLE`). Connexion dédiée via
  `CLONESTORE_STRIPE_WEBHOOK_DATABASE_URL` (`getStripeWebhookDb`) ; à défaut, connexion
  runtime privilégiée (jamais le rôle RLS général).
- **Atomicité** : journal + mutation réservation + événements funnel dans une seule
  transaction (`applyFounderStripeEvent`) → rollback tout-ou-rien (testé par failpoint).
- **Variable** : `STRIPE_PRODUCT_PIERRE` (optionnelle ; sinon le produit est prouvé par le
  Price ID attendu).
