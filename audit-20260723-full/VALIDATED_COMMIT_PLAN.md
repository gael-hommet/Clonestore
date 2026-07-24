# Validated Commit Plan — Validated Worktree Preservation and Commit Closure

6 commits, exécutés dans cet ordre exact via `isomorphic-git` (allowlist explicite par commit,
`git.add()` fichier par fichier, aucun `git add -A`). Le HEAD de départ est
`0b3d79e61581cb7a8eec8f4a4ccaaf43b6e823be` (branche `main`), stable (voir `00_BASELINE.md`).

## Commit 0 — `chore(git): ignore isolated build distDirs and local Claude state`

**Contenu (1 fichier) :** `.gitignore` (ajout de 2 règles minimales : `.next-*/` et `.claude/`,
motivées par la découverte que `.next-p10/p11/p12/p13/p96` sont déjà committés dans un HEAD
historique très antérieur — voir `WORKTREE_FULL_STATUS_MATRIX.md`).
**Tests associés :** aucun (fichier de configuration).
**Risque :** Très faible — additif uniquement, ne modifie aucun comportement produit. Exécuté
en premier pour que ses règles soient actives avant tout commit suivant (défense en profondeur).

## Commit 1 — `fix(governance): close Pierre legacy execution surfaces`

**Contenu (10 fichiers) :** P0.1 (`src/app/api/pierre/execute/route.ts`,
`src/lib/pierre/legacy-execute-governance.ts`, `src/lib/pierre/hr/cloneguard.ts`,
`src/lib/pierre/__tests__/legacy-execute-governance.test.ts`,
`src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts`,
`src/lib/pierre/__tests__/p0-transversal-consistency.test.ts`) + P0.2
(`src/app/api/pierre/action/route.ts`, `src/app/api/router/route.ts`,
`src/app/api/pierre/action/__tests__/p0-2-governance-closure.test.ts`,
`src/app/api/router/__tests__/p0-2-router-neutralized.test.ts`).
**Tests associés :** 18 P0.1 + 15 transversaux P0.1/P0.2 (voir Phase 8).
**Risque :** Le plus élevé du bloc si mal exécuté (c'est exactement ce dont la perte de P0.1
était la conséquence) — d'où le Gate de Phase 2, déjà vérifié depuis l'index à commiter avant
ce plan (voir section dédiée dans `VALIDATED_WORKTREE_PRESERVATION_REPORT.md`) : import du
gate, absence de `callMake()` réel, absence de `MAKE_*_WEBHOOK_URL`, `GOVERNANCE_BLOCKED`
présent, plancher `hris.sync`, `EXECUTION_NOT_AVAILABLE` présent, `/api/router` 410, `/api/pierre/action`
utilise le module partagé — tous confirmés avant ce plan.

## Commit 2 — `fix(payment): close country-aware checkout path`

**Contenu (12 fichiers) :** `src/lib/clonestore/pricing/pricing-flags.ts`,
`src/lib/clonestore/production/p15-checkout-reconciliation-gate.ts`,
`src/app/api/webhooks/stripe/route.ts`, `src/components/pricing/CountryPricingCard.tsx`,
`src/app/checkout/page.tsx` (contient aussi la checkbox légale de Legal Trust — voir note
ci-dessous), + 7 fichiers de test (3 opt-out existants + 4 nouveaux).
**Note sur `checkout/page.tsx` :** ce fichier a été modifié par Payment Path (pays) PUIS par
Legal Trust (checkbox), sans commit intermédiaire — son contenu actuel est cumulatif. Il est
committé une seule fois, ici, avec les deux changements ; le Commit 3 (Legal) ne le
re-mentionne pas puisqu'il serait alors déjà identique au HEAD.
**Exclu explicitement :** `.env.local` (2 nouvelles clés Stripe test) — jamais commité, quel
que soit le bloc, conformément à l'interdiction absolue.
**Tests associés :** groupe Payment ciblé (voir Phase 8).
**Risque :** Faible — additif, flags révélés par défaut déjà testés.

## Commit 3 — `fix(legal): close commercial trust implementation`

**Contenu (7 fichiers) :** `src/components/site/site-footer.tsx`,
`src/app/legal/confidentialite/page.tsx`, `src/app/api/checkout/route.ts`,
`src/app/signup/page.tsx`, `src/app/questions/page.tsx`, `src/app/partenaires/page.tsx`,
`src/app/api/checkout/__tests__/customer-mapping-route.test.ts`.
**Tests associés :** groupe Legal ciblé (voir Phase 8).
**Risque :** Faible — aucun placeholder juridique transformé en valeur réelle (vérifié : les 4
autres pages légales restent inchangées, l'identité éditeur reste absente).

## Commit 4 — `fix(demo): close hydration and contextual conversion path`

**Contenu (17 fichiers) :** `src/components/demo/cost/CapacityCalculator.tsx`,
`src/components/demo/acts/ValueChapter.tsx`, `src/lib/founder-access/types.ts`,
`src/app/page.tsx`, `src/app/demo/pierre/page.tsx`, `vitest.config.ts`,
`src/lib/demo/contextual-prompt/{constants,contextual-prompt-flags,detect}.ts`,
`src/components/home/DemoContextualPrompt{,Card}.tsx`,
`src/components/guided-tour/GuidedTourProvider.tsx`,
`src/app/demo/pierre/_variant/DemoEventTracker.tsx`, + 4 fichiers de test.
**Tests associés :** groupe Demo ciblé (voir Phase 8).
**Risque :** Faible — flag `NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED` reste OFF par défaut
(vérifié avant ce plan), homepage protégée non touchée hors point de montage.

## Commit 5 — `docs(audit): reconcile CloneStore closure evidence`

**Contenu (114 fichiers) :** tous les rapports/matrices/preuves sous `audit-20260723-full/`
déjà présents (P0/P0.1/P0.2/Payment/Legal/Demo + audit initial), y compris les 3 captures
d'écran vérifiées manuellement sans donnée privée. Voir la liste complète dans
`WORKTREE_FULL_STATUS_MATRIX.md` section AUDIT_DOCUMENTATION.
**Tests associés :** aucun (fichiers texte/preuves, pas de code).
**Risque :** Aucun (pas de code exécutable committé).
**Remarque :** ce commit inclut nécessairement les nouveaux fichiers de CE bloc
(`WORKTREE_FULL_STATUS_MATRIX.md` lui-même, etc.) — comme ceux-ci sont écrits progressivement
pendant l'exécution du bloc, ce commit sera créé en dernier, après la rédaction de tous les
livrables restants (Phase 13 de facto).

## Ce qui n'est explicitement PAS commité par ce plan

`LOCAL_ENVIRONMENT` (4), `TEMPORARY` (7), `UNRELATED_PREEXISTING` (1768) — voir
`WORKTREE_FULL_STATUS_MATRIX.md` pour la justification catégorie par catégorie. Aucun commit
vide n'est créé ; aucun commit ne mélange un changement applicatif critique avec des centaines
de fichiers de preuves (Commit 5 est strictement documentaire, séparé des 4 commits de code).
