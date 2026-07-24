# P0.1 — Chronologie forensique Git (`/api/pierre/execute`)

Reconstruite le 2026-07-24 via `isomorphic-git` (git.exe est bloqué au niveau OS dans cet
environnement — voir mémoire "Git Blocked Gotcha"). Deux méthodes indépendantes et
convergentes ont été utilisées : (A) hash de contenu du blob à chaque commit d'un historique
de 61 commits (2026-05-24 → 2026-07-24), (B) statut Git par fichier (`git.status`) croisé avec
les mtimes réelles sur disque. Aucune opération destructive n'a été exécutée pour produire
cette preuve.

## Méthode A — hash de contenu par commit (61 commits, `8b0b5c5f7` → `0b3d79e61`)

| Fichier | Commits où le contenu change | Interprétation |
|---|---|---|
| `src/app/api/pierre/execute/route.ts` | `8b0b5c5f7` (2026-05-24, "B34 files and document intake layer") puis seulement `bea7a7dd1` et `0b3d79e61` (2026-07-24, "fix(build): defer/isolate lazy API runtime initialization") | Le contenu **committé** de ce fichier n'a jamais varié entre le 24 mai et le 24 juillet, sauf pour le refactor lazy-init externe. **Aucun commit, à aucun moment, ne contient de gouvernance.** |
| `src/lib/pierre/legacy-execute-governance.ts` | `<absent>` à tous les 61 commits vérifiés | Ce fichier n'a **jamais été commité** — il n'existe que dans l'arborescence de travail. |
| `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` | `<absent>` à tous les 61 commits vérifiés | Idem — jamais commité. |

## Méthode B — statut Git + mtime réelle sur disque (2026-07-24)

| Fichier | `git status` | mtime réelle | Interprétation |
|---|---|---|---|
| `src/lib/pierre/hr/cloneguard.ts` | `*modified` | 23/07/2026 19:19:25 | Modification additive P0.1 (kind `integration_sync`, règle `integration_sync_require`) toujours présente, jamais écrasée. |
| `src/lib/pierre/legacy-execute-governance.ts` | `*added` | 23/07/2026 19:25:59 | Créé juste après cloneguard.ts — ordre cohérent avec le rapport historique. Jamais commité, jamais modifié depuis. |
| `src/lib/pierre/__tests__/legacy-execute-governance.test.ts` | `*added` | 23/07/2026 19:30:51 | 8 tests unitaires — jamais commité, jamais modifié depuis. |
| `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` | `*added` | 23/07/2026 19:34:27 | 10 tests d'intégration — jamais commité, jamais modifié depuis. |
| `src/app/api/pierre/action/route.ts` (P0.2) | `*modified` | 23/07/2026 22:00:19 | Câblage gouvernance P0.2 — toujours présent, jamais écrasé. |
| `src/app/api/router/route.ts` (P0.2) | `*modified` | 23/07/2026 22:01:44 | Neutralisation 410 P0.2 — toujours présente, jamais écrasée. |
| **`src/app/api/pierre/execute/route.ts` (P0.1)** | **`unmodified`** | **24/07/2026 16:44:32** | **Seul fichier de toute la chaîne du 23/07 dont la mtime a sauté au lendemain** — very precisely dans la fenêtre horaire (16:44–17:35) déjà attribuée aux commits externes concurrents (`bea7a7dd1`/`0b3d79e61`) dans `00_BASELINE.md` et dans `phase-b-external-commit-review.md` du bloc précédent. |

## Lecture combinée

Les 5 autres artefacts produits pendant la session du 2026-07-23 (19h19–22h02) sont **tous
restés intacts, non commités, non modifiés depuis** — la persistance de travail non commité
dans ce dépôt n'est donc pas en cause en général (`action/route.ts` et `router/route.ts` en
sont la preuve directe : leur mtime du 23/07 22h n'a jamais bougé). Seul `execute/route.ts`
fait exception : son contenu committé n'a jamais rien connu de la gouvernance (Méthode A), et
sa mtime réelle prouve qu'il a été réécrit sur disque le lendemain (24/07 16:44:32), pile dans
la fenêtre des commits externes de refactor lazy-init.

La conclusion la plus probable est que le chantier externe concurrent (commits
`bea7a7dd1`/`0b3d79e61`, "fix(build): defer/isolate lazy API runtime initialization") a
retravaillé ce fichier à partir d'une base ne contenant pas la gouvernance non commitée du
23/07 (parce que celle-ci n'existait que dans l'arborescence de travail, jamais dans un commit
que ce chantier aurait pu hériter) — que ce soit via un checkout isolé, un second worktree, ou
tout mécanisme équivalent. Le résultat de ce chantier, une fois écrit sur disque puis commité,
ne pouvait mécaniquement pas contenir un correctif qui n'a jamais existé dans aucun commit. Le
mécanisme exact (checkout ciblé, worktree séparé, régénération) n'est pas prouvable avec les
outils disponibles ici (pas d'accès aux logs shell de la session du 23/07, `git.exe`
inutilisable) — mais le FAIT qu'une version gouvernée a existé, a été testée (18 tests,
build isolé vert selon le rapport historique), puis a cessé d'exister sur `route.ts`
spécifiquement pendant que tous ses artefacts compagnons survivaient, est prouvé par deux
méthodes indépendantes et convergentes.

## Classification retenue (obligatoire, une seule cause)

**`GOVERNED_VERSION_EXISTED_AND_WAS_OVERWRITTEN`**

Justification : la spécificité du rapport historique (noms de fichiers exacts, comptage de
lignes, 18 tests avec scénarios précis, `BUILD_ID` cité) est incompatible avec une pure
fabrication ("TESTS_AND_REPORTS_WERE_INCORRECT" est écarté) ; le module de gouvernance et ses
tests existent réellement sur disque, écrits avec un souci de détail technique correct
(`legacy-execute-governance.ts` réutilise réellement `evaluatePierreCloneGuard` +
`evaluateGovernance`, pas un simulacre) — ce n'est donc pas "GOVERNED_VERSION_EXISTED_BUT_WAS_NEVER_COMMITTED"
au sens pur, puisque le rapport et le commentaire du fichier de test décrivent explicitement
`route.ts` comme ayant été modifié et testé avec succès (551 lignes, init "eager" cohérente
avec l'architecture du 23/07, avant le refactor lazy-init du 24/07) ; il n'y a ni changement de
branche ni de worktree documenté ("BRANCH_OR_WORKTREE_DIVERGENCE" écarté, HEAD stable et
unique tout au long de ce bloc et du précédent) ; la cause n'est pas non plus indémontrable
("FORENSIC_CAUSE_NOT_PROVABLE" écarté) — la preuve converge trop précisément sur une seule
anomalie (mtime + hash) pour rester une hypothèse. Est-ce que "REPORTS_DESCRIBED_UNAPPLIED_CHANGES"
aurait pu s'appliquer ? Non : cette option suppose que le changement décrit n'a *jamais* été
appliqué à `route.ts` ; ce n'est pas ce que montre la preuve — la preuve montre que
quelque chose a physiquement réécrit `route.ts` **le lendemain**, ce qui n'aurait aucune raison
de se produire si aucune version gouvernée n'avait jamais existé sur ce fichier.

## Conséquence pratique pour la suite du bloc

Le module de gouvernance canonique (`legacy-execute-governance.ts`), ses 8 tests unitaires, et
la règle additive `integration_sync` de `cloneguard.ts` sont **réels, corrects et immédiatement
réutilisables** — aucune reconstruction n'est nécessaire. Le travail restant de ce bloc consiste
à **réappliquer le câblage de gouvernance dans `route.ts`** (Phases 4–8), en le faisant
cette fois **au-dessus de l'architecture lazy-init actuelle** (celle introduite par les commits
externes légitimes, qu'il ne faut pas défaire), et à corriger le fichier de test d'intégration
(dont le commentaire de tête suppose encore l'ancienne init "eager" et ne positionne pas les 3
variables `MAKE_*_WEBHOOK_URL` requises par `getRuntime()` actuel).
