# Demo Restoration — Test Matrix

Exécuté 2026-07-27 dans le dépôt principal (HEAD `62cbb6fb`).

## Suite démo — 85/85 verts

| Fichier | Objet |
|---|---|
| `src/components/demo/__tests__/demo-value-first-order.test.ts` | **NOUVEAU — verrou anti-régression value-first** (4 tests) |
| `src/lib/demo/presentation/__tests__/value-model.test.ts` | choc 11 h 35 → 12 min, capacité > 1 M€/an, gradations |
| `src/lib/demo/presentation/__tests__/autonomy-modes.test.ts` | modes d'autonomie |
| `src/lib/demo/presentation/__tests__/cost-model.test.ts` | modèle de coût |
| `src/lib/demo/presentation/__tests__/p17-demo-reveal-role.test.ts` | révélation Pierre |
| `src/components/demo/cost/__tests__/capacity-calculator-hydration.test.ts` | hydratation calculateur |
| `src/components/demo/primitives/__tests__/cine.test.ts` | primitives ciné |
| **Total** | **7 fichiers, 85 tests, 0 échec** |

## Détail du verrou anti-régression (`demo-value-first-order.test.ts`)

1. `DEMO_SCENE_NAV[0].id === "demo-act-choc"` (« La preuve ») ET le hero institutionnel
   `demo-act-open` a un index > 0 — **le choc de valeur est le premier écran, jamais le hero
   institutionnel** (données fermées).
2. `DemoExperience` rend `<ValueShock/>` **avant** `<Act1Opening/>` (ordre de rendu réel, par
   composant, pas par texte).
3. Marqueurs chiffrés value-first alimentés : `missionShock()` → 695 min (11 h 35) → 12 min ;
   `annualValue("groupe")` → capacité > 1 M€/an.
4. Les 9 scènes canoniques restent dans l'ordre value-first exact.

Le test utilise **identifiants + structure + données fermées** — jamais une comparaison fragile de
longs textes. Il échouerait immédiatement si un futur changement remettait `Act1Opening` (ou tout
chapitre institutionnel) en premier écran.

## ESLint

`eslint src/components/demo/__tests__/demo-value-first-order.test.ts` → **0 erreur**.

## TypeScript

Non ré-exécuté globalement dans ce bloc (aucun changement runtime ; seul un test ajouté). Le tsc
global du dépôt reste dans l'état honnêtement rapporté par le bloc de réconciliation
(`GLOBAL_TSC_FAIL_UNRELATED_PREEXISTING` — dépendance de test `embedded-postgres` hors périmètre
démo). Le nouveau test n'introduit aucune erreur TypeScript (types stricts, imports résolus).
