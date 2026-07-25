# Analytics Event Schema v1

Implémenté par `src/lib/analytics/schema.ts` (31 événements canoniques, 5 niveaux de confiance,
15 propriétés allowlistées, 12 routes canoniques). 84 tests unitaires/intégration verts
(`src/lib/analytics/__tests__/*`, `src/lib/analytics/adapters/__tests__/*`).

## Enveloppe (telle que soumise par le client)

```ts
interface AnalyticsEventEnvelopeV1 {
  schemaVersion: 1;
  eventId: string;              // UUID v4, généré client, garantit l'idempotence
  eventName: CanonicalAnalyticsEventName;
  occurredAt: string;           // ISO 8601
  source: "web";                // le client ne peut jamais prétendre être "server"/"stripe"/"system"
  pageViewId?: string;
  demoRunId?: string;
  routeKey?: CanonicalRouteKey; // route normalisée, jamais une URL brute
  stepId?: string;               // /^[a-zA-Z0-9_:.-]{1,64}$/, jamais textContent
  properties?: CanonicalAnalyticsProperties; // allowlist stricte, clés hors-liste silencieusement retirées
}
```

Le serveur enrichit (jamais accepté du client) : `trustLevel`, `visitorId`, `sessionId`,
`receivedAt`, `environment`, `trafficClass`, `authenticatedUserId`, `countryCode`,
`sourceChannel`, `campaignKey`, `partnerAttributionId`, `consentState`.

## Validation (`validateClientEnvelope`)

Rejet actif (HTTP 422, jamais un 204 silencieux qui masquerait un bug client) sur : version de
schéma incorrecte, `eventId` non-UUID, nom d'événement inconnu, événement server-only soumis par
un client, `occurredAt` non parseable, `source` ≠ `"web"`, `pageViewId`/`demoRunId` non-UUID,
`routeKey` non énuméré, `stepId` hors format. `properties` non allowlistées sont retirées
silencieusement (jamais un rejet total pour une clé en trop — cohérent avec "l'analytics ne doit
jamais casser l'expérience").

## Interdiction structurelle — pas seulement documentaire

`Record<string, unknown>` public **n'existe nulle part** dans le contrat : `properties` est
typé `Partial<Record<CanonicalPropertyKey, string | number | boolean>>`, et
`sanitizeCanonicalProperties` filtre activement toute clé absente de `CANONICAL_PROPERTY_KEYS`
(15 clés fermées : demoType, sectionKey, ctaKey, tourId, failureReason, amountBucket, currency,
country, device, utmSource/Medium/Campaign/Content/Term).

## Événements server-only (9) — un client ne peut jamais les créer

`visitor_created`, `session_started`, `reservation_created`, `reservation_email_confirmed`,
`checkout_session_created`, `activation_completed`, `payment_succeeded`, `payment_failed`,
`payment_refunded` — testé explicitement (`schema.test.ts`, « rejects payment_succeeded,
activation_completed, ... explicitly »).

Voir `CANONICAL_FUNNEL_DEFINITION.md` pour la définition métier de chaque étape et
`ANALYTICS_DATABASE_SCHEMA_REPORT.md` pour la persistance.
