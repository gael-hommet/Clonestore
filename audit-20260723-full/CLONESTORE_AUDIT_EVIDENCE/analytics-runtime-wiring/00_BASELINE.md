# Canonical Analytics Runtime Wiring Closure — Baseline

Enregistré 2026-07-25.

## HEAD

- Attendu (fin du bloc Analytics précédent) : `871c5d266e9ef25a4018c71deaa456a35a5dadb6`.
- Réel : **`6c82768270a92a563349f8d237b7fa21f9ef1a6e`** — a avancé de 1 commit.
- Descendant direct vérifié (`isDescendent = true`), historique linéaire, aucune réécriture.
- Commit intervenant : `6c8276827` — « feat(pierre): recruitment domain depth (full workflow) +
  trace/collection justification », 8 fichiers, **0 fichier analytics/webhook/checkout/
  founder-access/demo/guided-tour/layout** parmi eux (vérifié par comparaison d'arbre Git
  complète). Chantier Pierre HR concurrent, sans rapport avec ce bloc.
- HEAD relevé une 2ᵉ fois 20 s plus tard : identique, **stable**.
- Ce bloc démarre donc sur `6c82768270a92a563349f8d237b7fa21f9ef1a6e`.

## Branche et remote

`main`. Remote `origin` configuré, non contacté.

## Worktree

`git.statusMatrix()` : 6179 unmodified, 1968 `*modified` (majoritairement CRLF/legacy déjà
documentés dans les blocs précédents), 840 untracked, 0 supprimé. Aucun de ces fichiers n'est
attribué à ce bloc avant modification explicite.

## Garde-fous reconfirmés

- `PRODUCTION_AUTHORIZED = false as const` — intact.
- `.env.local` : uniquement `sk_test_`, aucune `sk_live_`.
- Aucun serveur `next dev`/`next build`/`vitest` CloneStore actif (les processus Node restants
  sont des serveurs MCP d'outillage + un projet tiers `maisons-scmc-concept`, hors périmètre).

## Point de départ fonctionnel (rappel du bloc précédent)

Le contrat canonique, les 4 identités, la table append-only, l'endpoint d'ingestion, le tracker
page-view et le dashboard existent et sont testés (84 tests). Ce qui manque et que ce bloc doit
fermer : le **branchement runtime réel** de chaque vérité métier (founder-access, /demo,
/demo/pierre, GuidedTour, checkout, webhook Stripe, attribution Partner) vers le sink canonique,
sans double comptage. Aucun événement réel ne traverse encore le système à part `page_viewed`.

Aucune modification effectuée à ce stade.
