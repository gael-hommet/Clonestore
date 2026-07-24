# Validated Commit Test Matrix — Phase 8

Groupes ciblés exécutés séparément, sans double comptage, avant la création des commits.

| Groupe | Commande | Fichiers | Tests | Résultat |
|---|---|---|---|---|
| Gouvernance (P0.1 + P0.2 + transversal) | `npx vitest run src/lib/pierre/__tests__/legacy-execute-governance.test.ts src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts src/lib/pierre/__tests__/p0-transversal-consistency.test.ts src/app/api/pierre/action/__tests__/p0-2-governance-closure.test.ts src/app/api/router/__tests__/p0-2-router-neutralized.test.ts` | 5 | 33 | **33/33 verts** |
| Demo/Mobile | `npx vitest run src/components/demo/cost/__tests__/capacity-calculator-hydration.test.ts src/lib/demo/contextual-prompt/__tests__/detect.test.ts src/lib/demo/contextual-prompt/__tests__/contextual-prompt-flags.test.ts src/components/home/__tests__/demo-contextual-prompt-card.test.ts` | 4 | 27 | **27/27 verts** |
| Payment Path | `npx vitest run src/app/api/webhooks/stripe/__tests__/founder-stripe-webhook-er2.test.ts src/app/api/webhooks/stripe/__tests__/invoice-payment-failed-api-drift.test.ts src/app/api/webhooks/stripe/__tests__/orders-ledger-replay.test.ts src/lib/clonestore/pricing/__tests__/pricing-flags-revealed-default.test.ts src/lib/clonestore/production/__tests__/p15-reconciliation-revealed-default.test.ts src/app/api/checkout/__tests__/payment-path-country-checkout.test.ts src/app/api/webhooks/stripe/__tests__/payment-path-country-reconciliation.test.ts` | 7 | 45 | **45/45 verts** |
| Legal Trust | `npx vitest run src/app/api/checkout/__tests__/customer-mapping-route.test.ts` | 1 | 10 | **10/10 verts** |
| TypeScript (dépôt entier) | `node node_modules/typescript/bin/tsc --noEmit` | — | — | voir `VALIDATED_WORKTREE_PRESERVATION_REPORT.md` (exécuté en parallèle, résultat rapporté séparément) |
| ESLint scopé | Aucun fichier applicatif `.ts`/`.tsx` n'a été modifié par ce bloc lui-même (seuls `.gitignore` et des fichiers `.md` ont changé) — ESLint déjà confirmé 0 erreur sur ces mêmes fichiers applicatifs dans le bloc P0.1 précédent (`P0_1_TEST_MATRIX.md`), non ré-exécuté ici car aucun code n'a changé depuis | — | — | 0 erreur (héritée, non ré-exécutée car sans objet) |
| Build isolé (vrai code de sortie) | Voir `VALIDATED_WORKTREE_PRESERVATION_REPORT.md` Phase 7 | — | — | `REAL_EXIT_CODE=0`, `BUILD_ID=NqNA2UxIoY5b0qmrRhx9h` |

## Total ciblé de ce bloc (sans double comptage avec les blocs précédents)

**115 tests exécutés en direct dans ce bloc, 115/115 verts, 0 échec.** Ces tests recoupent
largement ceux déjà exécutés dans les blocs P0.1/Payment/Legal/Demo précédents (même code, pas
de changement applicatif depuis) — ce ré-examen sert à prouver que **rien n'a régressé entre la
fin de ces blocs et le moment du commit**, pas à produire un nouveau total à additionner aux
comptages historiques.
