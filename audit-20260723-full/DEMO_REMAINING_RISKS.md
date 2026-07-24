# Demo and Mobile Conversion Closure — Remaining Risks

## RISQUE-1 (CRITIQUE) — `P0_1_EXECUTE_ROUTE_GOVERNANCE_GAP_PREEXISTING` — **FERMÉ 2026-07-24 (bloc P0.1 EXECUTE ROUTE GOVERNANCE RE-CLOSURE)**
Découvert incidemment lors de l'investigation des 4 commits externes concurrents pendant ce bloc Demo/Mobile. Cause racine établie ensuite par forensique Git dédiée : une version gouvernée de `/api/pierre/execute` avait réellement existé le 2026-07-23 (module `legacy-execute-governance.ts` + 18 tests réels) mais n'avait jamais été commitée et a été écrasée sur disque le 2026-07-24 par le même chantier externe concurrent examiné dans ce bloc — classification `GOVERNED_VERSION_EXISTED_AND_WAS_OVERWRITTEN`, voir `P0_1_GIT_FORENSIC_TIMELINE.md`. Re-fermé : gouvernance canonique réintégrée, connecteur Make direct retiré entièrement, 18/18 + 15/15 + 5611/5613 tests verts, tsc 0, build isolé vert (voir `P0_1_BUILD_EVIDENCE.md`). Voir `phase-b-external-commit-review.md` pour le contexte de découverte initial de ce bloc-ci.

## RISQUE-2 — Cause de l'ancien mismatch d'hydratation non prouvée à 100%
Hautement probable (extension navigateur), jamais confirmée par un test comparatif navigateur propre/avec extensions. Classé `BROWSER_REPRODUCTION_PENDING`. Voir `DEMO_HYDRATION_ROOT_CAUSE_REPORT.md`.

## RISQUE-3 — Validation externe (30 testeurs) non exécutée
Protocole prêt (`DEMO_EXTERNAL_VALIDATION_PROTOCOL.md`), aucun testeur réel impliqué. `EXTERNAL_VALIDATION_PENDING`.

## RISQUE-4 — Aucun test navigateur réel sur aucun viewport
Playwright indisponible tout le bloc. Aucune capture, aucune mesure de performance/CLS/débordement réelle. Voir `MOBILE_VIEWPORT_TEST_MATRIX.md`, `DEMO_PERFORMANCE_MATRIX.md`, `DEMO_BROWSER_TEST_MATRIX.md`.

## RISQUE-5 — Contrat analytics non unifié
3 systèmes indépendants (analytics locale démo, founder-access persistant, BLOC3 non persistant pour le trafic organique), aucun filtre trafic interne/test, `cs_anon_sid` généré côté client mais toujours ignoré côté serveur, événements conceptuellement dupliqués (jusqu'à 3× pour une même action). Documenté, non unifié — prochain bloc explicite (ANALYTICS, FUNNEL AND LAUNCH MEASUREMENT CLOSURE).

## RISQUE-6 — Bouton de fermeture du nouveau prompt sous le seuil tactile recommandé
32px (`size-8`) vs. 44×44 CSS px recommandé — copié du composant sœur préexistant `InstallPrompt.tsx` (même défaut potentiel, non introduit ici). Non corrigé pour rester cohérent avec le composant existant plutôt que diverger seul.

## RISQUE-7 — Aucun test automatisé de navigation clavier réelle ni de lecteur d'écran
Seule la présence d'éléments natifs focusables a été vérifiée statiquement (pas de jsdom disponible).

## RISQUE-8 — Nouveau flag `NEXT_PUBLIC_DEMO_CONTEXTUAL_PROMPT_ENABLED` non activé en production
Décision volontaire (feature non validée par des testeurs externes). Variable documentée dans `DEMO_CONTEXTUAL_PROMPT_SPEC.md`, à activer par le propriétaire après revue.

## RISQUE-9 — Fragilité de test préexistante (env var bleeding) observée hors périmètre
Un run de la suite complète a montré une contamination transitoire entre fichiers de test (`process.env.NODE_ENV` probablement) affectant `signature-route-failclosed.test.ts` et `payment-path-country-reconciliation.test.ts` — disparue au second run identique. Non liée à ce bloc, non investiguée plus avant (hors périmètre), signalée pour information.

## Ce qui N'EST PAS un risque ouvert (pour éviter tout doute)
- `PRODUCTION_AUTHORIZED` reste `false as const`, reconfirmé inchangé.
- Aucun des 4 commits externes concurrents n'a été annulé, modifié, ou altéré par ce bloc.
- Homepage hero/slogan/schémas/illustrations/animations : prouvés inchangés (`HOMEPAGE_PROTECTED_ELEMENTS_PROOF.md`).
- Aucune collision possible entre les deux invitations flottantes (prouvé par 165 tests + arbitrage explicite).
- 1432 tests de non-régression + 23 nouveaux tests, tous verts, reproductibles.
- tsc 0 erreur, ESLint ciblé exit 0.
- Build de production isolé du sous-bloc Demo/Mobile : **vert** (`BUILD_ID=k8CJnDblN6dLdp3lKOy4r`, 196/196, `REAL_EXIT_CODE=0`, 12 routes requises confirmées, 0 secret) — voir `build-final-verification.txt`. Ceci ferme uniquement le gate technique de CE sous-bloc, pas la sécurité globale du lancement (RISQUE-1 reste ouvert).
