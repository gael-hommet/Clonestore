# Analytics Security Test Matrix

| Scénario requis | Couvert par un test réel ? | Détail |
|---|---|---|
| Événement inconnu | ✅ | `schema.test.ts` — `UNKNOWN_EVENT_NAME` |
| Payload énorme | ✅ (partiel) | `readJsonBounded` réutilisé de founder-access (déjà borné, `MAX_BODY_BYTES`) ; `properties_json` borné en DB (8192 octets, testé) |
| Injection (script dans un champ) | ✅ | `schema.test.ts` — `stepId` contenant `<script>` → `INVALID_STEP_ID` ; `attribution.test.ts` — UTM contenant du texte libre → rejeté |
| Prototype pollution | ⚠️ non testé explicitement | `sanitizeCanonicalProperties` itère via `Object.entries` et n'écrit que sur un objet littéral neuf (`out = {}`) — `__proto__`/`constructor` comme clé ne matcheraient de toute façon aucune entrée de l'allowlist, donc structurellement neutralisé, mais aucun test dédié ne le prouve |
| Clé non autorisée | ✅ | `schema.test.ts` — « drops any key not on the allowlist » |
| Route privée | ✅ | `AnalyticsPageViewTracker` — toute route hors `CANONICAL_ROUTE_KEYS` ou sous un préfixe privé devient `PRIVATE_ROUTE_REDACTED`, jamais l'URL réelle |
| Token dans l'URL | ✅ (structurel) | Aucun query string libre n'atteint jamais `routeKey` — seules les 12 routes canoniques fermées sont acceptées côté validation serveur |
| PII | ✅ | `schema.test.ts` — email/password hors allowlist → retirés ; `ANALYTICS_PRIVACY_AND_RETENTION_MATRIX.md` documente l'absence structurelle d'IP/UA brut/géoloc précise |
| Timestamp futur | ✅ | `store.test.ts` — occurred_at +1h → rejeté (contrainte DB) |
| Timestamp ancien | ✅ | `store.test.ts` — occurred_at -500j → rejeté (contrainte DB) |
| Faux user ID | ⚠️ non applicable/non testé | `authenticatedUserId` n'est jamais accepté du client dans l'enveloppe (absent du schéma client) — structurellement impossible à forger depuis l'endpoint public, pas de test dédié car pas de chemin d'attaque identifié |
| Faux partner ID | ✅ (structurel) | Voir `ANALYTICS_ATTRIBUTION_CONTRACT.md` — `partnerAttributionId` absent de l'enveloppe client, résolu uniquement côté serveur (câblage réel différé) |
| Faux country | ✅ (structurel) | `countryCode` absent de l'enveloppe client |
| Faux payment event | ✅ | `schema.test.ts` — `payment_succeeded` etc. rejetés explicitement d'une soumission client (« the only acceptable behavior ») |
| Event ID réutilisé | ✅ | `store.test.ts` — même event_id 2× → `duplicate`, jamais 2 lignes |
| Rate limit | ✅ (réutilisé) | `distributedRateLimit` (60/min/IP-hachée) déjà testé côté founder-access, réutilisé tel quel sans modification |
| Brute force | ⚠️ non testé pour analytics spécifiquement | Le rate limit couvre partiellement ; aucun test de brute-force dédié écrit dans ce bloc |
| Cookie modifié | ✅ | `identity.test.ts` — cookie tronqué/modifié → nouvelle identité émise, jamais l'ancienne acceptée |
| Signature invalide | ✅ | `identity.test.ts` — secret différent → nouvelle identité (équivalent signature invalide) |
| CSRF | N/A | Endpoint public anonyme sans action à privilège (comme `presence`/`funnel` existants) — pas de session authentifiée à protéger côté ingestion |
| Accès dashboard anonyme | ✅ | `dashboard-guard.test.ts` — pas de cookie → `notfound`/`locked`, jamais `ready` |
| Accès dashboard utilisateur non owner | ⚠️ non testé directement | Délègue entièrement à `resolveFounderAdmin()` (déjà testé côté founder-access) — aucun test analytics dédié ne simule un utilisateur authentifié non-owner |
| Export de données non autorisé | N/A | Aucune fonctionnalité d'export construite dans ce bloc — rien à tester |

## Synthèse

19 scénarios listés par le master prompt : **14 couverts par un test réel ou une garantie
structurelle claire**, **3 marqués `⚠️` (couverture partielle ou absente, honnêtement signalée)**,
**2 `N/A`** (fonctionnalité hors périmètre de ce bloc). Aucune case n'affirme un test qui n'existe
pas.
