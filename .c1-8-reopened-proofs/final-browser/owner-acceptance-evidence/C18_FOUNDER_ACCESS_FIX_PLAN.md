# C1.8 — Founder-access 5xx — Plan de correction

## Inspection

**Fichiers lus** : `src/app/api/founder-access/presence/route.ts`,
`src/app/api/founder-access/funnel/route.ts`, `src/lib/founder-access/runtime.ts`
(`getFounderDb`), `src/lib/pierre/v1/db.ts` (`getRuntimeDb`/`singletonPool`),
`src/lib/founder-access/request-utils.ts` (`distributedRateLimit`),
`src/lib/founder-access/analytics-session.ts` + `signed-cookie.ts` (`resolveAnalyticsSession`),
consommateurs client (`PresencePing.tsx`, `funnel-events.ts` — les deux en `sendBeacon`, réponse
jamais lue), tests existants (`er1-route-security.test.ts`, `er3-analytics-route-persistence.itest.ts`).

## Ce qui s'exécute avant le try/catch, et pourquoi ça jette

Dans les DEUX routes, `const db = await getFounderDb();` s'exécute **avant** tout bloc protecteur.
`getFounderDb()` → `getRuntimeDb()` → `singletonPool()` (`src/lib/pierre/v1/db.ts:47`) :

```ts
const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
if (!url) throw new Error("DATABASE_URL not configured for Pierre runtime");
```

`DATABASE_URL` est neutralisé à vide par le harnais fail-closed (`e2e/c18-fail-closed-env.cjs`,
c'est la garde de sécurité). Le `throw` est **synchrone, avant toute tentative de connexion
réseau** (aucun appel distant n'est jamais tenté — cohérent avec l'exigence fail-closed). Cause
**identique** dans `presence` et `funnel` : le même appel, non protégé, dans les deux fichiers.

**Le reste est déjà protégé** :
- `distributedRateLimit` (`request-utils.ts:44`) a déjà son propre `try/catch` et dégrade vers un
  rate-limit en mémoire si la requête DB échoue. Il ne jette jamais.
- `resolveAnalyticsSession` (`analytics-session.ts` + `signed-cookie.ts`) ne dépend jamais de la DB
  et a un secret de repli par défaut (`analyticsSessionSecret()`). Il ne jette jamais.
- L'écriture analytics elle-même (`upsertWebSession`/`recordWebEvents`/`recordFunnelEvent`) est
  déjà dans un `try/catch` avec le commentaire « l'analytics ne doit jamais casser l'expérience ».

Donc **un seul point non protégé, identique dans les deux fichiers** : l'appel à `getFounderDb()`.

## Pourquoi `getFounderDb()` lui-même n'est PAS corrigé

`getFounderDb()` est aussi utilisé par `src/app/api/founder-access/reservations/route.ts` et
`src/app/api/webhooks/stripe/route.ts` — deux routes où une DB indisponible **doit** faire échouer
la requête bruyamment (une réservation ou un webhook Stripe ne peuvent pas silencieusement
prétendre avoir réussi). Changer `getFounderDb()` lui-même casserait ce contrat correct ailleurs.
La correction doit donc être **locale aux deux routes beacon**, pas dans `getFounderDb()`.

## Correction commune retenue

Un petit helper partagé dans `src/lib/founder-access/runtime.ts`, réservé aux routes
fire-and-forget : `getFounderDbForBeacon()` — retourne `SqlExecutor | null` (jamais un throw),
journalise en interne une ligne redacted (nom d'erreur seulement, jamais de message/stack/secret),
et laisse l'appelant dégrader vers une réponse **204** (déjà le statut de succès existant des deux
routes — cohérence sans introduire un nouveau code). Les deux routes changent d'une ligne :

```ts
const db = await getFounderDbForBeacon();
if (!db) return new NextResponse(null, { status: 204 });
```

Statut retenu : **204** (pas 202) — c'est déjà le statut de succès actuel des deux routes ; les deux
seuls consommateurs client (`sendBeacon`, `fetch(..., {keepalive:true})` sans `.then()`) ignorent
totalement le corps et le statut, donc 204 est cohérent sans ajouter un code que rien ne consomme.

Aucune modification de `distributedRateLimit`, `resolveAnalyticsSession`, ni des chemins déjà
protégés (422 événement serveur, 204 événement inconnu, 413 corps trop grand) — tous conservés
strictement identiques et re-testés.
