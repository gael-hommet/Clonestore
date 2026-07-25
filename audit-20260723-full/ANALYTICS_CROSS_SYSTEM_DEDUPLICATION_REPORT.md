# Analytics Cross-System Deduplication Report

Principe : **un seul producteur canonique par conversion**, comptabilisé exclusivement dans
`clonestore_analytics_events_v1`. Les systèmes legacy (founder-access funnel, BLOC3, présentation
démo) ne sont **jamais** lus par le dashboard canonique — donc un événement ne peut jamais y
apparaître deux fois.

| Conversion | Ancien producteur (legacy, non compté) | Nouveau producteur canonique (unique) | Stratégie | Risque de doublon |
|---|---|---|---|---|
| Réservation créée | `founder_reservation_created` dans `clonestore_founder_funnel_events` | `reservation_created` via `bridgeFounderServerEvent` (route reservations) | event_id déterministe `sha256(reservation-created:<id>)` | Nul — clé unique par réservation |
| Email confirmé | `founder_email_verified` (funnel legacy) | `reservation_email_confirmed` via bridge (route verify) | event_id déterministe ; re-confirmation idempotente absorbée | Nul |
| Activation | `founder_subscription_active` (funnel legacy) | `activation_completed` via bridge (stripe-webhook-bridge, gated granted+applied+non-dup) | event_id déterministe par réservation | Nul |
| Paiement réussi | `founder_payment_completed` (funnel legacy) **ET** BLOC3 `pierre_activated` (inerte) | `payment_succeeded` via webhook route (`emitCanonicalPaymentEvent`, clé = `stripe_event_id`) | **Le bridge founder n'émet JAMAIS `founder_payment_completed`→payment_succeeded** — seul le webhook route le produit | Nul — un seul producteur |
| Paiement échoué | BLOC3 `checkout_failed` (inerte) | `payment_failed` via webhook route (clé `stripe_event_id`) | additif | Nul |
| Remboursement | ponts Partner/CloneStory (métier, non analytique canonique) | `payment_refunded` via webhook route (nouvelle branche `charge.refunded`, clé `stripe_event_id`) | additif | Nul |
| Session checkout créée | vue de page `/checkout` (`PresencePing`, legacy) — sémantique DIFFÉRENTE | `checkout_session_created` via `/api/checkout` après création Stripe réelle (clé `stripe_session_id`) | collision de nom legacy résolue : vue ≠ session créée (voir Phase 14) | Nul |
| Démo générale terminée | `emitDemoEvent`(local, jamais réseau) + BLOC3 `demo_completed`(inerte) + `founder demo_completed`(legacy) | `demo_completed` via `track()` client, clé `demo_run_id` | additif, dédupé par run | Nul |
| Démo Pierre terminée | idem, 3 systèmes legacy | `pierre_demo_completed` via `track()`, clé `demo_run_id` | additif | Nul |
| GuidedTour | aucun (0 télémétrie avant) | `guided_tour_*` via `track()` | pur ajout | Nul |

## Points de dédup techniques (testés)

- **Double webhook** (rejeu Stripe) → même `stripe_event_id` → même event_id déterministe →
  `on conflict do nothing` → **une seule ligne** (testé `server-events.test.ts` « replay-safe »).
- **Double soumission formulaire** → `reservation_submitted` client dédupé par `dedupeKey` +
  event_id unique côté serveur ; `reservation_created` (vérité serveur) idempotent par
  `email_normalized` en amont, donc un seul `reservation_created`.
- **Double clic CTA** → `dedupeKey` process-level dans `track()`.
- **Retry réseau** → `event_id` généré une seule fois avant envoi → doublon absorbé DB.
- **React Strict Mode** (démo/Pierre/GuidedTour) → `demo_run_id`/dedupeKey stables → une seule
  émission logique.
- **founder-access + adaptateur** → l'adaptateur écrit dans le sink canonique uniquement ;
  l'ancien funnel founder reste dans sa propre table, jamais unionné.

## Garantie structurelle

`countFunnelStages` (`store.ts`) : `from clonestore_analytics_events_v1 ... group by event_name`
— **aucune** jointure/union avec `clonestore_founder_funnel_events`, `clonestore_web_events`, ou
les tables BLOC3. Il est structurellement impossible qu'un événement legacy soit compté par le
funnel canonique.
