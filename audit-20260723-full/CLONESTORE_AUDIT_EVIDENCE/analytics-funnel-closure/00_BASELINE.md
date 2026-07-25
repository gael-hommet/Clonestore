# Analytics, Funnel and Launch Measurement Closure — Baseline

Enregistré 2026-07-25.

## HEAD

- HEAD attendu au démarrage du master prompt : `4e90314aef488dba6c21dd7d4ee2c406e7f89651`.
- HEAD réel constaté : **`9d53a2ddd00ae88a78017745b85e64cc0273eed6`** — a avancé de 3 commits.
- Vérifié descendant direct de `4e90314a` (`git.isDescendent = true`, historique linéaire, aucune
  réécriture).
- Les 3 commits intervenants (`82a981f4b`, `7ae880ae5`, `9d53a2ddd`) appartiennent à un chantier
  Pierre HR (« replace HR mission.noop steps », « wire CloneStore technologies », « distinguish
  trace from business effect ») — 35 fichiers touchés, **0 fichier analytics/tracking/funnel/
  founder-access/conversion/BLOC3** parmi eux. Vérifié par comparaison d'arbre Git complète, pas
  par sondage.
- HEAD relevé une seconde fois 20 s plus tard : identique, **stable**.
- Ce bloc démarre donc sa baseline sur `9d53a2ddd00ae88a78017745b85e64cc0273eed6`, pas sur le HEAD
  attendu du prompt — aucune réécriture de ce travail concurrent légitime.

## Branche et remote

- Branche : `main`.
- Remote `origin` = `https://github.com/gael-hommet/Clonestore.git`, configuré mais **non
  contacté** (aucun `fetch`/`push`).

## Worktree

`git.statusMatrix()` complet (8928 entrées) :
- `unmodified` : 6057
- `*modified` : 2009
- `*added`/untracked : 862
- supprimés : 0

Ce volume correspond au reliquat déjà documenté (`LEGACY_WORKTREE_PRESERVATION_PRIORITY.md`,
`LEGACY_WORKSTREAM_CLUSTER_MATRIX.md`) — aucun de ces fichiers n'est attribué à ce bloc avant
vérification individuelle explicite dans les phases suivantes.

## Processus

`tasklist`/`wmic process` : aucun processus `next dev`/`next build`/`vitest` appartenant à
**CloneStore** (`C:\Users\homme\clonestore`) n'est actif. Deux processus `next start` trouvés
appartiennent à un projet totalement différent (`C:\Projets-Sites\maisons-scmc-concept`) — non
touchés, hors périmètre. Le reste des processus Node actifs sont des serveurs MCP d'outillage
(context7, playwright, sequential-thinking) sans rapport avec CloneStore.

## Mémoire et disque

~2,3 Go RAM libre / ~16,2 Go total ; ~27 Go disque libre sur `C:` (95 % utilisé).

## Garde-fous reconfirmés

- `PRODUCTION_AUTHORIZED = false as const` — intact.
- `.env.local` : uniquement `sk_test_`, aucune `sk_live_`.
- Aucun cron réel actif, aucun serveur de production CloneStore actif.

Aucune modification effectuée à ce stade — cartographie uniquement à partir de la Phase 1.
