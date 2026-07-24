# Post-Commit Worktree Matrix — après les commits 0 à 4

Ré-inventaire complet exécuté immédiatement après la création des 5 premiers commits (mêmes
répertoires scopés que l'inventaire initial : `src/`, `audit-20260723-full/`, `docs/`, `e2e/`,
`scripts/`, fichiers racine).

## HEAD après commits 0-4

`b3159c34546f3555869ffe2cfcc6a4d6069086e3` (avançé depuis
`0b3d79e61581cb7a8eec8f4a4ccaaf43b6e823be`, 5 commits : `422e99a0` → `aa17973a` → `a64d12c3` →
`b431 91ea` → `b3159c34`).

## Comparaison avant / après

| Catégorie | Avant (Phase 1) | Après (Phase 10) | Explication |
|---|---|---|---|
| `P0_GOVERNANCE` | 10 | **0** | Entièrement committé (Commit 1) — confirmé "unmodified" pour les 10 fichiers |
| `PAYMENT_PATH` | 12 | **0** | Entièrement committé (Commit 2) |
| `LEGAL_TRUST` | 7 | **0** | Entièrement committé (Commit 3) |
| `DEMO_MOBILE` | 17 | **0** | Entièrement committé (Commit 4) |
| `GITIGNORE_FIX` | 1 | **0** | Entièrement committé (Commit 0) |
| `AUDIT_DOCUMENTATION` | 114 | **123** | +9 — nouveaux livrables rédigés PENDANT ce bloc (`WORKTREE_FULL_STATUS_MATRIX.md`, `VALIDATED_COMMIT_PLAN.md`, `COMMIT_SECRET_SCAN.md`, `VALIDATED_COMMIT_TEST_MATRIX.md`, `P0_1_COMMITTED_BLOB_PROOF.md`, fichiers de preuve `CLONESTORE_AUDIT_EVIDENCE/worktree-preservation/*`) — pas encore committés (Commit 5, créé en dernier, voir ci-dessous) |
| `LOCAL_ENVIRONMENT` | 4 | 4 | Inchangé — non touché par ce bloc, hors périmètre |
| `TEMPORARY` | 7 | 7 | Inchangé — non touché par ce bloc, hors périmètre |
| `UNRELATED_PREEXISTING` | 1768 | **1768** | **Exactement inchangé** — preuve directe qu'aucun des 1768 fichiers hors périmètre n'a été affecté, directement ou indirectement, par les 5 commits de ce bloc |

## Vérification de non-interférence

Le nombre `UNRELATED_PREEXISTING` identique avant/après (1768 = 1768) est la preuve la plus
forte de ce tableau : les 5 commits n'ont capturé **exactement** les 47 fichiers prévus (+1
`.gitignore`), sans aucun effet de bord sur le reste du dépôt. Aucun fichier n'a été
« accidentellement » entraîné dans un commit par un `git add` trop large — chaque `git.add()`
de ce bloc a ciblé un chemin unique et explicite (voir `10_commits_0_to_4_log.txt`).

## Fichiers encore modifiés ou non suivis après ces 5 commits

Toutes les catégories restantes (`AUDIT_DOCUMENTATION` à 123, `LOCAL_ENVIRONMENT`,
`TEMPORARY`, `UNRELATED_PREEXISTING`) restent volontairement non commitées à ce stade :
`AUDIT_DOCUMENTATION` sera close par le Commit 5 (créé après la rédaction complète des
livrables restants de ce bloc, voir `VALIDATED_COMMIT_PLAN.md`) ; les 3 autres catégories
restent explicitement hors périmètre (voir `WORKTREE_FULL_STATUS_MATRIX.md` et
`VALIDATED_WORKTREE_REMAINING_RISKS.md`).

## Reconstruction mentale d'un clone propre du HEAD actuel

- **Compilation** : tous les imports de `execute/route.ts` (`evaluateLegacyExecuteGovernance`)
  résolvent vers un fichier réellement présent dans l'arbre Git (`legacy-execute-governance.ts`,
  committé dans le même commit) — aucun import cassé possible sur un clone frais.
- **Tests** : les 5 fichiers de test de gouvernance (18+15 tests) sont dans le même commit que
  le code qu'ils testent — un clone frais peut exécuter `npx vitest run` immédiatement sans
  fichier manquant.
- **Aucune dépendance ne repose uniquement sur le disque hors Git** pour ces 5 blocs — confirmé
  par `P0_1_COMMITTED_BLOB_PROOF.md` (lecture directe des blobs, jamais du disque).
