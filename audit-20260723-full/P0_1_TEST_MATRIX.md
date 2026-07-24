# P0.1 — Matrice de tests (comptages séparés, non cumulés)

Avertissement explicite (exigé par le prompt maître) : les 4 lots ci-dessous **se recouvrent
partiellement** — les lots 1 et 2 sont des sous-ensembles du lot 3, et le lot 4 partage
certains fichiers `src/lib/pierre/__tests__/*.test.ts` avec le lot 3. **Ne jamais additionner
ces totaux entre eux.** Chaque lot est rapporté avec son propre total, exécuté et compté
séparément.

## Lot 1 — Tests P0.1 spécifiques (nouveaux/réparés ce bloc)

Commande : `npx vitest run src/lib/pierre/__tests__/legacy-execute-governance.test.ts src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts`

| Fichier | Tests | Résultat |
|---|---|---|
| `src/lib/pierre/__tests__/legacy-execute-governance.test.ts` (unitaire, fonction pure) | 8 | 8 verts |
| `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` (intégration route) | 10 | 10 verts |
| **Total lot 1** | **18** | **18 verts, 0 échec** |

Correspond exactement au comptage annoncé par le rapport historique (8+10=18) — confirmé
réellement exécuté cette fois, avec la seule correction nécessaire étant le commentaire de tête
du fichier de test (mentionnait l'ancienne init "eager", corrigé pour refléter `getRuntime()`
paresseux). Aucune variable d'environnement supplémentaire n'a dû être ajoutée : la suppression
des 3 `MAKE_*_WEBHOOK_URL` de `getRuntime()` a rendu le `beforeAll` existant (qui ne positionnait
que 3 variables) déjà suffisant.

## Lot 2 — Tests transversaux P0.1/P0.2

Commande : `npx vitest run src/lib/pierre/__tests__/p0-transversal-consistency.test.ts src/app/api/pierre/action/__tests__/p0-2-governance-closure.test.ts src/app/api/router/__tests__/p0-2-router-neutralized.test.ts`

| Fichier | Tests | Résultat |
|---|---|---|
| `p0-transversal-consistency.test.ts` | 3 | 3 verts |
| `p0-2-governance-closure.test.ts` (`/api/pierre/action`) | 9 | 9 verts |
| `p0-2-router-neutralized.test.ts` (`/api/router`) | 3 | 3 verts |
| **Total lot 2** | **15** | **15 verts, 0 échec** |

Confirme que `/api/pierre/action` et `/api/router` (P0.2) sont restés intacts et cohérents avec
la gouvernance désormais restaurée sur `/api/pierre/execute`.

## Lot 3 — Sweep complet de la zone Pierre (contient les lots 1 et 2)

Commande : `npx vitest run src/lib/pierre src/app/api/pierre`

| | |
|---|---|
| Fichiers de test | 134 |
| Tests | 5613 |
| Verts | 5611 |
| Échec (1) | `src/app/api/pierre/use/document/preview/__tests__/document-preview-jurisdiction-p20.test.ts` — échoue uniquement en exécution parallèle massive (134 fichiers simultanés) ; **ré-exécuté seul → 7/7 verts**. Module P20.1 (jurisdiction documentaire), sans aucune relation de code avec `/api/pierre/execute` ou la gouvernance — flake d'environnement préexistant, non introduit par ce bloc. |
| Ignoré | 1 |

## Lot 4 — Suite `npm test` (curated, périmètre majoritairement hors Pierre)

Commande : `npm test` (deux invocations vitest chaînées définies dans `package.json`, couvrant
legal/launch-readiness/technologies/go-live/checkout/auth/billing/cloneos/webhooks/founder-access
+ un sous-ensemble de `src/lib/pierre/__tests__/*.test.ts` qui **recoupe** le lot 3 ci-dessus).

| Invocation | Fichiers | Tests | Résultat |
|---|---|---|---|
| 1ère (liste explicite ~120 fichiers) | 128 | 8950 | 8950 verts |
| 2ème (répertoires founder-access/webhooks/internal/demo) | 29 | 215 | 215 verts |
| **Total lot 4** | **157** | **9165** | **9165 verts, 0 échec** |

## Synthèse (sans double comptage)

- **0 régression réelle introduite par ce bloc** dans les 4 lots : le seul échec observé (lot 3)
  est un flake de parallélisme préexistant sur un fichier sans lien de code avec les changements
  de ce bloc, reproduit comme vert en isolation.
- Les lots 1 et 2 (33 tests) sont des **sous-ensembles** du lot 3 (5613 tests) — ne pas les
  additionner.
- Le lot 4 (9165 tests) **partage des fichiers** avec le lot 3 mais couvre principalement des
  zones sans rapport avec ce bloc — rapporté séparément, jamais fusionné en un total unique.
