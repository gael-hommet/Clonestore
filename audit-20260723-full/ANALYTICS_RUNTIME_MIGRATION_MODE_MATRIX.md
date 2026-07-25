# Analytics Runtime Migration Mode Matrix

Registre du mode de chaque ancien système. Un mode ne produit jamais deux écritures comptées
comme deux conversions.

| Système | Mode à la fermeture | Détail |
|---|---|---|
| Page views (`AnalyticsPageViewTracker`) | `canonical` | Déjà branché, seul producteur de `page_viewed`. |
| Founder-access conversions (reservation/email/activation) | `canonical` | Écriture métier founder-access inchangée + appel additif `bridgeFounderServerEvent` après succès. L'ancien funnel founder-access (`clonestore_founder_funnel_events`) continue d'exister pour le Founder Command Center historique, mais **n'est plus la source du funnel canonique** — le nouveau sink est la seule table lue par le dashboard canonique. Pas de double comptage : le dashboard canonique ne lit QUE `clonestore_analytics_events_v1`. |
| Démo générique (`/demo`) | `canonical` | Les émissions legacy `emitDemoEvent` (système présentation, jamais réseau) et `emitConversionEvent` (BLOC3, inerte en prod) restent dans le code mais ne sont plus comptées — le nouveau `track()` canonique devient la source. Voir `ANALYTICS_DEMO_WIRING_REPORT.md` pour la stratégie exacte (ajout canonique, legacy laissé inerte). |
| Démo Pierre (`/demo/pierre`) | `canonical` | Idem — `track()` canonique ajouté, `demo_run_id` propre au run Pierre. |
| GuidedTour | `canonical` | Aucune télémétrie avant ce bloc — pur ajout, aucun risque de doublon. |
| Checkout / paiement | `canonical` | `checkout_session_created` depuis `/api/checkout`, `payment_*` depuis le webhook Stripe signé — additif, best-effort. |
| BLOC3 conversion | `disabled` (pour la mesure de funnel) | Toujours inerte en production (backend jamais implémenté). N'écrit rien, donc ne double rien. Non réparé (hors périmètre, ISSUE-15 reste ouvert). Le dashboard canonique ne lit jamais ses tables. |
| Analytics de présentation locale (`emitDemoEvent`) | `disabled` (pour la mesure) | Reste dans le code (peut servir un futur usage UX local via `window.__cloneDemoAnalytics`), mais **jamais comptée** dans le funnel canonique — elle n'effectue aucun appel réseau, donc structurellement incapable de doubler une écriture canonique. |

## Preuve d'absence de double comptage

Le dashboard canonique (`dashboard-guard.ts` → `countFunnelStages`) agrège **exclusivement**
`clonestore_analytics_events_v1`. Aucune requête ne joint ou n'unionne les tables legacy
(`clonestore_founder_funnel_events`, `clonestore_web_events`, tables BLOC3). Un événement legacy
ne peut donc jamais apparaître deux fois : soit il est traduit vers le sink canonique par un
adaptateur additif (une seule ligne, event_id déterministe), soit il reste dans son système
d'origine invisible du dashboard canonique. Détail par conversion :
`ANALYTICS_CROSS_SYSTEM_DEDUPLICATION_REPORT.md`.
