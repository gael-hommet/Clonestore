# Analytics Runtime — Correlation, Non-Blocking Safety & Clean Checkout Re-Closure

Reprise ciblée fermant trois réserves du bloc `CANONICAL ANALYTICS RUNTIME WIRING CLOSURE`
(HEAD de départ `e7845354…`, avancé à `cd5bc811…` par un commit Pierre concurrent disjoint).

## Réserve 1 — Corrélation client→serveur réelle

Avant : les vérités serveur (`reservation_created`, `activation_completed`,
`checkout_session_created`, `payment_succeeded`) étaient stockées avec `visitor_id: null`. Le test
prouvait la présence, pas l'appartenance à un même parcours.

Corrigé :
- **Table de liaison** `clonestore_analytics_conversion_links_v1` (append/upsert, keyée
  `(reservation_id, environment)`, indexée `order_ref`) — additive, locale, RLS forcée, aucune
  PII, références Stripe hachées.
- **Résolveurs lecture seule** `readVisitorId`/`readSessionId` (cookies signés existants, jamais de
  génération).
- **Wiring** : réservation (lie visitor/session), email confirmé (résout par reservation_id, sans
  cookie), checkout (lie session Stripe hachée + user), activation (résout par reservation_id,
  sans cookie), webhook paiement (résout par reservation_id puis order_ref, sans cookie),
  attribution Partner conservée.
- **Preuve** : `correlated-funnel-e2e.test.ts` — le même `visitor_id` traverse démo → réservation
  → email → checkout → activation → paiement ; cohorte de 1 reconstruite par le dashboard.

## Réserve 2 — Analytics non-bloquante bornée

Avant : appels `await`és, un appel jamais résolu aurait pu retarder le métier.

Corrigé : primitive `boundedAnalyticsWrite(op, timeoutMs)` — durée maximale bornée (défaut 500 ms,
`ANALYTICS_WRITE_TIMEOUT_MS`), résultat fermé (`inserted`/`duplicate`/`unavailable`/`timeout`/
`rejected`), jamais d'exception, jamais de fire-and-forget non garanti. Tous les points serveur
(réservation, verify, activation, checkout, webhook) passent désormais par cette borne.
**Preuve temporelle** : `bounded-write.test.ts` prouve qu'un op qui ne se résout jamais rend
`timeout` en < 2 s (borne 120 ms) et que le chemin métier continue.

## Réserve 3 — Tests réellement exécutés

P0.1/P0.2 et P21/P22 ne sont plus déclarés verts « parce que non touchés » : ils sont **exécutés**
(Phase F, groupes séparés). Voir `ANALYTICS_RUNTIME_TEST_MATRIX.md` + verdict pour les nombres.

## Sécurité / production

`PRODUCTION_AUTHORIZED=false` intact. Aucun push, déploiement, migration distante, service réel.
Migration corrélation testée en local (PGlite) uniquement.

## Statut

Voir `ANALYTICS_RUNTIME_WIRING_VERDICT.md` (section re-fermeture).
