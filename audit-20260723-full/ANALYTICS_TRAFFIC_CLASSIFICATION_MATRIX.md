# Analytics Traffic Classification Matrix

Implémenté par `src/lib/analytics/traffic.ts` (`classifyTraffic`), 12 tests verts.

## Catégories fermées

`external` · `internal` · `test` · `automated` · `unknown`.

## Règles (ordre de priorité, testé explicitement)

1. **`automated`** en premier, toujours — un user-agent de bot connu (Googlebot, Bingbot,
   AhrefsBot, HeadlessChrome/Lighthouse, UptimeRobot, etc., 16 patterns fermés) reste `automated`
   même s'il traverse une route admin ou un environnement local (« a bot UA always wins over
   internal/local signals »). Jamais un pattern générique agressif qui classerait un vrai
   visiteur comme bot.
2. **`test`** — jamais accepté en production quel que soit l'en-tête (« NEVER classifies as test
   in production »). Hors production : environnement `test` (CI/Vitest) ou en-tête explicite
   `x-clonestore-test`.
3. **`internal`** — combinaison déterministe, jamais l'IP seule : compte propriétaire
   authentifié, cookie interne signé (valeur exacte `"on"`, testé qu'une valeur approchante
   n'est PAS acceptée), environnement local, route admin.
4. **`external`** par défaut si aucun signal négatif.
5. **`unknown`** uniquement si aucun user-agent n'est disponible.

## Règle dashboard

`ANALYTICS_DASHBOARD_SPEC.md`/`dashboard-guard.ts` : les agrégations funnel filtrent
explicitement `traffic_class = 'external'` — `countFunnelStages` ne compte jamais du trafic
interne, même par accident (prouvé par `store.test.ts`, « excluding internal traffic by
default »). Les autres classes restent consultables séparément (requêtes directes sur la table),
jamais supprimées.

## Non câblé dans ce bloc

Le cookie interne signé (`INTERNAL_COOKIE`, `cs_analytics_internal`) est nommé et la fonction
sait le lire, mais aucune route propriétaire ne l'émet/le bascule encore — hors périmètre
temporel de ce bloc, sans impact sur la classification par défaut (un visiteur sans ce cookie
reste correctement `external`, jamais faussement `internal`).
