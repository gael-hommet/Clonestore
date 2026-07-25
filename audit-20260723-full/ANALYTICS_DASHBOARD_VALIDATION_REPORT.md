# Analytics Dashboard Validation Report (Phase 19)

Le dashboard propriétaire (`/internal/[slug]/command-center/analytics`, `dashboard-guard.ts`)
reconstruit le funnel exclusivement depuis `clonestore_analytics_events_v1`.

## Vérifié par le funnel synthétique (`synthetic-funnel-e2e.test.ts`)

- **Trafic externe uniquement par défaut** : `countFunnelStages` filtre `traffic_class='external'`
  — une ligne interne/test/bot n'apparaît jamais (prouvé : un visiteur interne synthétique n'entre
  pas dans le compte externe).
- **Dénominateurs** : chaque étape expose visiteurs/sessions/runs/total distincts.
- **Runs Pierre** : `pierre_demo_completed` compté par `demo_run_id` distinct (=1).
- **Paiements** : `payment_succeeded` totalEvents=1, PAYMENT_PROVIDER_CONFIRMED.
- **Alignement** : chaque étape du funnel synthétique correspond exactement à une ligne du
  dashboard (1 visiteur, 3 page views, 2 runs, 1 paiement).

## Garde d'accès (inchangée, `dashboard-guard.test.ts`, 7 tests)

- Accès anonyme → `notfound`/`locked`, jamais de données.
- Slug erroné / porte non configurée → `notfound`.
- Cookie forgé → jamais `ready`.
- Owner autorisé (porte complète + session) → données.

## Confidentialité

Aucun email, IP, nom, donnée de formulaire affichés — uniquement des comptes agrégés
(`count(distinct …)`). Petit échantillon (`< 10`) marqué `échantillon insuffisant`. Stockage
indisponible → message honnête, jamais « zéro visiteur ».

## Non fait

Pas de rendu navigateur réel du dashboard dans ce bloc (Playwright indisponible) — la validation
repose sur les tests du guard + la reconstruction du funnel synthétique par la même fonction
d'agrégation qu'utilise la page.
