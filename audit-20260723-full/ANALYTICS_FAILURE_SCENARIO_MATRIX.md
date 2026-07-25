# Analytics Failure Scenario Matrix

Le métier reste toujours correct ; l'analytics ne bloque jamais, ne double jamais, ne se forge
jamais.

| Scénario | Comportement analytics | Métier | Couverture |
|---|---|---|---|
| DB Analytics indisponible | `getAnalyticsDbForIngestion`→null / adaptateur `{ok:false}` | réservation/email/activation/checkout/paiement tous valides | doctrine best-effort (tous les points d'appel) |
| Double clic CTA | `dedupeKey` process-level | — | `track()` dedupeGuards |
| Double soumission formulaire | `reservation_submitted` dédupé ; `reservation_created` idempotent (`email_normalized`) | 1 réservation | synthetic-e2e + founder |
| Confirmation email rejouée | event_id déterministe → 1 ligne | redirection inchangée | founder adapter test |
| Activation rejouée | 1 `activation_completed` | 1 activation | synthetic-e2e « replayed founder activation » |
| Session checkout rejouée | même `session.id` → 1 événement | Stripe renvoie la session d'origine | idempotence Stripe + event_id |
| Webhook signé rejoué | même `stripe_event_id` → 1 événement | ledger idempotent | synthetic-e2e « replayed webhook » |
| Webhook NON signé | `constructEvent` échoue (400) → code d'émission jamais atteint | 400 | webhook wiring report |
| Paiement échoué | `payment_failed` émis après métier | `past_due` écrit | webhook wiring |
| Remboursement | `payment_refunded` émis | ponts commerciaux gèrent le métier | webhook wiring |
| Faux `payment_succeeded` client | rejeté (endpoint 422 / API serveur `NOT_A_SERVER_EVENT`) | — | schema.test + synthetic-e2e |
| Faux partner ID client | impossible (champ absent de l'enveloppe client ; résolu serveur only) | — | attribution contract |
| Attribution Partner invalide | résolveur retourne null (partenaire non actif / pas de customer) | — | partner-attribution-resolver |
| Trafic interne / test / bot | `traffic_class` ≠ external → exclu du funnel par défaut | — | traffic.test |
| Ordre réseau inversé | funnel lu par `occurred_at`, reconstructible | — | idempotence report |
| Démo terminée sans début | `demo_completed` enregistré mais le dashboard compte les runs (`demo_run_id`) : un run sans `demo_started` ne « passe » pas l'étape amont | — | run-based counting |
| Étape Pierre sans run | `demo_run_id` requis pour compter comme run | — | run-based counting |
| Analytics 503 (écriture en cours) | endpoint répond 503 honnête, jamais un faux succès | navigation inchangée | ingestion route |
| Rate limit | 429 sur l'ingestion, best-effort côté client | — | ingestion route (réutilise founder rate-limit) |

Prouvé par : `synthetic-funnel-e2e.test.ts` (12), `server-events.test.ts` (12),
`founder-access-adapter.test.ts` (6), `schema.test.ts`, `traffic.test.ts`, `store.test.ts`.
