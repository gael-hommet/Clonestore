# Exact Demo Restoration — Report

## Demande

Restaurer la démo value-first validée, la route `clonestore.pro/demo` affichant une ancienne
version institutionnelle trop textuelle (« N'achetez plus seulement des logiciels… »).

## Constat prouvé

Le **dépôt est déjà value-first**. Forensique Git (`DEMO_GIT_VISUAL_TIMELINE.md`) :
- L'ancienne version institutionnelle (Act1Opening en premier écran) était l'état committé jusqu'au
  `02cf93180` (2026-07-13).
- La refonte value-first (ValueShock — 11 h 35 → 12 min, 1,6 M€/an — en premier écran) a été
  committée au `90932a0bc` (2026-07-25) et n'a jamais été révertie.
- Au HEAD actuel, `DemoExperience.tsx` est `unmodified` et rend `<ValueShock/>` avant
  `<Act1Opening/>`.

**Preuve visuelle réelle** (Playwright + Chromium, `DEMO_VISUAL_RESTORATION_COMPARISON.md`) :
desktop 1440 et mobile 390 affichent, sans scroller, le choc de valeur value-first (11 h 35 →
12 min ; 1,6 M€/an ; CTA « Voir ce que Pierre absorbe »), aucun mur de texte.

**Cause racine** (`DEMO_REGRESSION_ROOT_CAUSE.md`) : la régression est un **déploiement périmé**,
pas une régression du dépôt. `a998eba5` a **préservé** (jamais causé) la version value-first.

## Action réalisée

Aucune restauration de code (le dépôt est déjà correct — restaurer d'anciens blobs serait inutile
et risquerait d'écraser l'Analytics). Ce bloc :
1. **Prouve** visuellement que le dépôt est value-first (desktop + mobile).
2. Ajoute **un verrou anti-régression** : `demo-value-first-order.test.ts` (4 tests) qui
   verrouille l'ordre value-first au niveau du dépôt (données fermées + structure).
3. Confirme que l'Analytics canonique de la démo est **intacte**
   (`DEMO_ANALYTICS_PRESERVATION_MATRIX.md`).
4. Ne touche à **aucune** autre partie de CloneStore (homepage, hero, slogan, checkout, webhook,
   Partner, Pierre runtime, `PRODUCTION_AUTHORIZED=false`).

## Correction de production (hors périmètre)

La production `clonestore.pro/demo` sera corrigée par un **redéploiement** du HEAD actuel — action
hors périmètre de ce bloc (aucun push, aucun déploiement autorisé). Le code à déployer est déjà la
bonne version value-first.

## Tests / build

- Suite démo : **85/85 verte** (dont le verrou anti-régression), `DEMO_RESTORATION_TEST_MATRIX.md`.
- ESLint ciblé : 0 erreur.
- Build pré-commit : voir `build-precommit.txt` / `DEMO_RESTORATION_CLEAN_CHECKOUT_PROOF.md`.

## Verdict

Voir `EXACT_DEMO_RESTORATION_VERDICT.md`. Statut : **`EXACT_DEMO_RESTORED`** (déjà présent dans le
dépôt + verrou anti-régression ajouté + preuve visuelle desktop/mobile).
