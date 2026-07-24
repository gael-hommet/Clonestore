# Demo Test Matrix

## Unitaires / composants (nouveaux, ce bloc — 23 tests, 4 fichiers, tous verts)
| Fichier | Tests | Couvre |
|---|---|---|
| `capacity-calculator-hydration.test.ts` | 4 | Déterminisme SSR, absence de caret-color propre, valeur contrôlée correcte, exactement 2 `suppressHydrationWarning` justifiés |
| `contextual-prompt/__tests__/detect.test.ts` | 15 | Chaque branche de décision du prompt (flag, route, scroll, dismissal), ratio de scroll, arbitrage anti-collision (4 tests dédiés) |
| `contextual-prompt/__tests__/contextual-prompt-flags.test.ts` | 3 | Flag fermé par défaut, comparaison stricte à `"true"` |
| `demo-contextual-prompt-card.test.ts` | 5 | Rendu SSR, absence de caret-color, nom accessible + 3 boutons réels, absence de claims interdits, non-modal |

## Intégration / non-régression (existant, ré-exécuté)
94 fichiers de tests, 1432 tests, tous verts (voir `07-test-results.md` pour la commande exacte et la liste des domaines couverts : démo général, `/demo/pierre` (102 tests), guided-tour complet, founder-access, conversion BLOC3, checkout/Payment Path, webhooks Stripe, pricing, legal-commercial, `/api/pierre/action` et `/api/router` (P0.2), partenaires).

## Browser E2E
**NON EXÉCUTÉS — Playwright indisponible.** Voir `DEMO_BROWSER_TEST_MATRIX.md`.

## Exclu de ce bloc
`p0-governance-closure.test.ts` (9/10 rouges, cause racine identifiée comme un défaut de code préexistant sur `/api/pierre/execute`, pas une régression de ce bloc — voir `phase-b-external-commit-review.md` et le verdict final).

## Technique
tsc 0 erreur · ESLint ciblé exit 0 · aucun secret dans les logs · aucune PII dans les nouveaux événements analytics · scan de claims interdits vert sur le nouveau composant.

## Build isolé (résultat final)
2 tentatives. Tentative 1 : crash opaque du worker Next.js (code `4294967295`), aucune erreur applicative/TypeScript, environnement propre après coup. Une seule relance (pas de 3ᵉ tentative automatique) : **succès** — `REAL_EXIT_CODE=0`, `BUILD_ID=k8CJnDblN6dLdp3lKOy4r`, 196/196 pages statiques, les 12 routes requises confirmées dans le manifeste, 0 secret dans le log, HEAD et `PRODUCTION_AUTHORIZED=false` inchangés. Voir `build-final-verification.txt`. **Ce succès de build ne dit rien de la gouvernance de `/api/pierre/execute`** — voir `P0_1_EXECUTE_ROUTE_GOVERNANCE_GAP_PREEXISTING` ci-dessous.
