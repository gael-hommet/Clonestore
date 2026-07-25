# Analytics Measurement Health Spec

Implémenté (partiellement — voir section finale) : `src/lib/analytics/store.ts`
(`measurementHealthSnapshot`), affiché dans la section « Santé de la mesure » du dashboard.

## Livré dans ce bloc

- Événements acceptés sur la fenêtre (`count(*)` depuis `received_at >= since`).
- Répartition par `trust_level` (combien de `CLIENT_OBSERVED` vs `SERVER_PERSISTED` vs
  `SERVER_CONFIRMED` vs `PAYMENT_PROVIDER_CONFIRMED` reçus).

## Listé par le master prompt, non instrumenté dans ce bloc (honnêteté du périmètre)

`events refusés`, `invalid schema` (compté côté HTTP 422 mais pas persisté dans une table de
suivi dédiée), `duplicate rate` (le compteur `duplicatesAvoided` existe dans le type
`MeasurementHealthCounts` mais reste à `0` — dériver un vrai taux exigerait un journal séparé des
tentatives de conflit, non construit ici), `storage failures`, `client/server mismatch`, `events
sans session`, `page views sans visitor`, `demo steps sans demo run`, `conversions serveur sans
attribution`, `checkout sans paiement`, `paiement sans checkout canonique`, `délai moyen de
réception`, `version de schéma active` (celle-ci est triviale — toujours 1 dans ce bloc, un seul
schéma existe).

## Pourquoi documenté plutôt que fabriqué

Chacune de ces métriques est calculable depuis les colonnes déjà persistées
(`clonestore_analytics_events_v1` a tout ce qu'il faut : `visitor_id`, `session_id`,
`page_view_id`, `demo_run_id`, `trust_level`, `received_at`) — rien n'est structurellement
bloqué. Ce qui manque est le temps de ce bloc, pas une dépendance manquante. Marquer ces lignes
`NOT_BUILT` plutôt que les simuler dans le dashboard est la seule option honnête compatible avec
l'interdiction du master prompt de présenter une donnée non prouvée comme acquise.
