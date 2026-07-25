# Canonical Funnel Query Spec

Implémenté par `src/lib/analytics/store.ts` (`countFunnelStages`), utilisé par
`dashboard-guard.ts`. Toutes les requêtes filtrent `traffic_class = 'external'` par défaut
(jamais mélangé avec interne/test/automatisé sans le demander explicitement).

## Requête de base

```sql
select event_name,
       count(distinct visitor_id) as distinct_visitors,
       count(distinct session_id) as distinct_sessions,
       count(distinct demo_run_id) as distinct_demo_runs,
       count(*) as total_events
from clonestore_analytics_events_v1
where event_name = any($1) and occurred_at >= $2 and occurred_at < $3
  and traffic_class = 'external'
group by event_name;
```

## Exemple de taux — dénominateur toujours explicite, jamais implicite

```
pierre_demo_completion_rate
  = count(distinct demo_run_id ayant pierre_demo_completed, external)
  / count(distinct demo_run_id ayant pierre_demo_started, external)
```

Jamais de mélange visiteurs/sessions/vues/runs/formulaires/commandes dans un même ratio — chaque
taux affiché au dashboard (`page.tsx`) précise explicitement quelle identité sert de
dénominateur (`distinctVisitors` pour le funnel d'acquisition principal, `distinctDemoRuns` pour
le funnel Pierre spécifiquement, jamais interchangés).

## Cohortes (Phase 19)

Dimensions prévues par le contrat (colonnes déjà présentes en base) : première visite (dérivée de
`min(occurred_at)` par `visitor_id`), pays (`country_code`), source (`source_channel`),
campagne (`campaign_key`), Partner (`partner_attribution_id`), semaine/jour
(`date_trunc('week'|'day', occurred_at)`). **Les requêtes de cohorte elles-mêmes ne sont pas
matérialisées dans ce bloc** — le dashboard v1 (Phase 20) se limite au funnel agrégé sans
segmentation par cohorte, pour rester dans le périmètre réellement testé. Toute vue de cohorte
future doit respecter la même règle : effectif brut + taux + `insufficient_sample` si
`< 10` (seuil déjà appliqué au funnel v1, voir `ANALYTICS_DASHBOARD_SPEC.md`).

## Non fait dans ce bloc

Aucune vue SQL matérialisée, aucune fonction agrégée dédiée par cohorte — `countFunnelStages`
suffit au dashboard v1. Documenté honnêtement plutôt que fabriqué.
