# Clean Head Reproducibility — Risques résiduels

## R1 — 1783 fichiers hors Git restent exposés au même risque que P0.1

Le cœur de ce bloc corrige un symptôme (le HEAD ne compilait pas seul) mais **1783 fichiers**
restent uniquement sur disque. Voir `LEGACY_WORKTREE_PRESERVATION_PRIORITY.md` et
`LEGACY_WORKTREE_FUTURE_COMMIT_PLAN.md` pour le plan de traitement — non exécuté dans ce bloc par
conception (interdiction explicite de committer ces fichiers en masse).

**CORRECTIF 2026-07-25** : parmi ces 1783, les 122 fichiers alors classés `PARTNER_PROGRAM`/P0
ne représentaient PAS du code non committé — vérification blob-par-blob (bloc PARTNER PROGRAM
PRESERVATION CLOSURE) : les 225 fichiers réels de ce périmètre sont déjà dans le HEAD (commits
du 2026-07-11), l'écart `*modified` était à 152/153 du bruit CRLF pur. Retiré de P0 ; le
reliquat réellement à risque reste les familles P1 (`P9X_P16_HR_CORE`, `P17`…`P19`, `GO_LIVE`,
`E1`, `C1_CLONECHAT`, migrations).

## R2 — Finding ESLint résiduel non corrigé (fidélité au principe d'intégration minimale)

`src/lib/demo/presentation/value-model.ts:377` — espace insécable (U+00A0) dans une chaîne
française, détecté par `no-irregular-whitespace`. Pré-existant (pas introduit par ce bloc),
fonctionnellement inoffensif (confirmé par les 7 tests verts de ce fichier, y compris le test
`formatMillions` qui exerce directement cette ligne). Non corrigé : la Phase 12 exige un
correctif **minimal**, et modifier ce caractère aurait dépassé le périmètre de « rendre le HEAD
reproductible » pour entrer dans « améliorer la qualité du code intégré » — un choix distinct,
à faire dans un futur bloc de nettoyage stylistique, pas ici.

## R3 — `.next-p10/p11/p12/p13/p96` restent committés dans l'historique

Reconfirmé (voir `TRACKED_BUILD_ARTIFACTS_REPORT.md`) : 1820 fichiers, 727,9 Mo, committés bien
avant ce bloc. Non retirés (opération destructive hors périmètre). Recommandation inchangée :
`git rm --cached -r` dans un futur bloc explicitement autorisé.

## R4 — Classification du reliquat au niveau famille, pas fichier par fichier

`LEGACY_WORKTREE_TRIAGE_MATRIX.md`/`LEGACY_WORKSTREAM_CLUSTER_MATRIX.md` classent les 1783
fichiers par familles de ~20 catégories (justifié par l'échelle : une revue individuelle
exhaustive équivaudrait à ré-exécuter ~20 blocs de fermeture historiques). Certaines familles
(`CORE_APPLICATION`, 736 fichiers ; `PIERRE_RUNTIME_CORE`, 344 fichiers) restent volontairement
larges et hétérogènes — un futur audit dédié devra les subdiviser avant qu'un plan de commit
fiable puisse être écrit pour elles spécifiquement.

## R5 — `embedded-postgres` — erreur TypeScript résiduelle, hors périmètre

`src/lib/clonechat/durable/__tests__/clonechat-durable.itest.ts` référence un paquet npm absent
de `package.json`. N'appartient à aucun des 5 blocs validés (chantier CloneChat P9.4.1
distinct). Non corrigé — nécessiterait soit l'ajout d'une dépendance npm (Phase 13, exigences
renforcées, hors périmètre de ce bloc), soit une modification de `tsconfig.json` pour exclure
les fichiers `.itest.ts` (touche un fichier de configuration partagé, mérite sa propre revue).

## R6 — Vérification faite sur un échantillon de 20 fichiers pour la Phase 17, pas l'intégralité

La confirmation « les 5 blocs validés sont `unmodified` contre le nouveau HEAD » (Phase 17) a
porté sur les 20 fichiers les plus représentatifs des 57 fichiers committés au total (47 + 10).
Les 37 fichiers restants n'ont pas été revérifiés individuellement dans cette phase spécifique —
ils l'ont cependant été de façon exhaustive lors de leurs commits respectifs (comparaison
hash blob-vs-disque à 100%, voir les journaux `10_commits_0_to_4_log.txt` et
`05_minimal_commit_log.txt`), donc ce risque est **théorique, pas une lacune de preuve réelle**.

## R7 — Deux copies propres volumineuses laissées sur disque

`clonestore-clean-head-da6d8022` (~1,3 Go avec `node_modules`) et `clonestore-clean-head-final`
(~1,3 Go avec `node_modules`) restent sur le disque de l'utilisateur, hors du dépôt principal,
comme demandé par le prompt maître (répertoires de preuve, pas destinés à être supprimés
automatiquement dans ce bloc). **Recommandation** : le propriétaire peut les supprimer
manuellement une fois la preuve de ce bloc validée — ni l'un ni l'autre n'est requis pour le
fonctionnement du dépôt principal.
