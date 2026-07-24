# P0.1 — `/api/pierre/execute/route.ts` avant / après re-clôture

## Avant (HEAD du 2026-07-24 au début de ce bloc, byte-identique au commit `8b0b5c5f7` du 2026-05-24 + refactor lazy-init)

- `getRuntime()` exigeait 6 variables : Supabase (2) + `ROUTER_HMAC_SECRET` + **3 URLs Make**
  (`MAKE_EMAIL_WEBHOOK_URL`, `MAKE_DOC_WEBHOOK_URL`, `MAKE_INTEGRATIONS_WEBHOOK_URL`).
- Après auth HMAC + `assertPierreAccess` (existence d'une ligne `agent_configs`, pas une
  décision de gouvernance) + idempotence, les 3 actions connues appelaient **directement et
  inconditionnellement** `callMake(...)` :
  - `email.send` → `callMake(makeEmailWebhookUrl, ...)`, aucune vérification autre que le
    format Zod.
  - `doc.generate` → `callMake(makeDocWebhookUrl, ...)`, écrivait ensuite dans `documents` si
    Make renvoyait une URL.
  - `hris.sync` → `callMake(makeIntegrationsWebhookUrl, ...)`.
- Aucun import, aucune mention de `evaluatePierreCloneGuard`, `evaluateGovernance`, ou
  `evaluateLegacyExecuteGovernance` nulle part dans le fichier.
- `ApiErrorCode` ne contenait ni `GOVERNANCE_BLOCKED` ni `HUMAN_APPROVAL_REQUIRED` — seulement
  `MAKE_ERROR` (échec réseau/HTTP de Make, pas un refus de gouvernance).
- Conséquence : n'importe quel appelant HMAC-valide (y compris l'appelant interne réel
  `/api/pierre/tick`, voir `P0_1_CALLER_AND_SURFACE_MATRIX.md`) pouvait déclencher un envoi
  d'email réel, une génération de document réelle, ou une synchronisation HRIS réelle, sans
  aucune évaluation CloneGuard/gouvernance.

## Après (ce bloc)

- `getRuntime()` ne requiert plus que 3 variables (Supabase ×2 + `ROUTER_HMAC_SECRET`) — les 3
  `MAKE_*_WEBHOOK_URL` ont disparu du fichier avec le connecteur.
- Import ajouté : `evaluateLegacyExecuteGovernance` (`@/lib/pierre/legacy-execute-governance`),
  réutilisé tel quel — **aucun second évaluateur créé**.
- Nouvelle étape 7 (juste après l'idempotence, avant toute logique par action) : pour les 3
  actions connues, `evaluateLegacyExecuteGovernance({action, payload, now})` est appelée en
  premier. Le résultat gouverne la suite :
  - `DENY` → 403, `error.code = "GOVERNANCE_BLOCKED"`, `decision: "DENY"`, aucun appel réseau,
    audit `ok:false`.
  - `REQUIRE_APPROVAL` → 202, `error.code = "HUMAN_APPROVAL_REQUIRED"`, `decision:
    "REQUIRE_APPROVAL"`, aucun appel réseau, aucune écriture `documents`, audit `ok:false`.
  - `ALLOW` (structurellement possible mais qu'aucune règle canonique actuelle ne produit pour
    ces 3 actions sur cette route) → **plancher explicite** : `501 EXECUTION_NOT_AVAILABLE`
    plutôt qu'un dispatch, puisque `callMake` n'existe plus physiquement dans le fichier.
  - Plancher supplémentaire, indépendant du moteur : pour `hris.sync` spécifiquement, un
    `ALLOW` retourné par le moteur canonique est forcé à `REQUIRE_APPROVAL` avant même d'être
    évalué ci-dessus (défense en profondeur explicitement exigée par le prompt maître).
- `callMake`, `tryInsertDocument`, `safeParseJsonString`, `EmailSendSchema`,
  `DocGenerateSchema`, `HrisSyncSchema`, `withRequestId` : **supprimés entièrement** (code mort
  une fois le dispatch retiré — confirmé par recherche globale, aucune autre référence dans
  `src/`).
- `ApiErrorCode` : `MAKE_ERROR` retiré (plus aucun appel réseau ne peut échouer, puisqu'aucun
  appel réseau n'existe) ; `GOVERNANCE_BLOCKED`, `HUMAN_APPROVAL_REQUIRED`,
  `EXECUTION_NOT_AVAILABLE` ajoutés.
- Auth HMAC, anti-rejeu, `assertPierreAccess`, idempotence (`maybeReturnIdempotentResult`),
  audit best-effort, `UNKNOWN_ACTION` fail-closed : **inchangés bit pour bit**.
- Lazy-init (`getRuntime()`, jamais évalué au chargement du module) : **préservé intégralement**
  — aucune régression vers l'ancienne initialisation "eager" qui cassait le build Vercel.

## Ce qui n'a PAS changé (dans le périmètre interdit)

Homepage, slogan, schémas, illustrations, animations, changements Demo/Mobile, tarification
canonique, Price IDs Stripe, `/api/checkout`, webhook Stripe, pages légales, TVA,
`PRODUCTION_AUTHORIZED` (toujours `false as const`), moteur v1/hr (aucune modification —
`cloneguard.ts`/`governance.ts` étaient déjà dans leur état correct avant ce bloc, non touchés
par ce bloc).
