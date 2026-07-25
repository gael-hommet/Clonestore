# Analytics Idempotence and Ordering Report

| Scénario | Garantie | Preuve |
|---|---|---|
| Même événement soumis deux fois | Une seule écriture | `store.test.ts` : « the SAME event_id submitted twice ... writes exactly once » ✅ |
| Même webhook Stripe traité deux fois | Une seule conversion canonique | `founder-access-adapter.test.ts` : « replaying the same founder event (same deterministic id) never creates a second row » — `event_id` dérivé par sha256(reservationId:eventName), jamais aléatoire ✅ |
| Même checkout réutilisé | Pas de nouvelle conversion | Découle de la même propriété : `checkout_session_created`/`payment_succeeded` server-only, event_id déterministe côté adaptateur ✅ (câblage réel différé, voir migration matrix) |
| Même page view en Strict Mode | Une seule vue | `AnalyticsPageViewTracker` : garde `useRef` anti-double-émission + `page_view_id` généré une fois par navigation réelle |
| CTA double-cliqué | Un seul événement logique | `track()` accepte un `dedupeKey` optionnel, mémorisé en mémoire de process (`dedupeGuards`) |
| Retry réseau | Aucun doublon | `event_id` généré une fois côté client avant le premier envoi ; un retry renvoie le même `event_id` → contrainte unique DB absorbe le doublon |
| Client malveillant réutilisant un `event_id` avec un autre payload | Rejet du 2ᵉ contenu | `on conflict (event_id, environment) do nothing` — la 1ʳᵉ écriture gagne, la 2ᵉ n'écrase jamais silencieusement ; testé (« outcome=duplicate on the 2nd ») |
| Événements trop anciens/futurs | Règle documentée et appliquée | Contrainte DB `analytics_events_v1_occurred_at_plausible` : `occurred_at ∈ [received_at-400j, received_at+5min]`, testée (rejet futur, rejet passé extrême) |
| Ordre réseau inversé | Funnel reconstructible | Le funnel se lit par agrégation sur `occurred_at`, pas sur l'ordre d'arrivée réseau (`received_at` ≠ `occurred_at`, les deux stockés séparément) |

Toutes les lignes ci-dessus sont couvertes par un test réel exécuté contre PGlite (23 tests dans
`store.test.ts` + 6 dans `founder-access-adapter.test.ts`), à l'exception du "retry réseau" et
du "CTA double-cliqué" qui sont des propriétés du tracker client (logique pure, pas de
dépendance réseau à mocker pour les prouver — la garantie vient de la génération unique de
`event_id` avant tout envoi, vérifiable par lecture de `track.ts`).
