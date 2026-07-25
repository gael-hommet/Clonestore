# Analytics Runtime Source of Truth Matrix

Une seule source de vérité par événement canonique. Aucun événement n'a deux producteurs
canoniques simultanés. Colonnes : événement → producteur runtime réel → niveau de confiance →
point de branchement → identité → déduplication.

| Événement canonique | Producteur réel | Confiance | Point de branchement | Identité | Déduplication |
|---|---|---|---|---|---|
| `page_viewed` | `AnalyticsPageViewTracker` (client) | `SERVER_ACCEPTED` | déjà branché (bloc précédent) | `page_view_id` | 1 par navigation réelle (garde Strict Mode + bfcache) |
| `homepage_demo_prompt_seen` | `DemoContextualPrompt.tsx` (client) | `CLIENT_OBSERVED` | `track()` sur visibilité réelle | `visitor_id`+`page_view_id` | `event_id`, once |
| `homepage_demo_prompt_clicked` | `DemoContextualPrompt.tsx` (client) | `CLIENT_OBSERVED` | `track()` sur clic | idem | `event_id` |
| `demo_started` | `DemoExperience.tsx` (client) | `CLIENT_OBSERVED` | `track()` au 1er scroll, `dedupeKey` par run | `visitor_id`+`demo_run_id` (generic_demo) | `event_id`, once/run |
| `demo_step_completed` | `DemoExperience.tsx` (client) | `CLIENT_OBSERVED` | `track()` par scène à `data-step-id` fermé | `demo_run_id` | `event_id`/étape/run |
| `demo_completed` | `DemoExperience.tsx` (client) | `CLIENT_OBSERVED` | `track()` à profondeur seuil/transition Pierre | `demo_run_id` | `event_id`, once/run |
| `pierre_demo_started` | `DemoEventTracker.tsx` (client) | `CLIENT_OBSERVED` | `track()` 1re interaction | `visitor_id`+`demo_run_id` (pierre_demo) | `event_id`, once/run |
| `pierre_demo_step_completed` | `DemoEventTracker.tsx` (client) | `CLIENT_OBSERVED` | `track()` par étape `data-step-id` | `demo_run_id` | `event_id`/étape/run |
| `pierre_demo_completed` | `DemoEventTracker.tsx` (client) | `CLIENT_OBSERVED` | `track()` après séquence suffisante | `demo_run_id` | `event_id`, once/run |
| `reservation_cta_clicked` | CTA client | `CLIENT_OBSERVED` | `track()` sur clic | `visitor_id`+`page_view_id` | `event_id` |
| `reservation_form_started` | `ReservationForm.tsx` (client) | `CLIENT_OBSERVED` | `track()` 1er champ | `session_id` | `event_id`, once |
| `reservation_submitted` | `ReservationForm.tsx` (client) | `CLIENT_OBSERVED` | `track()` sur soumission (≠ réservation créée) | `session_id` | `event_id` |
| `reservation_created` | **founder-access `store.ts`** (serveur) | `SERVER_PERSISTED` | après insert réel dans `clonestore_founder_reservations` | `reservation_id` | `deterministicEventId(reservation-created:<id>)` |
| `reservation_email_confirmed` | **founder-access `store.ts`** (serveur) | `SERVER_CONFIRMED` | après confirmation email réelle | `reservation_id` | `deterministicEventId(reservation-confirmed:<id>)` |
| `activation_started` | `ActivatePierre.tsx` (client) | `CLIENT_OBSERVED` | `track()` sur clic Activer, avant `/api/checkout` | `reservation_id` (référence, pas vérité) | `event_id` |
| `activation_completed` | **founder-access `store.ts`** via webhook Stripe (serveur) | `PAYMENT_PROVIDER_CONFIRMED` | après `founder_subscription_active` réel | `reservation_id`+`stripe_event_id` | `deterministicEventId(activation-completed:<id>)` |
| `checkout_started` | `ActivatePierre.tsx`/CTA (client) | `CLIENT_OBSERVED` | `track()` sur déclenchement réel de `/api/checkout` | `session_id` | `event_id` |
| `checkout_session_created` | **`/api/checkout` `route.ts`** (serveur) | `SERVER_CONFIRMED` | après création réelle session Stripe test | `checkout_session_id` (haché) | `deterministicEventId(checkout-session-created:<stripe_session_id>)` |
| `payment_succeeded` | **webhook Stripe signé** (serveur) | `PAYMENT_PROVIDER_CONFIRMED` | après métier paiement confirmé | `order_id`+`stripe_event_id` | `deterministicEventId(payment-succeeded:<stripe_event_id>)` |
| `payment_failed` | **webhook Stripe signé** (serveur) | `PAYMENT_PROVIDER_CONFIRMED` | après `invoice.payment_failed` traité | `stripe_event_id` | `deterministicEventId(payment-failed:<stripe_event_id>)` |
| `payment_refunded` | **webhook Stripe signé** (serveur) | `PAYMENT_PROVIDER_CONFIRMED` | après événement remboursement traité | `stripe_event_id` | `deterministicEventId(payment-refunded:<stripe_event_id>)` |
| `guided_tour_started` | `GuidedTourProvider.tsx` (client) | `CLIENT_OBSERVED` | `track()` au 1er affichage étape | `visitor_id`+`session_id` | `event_id`, once/tourId |
| `guided_tour_step_completed` | `GuidedTourProvider.tsx` (client) | `CLIENT_OBSERVED` | `track()` par étape | idem | `event_id`/étape |
| `guided_tour_completed` | `GuidedTourProvider.tsx` (client) | `CLIENT_OBSERVED` | `track()` sur status=completed | idem | `event_id`, once |
| `guided_tour_skipped` | `GuidedTourProvider.tsx` (client) | `CLIENT_OBSERVED` | `track()` sur fermeture/snooze | idem | `event_id` |

## Règle de séparation stricte (testée)

Les 9 événements **server-only** (`reservation_created`, `reservation_email_confirmed`,
`checkout_session_created`, `activation_completed`, `payment_succeeded`, `payment_failed`,
`payment_refunded`, + `visitor_created`/`session_started` internes) sont **rejetés** par
l'endpoint public d'ingestion (HTTP 422, testé) ET par l'API serveur `recordCanonicalServerEvent`
refuse tout événement client-émissible (`NOT_A_SERVER_EVENT`, testé). Aucun chevauchement
possible.

## Attribution Partner

`partner_attribution_id` n'est jamais fourni par le client (absent de l'enveloppe client). Il est
résolu côté serveur en lecture seule via le runtime Partner existant, puis passé à
`recordCanonicalServerEvent` sur les événements de paiement — voir
`ANALYTICS_PARTNER_ATTRIBUTION_WIRING_REPORT.md`.
