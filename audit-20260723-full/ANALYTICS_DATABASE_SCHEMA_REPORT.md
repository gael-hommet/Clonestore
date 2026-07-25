# Analytics Database Schema Report

Migration : `supabase/migrations/2026-07-25__clonestore_analytics_events_v1.sql`. **Non
appliquée à distance** — testée exclusivement en local via PGlite (Postgres 16 réel, en
process), voir `src/lib/analytics/__tests__/store.test.ts` (23 tests, tous verts).

## Table `clonestore_analytics_events_v1`

Append-only forcée (trigger dédié, voir plus bas), RLS activée et **forcée**, colonnes exactes
listées dans le SQL (id, event_id, schema_version, event_name, occurred_at, received_at,
source, trust_level, environment, traffic_class, visitor_id, session_id, page_view_id,
demo_run_id, authenticated_user_id, route_key, step_id, country_code, source_channel,
campaign_key, partner_attribution_id, properties_json, consent_state).

## Contraintes testées et prouvées vertes

| Contrainte | Test | Résultat |
|---|---|---|
| `event_id`+`environment` unique | insertion du même event_id 2× → 1 seule ligne | ✅ |
| `event_name` 1–128 caractères | — | ✅ (contrainte DB) |
| `trust_level` ∈ 5 valeurs fermées | valeur inventée → rejet | ✅ |
| `source`/`environment`/`traffic_class`/`consent_state` fermés | — | ✅ (contraintes DB) |
| `occurred_at` plausible (≤ received_at+5min, ≥ received_at-400j) | futur/passé extrême → rejet | ✅ |
| `properties_json` bornée (≤8192 octets) | — | ✅ (contrainte DB, défense en profondeur) |
| Append-only (UPDATE bloqué) | tentative UPDATE → exception | ✅ |
| Append-only (DELETE bloqué hors purge) | tentative DELETE directe → exception | ✅ |
| Purge : cutoff futur refusé | — | ✅ |
| Purge : rôle applicatif n'a pas le droit d'exécuter la fonction | `pierre_rt_app` → exception | ✅ |
| `event_id` identique dans 2 environnements différents = 2 lignes valides | — | ✅ |

## Fonction de purge (`clonestore_analytics_purge_before`)

`SECURITY DEFINER`, contourne l'append-only via un drapeau **local à la transaction**
(`set_config('clonestore.allow_analytics_purge', 'on', true)`), jamais persistant, jamais
accordé au rôle applicatif général — seul un rôle dédié
`clonestore_analytics_retention_operator` (créé, jamais accordé à un utilisateur applicatif
dans ce bloc) peut l'exécuter. **Aucun cron n'appelle cette fonction** — la durée de rétention de
production reste `OWNER_APPROVAL_REQUIRED` (voir `ANALYTICS_PRIVACY_AND_RETENTION_MATRIX.md`).

## Index

`(event_id, environment)` unique, `visitor_id`, `session_id`, `page_view_id`, `demo_run_id`,
`(event_name, occurred_at)`, `(environment, traffic_class)`, `received_at`.

## Intégration au harnais de test existant

`src/lib/pierre/v1/test-runtime-db.ts` étendu de façon additive (1 nouveau flag opt-in
`PIERRE_E2E_ANALYTICS_SCHEMA=1`, même pattern que `PIERRE_E2E_FOUNDER_SCHEMA`) — n'affecte
aucun test Pierre existant qui n'active pas ce flag explicitement.

## Non appliqué, par conception, dans ce bloc

Aucune migration distante. Aucune écriture sur une base partagée. La preuve de fonctionnement
est exclusivement locale (PGlite), conformément à l'interdiction absolue de ce bloc.
