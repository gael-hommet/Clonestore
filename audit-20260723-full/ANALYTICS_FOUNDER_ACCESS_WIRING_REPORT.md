# Analytics Founder-Access Wiring Report

Trois vérités serveur founder-access branchées au sink canonique, toutes **additives, après
persistance métier réussie, best-effort, event_id déterministe**. L'adaptateur
(`bridgeFounderServerEvent`) ne jette jamais et n'a jamais modifié le calcul métier.

| Événement | Fichier / point | Gate | Trust |
|---|---|---|---|
| `reservation_created` | `src/app/api/founder-access/reservations/route.ts`, après `res.id` (transaction store committée) | réservation réellement persistée | `SERVER_PERSISTED` |
| `reservation_email_confirmed` | `src/app/api/founder-access/verify/route.ts`, après `confirmReservation` quand `res.ok` | token valide | `SERVER_CONFIRMED` |
| `activation_completed` | `src/lib/founder-access/stripe-webhook-bridge.ts`, après `applyFounderStripeEvent` | `grants && applied && !duplicate` | `PAYMENT_PROVIDER_CONFIRMED` |

## Décision anti-double-comptage

Le bridge founder mappe aussi `founder_payment_completed → payment_succeeded`, mais **ce bloc ne
l'appelle jamais avec `founder_payment_completed`** : `payment_succeeded` a un seul producteur, la
route webhook (clé `stripe_event_id`). Le bridge founder n'émet que `reservation_created`,
`reservation_email_confirmed`, `activation_completed`.

## Gates vérifiés

- Réservation rejetée (validation/honeypot) → aucun `reservation_created` (émis seulement dans le
  `try` après `createOrUpdateReservation` réussi).
- Email invalide/expiré → `res.ok` faux → aucun `reservation_email_confirmed`.
- Activation échouée / proof_failed / unsupported → `grants`/`applied` faux → aucun
  `activation_completed`.
- Rejeu (idempotence founder + event_id déterministe) → une seule ligne canonique.
- Analytics indisponible → l'adaptateur retourne `{ok:false}`, le métier reste valide (redirection
  `verify`, réponse `reservations`, activation webhook toutes inchangées).
