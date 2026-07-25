# Analytics Synthetic End-to-End Proof

Test : `src/lib/analytics/__tests__/synthetic-funnel-e2e.test.ts`, **12/12 verts** contre PGlite
réel (Postgres 16 en process), environnement 100% fictif, aucun réseau/Stripe/webhook/email réel.

## Scénario

Un seul visiteur externe fictif traverse tout le funnel :
homepage → prompt vu/cliqué → `/demo` (started, 2 étapes, completed) → `discover_pierre_clicked`
→ `/demo/pierre` (started, étape, completed) → CTA réservation → formulaire (started, submitted)
→ réservation serveur créée → email confirmé → activation commencée → activation terminée →
checkout démarré → session Stripe test créée → paiement réussi (attribution Partner) →
remboursement test.

Identités fixes : 1 `visitor_id`, 1 `session_id`, 3 `page_view_id` (home/demo/pierre), 2
`demo_run_id` (generic + pierre).

## Preuves vérifiées

| Preuve | Résultat |
|---|---|
| Un seul visiteur externe distinct | ✅ 1 |
| Page views distinctes | ✅ 3 |
| Runs démo distincts | ✅ 2 |
| Aucun doublon (event_id, environment) | ✅ 0 |
| `payment_succeeded` = PAYMENT_PROVIDER_CONFIRMED + attribution Partner + source=stripe | ✅ |
| `reservation_created` = SERVER_PERSISTED | ✅ |
| `reservation_email_confirmed` = SERVER_CONFIRMED | ✅ |
| `activation_completed` = PAYMENT_PROVIDER_CONFIRMED | ✅ |
| `checkout_session_created` = SERVER_CONFIRMED | ✅ |
| Dashboard `countFunnelStages` reconstruit le funnel depuis la seule table canonique | ✅ |
| Aucune PII (`@` absent de toutes les propriétés stockées) | ✅ |

## Scénarios d'échec (Phase 17) — 4 verts

| Scénario | Résultat |
|---|---|
| Webhook rejoué (même stripe_event_id) | ✅ aucun 2ᵉ `payment_succeeded` |
| `payment_succeeded` client-forgé via l'API serveur | ✅ refusé (`NOT_A_SERVER_EVENT`) |
| Activation founder rejouée (même réservation) | ✅ aucun 2ᵉ `activation_completed` |
| `checkout_session_created` vs `payment_succeeded` — ids déterministes distincts | ✅ pas de collision |

Le métier reste correct dans tous les cas (les scénarios prouvent l'absence de double comptage et
l'impossibilité de forger une conversion, sans jamais bloquer une écriture métier).
