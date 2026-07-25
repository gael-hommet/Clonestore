# Canonical Funnel Definition v1

Contrat fermé, versionné, stable. Toute évolution future crée `v2`, ne modifie jamais `v1` en
place. Implémenté par `src/lib/analytics/schema.ts` (`CANONICAL_EVENT_NAMES`).

## Niveaux de confiance (fermés)

| Niveau | Signification | Qui peut l'attribuer |
|---|---|---|
| `CLIENT_OBSERVED` | Un composant s'est affiché ou a été cliqué | Client uniquement |
| `SERVER_ACCEPTED` | L'API a validé et accepté la requête | Serveur, avant écriture DB |
| `SERVER_PERSISTED` | Écrit avec succès dans `clonestore_analytics_events_v1` | Serveur, après écriture DB |
| `SERVER_CONFIRMED` | Une vérité métier serveur indépendante confirme l'événement (ex : email vérifié) | Serveur uniquement, jamais dérivé d'un événement client |
| `PAYMENT_PROVIDER_CONFIRMED` | Confirmé par un webhook Stripe signé | Serveur, signature Stripe vérifiée uniquement |

Le dashboard n'affiche jamais un simple `CLIENT_OBSERVED` comme une conversion serveur — chaque
vue agrégée affiche son niveau de confiance minimal.

## Étapes canoniques

| Étape | Définition | Source de vérité | Identité | Déduplication | Confiance |
|---|---|---|---|---|---|
| `visitor_created` | Premier `visitor_id` émis pour ce navigateur | Serveur (émission cookie) | `visitor_id` | Unique par `visitor_id` | `SERVER_PERSISTED` |
| `session_started` | Nouvelle session (30 min d'inactivité ou premier appel) | Serveur | `visitor_id`+`session_id` | Unique par `session_id` | `SERVER_PERSISTED` |
| `page_viewed` | Une navigation App Router réelle (route normalisée, sans SSR+hydratation double) | Client → serveur | `page_view_id` | Unique par `page_view_id` | `SERVER_ACCEPTED` |
| `homepage_demo_prompt_seen` | Carte contextuelle démo réellement visible (IntersectionObserver, une fois) | Client | `visitor_id`+`page_view_id` | `event_id` | `CLIENT_OBSERVED` |
| `homepage_demo_prompt_clicked` | Clic explicite sur la carte | Client | idem | `event_id` | `CLIENT_OBSERVED` |
| `demo_started` | Premier scroll/interaction significative sur `/demo` | Client | `visitor_id`+`page_view_id` | `event_id`, once | `CLIENT_OBSERVED` |
| `demo_completed` | Scroll ≥ profondeur seuil OU navigation vers Pierre/réservation depuis `/demo` | Client | idem | `event_id`, once | `CLIENT_OBSERVED` |
| `pierre_demo_started` | Premier clic/interaction sur `/demo/pierre` | Client | `visitor_id`+`demo_run_id` | `event_id`, once | `CLIENT_OBSERVED` |
| `pierre_demo_step_completed` | Étape à `data-step-id` fermé observée (jamais `textContent`) | Client | `demo_run_id` | `event_id` par étape | `CLIENT_OBSERVED` |
| `pierre_demo_completed` | Séquence d'étapes cohérente jusqu'à la fin (validation de séquence, pas un seul événement final isolé) | Client, validé serveur | `demo_run_id` | `event_id`, once par `demo_run_id` | `CLIENT_OBSERVED` (validé) |
| `reservation_cta_clicked` | Clic explicite sur un CTA de réservation | Client | `visitor_id`+`page_view_id` | `event_id` | `CLIENT_OBSERVED` |
| `reservation_form_started` | Premher champ du formulaire touché | Client | `session_id` | `event_id`, once | `CLIENT_OBSERVED` |
| `reservation_submitted` | Étape 2 du formulaire soumise avec succès (signal client) | Client (signal) | `session_id` | `event_id` | `CLIENT_OBSERVED` |
| `reservation_created` | Ligne insérée dans `clonestore_founder_reservations` | **Serveur uniquement** (`founder_reservation_created`) | `reservation_id` | clé unique `email_normalized` | `SERVER_PERSISTED` |
| `reservation_email_confirmed` | Email vérifié serveur (`founder_email_verified`) | **Serveur uniquement** | `reservation_id` | idempotent (token à usage unique) | `SERVER_CONFIRMED` |
| `activation_started` | Clic "Activer Pierre", avant appel `/api/checkout` | Client (signal) | `reservation_id` | `event_id` | `CLIENT_OBSERVED` |
| `activation_completed` | `founder_subscription_active` — Stripe confirme l'abonnement actif | **Serveur uniquement**, webhook Stripe signé | `reservation_id` | `stripe_event_id` unique | `PAYMENT_PROVIDER_CONFIRMED` |
| `checkout_started` | Clic réel déclenchant un appel `/api/checkout` (pas la simple vue de page) | Client (signal) | `session_id` | `event_id` | `CLIENT_OBSERVED` |
| `checkout_session_created` | Session Stripe Checkout réellement créée côté serveur | **Serveur uniquement** | `checkout_session_id` | id Stripe unique | `SERVER_CONFIRMED` |
| `payment_succeeded` | `checkout.session.completed`/`invoice.paid` via webhook Stripe **signé** | **Serveur uniquement** | `order_id` | `stripe_event_id` unique | `PAYMENT_PROVIDER_CONFIRMED` |
| `payment_failed` | Événement Stripe d'échec, webhook signé | **Serveur uniquement** | `order_id` | `stripe_event_id` unique | `PAYMENT_PROVIDER_CONFIRMED` |
| `payment_refunded` | `charge.refunded` via webhook Stripe signé | **Serveur uniquement** | `order_id` | `stripe_event_id` unique | `PAYMENT_PROVIDER_CONFIRMED` |
| `guided_tour_started` | Premier affichage d'une étape d'un tour | Client | `visitor_id`+`session_id` | `event_id`, once par `tourId` | `CLIENT_OBSERVED` |
| `guided_tour_step_completed` | Étape de tour marquée complétée | Client | idem | `event_id` par étape | `CLIENT_OBSERVED` |
| `guided_tour_completed` | Tour marqué `status=completed` | Client | idem | `event_id`, once | `CLIENT_OBSERVED` |
| `guided_tour_skipped` | Tour explicitement fermé/snoozé avant la fin | Client | idem | `event_id` | `CLIENT_OBSERVED` |

## Interdiction d'événements fictifs — abandon calculé, jamais émis

`demo_abandoned`, `pierre_demo_abandoned`, `reservation_abandoned` **n'existent pas** comme
événements émis. Un abandon se calcule à la lecture (Phase 18) :

```
abandoned(stage_started, stage_next, window)
  = count(distinct demo_run_id ayant stage_started)
  - count(distinct demo_run_id ayant stage_next dans la fenêtre window après stage_started)
```

Aucune ligne « abandon » n'est jamais écrite dans `clonestore_analytics_events_v1`.

## Étapes explicitement hors périmètre v1 (documentées, non canonisées)

`founder_qualification_*`, `founder_verification_*`, `founder_unsubscribed`,
`founder_contact_requested`, `founder_subscription_canceled`/`past_due`, `variant_assigned`,
`diagnostic_*` (BLOC3), sections de démo individuelles (`problemSectionViewed` etc.) — toutes
réelles, toutes déjà classées dans `ANALYTICS_LEGACY_EVENT_INVENTORY.md`, mais laissées hors du
funnel d'acquisition principal v1 pour ne pas diluer les 22 étapes ci-dessus. Elles restent
disponibles dans leurs systèmes d'origine (A/B), non migrées de force.
