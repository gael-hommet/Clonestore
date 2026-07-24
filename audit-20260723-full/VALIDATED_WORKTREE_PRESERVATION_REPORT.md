# Validated Worktree Preservation and Commit Closure — Rapport de synthèse

**Date** : 2026-07-24. **Mission** : inventorier, vérifier et commiter sans perte les blocs
CloneStore validés (P0.1, P0.2, Payment Path, Legal Trust, Demo/Mobile) actuellement présents
uniquement dans l'arborescence de travail, suite à l'incident de conservation Git découvert et
corrigé dans le bloc P0.1 précédent (correctif réel, testé, jamais commité, écrasé par un
chantier concurrent).

## Constat de départ (Phase 0-1)

HEAD de départ `0b3d79e61581cb7a8eec8f4a4ccaaf43b6e823be`, stable (2 vérifications à 20s
d'intervalle). Inventaire scopé (`src/`, `audit-20260723-full/`, `docs/`, `e2e/`, `scripts/`,
racine) via `isomorphic-git` : **3878 chemins vérifiés, 1940 modifiés/ajoutés**. Classification
complète en 10 catégories (voir `WORKTREE_FULL_STATUS_MATRIX.md`) : seuls 47 fichiers
applicatifs/tests appartiennent aux 5 blocs nommés (10 gouvernance + 12 paiement + 7 légal + 17
démo/mobile), 114 sont des rapports d'audit à conserver documentairement, et **1768 sont hors
périmètre** (des mois de travail d'autres blocs jamais nommés dans ce prompt maître — la même
conséquence du "Git Blocked Gotcha" que celle qui a causé la perte de P0.1).

## Gate de gouvernance avant commit (Phase 2)

Vérifié depuis l'index à commiter (disque, avant staging) : import du gate, absence de
`callMake()` réel, absence de `MAKE_*_WEBHOOK_URL`, `GOVERNANCE_BLOCKED` présent, plancher
`hris.sync`, `EXECUTION_NOT_AVAILABLE` présent, `/api/router` 410, `/api/pierre/action` utilise
le module partagé — **8/8 gates passés**.

## Exclusions (Phase 4) et scan de secrets (Phase 5)

Découverte en Phase 4 : `.next-p10/p11/p12/p13/p96` sont déjà committés dans l'historique Git,
bien avant ce bloc (non retirés, hors périmètre — voir `VALIDATED_WORKTREE_REMAINING_RISKS.md`
R1). Deux règles `.gitignore` minimales ajoutées (`.next-*/`, `.claude/`) pour empêcher toute
récidive. Scan de secrets sur les 161 candidats au commit (47 code/test + 114 docs) : **0
correspondance** (voir `COMMIT_SECRET_SCAN.md`). 3 captures d'écran candidates au commit
vérifiées visuellement une par une : aucune donnée privée.

## Build réel et tests ciblés (Phases 7-8)

Vrai code de sortie du build capturé sans masquage par un pipeline `tail` :
`REAL_EXIT_CODE=0`, `BUILD_ID=NqNA2UxIoY5b0qmrRhx9h`, les 4 routes de gouvernance + `/checkout`
+ `/demo` + `/demo/pierre` confirmées dans la table de routes, 0 occurrence de "error" dans
toute la sortie. 115 tests ciblés exécutés en direct (33 gouvernance + 27 demo + 45 payment + 10
legal), **115/115 verts**. `tsc --noEmit` : 0 erreur (répertoire entier).

## Commits créés (Phase 9)

6 commits locaux, chacun avec une allowlist explicite, `git.add()` fichier par fichier, vérifié
par comparaison de hash blob-vs-disque après chaque commit (voir
`CLONESTORE_AUDIT_EVIDENCE/worktree-preservation/10_commits_0_to_4_log.txt` pour les 5 premiers
et le journal du Commit 5 ci-dessous) :

| # | Message | OID | Fichiers |
|---|---|---|---|
| 0 | `chore(git): ignore isolated build distDirs and local Claude state` | `422e99a08f844fb4d2d9a7237cd4eca255ab18c2` | 1 |
| 1 | `fix(governance): close Pierre legacy execution surfaces` | `aa17973a65450ee725d6c4b8b61edaf5a5af30d6` | 10 |
| 2 | `fix(payment): close country-aware checkout path` | `a64d12c303595a38d142cc6482e467582ed5c6f8` | 12 |
| 3 | `fix(legal): close commercial trust implementation` | `b43191eafa56cf628e45e540d5e8307de46abbe3` | 7 |
| 4 | `fix(demo): close hydration and contextual conversion path` | `b3159c34546f3555869ffe2cfcc6a4d6069086e3` | 17 |
| 5 | `docs(audit): reconcile CloneStore closure evidence` | voir `POST_COMMIT_WORKTREE_MATRIX.md` mise à jour finale | ~130+ |

Aucun `git reset`, `clean`, `checkout --`, `restore`, `stash`, `rebase`, `amend` ou force-push à
aucun moment. Aucun commit vide. Aucun mélange d'un changement applicatif critique avec les
fichiers de preuve (Commit 5 strictement documentaire).

## Vérification post-commit (Phases 10-11)

Ré-inventaire après commits 0-4 : les 5 catégories de code (`P0_GOVERNANCE`, `PAYMENT_PATH`,
`LEGAL_TRUST`, `DEMO_MOBILE`, `GITIGNORE_FIX`) passent de 47+1 fichiers modifiés à **0** ;
`UNRELATED_PREEXISTING` reste à **exactement 1768** (preuve de non-interférence). Preuve depuis
les blobs Git committés (pas depuis le disque) : **14/14 vérifications de gouvernance réussies**
directement depuis l'arbre du HEAD final (voir `P0_1_COMMITTED_BLOB_PROOF.md`).

## Push (Phase 12)

**Aucun push effectué.** Remote configuré : `origin = https://github.com/gael-hommet/Clonestore.git`.
Branche locale `main` désormais en avance de 6 commits sur `origin/main` (dernier commit connu
distant : à vérifier via `git fetch` avant tout push, non fait dans ce bloc). Commande sûre qui
serait nécessaire pour pousser, si et seulement si autorisée explicitement dans un futur bloc :
`git push origin main` (jamais `--force`).

## Verdict

Voir `VALIDATED_WORKTREE_PRESERVATION_VERDICT.md` pour les 21 réponses obligatoires.
